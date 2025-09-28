/**
 * T061: Bundle optimization and code splitting configuration
 * Advanced Vite configuration for production-ready builds
 */

import { defineConfig } from 'vite';

export default defineConfig({
  // Advanced build optimizations
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2022',
    
    // Optimize bundle size
    minify: 'esbuild',
    cssMinify: 'esbuild',
    
    // Enable tree shaking
    rollupOptions: {
      output: {
        // Advanced code splitting
        manualChunks: (id) => {
          // Chart libraries
          if (id.includes('lightweight-charts')) {
            return 'vendor-charts';
          }
          
          // Database and API
          if (id.includes('@supabase/supabase-js')) {
            return 'vendor-supabase';
          }
          
          // TensorFlow.js (if used)
          if (id.includes('@tensorflow')) {
            return 'vendor-ml';
          }
          
          // UI libraries
          if (id.includes('tailwindcss') || id.includes('@tailwindcss')) {
            return 'vendor-ui';
          }
          
          // Astro framework
          if (id.includes('astro')) {
            return 'vendor-astro';
          }
          
          // Utilities and smaller libraries
          if (id.includes('node_modules')) {
            return 'vendor-utils';
          }
        },
        
        // Optimize asset naming for caching
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType ?? '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(extType ?? '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId 
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace(/\.[^.]*$/, '')
            : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
      
      // External dependencies for CDN loading (optional)
      external: [
        // Keep these bundled for reliability, but could externalize for CDN
        // 'lightweight-charts',
      ],
    },
    
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Source maps for production debugging (disable for smaller builds)
    sourcemap: false,
    
    // Report bundle analysis
    reportCompressedSize: true,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'lightweight-charts',
      '@supabase/supabase-js',
    ],
    exclude: [
      // Exclude large dependencies that should be dynamically imported
    ],
  },
  
  // CSS optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      // Optimize CSS processing
    },
  },
  
  // Performance optimization
  esbuild: {
    // Remove console logs in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    
    // Tree shaking for unused code
    treeShaking: true,
    
    // Optimize for modern browsers
    target: 'es2022',
  },
  
  // Experimental features
  experimental: {
    // Enable build optimizations
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        return `/${filename}`;
      }
      return filename;
    },
  },
});