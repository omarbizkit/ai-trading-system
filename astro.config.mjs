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
    mode: "middleware",
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
    // Zeabur compatibility
    serverEntry: "entry.mjs",
  },
  vite: {
    // Production optimizations
    build: {
      minify: "esbuild",
      target: "es2020",
      cssMinify: "esbuild",
      // Simplified rollup options to avoid server build issues
      rollupOptions: {
        output: {
          // Only apply manual chunks for client build
          manualChunks: (id) => {
            if (id.includes('node_modules/lightweight-charts')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            return null;
          },
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
      target: "node",
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