---
name: lokacia-work-loop
description: The lokacia.ge delivery loop — pick roadmap tasks, implement against PRODUCT.md acceptance criteria, test, tick ROADMAP checkboxes, record decisions/human todos, commit. Use when continuing the project or starting a roadmap phase.
---

# Work loop

1. Read `CLAUDE.md`, `docs/ROADMAP.md` (progress), `docs/CHANGELOG.md`, `docs/DECISIONS.md`.
2. Take the first unchecked task (or the phase you were assigned). Map it to PRODUCT.md feature ids (P#, C#, V#) and their acceptance criteria.
3. Implement: API (skill `lokacia-api-module`) → UI (skill `lokacia-web-page`) → copy (skill `lokacia-georgian-copy`).
4. Every AC gets a test (API integration in `apps/api/test`, unit in packages, e2e for key flows).
5. Checks: `npx tsc --noEmit` for touched packages, tests green, page verified in browser (skill `lokacia-run-and-verify`).
6. Tick `[x]` in `docs/ROADMAP.md` only when done and tested. Never delete roadmap text.
7. Unspecified choices → simplest option that fits ARCHITECTURE.md, one line in `docs/DECISIONS.md` (date — decision — why).
8. Needs a human (keys, contracts, legal text) → adapter + working mock, env var in `.env.example`, row in `docs/HUMAN_TODO.md`.
9. Commit `feat(<module>): <what>` with the Co-Authored-By trailer.
10. End of phase: 5–10 lines in `docs/CHANGELOG.md`.

When several agents work in parallel: stay inside your assigned directories, own your messages namespace files, never run `db:reset`/`db:seed` against the shared `lokacia` DB, use your own `TEST_DATABASE_URL`, and don't revert others' changes.
