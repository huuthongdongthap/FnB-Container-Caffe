# BRIEFING — 2026-05-26T13:01:28+07:00

## Mission
Orchestrate and execute the 'Bazi-aligned Aura Cafe UI Overhaul' project to upgrade UI/UX, align colors and fonts with Bazi requirements, and remove all forbidden elements across 11 pages.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator
- Original parent: Project Sentinel
- Original parent conversation ID: 9e092701-a014-4ddc-8aad-bcbd97489990

## 🔒 My Workflow
- **Pattern**: Project Pattern (Orchestrator-driven Explorer → Worker → Reviewer → gate cycle)
- **Scope document**: /Users/mac/mekong-cli/FnB-Container-Caffe/PROJECT.md
1. **Decompose**: Split the project into distinct milestones (Audit & Setup, Brand CSS & Tokens, UI Premium & Glassmorphism, Water Ripple Hero Animation, Final E2E Verification).
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Spawn Explorer to analyze and propose strategy, Worker to implement changes and verify, Reviewer to review and test.
   - **Delegate (sub-orchestrator)**: Spawn a sub-orchestrator if milestones are too complex to fit a single cycle.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 cumulative spawns. Write handoff.md, spawn successor, and exit.
- **Work items**:
  1. Initialize Project & Milestones [done]
  2. Perform Bazi UI Audit [done]
  3. Update Brand Tokens & Typography v5.0 [done]
  4. Perform Premium UI & Glassmorphism Overhaul [done]
  5. Refactor Hero Water Ripple Animation [done]
  6. E2E Validation & Adversarial Testing [done]
  7. Optimize FOUT & Layout Shift (v5.1) [in-progress]
  8. Brand Guideline Uniformity (v5.1) [in-progress]
  9. Clean up Admin Dashboard Color Leak (v5.1) [in-progress]
  10. Final E2E and Forensic Audit (v5.1) [pending]
- **Current phase**: 6
- **Current focus**: Audit & plan Bazi v5.1 sprint requirements

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- Gold, Red, Orange, Brown (Fire & Earth) colors are absolutely prohibited.
- Fonts Cormorant Garamond, Space Grotesk, JetBrains Mono are mandatory. Fonts Playfair Display, Cinzel, Manrope, Inter are banned.
- Minh Tu reference must be decoupled, role of Mộc Zone becomes natural feng shui.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 9e092701-a014-4ddc-8aad-bcbd97489990
- Updated: yes

## Key Decisions Made
- Chose Project Pattern with milestone-by-milestone iteration.
- Initial plan has 5 core milestones.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| Explorer 1 | teamwork_preview_explorer | Codebase Audit Explorer 1 | completed | 5358b50d-2667-4042-8ae2-a44409bbc564 |
| Explorer 2 | teamwork_preview_explorer | Codebase Audit Explorer 2 | completed | c43840b3-511a-4911-961b-07facefcbd34 |
| Explorer 3 | teamwork_preview_explorer | Codebase Audit Explorer 3 | completed | eecf5204-4ebd-4b80-bcd0-d407a64408f0 |
| Worker 1 | self | UI & Animation Implementation Worker | completed | 32a7e613-2daa-4154-b819-9b14a7552900 |
| Reviewer 1 | teamwork_preview_reviewer | Code Reviewer & Quality Auditor 1 | completed | 2f397835-2078-4dc9-89f2-1ee6b6c6c775 |
| Reviewer 2 | teamwork_preview_reviewer | Code Reviewer & Quality Auditor 2 | completed | 9a1bfc3b-3f07-4acb-a64f-ae08914091d2 |
| Explorer 4 | teamwork_preview_explorer | Codebase Audit Explorer (Bazi v5.1) | completed | 9a297f96-22a5-41af-acbe-0d4e50b26e9b |
| Worker 2 | self | Bazi v5.1 UI/UX Implementation Worker | completed | bd478887-848a-4e71-b24f-358aca06373c |
| Reviewer 3 | teamwork_preview_reviewer | Code Reviewer & Quality Auditor 3 | in-progress | 35183c9f-5551-4a1c-94e4-691e02a2fca7 |
| Reviewer 4 | teamwork_preview_reviewer | Code Reviewer & Quality Auditor 4 | in-progress | 69347583-58fc-4b79-9c5a-11719be47e54 |
| Worker 3 | self | Bazi v5.1 UI/UX Polish Worker | in-progress | 2386f31a-18d3-4068-9ad0-9564c78f7e69 |

## Succession Status
- Succession required: no
- Spawn count: 11 / 16
- Pending subagents: [35183c9f-5551-4a1c-94e4-691e02a2fca7, 69347583-58fc-4b79-9c5a-11719be47e54, 2386f31a-18d3-4068-9ad0-9564c78f7e69]
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-39
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- /Users/mac/mekong-cli/FnB-Container-Caffe/ORIGINAL_REQUEST.md — Original User Request
- /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator/original_prompt.md — Copy of dispatch prompt
- /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator/BRIEFING.md — My working memory
