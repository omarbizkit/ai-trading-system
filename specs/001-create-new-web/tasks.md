# Tasks: AI Trading System Web Application

**Input**: Design documents from `/home/omarb/dev/projects/ai-trading-system/specs/001-create-new-web/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Astro, TypeScript, TailwindCSS, Supabase, TensorFlow.js
   → Structure: Astro web application with src/ directory
2. Load optional design documents ✓
   → data-model.md: 5 entities (trading_users, trading_runs, trading_trades, market_data, ai_predictions)
   → contracts/: 12 API endpoints in trading-api.yml
   → research.md: Technical decisions for ML inference, charts, auth
3. Generate tasks by category ✓
   → Setup: Astro project, dependencies, database
   → Tests: contract tests, integration tests per quickstart scenarios
   → Core: models, services, components, API endpoints
   → Integration: Supabase, auth, ML inference, charts
   → Polish: unit tests, performance, deployment
4. Apply task rules ✓
   → [P] for different files, sequential for same file
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
   → All contracts have tests ✓
   → All entities have models ✓
   → All endpoints implemented ✓
9. Return: SUCCESS (tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Astro web app**: `src/` at repository root containing pages/, components/, layouts/, services/
- All paths relative to `/home/omarb/dev/projects/ai-trading-system/`

## Phase 3.1: Setup

- [x] **T001** Create Astro project structure in repository root with TypeScript configuration
- [x] **T002** Initialize package.json with Astro, TailwindCSS, Supabase client, TensorFlow.js dependencies
- [x] **T003** [P] Configure ESLint and Prettier for TypeScript/Astro in `.eslintrc.js` and `.prettierrc`
- [x] **T004** [P] Setup TailwindCSS configuration in `tailwind.config.mjs` with cyberpunk theme colors
- [x] **T005** [P] Configure Astro config in `astro.config.mjs` for SSR, TailwindCSS integration
- [x] **T006** [P] Setup environment variables in `.env.example` for Supabase and CoinGecko API
- [x] **T007** [P] Configure Playwright testing setup in `playwright.config.ts`
- [x] **T008** Create Supabase database migration for trading tables in `supabase/migrations/001_trading_tables.sql`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [x] **T009** [P] Contract test GET /api/user/profile in `tests/contract/user-profile-get.test.ts`
- [x] **T010** [P] Contract test PUT /api/user/profile in `tests/contract/user-profile-put.test.ts`
- [x] **T011** [P] Contract test GET /api/runs in `tests/contract/runs-get.test.ts`
- [x] **T012** [P] Contract test POST /api/runs in `tests/contract/runs-post.test.ts`
- [x] **T013** [P] Contract test GET /api/runs/{runId} in `tests/contract/runs-get-id.test.ts`
- [x] **T014** [P] Contract test PATCH /api/runs/{runId} in `tests/contract/runs-patch.test.ts`
- [x] **T015** [P] Contract test GET /api/runs/{runId}/trades in `tests/contract/trades-get.test.ts`
- [x] **T016** [P] Contract test POST /api/runs/{runId}/trades in `tests/contract/trades-post.test.ts`
- [x] **T017** [P] Contract test GET /api/market/{coinSymbol} in `tests/contract/market-get.test.ts`
- [x] **T018** [P] Contract test GET /api/market/{coinSymbol}/history in `tests/contract/market-history.test.ts`
- [x] **T019** [P] Contract test GET /api/predictions/{coinSymbol} in `tests/contract/predictions-get.test.ts`
- [x] **T020** [P] Contract test POST /api/backtest in `tests/contract/backtest-post.test.ts`

### Integration Tests (User Scenarios)
- [x] **T021** [P] Integration test guest user simulation flow in `tests/integration/guest-simulation.test.ts`
- [x] **T022** [P] Integration test authenticated backtesting flow in `tests/integration/auth-backtest.test.ts`
- [x] **T023** [P] Integration test real-time simulation dashboard in `tests/integration/realtime-dashboard.test.ts`
- [x] **T024** [P] Integration test risk management protocols in `tests/integration/risk-management.test.ts`
- [x] **T025** [P] Integration test cross-domain SSO navigation in `tests/integration/cross-domain-sso.test.ts`
- [x] **T026** [P] Integration test mobile responsiveness in `tests/integration/mobile-responsive.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Types
- [x] **T027** [P] TradingUser model and types in `src/lib/types/trading-user.ts`
- [x] **T028** [P] TradingRun model and types in `src/lib/types/trading-run.ts`
- [x] **T029** [P] Trade model and types in `src/lib/types/trade.ts`
- [x] **T030** [P] MarketData model and types in `src/lib/types/market-data.ts`
- [x] **T031** [P] AIPrediction model and types in `src/lib/types/ai-prediction.ts`

### Services Layer
- [x] **T032** [P] Supabase client configuration in `src/lib/supabase.ts`
- [x] **T033** [P] TradingUserService CRUD operations in `src/lib/services/trading-user.service.ts`
- [x] **T034** [P] TradingRunService CRUD operations in `src/lib/services/trading-run.service.ts`
- [x] **T035** [P] TradeService CRUD operations in `src/lib/services/trade.service.ts`
- [x] **T036** [P] MarketDataService with CoinGecko integration in `src/lib/services/market-data.service.ts`
- [x] **T037** [P] AIPredictionService with TensorFlow.js in `src/lib/services/ai-prediction.service.ts`
- [x] **T038** [P] BacktestingService with Web Worker in `src/lib/services/backtesting.service.ts`

### API Endpoints (Astro API Routes)
- [ ] **T039** GET /api/user/profile endpoint in `src/pages/api/user/profile.ts`
- [ ] **T040** PUT /api/user/profile endpoint in `src/pages/api/user/profile.ts`
- [ ] **T041** GET /api/runs endpoint in `src/pages/api/runs.ts`
- [ ] **T042** POST /api/runs endpoint in `src/pages/api/runs.ts`
- [ ] **T043** GET /api/runs/[runId].ts endpoint for run details
- [ ] **T044** PATCH /api/runs/[runId].ts endpoint for run updates
- [ ] **T045** GET /api/runs/[runId]/trades.ts endpoint for trades list
- [ ] **T046** POST /api/runs/[runId]/trades.ts endpoint for trade execution
- [ ] **T047** GET /api/market/[coinSymbol].ts endpoint for current market data
- [ ] **T048** GET /api/market/[coinSymbol]/history.ts endpoint for historical data
- [ ] **T049** GET /api/predictions/[coinSymbol].ts endpoint for AI predictions
- [ ] **T050** POST /api/backtest.ts endpoint for backtesting

### Core Components
- [ ] **T051** [P] Layout component with cyberpunk theme in `src/layouts/Layout.astro`
- [ ] **T052** [P] Navigation component with portfolio link in `src/components/Navigation.astro`
- [ ] **T053** [P] TradingChart component with Lightweight Charts in `src/components/TradingChart.astro`
- [ ] **T054** [P] TradeLog component for transaction history in `src/components/TradeLog.astro`
- [ ] **T055** [P] PortfolioMetrics component for performance display in `src/components/PortfolioMetrics.astro`
- [ ] **T056** [P] AIPrediction component for ML signals in `src/components/AIPrediction.astro`
- [ ] **T057** [P] SimulationControls component for trade execution in `src/components/SimulationControls.astro`
- [ ] **T058** [P] BacktestingForm component for historical testing in `src/components/BacktestingForm.astro`

### Pages
- [ ] **T059** Home page with simulation start in `src/pages/index.astro`
- [ ] **T060** Simulation dashboard page in `src/pages/simulation.astro`
- [ ] **T061** Backtesting page in `src/pages/backtesting.astro`
- [ ] **T062** Trading history page in `src/pages/history.astro`
- [ ] **T063** User profile/settings page in `src/pages/profile.astro`

## Phase 3.4: Integration

### Authentication & State Management
- [ ] **T064** Supabase Auth integration with SSO configuration in `src/lib/auth.ts`
- [ ] **T065** Auth middleware for protected routes in `src/middleware.ts`
- [ ] **T066** Client-side state management for trading session in `src/lib/stores/trading-store.ts`
- [ ] **T067** Real-time price updates with polling mechanism in `src/lib/services/price-monitor.service.ts`

### ML & External Services
- [ ] **T068** TensorFlow.js model loading and inference in `src/lib/ml/model-loader.ts`
- [ ] **T069** CoinGecko API rate limiting and caching in `src/lib/services/coingecko.service.ts`
- [ ] **T070** Web Worker for backtesting computations in `src/workers/backtest-worker.ts`
- [ ] **T071** Error handling and retry logic for external APIs in `src/lib/utils/error-handler.ts`

### UI/UX Integration
- [ ] **T072** Responsive design implementation across all components
- [ ] **T073** Neon cyberpunk theme with CSS custom properties in `src/styles/theme.css`
- [ ] **T074** Loading states and skeleton components in `src/components/ui/LoadingStates.astro`
- [ ] **T075** Toast notifications for trade confirmations in `src/components/ui/Toast.astro`
- [ ] **T076** Constitutional compliance - "Coming Soon" labels for real trading features in `src/components/ui/ComingSoon.astro`

## Phase 3.5: Polish

### Testing & Quality
- [ ] **T077** [P] Unit tests for TradingUserService in `tests/unit/trading-user.service.test.ts`
- [ ] **T078** [P] Unit tests for AI prediction accuracy in `tests/unit/ai-prediction.test.ts`
- [ ] **T079** [P] Unit tests for backtesting calculations in `tests/unit/backtesting.test.ts`
- [ ] **T080** [P] Unit tests for risk management logic in `tests/unit/risk-management.test.ts`
- [ ] **T081** Performance tests for page load times (<2s target) in `tests/performance/load-times.test.ts`
- [ ] **T082** Performance tests for chart rendering in `tests/performance/chart-performance.test.ts`

### Documentation & Deployment
- [ ] **T083** [P] API documentation generation from OpenAPI spec in `docs/api.md`
- [ ] **T084** [P] User guide for simulation and backtesting in `docs/user-guide.md`
- [ ] **T085** [P] Deployment configuration for Zeabur in `Dockerfile` and docker-compose
- [ ] **T086** [P] CI/CD pipeline configuration in `.github/workflows/deploy.yml`
- [ ] **T087** Environment-specific configurations for dev/staging/prod
- [ ] **T088** Run quickstart test scenarios validation from `quickstart.md`

## Dependencies

### Critical Path Dependencies
- **Setup** (T001-T008) blocks everything else
- **Tests** (T009-T026) must complete before implementation (T027-T063)
- **Models** (T027-T031) block Services (T032-T038)
- **Services** (T032-T038) block API Endpoints (T039-T050)
- **Core Components** (T051-T058) depend on Services
- **Pages** (T059-T063) depend on Components
- **Integration** (T064-T076) requires Core Implementation complete
- **Polish** (T077-T088) requires Integration complete

### Specific Blockers
- T032 (Supabase client) blocks T033-T038 (all services)
- T027-T031 (models) block corresponding services
- T039-T050 (API endpoints) depend on T032-T038 (services)
- T064 (auth) blocks T065 (middleware) and T063 (profile page)
- T068 (ML model) blocks T037 (AIPredictionService) and T049 (predictions API)

## Parallel Execution Examples

### Setup Phase (T001-T008)
```bash
# Can run T003-T007 in parallel after T001-T002:
Task: "Configure ESLint and Prettier for TypeScript/Astro in .eslintrc.js and .prettierrc"
Task: "Setup TailwindCSS configuration in tailwind.config.mjs with cyberpunk theme colors"
Task: "Configure Astro config in astro.config.mjs for SSR, TailwindCSS integration"
Task: "Setup environment variables in .env.example for Supabase and CoinGecko API"
Task: "Configure Playwright testing setup in playwright.config.ts"
```

### Contract Tests Phase (T009-T020)
```bash
# All contract tests can run in parallel:
Task: "Contract test GET /api/user/profile in tests/contract/user-profile-get.test.ts"
Task: "Contract test PUT /api/user/profile in tests/contract/user-profile-put.test.ts"
Task: "Contract test GET /api/runs in tests/contract/runs-get.test.ts"
Task: "Contract test POST /api/runs in tests/contract/runs-post.test.ts"
# ... (all T009-T020)
```

### Integration Tests Phase (T021-T026)
```bash
# All integration tests can run in parallel:
Task: "Integration test guest user simulation flow in tests/integration/guest-simulation.test.ts"
Task: "Integration test authenticated backtesting flow in tests/integration/auth-backtest.test.ts"
Task: "Integration test real-time simulation dashboard in tests/integration/realtime-dashboard.test.ts"
Task: "Integration test risk management protocols in tests/integration/risk-management.test.ts"
Task: "Integration test cross-domain SSO navigation in tests/integration/cross-domain-sso.test.ts"
Task: "Integration test mobile responsiveness in tests/integration/mobile-responsive.test.ts"
```

### Models Phase (T027-T031)
```bash
# All model definitions can run in parallel:
Task: "TradingUser model and types in src/lib/types/trading-user.ts"
Task: "TradingRun model and types in src/lib/types/trading-run.ts"
Task: "Trade model and types in src/lib/types/trade.ts"
Task: "MarketData model and types in src/lib/types/market-data.ts"
Task: "AIPrediction model and types in src/lib/types/ai-prediction.ts"
```

### Services Phase (T032-T038)
```bash
# After T032 (Supabase client), services can run in parallel:
Task: "TradingUserService CRUD operations in src/lib/services/trading-user.service.ts"
Task: "TradingRunService CRUD operations in src/lib/services/trading-run.service.ts"
Task: "TradeService CRUD operations in src/lib/services/trade.service.ts"
Task: "MarketDataService with CoinGecko integration in src/lib/services/market-data.service.ts"
Task: "AIPredictionService with TensorFlow.js in src/lib/services/ai-prediction.service.ts"
Task: "BacktestingService with Web Worker in src/lib/services/backtesting.service.ts"
```

### Components Phase (T051-T058)
```bash
# Core components can run in parallel:
Task: "Layout component with cyberpunk theme in src/layouts/Layout.astro"
Task: "Navigation component with portfolio link in src/components/Navigation.astro"
Task: "TradingChart component with Lightweight Charts in src/components/TradingChart.astro"
Task: "TradeLog component for transaction history in src/components/TradeLog.astro"
Task: "PortfolioMetrics component for performance display in src/components/PortfolioMetrics.astro"
Task: "AIPrediction component for ML signals in src/components/AIPrediction.astro"
Task: "SimulationControls component for trade execution in src/components/SimulationControls.astro"
Task: "BacktestingForm component for historical testing in src/components/BacktestingForm.astro"
```

## Notes
- **[P] tasks** = different files, no dependencies between them
- **Verify tests fail** before implementing (TDD approach)
- **Commit after each task** for proper version control
- **API endpoints** (T039-T050) modify same files, so no [P] marking
- **Pages** (T059-T063) depend on components but are in different files
- **Total estimated tasks**: 88 tasks organized in 5 phases

## Task Generation Rules Applied

### From Contracts (trading-api.yml)
✅ **12 endpoints** → 12 contract test tasks (T009-T020) [P]
✅ **12 endpoints** → 12 implementation tasks (T039-T050)

### From Data Model (data-model.md)
✅ **5 entities** → 5 model creation tasks (T027-T031) [P]
✅ **5 entities** → 5 service layer tasks (T033-T037) [P]

### From User Stories (quickstart.md)
✅ **6 scenarios** → 6 integration test tasks (T021-T026) [P]
✅ **6 scenarios** → validation in final task (T087)

### Ordering Applied
✅ **Setup** → Tests → Models → Services → Endpoints → Components → Pages → Integration → Polish
✅ **Dependencies respected**: Models before Services, Services before Endpoints, etc.

## Validation Checklist Passed ✅

- [x] All contracts have corresponding tests (T009-T020 cover T039-T050)
- [x] All entities have model tasks (T027-T031 for 5 entities)
- [x] All tests come before implementation (T009-T026 before T027+)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path (all tasks include specific paths)
- [x] No task modifies same file as another [P] task (verified file paths)