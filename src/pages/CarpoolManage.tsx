import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import MapView from '@/components/MapView';
import {
  ChevronLeft, ChevronRight, MapPin, Check, X, MessageCircle, Send, User, Trash2,
  Phone, Play, Square, Navigation
} from 'lucide-react';

const CarpoolManage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [route, setRoute] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [rideStarted, setRideStarted] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchData();
  }, [id, user]);

  // Realtime chat
  useEffect(() => {
    if (!id) return;
    const chan = supabase
      .channel(`carpool-chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'carpool_messages', filter: `route_id=eq.${id}` }, (payload) => {
        const msg = payload.new as any;
        setMessages(prev => [...prev, msg]);
        // Fetch profile if missing
        if (!profiles[msg.sender_id]) {
          supabase.from('profiles').select('*').eq('user_id', msg.sender_id).maybeSingle().then(({ data }) => {
            if (data) setProfiles(prev => ({ ...prev, [data.user_id]: data }));
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [id, profiles]);

  const fetchData = async () => {
    setLoading(true);
    const [routeRes, reqRes, msgRes] = await Promise.all([
      supabase.from('carpool_routes').select('*').eq('id', id).single(),
      supabase.from('carpool_requests').select('*').eq('route_id', id).order('created_at'),
      supabase.from('carpool_messages').select('*').eq('route_id', id).order('created_at'),
    ]);
    setRoute(routeRes.data);
    setRequests(reqRes.data || []);
    setMessages(msgRes.data || []);

    const userIds = new Set<string>();
    reqRes.data?.forEach((r: any) => userIds.add(r.user_id));
    msgRes.data?.forEach((m: any) => userIds.add(m.sender_id));
    if (userIds.size > 0) {
      const { data: profs } = await supabase.from('profiles').select('*').in('user_id', Array.from(userIds));
      const map: Record<string, any> = {};
      profs?.forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  const updateRequest = async (reqId: string, status: string) => {
    const { error } = await supabase.from('carpool_requests').update({ status }).eq('id', reqId);
    if (!error) {
      toast({ title: lang === 'ar' ? 'تم!' : 'Done!' });
      fetchData();
    }
  };

  const deleteRoute = async () => {
    const { error } = await supabase.from('carpool_routes').delete().eq('id', id);
    if (!error) {
      toast({ title: lang === 'ar' ? 'تم الحذف' : 'Deleted' });
      navigate('/carpool');
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user) return;
    await supabase.from('carpool_messages').insert({ route_id: id, sender_id: user.id, message: newMsg.trim() });
    setNewMsg('');
  };

  // Start/stop ride with live location broadcasting via Supabase Realtime Broadcast
  const startRide = () => {
    if (!navigator.geolocation || !id) return;
    setRideStarted(true);
    // Notify passengers via a chat message
    supabase.from('carpool_messages').insert({
      route_id: id,
      sender_id: user!.id,
      message: lang === 'ar' ? '🚗 تم بدء الرحلة! أنا في الطريق لاصطحابكم.' : '🚗 Ride started! I\'m on my way to pick you all up.',
    });

    const channel = supabase.channel(`driver-location-${id}`);
    channel.subscribe();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        channel.send({
          type: 'broadcast',
          event: 'location',
          payload: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  };

  const stopRide = () => {
    setRideStarted(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    supabase.removeChannel(supabase.channel(`driver-location-${id}`));
    supabase.from('carpool_messages').insert({
      route_id: id,
      sender_id: user!.id,
      message: lang === 'ar' ? '✅ تم إنهاء الرحلة. شكراً للجميع!' : '✅ Ride ended. Thanks everyone!',
    });
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center overflow-hidden"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!route) return null;

  const pendingReqs = requests.filter(r => r.status === 'pending');
  const acceptedReqs = requests.filter(r => r.status === 'accepted');

  const mapMarkers = [
    { lat: route.origin_lat, lng: route.origin_lng, color: 'green' as const },
    { lat: route.destination_lat, lng: route.destination_lng, color: 'red' as const },
    ...acceptedReqs.map(r => ({
      lat: r.pickup_lat, lng: r.pickup_lng,
      color: 'orange' as const,
    })),
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-4 shrink-0 safe-area-top">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">{lang === 'ar' ? 'إدارة الرحلة' : 'Manage Ride'}</h1>
        <p className="text-sm text-primary-foreground/70 truncate">{route.origin_name} → {route.destination_name}</p>
      </div>

      <div className="h-48">
        <MapView
          markers={mapMarkers}
          origin={{ lat: route.origin_lat, lng: route.origin_lng }}
          destination={{ lat: route.destination_lat, lng: route.destination_lng }}
          showDirections
          zoom={11}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Start/Stop Ride */}
        {acceptedReqs.length > 0 && (
          <Card className={rideStarted ? 'border-green-500 bg-green-500/5' : ''}>
            <CardContent className="p-4">
              {!rideStarted ? (
                <Button className="w-full" onClick={startRide}>
                  <Play className="w-4 h-4 mr-2" />
                  {lang === 'ar' ? 'بدء الرحلة وإرسال موقعي المباشر' : 'Start Ride & Share Live Location'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <Navigation className="w-4 h-4 animate-pulse" />
                    <span className="text-sm font-medium">{lang === 'ar' ? 'الرحلة جارية — موقعك يُبث مباشرة' : 'Ride in progress — sharing live location'}</span>
                  </div>
                  <Button variant="destructive" className="w-full" onClick={stopRide}>
                    <Square className="w-4 h-4 mr-2" />
                    {lang === 'ar' ? 'إنهاء الرحلة' : 'End Ride'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {lang === 'ar' ? 'طلبات الانضمام' : 'Join Requests'} ({pendingReqs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {lang === 'ar' ? 'لا طلبات جديدة — شارك رابط رحلتك ليطلب الآخرون الانضمام' : 'No requests yet — share your ride link so others can request to join'}
              </p>
            ) : (
              pendingReqs.map(req => (
                <div key={req.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{profiles[req.user_id]?.full_name || (lang === 'ar' ? 'مستخدم' : 'User')}</p>
                    {profiles[req.user_id]?.phone && (
                      <a href={`tel:${profiles[req.user_id].phone}`} className="text-primary" onClick={e => e.stopPropagation()}>
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 inline mr-1" />{req.pickup_name} → {req.dropoff_name}
                  </p>
                  {req.message && <p className="text-xs text-muted-foreground mt-1 italic">"{req.message}"</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1" onClick={() => updateRequest(req.id, 'accepted')}>
                      <Check className="w-4 h-4 mr-1" />{lang === 'ar' ? 'قبول' : 'Accept'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => updateRequest(req.id, 'rejected')}>
                      <X className="w-4 h-4 mr-1" />{lang === 'ar' ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Accepted Passengers */}
        <Card>
          <CardHeader><CardTitle className="text-base">{lang === 'ar' ? 'الركاب المقبولين' : 'Accepted Passengers'} ({acceptedReqs.length})</CardTitle></CardHeader>
          <CardContent>
            {acceptedReqs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{lang === 'ar' ? 'لا ركاب بعد' : 'No passengers yet'}</p>
            ) : (
              <div className="space-y-2">
                {acceptedReqs.map(req => (
                  <div key={req.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{profiles[req.user_id]?.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{req.pickup_name} → {req.dropoff_name}</p>
                      {profiles[req.user_id]?.phone && (
                        <a href={`tel:${profiles[req.user_id].phone}`} className="text-xs text-primary flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                          <Phone className="w-3 h-3" />{profiles[req.user_id].phone}
                        </a>
                      )}
                    </div>
                    <Badge>{lang === 'ar' ? 'مقبول' : 'Accepted'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4" />{lang === 'ar' ? 'المحادثة' : 'Group Chat'}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{lang === 'ar' ? 'لا رسائل' : 'No messages'}</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.sender_id !== user?.id && <p className="text-[10px] font-medium mb-0.5">{profiles[m.sender_id]?.full_name || 'User'}</p>}
                    <p className="text-sm">{m.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder={lang === 'ar' ? 'اكتب رسالة...' : 'Type...'} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <Button size="icon" onClick={sendMessage}><Send className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete */}
        <Button variant="destructive" className="w-full" onClick={deleteRoute}>
          <Trash2 className="w-4 h-4 mr-2" />{lang === 'ar' ? 'حذف الرحلة' : 'Delete Ride'}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CarpoolManage;
