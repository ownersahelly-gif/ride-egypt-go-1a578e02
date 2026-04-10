import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to Bunny Storage via edge function.
 * Returns the public CDN URL.
 */
export async function uploadToBunny(file: File, path: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  const { data: { session } } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/bunny-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token || anonKey}`,
      apikey: anonKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }

  const { publicUrl } = await response.json();
  return publicUrl;
}
