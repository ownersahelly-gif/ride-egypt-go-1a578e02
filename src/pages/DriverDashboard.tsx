import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Globe, LogOut, User, MapPin, Clock, Users, Car, Calendar, DollarSign, Navigation, CheckCircle2, XCircle, Loader2, Play, Plus, Trash2, Repeat, TrendingUp, Star, Route, ArrowRight, AlertCircle, Info, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useDriverBookingNotifications } from '@/hooks/useBookingNotifications';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapView from '@/components/MapView';
import RideChat from '@/components/RideChat';

type TabType = 'overview' | 'routes' | 'trips' | 'earnings' | 'schedule' | 'shuttle';

const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>('overview');
  const [shuttle, setShuttle] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [route, setRoute] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [passengerProfiles, setPassengerProfiles] = useState<Record<string, any>>({});
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [chatPassengerName, setChatPassengerName] = useState<string>('');

  // Schedule states
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedRouteForSchedule, setSelectedRouteForSchedule] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    route_id: '',
    days: [] as number[],
    departure_time: '08:00',
    return_time: '17:00',
    is_recurring: true,
    min_passengers: 5,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Route request states
  const [showRouteRequest, setShowRouteRequest] = useState(false);
  const [routeRequestForm, setRouteRequestForm] = useState({
    origin_name: '',
    origin_lat: 0,
    origin_lng: 0,
    destination_name: '',
    destination_lat: 0,
    destination_lng: 0,
    preferred_time_go: '08:00',
    preferred_time_return: '17:00',
  });
  const [savingRouteRequest, setSavingRouteRequest] = useState(false);
  const [pickingLocation, setPickingLocation] = useState<'origin' | 'destination' | null>(null);

  useDriverBookingNotifications(shuttle?.id || null);

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
        const [{ data: profileData }, { data: shuttleData }, { data: routesData }] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', user.id).single(),
          supabase.from('shuttles').select('*, routes(*)').eq('driver_id', user.id).limit(1).maybeSingle(),
          supabase.from('routes').select('*, stops(*)').eq('status', 'active'),
        ]);

        setProfile(profileData);
        setAllRoutes(routesData || []);

        if (shuttleData) {
          setShuttle(shuttleData);
          setRoute(shuttleData.routes);

          const [{ data: bookingsData }, { data: schedulesData }] = await Promise.all([
            supabase.from('bookings').select('*, routes(*)').eq('shuttle_id', shuttleData.id).order('scheduled_date', { ascending: true }).limit(50),
            supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes)').eq('driver_id', user.id).order('day_of_week'),
          ]);
          setBookings(bookingsData || []);
          setDriverSchedules(schedulesData || []);

          // Fetch passenger profiles
          if (bookingsData && bookingsData.length > 0) {
            const userIds = [...new Set(bookingsData.map((b: any) => b.user_id))];
            const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
            if (profiles) {
              const profileMap: Record<string, any> = {};
              profiles.forEach((p: any) => { profileMap[p.user_id] = p; });
              setPassengerProfiles(profileMap);
            }
          }
        }
        setLoading(false);
      };
      fetchData();
    }, [user]);

    const handleSignOut = async () => { await signOut(); navigate('/'); };

    const toggleTrip = (key: string) => {
      setExpandedTrips(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };

    // Optimize passenger order using nearest-neighbor for fuel efficiency
    const optimizePassengerOrder = (passengers: any[], routeOrigin: { lat: number; lng: number }, routeDestination: { lat: number; lng: number }) => {
      type WP = { type: 'pickup' | 'dropoff'; bookingIdx: number; coords: { lat: number; lng: number }; label: string };
      if (passengers.length === 0) return [] as WP[];

      const getPickupCoords = (p: any) => ({
        lat: p.custom_pickup_lat || routeOrigin.lat,
        lng: p.custom_pickup_lng || routeOrigin.lng,
      });

      const getDropoffCoords = (p: any) => ({
        lat: p.custom_dropoff_lat || routeDestination.lat,
        lng: p.custom_dropoff_lng || routeDestination.lng,
      });

      const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
        Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));

      // Build waypoints: all pickups then all dropoffs
      const waypoints: WP[] = [];
      passengers.forEach((p, i) => {
        waypoints.push({ type: 'pickup', bookingIdx: i, coords: getPickupCoords(p), label: passengerProfiles[p.user_id]?.full_name || `Passenger ${i + 1}` });
        waypoints.push({ type: 'dropoff', bookingIdx: i, coords: getDropoffCoords(p), label: passengerProfiles[p.user_id]?.full_name || `Passenger ${i + 1}` });
      });

      // Nearest-neighbor from route origin, pickups first then dropoffs
      const pickups = waypoints.filter(w => w.type === 'pickup');
      const dropoffs = waypoints.filter(w => w.type === 'dropoff');

      const sortByNearest = (points: WP[], start: { lat: number; lng: number }) => {
        const sorted: WP[] = [];
        const remaining = [...points];
        let current = start;
        while (remaining.length > 0) {
          let nearestIdx = 0;
          let nearestDist = Infinity;
          remaining.forEach((p, i) => {
            const d = dist(current, p.coords);
            if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
          });
          sorted.push(remaining[nearestIdx]);
          current = remaining[nearestIdx].coords;
          remaining.splice(nearestIdx, 1);
        }
        return sorted;
      };

      const sortedPickups = sortByNearest(pickups, routeOrigin);
      const lastPickup = sortedPickups.length > 0 ? sortedPickups[sortedPickups.length - 1].coords : routeOrigin;
      const sortedDropoffs = sortByNearest(dropoffs, lastPickup);

      return [...sortedPickups, ...sortedDropoffs];
    };

  const updateShuttleStatus = async (newStatus: string) => {
    if (!shuttle) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from('shuttles').update({ status: newStatus }).eq('id', shuttle.id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setShuttle({ ...shuttle, status: newStatus });
      toast({ title: t('driverDash.statusUpdated') });
    }
    setUpdatingStatus(false);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      toast({ title: t('driverDash.bookingUpdated') });
    }
  };

  const toggleDay = (day: number) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day],
    }));
  };

  const openScheduleForRoute = (routeObj: any) => {
    setSelectedRouteForSchedule(routeObj);
    setScheduleForm(prev => ({ ...prev, route_id: routeObj.id }));
    setShowScheduleForm(true);
    setTab('schedule');
  };

  const saveSchedule = async () => {
    if (!user || !shuttle || !scheduleForm.route_id || scheduleForm.days.length === 0) return;
    setSavingSchedule(true);

    // Create departure entries
    const departureEntries = scheduleForm.days.map(day => ({
      driver_id: user.id,
      route_id: scheduleForm.route_id,
      shuttle_id: shuttle.id,
      day_of_week: day,
      departure_time: scheduleForm.departure_time,
      is_recurring: scheduleForm.is_recurring,
      is_active: true,
      min_passengers: scheduleForm.min_passengers,
      return_time: scheduleForm.return_time || null,
    }));

    const { error } = await supabase.from('driver_schedules').insert(departureEntries);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم حفظ الجدول بنجاح!' : 'Schedule saved successfully!' });
      await generateRideInstances(departureEntries);
      const { data } = await supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes)').eq('driver_id', user.id).order('day_of_week');
      setDriverSchedules(data || []);
      setShowScheduleForm(false);
      setSelectedRouteForSchedule(null);
      setScheduleForm({ route_id: '', days: [], departure_time: '08:00', return_time: '17:00', is_recurring: true, min_passengers: 5 });
    }
    setSavingSchedule(false);
  };

  const generateRideInstances = async (scheduleEntries: any[]) => {
    if (!user || !shuttle) return;
    const instances: any[] = [];
    const today = new Date();

    for (const entry of scheduleEntries) {
      const weeksAhead = entry.is_recurring ? 4 : 1;
      for (let w = 0; w < weeksAhead; w++) {
        for (let d = 0; d < 7; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() + (w * 7) + d);
          if (date.getDay() === entry.day_of_week && date >= today) {
            instances.push({
              driver_id: user.id,
              route_id: entry.route_id,
              shuttle_id: shuttle.id,
              ride_date: date.toISOString().split('T')[0],
              departure_time: entry.departure_time,
              available_seats: shuttle.capacity,
              total_seats: shuttle.capacity,
              status: 'scheduled',
            });
          }
        }
      }
    }

    if (instances.length > 0) {
      await supabase.from('ride_instances').upsert(instances, { onConflict: 'shuttle_id,ride_date,departure_time' });
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from('driver_schedules').delete().eq('id', id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setDriverSchedules(prev => prev.filter(s => s.id !== id));
      toast({ title: lang === 'ar' ? 'تم حذف الجدول' : 'Schedule removed' });
    }
  };

  const submitRouteRequest = async () => {
    if (!user || !routeRequestForm.origin_name || !routeRequestForm.destination_name) return;
    setSavingRouteRequest(true);
    const { error } = await supabase.from('route_requests').insert({
      user_id: user.id,
      origin_name: routeRequestForm.origin_name,
      origin_lat: routeRequestForm.origin_lat,
      origin_lng: routeRequestForm.origin_lng,
      destination_name: routeRequestForm.destination_name,
      destination_lat: routeRequestForm.destination_lat,
      destination_lng: routeRequestForm.destination_lng,
      preferred_time: routeRequestForm.preferred_time_go,
      status: 'pending',
    });
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Route request submitted!', description: lang === 'ar' ? 'سيتم مراجعته وإضافته قريباً' : 'It will be reviewed and added soon' });
      setShowRouteRequest(false);
      setRouteRequestForm({ origin_name: '', origin_lat: 0, origin_lng: 0, destination_name: '', destination_lat: 0, destination_lng: 0, preferred_time_go: '08:00', preferred_time_return: '17:00' });
      setPickingLocation(null);
    }
    setSavingRouteRequest(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!pickingLocation) return;
    if (pickingLocation === 'origin') {
      setRouteRequestForm(p => ({ ...p, origin_lat: lat, origin_lng: lng, origin_name: p.origin_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    } else {
      setRouteRequestForm(p => ({ ...p, destination_lat: lat, destination_lng: lng, destination_name: p.destination_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-muted text-muted-foreground',
    maintenance: 'bg-secondary/20 text-secondary',
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const tabs: { key: TabType; icon: any; label: string }[] = [
    { key: 'overview', icon: Car, label: t('driverDash.overview') },
    { key: 'routes', icon: Route, label: lang === 'ar' ? 'المسارات' : 'Routes' },
    { key: 'trips', icon: Navigation, label: t('driverDash.trips') },
    { key: 'earnings', icon: TrendingUp, label: lang === 'ar' ? 'الأرباح' : 'Earnings' },
    { key: 'schedule', icon: Calendar, label: t('driverDash.schedule') },
    { key: 'shuttle', icon: MapPin, label: t('driverDash.shuttleInfo') },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const todayBookings = bookings.filter(b => b.scheduled_date === new Date().toISOString().split('T')[0] && b.status !== 'cancelled');
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

  // Calculate expected earnings per route based on price * capacity * scheduled days per week
  const getExpectedEarnings = (routeObj: any) => {
    const price = parseFloat(routeObj.price || 0);
    const capacity = shuttle?.capacity || 14;
    // Driver gets 90% of fare
    const driverShare = price * 0.9;
    return {
      perTrip: driverShare * capacity,
      perDay: driverShare * capacity * 2, // going + return
      perWeek: driverShare * capacity * 2 * 5, // 5 working days
      perMonth: driverShare * capacity * 2 * 22, // ~22 working days
      pricePerSeat: price,
      driverPerSeat: driverShare,
    };
  };

  // Get routes the driver is already scheduled on
  const scheduledRouteIds = new Set(driverSchedules.map(s => s.route_id));

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">{lang === 'ar' ? 'مسار' : 'Massar'}</Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{t('driverDash.driverPanel')}</span>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {!shuttle && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}</h2>
            <p className="text-muted-foreground mb-4">{lang === 'ar' ? 'تم استلام طلبك وجاري مراجعته. سيتم تفعيل حسابك تلقائياً عند الموافقة.' : 'Your application has been received and is being reviewed. Your account will be activated automatically once approved.'}</p>
          </div>
        )}

        {shuttle && (
          <>
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 overflow-x-auto">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: Navigation, value: todayBookings.length, label: t('driverDash.todayTrips'), bg: 'bg-primary/10', color: 'text-primary' },
                    { icon: Clock, value: pendingBookings.length, label: t('driverDash.pendingBookings'), bg: 'bg-secondary/10', color: 'text-secondary' },
                    { icon: DollarSign, value: `${totalEarnings.toFixed(0)} EGP`, label: t('driverDash.totalEarnings'), bg: 'bg-green-50', color: 'text-green-600' },
                    { icon: Users, value: shuttle.capacity, label: t('driverDash.capacity'), bg: 'bg-primary/10', color: 'text-primary' },
                  ].map((s, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-5">
                      <div className={`w-10 h-10 rounded-lg mb-2 flex items-center justify-center ${s.bg}`}>
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Quick action: if no schedules, prompt to browse routes */}
                {driverSchedules.length === 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Route className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">
                          {lang === 'ar' ? 'ابدأ بتحديد مسارك!' : 'Get started — choose your route!'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {lang === 'ar' ? 'تصفح المسارات المتاحة واختر الأنسب لك، ثم حدد أيام ومواعيد عملك' : 'Browse available routes, pick the best one for you, then set your working days and times'}
                        </p>
                        <Button onClick={() => setTab('routes')}>
                          <Route className="w-4 h-4 me-1" />
                          {lang === 'ar' ? 'تصفح المسارات' : 'Browse Routes'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{t('driverDash.shuttleStatus')}</h3>
                      <p className="text-sm text-muted-foreground">{shuttle.vehicle_model} · {shuttle.vehicle_plate}</p>
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusColors[shuttle.status] || ''}`}>
                      {t(`driverDash.status.${shuttle.status}`)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={shuttle.status === 'active' ? 'default' : 'outline'}
                      onClick={() => updateShuttleStatus('active')} disabled={updatingStatus}>
                      <CheckCircle2 className="w-4 h-4 me-1" />{t('driverDash.goOnline')}
                    </Button>
                    <Button size="sm" variant={shuttle.status === 'inactive' ? 'destructive' : 'outline'}
                      onClick={() => updateShuttleStatus('inactive')} disabled={updatingStatus}>
                      <XCircle className="w-4 h-4 me-1" />{t('driverDash.goOffline')}
                    </Button>
                  </div>
                  {shuttle.status === 'active' && todayBookings.length > 0 && (
                    <Link to="/active-ride" className="mt-3 block">
                      <Button className="w-full" size="lg">
                        <Play className="w-5 h-5 me-2" />{lang === 'ar' ? 'بدء الرحلة' : 'Start Ride'}
                      </Button>
                    </Link>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-3">{t('driverDash.todaySchedule')}</h3>
                  {todayBookings.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('driverDash.noTripsToday')}</div>
                  ) : (
                    <div className="space-y-2">
                      {todayBookings.map(b => (
                        <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground text-sm">{b.scheduled_time} · {b.seats} {t('booking.seat')}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Routes Tab - Browse & Choose Routes */}
            {tab === 'routes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {lang === 'ar' ? 'المسارات المتاحة' : 'Available Routes'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang === 'ar' ? 'اختر مسارك وابدأ العمل عليه' : 'Choose a route and start working on it'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowRouteRequest(!showRouteRequest)}>
                    <Plus className="w-4 h-4 me-1" />
                    {lang === 'ar' ? 'طلب مسار جديد' : 'Request New Route'}
                  </Button>
                </div>

                {/* Route Request Form */}
                {showRouteRequest && (
                  <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">
                        {lang === 'ar' ? 'طلب مسار جديد' : 'Request a New Route'}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ar' ? 'لا تجد المسار اللي عاوزه؟ حدد نقطة البداية والنهاية على الخريطة' : "Can't find your route? Pick start and end points on the map"}
                    </p>

                    {/* Location inputs with autocomplete */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'نقطة البداية' : 'Starting Point'}</Label>
                        <PlacesAutocomplete
                          placeholder={lang === 'ar' ? 'ابحث عن نقطة البداية...' : 'Search starting point...'}
                          value={routeRequestForm.origin_name}
                          onSelect={(place) => setRouteRequestForm(p => ({ ...p, origin_name: place.name, origin_lat: place.lat, origin_lng: place.lng }))}
                          iconColor="text-green-500"
                        />
                        {routeRequestForm.origin_lat !== 0 && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {lang === 'ar' ? 'تم تحديد الموقع' : 'Location set'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'نقطة النهاية' : 'Destination'}</Label>
                        <PlacesAutocomplete
                          placeholder={lang === 'ar' ? 'ابحث عن الوجهة...' : 'Search destination...'}
                          value={routeRequestForm.destination_name}
                          onSelect={(place) => setRouteRequestForm(p => ({ ...p, destination_name: place.name, destination_lat: place.lat, destination_lng: place.lng }))}
                          iconColor="text-destructive"
                        />
                        {routeRequestForm.destination_lat !== 0 && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {lang === 'ar' ? 'تم تحديد الموقع' : 'Location set'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Map with click-to-pick */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{lang === 'ar' ? 'أو اضغط على الخريطة لتحديد المواقع' : 'Or click on the map to pick locations'}</Label>
                        <div className="flex gap-2">
                          <Button size="sm" variant={pickingLocation === 'origin' ? 'default' : 'outline'}
                            onClick={() => setPickingLocation(pickingLocation === 'origin' ? null : 'origin')}>
                            <MapPin className="w-3.5 h-3.5 me-1 text-green-500" />
                            {lang === 'ar' ? 'البداية' : 'Origin'}
                          </Button>
                          <Button size="sm" variant={pickingLocation === 'destination' ? 'default' : 'outline'}
                            onClick={() => setPickingLocation(pickingLocation === 'destination' ? null : 'destination')}>
                            <MapPin className="w-3.5 h-3.5 me-1 text-destructive" />
                            {lang === 'ar' ? 'النهاية' : 'Destination'}
                          </Button>
                        </div>
                      </div>
                      {pickingLocation && (
                        <p className="text-xs text-primary font-medium animate-pulse">
                          {pickingLocation === 'origin'
                            ? (lang === 'ar' ? '👆 اضغط على الخريطة لتحديد نقطة البداية' : '👆 Click on the map to set the starting point')
                            : (lang === 'ar' ? '👆 اضغط على الخريطة لتحديد الوجهة' : '👆 Click on the map to set the destination')}
                        </p>
                      )}
                      <MapView
                        className="h-64 sm:h-80"
                        onMapClick={handleMapClick}
                        markers={[
                          ...(routeRequestForm.origin_lat !== 0 ? [{ lat: routeRequestForm.origin_lat, lng: routeRequestForm.origin_lng, label: lang === 'ar' ? 'أ' : 'A', color: 'green' as const }] : []),
                          ...(routeRequestForm.destination_lat !== 0 ? [{ lat: routeRequestForm.destination_lat, lng: routeRequestForm.destination_lng, label: lang === 'ar' ? 'ب' : 'B', color: 'red' as const }] : []),
                        ]}
                        origin={routeRequestForm.origin_lat !== 0 ? { lat: routeRequestForm.origin_lat, lng: routeRequestForm.origin_lng } : undefined}
                        destination={routeRequestForm.destination_lat !== 0 ? { lat: routeRequestForm.destination_lat, lng: routeRequestForm.destination_lng } : undefined}
                        showDirections={routeRequestForm.origin_lat !== 0 && routeRequestForm.destination_lat !== 0}
                        showUserLocation={false}
                      />
                    </div>

                    {/* Two time fields: going and returning */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت الذهاب (الصباح)' : 'Going Time (Morning)'}</Label>
                        <Input type="time" value={routeRequestForm.preferred_time_go}
                          onChange={e => setRouteRequestForm(p => ({ ...p, preferred_time_go: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت العودة (المساء)' : 'Return Time (Evening)'}</Label>
                        <Input type="time" value={routeRequestForm.preferred_time_return}
                          onChange={e => setRouteRequestForm(p => ({ ...p, preferred_time_return: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={submitRouteRequest} disabled={savingRouteRequest || !routeRequestForm.origin_name || !routeRequestForm.destination_name}>
                        {savingRouteRequest ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowRouteRequest(false); setPickingLocation(null); }}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Route Cards */}
                {allRoutes.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Route className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">{lang === 'ar' ? 'لا توجد مسارات متاحة حالياً' : 'No routes available yet'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {allRoutes.map(r => {
                      const earnings = getExpectedEarnings(r);
                      const isScheduled = scheduledRouteIds.has(r.id);
                      const stopsCount = r.stops?.length || 0;

                      return (
                        <div key={r.id} className={`bg-card border rounded-2xl p-6 transition-all ${isScheduled ? 'border-primary/40 bg-primary/[0.02]' : 'border-border hover:border-primary/20'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-foreground">
                                  {lang === 'ar' ? r.name_ar : r.name_en}
                                </h3>
                                {isScheduled && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                    {lang === 'ar' ? 'مُجدول' : 'Scheduled'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 text-green-500" />
                                <span>{lang === 'ar' ? r.origin_name_ar : r.origin_name_en}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                                <MapPin className="w-3.5 h-3.5 text-destructive" />
                                <span>{lang === 'ar' ? r.destination_name_ar : r.destination_name_en}</span>
                              </div>
                            </div>
                          </div>

                          {/* Route Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{r.price} EGP</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'سعر المقعد' : 'Per Seat'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{r.estimated_duration_minutes}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'دقيقة' : 'Minutes'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <MapPin className="w-4 h-4 text-secondary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{stopsCount}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'محطات' : 'Stops'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{shuttle.capacity}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'مقعد' : 'Seats'}</p>
                            </div>
                          </div>

                          {/* Expected Earnings */}
                          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                {lang === 'ar' ? 'الأرباح المتوقعة (حصة السائق 90%)' : 'Expected Earnings (Driver gets 90%)'}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perTrip.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'لكل رحلة (ممتلئة)' : 'Per trip (full)'}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perWeek.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'أسبوعياً' : 'Weekly'}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perMonth.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'شهرياً' : 'Monthly'}</p>
                              </div>
                            </div>
                            <p className="text-xs text-green-600/60 mt-2 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              {lang === 'ar' ? `${earnings.driverPerSeat.toFixed(0)} جنيه للسائق من كل مقعد × ${shuttle.capacity} مقعد` : `${earnings.driverPerSeat.toFixed(0)} EGP driver share per seat × ${shuttle.capacity} seats`}
                            </p>
                          </div>

                          {/* Action Button */}
                          {!isScheduled ? (
                            <Button className="w-full" size="lg" onClick={() => openScheduleForRoute(r)}>
                              <Calendar className="w-4 h-4 me-2" />
                              {lang === 'ar' ? 'اختر هذا المسار وحدد جدولك' : 'Choose This Route & Set Schedule'}
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full" onClick={() => setTab('schedule')}>
                              <Calendar className="w-4 h-4 me-2" />
                              {lang === 'ar' ? 'عرض الجدول' : 'View Schedule'}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Trips Tab */}
            {tab === 'trips' && (() => {
              // Group bookings by date + route
              const grouped: Record<string, any[]> = {};
              bookings.forEach(b => {
                const key = `${b.scheduled_date}__${b.route_id || 'no-route'}__${b.scheduled_time}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(b);
              });

              const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

              return (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-foreground mb-4">{t('driverDash.allBookings')}</h2>
                  {sortedKeys.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">{t('driverDash.noBookingsYet')}</div>
                  ) : sortedKeys.map(key => {
                    const group = grouped[key];
                    const first = group[0];
                    const routeObj = first.routes;
                    const isExpanded = expandedTrips.has(key);
                    const totalSeats = group.reduce((s: number, b: any) => s + (b.seats || 1), 0);
                    const activeBookings = group.filter((b: any) => b.status !== 'cancelled');

                    // Build optimized waypoints for the map
                    const routeOrigin = routeObj ? { lat: routeObj.origin_lat, lng: routeObj.origin_lng } : { lat: 30.0444, lng: 31.2357 };
                    const routeDestination = routeObj ? { lat: routeObj.destination_lat, lng: routeObj.destination_lng } : { lat: 30.06, lng: 31.25 };
                    const optimizedWaypoints = isExpanded ? optimizePassengerOrder(activeBookings, routeOrigin, routeDestination) : [];

                    const validWaypoints = optimizedWaypoints.filter(wp => wp?.coords);
                    // Merge passengers at same location into single markers
                    const mergeNearbyMarkers = (wps: typeof validWaypoints) => {
                      const merged: { lat: number; lng: number; label: string; color: 'orange' | 'purple' }[] = [];
                      const THRESHOLD = 0.002; // ~200m
                      wps.forEach(wp => {
                        const existing = merged.find(m => 
                          Math.abs(m.lat - wp.coords.lat) < THRESHOLD && 
                          Math.abs(m.lng - wp.coords.lng) < THRESHOLD && 
                          m.color === (wp.type === 'pickup' ? 'orange' : 'purple')
                        );
                        if (existing) {
                          existing.label += ` & ${wp.label}`;
                        } else {
                          merged.push({
                            lat: wp.coords.lat,
                            lng: wp.coords.lng,
                            label: wp.label,
                            color: wp.type === 'pickup' ? 'orange' : 'purple',
                          });
                        }
                      });
                      return merged;
                    };

                    const mergedMarkers = isExpanded ? mergeNearbyMarkers(validWaypoints) : [];
                    const mapMarkers = isExpanded ? [
                      { lat: routeOrigin.lat, lng: routeOrigin.lng, label: 'A', color: 'green' as const },
                      ...mergedMarkers.map((m, i) => ({
                        lat: m.lat,
                        lng: m.lng,
                        label: `${i + 1}`,
                        color: m.color as 'orange' | 'purple',
                      })),
                      { lat: routeDestination.lat, lng: routeDestination.lng, label: 'B', color: 'red' as const },
                    ] : [];

                    // Build waypoints for directions line - dedupe nearby coords
                    const dedupeWaypoints = (wps: typeof validWaypoints) => {
                      const unique: { lat: number; lng: number }[] = [];
                      const THRESHOLD = 0.002;
                      wps.forEach(wp => {
                        const exists = unique.some(u => 
                          Math.abs(u.lat - wp.coords.lat) < THRESHOLD && 
                          Math.abs(u.lng - wp.coords.lng) < THRESHOLD
                        );
                        if (!exists) unique.push({ lat: wp.coords.lat, lng: wp.coords.lng });
                      });
                      return unique;
                    };

                    const directionWaypoints = isExpanded ? dedupeWaypoints(validWaypoints) : [];

                    return (
                      <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
                        {/* Clickable header */}
                        <button
                          onClick={() => toggleTrip(key)}
                          className="w-full flex items-center justify-between p-5 text-start hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">
                              {lang === 'ar' ? routeObj?.name_ar : routeObj?.name_en}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{first.scheduled_date}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{first.scheduled_time}</span>
                              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{activeBookings.length} {lang === 'ar' ? 'راكب' : 'passenger'}{activeBookings.length > 1 ? 's' : ''} · {totalSeats} {t('booking.seat')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[first.status]}`}>
                              {t(`booking.status.${first.status}`)}
                            </span>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-border p-5 space-y-4">
                            {/* Big optimized route map */}
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-primary" />
                                {lang === 'ar' ? 'خريطة الرحلة المُحسّنة' : 'Optimized Trip Map'}
                              </h4>
                              <p className="text-xs text-muted-foreground mb-2">
                                {lang === 'ar' ? 'الخط الأزرق يمر بكل نقاط الصعود والنزول بالترتيب الأمثل' : 'Blue line passes through all pickups & dropoffs in optimal order'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> {lang === 'ar' ? 'بداية/نهاية' : 'Start/End'}</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> {lang === 'ar' ? 'صعود' : 'Pickup'}</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> {lang === 'ar' ? 'نزول' : 'Dropoff'}</span>
                              </div>
                              <MapView
                                className="h-72 sm:h-96"
                                markers={mapMarkers}
                                origin={routeOrigin}
                                destination={routeDestination}
                                waypoints={directionWaypoints}
                                showDirections={true}
                                showUserLocation={false}
                                zoom={11}
                              />
                            </div>

                            {/* Optimized stop order */}
                            {optimizedWaypoints.length > 0 && (
                              <div className="bg-surface rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                  <Route className="w-4 h-4 text-primary" />
                                  {lang === 'ar' ? 'ترتيب التوقفات' : 'Stop Order'}
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">A</span>
                                    <span className="text-foreground font-medium">
                                      {lang === 'ar' ? routeObj?.origin_name_ar : routeObj?.origin_name_en}
                                    </span>
                                    <span className="text-xs text-muted-foreground">({lang === 'ar' ? 'نقطة البداية' : 'Start'})</span>
                                  </div>
                                  {optimizedWaypoints.filter(wp => wp?.coords).map((wp, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm ps-2 border-s-2 border-muted ms-3">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        wp.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                                      }`}>{i + 1}</span>
                                      <span className="text-foreground">{wp.label}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                                        wp.type === 'pickup' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                                      }`}>
                                        {wp.type === 'pickup' ? (lang === 'ar' ? 'صعود' : 'Pickup') : (lang === 'ar' ? 'نزول' : 'Dropoff')}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">B</span>
                                    <span className="text-foreground font-medium">
                                      {lang === 'ar' ? routeObj?.destination_name_ar : routeObj?.destination_name_en}
                                    </span>
                                    <span className="text-xs text-muted-foreground">({lang === 'ar' ? 'نقطة النهاية' : 'End'})</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Passenger list */}
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-3">
                                {lang === 'ar' ? 'الركاب' : 'Passengers'}
                              </h4>
                              <div className="space-y-2">
                                {activeBookings.map((b: any) => {
                                  const passenger = passengerProfiles[b.user_id];
                                  const name = passenger?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger');
                                  return (
                                    <div key={b.id} className="bg-surface rounded-xl p-4 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                          <User className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                          <p className="font-medium text-foreground text-sm">{name}</p>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{b.seats} {t('booking.seat')}</span>
                                            {b.custom_pickup_name && (
                                              <span className="flex items-center gap-0.5">
                                                <MapPin className="w-3 h-3 text-green-500" />{b.custom_pickup_name}
                                              </span>
                                            )}
                                            {b.custom_dropoff_name && (
                                              <span className="flex items-center gap-0.5">
                                                <MapPin className="w-3 h-3 text-destructive" />{b.custom_dropoff_name}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setChatBookingId(b.id);
                                          setChatPassengerName(name);
                                        }}
                                      >
                                        <MessageCircle className="w-4 h-4 text-primary" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Chat Modal */}
                  <RideChat
                    bookingId={chatBookingId || ''}
                    otherName={chatPassengerName}
                    isOpen={!!chatBookingId}
                    onClose={() => setChatBookingId(null)}
                  />
                </div>
              );
            })()}

            {/* Earnings Tab */}
            {tab === 'earnings' && (() => {
              const completed = bookings.filter(b => b.status === 'completed');
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              const dayOfWeek = today.getDay();
              const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - mondayOffset);
              const weekStartStr = weekStart.toISOString().split('T')[0];
              const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

              const dailyEarnings = completed.filter(b => b.scheduled_date === todayStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const weeklyEarnings = completed.filter(b => b.scheduled_date >= weekStartStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const monthlyEarnings = completed.filter(b => b.scheduled_date >= monthStartStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const allTimeEarnings = completed.reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const dailyRides = completed.filter(b => b.scheduled_date === todayStr).length;
              const weeklyRides = completed.filter(b => b.scheduled_date >= weekStartStr).length;
              const monthlyRides = completed.filter(b => b.scheduled_date >= monthStartStr).length;

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: lang === 'ar' ? 'اليوم' : 'Today', amount: dailyEarnings, rides: dailyRides, bg: 'bg-green-50 dark:bg-green-900/20' },
                      { label: lang === 'ar' ? 'هذا الأسبوع' : 'This Week', amount: weeklyEarnings, rides: weeklyRides, bg: 'bg-primary/5' },
                      { label: lang === 'ar' ? 'هذا الشهر' : 'This Month', amount: monthlyEarnings, rides: monthlyRides, bg: 'bg-secondary/5' },
                    ].map((period, i) => (
                      <div key={i} className={`rounded-2xl border border-border p-5 ${period.bg}`}>
                        <p className="text-sm text-muted-foreground mb-1">{period.label}</p>
                        <p className="text-3xl font-bold text-foreground">{period.amount.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-1">{period.rides} {lang === 'ar' ? 'رحلة' : 'rides'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{lang === 'ar' ? 'الإجمالي' : 'All Time'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{allTimeEarnings.toFixed(0)} EGP</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Navigation className="w-4 h-4 text-primary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الرحلات' : 'Total Rides'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.length}</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-primary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الركاب' : 'Total Passengers'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.reduce((s, b) => s + (b.seats || 1), 0)}</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-secondary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'متوسط الرحلة' : 'Avg per Ride'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.length > 0 ? (allTimeEarnings / completed.length).toFixed(0) : 0} EGP</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{lang === 'ar' ? 'آخر الرحلات المكتملة' : 'Recent Completed Rides'}</h3>
                    {completed.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">{lang === 'ar' ? 'لا يوجد رحلات مكتملة بعد' : 'No completed rides yet'}</p>
                    ) : (
                      <div className="space-y-2">
                        {completed.slice(0, 10).map(b => (
                          <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div>
                              <p className="text-sm font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                              <p className="text-xs text-muted-foreground">{b.scheduled_date} · {b.scheduled_time}</p>
                            </div>
                            <div className="text-end">
                              <p className="font-semibold text-foreground">{b.total_price} EGP</p>
                              <p className="text-xs text-muted-foreground">{b.seats} {lang === 'ar' ? 'مقعد' : 'seat'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ar' ? 'جدول الرحلات' : 'My Route Schedule'}
                  </h2>
                  <Button onClick={() => { setShowScheduleForm(!showScheduleForm); setSelectedRouteForSchedule(null); }}>
                    <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة جدول' : 'Add Schedule'}
                  </Button>
                </div>

                {showScheduleForm && (
                  <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 space-y-5">
                    <h3 className="font-semibold text-foreground">{lang === 'ar' ? 'جدول جديد' : 'New Schedule'}</h3>

                    {/* Selected route info */}
                    {selectedRouteForSchedule && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="font-medium text-foreground">
                          {lang === 'ar' ? selectedRouteForSchedule.name_ar : selectedRouteForSchedule.name_en}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lang === 'ar' ? selectedRouteForSchedule.origin_name_ar : selectedRouteForSchedule.origin_name_en} → {lang === 'ar' ? selectedRouteForSchedule.destination_name_ar : selectedRouteForSchedule.destination_name_en}
                        </p>
                      </div>
                    )}

                    {/* Route selection (if not pre-selected) */}
                    {!selectedRouteForSchedule && (
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'اختر المسار' : 'Select Route'}</Label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={scheduleForm.route_id} onChange={e => setScheduleForm(p => ({ ...p, route_id: e.target.value }))}>
                          <option value="">{lang === 'ar' ? 'اختر مسار...' : 'Choose a route...'}</option>
                          {allRoutes.map(r => (
                            <option key={r.id} value={r.id}>
                              {lang === 'ar' ? r.name_ar : r.name_en} - {r.price} EGP
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Day selection */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'اختر أيام العمل' : 'Select Working Days'}</Label>
                      <div className="flex flex-wrap gap-2">
                        {dayNames.map((name, i) => (
                          <button key={i} onClick={() => toggleDay(i)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              scheduleForm.days.includes(i)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                            }`}>
                            {name}
                          </button>
                        ))}
                      </div>
                      {/* Quick select */}
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'الأحد - الخميس' : 'Sun - Thu'}
                        </button>
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [1, 2, 3, 4, 5] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'الإثنين - الجمعة' : 'Mon - Fri'}
                        </button>
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4, 5, 6] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'كل الأيام' : 'All Days'}
                        </button>
                      </div>
                    </div>

                    {/* Times */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت الذهاب (الصباح)' : 'Departure Time (Morning)'}</Label>
                        <Input type="time" value={scheduleForm.departure_time}
                          onChange={e => setScheduleForm(p => ({ ...p, departure_time: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت العودة (المساء)' : 'Return Time (Evening)'}</Label>
                        <Input type="time" value={scheduleForm.return_time}
                          onChange={e => setScheduleForm(p => ({ ...p, return_time: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Minimum passengers */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'أقل عدد ركاب لانطلاق الرحلة' : 'Minimum Passengers for Trip to Go'}</Label>
                      <div className="flex items-center gap-3">
                        <Input type="number" min={1} max={shuttle.capacity}
                          value={scheduleForm.min_passengers}
                          onChange={e => setScheduleForm(p => ({ ...p, min_passengers: parseInt(e.target.value) || 1 }))}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {lang === 'ar' ? `من أصل ${shuttle.capacity} مقعد` : `out of ${shuttle.capacity} seats`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          {lang === 'ar' ? 'لو عدد الحجوزات أقل من الحد الأدنى، الرحلة مش هتنطلق والركاب هيتبلغوا' : "If bookings are below minimum, the trip won't depart and riders will be notified"}
                        </p>
                      </div>
                    </div>

                    {/* Recurring toggle */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={scheduleForm.is_recurring}
                        onCheckedChange={(checked) => setScheduleForm(p => ({ ...p, is_recurring: !!checked }))}
                      />
                      <div>
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <Repeat className="w-4 h-4 text-primary" />
                          {lang === 'ar' ? 'تكرار أسبوعي (كل أسبوع نفس الأيام)' : 'Repeat weekly (same days every week)'}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scheduleForm.is_recurring
                            ? (lang === 'ar' ? 'سيتم إنشاء رحلات تلقائياً لمدة 4 أسابيع قادمة' : 'Rides will be auto-created for the next 4 weeks')
                            : (lang === 'ar' ? 'هذا الأسبوع فقط' : 'This week only')}
                        </p>
                      </div>
                    </div>

                    {/* Expected earnings preview */}
                    {scheduleForm.route_id && scheduleForm.days.length > 0 && (() => {
                      const selectedRoute = allRoutes.find(r => r.id === scheduleForm.route_id);
                      if (!selectedRoute) return null;
                      const earnings = getExpectedEarnings(selectedRoute);
                      const tripsPerWeek = scheduleForm.days.length * (scheduleForm.return_time ? 2 : 1);
                      const weeklyEstimate = earnings.driverPerSeat * shuttle.capacity * tripsPerWeek;

                      return (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
                          <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                            {lang === 'ar' ? 'الأرباح المتوقعة بهذا الجدول' : 'Expected Earnings with This Schedule'}
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            ~{weeklyEstimate.toFixed(0)} EGP / {lang === 'ar' ? 'أسبوع' : 'week'}
                          </p>
                          <p className="text-xs text-green-600/70 mt-1">
                            {tripsPerWeek} {lang === 'ar' ? 'رحلة/أسبوع × ' : 'trips/week × '}{shuttle.capacity} {lang === 'ar' ? 'مقعد' : 'seats'} × {earnings.driverPerSeat.toFixed(0)} EGP
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveSchedule} disabled={savingSchedule || !scheduleForm.route_id || scheduleForm.days.length === 0}>
                        {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'حفظ الجدول' : 'Save Schedule'}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowScheduleForm(false); setSelectedRouteForSchedule(null); }}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing schedules */}
                {driverSchedules.length === 0 && !showScheduleForm ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">{lang === 'ar' ? 'لم تحدد أي جدول بعد' : 'No schedules set yet'}</p>
                    <p className="text-sm text-muted-foreground mb-4">{lang === 'ar' ? 'تصفح المسارات واختر الأنسب لك' : 'Browse routes and pick the best one for you'}</p>
                    <Button variant="outline" onClick={() => setTab('routes')}>
                      <Route className="w-4 h-4 me-1" />
                      {lang === 'ar' ? 'تصفح المسارات' : 'Browse Routes'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      driverSchedules.reduce((acc: Record<string, any[]>, s) => {
                        const key = s.route_id;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(s);
                        return acc;
                      }, {})
                    ).map(([routeId, schedules]) => {
                      const routeInfo = (schedules as any[])[0]?.routes;
                      return (
                        <div key={routeId} className="bg-card border border-border rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-foreground">
                                {lang === 'ar' ? routeInfo?.name_ar : routeInfo?.name_en}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {lang === 'ar' ? routeInfo?.origin_name_ar : routeInfo?.origin_name_en} → {lang === 'ar' ? routeInfo?.destination_name_ar : routeInfo?.destination_name_en}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-foreground">{routeInfo?.price} EGP/{lang === 'ar' ? 'مقعد' : 'seat'}</span>
                          </div>

                          {/* Schedule details */}
                          <div className="space-y-2">
                            {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-foreground w-24">{dayNames[s.day_of_week]}</span>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{s.departure_time?.slice(0, 5)}</span>
                                    {s.return_time && (
                                      <>
                                        <ArrowRight className="w-3 h-3" />
                                        <span>{s.return_time?.slice(0, 5)}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="w-3 h-3" />
                                    <span>{lang === 'ar' ? `حد أدنى ${s.min_passengers}` : `Min ${s.min_passengers}`}</span>
                                  </div>
                                  {s.is_recurring && <Repeat className="w-3 h-3 text-primary" />}
                                </div>
                                <button onClick={() => deleteSchedule(s.id)} className="text-destructive/60 hover:text-destructive p-1">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Shuttle Info Tab */}
            {tab === 'shuttle' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">{t('driverDash.vehicleInfo')}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehicleModel')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_model}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehiclePlate')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_plate}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.capacity')}</p>
                      <p className="font-medium text-foreground">{shuttle.capacity} {t('booking.seat')}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.shuttleStatus')}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[shuttle.status]}`}>
                        {t(`driverDash.status.${shuttle.status}`)}
                      </span>
                    </div>
                  </div>
                </div>

                {route && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('driverDash.assignedRoute')}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span className="text-foreground">{lang === 'ar' ? route.origin_name_ar : route.origin_name_en}</span>
                      <span className="text-muted-foreground">→</span>
                      <MapPin className="w-4 h-4 text-destructive" />
                      <span className="text-foreground">{lang === 'ar' ? route.destination_name_ar : route.destination_name_en}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{route.estimated_duration_minutes} {t('booking.min')}</span>
                      <span>{route.price} EGP/{t('booking.perSeat')}</span>
                    </div>
                  </div>
                )}

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4">{t('driverDash.updateStatus')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['active', 'inactive', 'maintenance'].map(s => (
                      <Button key={s} size="sm" variant={shuttle.status === s ? 'default' : 'outline'}
                        onClick={() => updateShuttleStatus(s)} disabled={updatingStatus}>
                        {t(`driverDash.status.${s}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
