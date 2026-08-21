# Session log — Records reconciliation

| Field | Value |
|---|---|
| Date | 2026-08-22 |
| Phase | M1.1–1.3 complete + hardened (unchanged) — documentation-debt session |
| Previous | [2026-08-21 security audit](2026-08-21-security-audit.md) · [2026-08-21 tooling onboarding](2026-08-21-tooling-onboarding.md) |
| Code changed | none |

## Result

The audit session's findings now live in the repo's permanent records instead of an
ephemeral `$TMPDIR` handoff. TDD discipline applied to documentation: verification
checks written first (5/5 red), facts verified against code before being enshrined,
then all checks green after.

## What was done

1. **Fact-check first** — every claim in the audit handoff verified against source before
   writing it into records: `MAX_DEPTH = 400` + `truncated` marker (`lib.rs:154,302–307`),
   regression tests (`robustness.test.ts`, `parse.rs:53–80` including the off-by-one
   comment), `afterSanitizeAttributes` hook (`sanitize.ts:132`), `USE_PROFILES`
   prohibition comments, forced `urlPolicy` (`safe.ts:24,46`), corpus length 93.
2. **Red** — record checks S1–S5 run before edits: 5/5 failed as expected.
3. **Green**:
   - Audit handoff persisted byte-identical → `docs/session-logs/2026-08-21-security-audit.md`
   - `CHANGELOG.md`: **Fixed** section for the four hardening defects + corpus growth entries
   - `docs/04-Build-Plan.md`: M1 progress row notes the hardening pass
   - `HANDOFF.md`: refreshed (date, phase, counts table incl. browser matrix, next action
     still task 1.4 with Playwright suggested for its verify column); stale "nothing
     committed" corrected to "2 local commits"; historical 49-vector row annotated rather
     than rewritten
   - **ADR-0014** written superseding ADR-0013; ADR-0013 left **byte-untouched**
     (md5-verified) per the never-edit rule; ADR index updated
   - Beads `OneMark-jy0` closed (fixed pre-filing by the audit session) and
     `OneMark-orl` closed (this reconciliation). Remaining open: `OneMark-8ij`
     (task 1.4 CSS), `OneMark-b5r` (OQ-1/OQ-2).
4. **Full sweep re-run at end**: fmt/clippy clean · Rust 17 · engine 57 · renderer 76 ·
   typecheck clean — matches the numbers now recorded in HANDOFF.

## Verification

| Check | Red | Green |
|---|---|---|
| S1 audit session log exists | FAIL | PASS |
| S2 CHANGELOG has USE_PROFILES + MAX_DEPTH fixes | FAIL ×2 | PASS |
| S3 build plan progress updated | FAIL | PASS |
| S4 HANDOFF refreshed | FAIL | PASS |
| S5 ADR-0014 supersedes / ADR-0013 untouched | FAIL / md5 pinned | PASS / md5 identical |
| S6 beads jy0 + orl closed | open | PASS |

## Notes

- `/review` skill's parallel subagents were skipped (provider returned 502/504 on this host
  last session); the Standards+Spec pass was done inline — every record claim traced to a
  fact-check against code before writing.
- Known cosmetic inconsistency kept deliberately: build-plan task 1.3 row still reads
  "49/49" — that is the dated verify-column of that task; the progress row reconciles it.
- Commit `3310bb4` (local only, no push per instruction): 7 files, 645 insertions.
