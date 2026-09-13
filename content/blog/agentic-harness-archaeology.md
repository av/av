---
title: "Agentic Harness Archaeology"
date: "2026-08-04"
description: "Agent harnesses preserve workarounds for older models. A look through RAG, tool-call parsers, workflow graphs, and sprawling instructions to decide what still earns its place."
slug: "agentic-harness-archaeology"
tags:
  - llms
  - agents
draft: false
decor:
  seed: "agentic-harness-archaeology"
---

## Dating the layers

Much of an agentic harness preserves the limitations of an earlier model. Its components began as ways to get around something that model could not do. Over time, each workaround became an architectural choice with a name and defenders, even after the model could handle the task itself.

A harness has layers that reveal its age. A vector store, a ReAct parser, a DAG runner, and 4,000 lines of instructions can place a codebase's design within a particular quarter.

The awkward part is that these choices made sense at the time. Each addressed a limitation the model actually had. Keeping them becomes a mistake once that limitation disappears. Without its original purpose, a workaround simply gets in the model's way.

## Small context: from RAG to agentic search

With context windows of 4k or 8k tokens, an entire document collection could not fit in the prompt. Retrieval gave us a way around that: divide documents into chunks, embed them and the question, select the closest matches, and hope the answer survived the split. Noisy matches led us to add reranking. Hybrid search followed to recover exact strings that embeddings overlooked. Query rewriting addressed the gap between how users asked questions and how documents phrased the answers. Each addition compensated for a weakness in the preceding step.

At every stage, another component guessed what the model would need. The retriever selected the relevant material before the model had a chance to judge the documents for itself.

Now the model can search with grep. It inspects a directory, opens a file, follows a reference to another, and stops once it has what it needs. The model takes over the decision about what to retrieve, replacing a separate selection layer. In our workspace, ripgrep answers more questions than any other tool.

RAG still has a place, though its role is more specific. Searching ten million documents in milliseconds still calls for an index. It no longer needs to be the automatic answer to how an agent finds information.

## Poor tool calling: from custom formats to native calls

We once had to build parsers for the model's output. A call might be a line containing `Action: search[query]`. We tried XML because models were better at closing its tags than balancing JSON braces. We added regular expressions for cases where the model wrote "action:" in lowercase. On failure, we retried with prompts demanding "you MUST respond only with valid JSON," with the limited success you would expect from capital letters.

Instruction files from that period spend much of their space accommodating the format. As much as half the text is devoted to avoiding parse errors, leaving the actual job in the remaining space.

Models now learn tool calling during training. Millions of rewarded examples taught them to emit structured calls; threats in a prompt contributed nothing to that training. The runtime handles parsing, which is now largely a solved problem.

The lasting work is designing the interface. An agent's effectiveness still depends on tool names, argument structures, useful errors, and how much work one call accomplishes. A 4,000-line error dump gives the model little guidance. "File not found, did you mean X" can tell it how to recover immediately. Those are enduring questions of API design.

## Poor orchestration: from pipelines to native delegation

When a model could not follow a plan for twenty steps, we kept track of the plan in code. We built chains of operations. We connected them into graphs. We specified transitions in state machines by hand. Frameworks organized everything around nodes, putting control flow in visible Python code because the model could not reliably manage it.

An accurate description of a 2023 agent framework is a workflow engine with an LLM assigned to one step.

Later training taught models to plan, divide tasks, delegate pieces, and combine the results. One prompt can now cover the work of a manually assembled graph, falling short where the graph is strongest but handling unforeseen cases far better.

We tested that tradeoff. Using a strong model to plan and cheaper models to execute solved 37 of 44 tasks at $1.33 per task, compared with 34 of 44 at $1.58 for a single model. The small, easy test suite makes these rough results, but they suggested a useful distinction: delegation helps when the initial plan determines quality and hurts when success requires keeping all the context together.

The boundaries remain worth keeping as the graphs become less necessary. Operations that can safely be retried, required approvals, spending limits, and audit records serve purposes independent of model capability. Even a perfect employee would need to work within them.

## Poor instruction following: from instruction files to a little ambiguity

Instruction files grew like legal contracts, adding a clause for every previous failure. An ignored rule acquired bold formatting. When that failed, it acquired a section of its own. The section gained capitals, then "CRITICAL: NEVER," and eventually a subsection that contradicted a rule 900 lines earlier.

The file had no single authorial design. It accumulated one correction at a time.

As models become more capable, the cost of specifying every detail becomes easier to see. Each rule rules out an option. Ten explicit branches can prevent the model from recognizing a situation that fits none of them. The instructions start to limit what the model can achieve.

Effective guidance increasingly resembles a brief for a capable new colleague. State the goal, describe a good result, name the two firm constraints, and say where to take questions. Allow room to choose the approach. That gives the model space to exercise the judgment you are paying it to provide.

Long instruction files are especially hard to relinquish because they make control tangible. You can read them, compare revisions, and review each change. Allowing discretion can feel careless until you measure the results.

## What this implies for what you build now

Before adding a component to a harness, identify the model limitation it addresses and what you will do if the next release removes that limitation. If you cannot identify one, the architecture may be serving no useful purpose. If you can, you also have a condition for deleting the component, which may be more valuable than the component itself.

The most durable components serve needs that remain as models improve. They control permissions. They account for spending. They make agent activity visible. They evaluate performance. They connect the model to otherwise inaccessible data and systems. They explain failures in ways that help recovery. A stronger model does not replace these functions because their purpose does not depend on its limitations.

The bitter lesson has a mundane consequence for harness design. Your cleverest scaffolding may be the first to become obsolete, since so much of that cleverness goes into overcoming limitations that training will eventually remove. Make it inexpensive to delete.
