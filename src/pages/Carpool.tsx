import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BottomNav from '@/components/BottomNav';
import MapView from '@/components/MapView';
import {
  Plus, MapPin, Clock, Users, Fuel, RefreshCw, Car,
  ChevronRight, ChevronLeft, Search, Filter, Shield, AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const Carpool = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [routes, setRoutes] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'browse' | 'my-rides' | 'my-routes'>('browse');

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [routesRes, requestsRes, verRes] = await Promise.all([
      supabase.from('carpool_routes').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('carpool_requests').select('*, carpool_routes(*)').eq('user_id', user!.id),
      supabase.from('carpool_verifications').select('*').eq('user_id', user!.id).maybeSingle(),
    ]);
    setRoutes(routesRes.data || []);
    setMyRequests(requestsRes.data || []);
    setVerification(verRes.data);
    setLoading(false);
  };

  const isVerified = verification?.status === 'approved';
  const hasPendingVerification = verification?.status === 'pending';

  const filteredRoutes = routes.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.origin_name?.toLowerCase().includes(s) || r.destination_name?.toLowerCase().includes(s);
  });

  const myRoutes = routes.filter(r => r.user_id === user?.id);

  const dayNames = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold font-heading">
            {lang === 'ar' ? 'مشاركة الرحلات' : 'Carpooling'}
          </h1>
          {isVerified ? (
            <Button size="sm" variant="secondary" onClick={() => navigate('/carpool/post')}>
              <Plus className="w-4 h-4 mr-1" />
              {lang === 'ar' ? 'أضف رحلة' : 'Post Ride'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => navigate('/carpool/verify')}>
              <Shield className="w-4 h-4 mr-1" />
              {lang === 'ar' ? 'التحقق' : 'Verify'}
            </Button>
          )}
        </div>

        {/* Verification Banner */}
        {!isVerified && (
          <div className="bg-secondary/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {hasPendingVerification
                  ? (lang === 'ar' ? 'التحقق قيد المراجعة' : 'Verification under review')
                  : (lang === 'ar' ? 'يجب التحقق من هويتك للمشاركة' : 'Verify your identity to participate')
                }
              </p>
              {!hasPendingVerification && (
                <Button size="sm" variant="link" className="text-primary-foreground p-0 h-auto" onClick={() => navigate('/carpool/verify')}>
                  {lang === 'ar' ? 'ابدأ التحقق ←' : 'Start verification →'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card">
        {(['browse', 'my-rides', 'my-routes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {t === 'browse'
              ? (lang === 'ar' ? 'استكشاف' : 'Browse')
              : t === 'my-rides'
                ? (lang === 'ar' ? 'رحلاتي' : 'My Rides')
                : (lang === 'ar' ? 'مساراتي' : 'My Routes')
            }
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === 'browse' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={lang === 'ar' ? 'ابحث عن موقع...' : 'Search locations...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'ar' ? 'لا توجد رحلات متاحة حالياً' : 'No rides available right now'}
                </p>
                {isVerified && (
                  <Button className="mt-4" onClick={() => navigate('/carpool/post')}>
                    {lang === 'ar' ? 'كن أول من يضيف رحلة' : 'Be the first to post a ride'}
                  </Button>
                )}
              </div>
            ) : (
              filteredRoutes.filter(r => r.user_id !== user.id).map(route => (
                <Card key={route.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/carpool/route/${route.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <p className="text-sm font-medium truncate">{route.origin_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                          <p className="text-sm font-medium truncate">{route.destination_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {route.share_fuel && route.fuel_share_amount > 0 && (
                          <Badge variant="secondary" className="mb-1">
                            <Fuel className="w-3 h-3 mr-1" />
                            EGP {route.fuel_share_amount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {route.departure_time?.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}
                      </span>
                      {route.is_daily && (
                        <Badge variant="outline" className="text-[10px]">
                          {lang === 'ar' ? 'يومي' : 'Daily'}
                        </Badge>
                      )}
                      {route.allow_car_swap && (
                        <Badge variant="outline" className="text-[10px]">
                          <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                          {lang === 'ar' ? 'تبادل' : 'Swap'}
                        </Badge>
                      )}
                    </div>
                    {route.is_daily && route.days_of_week?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {route.days_of_week.map((d: number) => (
                          <span key={d} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{dayNames[d]}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'my-rides' && (
          <>
            {myRequests.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'ar' ? 'لم تنضم لأي رحلة بعد' : "You haven't joined any rides yet"}
                </p>
              </div>
            ) : (
              myRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">
                        {req.carpool_routes?.origin_name} → {req.carpool_routes?.destination_name}
                      </p>
                      <Badge variant={req.status === 'accepted' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>
                        {req.status === 'accepted'
                          ? (lang === 'ar' ? 'مقبول' : 'Accepted')
                          : req.status === 'pending'
                            ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending')
                            : (lang === 'ar' ? 'مرفوض' : 'Rejected')
                        }
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ar' ? 'الركوب:' : 'Pickup:'} {req.pickup_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ar' ? 'النزول:' : 'Dropoff:'} {req.dropoff_name}
                    </p>
                    {req.status === 'accepted' && (
                      <Button size="sm" className="mt-2 w-full" onClick={() => navigate(`/carpool/route/${req.route_id}`)}>
                        {lang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'my-routes' && (
          <>
            {myRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {lang === 'ar' ? 'لم تنشر أي رحلة بعد' : "You haven't posted any rides yet"}
                </p>
                {isVerified && (
                  <Button className="mt-4" onClick={() => navigate('/carpool/post')}>
                    {lang === 'ar' ? 'أضف رحلة جديدة' : 'Post a Ride'}
                  </Button>
                )}
              </div>
            ) : (
              myRoutes.map(route => (
                <Card key={route.id} className="cursor-pointer" onClick={() => navigate(`/carpool/manage/${route.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{route.origin_name} → {route.destination_name}</p>
                        <p className="text-xs text-muted-foreground">{route.departure_time?.slice(0, 5)}</p>
                      </div>
                      <Badge variant={route.status === 'active' ? 'default' : 'secondary'}>
                        {route.status === 'active' ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'متوقف' : 'Paused')}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}</span>
                      {route.share_fuel && <span>• {lang === 'ar' ? 'مشاركة بنزين' : 'Fuel share'}</span>}
                      {route.allow_car_swap && <span>• {lang === 'ar' ? 'تبادل سيارات' : 'Car swap'}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Carpool;
