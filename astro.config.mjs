import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless'; // Geändert auf serverless

// https://astro.build/config
export default defineConfig({
  // 1. WICHTIG: Erlaubt Astro, Seiten live auf dem Server zu generieren (für Login & DB)
  output: 'server', 

  // 2. Saubere URLs
  trailingSlash: 'never',

  // 3. Der Adapter für Vercel (muss für Server-Output konfiguriert sein)
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});