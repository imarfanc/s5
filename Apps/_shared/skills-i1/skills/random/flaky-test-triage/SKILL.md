---
name: flaky-test-triage
description: Diagnose an intermittently failing test and decide whether to fix, quarantine, or delete it. Use when a test passes locally but fails in CI, fails only sometimes, or when the user mentions a flaky, intermittent, or "just rerun it" test.
---

# Flaky test triage

## Reproduce before theorizing

Run the test in a loop (`for i in $(seq 50); do ...; done`) and record the failure rate.
A test that fails 1 in 50 needs a different investigation than one that fails 1 in 2.

## The usual causes, in the order they show up

- **Shared state** between tests — a global, a temp directory, a database row a previous test left.
  Check by running the test alone and by running the suite in a different order.
- **Time** — sleeps standing in for synchronization, timezone-sensitive assertions, dates near
  midnight or a DST boundary.
- **Concurrency** — unawaited promises, missing cleanup, a port already bound.
- **Ordering assumptions** — asserting on the order of a map, a set, or an unsorted query.

## Deciding

Fix it if the flake reveals a real race — the test is doing its job badly but pointing at something
true. Quarantine with a linked issue and a deadline if you cannot fix it now. Delete it if it
asserts something no longer meaningful; a test nobody trusts is worse than no test, because it
trains people to rerun CI without reading it.
