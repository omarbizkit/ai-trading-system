<!--
Sync Impact Report:
- Version change: Template → 1.0.0 (initial constitution creation)
- Modified principles: All 5 principles extracted from context/constitution.md
- Added sections: Deployment & Infrastructure, Testing & Maintenance, Build & Deployment Configuration, Git Workflow, AI Development Safety Protocol
- Removed sections: None (template sections were placeholders)
- Templates requiring updates:
  ✅ plan-template.md: Constitution check reference updated
  ✅ spec-template.md: Requirements alignment maintained
  ✅ tasks-template.md: Task categorization aligns with principles
- Follow-up TODOs: None - all placeholders resolved
-->

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
- Use proper environment variable management for sensitive keys.
- Set up monitoring and error tracking capabilities.
- Configure proper redirects for domain handling.
- Ensure build output is compatible with Zeabur's static site hosting.

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

## Build & Deployment Configuration

- **Supabase Database Schema**: All tables specific to this project must be prefixed with `trading_` to avoid conflicts with other projects using the shared Supabase instance.
- Use the Node.js LTS version for consistency.
- **Development Scripts**: Configure standard scripts for development, build, preview, and containerized testing.
- Output directory: `dist/` (Astro default).
- Static site configuration optimized for Zeabur deployment.
- Environment variables prefix: `PUBLIC_` for client-side, no prefix for server-side.
- Ensure all assets use relative paths for subdomain compatibility.
- Configure the proper `base` URL for production deployment.
- Use a multi-stage Dockerfile to minimize the final image size.
- Use Alpine Linux for production containers when possible.
- Include a README with clear instructions for all three testing/deployment tiers.

## AI Development Safety Protocol

**CRITICAL**: To prevent system corruption during AI-assisted development sessions:

### Pre-Session Safeguards
- **Backup configurations** before any AI debugging session.
- **Document current terminal state**: Note any running processes.

### During AI Sessions
- **NEVER allow global configuration changes** without explicit understanding.
- **Demand explanation** for any system-level commands before execution.
- **Monitor for stuck processes**: Check for background processes after each complex command.
- **Verify command cleanup**: Ensure AI models properly clean up temporary configurations.

### Post-Session Verification
- **Check for configuration drift** and validate git pager settings.
- **Test terminal functionality** to verify no pager interference.
- **Clean up artifacts**: Remove any accidentally created files from command fragments.

### Prohibited AI Actions
- **NEVER allow AI to** set interactive pagers, modify shell initialization files, create persistent background processes, change system-wide environment variables, or modify terminal emulator configurations.

### Recovery Protocol
If system corruption occurs, kill rogue processes, reset git pager, disable specific pagers, restore configurations from backup files, and verify functionality with test commands.

## Governance

This constitution supersedes all other practices and must be followed for all specs, plans, and tasks related to the `ai-trading-system` project. All development work must verify compliance with these constraints. Any amendments require documentation and approval.

Constitution violations must be explicitly documented in the "Complexity Tracking" section of implementation plans with clear justification for why simpler alternatives are insufficient. The "Constitution Check" gate in plan templates must verify compliance before proceeding to design and implementation phases.

All PRs and reviews must verify compliance with these principles. Complexity must be justified against constitutional requirements. Use agent-specific guidance files (CLAUDE.md, GEMINI.md, etc.) for runtime development guidance while maintaining constitutional compliance.

**Version**: 1.0.0 | **Ratified**: 2025-09-22 | **Last Amended**: 2025-09-22