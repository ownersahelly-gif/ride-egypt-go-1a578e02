import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronRight, ChevronLeft, Search, Filter, Shield, AlertCircle,
  Map, List, X, Navigation
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchFromCoords, setSearchFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchToCoords, setSearchToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const PROXIMITY_RADIUS_KM = 15;
  const [tab, setTab] = useState<'browse' | 'my-rides' | 'my-routes'>('browse');
  const [browseMode, setBrowseMode] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Filters
  const [filterTime, setFilterTime] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const reqChannel = supabase
      .channel('carpool-req-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'carpool_requests' }, async (payload) => {
        const req = payload.new as any;
        const myRoute = routes.find(r => r.id === req.route_id && r.user_id === user.id);
        if (myRoute) {
          toast({
            title: lang === 'ar' ? '🚗 طلب انضمام جديد!' : '🚗 New join request!',
            description: lang === 'ar'
              ? `شخص يريد الانضمام لرحلتك ${myRoute.origin_name} → ${myRoute.destination_name}`
              : `Someone wants to join your ride ${myRoute.origin_name} → ${myRoute.destination_name}`,
          });
          fetchData();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'carpool_requests' }, async (payload) => {
        const req = payload.new as any;
        if (req.user_id === user.id && req.status === 'accepted') {
          toast({ title: lang === 'ar' ? '✅ تم قبول طلبك!' : '✅ Request accepted!' });
          fetchData();
        }
        if (req.user_id === user.id && req.status === 'rejected') {
          toast({ title: lang === 'ar' ? '❌ تم رفض طلبك' : '❌ Request rejected', variant: 'destructive' });
          fetchData();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(reqChannel); };
  }, [user, routes, lang]);

  const fetchData = async () => {
    setLoading(true);
    const [routesRes, requestsRes, verRes] = await Promise.all([
      supabase.from('carpool_routes').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('carpool_requests').select('*, carpool_routes(*)').eq('user_id', user!.id),
      supabase.from('carpool_verifications').select('*').eq('user_id', user!.id).maybeSingle(),
    ]);
    const dbRoutes = routesRes.data || [];
    setRoutes(dbRoutes);
    setMyRequests(requestsRes.data || []);
    setVerification(verRes.data);
    setLoading(false);
  };

  const isVerified = verification?.status === 'approved';
  const hasPendingVerification = verification?.status === 'pending';

  const dayNames = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const filteredRoutes = routes.filter(r => {
    if (r.user_id === user?.id) return false;
    if (searchFromCoords) {
      const dist = getDistanceKm(searchFromCoords.lat, searchFromCoords.lng, r.origin_lat, r.origin_lng);
      if (dist > PROXIMITY_RADIUS_KM) return false;
    } else if (searchFrom) {
      if (!r.origin_name?.toLowerCase().includes(searchFrom.toLowerCase())) return false;
    }
    if (searchToCoords) {
      const dist = getDistanceKm(searchToCoords.lat, searchToCoords.lng, r.destination_lat, r.destination_lng);
      if (dist > PROXIMITY_RADIUS_KM) return false;
    } else if (searchTo) {
      if (!r.destination_name?.toLowerCase().includes(searchTo.toLowerCase())) return false;
    }
    if (filterTime) {
      const routeHour = parseInt(r.departure_time?.slice(0, 2) || '0');
      if (filterTime === 'early' && routeHour >= 8) return false;
      if (filterTime === 'morning' && (routeHour < 8 || routeHour >= 10)) return false;
      if (filterTime === 'midday' && (routeHour < 10 || routeHour >= 14)) return false;
      if (filterTime === 'afternoon' && routeHour < 14) return false;
    }
    if (filterDay && filterDay !== 'any') {
      const dayNum = parseInt(filterDay);
      if (r.is_daily && r.days_of_week?.length > 0 && !r.days_of_week.includes(dayNum)) return false;
    }
    return true;
  });

  // Sort
  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    if (sortBy === 'nearby' && userLocation) {
      const distA = getDistanceKm(userLocation.lat, userLocation.lng, a.origin_lat, a.origin_lng);
      const distB = getDistanceKm(userLocation.lat, userLocation.lng, b.origin_lat, b.origin_lng);
      return distA - distB;
    }
    if (sortBy === 'time') {
      return (a.departure_time || '').localeCompare(b.departure_time || '');
    }
    return 0; // recent = default DB order
  });

  const myRoutes = routes.filter(r => r.user_id === user?.id);

  const mapMarkers = sortedRoutes.flatMap(r => [
    { lat: r.origin_lat, lng: r.origin_lng, color: 'green' as const },
    { lat: r.destination_lat, lng: r.destination_lng, color: 'red' as const },
  ]);

  const mapConnectionLines = sortedRoutes.map(r => ({
    from: { lat: r.origin_lat, lng: r.origin_lng },
    to: { lat: r.destination_lat, lng: r.destination_lng },
    color: '#3B82F6',
  }));

  const hasActiveFilters = !!filterTime || (!!filterDay && filterDay !== 'any') || !!searchFromCoords || !!searchToCoords;

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
            {/* Search From / To */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-green-500 z-10" />
                    <PlacesAutocomplete
                      placeholder={lang === 'ar' ? 'من أين؟' : 'From where?'}
                      onSelect={(place) => { setSearchFrom(place.name); setSearchFromCoords({ lat: place.lat, lng: place.lng }); }}
                      className="pl-9"
                    />
                    {searchFromCoords && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10" onClick={() => { setSearchFrom(''); setSearchFromCoords(null); }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-destructive z-10" />
                    <PlacesAutocomplete
                      placeholder={lang === 'ar' ? 'إلى أين؟' : 'To where?'}
                      onSelect={(place) => { setSearchTo(place.name); setSearchToCoords({ lat: place.lat, lng: place.lng }); }}
                      className="pl-9"
                    />
                    {searchToCoords && (
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10" onClick={() => { setSearchTo(''); setSearchToCoords(null); }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant={hasActiveFilters ? 'default' : 'outline'} size="icon" onClick={() => setShowFilters(!showFilters)}>
                    <Filter className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setBrowseMode(browseMode === 'list' ? 'map' : 'list')}>
                    {browseMode === 'list' ? <Map className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {(searchFromCoords || searchToCoords) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Navigation className="w-3 h-3" />
                  <span>{lang === 'ar' ? `عرض الرحلات ضمن ${PROXIMITY_RADIUS_KM} كم` : `Showing rides within ${PROXIMITY_RADIUS_KM}km`}</span>
                  <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={() => { setSearchFrom(''); setSearchTo(''); setSearchFromCoords(null); setSearchToCoords(null); }}>
                    {lang === 'ar' ? 'مسح' : 'Clear'}
                  </Button>
                </div>
              )}
            </div>

            {/* Filter & Sort Panel */}
            {showFilters && (
              <Card>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{lang === 'ar' ? 'تصفية وترتيب' : 'Filter & Sort'}</p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={() => { setFilterTime(''); setFilterDay(''); setSearchFrom(''); setSearchTo(''); setSearchFromCoords(null); setSearchToCoords(null); }}>
                        <X className="w-3 h-3 mr-1" />{lang === 'ar' ? 'مسح' : 'Clear'}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {lang === 'ar' ? 'الترتيب' : 'Sort'}
                      </label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recent">{lang === 'ar' ? 'الأحدث' : 'Recent'}</SelectItem>
                          <SelectItem value="nearby">
                            <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{lang === 'ar' ? 'الأقرب' : 'Nearby'}</span>
                          </SelectItem>
                          <SelectItem value="time">{lang === 'ar' ? 'الوقت' : 'By time'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {lang === 'ar' ? 'وقت المغادرة' : 'Time'}
                      </label>
                      <Select value={filterTime} onValueChange={setFilterTime}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={lang === 'ar' ? 'أي وقت' : 'Any'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="early">{lang === 'ar' ? 'قبل 8' : '<8am'}</SelectItem>
                          <SelectItem value="morning">{lang === 'ar' ? '8-10' : '8-10am'}</SelectItem>
                          <SelectItem value="midday">{lang === 'ar' ? '10-2' : '10-2pm'}</SelectItem>
                          <SelectItem value="afternoon">{lang === 'ar' ? 'بعد 2' : '>2pm'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {lang === 'ar' ? 'اليوم' : 'Day'}
                      </label>
                      <Select value={filterDay} onValueChange={setFilterDay}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder={lang === 'ar' ? 'أي يوم' : 'Any'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{lang === 'ar' ? 'أي يوم' : 'Any'}</SelectItem>
                          {dayNames.map((name, i) => (
                            <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Nearby badge when sorted */}
            {sortBy === 'nearby' && !userLocation && (
              <p className="text-xs text-muted-foreground text-center">
                {lang === 'ar' ? 'يرجى السماح بالموقع للترتيب حسب القرب' : 'Allow location access to sort by proximity'}
              </p>
            )}

            {/* Map View */}
            {browseMode === 'map' && (
              <div className="h-80 rounded-xl overflow-hidden border border-border">
                <MapView
                  markers={mapMarkers}
                  connectionLines={mapConnectionLines}
                  zoom={10}
                  showUserLocation
                  center={searchFromCoords || searchToCoords || undefined}
                />
              </div>
            )}

            {/* Route cards */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : sortedRoutes.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? (lang === 'ar' ? 'لا نتائج تطابق الفلاتر' : 'No rides match your filters')
                    : (lang === 'ar' ? 'لا توجد رحلات متاحة حالياً' : 'No rides available right now')
                  }
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-3" onClick={() => { setFilterTime(''); setFilterDay(''); }}>
                    {lang === 'ar' ? 'مسح الفلاتر' : 'Clear filters'}
                  </Button>
                )}
              </div>
            ) : (
              sortedRoutes.map(route => {
                const distKm = userLocation ? getDistanceKm(userLocation.lat, userLocation.lng, route.origin_lat, route.origin_lng) : null;
                return (
                  <Card
                    key={route.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      if (route.id.startsWith('demo-')) {
                        toast({ title: lang === 'ar' ? 'تجريبي' : 'Demo', description: lang === 'ar' ? 'هذه رحلة تجريبية' : 'This is a demo ride' });
                        return;
                      }
                      navigate(`/carpool/route/${route.id}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                            <p className="text-sm font-medium truncate">{route.origin_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                            <p className="text-sm font-medium truncate">{route.destination_name}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          {route.id.startsWith('demo-') && (
                            <Badge variant="outline" className="text-[10px]">{lang === 'ar' ? 'تجريبي' : 'Demo'}</Badge>
                          )}
                          {route.share_fuel && route.fuel_share_amount > 0 && (
                            <Badge variant="secondary">
                              <Fuel className="w-3 h-3 mr-1" />
                              EGP {route.fuel_share_amount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const routeDistKm = getDistanceKm(route.origin_lat, route.origin_lng, route.destination_lat, route.destination_lng);
                        const etaMin = Math.round((routeDistKm / 35) * 60); // ~35 km/h avg Cairo traffic
                        return (
                          <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {route.departure_time?.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {route.available_seats} {lang === 'ar' ? 'مقاعد' : 'seats'}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {routeDistKm.toFixed(1)} km
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ~{etaMin} {lang === 'ar' ? 'د' : 'min'}
                            </span>
                            {distKm !== null && (
                              <span className="flex items-center gap-1 text-primary">
                                <Navigation className="w-3 h-3" />
                                {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`} {lang === 'ar' ? 'منك' : 'away'}
                              </span>
                            )}
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
                        );
                      })()}
                      {route.is_daily && route.days_of_week?.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {route.days_of_week.map((d: number) => (
                            <span key={d} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{dayNames[d]}</span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
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
                        {req.status === 'accepted' ? (lang === 'ar' ? 'مقبول' : 'Accepted') : req.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الركوب:' : 'Pickup:'} {req.pickup_name}</p>
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'النزول:' : 'Dropoff:'} {req.dropoff_name}</p>
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
