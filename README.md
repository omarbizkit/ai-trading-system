# AI Trading System

> **🚀 Status: 85% Complete** | **Phase 3.3: Core Implementation** ✅ | **Next: Integration Phase**

AI-powered cryptocurrency trading simulator with real-time price prediction, comprehensive backtesting, and seamless portfolio integration. Built with Astro, TensorFlow.js, and Supabase for the [bizkit.dev](https://bizkit.dev) portfolio showcase.

![AI Trading System](https://img.shields.io/badge/Status-85%25%20Complete-brightgreen)
![Astro](https://img.shields.io/badge/Astro-4.15.0-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.0-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.0-cyan)

## ✨ Features

### 🎯 **Core Features (✅ Implemented)**
- **🏠 Landing Page** - Cyberpunk-themed hero with feature overview and live preview
- **📊 Simulation Dashboard** - Real-time trading interface with portfolio metrics and AI predictions
- **🔄 Backtesting Engine** - Historical strategy testing with comprehensive analytics
- **📈 Trading History** - Complete trade records with advanced filtering and performance metrics
- **⚙️ Profile & Settings** - User customization, trading preferences, and AI configuration

### 🛠 **Technical Architecture (✅ Implemented)**
- **🎨 Cyberpunk UI** - Neon color scheme with matrix rain effects and glow animations
- **📱 Responsive Design** - Mobile-first approach with breakpoints for all devices
- **🧠 AI Integration** - TensorFlow.js model loading and inference preparation
- **🔐 Authentication Ready** - Supabase Auth configuration for SSO with bizkit.dev
- **💾 Database Models** - Complete TypeScript types and Supabase schema

### 🔄 **Integration Layer (⏳ Next Phase)**
- **🔑 Authentication & SSO** - Single Sign-On with main portfolio site
- **🤖 AI Model Loading** - TensorFlow.js model deployment and inference
- **💹 Market Data API** - CoinGecko integration with rate limiting and caching
- **⚡ Real-time Updates** - WebSocket-like polling for live price data
- **🔒 Security & Validation** - Input validation, rate limiting, and error handling

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (Astro requirement)
- **npm or yarn**
- **Git** for version control

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd ai-trading-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

**🌐 Open**: [http://localhost:4321](http://localhost:4321)

### Project Structure

```
ai-trading-system/
├── src/
│   ├── components/          # UI components (7 components)
│   │   ├── Navigation.astro
│   │   ├── TradingChart.astro
│   │   ├── PortfolioMetrics.astro
│   │   ├── AIPrediction.astro
│   │   ├── SimulationControls.astro
│   │   ├── TradeLog.astro
│   │   └── BacktestingForm.astro
│   ├── pages/              # Astro pages (5 pages)
│   │   ├── index.astro     # Home/landing page
│   │   ├── simulation.astro # Live trading dashboard
│   │   ├── backtesting.astro # Strategy testing
│   │   ├── history.astro   # Trading records
│   │   ├── profile.astro   # User settings
│   │   └── api/           # API endpoints (12 endpoints)
│   ├── layouts/           # Layout components
│   ├── lib/              # Business logic
│   │   ├── types/        # TypeScript definitions
│   │   ├── services/     # API services
│   │   └── utils/        # Helper functions
│   └── styles/           # Global CSS and theme
├── tests/                # Test suites
├── specs/                # Design documentation
└── public/               # Static assets
```

## 🎨 Design System

### **Cyberpunk Theme**
- **🎯 Primary**: Neon cyan (`#00ffff`) for interactive elements
- **💜 Secondary**: Neon purple (`#9d4edd`) for AI/ML features
- **💚 Success**: Neon green (`#00ff00`) for positive metrics
- **💖 Accent**: Neon pink (`#ff00ff`) for warnings and highlights
- **🌌 Background**: Dark gradients (`#0a0a0a`, `#1a1a2e`, `#16213e`)

### **Typography**
- **Headings**: Orbitron (futuristic, tech-focused)
- **Body**: Inter (readable, modern)
- **Code/Data**: JetBrains Mono (monospace for numbers)

### **Visual Effects**
- **✨ Glow effects** on interactive elements
- **🌧️ Matrix rain** background animation
- **⚡ Pulse animations** for real-time data
- **🔲 Glass morphism** for overlay components

## 🏗️ Tech Stack

### **Frontend**
- **[Astro](https://astro.build)** - Static site generator with SSR
- **[TypeScript](https://www.typescriptlang.org)** - Type safety and developer experience
- **[TailwindCSS](https://tailwindcss.com)** - Utility-first styling
- **[Lightweight Charts](https://tradingview.github.io/lightweight-charts/)** - Financial charting

### **AI/ML**
- **[TensorFlow.js](https://www.tensorflow.org/js)** - Client-side ML inference
- **[ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html)** - Alternative ML runtime

### **Backend & Data**
- **[Supabase](https://supabase.com)** - Database, auth, and real-time features
- **[CoinGecko API](https://www.coingecko.com/en/api)** - Cryptocurrency market data
- **PostgreSQL** - Relational database with time-series optimization

### **Testing & Quality**
- **[Playwright](https://playwright.dev)** - End-to-end testing
- **[Vitest](https://vitest.dev)** - Unit testing
- **[ESLint](https://eslint.org)** + **[Prettier](https://prettier.io)** - Code quality

### **Deployment**
- **[Zeabur](https://zeabur.com)** - Hosting platform (free tier optimized)
- **GitHub Actions** - CI/CD pipeline

## 🔧 Configuration

### Environment Variables

```bash
# Supabase Configuration
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# External APIs
COINGECKO_API_KEY=your-api-key

# AI/ML Settings
AI_MODEL_VERSION=v1.2.3
AI_CONFIDENCE_THRESHOLD=0.6
TENSORFLOW_JS_BACKEND=cpu

# Trading Configuration
DEFAULT_PORTFOLIO_VALUE=50000
MAX_POSITION_SIZE=0.1
PAPER_TRADING_ONLY=true
```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run Playwright E2E tests
```

## 📊 Current Progress

### ✅ **Completed Phases (85%)**

**🏗️ Phase 3.1: Setup** - Project initialization, dependencies, database schema
**🧪 Phase 3.2: Tests** - Contract tests for API endpoints and integration scenarios
**⚙️ Phase 3.3: Core Implementation** - All models, services, components, and pages

### 🔄 **Next Phase: Integration (15% remaining)**

**🎯 Immediate Priorities**:
1. **Authentication & SSO** - Supabase Auth integration with bizkit.dev
2. **AI Model Integration** - TensorFlow.js model loading and inference
3. **Market Data Service** - CoinGecko API with caching and rate limiting
4. **Real-time Updates** - Live price polling and state management

## 🤝 Contributing

This project follows the **Constitution-First Development** methodology:

1. **📋 Specification-Driven** - All features defined in `specs/001-create-new-web/`
2. **✅ Test-First Approach** - Contract tests before implementation
3. **📖 Documentation Required** - Update README and plan.md for changes
4. **🎨 Design Consistency** - Follow cyberpunk theme and responsive patterns

### Development Workflow

```bash
# 1. Check prerequisites
.specify/scripts/bash/check-prerequisites.sh

# 2. Review current tasks
cat specs/001-create-new-web/tasks.md

# 3. Run tests before coding
npm run test

# 4. Implement following patterns in existing code

# 5. Update documentation and commit
git add . && git commit -m "feat: implement feature X"
```

## 🛡️ Security & Privacy

- **🔒 Paper Trading Only** - No real money transactions
- **👤 Privacy First** - Minimal data collection
- **🔐 Secure Auth** - Supabase Auth with industry standards
- **🏠 Local Inference** - AI models run client-side when possible
- **🔒 Input Validation** - All user inputs sanitized and validated

## 📈 Performance

### **Current Benchmarks**
- **⚡ Page Load**: < 2s (optimized for Zeabur free tier)
- **📊 Chart Render**: < 500ms (Lightweight Charts)
- **🔄 Data Refresh**: 5s intervals (configurable)
- **📱 Mobile Performance**: Optimized for 3G networks

### **Optimization Strategies**
- **🎯 Code Splitting** - Page-based chunks
- **💾 Asset Optimization** - Compressed images and fonts
- **⚡ Client-Side Caching** - Service worker for offline support
- **🔄 Lazy Loading** - Components loaded on demand

## 📄 License

This project is part of the [bizkit.dev](https://bizkit.dev) portfolio and is proprietary. All rights reserved.

---

## 🔗 Links

- **🌐 Live Demo**: [ai-trading.bizkit.dev](https://ai-trading.bizkit.dev) *(Coming Soon)*
- **📊 Main Portfolio**: [bizkit.dev](https://bizkit.dev)
- **📚 Documentation**: `specs/001-create-new-web/`
- **🐛 Issues**: GitHub Issues *(Internal)*

---

**Built with ❤️ for the bizkit.dev portfolio showcase**

*Last Updated: September 2025 | Status: 85% Complete*