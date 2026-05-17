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
    console.log("Neuer Webhook-Aufruf für Nachricht:", record.content)

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
      console.error("Fehler: Konversation nicht gefunden", convoError)
      throw new Error('Konversation nicht gefunden')
    }

    // 3. Empfänger bestimmen (derjenige, der die Nachricht NICHT geschickt hat)
    const recipientId = record.sender_id === convo.buyer_id ? convo.seller_id : convo.buyer_id
    console.log("Empfänger-ID ermittelt:", recipientId)

    // 3.5 Push-Präferenz des Empfängers aus dem Profil prüfen (Schieberegler-Status)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('push_new_messages')
      .eq('id', recipientId)
      .single()

    if (profileError) {
      console.error("Hinweis: Profil-Push-Einstellung konnte nicht geladen werden", profileError)
    }

    // 4. E-Mail-Adresse des Empfängers via Admin-API abrufen
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(recipientId)
    if (userError || !userData.user?.email) {
      console.error("Fehler: E-Mail-Adresse konnte nicht abgerufen werden", userError)
      throw new Error('Empfänger-Email nicht gefunden')
    }
    
    const recipientEmail = userData.user.email
    console.log("Sende Benachrichtigung an:", recipientEmail)

    // 5. E-Mail über Resend versenden (Geht IMMER raus)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
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
    console.log("Resend API Antwort:", resData)

    // 6. Push-Zweig: Wenn Schalter aktiv, hole alle registrierten Geräte des Empfängers
    if (profile?.push_new_messages) {
      const { data: devices, error: devicesError } = await supabase
        .from('device_tokens')
        .select('token, provider')
        .eq('user_id', recipientId)

      if (!devicesError && devices && devices.length > 0) {
        console.log(`Sende Push an ${devices.length} registrierte(s) Gerät(e)`)
        
        // Loop über alle registrierten Geräte des Nutzers (z.B. iPhone + iPad)
        for (const device of devices) {
          if (device.provider === 'expo') {
            await sendExpoPush(device.token, convo.listings.event_name, record.content, record.conversation_id)
          }
          // Hier können morgen 'fcm' oder 'apns' Zweige für native Pushs ohne Expo ergänzt werden!
        }
      } else {
        console.log("Push übersprungen: Keine aktiven Geräte-Token in 'device_tokens' gefunden.")
      }
    } else {
      console.log("Push übersprungen: User hat Push-Benachrichtigungen im Dashboard deaktiviert.")
    }

    return new Response(JSON.stringify({ success: true, resend: resData }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error("Kritischer Fehler in der Edge Function:", err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

// ── HILFSFUNKTION FÜR EXPO PUSH ───────────────────────────────────
async function sendExpoPush(token: string, eventName: string, content: string, convoId: string) {
  try {
    // Vorschautext für den Lockscreen kürzen, falls er das Limit sprengt
    const previewText = content.length > 80 ? `${content.substring(0, 80)}...` : content

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default', // Löst den nativen Benachrichtigungston aus
        title: `Neue Nachricht: ${eventName}`,
        body: previewText,
        data: { 
          conversation_id: convoId,
          screen: 'messages' // Wichtig für Deep-Linking beim Antippen des Banners
        },
      }),
    })

    const pushResult = await pushResponse.json()
    console.log("Expo Push API Antwort für Token:", token, pushResult)
  } catch (pushErr) {
    console.error("Isolierter Fehler beim Senden des Expo-Pushs:", pushErr.message)
  }
}