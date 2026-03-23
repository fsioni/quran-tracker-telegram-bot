---
name: verify
description: Run tests and type-check to validate changes before marking work done
---

Run the following checks in sequence. Stop at the first failure and fix before continuing.

1. **Type-check**: `npx tsc --noEmit`
2. **Tests**: `pnpm test`

If snapshot tests fail because of intentional output changes, update them with `pnpm test -- -u` and re-run.

Report results: number of tests passed, any failures, and whether type-check was clean.
