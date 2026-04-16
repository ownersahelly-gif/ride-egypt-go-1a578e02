import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Building2,
  Users, MapPin, Shield, CheckCircle2, Clock, XCircle,
} from 'lucide-react';

const MODE_LABELS: Record<string, { en: string; ar: string }> = {
  car_sharing: { en: 'Car-sharing', ar: 'مشاركة' },
  fuel_share: { en: 'Fuel share', ar: 'مشاركة وقود' },
  paid: { en: 'Paid', ar: 'مدفوع' },
};

export default function Communities() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [communities, setCommunities] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<Record<string, any>>({});
  const [routeCounts, setRouteCounts] = useState<Record<string, number>>({});
  const [routesByC, setRoutesByC] = useState<Record<string, any[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [cRes, mRes] = await Promise.all([
      supabase.from('communities').select('*').eq('status', 'active').order('name_en'),
      supabase.from('community_memberships').select('*').eq('user_id', user!.id),
    ]);
    const cs = cRes.data || [];
    setCommunities(cs);
    const mMap: Record<string, any> = {};
    (mRes.data || []).forEach((m: any) => { mMap[m.community_id] = m; });
    setMemberships(mMap);

    // Approved community ids → fetch their carpool routes for the live count
    const approvedIds = Object.values(mMap).filter((m: any) => m.status === 'approved').map((m: any) => m.community_id);
    if (approvedIds.length > 0) {
      const { data: rts } = await supabase
        .from('carpool_routes')
        .select('id, community_id, origin_name, destination_name, departure_time')
        .in('community_id', approvedIds)
        .eq('status', 'active');
      const byC: Record<string, any[]> = {};
      const counts: Record<string, number> = {};
      (rts || []).forEach((r: any) => {
        byC[r.community_id] = byC[r.community_id] || [];
        byC[r.community_id].push(r);
        counts[r.community_id] = (counts[r.community_id] || 0) + 1;
      });
      setRoutesByC(byC);
      setRouteCounts(counts);
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 shrink-0 safe-area-top">
        <button onClick={() => navigate(-1)} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {lang === 'ar' ? 'المجتمعات' : 'Communities'}
        </h1>
        <p className="text-sm text-primary-foreground/70 mt-1">
          {lang === 'ar' ? 'انضم لمجتمعك لرؤية رحلات مشاركة السيارة الخاصة به' : 'Join your community to see its private carpool rides'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {loading && <p className="text-center text-muted-foreground">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>}
        {!loading && communities.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {lang === 'ar' ? 'لا توجد مجتمعات حالياً' : 'No communities available yet.'}
          </p>
        )}

        {communities.map(c => {
          const m = memberships[c.id];
          const isOpen = expanded === c.id;
          const isApproved = m?.status === 'approved';
          const isPending = m?.status === 'pending';
          const isRejected = m?.status === 'rejected';
          const count = routeCounts[c.id] || 0;
          const routes = routesByC[c.id] || [];
          return (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors text-start"
                >
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{lang === 'ar' ? c.name_ar : c.name_en}</p>
                      {isApproved && (
                        <Badge className="bg-green-600 hover:bg-green-600 text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {lang === 'ar' ? 'موثق' : 'Verified'}
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Clock className="w-3 h-3" />
                          {lang === 'ar' ? 'قيد المراجعة' : 'Pending'}
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <XCircle className="w-3 h-3" />
                          {lang === 'ar' ? 'مرفوض' : 'Rejected'}
                        </Badge>
                      )}
                    </div>
                    {(c.description_en || c.description_ar) && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {lang === 'ar' ? c.description_ar : c.description_en}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      {isApproved && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {count} {lang === 'ar' ? 'رحلات نشطة' : `route${count === 1 ? '' : 's'}`}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {(c.allowed_modes || []).map((mode: string) => (
                          <Badge key={mode} variant="outline" className="text-[10px] px-1.5 py-0">
                            {lang === 'ar' ? MODE_LABELS[mode]?.ar : MODE_LABELS[mode]?.en}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                    {!m && (
                      <Button className="w-full" onClick={() => navigate(`/communities/${c.id}/verify`)}>
                        <Shield className="w-4 h-4 mr-2" />
                        {lang === 'ar' ? 'تقدّم للانضمام' : 'Apply to Join'}
                      </Button>
                    )}
                    {isPending && (
                      <p className="text-sm text-muted-foreground text-center">
                        {lang === 'ar' ? 'طلبك قيد المراجعة من قبل الإدارة' : 'Your application is under review by the admins.'}
                      </p>
                    )}
                    {isRejected && (
                      <>
                        <p className="text-sm text-destructive text-center">
                          {lang === 'ar' ? 'تم رفض طلبك' : 'Your application was rejected.'}
                          {m.admin_notes && <span className="block italic mt-1">"{m.admin_notes}"</span>}
                        </p>
                        <Button variant="outline" className="w-full" onClick={() => navigate(`/communities/${c.id}/verify`)}>
                          {lang === 'ar' ? 'إعادة المحاولة' : 'Re-apply'}
                        </Button>
                      </>
                    )}
                    {isApproved && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-primary" />
                            {lang === 'ar' ? `رحلات متاحة (${count})` : `Available routes (${count})`}
                          </p>
                          <Button size="sm" variant="link" onClick={() => navigate('/carpool')}>
                            {lang === 'ar' ? 'عرض الكل' : 'View all'}
                          </Button>
                        </div>
                        {routes.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            {lang === 'ar' ? 'لا توجد رحلات نشطة بعد' : 'No active rides yet. Be the first to post one!'}
                          </p>
                        )}
                        {routes.slice(0, 5).map(r => (
                          <div key={r.id} className="bg-background rounded-lg p-2.5 text-xs flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{r.origin_name} → {r.destination_name}</p>
                              <p className="text-muted-foreground">{r.departure_time?.slice(0, 5)}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
