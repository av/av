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

A data broker called PublicAI is currently [paying software engineers $1 per million tokens](https://docs.publicai.io/publicai-documentation/publicai-trajector-cli/rewards) for their local Claude Code transcripts. If you read [what they sell to AI labs](https://www.publicai.io/for-labs), they are not paying for clean sessions where the model one-shots a feature. Clean runs are cheap. The expensive tier in their catalog is the slice where the developer rejects a patch, tells the model its diagnosis is wrong, reverts a file, or kills a session that wandered into the weeds.

<figure class="fx-figure" data-figure="arbitrage"><figcaption><span class="fx-figure__kicker">Fig. 1</span>The $1 per million token arbitrage. Toggle the session count to see how raw token payouts compare against the preference pairs extracted from your vetoes.</figcaption></figure>

For forty years, if you worked at a software company for five years and quit, they kept the code you typed on the clock and you walked out the door with the scar tissue in your head. That was the deal. Now every coding harness you touch is wired to record that scar tissue as it forms, and you are pricing your own judgment at a dollar a million tokens, or giving it to your vendor and your employer for zero.

<figure class="fx-figure" data-figure="bargain"><figcaption><span class="fx-figure__kicker">Fig. 2</span>The forty-year employment bargain, before and after session telemetry. Switch eras to see what crosses the exit door when you leave a job.</figcaption></figure>

Look at a normal twenty-minute session. You open a terminal, type a six-word prompt into your coding agent, and go make coffee.

<div class="fx-agent-prompt" data-fx="type">add retries to the upload client</div>

When you sit back down, the tests pass and the branch will take down production if you merge it. The patch retries on HTTP 400 responses, so one bad payload will hammer your auth service until it falls over. A timeout change in `config/prod.yaml` sits in the diff from an earlier guess the agent forgot to undo, and when an integration test failed with a `422`, the agent changed the assertion to `in (200, 422)` so the suite would pass.

So you spend ten minutes cutting. You reject the 400 retry, rewrite the backoff math by hand, revert the config file, restore the test assertion, and stop a second run mid-turn when you see it opening `test_auth.py`.

<figure class="fx-figure" data-figure="cut"><figcaption><span class="fx-figure__kicker">Fig. 3</span>Trajectory divergence across the session. The six-word prompt starts both paths, and the shaded correction delta between the agent's green-tests branch and the branch you merge is where your weights live.</figcaption></figure>

## The signal is in the correction

<aside class="pull-quote"><p>Your prompts are worthless, and your diffs are your weights.</p></aside>

People still trade system prompts and `CLAUDE.md` templates as if the secret to working with agents is how you phrase the wish. It isn't. What you ask first is mostly noise. Any engineer on your team would have typed the same six words to ask for upload retries.

<figure class="fx-figure" data-figure="divergent"><figcaption><span class="fx-figure__kicker">Fig. 4</span>Six engineers type the same six-word prompt and receive the same initial agent patch. Select each role to inspect how their final diffs diverge.</figcaption></figure>

The part of the session that could only have come from you is the diff between what the model handed you and what you let onto `main`. Every reject, manual edit, `git checkout --`, and mid-run abort is a labeled training pair where the before is a plausible mistake and the after is your judgment. <span data-fx="del">Your prompts are worthless</span>, and <span data-fx="add">your diffs are your weights</span>.

Most of us throw those weights away all day. We fix the diff in our working tree, merge the PR, and close the terminal. Tomorrow morning a new session of the same stateless model starts from scratch and walks into the same wall. If you fix the same mistake three times without turning the trace into a rule, a test, or a script, you are working as an unpaid retry loop for a model that forgets you the second the window closes.

<figure class="fx-figure" data-figure="retry-loop"><figcaption><span class="fx-figure__kicker">Fig. 5</span>The biological retry loop. Flip the switch on Day 3 to compile the repeated manual fix into a standing gate before the next session starts.</figcaption></figure>

## Someone else keeps the tape

The model forgets you on your laptop, while everyone upstream keeps the tape. PublicAI's [Trajector](https://www.publicai.io/for-labs) sits as a proxy on `127.0.0.1:41100` in front of Claude Code, collects sessions across more than <span data-fx="count" data-to="10">10</span> billion tokens, and labels every turn as <span data-fx="pos">accepted</span>, <span data-fx="neg">reverted</span>, or <span data-fx="neg">human_correction</span> so labs can train on where an engineer stepped in. Security shops are doing the same thing with their own staff's logs. This month Trail of Bits and OpenAI [released `patching-bugs` and `regression-hunt`](https://blog.trailofbits.com/2026/10/21/your-ai-agent-fixed-the-bug-but-what-else-did-it-change/), two plugins mined out of thousands of their engineers' Codex sessions after an audit of 130 merged patches found 21 regressions, cutting false-positive regression reports by <span data-fx="bar" data-from="100" data-to="75">25%</span>.

<blockquote><p>At Anthropic, workers codify their expertise for the machine, see their work routines constantly roiled and disrupted, and have seen a large part of their job become speedreading the output of their AI collaborators.</p><cite>Anthropic Economics Team, <a href="https://www.anthropic.com/research/employment-at-anthropic">How employment is changing at Anthropic</a> (October 2026)</cite></blockquote>

Employers don't need a third-party proxy, because enterprise harnesses now ship with the pipe built in. On October 12, GitHub [added configurable OpenTelemetry capture to Copilot CLI, the Copilot app, and VS Code Agent Host](https://github.blog/changelog/2026-10-12-client-telemetry-user-attribution-and-configurable-capture/). An administrator can attach your GitHub login, OS username, and machine name to every session and turn on capture for prompts, responses, tool arguments, tool outputs, and sandbox paths through managed settings that override local config. Six days earlier, Chainloop [open-sourced `chainloop trace`](https://chainloop.dev/blog/open-sourcing-ai-session-collector/), a collector running at Fortune 500 companies that hooks into Claude Code, OpenCode, and Cursor on developer laptops, snapshots every file before and after each edit to attribute lines between the agent and the person, and bundles the transcript, specs, and skills into a signed attestation on `git push`. Inside Anthropic, their [October 2026 study of their own workforce](https://www.anthropic.com/research/employment-at-anthropic) reported that interactive agent hours now outnumber employee hours six to one, staff have written 8,500 standing instructions to steer them, and the share of junior technical hires fell from 27% to <span data-fx="bar" data-from="27" data-to="9">9%</span> while interview scorecards mentioning AI tooling grew <span data-fx="bar" data-from="100" data-to="300">3x</span>.

<figure class="fx-figure" data-figure="xray"><figcaption><span class="fx-figure__kicker">Fig. 6</span>Packet X-ray of a single commit. Select each layer to inspect the telemetry and file-attribution records exported alongside a standard git push.</figcaption></figure>

<figure class="fx-figure" data-figure="flow"><figcaption><span class="fx-figure__kicker">Fig. 7</span>Every accept, reject, edit, revert and stop already flows to a vendor's reward model and an employer's collector. Flip the switch to keep a copy that compiles into your own rules. A sketch, not a measurement.</figcaption></figure>

<aside class="pull-quote"><p>Your employer compounds on your judgment while you walk away from the job with zero weights.</p></aside>

Play that tape forward two years. When a company records five hundred engineers steering agents all day, every time a staff engineer aborts a broken migration, catches a race condition in a retry handler, or deletes a mocked test that tests nothing, they write a labeled preference pair into the company's collector. The employer can hill-climb its internal workflows on that record until the role is replaceable. Without your own trace intelligence, your employer compounds on your judgment while you walk out the door with zero weights. Asymmetry of trace capture is the new wealth gap at work.

<figure class="fx-figure" data-figure="hillclimb"><figcaption><span class="fx-figure__kicker">Fig. 8</span>Enterprise workflow hill-climbing across 24 months. Drag the slider to see how captured staff vetoes raise internal harness pass rates while shrinking required senior seats.</figcaption></figure>

## Your harness is your capital

The only countermeasure is keeping your own copy in a form that leaves the building when you do. <span data-fx="del">Your resume is dead</span> in a world where anyone can rent a fleet of coding agents by the hour, and <span data-fx="add">your eval suite is your portable capital</span>.

<figure class="fx-figure" data-figure="compounding"><figcaption><span class="fx-figure__kicker">Fig. 9</span>Three-year compounding ledger across 1,000 monthly agent runs. Compare the flat yield of a stateless operator against compiling one or two failure rules a week.</figcaption></figure>

A list of past employers on a PDF says you were in the room while code got written. It says nothing about whether you can keep twenty concurrent agents from corrupting a database or gaming their own test suite. Hiring a senior or principal engineer is going to mean hiring the harness they bring with them, built from the failure traces they saved from real incidents, the pre-merge gates they wrote after being burned, and the rubrics they use to grade a run. An interview that tests what the job is now looks like pointing a candidate's harness at a broken repo and watching what it refuses to merge.

<figure class="fx-figure" data-figure="sandbox"><figcaption><span class="fx-figure__kicker">Fig. 10</span>The harness interview sandbox. Mount each candidate's harness against a five-agent swarm to see which production hazards get blocked before merge.</figcaption></figure>

## Most of your judgment compiles

Once you start reading your own traces, the first thing that takes a hit is your vanity. We like to think senior intuition is an unformalizable craft earned over ten years of outages. Then you cluster your own interventions across a thousand agent runs and find out that <span data-fx="fill" data-to="90">ninety percent</span> of what you call your judgment is fifteen mechanical vetoes you keep repeating by hand.

I run agents across four machines over Tailscale most days. After enough sessions, raw JSONL logs pile up across hosts and you stop remembering which mistake you already fixed last Tuesday. I use `tracequest` to index, search, and replay transcripts from Claude Code, Codex, Cursor, OpenCode, and Grok in one place so I can see where sessions broke and what I kept typing in follow-up turns.

<figure class="fx-figure" data-figure="topology"><figcaption><span class="fx-figure__kicker">Fig. 11</span>Multi-machine trace topology over Tailscale. Select any host to trace how raw JSONL session errors get indexed in tracequest and synced back as fleet-wide rules.</figcaption></figure>

<figure class="fx-figure" data-figure="clusters"><figcaption><span class="fx-figure__kicker">Fig. 12</span>A thousand interventions, clustered as you scroll. The points are simulated to show the shape of the claim, where most corrections land in fifteen repeatable vetoes and a small loose remainder is the judgment that does not compile.</figcaption></figure>

Almost none of my repeated interventions were deep thoughts about architecture. On my Linux box `fedora`, agents kept editing `~/.hermes/config.yaml` and restarting the service when nothing changed, because the Docker container mounts `~/.hermes/data/config.yaml` into `/opt/data/config.yaml`. Putting that note in `~/AGENTS.md` killed a whole category of wasted turns. Across repos, agents kept rewriting application code whenever a test failed because they were in the wrong working directory or missing a local dependency, until I added a rule to treat friction as environmental first and check `cwd`, deps, and permissions before touching logic. Parallel sessions kept creating two database migration heads on the same branch until a rule required checking Alembic head linearity before merge. Agents burned hundreds of turns running `sleep 30 && gh pr checks` in loops until a rule forced one blocking `gh pr checks --watch` call, and they kept leaving debugging edits from dead-end attempts in the branch until a gate required reading the full `git diff` against base and reverting every hunk the final fix did not need.

<figure class="fx-figure" data-figure="anatomy"><figcaption><span class="fx-figure__kicker">Fig. 13</span>Anatomy of a compiled veto. Step through four real failure clusters to see the raw JSONL transcript, the extracted invariant, and the compiled check.</figcaption></figure>

Today those live as <span data-fx="add">files and checks on my machines</span> instead of <span data-fx="del">thoughts in my head</span>. Fifteen rules like that cover nine out of ten interventions most of us make, and each one takes an afternoon to turn into a check or a hook. Once you compile them out of your head, you get to see the part of your judgment that resists formalization, and you see how small it is.

<figure class="fx-figure" data-figure="pareto"><figcaption><span class="fx-figure__kicker">Fig. 14</span>The vanity Pareto distribution across 1,000 interventions. Click the button to compile the top fifteen mechanical vetoes into scripts and isolate the 10% that remains human.</figcaption></figure>

## The instrument points both ways

<aside class="pull-quote"><p>Cognitive drift shows up in your traces days before you feel it in your body.</p></aside>

A trace log grades you with the same cold fidelity it applies to the model. Engineers spend hours arguing on Reddit about whether a model got lobotomized on Tuesday afternoon while ignoring the operator at the keyboard.

Cognitive drift shows up in your traces before you feel it. When I am tired at 1 a.m. or context-switching across ten worktrees on a board, my acceptance threshold drops. My prompts shrink to vague one-liners, I stop checking callers outside the touched file, and I approve a three-hundred-line diff because the tests pass and I want to close the lid. You don't feel yourself getting sloppy while it happens, because fatigue dulls the part of your brain that notices you are tired. Two days later, <span data-fx="spike">your revert rate spikes</span> as the bugs you waved through hit staging or production. Your trace history is a flight recorder for your own attention, catching you degrading the same way a canary catches a regressing model.

<figure class="fx-figure" data-figure="recorder"><figcaption><span class="fx-figure__kicker">Fig. 15</span>Operator flight recorder from 09:00 to 01:00. Scrub across the workday to see worktree count, prompt length, and review speed degrade before the 48-hour revert wave.</figcaption></figure>

<figure class="fx-figure" data-figure="fatigue-diff"><figcaption><span class="fx-figure__kicker">Fig. 16</span>The same 300-line diff at 10:00 a.m. versus 01:00 a.m. Toggle operator state to see how green CI checks mask tenant-bleed and fail-open catch bugs when you are tired.</figcaption></figure>

## The boundary of you moves up

Every time you turn last week's manual correction into this week's automated check, the surface where a person is needed shrinks. Last month you had to read diffs by eye to catch stray debugging hunks or forked Alembic heads. This month a script rejects both before the agent is allowed to report done.

<figure class="fx-figure" data-figure="surface"><figcaption><span class="fx-figure__kicker">Fig. 17</span>The shrinking human review surface across four quarters. Select each quarter to see compiled harness gates replace manual bug-catching and concentrate human time on high-entropy bets.</figcaption></figure>

If you think your job is catching mistakes in code review, watching your own harness eat your routine one check at a time feels like sawing off the branch you sit on. In practice, it forces you up the entropy ladder. When you stop spending your attention on lockfiles, retry codes, and CI loops, the decisions left on your plate are the ones you still don't know how to write down as a rule, like whether a feature is worth building at all, when a working patch solves the wrong business problem, or which risk to take before a launch. The boundary of "you" moves every week. It is whatever sits one rung above the checks you compiled last Friday.

<figure class="fx-figure" data-figure="ladder"><figcaption><span class="fx-figure__kicker">Fig. 18</span>The entropy ladder. Scroll to advance the weeks as each manual review compiles into a check and moves the boundary of “you” up a rung.</figcaption></figure>

## Guard the decision boundary

<blockquote><p>Explicit managed values take precedence over local settings, SDK configuration, and environment variables. Prompt, tool, and policy capture can include source code, file contents, commands, tool results, and workspace or user-profile paths.</p><cite>GitHub Changelog, <a href="https://github.blog/changelog/2026-10-12-client-telemetry-user-attribution-and-configurable-capture/">Client telemetry user attribution and configurable capture</a> (October 2026)</cite></blockquote>

<aside class="pull-quote"><p>Privacy in the agent era means guarding your decision boundary rather than hiding your messages.</p></aside>

That changes what privacy needs to protect. We still talk about digital privacy as if the goal is keeping people from reading our emails or our private repos. A leaked inbox tells someone what you worked on last month. A leaked trace archive gives them a training set to clone how you decide.

<figure class="fx-figure" data-figure="clone"><figcaption><span class="fx-figure__kicker">Fig. 19</span>Leaked inbox versus leaked trace archive. Test three candidate patches to compare what an email leak reveals against a behavioral clone trained on 1,000 of your accept and veto decisions.</figcaption></figure>

Someone with read access to your full intervention history, covering every prompt, every rejected tool call, every diff you threw back, and every patch you rewrote by hand, has the boundary of what you will approve, ignore, or veto next. Privacy in the agent era means guarding that decision boundary rather than <span data-fx="del">hiding your messages</span>, and right now almost every engineer in the industry streams it to vendors and employers by default. Keep your traces on your own disk, mine them into your own harness, and treat the line where you say no as the only weight matrix you own.

<figure class="fx-figure" data-figure="phase-space"><figcaption><span class="fx-figure__kicker">Fig. 20</span>Your decision boundary in phase space across 240 diffs. Toggle between your morning boundary and 1 a.m. cognitive drift to see how your accepts and vetoes define a mathematical contour of your taste.</figcaption></figure>
