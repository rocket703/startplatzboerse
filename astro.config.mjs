import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://startplatzboerse.com',

  // 2. Erlaubt Astro, Seiten live auf dem Server zu generieren
  output: 'server',

  // 3. Saubere URLs
  trailingSlash: 'never',

  // 4. Integrations
  integrations: [sitemap()],

  // 5. Adapter für Vercel
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
});