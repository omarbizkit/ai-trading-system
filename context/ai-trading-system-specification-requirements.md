# AI Trading System – Specification Requirements

This document consolidates the actionable requirements for building **ai-trading.bizkit.dev**.

---

## Functional Requirements  

### Trading Features  
- [ ] Allow users to simulate buy/sell trades based on ML predictions.  
- [ ] Implement stop-loss (default -2%) and model-driven exit rules.  
- [ ] Provide backtesting on historical hourly/daily data (CoinGecko).  
- [ ] Display charts: price with trade markers, equity growth curve.  
- [ ] Show trade log with timestamps, coin, action, price, qty, P/L.  
- [ ] Display summary metrics (final capital, win rate, return, max drawdown).  

### AI/ML  
- [ ] Integrate trained model for short-term crypto price prediction.  
- [ ] Default to client-side inference (TF.js / ONNX Runtime Web).  
- [ ] Optionally support server-side inference (Supabase Edge Function).  
- [ ] Store model file in Supabase storage or bundle for lazy-loading.  

### Market Data  
- [ ] Use CoinGecko API for live and historical price data.  
- [ ] Poll current prices every 15–30 seconds (batch multiple coins).  
- [ ] Integrate optional sentiment data (CoinGecko votes, Fear & Greed Index).  
- [ ] Handle API rate limits gracefully and cache responses locally.  

### Authentication  
- [ ] Use Supabase Auth (Google OAuth + email/password).  
- [ ] Configure cookie domain `.bizkit.dev` for subdomain SSO.  
- [ ] Allow guest usage; require login for saving trade history.  

### Database (Supabase, single project)  
- [ ] Keep existing `public.subscribers` table for mailing list.  
- [ ] Create new namespaced tables:  
  - `public.trading_users` (profile info linked to Supabase Auth).  
  - `public.trading_trades` (individual simulated trades).  
  - `public.trading_runs` (backtest sessions + summary metrics).  
- [ ] Enforce row-level security to isolate user data where needed.  

---

## Non-Functional Requirements  

### Frontend & UI  
- [ ] Built with Astro + Tailwind, neon cyberpunk theme.  
- [ ] Responsive design for desktop and mobile.  
- [ ] Use Lightweight Charts for candlesticks and equity plots.  
- [ ] Consistent navigation: include “← Back to Projects” link.  

### Deployment  
- [ ] Deploy to Zeabur free tier.  
- [ ] One service per subdomain (`bizkit.dev`, `ai-trading.bizkit.dev`).  
- [ ] Configure custom domains + SSL via Zeabur.  
- [ ] Set environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `COINGECKO_API_KEY`).  
- [ ] GitHub CI/CD integration for automatic deployments.  

### Testing & Monitoring  
- [ ] Implement Playwright E2E tests:  
  - Cross-domain login flow.  
  - Run a simulation and verify output.  
  - UI rendering at different breakpoints.  
- [ ] Monitor Supabase logs (auth + DB).  
- [ ] Integrate privacy-friendly analytics (Plausible or GoatCounter).  
- [ ] Optionally log simulation events in `trading_runs`.  

---

## Deliverables  
- Live app at **ai-trading.bizkit.dev**.  
- Fully functional simulation and backtesting UI.  
- AI prediction integrated and demonstrated.  
- Seamless SSO with bizkit.dev.  
- Database schema updated with `trading_` tables.  
- Tests and monitoring in place.  

---
