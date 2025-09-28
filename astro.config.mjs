import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  server: {
    port: 4321,
    host: "0.0.0.0",
  },
  build: {
    // Production build optimizations
    minify: true,
    sourcemap: false,
    assets: "assets",
    inlineStylesheets: "auto",
  },
  vite: {
    // Production optimizations
    build: {
      minify: "esbuild",
      target: "es2020",
      cssMinify: "esbuild",
      rollupOptions: {
        output: {
          // Code splitting for better caching
          manualChunks: {
            // Vendor chunks for better caching
            'vendor-charts': ['lightweight-charts'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-react': ['react', 'react-dom'],
          },
          // Asset naming for better caching
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
        },
      },
    },
    optimizeDeps: {
      include: [
        "lightweight-charts",
        "@supabase/supabase-js",
      ],
    },
    ssr: {
      noExternal: [
        "lightweight-charts",
        "@supabase/supabase-js",
      ],
    },
    // Improve dev server performance
    server: {
      fs: {
        strict: false
      }
    },
    // Environment-specific settings
    define: {
      'import.meta.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
  },
  // Prefetch optimization
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
});