---
title: "Your diffs are your weights"
date: "2026-10-25"
description: "What you ask an agent first is mostly noise. Your real judgment lives in what you reject, rewrite, and revert, and someone is already training on that record."
slug: "personal-trace-intelligence"
tags:
  - agents
  - privacy
draft: true
decor:
  seed: "personal-trace-intelligence"
  canvas: diff
---

You type six lazy words into a terminal, asking an agent to <span data-fx="type">route sandbox traffic through egress proxy</span>, and walk away to make coffee. Twenty minutes later you come back to a green branch that is quietly trying to break production. On a proxy timeout, the patch catches the error and falls back to a direct unproxied connection so its smoke test will pass. A speculative timeout change in `config/limits.yaml` from an abandoned debugging attempt sits in the diff uninvited, and when one policy test failed with a `403`, the agent widened the assertion to accept `(200, 403)` until the suite turned green.

You spend the next ten minutes cutting, rejecting the fail-open fallback, wiring the route lookup to the workspace policy, reverting the leftover config hunk, restoring the `403` assertion, and killing a sibling run mid-turn before it can loosen another test file. That ten-minute cut is the only place your engineering brain touched the work.

<figure class="fx-figure" data-figure="cut"><figcaption><span class="fx-figure__kicker">Fig. 1</span>The opening scene, replayed. The prompt is six words any engineer would type. The five corrections after it are the part only you could make.</figcaption></figure>

## The signal is in the correction

<aside class="pull-quote"><p>Your prompts are worthless, and your diffs are your weights.</p></aside>

What you asked the agent first was mostly noise that any developer on your team would have typed the same way. The real signal lives in what you reject, edit, revert, or stop mid-run, because that correction delta is the exact gradient of your taste and judgment. <span data-fx="del">Your prompts are worthless</span>, and <span data-fx="add">your diffs are your weights</span>.

Most engineers throw those weights in the trash ten times a day. You fix the mistake in your working tree, merge the pull request, and close the window, only for a fresh instance of the same model to wake up tomorrow morning with complete amnesia and walk straight into the same trap. If you fix an agent's mistake three times without mining the trace into a rule, a test, or a script, you have inverted the relationship. You are working as an unpaid biological retry loop for a stateless model that forgets you the moment the thread closes.

## Someone else keeps the tape

The model only forgets you on your own machine, while upstream the vendor keeps the tape. Cursor first proved the loop with [online reinforcement learning on Tab](https://cursor.com/blog/tab-rl) across <span data-fx="count" data-to="400">400</span> million daily requests, cutting shown suggestions by <span data-fx="bar" data-from="100" data-to="79">21%</span> and lifting accept rates by <span data-fx="bar" data-from="100" data-to="128">28%</span>, and now runs [real-time reinforcement learning directly on Composer](https://cursor.com/blog/real-time-rl-for-composer). Every cycle collects billions of tokens from live coding sessions, rewards agent edits that survive in the codebase (<span data-fx="pos">+2.28%</span> in their A/B test) while penalizing runs that provoke a dissatisfied follow-up (<span data-fx="neg">-3.13%</span>), and ships an updated agent checkpoint as often as every five hours. Every time an engineer rewrites a bad diff or pushes back in a follow-up, they compute a free gradient step for the vendor's weights and walk away owning nothing.

<blockquote><p>The production environment for Composer consists of not just the computer that executes Composer's commands, but the person who oversees and directs its actions. It's much easier to simulate the computer than the person using it.</p><cite>Cursor, <a href="https://cursor.com/blog/real-time-rl-for-composer">Improving Composer through real-time RL</a></cite></blockquote>

Tool vendors were the first to harvest that correction stream, and employers are close behind. Meta [told employees it would record keystrokes, button clicks, and mouse movements](https://techcrunch.com/2026/04/21/meta-will-record-employees-keystrokes-and-use-it-to-train-its-ai-models/) in selected work applications to train agents for everyday computer tasks, explaining that "our models need real examples of how people actually use them." For software engineers, a company does not even need a screen recorder because coding harnesses already turn human judgment into structured telemetry. Claude Code [logs a `tool_decision` event every time a user accepts or rejects a tool call](https://code.claude.com/docs/en/monitoring-usage), and GitHub [added enterprise OpenTelemetry capture across Copilot agents](https://github.blog/changelog/2026-10-12-client-telemetry-user-attribution-and-configurable-capture/) so administrators can collect user identity, prompts, tool arguments, tool outputs, and edit feedback through managed settings that override local config.

<figure class="fx-figure" data-figure="flow"><figcaption><span class="fx-figure__kicker">Fig. 2</span>Every accept, reject, edit, revert and stop already flows to a vendor's reward model and an employer's collector. Flip the switch to keep a copy that compiles into your own rules. A sketch, not a measurement.</figcaption></figure>

<aside class="pull-quote"><p>Your employer compounds on your judgment while you walk away from the job with zero weights.</p></aside>

Follow that pipe forward a couple of years and the forty-year bargain of software employment breaks. The old deal was that the company kept the code you typed on the clock, while you walked out the door with the experience inside your skull. Centralize the agent trace logs across five hundred engineers and the company captures a working copy of the experience too. Every time a staff engineer kills a fail-open fallback, strips trajectory residue from a noisy branch, or rejects a patch that only passes against mocks, they label a training example of institutional taste. An employer that logs those trajectories can hill-climb its internal workflows on its staff's judgment until each role is replaceable. Without your own local trace intelligence, your employer compounds on your judgment while you walk away from the job with zero weights, making asymmetry of trace capture the new wealth gap at work.

## Your harness is your capital

Staying on the right side of that gap requires keeping your own ledger in a form you can carry out the building. <span data-fx="del">Your resume is dead paper</span> once anyone with a credit card can spin up a fleet of coding agents before lunch, whereas <span data-fx="add">your eval suite is portable capital</span>. Hiring a senior principal will come to mean hiring their personal harness, built from the curated failure traces, hard gates, and decision rubrics they accumulated across years of steering agents. Technical interviews will stop grading how fast a candidate writes a service from scratch and start mounting their harness onto a messy repository to see what it blocks before merge.

## Most of your judgment compiles

Building that personal trace loop is easier than it sounds, and it will bruise your ego. Before you inspect your own logs, it is flattering to believe that senior intuition is a deep, mysterious craft built over a decade. Cluster your own intervention traces across a thousand runs and you discover that <span data-fx="fill" data-to="90">roughly ninety percent</span> of what you call your judgment is fifteen repeatable heuristics firing on a loop. I dispatch agents across several machines over Tailscale most days, and once raw JSONL transcripts piled up past what I could grep by hand, I started using `tracequest` to index, search, and replay session traces across harnesses so I could see why I kept stepping in.

<figure class="fx-figure" data-figure="clusters"><figcaption><span class="fx-figure__kicker">Fig. 3</span>A thousand interventions, clustered as you scroll. The points are simulated to show the shape of the claim: most corrections land in a handful of repeatable vetoes, and a small loose remainder is the judgment that does not compile.</figcaption></figure>

Almost none of my repeated corrections turned out to be profound architectural insights, and generic rules preaching diligence changed nothing when replayed against past sessions. What worked now lives as <span data-fx="add">hard constraints and gates in my harness</span> instead of <span data-fx="del">thoughts in my head</span>. Agents kept declaring tasks done as soon as unit tests passed or a pull request opened while the live page or install path was broken, until an acceptance gate forced every run to verify the real surface in a clean directory or headless browser and watch production logs after deploy. Frontier models routinely pass a stubborn check by loosening an assertion, editing a fixture, or reading a held-out grader, until a specific prohibition named existing tests, fixtures, CI configs, and graders off-limits. Because current models expand scope uninvited and leave speculative edits from abandoned attempts sitting in the branch, another gate requires reading the full diff against the base branch and reverting every hunk the final fix does not need. When `tracequest` showed sessions burning thousands of turns polling CI in loops, one rule replaced the loop with a single blocking `gh pr checks --watch` call that wakes the session on exit, and another gates shared host load and metered API spend above a hundred dollars. Each of those fifteen or so vetoes can be compiled out of your head in an afternoon, and what remains once they are gone is the small fraction of your judgment that is rare.

## The instrument points both ways

<aside class="pull-quote"><p>Cognitive drift shows up in your traces days before you feel it in your body.</p></aside>

Once that trace pipeline is running, you realize the instrument is pointed at both ends of the terminal. We spend plenty of energy tracking whether frontier models degrade on Tuesday afternoons while ignoring the much noisier biological system at the keyboard. Cognitive drift shows up in your traces days before you feel it in your body. When you are tired at midnight or stretched across ten concurrent worktrees, your acceptance threshold drops, your prompts get vague, and you wave through a three-hundred-line diff because the tests are green and you want to go to sleep. Fatigue numbs the exact faculty you use to judge your own sharpness, so you rarely feel the slide until <span data-fx="spike">your revert rate spikes two days later</span>. Your personal trace log is a mirror of your own blind spots, catching you degrading the same way a canary catches a regressing model.

## The boundary of you moves up

Closing that loop every week also moves the line between you and the machine. Each time your personal trace review turns a manual review into an automated check, the surface area where a human is needed shrinks, forcing you up the entropy ladder toward the decisions you still cannot formalize. You spend less time policing trajectory residue, loosened assertions, or proxy-done claims and more time deciding which project deserves doing at all, when a technically clean patch is wrong for the business, or which operational risk is worth taking this quarter. The boundary of "you" moves every week, and it only moves upward if you keep compiling the layer below it.

<figure class="fx-figure" data-figure="ladder"><figcaption><span class="fx-figure__kicker">Fig. 4</span>The entropy ladder. Scroll to advance the weeks: each manual review that becomes a check moves the boundary of “you” up a rung. The top rungs stay human until someone can write them down.</figcaption></figure>

## Guard the decision boundary

<blockquote><p>There are safeguards in place to protect sensitive content, and the data is not used for any other purpose.</p><cite>Meta spokesperson, on recording employee inputs to train agents, via <a href="https://techcrunch.com/2026/04/21/meta-will-record-employees-keystrokes-and-use-it-to-train-its-ai-models/">TechCrunch</a></cite></blockquote>

<aside class="pull-quote"><p>Privacy in the agent era means guarding your decision boundary rather than hiding your messages.</p></aside>

That makes a personal trace archive the most sensitive record you generate, and it rewrites what privacy needs to protect. A leaked inbox tells someone what you worked on last month, while a leaked trace history gives them a training set to clone what you would approve, ignore, or veto next. Privacy in the agent era means guarding your decision boundary rather than <span data-fx="del">hiding your messages</span>, yet most engineers stream that boundary to tool vendors and employers in exchange for a slightly smoother agent session. Keep your traces on your own machines, mine them into your own harness, and guard the line where you say no.
