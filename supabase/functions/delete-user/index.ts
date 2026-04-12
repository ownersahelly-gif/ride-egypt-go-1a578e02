import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller using anon client
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect Bunny CDN paths to delete
    const bunnyPaths: string[] = [];

    // 1. Get driver application docs
    const { data: driverApps } = await supabaseAdmin
      .from("driver_applications")
      .select("id_front_url, id_back_url, driving_license_url, car_license_url, criminal_record_url, uber_proof_url")
      .eq("user_id", user_id);

    for (const app of driverApps || []) {
      for (const url of [app.id_front_url, app.id_back_url, app.driving_license_url, app.car_license_url, app.criminal_record_url, app.uber_proof_url]) {
        if (url) bunnyPaths.push(url);
      }
    }

    // 2. Get carpool verification docs
    const { data: carpoolVerifs } = await supabaseAdmin
      .from("carpool_verifications")
      .select("id_front_url, id_back_url, driving_license_url, car_license_url, selfie_url")
      .eq("user_id", user_id);

    for (const v of carpoolVerifs || []) {
      for (const url of [v.id_front_url, v.id_back_url, v.driving_license_url, v.car_license_url, v.selfie_url]) {
        if (url) bunnyPaths.push(url);
      }
    }

    // 3. Get profile avatar
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profile?.avatar_url) bunnyPaths.push(profile.avatar_url);

    // 4. Get booking payment proofs
    const { data: bookingsData } = await supabaseAdmin
      .from("bookings")
      .select("id, payment_proof_url")
      .eq("user_id", user_id);

    for (const b of bookingsData || []) {
      if (b.payment_proof_url) bunnyPaths.push(b.payment_proof_url);
    }

    // 5. Get bundle purchase proofs
    const { data: bundlePurchases } = await supabaseAdmin
      .from("bundle_purchases")
      .select("payment_proof_url")
      .eq("user_id", user_id);

    for (const bp of bundlePurchases || []) {
      if (bp.payment_proof_url) bunnyPaths.push(bp.payment_proof_url);
    }

    // Delete from Bunny CDN
    const STORAGE_API_KEY = Deno.env.get("BUNNY_STORAGE_API_KEY");
    const ZONE_NAME = Deno.env.get("BUNNY_STORAGE_ZONE_NAME");
    const REGION = Deno.env.get("BUNNY_STORAGE_REGION");
    const CDN_HOSTNAME = Deno.env.get("BUNNY_CDN_HOSTNAME");

    if (STORAGE_API_KEY && ZONE_NAME && REGION && CDN_HOSTNAME) {
      for (const cdnUrl of bunnyPaths) {
        try {
          // Extract path from CDN URL: https://hostname/path → path
          const filePath = cdnUrl.replace(`https://${CDN_HOSTNAME}/`, "");
          if (!filePath || filePath === cdnUrl) continue;

          const storageUrl = `https://${REGION}/${ZONE_NAME}/${filePath}`;
          await fetch(storageUrl, {
            method: "DELETE",
            headers: { AccessKey: STORAGE_API_KEY },
          });
        } catch (e) {
          console.warn("Failed to delete Bunny file:", cdnUrl, e);
        }
      }
    }

    // Delete all related database records (order matters for FK constraints)
    const bookingIds = (bookingsData || []).map((b) => b.id);

    // Delete ride messages for user's bookings
    if (bookingIds.length > 0) {
      await supabaseAdmin.from("ride_messages").delete().in("booking_id", bookingIds);
    }
    // Also delete messages sent by this user on other bookings
    await supabaseAdmin.from("ride_messages").delete().eq("sender_id", user_id);

    // Delete ratings
    if (bookingIds.length > 0) {
      await supabaseAdmin.from("ratings").delete().in("booking_id", bookingIds);
    }
    await supabaseAdmin.from("ratings").delete().eq("user_id", user_id);

    // Delete bookings
    await supabaseAdmin.from("bookings").delete().eq("user_id", user_id);

    // Delete bundle purchases
    await supabaseAdmin.from("bundle_purchases").delete().eq("user_id", user_id);

    // Delete saved locations
    await supabaseAdmin.from("saved_locations").delete().eq("user_id", user_id);

    // Delete route requests
    await supabaseAdmin.from("route_requests").delete().eq("user_id", user_id);

    // Delete device tokens
    await supabaseAdmin.from("device_tokens").delete().eq("user_id", user_id);

    // Delete carpool data
    await supabaseAdmin.from("carpool_messages").delete().eq("sender_id", user_id);
    // Get carpool route IDs owned by user
    const { data: carpoolRoutes } = await supabaseAdmin
      .from("carpool_routes")
      .select("id")
      .eq("user_id", user_id);
    const carpoolRouteIds = (carpoolRoutes || []).map((r) => r.id);
    if (carpoolRouteIds.length > 0) {
      await supabaseAdmin.from("carpool_messages").delete().in("route_id", carpoolRouteIds);
      await supabaseAdmin.from("carpool_requests").delete().in("route_id", carpoolRouteIds);
    }
    await supabaseAdmin.from("carpool_requests").delete().eq("user_id", user_id);
    await supabaseAdmin.from("carpool_routes").delete().eq("user_id", user_id);
    await supabaseAdmin.from("carpool_verifications").delete().eq("user_id", user_id);

    // Delete driver-related data
    await supabaseAdmin.from("driver_applications").delete().eq("user_id", user_id);
    // Get shuttle IDs for this driver
    const { data: driverShuttles } = await supabaseAdmin
      .from("shuttles")
      .select("id")
      .eq("driver_id", user_id);
    const shuttleIds = (driverShuttles || []).map((s) => s.id);
    if (shuttleIds.length > 0) {
      await supabaseAdmin.from("shuttle_schedules").delete().in("shuttle_id", shuttleIds);
      await supabaseAdmin.from("driver_schedules").delete().in("shuttle_id", shuttleIds);
    }
    await supabaseAdmin.from("driver_schedules").delete().eq("driver_id", user_id);
    // Delete ride instances created by this driver
    await supabaseAdmin.from("ride_instances").delete().eq("driver_id", user_id);
    // Delete shuttles
    await supabaseAdmin.from("shuttles").delete().eq("driver_id", user_id);

    // Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

    // Finally, delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authError) {
      console.error("Failed to delete auth user:", authError);
      return new Response(
        JSON.stringify({ error: `DB records deleted but auth user removal failed: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, bunny_files_deleted: bunnyPaths.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Delete user error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
