---
layout: post
title: "Graph-augmented retrieval and reciprocal rank fusion"
tags: [ LLM, AI, Python, Reliable by Design ]
featured_image_thumbnail: assets/images/posts/misc/graph-retrieval_thumbnail.jpg
featured_image: assets/images/posts/misc/graph-retrieval.jpg
featured: false
---

Embeddings answer conceptual questions. Keyword search answers exact-identifier questions. A code graph answers structural questions — callers, implementors, transitive dependencies. Each of these retrieval methods fails on the other two question types. This article covers how to run all three together and fuse their ranked outputs into a single list using reciprocal rank fusion.

<!--more-->

## Three retrieval lanes

The previous article in this series built a symbol-granular embedding index. That index handles queries like "how does the system handle expired sessions?" — natural-language questions where the user does not know the specific identifier names. The embedding model maps the query and the stored chunks into the same space, and the closest neighbours come back as results.

Two question types it cannot handle well.

"Find the definition of `findUserByEmail`." The embedding index returns code that is *conceptually* about finding users by email — a superset that includes related classes, helper methods, and tests. Keyword search returns the symbol literally named `findUserByEmail` at rank 1.

"What calls `validateSession`?" The embedding index returns code that *looks like* it might call `validateSession`. The call graph returns every caller exactly and completely. A top-K similarity result is the wrong tool for a question whose answer is "all nodes with an outgoing CALLS edge to this method."

The three lanes cover different territory. Running all three and fusing their results beats any single lane on the queries that mix modes — and there are more of those than you'd expect.

## BM25 for code

BM25 is the ranking function behind most keyword search systems. The intuition: a document scores highly when it contains the query's terms, especially rare ones, in a short body. The formula normalises for document length and term frequency so scores are comparable across the corpus.

The one adjustment BM25 needs for source code is a tokeniser that understands identifier naming conventions. A standard whitespace tokeniser treats `processOrderRefund` as one opaque token. A query for `Order` should match it; a standard tokeniser would not make that connection.

```python
import re

CAMEL_BOUNDARY = re.compile(r"(?<!^)(?=[A-Z])")
NON_WORD = re.compile(r"[^A-Za-z0-9_]+")

def tokenise_code(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    def emit(token: str) -> None:
        token = token.lower()
        if token and token not in seen:
            seen.add(token)
            out.append(token)

    for raw in NON_WORD.split(text):
        if not raw:
            continue
        emit(raw)
        is_mixed_case = any(c.isupper() for c in raw) and any(c.islower() for c in raw)
        if is_mixed_case:
            for part in CAMEL_BOUNDARY.split(raw):
                emit(part)
        if "_" in raw:
            for part in raw.split("_"):
                emit(part)
    return out
```

Applied to `processOrderRefund`, this emits the original token lowercased, then `process`, `order`, `refund` as CamelCase parts. Applied to `MAX_RETRY_COUNT`, it emits `max_retry_count`, then `max`, `retry`, `count` as snake_case parts. The all-uppercase guard prevents the CamelCase pass from running on screaming-snake constants, which would otherwise produce single-letter noise.

Deduplication through `seen` matters: identifiers combining both conventions produce overlapping splits without it, inflating the corpus term frequencies.

Build the index over the same chunks the embedding index uses, with the same IDs. The fusion step requires that all lanes refer to the same underlying symbol by the same identifier.

```python
from rank_bm25 import BM25Okapi

tokenised_corpus = [tokenise_code(chunk.text) for chunk in chunks]
bm25 = BM25Okapi(tokenised_corpus)

def keyword_search(query: str, top_k: int = 50) -> list[str]:
    tokens = tokenise_code(query)
    scores = bm25.get_scores(tokens)
    ranked = sorted(
        zip([c.id for c in chunks], scores),
        key=lambda x: x[1],
        reverse=True,
    )
    return [chunk_id for chunk_id, score in ranked[:top_k] if score > 0]
```

`rank_bm25` is adequate for codebases up to a few hundred thousand chunks. For larger collections, an on-disk inverted index (Whoosh, Tantivy, Elasticsearch) handles the scale without changing anything in the fusion layer.

## The code graph

The code graph stores symbols as nodes and relationships as typed edges: `CALLS`, `IMPLEMENTS`, `EXTENDS`, `USES`. It is built from the same symbol extraction that produced the chunks in the previous article.

Querying it for a structural question is a depth-limited traversal from a seed node:

```python
def graph_search(
    seed_fqn: str,
    edge_types: list[str],
    direction: str = "incoming",
    depth: int = 2,
    top_k: int = 50,
) -> list[str]:
    visited: set[str] = set()
    frontier = {seed_fqn}
    results: list[str] = []

    for _ in range(depth):
        next_frontier: set[str] = set()
        for node in frontier:
            neighbours = graph.neighbours(
                node, edge_types=edge_types, direction=direction
            )
            for neighbour in neighbours:
                if neighbour not in visited:
                    visited.add(neighbour)
                    results.append(neighbour)
                    next_frontier.add(neighbour)
        frontier = next_frontier
        if len(results) >= top_k:
            break

    return results[:top_k]
```

A query for "what calls `validateSession`?" runs `graph_search("com.example.auth.validateSession", ["CALLS"], direction="incoming", depth=1)` and returns the complete set of direct callers. Depth 2 returns callers-of-callers. The graph does not rank these — the fusion step handles ordering.

The graph's answer is exact within the statically resolved call graph. Dynamic dispatch, reflection, and configuration-driven routing are outside what static analysis can see. For codebases that rely heavily on those patterns, the graph undercounts callers and keyword search on the method name provides a useful complement.

## Reciprocal rank fusion

Three ranked lists arrive, scored on incompatible scales. Embedding similarity scores cluster between 0.4 and 0.9. BM25 scores spike or fall to zero with no upper bound. The graph produces an unordered set with no scores at all. Adding them up with weights does not work — whichever lane has the densest score cluster at the top will dominate regardless of the weights.

Reciprocal rank fusion (RRF) ignores raw scores entirely. The fused score for a document `d` across a set of rankings is:

```
RRF(d) = Σ  1 / (k + rank_r(d))
```

where `rank_r(d)` is the position of `d` in ranking `r`, and `k` is a constant (default 60). If `d` does not appear in a ranking, that ranking contributes 0 to its sum.

A concrete example with three lanes and `k=60`:

```
Graph:     [A, B, C, D]
Embedding: [B, A, E, F]
Keyword:   [A, G, B, H]
```

Document `A` is at rank 1 in Graph, rank 2 in Embedding, rank 1 in Keyword:

```
RRF(A) = 1/(60+1) + 1/(60+2) + 1/(60+1) ≈ 0.0489
```

Document `B` is at rank 2, 1, 3:

```
RRF(B) = 1/(60+2) + 1/(60+1) + 1/(60+3) ≈ 0.0484
```

Document `G` appears only in Keyword at rank 2:

```
RRF(G) = 1/(60+2) ≈ 0.0161
```

`A` and `B` rise to the top because they appear across multiple lanes. `G` is buried despite ranking well in its single lane. Agreement across lanes is a stronger signal than dominance within one.

The properties that make RRF practical:

- No score normalisation needed — rank position is the only input
- A lane that is absent for a given document contributes 0, not a penalty
- One tunable parameter (`k`), and the default of 60 works well across applications
- Deterministic with a stable tie-break

```python
from collections import defaultdict

def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
    top_k: int = 50,
) -> list[tuple[str, float]]:
    fused_scores: dict[str, float] = defaultdict(float)
    first_seen: dict[str, int] = {}
    counter = 0

    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            fused_scores[doc_id] += 1.0 / (k + rank)
            if doc_id not in first_seen:
                first_seen[doc_id] = counter
                counter += 1

    return sorted(
        fused_scores.items(),
        key=lambda kv: (-kv[1], first_seen[kv[0]]),
    )[:top_k]
```

The `first_seen` map gives a deterministic tie-break: documents with identical fused scores are ordered by when they first appeared across the input rankings. Without this, the sort order depends on dict iteration order, which is an insertion-order detail you should not rely on.

## Putting it together

The three lanes are independent and run concurrently. Each gets a per-lane timeout so a slow embedding service or a graph blip does not block the whole query.

```python
import asyncio
import logging

log = logging.getLogger(__name__)
PER_LANE_TIMEOUT = 3.0

async def _safe(name: str, coro):
    try:
        return name, await asyncio.wait_for(coro, timeout=PER_LANE_TIMEOUT)
    except asyncio.TimeoutError:
        log.warning("lane %s timed out", name)
        return name, []
    except Exception:
        log.exception("lane %s failed", name)
        return name, []

async def hybrid_search(
    question: str,
    use_graph: bool = False,
    graph_seed: str | None = None,
    use_embedding: bool = True,
    use_keyword: bool = True,
) -> list[str]:
    tasks = []
    if use_embedding:
        tasks.append(_safe("embedding", embedding_search(question, top_k=50)))
    if use_keyword:
        tasks.append(_safe("keyword", keyword_search(question, top_k=50)))
    if use_graph and graph_seed:
        tasks.append(_safe("graph", graph_search(graph_seed, ["CALLS"], top_k=50)))

    results = dict(await asyncio.gather(*tasks))
    rankings = [ids for ids in results.values() if ids]
    return [doc_id for doc_id, _ in reciprocal_rank_fusion(rankings)]
```

The graph lane needs a seed node — a starting symbol to traverse from. The seed comes either from the question directly (the user named a symbol), from a planner that parsed an identifier out of the question text, or from the top result of a keyword pre-pass when the question described a symbol without naming it.

## Which lanes to run

Not every question benefits from all three lanes. Running all three when only one is relevant adds latency and dilutes the fused result.

The decision is short. If the question contains an explicit identifier (backtick-quoted or recognisably formatted), run keyword and graph — embedding returns a vague superset and is not worth the latency. If the question is structural ("what calls", "what implements", "what changes if"), run the graph from the named seed; add keyword when dynamic dispatch could produce callers the graph cannot see. If the question is conceptual — describing behaviour in natural language with no specific identifier — run embedding, plus keyword if the question contains domain vocabulary that maps to identifiers. For everything that mixes these shapes, run all three.

On a measured evaluation set, RRF fusion beats the best single lane by a small margin on pure-mode questions and a large margin on mixed-mode questions — which are more common than they look because real users phrase questions informally.

---

*This is the third article in the [Reliable by Design](/tags/#Reliable by Design) series. The previous article covered [symbol-granular chunking](/symbol-granular-chunking-for-code-retrieval). The next covers incremental graph updates: keeping the graph and indexes correct as the codebase changes, without rebuilding from scratch on every commit.*
