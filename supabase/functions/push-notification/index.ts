// v2 - with test notifications, admin messaging, trip started, driver approved
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supportedNotificationTypes = new Set([
  "test",
  "waitlist_promoted",
  "driver_approved",
  "new_driver_application",
  "trip_started",
]);

// Get an OAuth2 access token from the service account JSON
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) => {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    return btoa(String.fromCharCode(...json))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signInput = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Helper to send FCM push to a list of tokens
async function sendFCM(
  tokens: { token: string; platform: string }[],
  notification: { title: string; body: string },
  data: Record<string, string>
) {
  const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) return;

  const serviceAccount = JSON.parse(serviceAccountJson);
  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;

  for (const tokenEntry of tokens) {
    const message = {
      message: {
        token: tokenEntry.token,
        notification,
        data,
        ...(tokenEntry.platform === "ios"
          ? { apns: { payload: { aps: { sound: "default", badge: 1 } } } }
          : { android: { priority: "high", notification: { sound: "default" } } }),
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`FCM send failed for token ${tokenEntry.token}: ${errText}`);
    } else {
      await res.text();
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("[push-notification] Received body:", JSON.stringify(body));
    const { type, record, notification_type } = body;

    if (notification_type && !supportedNotificationTypes.has(notification_type)) {
      return new Response(
        JSON.stringify({ error: `Unsupported notification_type: ${notification_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!record || typeof record !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid or missing record payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Test push notification ──
    if (notification_type === "test" && record?.user_id) {
      const userId = record.user_id;

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .eq("user_id", userId);

      if (!tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No device tokens for user — they may not have the app installed or push not registered" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendFCM(
        tokens,
        { title: "🔔 Test Notification", body: "This is a test push notification from the admin panel!" },
        { type: "test" }
      );

      return new Response(
        JSON.stringify({ message: `Test notification sent to ${tokens.length} device(s)`, userId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Waitlist promotion notification ──
    if (notification_type === "waitlist_promoted" && record?.id && record?.user_id) {
      const userId = record.user_id;
      const bookingId = record.id;

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .eq("user_id", userId);

      if (!tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No device tokens for user" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let routeName = "your route";
      if (record.route_id) {
        const { data: route } = await supabase
          .from("routes")
          .select("name_en")
          .eq("id", record.route_id)
          .single();
        if (route) routeName = route.name_en;
      }

      await sendFCM(
        tokens,
        { title: "🎉 You're confirmed!", body: `A seat opened up on ${routeName}. Your booking is now confirmed!` },
        { booking_id: bookingId, type: "waitlist_promoted" }
      );

      return new Response(
        JSON.stringify({ message: "Waitlist promotion notification sent", userId, bookingId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Driver application approved → notify driver ──
    if (notification_type === "driver_approved" && record?.user_id) {
      const userId = record.user_id;

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .eq("user_id", userId);

      if (!tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No device tokens for driver" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendFCM(
        tokens,
        { title: "🎉 Welcome aboard!", body: "Your driver application has been approved. You can now start accepting rides!" },
        { type: "driver_approved" }
      );

      return new Response(
        JSON.stringify({ message: "Driver approval notification sent", userId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── New driver application → notify admins ──
    if (notification_type === "new_driver_application" && record?.user_id) {
      const applicantId = record.user_id;

      const { data: applicantProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", applicantId)
        .single();

      const applicantName = applicantProfile?.full_name || "A new driver";

      // Get all admin user IDs
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (!adminRoles || adminRoles.length === 0) {
        return new Response(
          JSON.stringify({ message: "No admins found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminIds = adminRoles.map((r: any) => r.user_id);

      // Get all device tokens for all admins
      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .in("user_id", adminIds);

      if (!tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No device tokens for admins" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendFCM(
        tokens,
        { title: "📋 New Driver Application", body: `${applicantName} has applied to become a driver. Review their application.` },
        { type: "new_driver_application", user_id: applicantId }
      );

      return new Response(
        JSON.stringify({ message: "Admin notification sent", adminCount: adminIds.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Trip started notification → notify all booked riders ──
    if (notification_type === "trip_started" && record?.shuttle_id && record?.route_id && record?.driver_id) {
      const { shuttle_id, route_id, driver_id, scheduled_date, scheduled_time, direction } = record;

      // Get driver name
      const { data: driverProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", driver_id)
        .single();
      const driverName = driverProfile?.full_name || "Your driver";

      // Get route name
      const { data: routeData } = await supabase
        .from("routes")
        .select("name_en, name_ar")
        .eq("id", route_id)
        .single();
      const routeName = routeData?.name_en || "your route";

      // Get all confirmed bookings for this trip
      let bookingsQuery = supabase
        .from("bookings")
        .select("user_id")
        .eq("shuttle_id", shuttle_id)
        .eq("route_id", route_id)
        .in("status", ["confirmed", "boarded"]);
      if (scheduled_date) bookingsQuery = bookingsQuery.eq("scheduled_date", scheduled_date);

      const { data: tripBookings } = await bookingsQuery;
      if (!tripBookings || tripBookings.length === 0) {
        return new Response(
          JSON.stringify({ message: "No bookings for this trip" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const riderIds = [...new Set(tripBookings.map((b: any) => b.user_id))];
      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .in("user_id", riderIds);

      if (tokens && tokens.length > 0) {
        const dirLabel = direction === "return" ? "return" : "going";
        await sendFCM(
          tokens,
          {
            title: `🚐 ${driverName} has started the trip!`,
            body: `The ${dirLabel} trip on ${routeName} is now active. Track the shuttle live!`,
          },
          { type: "trip_started", shuttle_id, route_id }
        );
      }

      return new Response(
        JSON.stringify({ message: "Trip started notifications sent", riderCount: riderIds.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Ride message notification ──
    if (type === "INSERT" && record?.booking_id && record?.sender_id) {
      const bookingId = record.booking_id;
      const senderId = record.sender_id;

      const { data: booking } = await supabase
        .from("bookings")
        .select("user_id, shuttle_id")
        .eq("id", bookingId)
        .single();

      if (!booking) {
        return new Response(
          JSON.stringify({ error: "Booking not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let recipientId: string | null = null;

      if (senderId === booking.user_id) {
        if (booking.shuttle_id) {
          const { data: shuttle } = await supabase
            .from("shuttles")
            .select("driver_id")
            .eq("id", booking.shuttle_id)
            .single();
          recipientId = shuttle?.driver_id || null;
        }
      } else {
        recipientId = booking.user_id;
      }

      if (!recipientId) {
        return new Response(
          JSON.stringify({ message: "No recipient found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token, platform")
        .eq("user_id", recipientId);

      if (!tokens || tokens.length === 0) {
        return new Response(
          JSON.stringify({ message: "No device tokens for recipient" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", senderId)
        .single();

      const senderName = senderProfile?.full_name || "Someone";

      await sendFCM(
        tokens,
        { title: `New message from ${senderName}`, body: record.message?.substring(0, 100) || "New message" },
        { booking_id: bookingId, type: "ride_message" }
      );

      return new Response(
        JSON.stringify({
          message: "Notification processed",
          recipient: recipientId,
          tokenCount: tokens.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "No action taken" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
