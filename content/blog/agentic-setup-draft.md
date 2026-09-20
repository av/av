---
title: "How my agentic setup grew"
date: "2026-09-20"
description: "From one terminal on a laptop to a controller, three machines, a sandbox and agents that supervise agents. Told as one diagram that changes over time."
slug: "agentic-setup"
tags:
  - agents
  - infrastructure
draft: false
decor:
  seed: "agentic-setup"
  canvas: boids
  color: green
---

*Draft. The prose is placeholder; the diagram sequence is the real story.*

Every write-up of an agent setup shows the final picture. The final picture is the least interesting part. What matters is the order in which the pieces arrived and what each one fixed, so this post is told as one diagram that changes as the story moves. Step through it with the arrows, the dots, or the keyboard.

<div class="graph-story" data-graph="agentic-setup" data-trigger="click"></div>

## One machine, one agent

Placeholder. A laptop, a terminal, a coding agent, one repository. It works, and it works well enough that the obvious next move is to open a second terminal.

## More agents than attention

Placeholder. Four terminals and three repos. Each run wants a decision every couple of minutes, and the laptop is the only place those decisions can happen. The bottleneck is a person switching windows.

## Kandev takes the terminals

Placeholder. Kandev turns terminals into sessions on a board. Each agent gets its own worktree, tasks have state, and there is one place to look instead of four.

## The laptop becomes a controller

Placeholder. Work moves off the MacBook. A Hetzner box for long builds, a Fedora workstation with a GPU, and a sandbox that gets wiped nightly, all reachable over Tailscale, each running Kandev.

## Agents move to where the compute is

Placeholder. Sessions spawn next to the hardware they need. Untrusted work lands in the sandbox by default.

## Skills sync

Placeholder. Skills are a git repo synced to every machine on a schedule, so a skill written on the laptop shows up in every agent's harness within a minute.

## Agents supervise agents

Placeholder. A supervisor session per machine watches the others, retries stuck ones and reports upward, so the human reads summaries rather than logs.

The same story again, driven by scrolling instead of clicking:

<div class="graph-story" data-graph="agentic-setup" data-trigger="scroll"></div>
