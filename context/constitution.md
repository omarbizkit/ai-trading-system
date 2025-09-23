# AI Trading System Constitution

## Core Principles

### Showcase-First
The primary goal of this project is to be a high-quality showcase of full-stack and AI/ML development skills for the bizkit.dev portfolio. Every feature, design choice, and technical implementation must prioritize clarity, polish, and demonstrability.

### Cost-Effective Deployment
The entire system must be deployable and operable within the free tiers of Zeabur and Supabase. This constrains resource usage and requires efficient implementation of data storage, API calls, and compute resources.

### Test-Driven (Portfolio-Appropriate)
TDD is mandatory for critical user flows, but testing will be scoped appropriately for a portfolio project. The focus is on ensuring core functionality (simulation, backtesting, SSO) is robust and reliable, rather than achieving enterprise-level test coverage.

### Modular & Reusable
The system will be built with modularity in mind, with a clear separation between the frontend (Astro), backend (Supabase), and AI/ML components. Shared UI elements and authentication logic should be reusable across other bizkit.dev subdomains.

### Simplicity & Maintainability
The codebase will be kept simple, readable, and well-documented. YAGNI (You Ain't Gonna Need It) principles will be applied to avoid over-engineering and ensure the project is easy to maintain and understand.

## Deployment & Infrastructure

- **Quick Testing**: Use Vite for rapid local development with hot module replacement (HMR).
- **Robust Testing**: Use Podman for containerized testing to validate the production-like environment locally.
- **Production**: Deploy to Zeabur for production hosting at `ai-trading.bizkit.dev`.
- Include a Dockerfile and `docker-compose.yml` for containerized deployment and testing.
- Set up automatic deployments from the `main` branch via Zeabur's Git integration.
- Implement preview deployments for pull requests.
- Use proper environment variable management:
  - `.env.local` for Vite quick testing.
  - Container environment files for Podman testing.
  - Zeabur environment variables for production (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `COINGECKO_API_KEY`).
- Set up monitoring and error tracking (e.g., Sentry or a simpler alternative).
- Configure proper redirects for `www` and non-`www` domains if necessary.
- Ensure the build output is compatible with Zeabur's static site hosting.

## Testing & Maintenance

- **Testing Workflow**:
  1. Quick iterations: Use the Vite dev server for immediate feedback.
  2. Pre-deployment validation: Use Podman to test the full containerized build locally.
  3. Final verification: Test on Zeabur staging/preview before production release.
- Write integration tests for critical user flows (authentication, project navigation, running a simulation).
- Test responsive design on actual devices, not just browser dev tools.
- Regularly update dependencies for security patches.
- Test the site with slow network conditions.
- Verify all external links periodically.
- Backup project data regularly.
- Document any custom configurations or deployment steps.
- Always validate container builds with Podman before pushing to production.
- Verify environment variables work correctly in each environment (Vite, Podman, Zeabur).

## E2E Testing Standards (Portfolio-Appropriate)

- **Scope**: Test only core user journeys (max 6 tests):
  - Homepage display and initial state.
  - Running a backtest simulation and verifying the output.
  - Cross-domain SSO login flow.
  - Mobile responsive design for the main dashboard.
  - 404 error handling.
- **Browsers**: Single browser (Chromium) for simplicity and reliability.
- **Coverage**: Basic functionality validation only.
- **Performance**: Simple load time checks (< 3 seconds per test).
- **Maintenance**: Keep tests simple, readable, and maintainable.
- **Execution Time**: The total E2E suite should complete in under 30 seconds.
- **Reliability**: Focus on stable, non-flaky tests.

## Build & Deployment Configuration

- **Supabase Database Schema**:
  - All tables specific to this project must be prefixed with `trading_` to avoid conflicts with other projects using the shared Supabase instance.
- Use the Node.js LTS version for consistency.
- **Development Scripts**:
  - `npm run dev` or `pnpm dev` - Quick testing with Vite.
  - `npm run build` or `pnpm build` - Production build.
  - `npm run preview` or `pnpm preview` - Preview production build locally.
  - `podman-compose up` - Robust local testing in containers.
- Output directory: `dist/` (Astro default).
- Static site configuration optimized for Zeabur deployment.
- Environment variables prefix: `PUBLIC_` for client-side, no prefix for server-side.
- Ensure all assets use relative paths for subdomain compatibility.
- Configure the proper `base` URL for production deployment.
- Use a multi-stage Dockerfile to minimize the final image size.
- Use Alpine Linux for production containers when possible.
- Include a README with clear instructions for all three testing/deployment tiers.

## Git Workflow (Solo Development)

- Use feature branches for new features and major changes.
- Direct commits to the `main` branch are allowed for minor fixes and updates.
- Self-review and merge own pull requests.
- Use descriptive commit messages following the conventional commits format (e.g., `feat:`, `fix:`, `docs:`).
- Tag releases with semantic versioning (e.g., `v1.0.0`).
- Keep the `main` branch deployable at all times.
- Use `.gitignore` to exclude: `node_modules/`, `.env` files, build outputs.
- Commit frequently with atomic changes.
- Push to the remote at least once per development session.

## AI Development Safety Protocol

**CRITICAL**: To prevent system corruption during AI-assisted development sessions:

#### Pre-Session Safeguards
- **Backup configurations** before any AI debugging session:
  ```bash
  git config --list > ~/git-config-backup.txt
  env | grep -E "PAGER|LESS|EDITOR" > ~/env-backup.txt
  alias > ~/alias-backup.txt
  ```
- **Document current terminal state**: Note any running processes with `ps aux | grep -E "pager|less|editor"`

#### During AI Sessions
- **NEVER allow global configuration changes** without explicit understanding:
  - `git config --global` commands must be explained and approved.
  - Changes to `~/.bashrc`, `~/.zshrc`, `~/.profile` must be documented.
  - Environment variable exports must be temporary or explicitly documented.
  - Pager/editor configurations require immediate verification.
- **Demand explanation** for any system-level commands before execution.
- **Monitor for stuck processes**: Check for background processes after each complex command.
- **Verify command cleanup**: Ensure AI models properly clean up temporary configurations.

#### Post-Session Verification
- **Check for configuration drift**:
  ```bash
  git config --list | diff ~/git-config-backup.txt -
  env | grep -E "PAGER|LESS|EDITOR" | diff ~/env-backup.txt -
  ps aux | grep -E "pager|less|editor" | grep -v grep
  ```
- **Validate git pager settings**: Ensure `git config --get core.pager` returns `cat` or empty.
- **Test terminal functionality**: Run `git log --oneline -3` to verify no pager interference.
- **Clean up artifacts**: Remove any accidentally created files from command fragments.

#### Prohibited AI Actions
- **NEVER allow AI to**:
  - Set the global git pager to `less` or any interactive pager.
  - Modify shell initialization files without explicit approval.
  - Create system-level persistent background processes (daemons, system services).
  - Change system-wide environment variables.
  - Modify terminal emulator configurations.

#### Approval Required Actions
- **REQUIRE explicit approval before AI can**:
  - Create background processes that persist beyond the current terminal session.
  - Start services that intercept or redirect system output (stdout/stderr).
  - Modify process management or terminal state.
  - Install or configure system-level services.
  - Create processes that run with elevated privileges.

#### Permitted Development Processes
- **AI can freely start these legitimate development processes**:
  - Development servers (`npm run dev`, `vite dev`, `astro dev`).
  - Test watchers (`npm run test:watch`, `vitest --watch`).
  - Build processes (`npm run build`, Docker builds).
  - Local development databases (Docker containers, local Supabase).
  - IDE language servers and development tools.

#### Recovery Protocol
If system corruption occurs:
1. **Kill rogue processes**: `pkill -f "/usr/bin/pager"; pkill -f "less"`
2. **Reset git pager**: `git config --global core.pager "cat"`
3. **Disable specific pagers**: `git config --global pager.log false`
4. **Restore configurations** from backup files.
5. **Verify functionality** with test commands.

## Governance
This constitution supersedes all other practices and must be followed for all specs, plans, and tasks related to the `ai-trading-system` project. All development work must verify compliance with these constraints. Any amendments require documentation and approval.

**Version**: 1.0.0 | **Ratified**: 2025-09-22 | **Last Amended**: 2025-09-22
