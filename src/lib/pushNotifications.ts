type PushNotificationPayload = {
  notification_type: string;
  record: Record<string, unknown>;
};

export const sendPushNotification = async (payload: PushNotificationPayload) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase environment is missing');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const data = raw ? (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return { message: raw };
    }
  })() : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Function failed: ${response.status}`);
  }

  return data;
};
