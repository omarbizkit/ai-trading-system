#!/bin/bash

# Production Environment Setup Script
# This script helps configure the AI Trading System for production deployment

set -e

echo "🚀 AI Trading System - Production Environment Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js version check passed: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm version: $(npm -v)"

# Create production environment file if it doesn't exist
if [ ! -f ".env.production" ]; then
    print_status "Creating .env.production file..."
    cp .env.example .env.production
    print_success "Created .env.production from .env.example"
else
    print_warning ".env.production already exists"
fi

# Validate environment configuration
print_status "Validating environment configuration..."

# Check if required environment variables are set
REQUIRED_VARS=(
    "PUBLIC_SUPABASE_URL"
    "PUBLIC_SUPABASE_ANON_KEY"
    "AI_MODEL_VERSION"
    "DEFAULT_PORTFOLIO_VALUE"
    "MAX_POSITION_SIZE"
    "PAPER_TRADING_ONLY"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.production || grep -q "^${var}=$" .env.production; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_status "Please update .env.production with the required values"
    exit 1
fi

print_success "All required environment variables are set"

# Check for placeholder values
print_status "Checking for placeholder values..."

PLACEHOLDER_VARS=()

if grep -q "placeholder" .env.production; then
    print_warning "Found placeholder values in .env.production:"
    grep "placeholder" .env.production | while read line; do
        var=$(echo "$line" | cut -d'=' -f1)
        echo "  - $var"
        PLACEHOLDER_VARS+=("$var")
    done
    echo ""
    print_status "Please replace placeholder values with actual production values"
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci --production=false
print_success "Dependencies installed"

# Run TypeScript check
print_status "Running TypeScript compilation check..."
if npm run type-check; then
    print_success "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    print_status "Please fix TypeScript errors before deploying to production"
    exit 1
fi

# Run build
print_status "Building application..."
if npm run build; then
    print_success "Build successful"
else
    print_error "Build failed"
    print_status "Please fix build errors before deploying to production"
    exit 1
fi

# Check build output
if [ -d "dist" ]; then
    print_success "Build output directory created: dist/"
    print_status "Build size: $(du -sh dist | cut -f1)"
else
    print_error "Build output directory not found"
    exit 1
fi

# Run tests if available
if npm run test --if-present; then
    print_success "Tests passed"
else
    print_warning "Tests failed or not available"
fi

# Generate production readiness report
print_status "Generating production readiness report..."

cat > production-readiness-report.md << EOF
# Production Readiness Report

**Generated:** $(date)
**Environment:** Production
**Node.js Version:** $(node -v)
**npm Version:** $(npm -v)

## Environment Configuration

### Required Variables
EOF

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env.production; then
        echo "- ✅ $var: Set" >> production-readiness-report.md
    else
        echo "- ❌ $var: Missing" >> production-readiness-report.md
    fi
done

cat >> production-readiness-report.md << EOF

### Placeholder Values
EOF

if [ ${#PLACEHOLDER_VARS[@]} -gt 0 ]; then
    for var in "${PLACEHOLDER_VARS[@]}"; do
        echo "- ⚠️ $var: Contains placeholder value" >> production-readiness-report.md
    done
else
    echo "- ✅ No placeholder values found" >> production-readiness-report.md
fi

cat >> production-readiness-report.md << EOF

## Build Status

- ✅ TypeScript compilation: Successful
- ✅ Build process: Successful
- ✅ Build output: dist/ directory created
- ✅ Dependencies: Installed

## Next Steps

1. **Update Environment Variables**: Replace any placeholder values in .env.production
2. **Configure Supabase**: Set up production Supabase instance
3. **Deploy to Platform**: Deploy to Zeabur, Vercel, or your preferred platform
4. **Monitor**: Set up monitoring and alerting
5. **Test**: Run end-to-end tests in production environment

## Deployment Commands

\`\`\`bash
# Deploy to Zeabur
zeabur deploy

# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod
\`\`\`

## Health Check Endpoints

- \`GET /api/health\` - System health check
- \`GET /api/health/database\` - Database health check
- \`GET /api/health/endpoints\` - API endpoints health check

EOF

print_success "Production readiness report generated: production-readiness-report.md"

# Final status
echo ""
echo "🎉 Production Environment Setup Complete!"
echo "========================================"
echo ""
print_status "Next steps:"
echo "1. Review and update .env.production with actual production values"
echo "2. Deploy to your preferred platform"
echo "3. Monitor the application using the health check endpoints"
echo ""
print_status "For more information, see the production-readiness-report.md file"

# Check if running in CI/CD
if [ "$CI" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
    print_status "Running in CI/CD environment - skipping interactive prompts"
    exit 0
fi

# Interactive setup
echo ""
read -p "Would you like to open .env.production for editing? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v code &> /dev/null; then
        code .env.production
    elif command -v nano &> /dev/null; then
        nano .env.production
    elif command -v vim &> /dev/null; then
        vim .env.production
    else
        print_status "Please edit .env.production manually"
    fi
fi

print_success "Setup complete! 🚀"
