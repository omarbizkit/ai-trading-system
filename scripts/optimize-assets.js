/**
 * T062: Production-ready static asset generation and optimization
 * Script to optimize images, fonts, and other static assets for production
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { spawn } from 'child_process';

const PUBLIC_DIR = './public';
const DIST_DIR = './dist';
const OPTIMIZED_DIR = './public/optimized';

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

/**
 * Format file size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if command exists
 */
function commandExists(command) {
  return new Promise((resolve) => {
    const process = spawn('which', [command], { stdio: 'ignore' });
    process.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Optimize images (requires imagemin or similar tools)
 */
async function optimizeImages() {
  console.log('🖼️  Optimizing images...');
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
  const images = [];
  
  function findImages(dir) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          findImages(fullPath);
        } else if (imageExtensions.includes(extname(item).toLowerCase())) {
          images.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dir}:`, error.message);
    }
  }
  
  findImages(PUBLIC_DIR);
  
  if (images.length === 0) {
    console.log('   No images found to optimize');
    return;
  }
  
  console.log(`   Found ${images.length} images to optimize`);
  
  let totalSavings = 0;
  let optimizedCount = 0;
  
  for (const imagePath of images) {
    try {
      const originalSize = statSync(imagePath).size;
      const extension = extname(imagePath).toLowerCase();
      
      // Basic optimization strategies
      if (extension === '.svg') {
        // SVG optimization (basic)
        await optimizeSVG(imagePath);
      } else {
        // For other image types, we'd use tools like imagemin
        // For now, just copy and suggest optimization
        console.log(`   - ${imagePath.replace(PUBLIC_DIR + '/', '')}: ${formatBytes(originalSize)} (manual optimization recommended)`);
      }
      
      optimizedCount++;
    } catch (error) {
      console.warn(`   Failed to optimize ${imagePath}:`, error.message);
    }
  }
  
  console.log(`   ✅ Processed ${optimizedCount} images`);
  if (totalSavings > 0) {
    console.log(`   💾 Total savings: ${formatBytes(totalSavings)}`);
  }
}

/**
 * Basic SVG optimization
 */
async function optimizeSVG(svgPath) {
  try {
    const content = readFileSync(svgPath, 'utf8');
    const originalSize = content.length;
    
    // Basic SVG optimizations
    let optimized = content
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove unnecessary whitespace
      .replace(/\s+/g, ' ')
      // Remove empty attributes
      .replace(/\s+([a-zA-Z-]+)=""/g, '')
      // Remove default values
      .replace(/\s+fill="black"/g, '')
      .replace(/\s+stroke="none"/g, '')
      .trim();
    
    if (optimized.length < originalSize) {
      writeFileSync(svgPath, optimized);
      const savings = originalSize - optimized.length;
      console.log(`   - ${svgPath.replace(PUBLIC_DIR + '/', '')}: ${formatBytes(originalSize)} → ${formatBytes(optimized.length)} (saved ${formatBytes(savings)})`);
      return savings;
    }
  } catch (error) {
    console.warn(`   Failed to optimize SVG ${svgPath}:`, error.message);
  }
  return 0;
}

/**
 * Generate responsive image variants
 */
function generateResponsiveImages() {
  console.log('📱 Generating responsive image variants...');
  
  // This would typically use tools like sharp or imagemin
  // For now, document the strategy
  
  const responsiveConfig = {
    sizes: [320, 640, 768, 1024, 1440, 1920],
    formats: ['webp', 'jpg'],
    quality: {
      webp: 80,
      jpg: 85
    }
  };
  
  console.log('   📋 Responsive image configuration:');
  console.log(`   - Sizes: ${responsiveConfig.sizes.join(', ')}px`);
  console.log(`   - Formats: ${responsiveConfig.formats.join(', ')}`);
  console.log(`   - Quality: WebP ${responsiveConfig.quality.webp}%, JPG ${responsiveConfig.quality.jpg}%`);
  console.log('   ⚠️  Manual implementation required (using sharp or similar)');
}

/**
 * Optimize fonts
 */
function optimizeFonts() {
  console.log('🔤 Optimizing fonts...');
  
  const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
  const fonts = [];
  
  function findFonts(dir) {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          findFonts(fullPath);
        } else if (fontExtensions.includes(extname(item).toLowerCase())) {
          fonts.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }
  
  findFonts(PUBLIC_DIR);
  
  if (fonts.length === 0) {
    console.log('   No fonts found in public directory');
    return;
  }
  
  console.log(`   Found ${fonts.length} font files:`);
  fonts.forEach(font => {
    const size = statSync(font).size;
    const ext = extname(font);
    console.log(`   - ${font.replace(PUBLIC_DIR + '/', '')}: ${formatBytes(size)} (${ext})`);
  });
  
  console.log('   💡 Font optimization recommendations:');
  console.log('   - Use WOFF2 format for modern browsers');
  console.log('   - Subset fonts to include only used characters');
  console.log('   - Use font-display: swap for better loading');
}

/**
 * Generate service worker for asset caching
 */
function generateServiceWorker() {
  console.log('🔧 Generating service worker for asset caching...');
  
  const serviceWorkerContent = `/**
 * Service Worker for AI Trading System
 * Handles caching of static assets for offline support
 */

const CACHE_NAME = 'ai-trading-v1';
const STATIC_ASSETS = [
  '/',
  '/simulation',
  '/backtesting',
  '/history',
  '/profile',
  // Add other critical assets
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests (handle separately)
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }
            return response;
          });
      })
      .catch(() => {
        // Fallback for offline scenarios
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});`;
  
  writeFileSync('./public/sw.js', serviceWorkerContent);
  console.log('   ✅ Service worker generated at public/sw.js');
}

/**
 * Create asset manifest
 */
function createAssetManifest() {
  console.log('📄 Creating asset manifest...');
  
  const manifest = {
    name: 'AI Trading System',
    short_name: 'AI Trading',
    description: 'AI-powered cryptocurrency trading simulator',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#00ffff',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ],
    categories: ['finance', 'education', 'utilities'],
    shortcuts: [
      {
        name: 'Start Trading',
        short_name: 'Trade',
        description: 'Start a new trading simulation',
        url: '/simulation',
        icons: [{ src: '/icons/trade-icon.png', sizes: '96x96' }]
      },
      {
        name: 'Backtesting',
        short_name: 'Backtest',
        description: 'Run backtesting analysis',
        url: '/backtesting',
        icons: [{ src: '/icons/backtest-icon.png', sizes: '96x96' }]
      }
    ]
  };
  
  writeFileSync('./public/manifest.json', JSON.stringify(manifest, null, 2));
  console.log('   ✅ Web app manifest created at public/manifest.json');
}

/**
 * Generate robots.txt and sitemap
 */
function generateSEOFiles() {
  console.log('🔍 Generating SEO files...');
  
  // robots.txt
  const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://ai-trading.bizkit.dev/sitemap.xml

# Disallow API endpoints
Disallow: /api/

# Disallow debug endpoints
Disallow: /debug/`;
  
  writeFileSync('./public/robots.txt', robotsTxt);
  console.log('   ✅ robots.txt created');
  
  // Basic sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ai-trading.bizkit.dev/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://ai-trading.bizkit.dev/simulation</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ai-trading.bizkit.dev/backtesting</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ai-trading.bizkit.dev/history</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://ai-trading.bizkit.dev/profile</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;
  
  writeFileSync('./public/sitemap.xml', sitemap);
  console.log('   ✅ sitemap.xml created');
}

/**
 * Main optimization function
 */
async function main() {
  console.log('🚀 Optimizing static assets for production...\n');
  
  // Ensure output directory exists
  ensureDir(OPTIMIZED_DIR);
  
  try {
    await optimizeImages();
    generateResponsiveImages();
    optimizeFonts();
    generateServiceWorker();
    createAssetManifest();
    generateSEOFiles();
    
    console.log('\n✅ Asset optimization complete!');
    console.log('\n💡 Additional optimizations to consider:');
    console.log('   - Install imagemin for automated image optimization');
    console.log('   - Use sharp for responsive image generation');
    console.log('   - Consider WebP format for better compression');
    console.log('   - Implement font subsetting for custom fonts');
    console.log('   - Add critical CSS inlining for above-the-fold content');
    
  } catch (error) {
    console.error('❌ Asset optimization failed:', error);
    process.exit(1);
  }
}

// Run optimization
main();