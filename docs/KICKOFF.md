# How to run this with Claude Code

1. Create an empty folder, copy **CLAUDE.md**, **.env.example** and the **docs/** folder into it, `git init`.
2. `cp .env.example .env`
3. Start Claude Code in that folder and paste the prompts below.

## Prompt 1 — start (paste once)
```
Read CLAUDE.md and every file in docs/. Then start docs/ROADMAP.md from Phase 0.
Follow the work loop in CLAUDE.md exactly: plan the phase, implement task by task,
run lint/typecheck/tests after each task, tick the checkbox, commit.
When a phase is finished, run its "Done when" checks, update docs/CHANGELOG.md
and continue to the next phase. Anything needing a human goes to docs/HUMAN_TODO.md with a mock implementation.
```

## Prompt 2 — continue (every new session)
```
Read CLAUDE.md, then docs/ROADMAP.md and docs/CHANGELOG.md.
Continue from the first unchecked task. Same work loop.
```

## Prompt 3 — one phase only (for review between phases)
```
Read CLAUDE.md and docs/. Complete only Phase <N> of docs/ROADMAP.md, then stop and give me a summary
of what was built, how to test it manually, and what is in HUMAN_TODO.
```

## Prompt 4 — audit
```
Audit the repo against docs/PRODUCT.md. For every feature (P1–P24, C1–C24, V1–V10) report:
implemented / partial / missing, and where tests are missing. Fix partial items, then update ROADMAP.md.
```

Tips
- Plan mode for each new phase is useful; review the plan before letting it write code.
- One phase per session keeps context clean; the ROADMAP checkboxes carry progress between sessions.
- Keys to fill before real integrations: see `.env.example` and `docs/HUMAN_TODO.md`.
