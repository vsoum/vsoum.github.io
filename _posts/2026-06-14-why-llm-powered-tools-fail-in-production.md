---
layout: post
title: "Why LLM-powered tools fail in production"
description: "LLM-powered developer tools work well in demos and break in production. The cause is not model quality—it is what the model receives: missing context, unstructured orchestration, and no mechanism for verification."
tags: [ LLM, AI, Software Engineering, Reliable by Design ]
featured_image_thumbnail: assets/images/posts/misc/llm-tools_thumbnail.jpg
featured_image: assets/images/posts/misc/llm-tools.jpg
featured: true
series: "Reliable by Design"
series_index: 1
toc: true
---

LLM-powered developer tools work in demos. They summarize a file, answer a question about a class, explain a function. Then they hit a real codebase — large, cross-repository, underdocumented — and the answers become wrong in ways that are hard to detect. This article explains why that happens and what a system that avoids it looks like.

<!--more-->

## The demo gap

A demo codebase fits in a context window. Production codebases don't.

When an LLM receives the full relevant context for a question, it can answer correctly. When it receives a few retrieved chunks instead, it can only answer correctly if the retrieval step found the right ones. Most of the time it didn't.

The structure problem is separate. Production codebases have methods that call other methods across packages, repositories, and generated code. The relationships between symbols aren't visible from any single file. And the same name — `validate`, `process`, `handle` — might be defined in seventeen different packages. A retrieval step that returns "the most relevant code for validate" has no way to know which one the question is about.

The gap isn't about model quality. It's about what the model is given to work with.

## Retrieval is the first failure mode

The standard architecture is retrieval-augmented generation: embed the codebase, embed the query, find the nearest neighbours, pass them to the model. This works for questions about what code *looks like*. It breaks for questions about what code *does*.

Similarity search finds files that mention the same terms, functions with similar names, comments that overlap with the question. What it can't answer is: *what calls this method?* That answer is a traversal through a call graph, not a ranking by embedding distance.

A codebase that handles authentication has the complete answer to "what calls `validateToken`" in its call graph. No similarity engine extracts it from chunks. Building a code graph — symbols as nodes, calls and imports and inheritance as edges — is the only way to answer that class of question.

Without it, you get the definition of `validateToken`, the comments around it, the tests that call it. The twelve call sites spread across services? Not there.

## Orchestration is the second failure mode

The typical approach to a complex question: gather everything that might be relevant, concatenate it, send it to the model, hope the context window holds.

It usually doesn't. A question about a cross-service change needs multiple files, the relevant graph edges, test coverage data, schema definitions. That exceeds what a single call handles well, and the model starts losing coherence on earlier parts of the context by the time it works through the later ones.

What makes this worse is that not everything relevant is known upfront. Answering "is this change safe?" requires knowing what the change affects, which requires a graph traversal, which requires knowing the starting symbol, which may require a search step first. These are sequential dependencies. Stuffing them into a single prompt treats them as if they aren't.

A better design separates planning, execution, and synthesis. A planner inspects the question and emits a structured list of tool calls — graph queries, searches, file reads — with their dependencies explicit. A dispatcher runs those calls, in parallel where it can, in sequence where it must. A synthesizer sees the results and produces the answer. The model handles planning and synthesis; execution is deterministic tool invocation.

## Verification is the third failure mode

Even with good retrieval and structured orchestration, the model will still produce wrong answers. Not constantly, but often enough that you need a plan for it. The failure mode is confident incorrectness: a fluent, specific answer that is wrong in ways that don't read as wrong. The model's confidence is not a signal here — it's equally confident about correct and incorrect answers.

Verification needs to be cheap enough to run on every response, because you don't know in advance which ones are wrong. A two-stage approach works: a fast structural check first — does the answer reference symbols that actually exist, does it contradict the retrieved context — and a deeper per-claim pass only on responses the first stage flags.

The retrieval infrastructure is already there. An answer that claims method A calls method B can be checked against the call graph. An answer about test coverage can be checked against the coverage index. Verification is a structured comparison against facts the system already has.

## What comes next

The next articles cover each of these layers with concrete implementations:

- Symbol-granular chunking: splitting source code for retrieval without losing the structural unit the question is about
- Graph-augmented retrieval: building the code graph and combining it with embeddings and keyword search through reciprocal rank fusion
- Incremental graph updates: keeping the graph correct as the codebase changes, without rebuilding from scratch on every commit
- Deterministic review rules: catching known-bad patterns before the LLM sees the code, with suppression rate tracking to detect rule decay
- The plan/dispatch/synthesize pattern in detail
- A two-stage verification cascade
- Cost attribution by role: tracking which part of the system is responsible for API spend

Each article is self-contained. Read them in order for the full architecture, or jump to whichever component you're building.
