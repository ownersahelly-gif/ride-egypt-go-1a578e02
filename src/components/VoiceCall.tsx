import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const MAX_CALL_DURATION = 90; // 1.5 minutes max

interface VoiceCallProps {
  tripId: string;
  userId: string;
}

const VoiceCall = ({ tripId, userId }: VoiceCallProps) => {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const clientRef = useRef<any>(null);
  const localTrackRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    if (localTrackRef.current) {
      localTrackRef.current.close();
      localTrackRef.current = null;
    }
    if (clientRef.current) {
      try { await clientRef.current.leave(); } catch {}
      clientRef.current = null;
    }
    setInCall(false);
    setDuration(0);
  }, []);

  // Auto-end at max duration
  useEffect(() => {
    if (inCall && duration >= MAX_CALL_DURATION) {
      endCall();
    }
  }, [duration, inCall, endCall]);

  const startCall = useCallback(async () => {
    try {
      setConnecting(true);

      const uid = Math.floor(Math.random() * 100000);
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: { channelName: `call_${tripId}`, uid },
      });

      if (error || !data?.token) {
        console.error('Failed to get Agora token:', error);
        setConnecting(false);
        return;
      }

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      const appId = data.appId || import.meta.env.VITE_AGORA_APP_ID;
      await client.join(appId, `call_${tripId}`, data.token, uid);

      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTrackRef.current = localAudioTrack;
      await client.publish([localAudioTrack]);

      client.on('user-published', async (user: any, mediaType: "audio" | "video" | "datachannel") => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setInCall(true);
    } catch (err) {
      console.error('Error starting call:', err);
    } finally {
      setConnecting(false);
    }
  }, [tripId]);

  if (inCall) {
    return (
      <Button
        onClick={endCall}
        size="icon"
        className="rounded-full bg-destructive hover:bg-destructive/90 w-10 h-10"
        title="End Call"
      >
        <PhoneOff className="w-5 h-5 text-white" />
      </Button>
    );
  }

  return (
    <Button
      onClick={startCall}
      size="icon"
      className="rounded-full bg-green-600 hover:bg-green-700 w-10 h-10"
      disabled={connecting}
      title="Call"
    >
      <Phone className="w-5 h-5 text-white" />
    </Button>
  );
};

export default VoiceCall;
