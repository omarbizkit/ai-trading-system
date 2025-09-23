# Research: AI Trading System Technical Decisions

## ML Inference Architecture

**Decision**: Client-side inference using TensorFlow.js with ONNX Runtime Web fallback

**Rationale**:
- Reduces server costs (critical for free tier deployment)
- Eliminates inference API rate limits and latency
- Better user experience with instant predictions
- Showcases modern web ML capabilities

**Alternatives Considered**:
- Server-side inference via Supabase Edge Functions (would consume more resources)
- External ML API services (introduces cost and dependency)

## Real-time Data Architecture

**Decision**: CoinGecko API with client-side polling and local caching

**Rationale**:
- Free tier provides 30 calls/min (sufficient for 5-10 coins every 30 seconds)
- Simple REST API integration
- No WebSocket complexity for portfolio project scope
- Built-in rate limiting and error handling

**Alternatives Considered**:
- WebSocket APIs (Binance, Coinbase Pro) - more complex integration
- Paid data providers - conflicts with cost-effective principle

## Chart Visualization

**Decision**: Lightweight Charts (TradingView) for candlestick and line charts

**Rationale**:
- Industry-standard trading chart library
- Excellent performance with large datasets
- Built-in trading indicators and overlays
- Mobile-responsive and touch-friendly

**Alternatives Considered**:
- Chart.js - less specialized for financial data
- D3.js - requires more custom implementation
- Recharts - React-specific, less performant

## Authentication & SSO

**Decision**: Supabase Auth with .bizkit.dev cookie domain configuration

**Rationale**:
- Seamless subdomain SSO with existing bizkit.dev setup
- Built-in Google OAuth and email/password support
- Row-level security for user data isolation
- No additional auth service needed

**Alternatives Considered**:
- Auth0 - introduces additional service dependency
- Custom JWT implementation - increases complexity
- Firebase Auth - would require different backend

## State Management

**Decision**: Astro's island architecture with minimal client-side state

**Rationale**:
- Leverages Astro's SSR performance benefits
- Reduces JavaScript bundle size
- Simple state sharing via props and events
- Appropriate for content-focused trading app

**Alternatives Considered**:
- Zustand/Redux - unnecessary complexity for this scope
- React Context - conflicts with Astro's multi-framework approach
- Local storage only - insufficient for reactive UI updates

## Backtesting Engine

**Decision**: Client-side backtesting with Web Workers for heavy computation

**Rationale**:
- Prevents UI blocking during historical data processing
- Leverages browser's parallel processing capabilities
- No server computation costs
- Better user experience with progress updates

**Alternatives Considered**:
- Server-side backtesting - would consume Supabase compute resources
- Simplified synchronous processing - would block UI
- External backtesting service - introduces dependency and cost

## Database Schema Design

**Decision**: Normalized schema with trading_ prefixed tables in shared Supabase project

**Rationale**:
- Prevents naming conflicts with other bizkit.dev projects
- Efficient storage and querying of trading data
- Supports both guest and authenticated user workflows
- Row-level security for data isolation

**Schema**:
- `trading_users` - Extended user profiles linked to auth.users
- `trading_trades` - Individual trade records with full audit trail
- `trading_runs` - Backtesting and simulation session summaries

**Alternatives Considered**:
- Separate Supabase project - increases cost and complexity
- Document-based storage - less efficient for relational trading data
- Local storage only - prevents cross-device access

## Deployment Strategy

**Decision**: Astro static build with hybrid SSR endpoints deployed to Zeabur

**Rationale**:
- Optimal performance with static pre-rendering
- SSR endpoints for authenticated data fetching
- Zeabur's automatic SSL and CDN
- Simple GitHub integration for CI/CD

**Alternatives Considered**:
- Pure SPA deployment - worse SEO and initial load
- Full SSR mode - higher server resource usage
- Vercel/Netlify - consistency with existing bizkit.dev on Zeabur