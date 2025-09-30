#!/usr/bin/env node

/**
 * Production startup script for Zeabur deployment
 * Ensures proper environment variable handling and graceful startup
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load environment variables from .env.production if it exists (for local testing)
const envFile = join(projectRoot, '.env.production');
if (existsSync(envFile)) {
  console.log('Loading environment variables from .env.production...');
  const envContent = readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      // Only set if not already defined (allows override by container environment)
      if (!process.env[key]) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

// Ensure required environment variables are set
const requiredEnvVars = ['NODE_ENV', 'HOST', 'PORT'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  console.error('Setting default values...');

  // Set reasonable defaults
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  if (!process.env.HOST) process.env.HOST = '0.0.0.0';
  if (!process.env.PORT) process.env.PORT = '4321';
}

// Log startup information
console.log('🚀 AI Trading System - Production Startup');
console.log('==========================================');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Host: ${process.env.HOST}`);
console.log(`Port: ${process.env.PORT}`);
console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'Not configured'}`);
console.log(`CoinGecko API: ${process.env.COINGECKO_API_KEY ? 'Configured' : 'Not configured'}`);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

try {
  console.log('Starting Astro server...');

  // Import and start the Astro server
  const serverModule = await import(join(projectRoot, 'dist/server/entry.mjs'));

  if (serverModule.startServer) {
    await serverModule.startServer();
  } else {
    console.log('Server module loaded, application should be starting...');
  }

  console.log('✅ Server startup initiated successfully');

} catch (error) {
  console.error('❌ Server startup failed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}