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
  vite: {
    optimizeDeps: {
      include: ["lightweight-charts"],
    },
    ssr: {
      noExternal: ["lightweight-charts"],
    },
  },
});