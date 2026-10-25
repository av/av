---
title: "Your diffs are your weights"
date: "2026-10-25"
description: "The signal in agent work is what you reject, edit and revert. Someone is already learning from that record, so keep a copy of your own."
slug: "personal-trace-intelligence"
tags:
  - agents
  - privacy
draft: true
decor:
  seed: "personal-trace-intelligence"
  canvas: asking
  color: green
---


The first thing you ask an agent is mostly noise. "Add retries to the upload client" says very little about you; any engineer would type something close to it. The signal arrives twenty minutes later, when you reject the patch because it retries on a 400, rewrite its backoff loop by hand, revert the config change it slipped in on the side, and stop the run once it starts editing tests until they pass.

Those corrections are a record of your taste. The prompt is what you asked for, the final diff is what you actually wanted, and the distance between them is the most valuable data your work produces. If anything is training on your judgment, it is training on that distance.

Something already is.

Cursor's Tab model [learns from whether people accept its suggestions](https://cursor.com/blog/tab-rl). In the example reward from their write-up, an accepted suggestion scores 0.75 and a rejected one -0.25, and the model runs on more than 400 million requests a day. After that training it showed 21% fewer suggestions and got a 28% higher accept rate. Every rejection that went into it improved Cursor's model. The person who did the rejecting got a slightly better autocomplete and kept nothing.

That is the default arrangement for everyone who steers agents. You fix a mistake, the thread closes, and the model forgets you were there. Fix the same mistake a third time without turning it into a rule, a test or a script, and you are working as a biological retry loop for a stateless system, unpaid.

I run agents across several machines most days, and the habit that paid off was treating every repeated correction as a defect in my setup. A note in my home directory tells any agent that the obvious Hermes config file is the wrong one, because the container reads a different path. The brief my agents get tells them never to hand me a command they could run themselves. Nobody writes lines like that in advance. They are scar tissue, and each one is a correction I no longer make by hand. To find the next one I read traces in tracequest, which renders agent sessions so I can search and replay them, because scrolling through raw JSON is how corrections stay unmined.

Employers have noticed the same thing, and they have better logging. In April, Meta [told staff it would record keystrokes, clicks and mouse movements](https://techcrunch.com/2026/04/21/meta-will-record-employees-keystrokes-and-use-it-to-train-its-ai-models/) in some work applications to train agents that do everyday computer tasks, because "our models need real examples of how people actually use them." Coding agents make this kind of capture easier. Claude Code [logs an event every time a person accepts or rejects a tool call](https://code.claude.com/docs/en/monitoring-usage), and an administrator can switch telemetry on for every user through managed settings and pin the collector it reports to.

Put those together and you get a new wealth gap at work. A company that records a thousand engineers steering agents can hill-climb its workflows on their judgment until each role is replaceable. Without a trace record of your own, your employer compounds on your judgment while you walk out with zero weights.

So keep your own copy, in a form you can carry. Your resume is dead weight once anyone can spin up a fleet; your eval suite is the capital that leaves with you. Hiring a principal means hiring their harness: the failure traces they have curated, the gates they refuse to remove, the rubrics they use to decide whether a run is finished. The interview will start to look like running it.

Building that harness is less work than it sounds. Cluster your interventions across a thousand runs and most of what you call senior intuition turns out to be a short list of vetoes. Do not retry on client errors. Do not touch the lockfile. Do not edit a test to make it pass. Do not ship a migration without a way back. I expect around fifteen of them to cover nine in ten interventions, and each compiles into a check in an afternoon. What remains once they are out of your head is the part of your judgment that is actually rare, and you finally get to see how small it is.

The same record shows you degrading. When you are tired or overloaded, your acceptance threshold drops, your prompts get vaguer, and your revert rate spikes a few days later. You will not feel the slide while it happens, but the log shows it first. A drift alarm on your own traces is one more gate in the harness, and it catches you, not just the model.

Every check you compile also moves the line between you and the system. A review you did by hand last month is a script this month, and the surface where a person is needed shrinks every week. That feels like a threat if you think of the job as reviewing. The work left over sits higher up the entropy ladder, in the decisions you still cannot formalize: which project deserves doing at all, and when a correct patch is wrong for the business.

That changes what privacy should protect. A leaked inbox tells someone what you worked on. A full trace history tells them what you would approve, ignore or veto next, and that is a training set for a copy of your judgment. Keep the traces local and mine them yourself. The thing to guard now is your decision boundary, the line where you say yes or no.
