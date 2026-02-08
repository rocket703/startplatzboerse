import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // CORS Handling für Webhooks
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { record } = await req.json() // Die neue Nachricht aus der DB ('messages' Tabelle)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Infos zur Konversation holen (Wer ist Käufer/Verkäufer?)
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id, listings(event_name)')
      .eq('id', record.conversation_id)
      .single()

    if (convoError || !convo) throw new Error('Konversation nicht gefunden')

    // 2. Empfänger bestimmen (derjenige, der die Nachricht NICHT abgeschickt hat)
    const recipientId = record.sender_id === convo.buyer_id ? convo.seller_id : convo.buyer_id

    // 3. E-Mail-Adresse des Empfängers via Admin-API holen
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipientId)
    if (userError || !userData.user?.email) throw new Error('Empfänger-Email nicht gefunden')

    // 4. E-Mail über Resend versenden
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Startplatzbörse <onboarding@resend.dev>', // WICHTIG: Ersetze das später durch deine verifizierte Domain
        to: userData.user.email,
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
            <a href="<a href="https://startplatzboerse.vercel.app/chat?id=${record.conversation_id}"
               style="background: #00bcd4; color: black; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px;">
               Zum Chat wechseln
            </a>
            <p style="font-size: 0.8rem; color: #999; margin-top: 30px;">
              Dies ist eine automatische Benachrichtigung von startplatzboerse.com
            </p>
          </div>
        `,
      }),
    })

    const resData = await res.json()
    return new Response(JSON.stringify(resData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})