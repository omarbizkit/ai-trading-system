#!/usr/bin/env node

/**
 * Post-build script to fix Astro SSR asset resolution issues
 * This script copies missing client assets to the server assets directory
 */

import { copyFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';

const DIST_DIR = 'dist';
const CLIENT_ASSETS_DIR = join(DIST_DIR, 'client', 'assets');
const SERVER_ASSETS_DIR = join(DIST_DIR, 'server', 'assets');

async function fixSSRAssets() {
  console.log('🔧 Fixing Astro SSR asset resolution...');
  
  // Ensure server assets directory exists
  if (!existsSync(SERVER_ASSETS_DIR)) {
    mkdirSync(SERVER_ASSETS_DIR, { recursive: true });
  }
  
  // Find all client assets that might be needed by server
  const clientAssets = await glob('**/*', { cwd: CLIENT_ASSETS_DIR });
  
  let copiedCount = 0;
  for (const asset of clientAssets) {
    const sourcePath = join(CLIENT_ASSETS_DIR, asset);
    const targetPath = join(SERVER_ASSETS_DIR, asset);
    
    try {
      // Skip directories
      if (statSync(sourcePath).isDirectory()) {
        continue;
      }
      
      // Ensure target directory exists
      mkdirSync(dirname(targetPath), { recursive: true });
      
      // Copy the file
      copyFileSync(sourcePath, targetPath);
      copiedCount++;
    } catch (error) {
      console.warn(`⚠️  Could not copy ${asset}:`, error.message);
    }
  }
  
  console.log(`✅ Copied ${copiedCount} assets to server directory`);
  console.log('🎉 SSR asset resolution fixed!');
}

fixSSRAssets().catch(console.error);
