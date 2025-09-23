# AI Trading System – Full Context Document

## Project Vision  
The AI Trading System is a web-based cryptocurrency trading simulator that demonstrates machine learning applied to short-term price prediction. It is intended as a **showcase project under bizkit.dev** at the subdomain **ai-trading.bizkit.dev**. The app delivers a **neon cyberpunk UI**, live market data integration, and simulated trading with risk management, designed to impress both casual visitors and potential clients with its polish and technical depth.

---

## Goals  
- Demonstrate **AI-driven crypto trading predictions** (~85% accuracy based on offline tests).  
- Provide a **safe simulation environment** with mock trades, backtesting, and risk protocols.  
- Showcase full-stack skills across **Astro, Supabase, API integration, ML inference, testing, and deployment**.  
- Deploy cost-effectively on **Zeabur’s free tier**, reusing the **single Supabase project** already in use for bizkit.dev.  

---

## Technical Stack  

### Frontend  
- **Astro** (core framework, neon cyberpunk theme).  
- **TailwindCSS** for styling and responsiveness.  
- **Lightweight Charts (TradingView)** for interactive candlestick and equity charts.  
- Shared UI elements across all subdomains (e.g. “← Back to Projects”).  

### Backend / Data Layer  
- **Supabase (single project)** for Auth, Database, and optional file storage.  
- All trading data tables use `trading_` prefixes.  
- Reuses existing `public.subscribers` table for the portfolio mailing list.  

### Authentication  
- **Supabase Auth** (Google OAuth + email/password).  
- Cookie domain `.bizkit.dev` for seamless **SSO across subdomains**.  
- Optional login: guests can simulate trades; logged-in users can save history.  

### Database Schema (Supabase, single project)  
- **Existing:** `public.subscribers` (portfolio mailing list).  
- **New Trading Tables:**  
  - `trading_users` → trading-specific profile data linked to Supabase Auth.  
  - `trading_trades` → records of individual simulated buy/sell actions.  
  - `trading_runs` → backtest session summaries, including metrics (final capital, win rate, etc.).  

### AI/ML Inference  
- **Primary:** client-side inference using TensorFlow.js or ONNX Runtime Web.  
- **Fallback:** optional Supabase Edge Function if server-side inference is needed.  
- Model file (e.g. `.onnx` or `.json`) stored in Supabase storage or bundled as a lazy-loaded asset.  

### External Integrations  
- **CoinGecko API** for live and historical price data (free plan: 30 calls/min, 10k calls/month).  
- Optional: **Fear & Greed Index** (Alternative.me) and **CoinGecko sentiment votes** per coin.  

---

## Features  

### Trading Simulator  
- Simulates buy/sell trades using AI model predictions.  
- Risk management protocols: stop-loss (e.g. -2%), take-profit/model exit triggers.  
- User starts with a notional capital (e.g. $10k).  

### Backtesting  
- Runs strategy against historical price data (e.g. 30 days hourly).  
- Calculates performance metrics: win rate, return, max drawdown.  
- Visualization:  
  - Price chart with buy/sell markers.  
  - Equity growth curve.  
  - Trade log with P/L.  

### Portfolio Integration  
- Lives at **ai-trading.bizkit.dev** with seamless navigation back to bizkit.dev.  
- Consistent theme with main portfolio (dark neon sci-fi aesthetic).  
- Project card and detail page on bizkit.dev linking to the live app.  

---

## Hosting & Deployment  

- **Zeabur Free Tier** ($5 monthly usage credit).  
- One service per subdomain:  
  - `bizkit.dev` → portfolio  
  - `ai-trading.bizkit.dev` → trading app  
- GitHub CI/CD integration: auto-deploy on push.  
- Environment variables per service:  
  - `SUPABASE_URL`  
  - `SUPABASE_ANON_KEY`  
  - `COINGECKO_API_KEY` (optional for stable rate limits).  

---

## Testing & Monitoring  

- **Playwright** for E2E testing:  
  - Cross-domain login flow (bizkit.dev → ai-trading.bizkit.dev).  
  - Running a simulation and verifying output.  
  - Mobile responsiveness.  
- **Monitoring:**  
  - Supabase logs (DB + Auth).  
  - Privacy-friendly analytics (e.g. Plausible).  
  - Optional event logging in `trading_runs` for usage tracking.  

---

## Market Analysis & Inspiration  

- **Indie project parallels:** Rapto’s mock trading app (Next.js + CoinGecko).  
- **Open-source trading bots:** Freqtrade, Gekko – inspiration for backtesting UI.  
- **Design influences:** Astro NeoDev theme, cyberpunk neon UIs, TradingView charts.  
- **Differentiator:** Combines AI-driven predictions, risk protocols, and polished design in a free-tier deployable app.  

---

## Success Criteria  
- Deployed at **ai-trading.bizkit.dev**, accessible with or without login.  
- Live price updates from CoinGecko.  
- Model-driven trade simulation and backtesting visible to users.  
- SSO works across `.bizkit.dev` subdomains.  
- All data cleanly stored in Supabase under `subscribers` and `trading_` tables.  
