---
title: "On agent swarms"
date: "2026-08-17"
description: "The bottleneck is decisions per hour. Scaling past one human per agent means agents supervising agents, and a control surface built for machine operators."
slug: "on-agent-swarms"
tags:
  - agents
  - infrastructure
draft: false
decor:
  seed: "on-agent-swarms"
  canvas: boids
  color: cyan
---

A single agent run generates roughly 40 decision points an hour. Ten concurrent runs generate 400, and our teams are already past a hundred concurrent runs on a normal workday, which means the system asks for thousands of judgment calls per hour while a person can supply maybe five or six.

Most of those decisions are small, things like which file to read next, whether to retry a failed tool call, when to abandon one approach and try another. Any person on the team could answer them, but only if they happen to be paying attention at the exact moment the question comes up. The bottleneck is entirely about scheduling, and humans don't schedule down to the second.

So the decision-maker has to be an agent too. A supervisor agent reads the state of ten running agents, kills the ones stuck in loops, reassigns work from a failed branch to a fresh one, and answers the "should I retry or bail" questions that would otherwise sit in a queue until a person notices. Humans still set the goal, set the budget, and handle the irreversible calls, but everything below that threshold runs without waiting for us.

What we have for that job today is roughly an abacus. It works, and you can follow every bead, the run logs, retry loops, a dashboard with a few graphs, a person deciding when to intervene. All of it assumes a human reading at human pace, so it caps out at the number of agents one attentive operator can hold in their head.

The next version of this looks more like a PC, a general control surface where the operator is itself a program, where one supervisor can run other supervisors, and where you add agents without adding people to watch them.

Getting there means redoing most of software. The control surface has to be built for machine operators, with permissions, budgets, audit trails, and interrupts as first-class primitives that another agent can call. Underneath that sits infrastructure for running fleets, covering scheduling, isolation, durable state, and observability that agents can read programmatically, and very little of the current stack was designed with any of that in mind.

Compute stays scarce through all of it, because every improvement in decision throughput turns into more agents running longer, and teams keep adding runs until whatever capacity arrives is used up. Build the control layer assuming compute is the constraint, and assume the interesting work is deciding where it goes.

The team that figures this out first will run a thousand agents with five people, and from the outside it will look like a company ten times its size.
