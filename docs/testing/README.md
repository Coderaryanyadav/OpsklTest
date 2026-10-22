# Testing evidence

Start here:

- [Docker test environment](./DOCKER_TEST_ENVIRONMENT.md) — architecture,
  isolation, fixtures, build/runtime design.
- [End-to-end workflow matrix](./E2E_WORKFLOW_TEST_MATRIX.md) — what was
  executed, with counts and evidence.
- [Test run report](./TEST_RUN_REPORT.md) — commands, exit codes, results,
  PASS/PARTIAL/BLOCKED classification.
- [Defects found and fixed](./BUGS_FOUND_AND_FIXED.md) — product vs harness
  defects, including the migration collision.
- [Remaining blockers](./REMAINING_BLOCKERS.md) — native, provider, production,
  and coverage limits.

The one-command entry point is:

```bash
./docker/scripts/run-e2e-tests.sh
```

Generated evidence is written to the gitignored `test-artifacts/docker/`
directory. The Docker setup is documented in `docker/README.md`.
