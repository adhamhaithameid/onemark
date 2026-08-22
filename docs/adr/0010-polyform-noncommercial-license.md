# ADR-0010 — PolyForm Noncommercial 1.0.0

**Status:** Accepted · **Date:** 2026-08-16

## Context

The author uses two licensing conventions across existing projects:

| Repo | License |
|---|---|
| Classroom-Quick-Downloader | PolyForm **Strict** 1.0.0 |
| KeepAwake · KeepClean · KeepMirror | PolyForm **Noncommercial** 1.0.0 |

The initial instruction was "same as Classroom-Quick-Downloader" (Strict). Comparison surfaced the mismatch:

| | Strict | Noncommercial |
|---|---|---|
| Stranger can run the app | ❌ | ✅ |
| Hobby / personal / student use | ❌ | ✅ |
| University, charity, public research | ❌ | ✅ |
| Any commercial use | ❌ | ❌ |
| Fork / modify / redistribute | ❌ | ✅ (noncommercial) |

Neither is OSI open source; both are source-available and keep all commercial rights with the copyright holder.

## Decision

**PolyForm Noncommercial 1.0.0**, public repository.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| PolyForm Strict 1.0.0 | Grants no use rights at all — source-visible only. Correct for a downloader that scrapes a third-party service; wrong for a tool intended to be used. Would block goal G5 outright. |
| MIT / Apache-2.0 | Gives away all commercial rights permanently. |
| No license | Defaults to all-rights-reserved with no clarity for readers. |

## Consequences

**Good:** matches the convention of the author's three shipped applications. People may actually use OneMark; commercial rights stay reserved and dual-licensing later remains possible.

**Bad / accepted cost:** not OSI open source — GitHub labels it "Other", and it will not attract open-source contributors. Outside pull requests would require a CLA.

**No dependency conflict:** `comrak` (BSD-2), Tauri (MIT/Apache-2.0), CodeMirror 6, Shiki, KaTeX, Mermaid (MIT) are all permissive and compatible with source-available redistribution.

**Reversibility:** high in the permissive direction (relicensing to MIT is always possible as sole copyright holder); effectively impossible in the restrictive direction once released.
