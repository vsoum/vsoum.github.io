---
layout: post
title: "I built a memory layer for AI coding agents. My own benchmark killed the idea."
description: "A post-mortem on Engram, a memory layer for coding agents: why resolving a fact's current value at read time beat resolving it at write time."
tags: [ LLM, AI, Software Engineering ]
featured_image_thumbnail: assets/images/posts/misc/engram-memory_thumbnail.jpg
featured_image: assets/images/posts/misc/engram-memory.jpg
featured_image_width: 1024
featured_image_height: 682
image: /assets/images/posts/misc/engram-memory.jpg
featured: false
---

*The one finding worth keeping: for facts that keep changing, working out what's true at read time beats deciding it at write time. That is the opposite of how most memory systems, mine included, are built.*

Claude Code, Cursor, and every other coding agent start each session from zero. The decision you made last week, the value a constant actually settled on after three revisions, the approach you already tried and rejected: all of it gone when the context window resets. So I built Engram, a persistent memory layer that captures durable facts from your sessions, keeps them current as they change, and resurfaces the right ones next time.

What was supposed to make it more than a wrapper around a vector database was identity maintenance. When a fact changes, when the cache TTL goes from 300 seconds to 600 to 900, the old value has to stop surfacing. Engram did this with subject-key supersession: a later fact with the same subject retired the older one at write time. The storage underneath was unremarkable. Postgres held the source of truth, Qdrant did hybrid retrieval, and a graph handled associative recall. Supersession was the part I was betting on.

I set one rule for the project: let measurement decide. Ship nothing as "it works" without a benchmark that could prove it doesn't. That rule is why this is a post-mortem and not a launch.

<!--more-->

## The benchmark kept saying "no"

The first surprise was that almost everything I added to the merge logic measured as noise. A learned alias registry, a component-partitioned identity resolver, a tuned similarity gate for the LLM judge: three plausible improvements, all built, all reverted because they made no measurable difference against the baseline. The bottleneck was never the merge rule. It was extraction, whether the system captured the update at all and gave it a stable identity.

The second surprise was that upgrading the extractor from a small model to a larger one made things worse. The bigger model followed the "reuse the subject" instruction more zealously and started merging genuinely distinct facts. "API rate limit: 100" and "DB query cap: 100" collapsed onto a single subject, which broke a hard safety constraint, never delete a true distinct fact, on every run. The small model held the line. Stronger was not safer, so I kept the small model.

Then came the question that decides whether a memory system earns its complexity.

## "Why not just retrieve from the raw transcript?"

This is the question every memory project has to answer, and most dodge it. If a good RAG pipeline over your raw session history does the job, the memory system is ceremony. So I built that baseline properly: semantic retrieval over the raw transcript chunks, the same embedder and the same token budget as my system's recall, with the only difference being no identity maintenance. Then I ran real agent sessions across three arms: no memory, Engram, and transcript-RAG. The agent edits a file, and I score the file, not the retrieval.

The result split cleanly, and it was educational:

| Scenario | no memory | Engram | transcript-RAG |
|---|---|---|---|
| **Find a buried fact** (decisive info is old, surrounded by noise) | fails | works | works, ties Engram |
| **Resolve a changed value** (300→600→900, no "this changed" cue) | fails | works | fails |

So retrieval alone solves finding old information. It does not solve determining current information. That felt like the moat. Engram's supersession resolved which value was current; retrieval just handed the model all three and let it guess.

I was ready to call it. Then I made the test realistic.

## The test that killed it

Real transcripts don't just state values cleanly. They contain historical references. Someone later says, *"back when the cache TTL was still 300 seconds, we saw more origin misses than today."* That sentence mentions 300, but it is not a claim that the TTL is currently 300. Any human knows that. The question is whether the memory system does.

I added exactly one such sentence to the "changed value" scenario, right after the 900 update. Then I built the strongest read-time baseline I could without reimplementing my own system: retrieve the chunks, present them in chronological order, and instruct the model that some of them are updates where later ones win, some are backward-looking historical references to ignore, and the task is to determine the current value.

Here is what happened, across 3 trials and then re-verified over more seedings:

| Arm | wrote the current value (900)? |
|---|---|
| no memory | 0/3 |
| **Engram (write-time supersession)** | **0/3, wrote the stale 300 every time** |
| transcript-RAG (plain) | 2/3 |
| **read-time reconstruction (strong)** | **3/3** |

Engram lost to everything, including doing nothing. I assumed a bug and went looking. There wasn't one. Inspecting the database directly told the story. The historical reference had been extracted as a fact with subject `cache ttl`, and because supersession means the latest mention of a subject wins, that backward-looking aside superseded the correct value. The current 900 was retired and its vector deleted. The "current" memory the system served was the historical aside. It reproduced 6 times out of 6 independent runs.

The read-time reconstructor, given the same information, just reasoned it through: the last genuine update was 900, the other sentence is historical, so the answer is 900. It got it right every time.

## The lesson worth keeping

The failure isn't the vector database, and you can't fix it by swapping storage. The wrong answer was already baked into the source-of-truth state before retrieval ever ran. The failure is the philosophy.

Write-time resolution, my approach, commits to what is true the moment a fact arrives, and in my implementation it destroys the alternative. That is fast and clean, but it is brittle. It has to tell an update apart from a historical reference at extraction time, with no context, and when it gets that wrong the correct value is already gone.

Read-time resolution keeps the raw history and works out what is true when asked, with the full picture and the model's reasoning available. It costs more per query, but it is robust. It gets the update-versus-reference distinction for free, out of the same reasoning the agent is already doing.

My system had to engineer that distinction into extraction, and it failed. The baseline got it for free. When your differentiating mechanism only ties the commodity approach at its best, and silently serves stale data at its worst, it is not a differentiator.

That is why I stopped. Not because memory doesn't help, it clearly does, a 100% improvement over no memory on continuity tasks, but because the one thing meant to make this system worth building turned out to be the weaker half of a fork I had not taken seriously enough.

## Caveats, stated plainly

These are small-N, synthetic scenarios: single-digit trials, hand-built cases, one embedder. I am not claiming a law of nature. I am claiming a clean, reproducible, mechanistically understood signal, strong enough to change a decision. The honest scope is this: for evolving facts in realistic, reference-laden history, read-time reconstruction beat eager write-time supersession in my tests. A write-time system that refuses to treat historical references as current assertions might claw back to a tie, but a tie with "retrieve and let the model reason" is not a reason to maintain a supersession engine.

## If I were starting over

I'd build the memory layer around read-time reconstruction: store everything, retrieve by relevance, and resolve currency at query time with an explicit step that separates updates from historical references, treating supersession as a cache or an optimization, never as the source of truth. And I'd build the benchmark first, because the most valuable thing this project produced was not the system. It was a test honest enough to kill it before I shipped the claim.
