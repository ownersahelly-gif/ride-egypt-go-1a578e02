const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channelName, uid } = await req.json()

    if (!channelName || uid === undefined) {
      return new Response(
        JSON.stringify({ error: 'channelName and uid are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const appId = Deno.env.get('AGORA_APP_ID')
    const appCert = Deno.env.get('AGORA_APP_CERT')

    if (!appId || !appCert) {
      return new Response(
        JSON.stringify({ error: 'Agora credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const role = RtcRole.PUBLISHER
    const expirationTimeInSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCert,
      channelName,
      Number(uid),
      role,
      privilegeExpiredTs
    )

    return new Response(
      JSON.stringify({ token, appId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Error generating Agora token:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
