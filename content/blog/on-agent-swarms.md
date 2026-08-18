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

The limit we keep hitting is how many decisions per hour a system can actually make. Every agent run we build stalls at the same kind of step, the one that needs a judgment call, with a human somewhere who has to supply it.

One agent with one person watching it is fine. A hundred agents running in parallel need a hundred of those judgment calls at the same time, and that's what our workload looks like now. One person can service a handful of those calls an hour, and a fleet asks for far more than that at once. Waiting on a person for each decision already looks impossible, so we have to scale decision throughput drastically.

The way out is agents controlling other agents. A supervising agent watches its fleet, reads state, kills bad branches, reallocates work, and answers the questions that would otherwise queue in someone's inbox. Humans stay in the picture for direction, budget, and the expensive or irreversible calls, but we come off the critical path of every small choice, because we can't keep up with that many runs.

What we have for that job today is roughly an abacus. It works, and you can follow every bead: run logs, retry loops, a dashboard with a few graphs, a person deciding when to intervene. All of it assumes a human reading at human pace, so it caps out at the number of agents one attentive operator can hold in their head.

What we need is something closer to a PC, a general control surface where the operator is itself a program, where one supervisor can run other supervisors, and where you add agents without adding people to watch them.

Getting there means redoing most of software. The control surface has to be built for machine operators, with permissions, budgets, audit trails, and interrupts as first-class primitives that another agent can call. Underneath that sits infrastructure for running fleets, covering scheduling, isolation, state that survives restarts, and observability an agent can query on demand. Very little of the current stack was designed with those assumptions.

Compute stays scarce through all of it. Every improvement in decision throughput turns into more agents running longer, and teams keep adding runs until whatever capacity arrives is used up. Build the control layer assuming compute is the constraint, and assume the interesting work is deciding where it goes.
