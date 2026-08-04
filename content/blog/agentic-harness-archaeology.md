---
title: "Agentic Harness Archaeology"
date: "2026-08-04"
description: "Most of an agentic harness is fossilized workaround — dating the layers of RAG, tool-call parsers, DAG runners, and giant instruction files, and deciding what deserves to survive."
slug: "agentic-harness-archaeology"
tags:
  - llms
  - agents
draft: false
decor:
  seed: "agentic-harness-archaeology"
---

## Dating the layers

Most of what we call an agentic harness is a fossil. It is the shape a workaround took when an older model could not do something. The workaround hardened into architecture, got a name, and kept being defended long after the model learned the trick on its own.

You can date a harness the way you date rock layers. Show me a codebase with a vector store, a ReAct parser, a DAG runner, and a 4,000-line instruction file and I can tell you which quarter it was designed in.

The uncomfortable part is that none of these were mistakes. Each one was the right engineering answer to a real weakness in the model. The mistake is keeping them after the weakness is gone. A workaround that no longer works around anything is just a wall between the model and the task.

## Small context: from RAG to agentic search

When the window was 4k or 8k tokens, you physically could not put all your documents in the prompt. So we built retrieval: split the documents into chunks, embed the chunks, embed the question, take the top few matches, and hope the chunk boundaries did not cut the answer in half. Then reranking, since the top matches were noisy. Hybrid search came next, to catch the exact strings embeddings missed. Then query rewriting, because the user's wording was not the document's wording. A pipeline of patches, each one patching the previous patch.

Every one of those layers was a guess made on the model's behalf. The retriever decided what was relevant before the one thing capable of judging relevance ever saw the documents.

Now the model greps. It lists the directory, reads a file, notices a reference, reads that file, and stops when it has enough. That is not a smarter retriever, it is the retriever removed and the decision handed back to the thing that can actually make it. In our own workspace the tool that answers the most questions is ripgrep.

RAG did not die, it narrowed. If you have ten million documents and answers must come back in milliseconds, you still need an index. What died is RAG as the default answer to the question "how does the agent know things."

## Poor tool calling: from custom formats to native calls

We used to write parsers. `Action: search[query]` on its own line. XML tags, which the model closed more reliably than JSON braces. Regex to catch the model writing "Action:" with a lowercase a. Retry prompts that said "you MUST respond only with valid JSON" in capitals, which worked about as well as capitals usually work.

The instruction files from that era are mostly apologies for the format. Half the words exist to prevent a parse error rather than to describe the job.

Tool calling is now trained in. Millions of rewarded examples taught the model to produce a structured call, and your prompt threatening it had nothing to do with that. Parsing is the runtime's problem and mostly a solved one.

What survives is not the parser but the interface design. Tool names, argument shapes, error messages, and how much a single call gets done still decide whether an agent works. A tool that returns a 4,000-line error dump teaches the model nothing. A tool that returns "file not found, did you mean X" teaches it in one turn. That is API design, and it does not go out of date.

## Poor orchestration: from pipelines to native delegation

When models could not hold a plan for twenty steps, we held the plan for them. Chains. Graphs. State machines with hand-drawn transitions. Frameworks whose core building block was a node, because the model was too unreliable to be trusted with the flow of the work, so the flow moved into Python where we could see it.

The honest version of a 2023 agent framework is a workflow engine with an LLM in one of the boxes.

Training then taught the models to plan, break work down, hand pieces off, and pull the results back together. A single prompt now does what a hand-built graph used to do, worse in the graph's best case and far better in every case the graph's author did not think of.

We benchmarked this. An orchestrator pattern, a strong model planning and cheap models executing, scored 37 of 44 tasks at $1.33 each against a single-model baseline of 34 of 44 at $1.58. Rough numbers at best, the test suite was too small and too easy, but the direction was clear: handing work off helps where quality depends on the initial plan and hurts where the work needs one mind holding all the context.

What is worth keeping is not the graph, it is the boundaries. Safe-to-retry operations, approval gates, budget limits, and audit trails are not patches for model weakness. They are things you want even from a perfect employee.

## Poor instruction following: from instruction files to a little ambiguity

The instruction file grew for the same reason a legal contract grows: every past failure became a clause. A rule the model ignored once got bold. It ignored the bold, so the rule got a section. It got a section, then all caps, then "CRITICAL: NEVER", then a nested subsection contradicting a rule 900 lines above it.

Nobody wrote that file. It piled up.

Spelling everything out has a real cost that only shows up with capable models. Every rule you write is a possibility you remove. Ten if-then branches for one situation stop the model from noticing that the situation is actually the eleventh case. The instruction file becomes a ceiling.

Steering that works now looks more like a brief to a competent new hire. Here is the goal, here is what good looks like, here are the two constraints that are genuinely non-negotiable, here is who to ask. Leave the middle open. The model fills it with judgment, and judgment is the thing you are paying for.

This is the hardest one to give up, because a long instruction file feels like control. It is readable, diffable, reviewable. Leaving things open feels like carelessness right up until you measure it.

## What this implies for what you build now

The practical question for anything you add to a harness: which model weakness does this make up for, and what happens to it when that weakness disappears in the next release. If you cannot name the weakness, you are probably building architecture for its own sake. If you can name it, you have just written the rule for when to delete it, which is worth more than the component itself.

Some things do not make up for any weakness at all, and those are the ones with a future. Permissions. Cost tracking. Visibility into what the agent is doing. Evals. Data plumbing to the systems the model cannot reach. Interfaces that report failure usefully. None of that gets absorbed by a better model, because none of it is about the model being weak.

The bitter lesson has a boring follow-on for harness engineering. Whatever scaffolding you are proudest of is the scaffolding most likely to be deleted, because the cleverness in it exists to route around something that will not stay broken for long. Build so that deletion is cheap.
