---
layout: post
title: "Symbol-granular chunking for code retrieval"
description: "Why character-count chunking breaks on source code, and how symbol-granular extraction with tree-sitter and late chunking fix code retrieval."
tags: [ LLM, AI, Python, Reliable by Design ]
featured_image_thumbnail: assets/images/posts/misc/code-chunking_thumbnail.jpg
featured_image: assets/images/posts/misc/code-chunking.jpg
featured_image_width: 1024
featured_image_height: 980
image: /assets/images/posts/misc/code-chunking.jpg
featured: false
series: "Reliable by Design"
series_index: 2
toc: true
---

Most RAG tutorials show you how to chunk documents: split on character count, add overlap, embed each chunk, store. For prose — docs, wikis, READMEs — this produces a working system. For source code it produces a system that looks like it works and retrieves the wrong thing regularly. This article covers why, what the right boundary is, and how to implement it using tree-sitter.

<!--more-->

## Why character-count chunking fails on code

The assumption behind fixed-size chunking is that any 1000-character window contains a roughly self-contained semantic unit. For prose that holds often enough. Code does not work this way.

A 1000-character window might contain half a method — a signature and the first 15 lines of a 30-line body. Or three short methods in their entirety, none of them dominant in the embedding. Or a method body with no signature, because the window started right after `def`.

Each of these produces a bad embedding. A chunk containing half a method body embeds as something between what the method does and what the surrounding code does. A chunk containing three unrelated short methods embeds as a blend of all three, and a query matching any one of them retrieves the other two at the same rank.

The failure is not loud. The system returns results, roughly in the right neighbourhood. The problem is that the correct result sits at rank 4 or rank 7 instead of rank 1, and across thousands of queries that is a meaningful drag.

Fixed-size overlap makes this worse. Overlap means the same method body appears as the tail of one chunk and the head of the next. A query that matches the method returns both in the top results. The user gets two copies of the same code in slots 1 and 2.

## The unit that matters in code

The natural semantic unit in source code is the symbol: a function, a method, a class. Each has a fully qualified name that identifies it, a signature that describes its interface, and a body that implements its behaviour.

Chunking at symbol granularity means one chunk per symbol, with boundaries at the symbol's actual start and end lines. Each retrieved chunk is a complete method or class. The embedding represents what that symbol does, not what an arbitrary window around it contains.

Deduplication also becomes trivial: the same symbol is always one chunk, not three overlapping copies.

## Extracting symbols with tree-sitter

The cleanest way to find symbol boundaries is to parse the source and query the AST. Regex-based extraction misses method calls whose receiver is not a simple identifier, drops constructor invocations, and breaks on generated files with non-standard formatting. A real parser handles all of these.

[tree-sitter](https://tree-sitter.github.io/) is the practical choice: fast (tens of megabytes per second per core), error-tolerant (it recovers from syntax errors rather than stopping), and covering over 200 languages through separate grammar packages loaded at runtime. Adding a language is `pip install tree-sitter-rust`, not a fork.

```python
from tree_sitter import Language, Parser, Query, QueryCursor
import tree_sitter_python as tspython

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)
```

The query language lets you describe patterns as S-expressions rather than writing imperative tree-walking code:

```python
function_query = Query(PY_LANGUAGE, """
(function_definition
  name: (identifier) @function.name
  parameters: (parameters) @function.params
) @function
""")

class_method_query = Query(PY_LANGUAGE, """
(class_definition
  name: (identifier) @class.name
  body: (block
    (function_definition
      name: (identifier) @method.name
      parameters: (parameters) @method.params
    ) @method)
) @class
""")
```

Running a query against a parsed file returns the matching nodes with their line positions:

```python
source = open("payment_service.py", "rb").read()
tree = parser.parse(source)

cursor = QueryCursor(function_query)
matches = cursor.captures(tree.root_node)

for capture_name, nodes in matches.items():
    for node in nodes:
        if capture_name == "function":
            print(node.start_point, node.end_point)
```

The same pattern works across languages. TypeScript, Go, Scala, Java — each has its own grammar package and its own set of queries, but the output structure is identical. Everything downstream stays the same regardless of which language the source is in.

One operational note: tree-sitter's Python bindings have shifted across versions. Pre-0.25, queries were constructed via `Language.query()` and called directly. From 0.25 onward, query execution is owned by `QueryCursor`. Pin the version in your `pyproject.toml` and run an extraction test against a known-good corpus on every upgrade. A binding change that silently drops a query type is harder to catch than a test failure.

## Building the chunk

A symbol extracted from the AST gives you a line range. The chunk text is the source at that range, with a short header prepended:

```python
def chunk_for_symbol(symbol, source_lines):
    body = "\n".join(source_lines[symbol.start_line:symbol.end_line + 1])
    header = f"# {symbol.kind} {symbol.fqn}\n"
    if symbol.enclosing_class:
        header += f"# in class {symbol.enclosing_class.fqn}\n"
    return Chunk(
        id=symbol.fqn,
        text=header + body,
        payload={
            "fqn": symbol.fqn,
            "kind": symbol.kind,
            "file": symbol.file,
            "line_range": [symbol.start_line, symbol.end_line],
            "language": symbol.language,
        },
    )
```

The header matters more than it looks. A short method body — three lines of arithmetic, a guard check, a return — carries almost no meaning in isolation. The embedding model has no idea what it is looking at. The header adds the fully qualified name and enclosing class, which is usually enough to disambiguate. `PaymentService.refund` and `RefundCalculator.apply` can have similar bodies; with the header, their embeddings differ.

The `id` is the symbol's fully qualified name, not a random UUID. A stable ID means that when a method changes and gets re-indexed, the new vector overwrites the old one at the same position in the vector store. With unstable IDs, re-indexing appends a new row and the old vector keeps ranking against queries until a separate cleanup pass removes it.

For classes, a separate chunk captures the class's overall structure rather than any single method:

```python
def chunk_for_class(symbol, source_lines):
    header = f"# class {symbol.fqn}\n"
    if symbol.docstring:
        header += f"# {symbol.docstring.strip()[:200]}\n"
    signature = source_lines[symbol.start_line]
    method_summary = "\n".join(
        f"  {m.kind} {m.name}{m.signature}"
        for m in symbol.methods
    )
    return Chunk(
        id=f"{symbol.fqn}::class",
        text=f"{header}{signature}\n{method_summary}",
        payload={...},
    )
```

Queries about a class's overall role retrieve the class-level chunk. Queries about a specific method retrieve the method-level chunk. The reranker decides which is more relevant for a given query.

## Handling same-name symbols

The header-prefix approach has one failure mode: two methods named `validate` in different classes can still embed close together if their bodies are structurally similar. Both are guard checks that raise on bad input and return early. The header adds the class name, which helps, but when bodies are short the body still dominates.

The more complete fix is late chunking. Instead of encoding each chunk independently, encode the whole file in one pass and derive per-symbol vectors by pooling the token-level outputs that correspond to each symbol's line range:

```python
import torch

def late_chunked_vectors(model, file_text, chunk_token_ranges):
    tokenizer = model.tokenizer
    transformer = model[0].auto_model
    transformer.eval()

    encoded = tokenizer(
        file_text,
        return_tensors="pt",
        truncation=True,
        max_length=transformer.config.max_position_embeddings,
    )
    with torch.no_grad():
        token_embeddings = transformer(**encoded).last_hidden_state[0]

    chunk_vectors = []
    for start_tok, end_tok in chunk_token_ranges:
        pooled = token_embeddings[start_tok:end_tok].mean(dim=0)
        chunk_vectors.append(
            torch.nn.functional.normalize(pooled, dim=0).numpy()
        )
    return chunk_vectors
```

When the full file passes through the encoder as one sequence, each token's output already incorporates context from the imports, the class signature, and the surrounding methods. The vector for `LoginService.validate` is built from encodings that have attended across login-flavoured context. The vector for `PaymentRequest.validate` has attended across payment-flavoured context. They end up far apart in embedding space.

The cost is indexing time. Encoding a full 800-token file is two to three times slower than encoding the chunk bodies independently. For batch indexing of a large codebase, that is hours of additional time. For incremental indexing on file changes it is negligible, since only the changed file is re-encoded.

Late chunking pays for itself when symbol names are reused across different contexts — `validate`, `process`, `handle`. When symbol names are already specific, the header-prefix approach is sufficient and simpler.

## One thing to check before you ship

Embedding models for code are often asymmetric: stored chunks and incoming queries use different prefixes. Nomic Embed, for example, expects `search_document:` on stored chunks and `search_query:` on queries. Using the wrong prefix on either side shifts the embedding geometry and drops retrieval quality by several points with no obvious error.

Check the model's documentation, and bake the correct prefix into both the chunker and the query path:

```python
def embed_chunk(model, text):
    return model.encode(f"search_document: {text}")

def embed_query(model, query):
    return model.encode(f"search_query: {query}")
```

It is the smallest fix in this article and it affects every retrieval result.

---

*This is the second article in the [Reliable by Design](/tags/#Reliable by Design) series. The next article covers graph-augmented retrieval: building a code graph from the extracted symbols and combining it with embedding search and keyword search through reciprocal rank fusion.*
