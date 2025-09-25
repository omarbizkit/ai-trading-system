
# Implementation Plan: AI Trading System Web Application

**Branch**: `001-create-new-web` | **Date**: 2025-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/omarb/dev/projects/ai-trading-system/specs/001-create-new-web/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
AI-powered cryptocurrency trading simulator with real-time price prediction, backtesting capabilities, and seamless SSO integration with bizkit.dev portfolio. Built with Astro frontend, Supabase backend, TensorFlow.js for client-side ML inference, deployed on Zeabur free tier.

## Technical Context
**Language/Version**: TypeScript with Node.js 18+ (Astro framework requirement)
**Primary Dependencies**: Astro, TailwindCSS, Lightweight Charts, TensorFlow.js/ONNX Runtime Web, Supabase client
**Storage**: Supabase PostgreSQL with prefixed tables (trading_users, trading_trades, trading_runs)
**Testing**: Playwright for E2E testing, Vitest for unit testing
**Target Platform**: Web browsers (Chrome, Firefox, Safari), mobile responsive
**Project Type**: web - frontend + backend (Astro SSR + Supabase)
**Performance Goals**: <2s page load, 15-30s price data refresh, <500ms trade execution UI
**Constraints**: Zeabur free tier ($5/month), CoinGecko API limits (30 calls/min), client-side ML inference preferred
**Scale/Scope**: Portfolio showcase project, expected <1000 users, ~20 pages/components, 5-10 API endpoints

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Showcase-First Compliance**: ✅ High-quality UI with neon cyberpunk theme, interactive charts, polished user experience
**Cost-Effective Deployment**: ✅ Zeabur free tier deployment, Supabase free tier, CoinGecko free API
**Test-Driven Compliance**: ✅ Playwright E2E tests for critical flows (auth, simulation, backtesting)
**Modularity Compliance**: ✅ Separate components for trading logic, charts, auth, market data
**Simplicity Compliance**: ✅ Astro's convention over configuration, minimal complexity architecture
**Paper Trading Only Compliance**: ✅ All trading operations use simulated capital, no real money transactions, "Coming Soon" for real trading features

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Astro project with src/ directory containing components, pages, layouts, and services

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [x] Phase 3: Tasks generated (/tasks command)
- [x] Phase 4: Implementation ~85% complete (Pages phase done, Integration pending)
- [ ] Phase 5: Validation passed

**Implementation Progress**:
- [x] Phase 3.1: Setup (T001-T008) - Complete
- [x] Phase 3.2: Tests First (T009-T026) - Complete
- [x] Phase 3.3: Core Implementation (T027-T063) - Complete
  - [x] Database Models & Types (T027-T031)
  - [x] Services Layer (T032-T038)
  - [x] API Endpoints (T039-T050)
  - [x] Components (T051-T058)
  - [x] Pages (T059-T063) - All 5 pages implemented with cyberpunk theme
- [ ] Phase 3.4: Integration (T064-T076) - Ready to start
- [ ] Phase 3.5: Polish (T077+) - Pending

**Current Status**: Development environment stable, all frontend pages working with cyberpunk theme. API endpoints return expected errors (401/404/500) indicating need for integration layer implementation.

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] No complexity deviations requiring documentation

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
