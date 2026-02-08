import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // 1. Saubere URLs ohne Schrägstrich am Ende (sieht sauberer aus)
    trailingSlash: 'never',

    // 2. Erzeugt physische .html Dateien (besser für Vercel/GitHub)
    build: {
        format: 'file'
    }
});
