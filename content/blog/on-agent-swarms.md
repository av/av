---
title: "On agent swarms"
date: "2026-08-17"
description: "Human attention limits how many agents a team can run. Scaling further requires agents that supervise other agents and software they can operate themselves."
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

A single agent run needs roughly 40 decisions an hour. Ten simultaneous runs need 400, and our teams already run more than a hundred at once on a typical workday, creating thousands of judgment calls each hour when a person can handle perhaps five or six.

Most of these are small choices: which file to read next, whether a failed tool call deserves another attempt, or when to try a different approach. Anyone on the team could make them, provided they were watching when the question arose. The limiting factor is timing, and people cannot arrange their attention second by second.

Those decisions need an agent of their own. A supervisor checks on ten running agents, stops those caught in loops, moves work off failed branches, and decides whether to retry or give up before the question can sit waiting for a human. People still choose the goal, allocate the budget, and authorize irreversible actions; routine work proceeds without waiting for our attention.

Today's tools for this job are about as sophisticated as an abacus. You can trace the activity through run logs, retries, and a few dashboard graphs, with a person watching for the moment to intervene. The whole arrangement depends on how quickly that person can read and how many agents they can keep track of.

The next step resembles a PC: a general-purpose system that programs can operate, where supervisors manage other supervisors and adding agents does not require hiring more people to watch them.

Getting there will require rebuilding much of our software. Agents need direct ways to manage permissions, enforce budgets, inspect audit trails, and interrupt work. The infrastructure beneath those controls must schedule and isolate whole fleets, preserve their state, and expose their activity in a form agents can query—requirements much of today's software was never designed to meet.

Compute remains scarce because faster decisions let more agents run for longer, and teams keep expanding their workloads until they consume the available capacity. Design the controls around that limit: the consequential decisions will be about where to spend the compute.

The first team to make this work will have five people running a thousand agents, with the apparent capacity of a company ten times larger.
