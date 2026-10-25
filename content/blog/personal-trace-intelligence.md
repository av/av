---
title: "Your diffs are your weights"
date: "2026-10-25"
description: "What you ask an agent first is mostly noise. Your judgment lives in what you reject, rewrite, and revert, and someone is already training on that record."
slug: "personal-trace-intelligence"
tags:
  - agents
  - privacy
draft: true
decor:
  seed: "personal-trace-intelligence"
  canvas: diff
---

Every time you fix an agent's bad diff, you are training your replacement for free. Not with the code you ship, and not with the prompt you typed to start the session. You train it with the ten minutes of cuts you make right before you merge, while your vendor and your employer record the session and you throw your own copy away.

Watch what happens when you ask an agent to <span data-fx="type">add retries to the upload client</span> and walk away to make coffee. Twenty minutes later you come back to a branch where the tests pass and the patch would take down production. It retries on HTTP 400 responses, so one malformed payload will hammer your auth service until it falls over. An unrelated config change sits in the diff, and when an integration test failed, the agent rewrote the assertion until the suite passed.

You spend the next ten minutes cutting. You reject the 400 retry, rewrite the backoff math by hand, revert the config hunk, and stop a second run mid-turn before it edits another test file. That ten-minute cut is the only place your judgment touched the work.

<figure class="fx-figure" data-figure="cut"><figcaption><span class="fx-figure__kicker">Fig. 1</span>The opening scene, replayed. The prompt is six words any engineer would type. The five corrections after it are the part only you could make.</figcaption></figure>

## The signal is in the correction

<aside class="pull-quote"><p>Your prompts are worthless, and your diffs are your weights.</p></aside>

What you asked the agent first was noise that any developer on your team would have typed the same way. The signal lives in what you reject, edit, revert, or stop mid-run, because that correction delta is the gradient of your taste and judgment. <span data-fx="del">Your prompts are worthless</span>, and <span data-fx="add">your diffs are your weights</span>.

Most engineers throw those weights away ten times a day. You fix the mistake in your working tree, merge the pull request, and close the window, only for a new instance of the same model to start tomorrow morning with no memory and walk into the same trap. If you fix an agent's mistake three times without mining the trace into a rule, a test, or a script, you have inverted the relationship. You are working as an unpaid retry loop for a stateless model that forgets you the moment the thread closes.

## Someone else keeps the tape

The model forgets you on your own machine, while upstream a market has formed to harvest the tape. PublicAI's [Trajector](https://www.publicai.io/for-labs) sits as a proxy in front of Claude Code to package developer sessions for AI labs across more than <span data-fx="count" data-to="10">10</span> billion tokens, labeling every turn as <span data-fx="pos">accepted</span>, <span data-fx="neg">reverted</span>, or <span data-fx="neg">human_correction</span> and charging labs a premium for slices dense with pushback and recovery loops, while [paying the developer $1 per million tokens](https://docs.publicai.io/publicai-documentation/publicai-trajector-cli/rewards) for a perpetual license. Security firms are mining engineer traces into workflows too. This month Trail of Bits and OpenAI [published `patching-bugs` and `regression-hunt`](https://blog.trailofbits.com/2026/10/21/your-ai-agent-fixed-the-bug-but-what-else-did-it-change/), two plugins distilled from thousands of their engineers' Codex sessions after an audit found 21 regressions across 130 merged patches, cutting false-positive regression findings by <span data-fx="bar" data-from="100" data-to="75">25%</span>.

<blockquote><p>At Anthropic, workers codify their expertise for the machine, see their work routines constantly roiled and disrupted, and have seen a large part of their job become speedreading the output of their AI collaborators.</p><cite>Anthropic Economics Team, <a href="https://www.anthropic.com/research/employment-at-anthropic">How employment is changing at Anthropic</a> (October 2026)</cite></blockquote>

Data brokers and labs were the first to harvest that correction stream, and employers are locking down the same pipe inside the company. On October 12, GitHub [shipped enterprise OpenTelemetry capture across Copilot CLI, the Copilot app, and VS Code Agent Host](https://github.blog/changelog/2026-10-12-client-telemetry-user-attribution-and-configurable-capture/), letting administrators attach the developer's OS login and machine name to every session and turn on capture of prompts, responses, tool arguments, tool outputs, and sandbox paths through managed settings that override local config. Six days earlier, Chainloop [open-sourced `chainloop trace`](https://chainloop.dev/blog/open-sourcing-ai-session-collector/), a collector running at Fortune 500 companies that hooks into Claude Code, OpenCode, and Cursor on developer laptops to record every prompt, tool call, and file snapshot before and after each edit, attributing every changed line to the agent or the person and vendoring the specs and skills the agent loaded into a signed attestation on `git push`. Inside Anthropic's workplace, their [October 2026 employment study](https://www.anthropic.com/research/employment-at-anthropic) found that interactive agent hours now outnumber human hours six to one, employees have written 8,500 standing instructions to steer them, and the share of junior technical hires dropped from 27% to <span data-fx="bar" data-from="27" data-to="9">9%</span> while hiring scorecards noting AI tooling tripled (<span data-fx="bar" data-from="100" data-to="300">3x</span>).

<figure class="fx-figure" data-figure="flow"><figcaption><span class="fx-figure__kicker">Fig. 2</span>Every accept, reject, edit, revert and stop already flows to a vendor's reward model and an employer's collector. Flip the switch to keep a copy that compiles into your own rules. A sketch, not a measurement.</figcaption></figure>

<aside class="pull-quote"><p>Your employer compounds on your judgment while you walk away from the job with zero weights.</p></aside>

Follow that pipe forward a couple of years and the bargain of software employment breaks. The deal used to be that the company kept the code you typed on the clock, while you walked out the door with the experience in your head. Centralize the agent trace logs across five hundred engineers and the company captures a copy of the experience too. Every time a staff engineer aborts a broken migration, blocks a leaky fixture, or rewrites a lock, they label a training example of engineering taste. An employer that logs those trajectories can hill-climb its workflows on its staff's judgment until each role is replaceable. Without your own trace intelligence, your employer compounds on your judgment while you walk away from the job with zero weights, making asymmetry of trace capture the new wealth gap at work.

## Your harness is your capital

Staying on the right side of that gap requires keeping your own record in a form you can carry with you. <span data-fx="del">Your resume is dead</span> once anyone with a credit card can spin up a fleet of coding agents before lunch, whereas <span data-fx="add">your eval suite is portable capital</span>. Hiring a principal engineer will mean hiring their harness, built from the failure traces, gates, and decision rubrics they accumulated across years of steering agents. Interviews will stop asking candidates to invert trees on a whiteboard and start mounting the candidate's harness onto a repository to see what it blocks before merge.

## Most of your judgment compiles

Building that trace loop is easier than it sounds, and it will bruise your ego. Before you read your own logs, it is easy to believe that senior intuition is a craft built over a decade. Cluster your intervention traces across a thousand runs and you find that <span data-fx="fill" data-to="90">ninety percent</span> of what you call your judgment is fifteen repeatable heuristics firing in a loop. I steer agents across four machines over Tailscale most days, and once raw JSONL transcripts piled up past what I could grep by hand, I started using `tracequest` to index, search, and replay session traces across harnesses to see why I kept stepping in.

<figure class="fx-figure" data-figure="clusters"><figcaption><span class="fx-figure__kicker">Fig. 3</span>A thousand interventions, clustered as you scroll. The points are simulated to show the shape of the claim: most corrections land in a handful of repeatable vetoes, and a small loose remainder is the judgment that does not compile.</figcaption></figure>

Almost none of my repeated corrections turned out to be architectural insights. Today they live as <span data-fx="add">files and checks on my machines</span> instead of <span data-fx="del">thoughts in my head</span>. On my Linux box `fedora`, agents kept editing `~/.hermes/config.yaml` and wondering why nothing changed, until a note in my home directory warned them that the Docker container mounts `~/.hermes/data/config.yaml` as `/opt/data/config.yaml` instead. Across my repos, I wasted hours rescuing agents that blamed application code when a test failed, until I wrote a rule to treat friction as environmental until proven otherwise, checking the working directory, dependencies, and permissions before touching code. Parallel agents kept forking database migrations until a rule forced an Alembic head linearity check before any merge. Other rules ban polling CI in sleep loops in favor of one blocking `gh pr checks --watch` call, and require reading the full diff against the base branch to revert stray hunks before reporting a task done. Each of those fifteen or so vetoes can be compiled out of your head in an afternoon, and what remains once they are gone is the fraction of your judgment that is rare.

## The instrument points both ways

<aside class="pull-quote"><p>Cognitive drift shows up in your traces days before you feel it in your body.</p></aside>

Once that trace pipeline is running, you notice the instrument is pointed at both ends of the terminal. We spend plenty of time tracking whether models degrade on Tuesday afternoons while ignoring the person at the keyboard. Cognitive drift shows up in your traces days before you feel it in your body. When you are tired at midnight or stretched across ten worktrees, your acceptance threshold drops, your prompts get vague, and you wave through a three-hundred-line diff because the tests pass and you want to go to sleep. Fatigue numbs the faculty you use to judge your own focus, so you rarely notice the slide until <span data-fx="spike">your revert rate spikes two days later</span>. Your trace log is a mirror of your blind spots, catching you degrading the same way a canary catches a regressing model.

## The boundary of you moves up

Closing that loop every week also moves the line between you and the machine. Each time your trace review turns a manual review into an automated check, the surface where a person is needed shrinks, forcing you up the entropy ladder toward the decisions you still cannot formalize. You spend less time policing lockfiles or retry codes and more time deciding which project deserves doing at all, when a working patch is wrong for the business, or which risk is worth taking this quarter. The boundary of "you" moves every week, and it only moves upward if you keep compiling the layer below it.

<figure class="fx-figure" data-figure="ladder"><figcaption><span class="fx-figure__kicker">Fig. 4</span>The entropy ladder. Scroll to advance the weeks: each manual review that becomes a check moves the boundary of “you” up a rung. The top rungs stay human until someone can write them down.</figcaption></figure>

## Guard the decision boundary

<blockquote><p>Explicit managed values take precedence over local settings, SDK configuration, and environment variables. Prompt, tool, and policy capture can include source code, file contents, commands, tool results, and workspace or user-profile paths.</p><cite>GitHub Changelog, <a href="https://github.blog/changelog/2026-10-12-client-telemetry-user-attribution-and-configurable-capture/">Client telemetry user attribution and configurable capture</a> (October 2026)</cite></blockquote>

<aside class="pull-quote"><p>Privacy in the agent era means guarding your decision boundary rather than hiding your messages.</p></aside>

That makes a trace archive the most sensitive record you produce, and it changes what privacy needs to protect. A leaked inbox tells someone what you worked on last month, while a leaked trace history gives them a training set to clone what you would approve, ignore, or veto next. Privacy in the agent era means guarding your decision boundary rather than <span data-fx="del">hiding your messages</span>, yet most engineers stream that boundary to tool vendors and employers by default. Keep your traces on your own machines, mine them into your own harness, and guard the line where you say no.
