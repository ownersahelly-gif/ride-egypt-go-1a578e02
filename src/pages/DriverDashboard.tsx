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
import { Globe, LogOut, User, MapPin, Clock, Users, Car, Calendar, DollarSign, Navigation, CheckCircle2, XCircle, Loader2, Play, Plus, Trash2, Repeat, TrendingUp, Route, ArrowRight, AlertCircle, Info, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useDriverBookingNotifications } from '@/hooks/useBookingNotifications';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapView from '@/components/MapView';
import RideChat from '@/components/RideChat';
import { useRef } from 'react';

type TabType = 'home' | 'schedule' | 'trips';

// Driver dashboard component
const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>('home');
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
    timeSlots: [{ direction: 'go' as 'go' | 'return', time: '08:00' }, { direction: 'return' as 'go' | 'return', time: '17:00' }] as { direction: 'go' | 'return'; time: string }[],
    is_recurring: true,
    min_passengers: 5,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const scheduleFormRef = useRef<HTMLDivElement>(null);

  // Route request
  const [showRouteRequest, setShowRouteRequest] = useState(false);
  const [routeRequestForm, setRouteRequestForm] = useState({
    origin_name: '', origin_lat: 0, origin_lng: 0,
    destination_name: '', destination_lat: 0, destination_lng: 0,
    preferred_time_go: '08:00', preferred_time_return: '17:00',
  });
  const [savingRouteRequest, setSavingRouteRequest] = useState(false);
  const [pickingLocation, setPickingLocation] = useState<'origin' | 'destination' | null>(null);

  const { newBookingsCount, acknowledge: ackBookings } = useDriverBookingNotifications(shuttle?.id || null);

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [{ data: profileData }, { data: allShuttles }, { data: routesData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('shuttles').select('*, routes(*)').eq('driver_id', user.id),
        supabase.from('routes').select('*, stops(*)').eq('status', 'active'),
      ]);
      setProfile(profileData);
      setAllRoutes(routesData || []);

      // Find the shuttle that has today's bookings, fallback to first active shuttle
      let chosenShuttle: any = null;
      let allBookings: any[] = [];
      for (const s of (allShuttles || [])) {
        const { data: bks } = await supabase
          .from('bookings').select('*, routes(*)')
          .eq('shuttle_id', s.id)
          .eq('scheduled_date', today)
          .neq('status', 'cancelled')
          .order('scheduled_time', { ascending: true });
        if (bks && bks.length > 0) {
          chosenShuttle = s;
          allBookings = bks;
          break;
        }
      }
      if (!chosenShuttle && allShuttles && allShuttles.length > 0) {
        chosenShuttle = allShuttles.find((s: any) => s.status === 'active') || allShuttles[0];
        // Fetch all bookings for fallback shuttle
        const { data: bks } = await supabase
          .from('bookings').select('*, routes(*)')
          .eq('shuttle_id', chosenShuttle.id)
          .order('scheduled_date', { ascending: true }).limit(50);
        allBookings = bks || [];
      }

      if (chosenShuttle) {
        setShuttle(chosenShuttle);
        setRoute(chosenShuttle.routes);
        setBookings(allBookings);
        const { data: schedulesData } = await supabase
          .from('driver_schedules')
          .select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)')
          .eq('driver_id', user.id).order('day_of_week');
        setDriverSchedules(schedulesData || []);
        if (allBookings.length > 0) {
          const userIds = [...new Set(allBookings.map((b: any) => b.user_id))];
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

  const optimizePassengerOrder = (passengers: any[], routeOrigin: { lat: number; lng: number }, routeDestination: { lat: number; lng: number }) => {
    type WP = { type: 'pickup' | 'dropoff'; bookingIdx: number; coords: { lat: number; lng: number }; label: string };
    if (passengers.length === 0) return [] as WP[];
    const getPickupCoords = (p: any) => ({ lat: p.custom_pickup_lat || routeOrigin.lat, lng: p.custom_pickup_lng || routeOrigin.lng });
    const getDropoffCoords = (p: any) => ({ lat: p.custom_dropoff_lat || routeDestination.lat, lng: p.custom_dropoff_lng || routeDestination.lng });
    const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
    const waypoints: WP[] = [];
    passengers.forEach((p, i) => {
      waypoints.push({ type: 'pickup', bookingIdx: i, coords: getPickupCoords(p), label: passengerProfiles[p.user_id]?.full_name || `Passenger ${i + 1}` });
      waypoints.push({ type: 'dropoff', bookingIdx: i, coords: getDropoffCoords(p), label: passengerProfiles[p.user_id]?.full_name || `Passenger ${i + 1}` });
    });
    const pickups = waypoints.filter(w => w.type === 'pickup');
    const dropoffs = waypoints.filter(w => w.type === 'dropoff');
    const sortByNearest = (points: WP[], start: { lat: number; lng: number }) => {
      const sorted: WP[] = []; const remaining = [...points]; let current = start;
      while (remaining.length > 0) {
        let nearestIdx = 0; let nearestDist = Infinity;
        remaining.forEach((p, i) => { const d = dist(current, p.coords); if (d < nearestDist) { nearestDist = d; nearestIdx = i; } });
        sorted.push(remaining[nearestIdx]); current = remaining[nearestIdx].coords; remaining.splice(nearestIdx, 1);
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
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else { setShuttle({ ...shuttle, status: newStatus }); toast({ title: t('driverDash.statusUpdated') }); }
    setUpdatingStatus(false);
  };

  const toggleDay = (day: number) => {
    setScheduleForm(prev => ({ ...prev, days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day] }));
  };

  const openScheduleForRoute = (routeObj: any) => {
    setSelectedRouteForSchedule(routeObj);
    setScheduleForm(prev => ({ ...prev, route_id: routeObj.id }));
    setShowScheduleForm(true);
    setTimeout(() => scheduleFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  };

  const saveSchedule = async () => {
    if (!user || !shuttle || !scheduleForm.route_id || scheduleForm.days.length === 0 || scheduleForm.timeSlots.length === 0) return;
    setSavingSchedule(true);
    // Create one schedule entry per day per time slot
    const goSlots = scheduleForm.timeSlots.filter(s => s.direction === 'go');
    const returnSlots = scheduleForm.timeSlots.filter(s => s.direction === 'return');
    // Pair go and return slots, or create individual entries
    const departureEntries: any[] = [];
    scheduleForm.days.forEach(day => {
      if (goSlots.length > 0 && returnSlots.length > 0) {
        // Pair them: first go with first return, etc.
        const maxPairs = Math.max(goSlots.length, returnSlots.length);
        for (let i = 0; i < maxPairs; i++) {
          departureEntries.push({
            driver_id: user.id, route_id: scheduleForm.route_id, shuttle_id: shuttle.id,
            day_of_week: day,
            departure_time: goSlots[i]?.time || goSlots[0].time,
            return_time: returnSlots[i]?.time || returnSlots[0].time,
            is_recurring: scheduleForm.is_recurring, is_active: true, min_passengers: scheduleForm.min_passengers,
          });
        }
      } else if (goSlots.length > 0) {
        goSlots.forEach(slot => {
          departureEntries.push({
            driver_id: user.id, route_id: scheduleForm.route_id, shuttle_id: shuttle.id,
            day_of_week: day, departure_time: slot.time, return_time: null,
            is_recurring: scheduleForm.is_recurring, is_active: true, min_passengers: scheduleForm.min_passengers,
          });
        });
      } else {
        returnSlots.forEach(slot => {
          departureEntries.push({
            driver_id: user.id, route_id: scheduleForm.route_id, shuttle_id: shuttle.id,
            day_of_week: day, departure_time: slot.time, return_time: null,
            is_recurring: scheduleForm.is_recurring, is_active: true, min_passengers: scheduleForm.min_passengers,
          });
        });
      }
    });
    const { error } = await supabase.from('driver_schedules').insert(departureEntries);
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? 'تم حفظ الجدول!' : 'Schedule saved!' });
      await generateRideInstances(departureEntries);
      const { data } = await supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)').eq('driver_id', user.id).order('day_of_week');
      setDriverSchedules(data || []);
      setShowScheduleForm(false);
      setSelectedRouteForSchedule(null);
      setScheduleForm({ route_id: '', days: [], timeSlots: [{ direction: 'go', time: '08:00' }, { direction: 'return', time: '17:00' }], is_recurring: true, min_passengers: 5 });
      setTab('home');
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
            const dateStr = date.toISOString().split('T')[0];
            instances.push({ driver_id: user.id, route_id: entry.route_id, shuttle_id: shuttle.id, ride_date: dateStr, departure_time: entry.departure_time, available_seats: shuttle.capacity, total_seats: shuttle.capacity, status: 'scheduled' });
            if (entry.return_time) {
              instances.push({ driver_id: user.id, route_id: entry.route_id, shuttle_id: shuttle.id, ride_date: dateStr, departure_time: entry.return_time, available_seats: shuttle.capacity, total_seats: shuttle.capacity, status: 'scheduled' });
            }
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
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else { setDriverSchedules(prev => prev.filter(s => s.id !== id)); toast({ title: lang === 'ar' ? 'تم حذف الجدول' : 'Schedule removed' }); }
  };

  const submitRouteRequest = async () => {
    if (!user || !routeRequestForm.origin_name || !routeRequestForm.destination_name) return;
    setSavingRouteRequest(true);
    const { error } = await supabase.from('route_requests').insert({
      user_id: user.id, origin_name: routeRequestForm.origin_name, origin_lat: routeRequestForm.origin_lat, origin_lng: routeRequestForm.origin_lng,
      destination_name: routeRequestForm.destination_name, destination_lat: routeRequestForm.destination_lat, destination_lng: routeRequestForm.destination_lng,
      preferred_time: routeRequestForm.preferred_time_go, status: 'pending',
    });
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Route request submitted!' });
      setShowRouteRequest(false);
      setRouteRequestForm({ origin_name: '', origin_lat: 0, origin_lng: 0, destination_name: '', destination_lat: 0, destination_lng: 0, preferred_time_go: '08:00', preferred_time_return: '17:00' });
      setPickingLocation(null);
    }
    setSavingRouteRequest(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!pickingLocation) return;
    if (pickingLocation === 'origin') setRouteRequestForm(p => ({ ...p, origin_lat: lat, origin_lng: lng, origin_name: p.origin_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    else setRouteRequestForm(p => ({ ...p, destination_lat: lat, destination_lng: lng, destination_name: p.destination_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700', inactive: 'bg-muted text-muted-foreground',
    maintenance: 'bg-secondary/20 text-secondary', pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700', completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive', boarded: 'bg-primary/10 text-primary',
  };

  const tabs: { key: TabType; icon: any; label: string }[] = [
    { key: 'home', icon: Car, label: lang === 'ar' ? 'الرئيسية' : 'Home' },
    { key: 'schedule', icon: Calendar, label: lang === 'ar' ? 'الجدول' : 'Schedule' },
    { key: 'trips', icon: Navigation, label: lang === 'ar' ? 'الرحلات' : 'Trips' },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const todayBookings = bookings.filter(b => b.scheduled_date === new Date().toISOString().split('T')[0] && b.status !== 'cancelled');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalEarnings = completedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);
  const scheduledRouteIds = new Set(driverSchedules.map(s => s.route_id));

  // Earnings calculations
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const dailyEarnings = completedBookings.filter(b => b.scheduled_date === todayStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const monthlyEarnings = completedBookings.filter(b => b.scheduled_date >= monthStartStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);

  const getExpectedEarnings = (routeObj: any) => {
    const price = parseFloat(routeObj.price || 0);
    const capacity = shuttle?.capacity || 14;
    const driverShare = price * 0.9;
    return { perTrip: driverShare * capacity, driverPerSeat: driverShare };
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">{lang === 'ar' ? 'مسار' : 'Massar'}</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {!shuttle && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}</h2>
            <p className="text-muted-foreground">{lang === 'ar' ? 'سيتم تفعيل حسابك تلقائياً عند الموافقة' : 'Your account will be activated once approved'}</p>
          </div>
        )}

        {shuttle && (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => { setTab(key); if (key === 'home') ackBookings(); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors relative ${
                    tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                  {key === 'home' && newBookingsCount > 0 && tab !== 'home' && (
                    <span className="absolute -top-1 -end-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{newBookingsCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ==================== HOME TAB ==================== */}
            {tab === 'home' && (
              <div className="space-y-4">
                {/* Start Ride — THE main action */}
                {todayBookings.length > 0 && shuttle.status === 'active' && (
                  <Link to="/active-ride">
                    <Button className="w-full h-16 text-lg rounded-2xl" size="lg">
                      <Play className="w-6 h-6 me-2" />
                      {lang === 'ar' ? 'ابدأ رحلة اليوم' : "Start Today's Ride"}
                      <span className="ms-2 bg-primary-foreground/20 px-2 py-0.5 rounded-full text-sm">
                        {todayBookings.length} {lang === 'ar' ? 'راكب' : 'riders'}
                      </span>
                    </Button>
                  </Link>
                )}

                {/* Online/Offline toggle */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${shuttle.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {shuttle.vehicle_model} · {shuttle.vehicle_plate}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shuttle.status === 'active' ? (lang === 'ar' ? 'متصل — يمكن للركاب الحجز' : 'Online — riders can book') : (lang === 'ar' ? 'غير متصل' : 'Offline')}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={shuttle.status === 'active' ? 'destructive' : 'default'}
                      onClick={() => updateShuttleStatus(shuttle.status === 'active' ? 'inactive' : 'active')}
                      disabled={updatingStatus}
                    >
                      {shuttle.status === 'active' ? (lang === 'ar' ? 'إيقاف' : 'Go Offline') : (lang === 'ar' ? 'تشغيل' : 'Go Online')}
                    </Button>
                  </div>
                </div>

                {/* Earnings summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'أرباح اليوم' : "Today's Earnings"}</p>
                    <p className="text-2xl font-bold text-foreground">{dailyEarnings.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">EGP</span></p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'أرباح الشهر' : 'This Month'}</p>
                    <p className="text-2xl font-bold text-foreground">{monthlyEarnings.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">EGP</span></p>
                  </div>
                </div>

                {/* Today's riders */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {lang === 'ar' ? `ركاب اليوم (${todayBookings.length})` : `Today's Riders (${todayBookings.length})`}
                  </h3>
                  {todayBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{lang === 'ar' ? 'لا يوجد حجوزات اليوم' : 'No bookings today'}</p>
                  ) : (
                    <div className="space-y-2">
                      {todayBookings.map(b => {
                        const passenger = passengerProfiles[b.user_id];
                        return (
                          <div key={b.id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{passenger?.full_name || (lang === 'ar' ? 'راكب' : 'Rider')}</p>
                                <p className="text-xs text-muted-foreground">{b.scheduled_time?.slice(0, 5)} · {b.seats} {t('booking.seat')}</p>
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Prompt if no schedule */}
                {driverSchedules.length === 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                    <h3 className="font-semibold text-foreground mb-1">{lang === 'ar' ? 'ابدأ بتحديد مسارك!' : 'Set up your route!'}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{lang === 'ar' ? 'اختر مسار وحدد أيام عملك لبدء استقبال الركاب' : 'Pick a route and set your work days to start receiving riders'}</p>
                    <Button onClick={() => setTab('schedule')}>
                      <Calendar className="w-4 h-4 me-1" />{lang === 'ar' ? 'إعداد الجدول' : 'Set Schedule'}
                    </Button>
                  </div>
                )}

                {/* Active routes with bookings */}
                {driverSchedules.length > 0 && (() => {
                  const routeGroups = driverSchedules.reduce((acc: Record<string, any[]>, s) => {
                    if (!acc[s.route_id]) acc[s.route_id] = [];
                    acc[s.route_id].push(s);
                    return acc;
                  }, {});
                  return (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Route className="w-4 h-4 text-primary" />
                        {lang === 'ar' ? 'مساراتك النشطة' : 'Your Active Routes'}
                      </h3>
                      {Object.entries(routeGroups).map(([routeId, schedules]) => {
                        const routeInfo = (schedules as any[])[0]?.routes;
                        const routeBookings = bookings.filter(b => b.route_id === routeId && b.status !== 'cancelled');
                        // Group bookings by day of week
                        const bookingsByDay: Record<number, any[]> = {};
                        routeBookings.forEach(b => {
                          const dayOfWeek = new Date(b.scheduled_date).getDay();
                          if (!bookingsByDay[dayOfWeek]) bookingsByDay[dayOfWeek] = [];
                          bookingsByDay[dayOfWeek].push(b);
                        });
                        const openGoogleMapsNav = () => {
                          if (routeInfo?.origin_lat && routeInfo?.origin_lng) {
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${routeInfo.origin_lat},${routeInfo.origin_lng}&travelmode=driving`, '_blank');
                          }
                        };
                        return (
                          <div key={routeId} className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-semibold text-foreground">{lang === 'ar' ? routeInfo?.name_ar : routeInfo?.name_en}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {lang === 'ar' ? routeInfo?.origin_name_ar : routeInfo?.origin_name_en} → {lang === 'ar' ? routeInfo?.destination_name_ar : routeInfo?.destination_name_en}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-foreground">{routeInfo?.price} EGP</span>
                            </div>
                            {routeInfo?.origin_lat && routeInfo?.destination_lat && (
                              <div className="relative cursor-pointer" onClick={openGoogleMapsNav}>
                                <MapView
                                  className="h-[150px]"
                                  markers={[
                                    { lat: routeInfo.origin_lat, lng: routeInfo.origin_lng, label: 'A', color: 'green' },
                                    { lat: routeInfo.destination_lat, lng: routeInfo.destination_lng, label: 'B', color: 'red' },
                                  ]}
                                  origin={{ lat: routeInfo.origin_lat, lng: routeInfo.origin_lng }}
                                  destination={{ lat: routeInfo.destination_lat, lng: routeInfo.destination_lng }}
                                  showDirections
                                  showUserLocation={false}
                                  zoom={10}
                                />
                                <div className="absolute bottom-2 start-2 bg-card/90 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1 text-xs text-primary shadow">
                                  <Navigation className="w-3 h-3" />
                                  {lang === 'ar' ? 'اضغط للتنقل' : 'Tap to navigate'}
                                </div>
                              </div>
                            )}
                            {/* Per-day passenger breakdown with go/return counts */}
                            <div className="space-y-1.5">
                              {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => {
                                const dayBookings = bookingsByDay[s.day_of_week] || [];
                                const goCount = dayBookings.filter((b: any) => b.trip_direction === 'go' || b.trip_direction === 'both').length;
                                const returnCount = dayBookings.filter((b: any) => b.trip_direction === 'return' || b.trip_direction === 'both').length;
                                return (
                                  <div key={s.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="font-medium text-foreground w-16">{dayNames[s.day_of_week]}</span>
                                      {s.departure_time && <><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">{s.departure_time?.slice(0, 5)}</span></>}
                                      {s.return_time && <><ArrowRight className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">{s.return_time?.slice(0, 5)}</span></>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full" title={lang === 'ar' ? 'ذهاب' : 'Going'}>
                                        → {goCount}
                                      </span>
                                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full" title={lang === 'ar' ? 'عودة' : 'Return'}>
                                        ← {returnCount}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Passenger list */}
                            {routeBookings.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                  <Users className="w-3 h-3 inline me-1" />
                                  {lang === 'ar' ? `إجمالي الركاب (${routeBookings.length})` : `Total Passengers (${routeBookings.length})`}
                                </p>
                                {routeBookings.slice(0, 5).map(b => {
                                  const passenger = passengerProfiles[b.user_id];
                                  return (
                                    <div key={b.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary" /></div>
                                        <div>
                                          <p className="text-xs font-medium text-foreground">{passenger?.full_name || (lang === 'ar' ? 'راكب' : 'Rider')}</p>
                                          <p className="text-[10px] text-muted-foreground">{dayNames[new Date(b.scheduled_date).getDay()]} · {b.scheduled_time?.slice(0, 5)} · {b.seats} {t('booking.seat')}</p>
                                        </div>
                                      </div>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                                    </div>
                                  );
                                })}
                                {routeBookings.length > 5 && (
                                  <p className="text-xs text-primary text-center cursor-pointer" onClick={() => setTab('trips')}>
                                    +{routeBookings.length - 5} {lang === 'ar' ? 'المزيد' : 'more'}
                                  </p>
                                )}
                              </div>
                            )}
                            <Button variant="outline" size="sm" onClick={() => { setTab('schedule'); openScheduleForRoute(allRoutes.find(r => r.id === routeId) || routeInfo); }}>
                              <Calendar className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'تعديل الجدول' : 'Edit Schedule'}
                            </Button>
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => setTab('schedule')} className="w-full">
                        <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة مسار آخر' : 'Add Another Route'}
                      </Button>
                    </div>
                  );
                })()}

                {/* All-time stats */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground">{totalEarnings.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">EGP {lang === 'ar' ? 'إجمالي' : 'Total'}</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{completedBookings.length}</p>
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'رحلات' : 'Rides'}</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{completedBookings.reduce((s, b) => s + (b.seats || 1), 0)}</p>
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'ركاب' : 'Passengers'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SCHEDULE TAB ==================== */}
            {tab === 'schedule' && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'اختر المسار الذي تريد الذهاب إليه' : 'Choose the route you want to go to'}</h2>
                  <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'اختر مسار ثم حدد أيام وأوقات العمل' : 'Select a route then set your working days and times'}</p>
                </div>
                {driverSchedules.length > 0 && (
                  <div className="space-y-3">
                    {Object.entries(
                      driverSchedules.reduce((acc: Record<string, any[]>, s) => {
                        if (!acc[s.route_id]) acc[s.route_id] = [];
                        acc[s.route_id].push(s);
                        return acc;
                      }, {})
                    ).map(([routeId, schedules]) => {
                      const routeInfo = (schedules as any[])[0]?.routes;
                      return (
                        <div key={routeId} className="bg-card border border-border rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-foreground">{lang === 'ar' ? routeInfo?.name_ar : routeInfo?.name_en}</h4>
                              <p className="text-xs text-muted-foreground">{routeInfo?.price} EGP/{lang === 'ar' ? 'مقعد' : 'seat'}</p>
                            </div>
                          </div>
                          {routeInfo?.origin_lat && routeInfo?.destination_lat && (
                            <MapView
                              className="h-[180px] mb-3"
                              markers={[
                                { lat: routeInfo.origin_lat, lng: routeInfo.origin_lng, label: 'A', color: 'green' },
                                { lat: routeInfo.destination_lat, lng: routeInfo.destination_lng, label: 'B', color: 'red' },
                              ]}
                              origin={{ lat: routeInfo.origin_lat, lng: routeInfo.origin_lng }}
                              destination={{ lat: routeInfo.destination_lat, lng: routeInfo.destination_lng }}
                              showDirections
                              showUserLocation={false}
                              zoom={10}
                            />
                          )}
                          <div className="space-y-1.5">
                            {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-foreground w-16">{dayNames[s.day_of_week]}</span>
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">{s.departure_time?.slice(0, 5)}</span>
                                  {s.return_time && <><ArrowRight className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">{s.return_time?.slice(0, 5)}</span></>}
                                </div>
                                <button onClick={() => deleteSchedule(s.id)} className="text-destructive/60 hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add schedule form */}
                {showScheduleForm ? (
                  <div ref={scheduleFormRef} className="bg-card border-2 border-primary/20 rounded-2xl p-5 space-y-4">
                    {selectedRouteForSchedule && (
                      <div className="bg-primary/5 rounded-xl p-3">
                        <p className="font-medium text-foreground text-sm">{lang === 'ar' ? selectedRouteForSchedule.name_ar : selectedRouteForSchedule.name_en}</p>
                        <p className="text-xs text-muted-foreground">{lang === 'ar' ? selectedRouteForSchedule.origin_name_ar : selectedRouteForSchedule.origin_name_en} → {lang === 'ar' ? selectedRouteForSchedule.destination_name_ar : selectedRouteForSchedule.destination_name_en}</p>
                      </div>
                    )}
                    {!selectedRouteForSchedule && (
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'اختر المسار' : 'Select Route'}</Label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={scheduleForm.route_id} onChange={e => setScheduleForm(p => ({ ...p, route_id: e.target.value }))}>
                          <option value="">{lang === 'ar' ? 'اختر مسار...' : 'Choose a route...'}</option>
                          {allRoutes.map(r => <option key={r.id} value={r.id}>{lang === 'ar' ? r.name_ar : r.name_en} - {r.price} EGP</option>)}
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'أيام العمل' : 'Working Days'}</Label>
                      <div className="flex flex-wrap gap-2">
                        {dayNames.map((name, i) => (
                          <button key={i} onClick={() => toggleDay(i)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              scheduleForm.days.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
                            }`}>{name}</button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4] }))} className="text-xs text-primary hover:underline">{lang === 'ar' ? 'أحد-خميس' : 'Sun-Thu'}</button>
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4, 5, 6] }))} className="text-xs text-primary hover:underline">{lang === 'ar' ? 'كل يوم' : 'Every day'}</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'أوقات الرحلات' : 'Trip Time Slots'}</Label>
                      <div className="space-y-2">
                        {scheduleForm.timeSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                              value={slot.direction}
                              onChange={e => {
                                const updated = [...scheduleForm.timeSlots];
                                updated[idx] = { ...updated[idx], direction: e.target.value as 'go' | 'return' };
                                setScheduleForm(p => ({ ...p, timeSlots: updated }));
                              }}>
                              <option value="go">{lang === 'ar' ? '→ ذهاب' : '→ Going'}</option>
                              <option value="return">{lang === 'ar' ? '← عودة' : '← Return'}</option>
                            </select>
                            <Input type="time" value={slot.time} className="flex-1"
                              onChange={e => {
                                const updated = [...scheduleForm.timeSlots];
                                updated[idx] = { ...updated[idx], time: e.target.value };
                                setScheduleForm(p => ({ ...p, timeSlots: updated }));
                              }} />
                            {scheduleForm.timeSlots.length > 1 && (
                              <button onClick={() => setScheduleForm(p => ({ ...p, timeSlots: p.timeSlots.filter((_, i) => i !== idx) }))}
                                className="text-destructive/60 hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setScheduleForm(p => ({ ...p, timeSlots: [...p.timeSlots, { direction: 'go', time: '12:00' }] }))}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" />{lang === 'ar' ? 'إضافة وقت آخر' : 'Add another time slot'}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">{lang === 'ar' ? 'أقل عدد ركاب' : 'Min Passengers'}</Label>
                      <Input type="number" min={1} max={shuttle.capacity} value={scheduleForm.min_passengers} onChange={e => setScheduleForm(p => ({ ...p, min_passengers: parseInt(e.target.value) || 1 }))} className="w-24" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox checked={scheduleForm.is_recurring} onCheckedChange={(c) => setScheduleForm(p => ({ ...p, is_recurring: !!c }))} />
                      <Label className="text-sm cursor-pointer">{lang === 'ar' ? 'تكرار أسبوعي (4 أسابيع)' : 'Repeat weekly (4 weeks)'}</Label>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={saveSchedule} disabled={savingSchedule || !scheduleForm.route_id || scheduleForm.days.length === 0 || scheduleForm.timeSlots.length === 0} className="flex-1">
                        {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'حفظ' : 'Save'}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowScheduleForm(false); setSelectedRouteForSchedule(null); }}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setShowScheduleForm(true)}>
                    <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة جدول جديد' : 'Add New Schedule'}
                  </Button>
                )}

                {/* Available Routes */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3">{lang === 'ar' ? 'المسارات المتاحة' : 'Available Routes'}</h3>
                  {allRoutes.map(r => {
                    const isScheduled = scheduledRouteIds.has(r.id);
                    const earnings = getExpectedEarnings(r);
                    return (
                      <div key={r.id} className={`bg-card border rounded-2xl p-4 mb-3 ${isScheduled ? 'border-primary/30' : 'border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground text-sm">{lang === 'ar' ? r.name_ar : r.name_en}</h4>
                              {isScheduled && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{lang === 'ar' ? 'مُجدول' : 'Active'}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{lang === 'ar' ? r.origin_name_ar : r.origin_name_en} → {lang === 'ar' ? r.destination_name_ar : r.destination_name_en}</p>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-foreground">{r.price} EGP</p>
                            <p className="text-[10px] text-muted-foreground">{r.estimated_duration_minutes} {lang === 'ar' ? 'د' : 'min'}</p>
                          </div>
                        </div>
                        {r.origin_lat && r.destination_lat && (
                          <MapView
                            className="h-[150px] mb-2"
                            markers={[
                              { lat: r.origin_lat, lng: r.origin_lng, label: 'A', color: 'green' },
                              { lat: r.destination_lat, lng: r.destination_lng, label: 'B', color: 'red' },
                            ]}
                            origin={{ lat: r.origin_lat, lng: r.origin_lng }}
                            destination={{ lat: r.destination_lat, lng: r.destination_lng }}
                            showDirections
                            showUserLocation={false}
                            zoom={10}
                          />
                        )}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-green-600">
                            <TrendingUp className="w-3 h-3 inline me-1" />
                            ~{earnings.perTrip.toFixed(0)} EGP/{lang === 'ar' ? 'رحلة' : 'trip'}
                          </p>
                          {!isScheduled && (
                            <Button size="sm" onClick={() => openScheduleForRoute(r)}>
                              <Calendar className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'اختيار' : 'Choose'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowRouteRequest(!showRouteRequest)}>
                    <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'طلب مسار جديد' : 'Request New Route'}
                  </Button>

                  {showRouteRequest && (
                    <div className="bg-card border border-border rounded-2xl p-4 mt-3 space-y-3">
                      <div className="grid gap-3">
                        <PlacesAutocomplete placeholder={lang === 'ar' ? 'نقطة البداية...' : 'Starting point...'} value={routeRequestForm.origin_name}
                          onSelect={(p) => setRouteRequestForm(prev => ({ ...prev, origin_name: p.name, origin_lat: p.lat, origin_lng: p.lng }))} iconColor="text-green-500" />
                        <PlacesAutocomplete placeholder={lang === 'ar' ? 'الوجهة...' : 'Destination...'} value={routeRequestForm.destination_name}
                          onSelect={(p) => setRouteRequestForm(prev => ({ ...prev, destination_name: p.name, destination_lat: p.lat, destination_lng: p.lng }))} iconColor="text-destructive" />
                      </div>
                      <Button onClick={submitRouteRequest} disabled={savingRouteRequest || !routeRequestForm.origin_name || !routeRequestForm.destination_name} className="w-full">
                        {savingRouteRequest ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : null}
                        {lang === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== TRIPS TAB ==================== */}
            {tab === 'trips' && (() => {
              const grouped: Record<string, any[]> = {};
              bookings.forEach(b => {
                const key = `${b.scheduled_date}__${b.route_id || 'no-route'}__${b.scheduled_time}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(b);
              });
              const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

              return (
                <div className="space-y-3">
                  {sortedKeys.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">{lang === 'ar' ? 'لا توجد رحلات بعد' : 'No trips yet'}</div>
                  ) : sortedKeys.map(key => {
                    const group = grouped[key];
                    const first = group[0];
                    const routeObj = first.routes;
                    const isExpanded = expandedTrips.has(key);
                    const activeBookings = group.filter((b: any) => b.status !== 'cancelled');
                    const routeOrigin = { lat: routeObj?.origin_lat || 0, lng: routeObj?.origin_lng || 0 };
                    const routeDestination = { lat: routeObj?.destination_lat || 0, lng: routeObj?.destination_lng || 0 };
                    const optimizedOrder = isExpanded ? optimizePassengerOrder(activeBookings, routeOrigin, routeDestination) : [];
                    const validWaypoints = optimizedOrder.filter(wp => wp.coords.lat !== 0 && wp.coords.lng !== 0);

                    return (
                      <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
                        <button onClick={() => toggleTrip(key)} className="w-full flex items-center justify-between p-4 text-start hover:bg-muted/30 transition-colors">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground text-sm">{lang === 'ar' ? routeObj?.name_ar : routeObj?.name_en}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{first.scheduled_date}</span>
                              <span>{first.scheduled_time?.slice(0, 5)}</span>
                              <span>{activeBookings.length} {lang === 'ar' ? 'راكب' : 'riders'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[first.status]}`}>{t(`booking.status.${first.status}`)}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border p-4 space-y-3">
                            {validWaypoints.length > 0 && (
                              <MapView
                                className="h-56 rounded-xl overflow-hidden"
                                markers={[
                                  { lat: routeOrigin.lat, lng: routeOrigin.lng, label: 'A', color: 'green' as const },
                                  ...validWaypoints.map((wp, i) => ({ lat: wp.coords.lat, lng: wp.coords.lng, label: `${i + 1}`, color: (wp.type === 'pickup' ? 'green' : 'red') as 'green' | 'red' })),
                                  { lat: routeDestination.lat, lng: routeDestination.lng, label: 'B', color: 'red' as const },
                                ]}
                                origin={routeOrigin}
                                destination={routeDestination}
                                waypoints={validWaypoints.map(wp => ({ lat: wp.coords.lat, lng: wp.coords.lng }))}
                                showDirections={true}
                                showUserLocation={false}
                                zoom={11}
                              />
                            )}
                            <div className="space-y-2">
                              {activeBookings.map((b: any) => {
                                const passenger = passengerProfiles[b.user_id];
                                const name = passenger?.full_name || (lang === 'ar' ? 'راكب' : 'Rider');
                                return (
                                  <div key={b.id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {b.custom_pickup_name && <><MapPin className="w-3 h-3 inline text-green-500" /> {b.custom_pickup_name}</>}
                                        </p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => { setChatBookingId(b.id); setChatPassengerName(name); }}>
                                      <MessageCircle className="w-4 h-4 text-primary" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <RideChat bookingId={chatBookingId || ''} otherName={chatPassengerName} isOpen={!!chatBookingId} onClose={() => setChatBookingId(null)} />
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
