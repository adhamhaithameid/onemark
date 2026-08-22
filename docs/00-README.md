# OneMark — Documentation Index

Read in order. Each document assumes the previous one.

| # | Document | Answers |
|---|---|---|
| 00 | **This file** | Where is everything |
| 01 | [Brief](01-Brief.md) | Why does this exist? Who is it for? What is it not? |
| 02 | [PRD](02-PRD.md) | What exactly gets built, and how do we know it worked? |
| 03 | [Technical Spec](03-Technical-Spec.md) | How is it built? What are the interfaces? |
| 04 | [Build Plan](04-Build-Plan.md) | In what order, and what does "done" mean per milestone? |
| 05 | [Learning Roadmap](05-Learning-Roadmap.md) | What do I need to learn, and when? |

## Supporting material

| Path | Contents |
|---|---|
| [`adr/`](adr/) | Architecture Decision Records — one per decision, **with rejected alternatives** |
| [`session-logs/`](session-logs/) | Dated working-session records |
| [`../HANDOFF.md`](../HANDOFF.md) | Current state, next action, open questions — **read first after a break** |

## How to use this documentation

**Picking the project back up after a gap** → [`HANDOFF.md`](../HANDOFF.md), then the newest session log.

**Wondering "why did I choose X?"** → [`adr/`](adr/). Every ADR lists what was rejected and why. Do not relitigate a decision without reading its ADR first.

**Wondering "should I build feature X?"** → [PRD §5.1](02-PRD.md). If X is not required by the done-line sentence, X is v2. This rule has no exceptions.

**Changing a decision** → write a *new* ADR that supersedes the old one. Never edit a decided ADR. The record of having been wrong is the valuable part.

## Document status

| Doc | Status | Last revised |
|---|---|---|
| 01-Brief | Draft | 2026-08-16 |
| 02-PRD | Draft — scope approved | 2026-08-16 |
| 03-Technical-Spec | Draft | 2026-08-16 |
| 04-Build-Plan | Draft | 2026-08-16 |
| 05-Learning-Roadmap | Draft | 2026-08-16 |
| ADR 0001–0011 | Accepted | 2026-08-16 |
