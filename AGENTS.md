# Start here (for any coding agent)

This project is called Tempo. Read these in order before changing anything:
1. CLAUDE.md : what the project is, the rules you must not break, and the commands to run tests.
2. HANDOFF.md : the newest block at the top says what was done last and what is untested.
3. ROADMAP.md and docs/FIRST_ISSUES.md : what to do next.

The rules in CLAUDE.md apply to every agent, not only Claude:
- Video never leaves the browser. Never commit participant data (CSV exports, artifacts) or secrets.
- Run the tests before you say a change works, and say plainly what you did not test.
- One change per branch. Update HANDOFF.md (newest block first) when behaviour changes.
