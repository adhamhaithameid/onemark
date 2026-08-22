# ADR-0002 — Wrap an existing parser behind our own interface

**Status:** Accepted · **Date:** 2026-08-16

## Context

Two stated goals collided: **learn systems work deeply** (which argues for writing a parser) and **ship** (which argues for using one). CommonMark is roughly 650 spec cases of edge-case handling; GFM adds more. A from-scratch parser would take months and would be less faithful than GitHub's for a long time — directly undermining ADR-0001.

Meanwhile GitHub's actual engine (`cmark-gfm`) and a compliant Rust port (`comrak`) are both open source and permissively licensed.

## Decision

Wrap an existing parser, **behind a `MarkdownEngine` interface owned by this project**. The interface — not the library — is the contract.

The interface deliberately exposes **only** `parse(source, options) → AST`. It knows nothing about HTML, themes, highlighting or diagrams.

## Alternatives rejected

| Option | Why rejected |
|---|---|
| Write a parser from scratch now | Months of work; worse fidelity than the thing being copied; blocks shipping indefinitely. |
| Write from scratch, validated against the spec suites | Same cost. Genuinely good for a portfolio, but goal ranking put shipping first. |
| Use a library directly, no interface | Saves a day, costs a rewrite. Also incompatible with the dialect-profile ambition (ADR-0008) and a future native app (ADR-0005). |

## Consequences

**Good:** ships immediately with maximum fidelity. The learning goal is preserved as a *later* option — a from-scratch parser can be swapped in behind the same interface, with a working reference implementation to diff against. That is a strictly better way to learn parsing than starting blind.

**Bad / accepted cost:** the deep-parsing learning is deferred, possibly forever. The interface is a small ongoing tax — every engine feature must be expressed in our own AST rather than passed through.

**Reversibility:** high, by design. Swapping the engine is exactly what the interface exists to permit.
