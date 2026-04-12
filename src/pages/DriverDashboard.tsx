import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12h } from '@/lib/utils';
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
  const { t, lang, setLang, appName } = useLanguage();
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
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [expandedUpcoming, setExpandedUpcoming] = useState<string | null>(null);
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
  const [quickAddDay, setQuickAddDay] = useState<{ routeId: string; day: number; shuttleId: string } | null>(null);
  const [quickAddTime, setQuickAddTime] = useState('12:00');
  const [quickAddDir, setQuickAddDir] = useState<'go' | 'return'>('go');
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);

  const { newBookingsCount, acknowledge: ackBookings } = useDriverBookingNotifications(shuttle?.id || null);
  

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduleRoutePreview = selectedRouteForSchedule || allRoutes.find((routeItem: any) => routeItem.id === scheduleForm.route_id) || null;
  const scheduleRouteStops = scheduleRoutePreview?.stops
    ? [...scheduleRoutePreview.stops].sort((a: any, b: any) => a.stop_order - b.stop_order)
    : [];
  const canShowScheduleRouteMap =
    scheduleRoutePreview?.origin_lat != null &&
    scheduleRoutePreview?.origin_lng != null &&
    scheduleRoutePreview?.destination_lat != null &&
    scheduleRoutePreview?.destination_lng != null;

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

  // Real-time subscription for stops changes — refresh allRoutes when stops are modified
  useEffect(() => {
    const channel = supabase
      .channel('stops-realtime-driver')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops' }, async () => {
        const { data: routesData } = await supabase.from('routes').select('*, stops(*)').eq('status', 'active');
        setAllRoutes(routesData || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const generateRideInstances = async (scheduleEntries: any[], explicitDirection?: 'go' | 'return') => {
    if (!user || !shuttle) return;
    const instances: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    for (const entry of scheduleEntries) {
      const weeksAhead = entry.is_recurring ? 4 : 1;
      for (let w = 0; w < weeksAhead; w++) {
        for (let d = 0; d < 7; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() + (w * 7) + d);
          if (date.getDay() === entry.day_of_week && date >= today) {
            const dateStr = date.toISOString().split('T')[0];
            // Skip if the time has already passed today
            if (dateStr === todayStr) {
              const [hh, mm] = entry.departure_time.split(':').map(Number);
              const depTime = new Date();
              depTime.setHours(hh, mm, 0, 0);
              if (Date.now() > depTime.getTime()) continue;
            }
            instances.push({ driver_id: user.id, route_id: entry.route_id, shuttle_id: shuttle.id, ride_date: dateStr, departure_time: entry.departure_time, available_seats: shuttle.capacity, total_seats: shuttle.capacity, status: 'scheduled', direction: explicitDirection || 'go' });
            if (entry.return_time) {
              // Also skip return if time passed today
              let skipReturn = false;
              if (dateStr === todayStr) {
                const [rh, rm] = entry.return_time.split(':').map(Number);
                const retTime = new Date();
                retTime.setHours(rh, rm, 0, 0);
                if (Date.now() > retTime.getTime()) skipReturn = true;
              }
              if (!skipReturn) {
                instances.push({ driver_id: user.id, route_id: entry.route_id, shuttle_id: shuttle.id, ride_date: dateStr, departure_time: entry.return_time, available_seats: shuttle.capacity, total_seats: shuttle.capacity, status: 'scheduled', direction: 'return' });
              }
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
    const schedule = driverSchedules.find(s => s.id === id);
    const { error } = await supabase.from('driver_schedules').delete().eq('id', id);
    if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); return; }

    // Cancel all future ride instances and bookings for this shuttle
    if (shuttle && schedule) {
      const todayStr = new Date().toISOString().split('T')[0];
      // Cancel future ride instances for this shuttle+route
      const { data: futureRides } = await supabase
        .from('ride_instances')
        .select('id')
        .eq('shuttle_id', shuttle.id)
        .eq('route_id', schedule.route_id)
        .gte('ride_date', todayStr)
        .in('status', ['scheduled']);

      if (futureRides && futureRides.length > 0) {
        await supabase.from('ride_instances').update({ status: 'cancelled' }).in('id', futureRides.map(r => r.id));
      }

      // Cancel all bookings on this shuttle (matching route or null route) — triggers realtime notifications
      let bookingQuery = supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('shuttle_id', shuttle.id)
        .gte('scheduled_date', todayStr)
        .in('status', ['pending', 'confirmed']);

      // Match bookings with this route_id OR with null route_id (legacy bookings)
      bookingQuery = bookingQuery.or(`route_id.eq.${schedule.route_id},route_id.is.null`);
      await bookingQuery;
    }

    setDriverSchedules(prev => prev.filter(s => s.id !== id));
    toast({ title: lang === 'ar' ? 'تم حذف الجدول وإلغاء الرحلات' : 'Schedule removed & rides cancelled' });
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

  const quickAddTimeSlot = async () => {
    if (!user || !shuttle || !quickAddDay) return;
    setSavingQuickAdd(true);
    const entry = {
      driver_id: user.id, route_id: quickAddDay.routeId, shuttle_id: quickAddDay.shuttleId,
      day_of_week: quickAddDay.day,
      departure_time: quickAddDir === 'go' ? quickAddTime : quickAddTime,
      return_time: quickAddDir === 'return' ? quickAddTime : null,
      is_recurring: true, is_active: true, min_passengers: 5,
    };
    const { error } = await supabase.from('driver_schedules').insert(entry);
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? 'تمت إضافة الرحلة!' : 'Trip added!' });
      await generateRideInstances([entry], quickAddDir);
      const { data } = await supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)').eq('driver_id', user.id).order('day_of_week');
      setDriverSchedules(data || []);
    }
    setQuickAddDay(null);
    setSavingQuickAdd(false);
  };
  const handleMapClick = (lat: number, lng: number) => {
    if (!pickingLocation) return;
    if (pickingLocation === 'origin') setRouteRequestForm(p => ({ ...p, origin_lat: lat, origin_lng: lng, origin_name: p.origin_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    else setRouteRequestForm(p => ({ ...p, destination_lat: lat, destination_lng: lng, destination_name: p.destination_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
  };

  const startTrip = async (slot: any) => {
    if (!user || !shuttle) return;
    setStartingTrip(true);
    try {
      // Send push notification to all booked riders
      await supabase.functions.invoke('push-notification', {
        body: {
          notification_type: 'trip_started',
          record: {
            shuttle_id: shuttle.id,
            route_id: slot.routeId,
            driver_id: user.id,
            scheduled_date: slot.dateStr,
            scheduled_time: slot.time,
            direction: slot.direction === 'back' ? 'return' : 'go',
          },
        },
      });
    } catch (e) {
      console.error('Failed to send trip started notification:', e);
    }
    setStartingTrip(false);
    navigate('/active-ride');
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

  if (loading) return <div className="h-screen flex items-center justify-center overflow-hidden"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

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
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">{appName}</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-6 max-w-2xl pb-24">
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

                {shuttle.status !== 'active' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      {lang === 'ar' ? 'أنت غير متصل. شغّل الاتصال أعلاه حتى يتمكن الركاب من الحجز وتستطيع بدء الرحلة.' : 'You\'re offline. Go online above so riders can book and you can start trips.'}
                    </p>
                  </div>
                )}

                {/* ===== UPCOMING TRIPS ===== */}
                {driverSchedules.length > 0 && (() => {
                  const now = new Date();
                  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  const todayDow = now.getDay();

                  // Build trip slots: each schedule → separate Go and Back entries
                  type TripSlot = { scheduleId: string; routeId: string; routeInfo: any; day: number; time: string; direction: 'go' | 'back'; dayOffset: number; dateStr: string; isPast: boolean; };
                  const tripSlots: TripSlot[] = [];

                  for (const s of driverSchedules) {
                    const getNextDate = (targetDow: number) => {
                      let offset = targetDow - todayDow;
                      if (offset < 0) offset += 7;
                      if (offset === 0) return { offset: 0, dateStr: now.toISOString().split('T')[0] };
                      const d = new Date(now);
                      d.setDate(now.getDate() + offset);
                      return { offset, dateStr: d.toISOString().split('T')[0] };
                    };
                    const { offset, dateStr } = getNextDate(s.day_of_week);

                    // Go trip - always show, mark as past if needed
                    if (s.departure_time) {
                      const isPast = offset === 0 && s.departure_time?.slice(0, 5) < currentTime;
                      tripSlots.push({
                        scheduleId: s.id, routeId: s.route_id, routeInfo: s.routes,
                        day: s.day_of_week, time: s.departure_time?.slice(0, 5),
                        direction: 'go', dayOffset: offset, dateStr, isPast,
                      });
                    }
                    // Back trip
                    if (s.return_time) {
                      const isPast = offset === 0 && s.return_time?.slice(0, 5) < currentTime;
                      tripSlots.push({
                        scheduleId: s.id, routeId: s.route_id, routeInfo: s.routes,
                        day: s.day_of_week, time: s.return_time?.slice(0, 5),
                        direction: 'back', dayOffset: offset, dateStr, isPast,
                      });
                    }
                  }

                  // Also inject ad-hoc slots from today's bookings that don't match any schedule day
                  const todayStr2 = now.toISOString().split('T')[0];
                  const scheduledDays = new Set(driverSchedules.map(s => s.day_of_week));
                  if (!scheduledDays.has(todayDow)) {
                    // Group today's bookings by time+direction
                    const adHocMap = new Map<string, { time: string; direction: 'go' | 'back'; routeId: string }>();
                    todayBookings.forEach(b => {
                      const dir = b.trip_direction === 'return' ? 'back' : 'go';
                      const timeKey = `${b.scheduled_time?.slice(0, 5)}_${dir}`;
                      if (!adHocMap.has(timeKey)) {
                        adHocMap.set(timeKey, { time: b.scheduled_time?.slice(0, 5), direction: dir, routeId: b.route_id });
                      }
                      // Also add return slot for 'both' trips
                      if (b.trip_direction === 'both') {
                        const returnKey = `${b.scheduled_time?.slice(0, 5)}_back`;
                        if (!adHocMap.has(returnKey)) {
                          adHocMap.set(returnKey, { time: b.scheduled_time?.slice(0, 5), direction: 'back', routeId: b.route_id });
                        }
                      }
                    });
                    adHocMap.forEach((v) => {
                      const routeInfo = allRoutes.find(r => r.id === v.routeId);
                      tripSlots.push({
                        scheduleId: `adhoc_${v.time}_${v.direction}`,
                        routeId: v.routeId,
                        routeInfo,
                        day: todayDow,
                        time: v.time,
                        direction: v.direction,
                        dayOffset: 0,
                        dateStr: todayStr2,
                        isPast: v.time < currentTime,
                      });
                    });
                  }

                  // Sort: non-past first, then by day offset, then by time
                  tripSlots.sort((a, b) => {
                    if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
                    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
                    return a.time.localeCompare(b.time);
                  });

                  const displaySlots = showAllUpcoming ? tripSlots : tripSlots.slice(0, 4);
                  const routeIds = [...new Set(driverSchedules.map(s => s.route_id).filter(Boolean))];
                  const firstTodayTrip = tripSlots.find(slot => slot.dayOffset === 0) || null;

                  const getDayLabel = (offset: number, dow: number) => {
                    if (offset === 0) return lang === 'ar' ? 'اليوم' : 'Today';
                    if (offset === 1) return lang === 'ar' ? 'غداً' : 'Tomorrow';
                    return dayNames[dow];
                  };

                  return (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        {lang === 'ar' ? 'الرحلات القادمة' : 'Upcoming Trips'}
                      </h3>

                      <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {lang === 'ar' ? 'إدارة رحلات اليوم' : 'Manage today\'s trips'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {lang === 'ar'
                                ? 'من هنا تضيف رحلة جديدة بسرعة، أو تفتح أي رحلة، أو تحذفها من زر الحذف على اليمين.'
                                : 'Use this area to quickly add a trip, open a trip, or remove it with the delete button on the right.'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setTab('schedule')}>
                            <Calendar className="w-4 h-4 me-1" />
                            {lang === 'ar' ? 'الجدول الكامل' : 'Full schedule'}
                          </Button>
                        </div>

                        {quickAddDay ? (
                          <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                            <p className="text-sm font-medium text-foreground">{lang === 'ar' ? 'إضافة رحلة جديدة' : 'Add new trip'}</p>
                            <div className="flex flex-wrap gap-2">
                              {dayNames.map((name, i) => (
                                <button
                                  key={i}
                                  onClick={() => setQuickAddDay(prev => prev ? { ...prev, day: i } : null)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    quickAddDay?.day === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border'
                                  }`}
                                >
                                  {name}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch gap-2">
                              <select
                                value={quickAddDir}
                                onChange={e => setQuickAddDir(e.target.value as 'go' | 'return')}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="go">{lang === 'ar' ? '→ ذهاب' : '→ Going'}</option>
                                <option value="return">{lang === 'ar' ? '← عودة' : '← Returning'}</option>
                              </select>
                              <Input type="time" value={quickAddTime} onChange={e => setQuickAddTime(e.target.value)} className="flex-1 h-10" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button className="flex-1" onClick={quickAddTimeSlot} disabled={savingQuickAdd}>
                                {savingQuickAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 me-1" />}
                                {lang === 'ar' ? 'إضافة الرحلة الآن' : 'Add trip now'}
                              </Button>
                              <Button variant="outline" className="flex-1" onClick={() => setQuickAddDay(null)}>
                                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            className="w-full h-11"
                            onClick={() => routeIds.length > 0 ? setQuickAddDay({ routeId: routeIds[0], day: todayDow, shuttleId: shuttle.id }) : setTab('schedule')}
                          >
                            <Plus className="w-4 h-4 me-1" />
                            {lang === 'ar' ? 'إضافة توقيت جديد لليوم' : 'Add a new time for today'}
                          </Button>
                        )}
                      </div>

                      {displaySlots.map((slot) => {
                        const key = `${slot.scheduleId}_${slot.direction}`;
                        const isExpanded = expandedUpcoming === key;

                        // Get passenger count for THIS specific slot
                        const slotBookings = bookings.filter(b => {
                          if (b.route_id !== slot.routeId || b.status === 'cancelled') return false;
                          // Match by date string for accuracy (avoids timezone day-of-week issues)
                          if (b.scheduled_date !== slot.dateStr) return false;
                          // Match direction — schedule uses 'go'/'back', bookings use 'go'/'return'/'both'
                          if (slot.direction === 'go') return b.trip_direction === 'go' || b.trip_direction === 'both';
                          return b.trip_direction === 'return' || b.trip_direction === 'back' || b.trip_direction === 'both';
                        });

                        const isToday = slot.dayOffset === 0;
                        const isAdHoc = slot.scheduleId.startsWith('adhoc_');
                        const isTestTrip = !!firstTodayTrip && firstTodayTrip.scheduleId === slot.scheduleId && firstTodayTrip.direction === slot.direction;

                        // Time gate: can start from 2h before up to 30 min after departure
                        const [slotH, slotM] = slot.time.split(':').map(Number);
                        const slotDate = new Date(slot.dateStr + 'T00:00:00');
                        slotDate.setHours(slotH, slotM, 0);
                        const msUntilDeparture = slotDate.getTime() - Date.now();
                        const msSinceDeparture = -msUntilDeparture;
                        const withinStartWindow = msUntilDeparture <= 2 * 60 * 60 * 1000 && msSinceDeparture <= 30 * 60 * 1000;
                        const isExpired = isToday && msSinceDeparture > 30 * 60 * 1000;

                        // Find schedule's min_passengers
                        const scheduleEntry = driverSchedules.find(s => s.id === slot.scheduleId);
                        const minPassengers = scheduleEntry?.min_passengers || 5;
                        const hasEnoughPassengers = slotBookings.length >= minPassengers;
                        const canStart = shuttle.status === 'active' && isToday && withinStartWindow && !isExpired && (slotBookings.length > 0 || isTestTrip || isAdHoc);
                        const belowMinimum = canStart && slotBookings.length > 0 && !hasEnoughPassengers && !isTestTrip;

                        const routeOrigin = { lat: slot.routeInfo?.origin_lat || 0, lng: slot.routeInfo?.origin_lng || 0 };
                        const routeDestination = { lat: slot.routeInfo?.destination_lat || 0, lng: slot.routeInfo?.destination_lng || 0 };
                        const displayOrigin = slot.direction === 'go'
                          ? (lang === 'ar' ? slot.routeInfo?.origin_name_ar : slot.routeInfo?.origin_name_en)
                          : (lang === 'ar' ? slot.routeInfo?.destination_name_ar : slot.routeInfo?.destination_name_en);
                        const displayDest = slot.direction === 'go'
                          ? (lang === 'ar' ? slot.routeInfo?.destination_name_ar : slot.routeInfo?.destination_name_en)
                          : (lang === 'ar' ? slot.routeInfo?.origin_name_ar : slot.routeInfo?.origin_name_en);

                        return (
                          <div key={key} className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                            isExpired ? 'border-destructive/30 opacity-70' : slot.isPast ? 'border-border' : slot.direction === 'go' ? 'border-green-200' : 'border-blue-200'
                          }`}>
                            <div className="flex items-stretch">
                              <button
                                onClick={() => setExpandedUpcoming(isExpanded ? null : key)}
                                className="flex-1 p-4 text-start hover:bg-muted/30 transition-colors"
                              >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                                    slot.isPast ? 'bg-muted text-muted-foreground' : slot.direction === 'go' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {slot.isPast ? '✓' : lang === 'ar' ? '←' : '→'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                        isExpired ? 'bg-destructive/10 text-destructive' : slot.isPast ? 'bg-muted text-muted-foreground' : slot.direction === 'go' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {isExpired
                                          ? (lang === 'ar' ? '⚠ فات الموعد' : '⚠ Expired')
                                          : slot.isPast
                                          ? (lang === 'ar' ? 'انتهت' : 'Passed')
                                          : slot.direction === 'go' ? (lang === 'ar' ? 'ذهاب' : 'Going') : (lang === 'ar' ? 'عودة' : 'Returning')}
                                      </span>
                                      <span className="text-xs text-muted-foreground">{getDayLabel(slot.dayOffset, slot.day)}</span>
                                    </div>
                                    <p className={`text-sm font-medium mt-0.5 ${slot.isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                                      {slot.direction === 'go'
                                        ? `${displayOrigin} ${lang === 'ar' ? '←' : '→'} ${displayDest}`
                                        : `${displayDest} ${lang === 'ar' ? '←' : '→'} ${displayOrigin}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{slotBookings.length} {lang === 'ar' ? 'راكب' : 'passengers'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-end">
                                    <p className={`text-lg font-bold ${slot.isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{formatTime12h(slot.time, lang)}</p>
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </button>
                              {/* Delete button on card */}
                              <button
                                onClick={() => deleteSchedule(slot.scheduleId)}
                                className="px-3 sm:px-4 flex items-center justify-center gap-2 border-s border-border hover:bg-destructive/10 transition-colors text-destructive"
                                title={lang === 'ar' ? 'حذف الرحلة' : 'Remove trip'}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline text-xs font-medium">{lang === 'ar' ? 'حذف' : 'Remove'}</span>
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-border p-4 space-y-3">
                                {isTestTrip && (
                                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-primary" />
                                    <p className="text-sm text-foreground">
                                      {lang === 'ar'
                                        ? 'هذه أول رحلة اليوم، ويمكنك فتحها الآن للتجربة.'
                                        : 'This is the first trip today, so you can open it now for testing.'}
                                    </p>
                                  </div>
                                )}

                                {/* Expired trip warning */}
                                {isExpired && slotBookings.length > 0 && (
                                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-2">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium text-destructive">
                                          {lang === 'ar'
                                            ? 'فات الموعد بأكثر من 30 دقيقة — تم إلغاء الرحلة تلقائياً'
                                            : 'Departure exceeded by 30+ minutes — trip auto-cancelled'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {lang === 'ar'
                                            ? `${slotBookings.length} راكب تم إبلاغهم بالإلغاء`
                                            : `${slotBookings.length} passenger(s) have been notified`}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {isExpired && slotBookings.length === 0 && (
                                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                      {lang === 'ar' ? 'فات موعد الرحلة ولم يكن هناك ركاب' : 'Trip time passed with no passengers'}
                                    </p>
                                  </div>
                                )}

                                {/* Status message */}
                                {!isToday && !isExpired && (
                                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                      {lang === 'ar'
                                        ? `ستبدأ هذه الرحلة ${getDayLabel(slot.dayOffset, slot.day)} الساعة ${formatTime12h(slot.time, lang)}`
                                        : `This trip starts ${getDayLabel(slot.dayOffset, slot.day)} at ${formatTime12h(slot.time, lang)}`}
                                    </p>
                                  </div>
                                )}

                                {isToday && !canStart && !isExpired && slotBookings.length === 0 && (
                                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                      {lang === 'ar' ? 'لا يوجد ركاب بعد. الرحلة تبدأ عند وصول الحجوزات' : 'No passengers yet. Trip starts when bookings arrive.'}
                                    </p>
                                  </div>
                                )}

                                {canStart && belowMinimum && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium text-amber-800">
                                          {lang === 'ar'
                                            ? `الحد الأدنى ${minPassengers} ركاب — الحالي ${slotBookings.length} فقط`
                                            : `Minimum ${minPassengers} passengers — only ${slotBookings.length} booked`}
                                        </p>
                                        <p className="text-xs text-amber-600 mt-1">
                                          {lang === 'ar' ? 'هل تريد بدء الرحلة على أي حال؟' : 'Do you want to start the trip anyway?'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        className="flex-1 h-11 rounded-xl"
                                        onClick={() => startTrip(slot)}
                                        disabled={startingTrip}
                                      >
                                        {startingTrip ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Play className="w-4 h-4 me-2" />}
                                        {lang === 'ar' ? 'نعم، ابدأ' : 'Yes, Start'}
                                      </Button>
                                      <Button variant="outline" className="flex-1 h-11 rounded-xl text-muted-foreground">
                                        {lang === 'ar' ? 'لا، انتظر' : 'No, Wait'}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {canStart && !belowMinimum && (
                                  <Button
                                    className="w-full h-12 text-base rounded-xl"
                                    size="lg"
                                    onClick={() => startTrip(slot)}
                                    disabled={startingTrip}
                                  >
                                    {startingTrip ? <Loader2 className="w-5 h-5 animate-spin me-2" /> : <Play className="w-5 h-5 me-2" />}
                                    {lang === 'ar' ? 'ابدأ الرحلة الآن' : 'Start This Trip'}
                                  </Button>
                                )}

                                {isToday && shuttle.status !== 'active' && slotBookings.length > 0 && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                                    {lang === 'ar' ? 'شغّل الاتصال لبدء الرحلة' : 'Go online to start this trip'}
                                  </div>
                                )}

                                {/* Map */}
                                {slot.routeInfo?.origin_lat && slot.routeInfo?.destination_lat && (() => {
                                  const slotRouteStops = allRoutes.find((r: any) => r.id === slot.routeId)?.stops || [];
                                  const sortedSlotStops = [...slotRouteStops].sort((a: any, b: any) => a.stop_order - b.stop_order);
                                  return (
                                    <MapView
                                      className="h-44 rounded-xl overflow-hidden"
                                      markers={[
                                        { lat: slot.direction === 'go' ? routeOrigin.lat : routeDestination.lat, lng: slot.direction === 'go' ? routeOrigin.lng : routeDestination.lng, label: 'A', color: 'green' },
                                        ...sortedSlotStops.map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                                        { lat: slot.direction === 'go' ? routeDestination.lat : routeOrigin.lat, lng: slot.direction === 'go' ? routeDestination.lng : routeOrigin.lng, label: 'B', color: 'red' },
                                      ]}
                                      origin={slot.direction === 'go' ? routeOrigin : routeDestination}
                                      destination={slot.direction === 'go' ? routeDestination : routeOrigin}
                                      waypoints={sortedSlotStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                                      showDirections
                                      showUserLocation={false}
                                      zoom={10}
                                    />
                                  );
                                })()}

                                {/* Passengers */}
                                {slotBookings.length > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {lang === 'ar' ? `الركاب (${slotBookings.length})` : `Passengers (${slotBookings.length})`}
                                    </p>
                                    {slotBookings.map(b => {
                                      const passenger = passengerProfiles[b.user_id];
                                      const name = passenger?.full_name || (lang === 'ar' ? 'راكب' : 'Rider');
                                      return (
                                        <div key={b.id} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                              <User className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                            <div>
                                              <p className="text-xs font-medium text-foreground">{name}</p>
                                              <p className="text-[10px] text-muted-foreground">
                                                {b.custom_pickup_name && <><MapPin className="w-3 h-3 inline text-green-500" /> {b.custom_pickup_name} · </>}
                                                {b.seats} {t('booking.seat')} · {formatTime12h(b.scheduled_time, lang)}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setChatBookingId(b.id); setChatPassengerName(name); }}>
                                              <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground text-center py-2">{lang === 'ar' ? 'لا يوجد ركاب' : 'No passengers'}</p>
                                )}

                                {/* Delete schedule */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => deleteSchedule(slot.scheduleId)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 me-1" />
                                  {lang === 'ar' ? 'حذف هذه الرحلة' : 'Remove this trip'}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {tripSlots.length > 3 && (
                        <button
                          onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                          className="w-full text-center text-sm text-primary hover:underline py-2"
                        >
                          {showAllUpcoming
                            ? (lang === 'ar' ? 'عرض أقل' : 'Show less')
                            : (lang === 'ar' ? `عرض الكل (${tripSlots.length} رحلة)` : `Show all (${tripSlots.length} trips)`)}
                        </button>
                      )}

                    </div>
                  );
                })()}

                {/* How it works — show once when no bookings */}
                {driverSchedules.length > 0 && todayBookings.length === 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <h4 className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      {lang === 'ar' ? 'كيف تعمل الرحلات؟' : 'How trips work'}
                    </h4>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>{lang === 'ar' ? 'شغّل الاتصال (Go Online) حتى يرى الركاب رحلاتك' : 'Go Online so riders can see your trips'}</li>
                      <li>{lang === 'ar' ? 'الركاب يحجزون رحلات الذهاب أو العودة أو الاثنين' : 'Riders book going, return, or round trips'}</li>
                      <li>{lang === 'ar' ? 'عندما يحين وقت الرحلة، اضغط "ابدأ الرحلة"' : 'When it\'s trip time, tap "Start This Trip"'}</li>
                      <li>{lang === 'ar' ? 'تابع الركاب وأكّد الصعود والنزول' : 'Track riders, confirm boarding and drop-off'}</li>
                    </ol>
                  </div>
                )}

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

                {/* View all previous trips button */}
                <Button
                  variant="outline"
                  className="w-full h-12 text-sm"
                  onClick={() => setTab('trips')}
                >
                  <Navigation className="w-4 h-4 me-2" />
                  {lang === 'ar' ? 'عرض جميع الرحلات السابقة' : 'View All Previous Trips'}
                </Button>
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
                          {routeInfo?.origin_lat && routeInfo?.destination_lat && (() => {
                            const routeStops = allRoutes.find((r: any) => r.id === routeId)?.stops || [];
                            const sortedStops = [...routeStops].sort((a: any, b: any) => a.stop_order - b.stop_order);
                            return (
                              <MapView
                                className="h-[200px] mb-3"
                                markers={[
                                  { lat: routeInfo.origin_lat, lng: routeInfo.origin_lng, label: 'A', color: 'green' },
                                  ...sortedStops.map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                                  { lat: routeInfo.destination_lat, lng: routeInfo.destination_lng, label: 'B', color: 'red' },
                                ]}
                                origin={{ lat: routeInfo.origin_lat, lng: routeInfo.origin_lng }}
                                destination={{ lat: routeInfo.destination_lat, lng: routeInfo.destination_lng }}
                                waypoints={sortedStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                                showDirections
                                showUserLocation={false}
                                zoom={10}
                              />
                            );
                          })()}
                          <div className="space-y-1.5">
                            {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-foreground w-16">{dayNames[s.day_of_week]}</span>
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">{formatTime12h(s.departure_time, lang)}</span>
                                  {s.return_time && <><ArrowRight className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">{formatTime12h(s.return_time, lang)}</span></>}
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
                    {scheduleRoutePreview && (
                      <div className="space-y-3">
                        <div className="bg-primary/5 rounded-xl p-3">
                          <p className="font-medium text-foreground text-sm">{lang === 'ar' ? scheduleRoutePreview.name_ar : scheduleRoutePreview.name_en}</p>
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? scheduleRoutePreview.origin_name_ar : scheduleRoutePreview.origin_name_en} → {lang === 'ar' ? scheduleRoutePreview.destination_name_ar : scheduleRoutePreview.destination_name_en}</p>
                        </div>
                        {canShowScheduleRouteMap && (
                          <MapView
                            className="h-[220px]"
                            markers={[
                              { lat: scheduleRoutePreview.origin_lat, lng: scheduleRoutePreview.origin_lng, label: 'A', color: 'green' },
                              ...scheduleRouteStops.map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                              { lat: scheduleRoutePreview.destination_lat, lng: scheduleRoutePreview.destination_lng, label: 'B', color: 'red' },
                            ]}
                            origin={{ lat: scheduleRoutePreview.origin_lat, lng: scheduleRoutePreview.origin_lng }}
                            destination={{ lat: scheduleRoutePreview.destination_lat, lng: scheduleRoutePreview.destination_lng }}
                            waypoints={scheduleRouteStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                            showDirections
                            showUserLocation={false}
                            zoom={10}
                          />
                        )}
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
                        {r.origin_lat && r.destination_lat && (() => {
                          const rStops = (r.stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
                          return (
                            <MapView
                              className="h-[200px] mb-2"
                              markers={[
                                { lat: r.origin_lat, lng: r.origin_lng, label: 'A', color: 'green' },
                                ...rStops.map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                                { lat: r.destination_lat, lng: r.destination_lng, label: 'B', color: 'red' },
                              ]}
                              origin={{ lat: r.origin_lat, lng: r.origin_lng }}
                              destination={{ lat: r.destination_lat, lng: r.destination_lng }}
                              waypoints={rStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                              showDirections
                              showUserLocation={false}
                              zoom={10}
                            />
                          );
                        })()}
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
              // Filter out bookings whose route no longer exists or is inactive
              const validBookings = bookings.filter(b => b.routes != null);
              const grouped: Record<string, any[]> = {};
              validBookings.forEach(b => {
                const key = `${b.scheduled_date}__${b.route_id || 'no-route'}__${b.scheduled_time}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(b);
              });
              const sortedKeys = Object.keys(grouped).sort((a, b) => {
                // Sort by date descending, then time descending (most recent first)
                const [dateA, , timeA] = a.split('__');
                const [dateB, , timeB] = b.split('__');
                if (dateA !== dateB) return dateB.localeCompare(dateA);
                return (timeB || '').localeCompare(timeA || '');
              });

              return (
                <div className="space-y-3">
                  {sortedKeys.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">{lang === 'ar' ? 'لا توجد رحلات بعد' : 'No trips yet'}</div>
                  ) : sortedKeys.map(key => {
                    const group = grouped[key];
                    const first = group[0];
                    const routeObj = first.routes;
                    const isExpanded = expandedTrips.has(key);
                    const allBookings = group; // Keep all bookings visible including cancelled
                    const activeBookings = group.filter((b: any) => b.status !== 'cancelled');
                    const routeOrigin = { lat: routeObj?.origin_lat || 0, lng: routeObj?.origin_lng || 0 };
                    const routeDestination = { lat: routeObj?.destination_lat || 0, lng: routeObj?.destination_lng || 0 };
                    const optimizedOrder = isExpanded ? optimizePassengerOrder(activeBookings, routeOrigin, routeDestination) : [];
                    const validWaypoints = optimizedOrder.filter(wp => wp.coords.lat !== 0 && wp.coords.lng !== 0);

                    // Check if this trip is expired (30+ min past departure)
                    const [expH, expM] = (first.scheduled_time || '00:00').split(':').map(Number);
                    const expDep = new Date(first.scheduled_date + 'T00:00:00');
                    expDep.setHours(expH, expM, 0);
                    const tripIsExpired = (Date.now() - expDep.getTime()) > 30 * 60 * 1000;
                    const tripIsPast = first.scheduled_date < new Date().toISOString().split('T')[0];

                    return (
                      <div key={key} className={`bg-card border rounded-2xl overflow-hidden ${tripIsExpired || tripIsPast ? 'border-destructive/30' : 'border-border'}`}>
                        <button onClick={() => toggleTrip(key)} className="w-full flex items-center justify-between p-4 text-start hover:bg-muted/30 transition-colors">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground text-sm">{lang === 'ar' ? routeObj?.name_ar : routeObj?.name_en}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{first.scheduled_date}</span>
                              <span>{formatTime12h(first.scheduled_time, lang)}</span>
                              <span>{activeBookings.filter((b: any) => b.trip_direction === 'go' || b.trip_direction === 'both').length} {lang === 'ar' ? 'ذهاب' : 'go'}</span>
                              <span>{activeBookings.filter((b: any) => b.trip_direction === 'return' || b.trip_direction === 'both').length} {lang === 'ar' ? 'عودة' : 'back'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(tripIsExpired || tripIsPast) ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</span>
                            ) : (
                              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[first.status]}`}>{t(`booking.status.${first.status}`)}</span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (() => {
                          const today = new Date().toISOString().split('T')[0];
                          const isTripToday = first.scheduled_date === today;
                          // Check 30-min expiry window
                          const [tripH, tripM] = (first.scheduled_time || '00:00').split(':').map(Number);
                          const tripDep = new Date(first.scheduled_date + 'T00:00:00');
                          tripDep.setHours(tripH, tripM, 0);
                          const msSinceTripDep = Date.now() - tripDep.getTime();
                          const tripExpired = msSinceTripDep > 30 * 60 * 1000;
                          const withinWindow = (tripDep.getTime() - Date.now()) <= 2 * 60 * 60 * 1000 && msSinceTripDep <= 30 * 60 * 1000;
                          const canStartTrip = isTripToday && shuttle?.status === 'active' && activeBookings.length > 0 && withinWindow && !tripExpired;
                          return (
                          <div className="border-t border-border p-4 space-y-3">
                            {tripExpired && isTripToday && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-destructive">
                                    {lang === 'ar' ? 'فات الموعد بأكثر من 30 دقيقة — لا يمكن بدء الرحلة' : 'Departure passed by 30+ minutes — trip cannot be started'}
                                  </p>
                                </div>
                              </div>
                            )}
                            {canStartTrip && (
                              <Link to="/active-ride">
                                <Button className="w-full h-12 text-base rounded-xl mb-2" size="lg">
                                  <Play className="w-5 h-5 me-2" />
                                  {lang === 'ar' ? 'ابدأ الرحلة الآن' : 'Start This Trip'}
                                </Button>
                              </Link>
                            )}
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
                                            {b.custom_pickup_name && <><MapPin className="w-3 h-3 inline text-green-500" /> {b.custom_pickup_name} · </>}
                                            <span className={`${b.trip_direction === 'go' ? 'text-green-600' : b.trip_direction === 'return' ? 'text-blue-600' : 'text-purple-600'}`}>
                                              {b.trip_direction === 'go' ? (lang === 'ar' ? 'ذهاب' : 'Going') : b.trip_direction === 'return' ? (lang === 'ar' ? 'عودة' : 'Return') : (lang === 'ar' ? 'ذهاب+عودة' : 'Round Trip')}
                                            </span>
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
                          );
                        })()}
                      </div>
                    );
                  })}
                  <RideChat bookingId={chatBookingId || ''} otherName={chatPassengerName} isOpen={!!chatBookingId} onClose={() => setChatBookingId(null)} onRead={() => {}} />
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
