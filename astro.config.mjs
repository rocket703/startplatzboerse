import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://startplatzboerse.com',

  // 2. Erlaubt Astro, Seiten live auf dem Server zu generieren
  output: 'server',

  // 3. Saubere URLs
  trailingSlash: 'never',

  // 4. Integrations (Standard-Sitemap entfernt, damit unser eigenes Script greift)
  integrations: [],

  // 5. Adapter für Vercel
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});