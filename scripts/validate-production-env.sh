#!/bin/bash
# T003: Production Environment Validation Script
# Validates environment configuration and deployment readiness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
ERRORS=0
WARNINGS=0
PASSED=0

log_error() {
  echo -e "${RED}✗ ERROR: $1${NC}"
  ((ERRORS++))
}

log_warning() {
  echo -e "${YELLOW}⚠ WARNING: $1${NC}"
  ((WARNINGS++))
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASSED++))
}

log_info() {
  echo -e "${BLUE}ℹ INFO: $1${NC}"
}

check_required_env_var() {
  local var_name=$1
  local var_value=${!var_name}
  local is_secret=${2:-false}
  
  if [[ -z "$var_value" ]]; then
    log_error "Required environment variable $var_name is not set"
    return 1
  fi
  
  if [[ "$is_secret" == "true" ]]; then
    log_success "$var_name is set (value hidden)"
  else
    log_success "$var_name is set: $var_value"
  fi
  return 0
}

check_optional_env_var() {
  local var_name=$1
  local var_value=${!var_name}
  local default_value=$2
  
  if [[ -z "$var_value" ]]; then
    log_warning "$var_name is not set, will use default: $default_value"
    return 1
  fi
  
  log_success "$var_name is set: $var_value"
  return 0
}

validate_node_version() {
  log_info "Checking Node.js version..."
  
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    return 1
  fi
  
  local node_version=$(node --version | sed 's/v//')
  local major_version=$(echo $node_version | cut -d. -f1)
  
  if [[ $major_version -lt 18 ]]; then
    log_error "Node.js version $node_version is not supported. Requires 18.0.0 or higher"
    return 1
  fi
  
  log_success "Node.js version $node_version is supported"
  return 0
}

validate_npm_dependencies() {
  log_info "Checking npm dependencies..."
  
  if [[ ! -f "package.json" ]]; then
    log_error "package.json not found"
    return 1
  fi
  
  if [[ ! -d "node_modules" ]]; then
    log_warning "node_modules directory not found. Run 'npm install'"
    return 1
  fi
  
  log_success "Dependencies appear to be installed"
  return 0
}

validate_typescript_config() {
  log_info "Checking TypeScript configuration..."
  
  if [[ ! -f "tsconfig.json" ]]; then
    log_warning "tsconfig.json not found"
    return 1
  fi
  
  log_success "TypeScript configuration found"
  return 0
}

validate_astro_config() {
  log_info "Checking Astro configuration..."
  
  if [[ ! -f "astro.config.mjs" ]]; then
    log_error "astro.config.mjs not found"
    return 1
  fi
  
  log_success "Astro configuration found"
  return 0
}

validate_supabase_connection() {
  log_info "Validating Supabase configuration..."
  
  check_required_env_var "PUBLIC_SUPABASE_URL" || return 1
  check_required_env_var "PUBLIC_SUPABASE_ANON_KEY" true || return 1
  
  # Validate URL format
  if [[ ! "$PUBLIC_SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    log_error "PUBLIC_SUPABASE_URL does not appear to be a valid Supabase URL"
    return 1
  fi
  
  log_success "Supabase configuration appears valid"
  return 0
}

validate_deployment_config() {
  log_info "Checking deployment configuration..."
  
  # Check for deployment files
  if [[ -f "Dockerfile" ]]; then
    log_success "Dockerfile found"
  else
    log_warning "Dockerfile not found"
  fi
  
  if [[ -f "docker-compose.yml" ]]; then
    log_success "docker-compose.yml found"
  else
    log_warning "docker-compose.yml not found"
  fi
  
  # Check environment variables for deployment
  check_optional_env_var "NODE_ENV" "development"
  check_optional_env_var "PORT" "4321"
  check_optional_env_var "HOST" "0.0.0.0"
  
  return 0
}

validate_build_system() {
  log_info "Checking build system..."
  
  # Check if build script exists
  if ! npm run --dry-run build &> /dev/null; then
    log_error "Build script not found in package.json"
    return 1
  fi
  
  log_success "Build script found"
  
  # Check if type-check script exists
  if ! npm run --dry-run type-check &> /dev/null; then
    log_warning "Type-check script not found in package.json"
  else
    log_success "Type-check script found"
  fi
  
  return 0
}

validate_api_endpoints() {
  log_info "Checking API endpoint structure..."
  
  if [[ ! -d "src/pages/api" ]]; then
    log_error "API pages directory not found at src/pages/api"
    return 1
  fi
  
  local api_files=$(find src/pages/api -name "*.ts" -o -name "*.js" | wc -l)
  if [[ $api_files -eq 0 ]]; then
    log_warning "No API endpoint files found"
  else
    log_success "Found $api_files API endpoint files"
  fi
  
  return 0
}

validate_security_config() {
  log_info "Checking security configuration..."
  
  # Check for sensitive files that shouldn't be in git
  if [[ -f ".env" ]]; then
    log_warning ".env file found - ensure it's in .gitignore"
  fi
  
  if [[ -f ".env.local" ]]; then
    log_warning ".env.local file found - ensure it's in .gitignore"
  fi
  
  # Check gitignore
  if [[ -f ".gitignore" ]]; then
    if grep -q "\.env" .gitignore; then
      log_success "Environment files are ignored by git"
    else
      log_warning "Environment files should be added to .gitignore"
    fi
  else
    log_warning ".gitignore file not found"
  fi
  
  return 0
}

run_validation() {
  echo -e "${BLUE}🚀 AI Trading System - Production Environment Validation${NC}"
  echo "========================================================"
  echo
  
  validate_node_version
  validate_npm_dependencies
  validate_typescript_config
  validate_astro_config
  validate_supabase_connection
  validate_deployment_config
  validate_build_system
  validate_api_endpoints
  validate_security_config
  
  echo
  echo "========================================================"
  echo -e "${GREEN}✓ Passed: $PASSED${NC}"
  echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
  echo -e "${RED}✗ Errors: $ERRORS${NC}"
  echo
  
  if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
      echo -e "${GREEN}🎉 Environment validation passed with no issues!${NC}"
      exit 0
    else
      echo -e "${YELLOW}⚠️ Environment validation passed with warnings.${NC}"
      exit 0
    fi
  else
    echo -e "${RED}❌ Environment validation failed with $ERRORS errors.${NC}"
    echo "Please fix the errors above before proceeding with deployment."
    exit 1
  fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  run_validation
fi