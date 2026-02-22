import { createClient } from '@supabase/supabase-js';

export async function GET() {
    // 1. Supabase Verbindung aufbauen
    const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );

    // 2. Alle aktuellen Inserat-IDs aus der Datenbank holen
    const { data: listings, error } = await supabase
        .from('listings')
        .select('id');

    if (error) {
        console.error('Sitemap DB Error:', error);
    }

    // 3. Deine echte Domain
    const baseUrl = 'https://startplatzboerse.com'; 

    // 4. Deine statischen Seiten
    const staticPages = [
        '',             // Startseite
        '/suche',       // Suche
        '/ueber-uns',   // Über uns
        '/kontakt'      // Kontakt
    ];

    // 5. XML für statische Seiten generieren
    const staticUrls = staticPages.map((page) => {
        return `
    <url>
        <loc>${baseUrl}${page}</loc>
        <changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
        <priority>${page === '' ? '1.0' : '0.8'}</priority>
    </url>`;
    }).join('');

    // 6. XML für alle dynamischen Inserate generieren
    const listingUrls = (listings || []).map((item) => {
        return `
    <url>
        <loc>${baseUrl}/listing/${item.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>`;
    }).join('');

    // 7. Alles zum fertigen XML-Dokument zusammenbauen
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${staticUrls}
    ${listingUrls}
</urlset>`;

    // 8. Die Sitemap an den Browser/Google ausliefern
    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            // Caching: Speichert die Sitemap für eine Stunde bei Vercel, 
            // damit die Supabase-Datenbank geschont wird
            'Cache-Control': 'public, max-age=3600' 
        }
    });
}