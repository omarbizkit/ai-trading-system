# AI Trading System

> **🎯 Portfolio Showcase Project** - AI-powered cryptocurrency trading simulator built with modern web technologies

[![Constitution v1.1.0](https://img.shields.io/badge/Constitution-v1.1.0-blue)](/.specify/memory/constitution.md)
[![Paper Trading Only](https://img.shields.io/badge/Trading-Simulation%20Only-green)](#trading-policy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🚀 Live Demo

**🔗 [ai-trading.bizkit.dev](https://ai-trading.bizkit.dev)** *(Coming Soon)*

## 📖 Overview

The AI Trading System is a sophisticated cryptocurrency trading simulator that demonstrates cutting-edge full-stack development and AI/ML integration capabilities. Built as a showcase project for the [bizkit.dev](https://bizkit.dev) portfolio, it features real-time price prediction, backtesting, and a stunning cyberpunk UI.

### ✨ Key Features

- 🤖 **AI-Powered Predictions** - TensorFlow.js client-side inference for crypto price forecasting
- 📊 **Real-Time Market Data** - Live cryptocurrency prices via CoinGecko API
- 📈 **Interactive Charts** - Professional trading charts with Lightweight Charts (TradingView)
- 🔄 **Backtesting Engine** - Test AI strategies against historical data
- 🎮 **Paper Trading** - Risk-free simulation with $10,000 virtual capital
- 🌓 **Cyberpunk UI** - Neon-themed responsive interface
- 🔐 **SSO Integration** - Seamless authentication across bizkit.dev subdomains
- 📱 **Mobile Responsive** - Optimized for all devices

## 🛡️ Trading Policy

**⚠️ SIMULATION ONLY**: This application operates exclusively with simulated (paper) trading for educational and showcase purposes. No real money transactions are processed.

- ✅ Virtual portfolios with simulated capital
- ✅ Real market prices for authentic experience
- ✅ Performance tracking and analytics
- 🚫 No actual financial transactions
- 🚫 No real money at risk

*Real trading features are marked as "Coming Soon" but will remain simulation-only per our [constitutional requirements](/.specify/memory/constitution.md).*

## 🏗️ Architecture

### Tech Stack

- **Frontend**: [Astro](https://astro.build) + TypeScript + TailwindCSS
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage)
- **AI/ML**: [TensorFlow.js](https://www.tensorflow.org/js) (client-side inference)
- **Charts**: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) (TradingView)
- **Data**: [CoinGecko API](https://www.coingecko.com/en/api) (cryptocurrency market data)
- **Testing**: [Playwright](https://playwright.dev) (E2E) + [Vitest](https://vitest.dev) (unit)
- **Deployment**: [Zeabur](https://zeabur.com) (free tier optimized)

### Project Structure

```
ai-trading-system/
├── src/
│   ├── components/          # Astro components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Routes and API endpoints
│   ├── lib/
│   │   ├── types/          # TypeScript definitions
│   │   ├── services/       # Business logic
│   │   └── ml/             # AI/ML inference
│   └── styles/             # CSS and themes
├── tests/
│   ├── contract/           # API contract tests
│   ├── integration/        # E2E test scenarios
│   └── unit/               # Unit tests
├── specs/                  # Design documents
├── supabase/              # Database migrations
└── .specify/              # Project governance
```

## 🚦 Development Status

### Phase 3.1: Setup ✅ COMPLETED
- [x] Astro project structure with TypeScript
- [x] Dependencies and build configuration
- [x] TailwindCSS with cyberpunk theme
- [x] Playwright testing setup
- [x] Supabase database schema
- [x] Environment configuration

### Phase 3.2: Tests First ✅ COMPLETED
- [x] Contract tests for all 12 API endpoints
- [x] Integration tests for 6 user scenarios
- [x] Risk management protocol tests
- [x] Cross-domain SSO testing
- [x] Mobile responsiveness validation

### Phase 3.3: Core Implementation ✅ COMPLETED
- [x] Database models and types (5 TypeScript models)
- [x] Service layer (7 comprehensive CRUD services)
- [x] Supabase client with cross-domain SSO
- [x] AI prediction service with TensorFlow.js
- [x] Backtesting engine with Web Workers
- [x] API endpoints implementation (12 Astro routes)

### Phase 3.4: Core Components ✅ COMPLETED
- [x] Layout component with cyberpunk theme and matrix effects
- [x] Navigation component with bizkit.dev portfolio integration
- [x] Trading chart visualization with Lightweight Charts
- [x] Portfolio metrics and performance displays
- [x] AI prediction component with ML signal visualization
- [x] Simulation controls for trade execution
- [x] Comprehensive backtesting form with progress tracking
- [x] Trade log component with filtering and modal details

### Phase 3.5: Pages Implementation 🎯 IN PROGRESS
- [ ] Home page with simulation dashboard
- [ ] Live trading simulation interface
- [ ] Backtesting configuration page
- [ ] Trading history and analytics
- [ ] User profile and settings page

### Phase 3.6: Final Integration ⏳ PENDING
- [ ] Authentication and state management integration
- [ ] Real-time price monitoring and updates
- [ ] ML model loading and inference pipeline
- [ ] End-to-end testing validation
- [ ] Performance optimization and deployment

**Progress**: 58/88 tasks completed (66%)

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn package manager
- Git for version control

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-trading-system.git
   cd ai-trading-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:4321
   ```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run Playwright tests
npm test:unit        # Run unit tests
npm run lint         # Lint code
npm run format       # Format code
```

### Testing

```bash
# Run all tests
npm test

# Run specific test types
npm run test:contract      # API contract tests
npm run test:integration   # E2E integration tests
npm run test:unit         # Unit tests

# Run with UI
npm test -- --ui
```

## 📊 Database Schema

The application uses Supabase PostgreSQL with the following core tables:

- `trading_users` - User profiles and preferences
- `trading_runs` - Simulation and backtesting sessions
- `trading_trades` - Individual trade records
- `market_data` - Cached cryptocurrency data
- `ai_predictions` - ML model outputs for analysis

*All tables use the `trading_` prefix to avoid conflicts in the shared Supabase instance.*

## 🔧 Configuration

### Environment Variables

```bash
# Supabase
PUBLIC_SUPABASE_URL=your-supabase-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# CoinGecko API
COINGECKO_API_KEY=your-api-key

# Application
PUBLIC_APP_URL=https://ai-trading.bizkit.dev
PUBLIC_PORTFOLIO_URL=https://bizkit.dev
```

### AI Model Configuration

The system uses a pre-trained TensorFlow.js model for cryptocurrency price prediction:

- **Model Location**: `/public/models/crypto-prediction-model.json`
- **Input Features**: Technical indicators, market sentiment, volume data
- **Output**: Price direction and confidence score
- **Inference**: Client-side for optimal performance

## 🧪 Testing Strategy

Following Test-Driven Development (TDD):

1. **Contract Tests** - Validate API schemas and responses
2. **Integration Tests** - Test complete user workflows
3. **Unit Tests** - Verify individual component logic
4. **Performance Tests** - Ensure <2s page loads

### Test Scenarios

- Guest user simulation flow
- Authenticated backtesting workflow
- Real-time dashboard updates
- Risk management protocols
- Cross-domain SSO navigation
- Mobile responsiveness

## 🚀 Deployment

### Production Deployment (Zeabur)

1. **Connect repository** to Zeabur
2. **Configure environment** variables
3. **Deploy** with automatic SSL

```bash
# Build for production
npm run build

# Preview locally
npm run preview
```

### Container Deployment

```bash
# Build container
docker build -t ai-trading-system .

# Run locally
docker run -p 4321:4321 ai-trading-system
```

## 📈 Performance Targets

- **Page Load**: < 2 seconds (first contentful paint)
- **Chart Rendering**: < 1 second for 30 days of data
- **Trade Execution**: < 500ms UI response time
- **API Response**: < 200ms p95 latency
- **Bundle Size**: < 500KB gzipped

## 🤝 Contributing

This is a portfolio showcase project. While contributions are welcome, please note:

1. **Read the [Constitution](/.specify/memory/constitution.md)** for project principles
2. **Follow TDD approach** - write tests first
3. **Maintain cyberpunk theme** consistency
4. **Ensure simulation-only** trading operations
5. **Test cross-browser** compatibility

### Development Workflow

1. Create feature branch from `main`
2. Write failing tests first (TDD)
3. Implement feature to pass tests
4. Ensure all checks pass
5. Submit pull request

## 📝 Documentation

- **[Constitution](/.specify/memory/constitution.md)** - Project governance and principles
- **[Design Specification](/specs/001-create-new-web/spec.md)** - Feature requirements
- **[Implementation Plan](/specs/001-create-new-web/plan.md)** - Technical architecture
- **[Task Breakdown](/specs/001-create-new-web/tasks.md)** - Development roadmap
- **[API Documentation](/docs/api.md)** - REST API reference *(Coming Soon)*

## 🎯 Portfolio Context

This project demonstrates expertise in:

- **Full-Stack Development** - Modern web architecture
- **AI/ML Integration** - Client-side machine learning
- **Financial Technology** - Trading systems and risk management
- **Real-Time Systems** - Live data processing and updates
- **UI/UX Design** - Responsive and accessible interfaces
- **DevOps** - CI/CD, testing, and deployment
- **Database Design** - Scalable data modeling

## 🔗 Related Projects

- **[bizkit.dev](https://bizkit.dev)** - Main portfolio website
- **Other Projects** - Additional showcase applications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[CoinGecko](https://www.coingecko.com)** - Cryptocurrency market data
- **[TradingView](https://tradingview.com)** - Lightweight Charts library
- **[Astro Team](https://astro.build)** - Amazing web framework
- **[Supabase](https://supabase.com)** - Backend-as-a-Service platform

---

**Built with ❤️ by [Omar Bizkit](https://bizkit.dev) | AI Trading System v1.0.0**