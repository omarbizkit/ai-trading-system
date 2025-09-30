# AI Trading System - Zeabur Deployment Configuration
# Optimized for Zeabur's free tier with Node.js 18+

FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for sharp and other native modules
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
FROM base AS deps
RUN npm ci --include=dev

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NODE_ENV=production
ENV ASTRO_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache libc6-compat dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 astro

# Copy package files first and install dependencies as root
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./

# Install production dependencies as root to avoid permission issues
RUN npm ci --omit=dev --production && npm cache clean --force

# Copy built application with proper ownership
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/public ./public
COPY --from=builder --chown=astro:nodejs /app/scripts/start-production.js ./scripts/start-production.js

# Set user after all setup is complete
USER astro

# Expose port (Zeabur will assign the actual port via PORT env var)
EXPOSE 4321

# Set default environment variables (can be overridden by Zeabur)
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV ASTRO_TELEMETRY_DISABLED=1

# Set reasonable defaults for missing environment variables
ENV SUPABASE_URL=http://localhost:54321
ENV SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoQ2ZJuoUVnK_iBbShbmOcNbq5czJFfEn0
ENV COINGECKO_API_KEY=""

# Use dumb-init to handle signals properly in containers
ENTRYPOINT ["dumb-init", "--"]

# Start the application using our production startup script
CMD ["node", "./scripts/start-production.js"]