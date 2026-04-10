import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STORAGE_API_KEY = Deno.env.get("BUNNY_STORAGE_API_KEY");
    const ZONE_NAME = Deno.env.get("BUNNY_STORAGE_ZONE_NAME");
    const REGION = Deno.env.get("BUNNY_STORAGE_REGION");
    const CDN_HOSTNAME = Deno.env.get("BUNNY_CDN_HOSTNAME");

    if (!STORAGE_API_KEY || !ZONE_NAME || !REGION || !CDN_HOSTNAME) {
      throw new Error("Bunny storage configuration is incomplete");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const filePath = formData.get("path") as string;

    if (!file || !filePath) {
      return new Response(JSON.stringify({ error: "file and path are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();

    // Build the Bunny Storage API URL
    // Region format: "storage.bunnycdn.com" or "ny.storage.bunnycdn.com"
    const storageUrl = `https://${REGION}/${ZONE_NAME}/${filePath}`;

    const uploadResponse = await fetch(storageUrl, {
      method: "PUT",
      headers: {
        AccessKey: STORAGE_API_KEY,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Bunny upload failed [${uploadResponse.status}]: ${errorText}`);
    }

    // Return the CDN URL
    const publicUrl = `https://${CDN_HOSTNAME}/${filePath}`;

    return new Response(JSON.stringify({ publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Bunny upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
