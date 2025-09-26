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
    g++ \
    && npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile --production=false

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NODE_ENV=production
ENV ASTRO_TELEMETRY_DISABLED=1

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache libc6-compat \
    && npm install -g pnpm

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 astro

# Copy built application
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/package.json ./package.json
COPY --from=builder --chown=astro:nodejs /app/pnpm-lock.yaml* ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --production=true --prefer-offline

# Copy additional files needed for runtime
COPY --from=builder --chown=astro:nodejs /app/astro.config.mjs ./
COPY --from=builder --chown=astro:nodejs /app/public ./public

# Set user
USER astro

# Expose port (Zeabur will assign the actual port)
EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "
        const http = require('http');
        const options = {
            host: 'localhost',
            port: process.env.PORT || 4321,
            path: '/api/health',
            timeout: 2000,
        };
        const request = http.request(options, (res) => {
            if (res.statusCode === 200) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
        request.on('error', () => process.exit(1));
        request.on('timeout', () => process.exit(1));
        request.end();
    "

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4321
ENV HOST=0.0.0.0

# Start the application
CMD ["node", "./dist/server/entry.mjs"]