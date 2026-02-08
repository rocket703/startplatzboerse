import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // 1. CORS-Handling (Wichtig für Browser-Aufrufe)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { record } = await req.json()
    console.log("🔔 Neuer Webhook-Aufruf für Nachricht:", record.content)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Infos zur Konversation und zum Event holen
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id, listings(event_name)')
      .eq('id', record.conversation_id)
      .single()

    if (convoError || !convo) {
      console.error("❌ Fehler: Konversation nicht gefunden", convoError)
      throw new Error('Konversation nicht gefunden')
    }

    // 3. Empfänger bestimmen (derjenige, der die Nachricht NICHT geschickt hat)
    const recipientId = record.sender_id === convo.buyer_id ? convo.seller_id : convo.buyer_id
    console.log("👤 Empfänger-ID ermittelt:", recipientId)

    // 4. E-Mail-Adresse des Empfängers via Admin-API abrufen
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipientId)
    if (userError || !userData.user?.email) {
      console.error("❌ Fehler: E-Mail-Adresse konnte nicht abgerufen werden", userError)
      throw new Error('Empfänger-Email nicht gefunden')
    }
    
    const recipientEmail = userData.user.email
    console.log("✉️ Sende Benachrichtigung an:", recipientEmail)

    // 5. E-Mail über Resend versenden
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // Nutze hier die Hauptdomain, die in Resend grün ("Verified") ist
        from: 'Startplatzbörse <info@startplatzboerse.com>',
        to: recipientEmail,
        subject: `Neue Nachricht zu: ${convo.listings.event_name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #00bcd4;">Neue Nachricht erhalten!</h2>
            <p>Hallo,</p>
            <p>du hast eine neue Nachricht bezüglich des Events <strong>${convo.listings.event_name}</strong> erhalten:</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #00bcd4; font-style: italic; margin: 20px 0;">
              "${record.content}"
            </div>
            <p>Klicke auf den Button, um direkt zu antworten:</p>
            <a href="https://startplatzboerse.vercel.app/chat?id=${record.conversation_id}"
               style="background: #00bcd4; color: black; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px;">
               Zum Chat wechseln
            </a>
            <p style="font-size: 0.8rem; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
              Dies ist eine automatische Benachrichtigung von startplatzboerse.com
            </p>
          </div>
        `,
      }),
    })

    const resData = await res.json()
    console.log("🚀 Resend API Antwort:", resData)

    return new Response(JSON.stringify(resData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error("💥 Kritischer Fehler in der Edge Function:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})