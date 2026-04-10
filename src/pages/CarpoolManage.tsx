import { useState, useEffect } from 'react';
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
import {
  ChevronLeft, ChevronRight, MapPin, Check, X, MessageCircle, Send, User, Trash2
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

  useEffect(() => {
    if (!id || !user) return;
    fetchData();
  }, [id, user]);

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

    // Fetch profiles for all participants
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
    const { data } = await supabase.from('carpool_messages').select('*').eq('route_id', id).order('created_at');
    setMessages(data || []);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!route) return null;

  const pendingReqs = requests.filter(r => r.status === 'pending');
  const acceptedReqs = requests.filter(r => r.status === 'accepted');

  return (
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">{lang === 'ar' ? 'إدارة الرحلة' : 'Manage Ride'}</h1>
        <p className="text-sm text-primary-foreground/70">{route.origin_name} → {route.destination_name}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Pending Requests */}
        {pendingReqs.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{lang === 'ar' ? 'طلبات جديدة' : 'New Requests'} ({pendingReqs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingReqs.map(req => (
                <div key={req.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{profiles[req.user_id]?.full_name || (lang === 'ar' ? 'مستخدم' : 'User')}</p>
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
              ))}
            </CardContent>
          </Card>
        )}

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
