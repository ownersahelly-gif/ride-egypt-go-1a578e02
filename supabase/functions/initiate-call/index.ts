const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { riderFcmToken, driverName, tripId } = await req.json()

    if (!riderFcmToken || !driverName || !tripId) {
      return new Response(
        JSON.stringify({ error: 'riderFcmToken, driverName, and tripId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: 'FCM credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceAccount = JSON.parse(serviceAccountJson)

    // Build JWT for FCM v1 API
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const encode = (obj: unknown) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const unsignedToken = `${encode(header)}.${encode(payload)}`

    // Import private key and sign
    const pemKey = serviceAccount.private_key
    const pemContents = pemKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '')
    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    )

    const signedJwt = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
    })

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('Failed to get access token:', tokenData)
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with FCM' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send FCM v1 push notification
    const projectId = serviceAccount.project_id
    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: riderFcmToken,
            data: {
              type: 'incoming_call',
              tripId,
              caller: driverName,
            },
            android: {
              priority: 'high',
            },
            apns: {
              headers: {
                'apns-priority': '10',
                'apns-push-type': 'voip',
              },
            },
          },
        }),
      }
    )

    const fcmResult = await fcmRes.json()
    console.log('FCM response:', JSON.stringify(fcmResult))

    return new Response(
      JSON.stringify({ success: true, result: fcmResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error initiating call:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to initiate call' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
