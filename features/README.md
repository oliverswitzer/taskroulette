# Cucumber / Gherkin BDD Spec

This directory contains Given/When/Then feature specs describing TaskRoulette's
behavior in plain language, derived from `PRODUCT.md`, `src/App.tsx`'s state
machine, `src/types.ts`, `src/constants.ts`, and the existing Playwright E2E
suite (`tests/e2e/*.spec.ts`).

**Status: spec only.** These `.feature` files are documentation of expected
behavior — no step definitions or Cucumber runner have been wired up yet, and
none of this is executed in CI. Nothing here changes app behavior.

## Files

| Feature file | Covers |
|---|---|
| `brain_dump.feature` | DUMP screen: text/photo input, Claude parse, session limits, email gate |
| `list_edit.feature` | LIST_EDIT screen: add/edit/delete tasks, 15-task cap, proceeding to wheel |
| `wheel_spin.feature` | WHEEL_IDLE/WHEEL_SPINNING: rendering, tap-to-spin, swipe physics, reduced motion |
| `task_card.feature` | TASK_CARD: complete/skip, auto-advance to last task, spin-again |
| `all_done.feature` | ALL_DONE: completed count, motivational messaging, confetti, start fresh |
| `state_persistence.feature` | localStorage restore rules, transient-state sanitization, back-button nav |
| `accessibility.feature` | WCAG AA touch target size, contrast, reduced motion |

## Next step (not part of this PR)

Wire these up with a step-definition layer (e.g. `@cucumber/cucumber` +
Playwright, or `pytest-bdd`-style if a Python runner is preferred) and back
each `Given/When/Then` with real assertions against the existing
`data-testid` hooks already used by the Playwright suite.
