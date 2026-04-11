import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MapView from '@/components/MapView';
import RideChat from '@/components/RideChat';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, ChevronRight, Users, MapPin, MessageCircle,
  CheckCircle2, Navigation, Loader2, UserCheck, LogOut as DropOff,
  Phone, Clock, AlertCircle, Flag, SkipForward, ArrowRight, Undo2,
  ExternalLink, DollarSign
} from 'lucide-react';

interface RouteStop {
  id: string;
  name_en: string;
  name_ar: string;
  lat: number;
  lng: number;
  stop_order: number;
  stop_type: string;
}

interface StopPassenger {
  bookingId: string;
  userId: string;
  name: string;
  phone?: string;
  boardingCode?: string;
  status: string;
  type: 'pickup' | 'dropoff';
  totalPrice: number;
  paymentProofUrl: string | null;
  seats: number;
}

interface ActiveStop {
  stop: RouteStop;
  pickupPassengers: StopPassenger[];
  dropoffPassengers: StopPassenger[];
}

const REACH_THRESHOLD_M = 200;

const haversineDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const ActiveRide = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [shuttle, setShuttle] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [activeStops, setActiveStops] = useState<ActiveStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardingInput, setBoardingInput] = useState('');
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitTimeMinutes, setWaitTimeMinutes] = useState(1); // default 1 min, fetched from app_settings
  const reachedStopsRef = useRef<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    // Fetch wait time setting
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'stop_waiting_time_minutes')
      .maybeSingle();
    if (settingsData?.value) {
      setWaitTimeMinutes(parseInt(settingsData.value) || 1);
    }

    const { data: allShuttles } = await supabase
      .from('shuttles')
      .select('*, routes(*)')
      .eq('driver_id', user.id);

    let chosenShuttle: any = null;
    let bks: any[] = [];

    for (const s of (allShuttles || [])) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('shuttle_id', s.id)
        .eq('scheduled_date', today)
        .in('status', ['confirmed', 'boarded']);
      if (bookingsData && bookingsData.length > 0) {
        chosenShuttle = s;
        bks = bookingsData;
        break;
      }
    }

    if (!chosenShuttle) {
      chosenShuttle = allShuttles?.[0] || null;
    }

    if (!chosenShuttle) { setLoading(false); return; }
    setShuttle(chosenShuttle);

    let routeData = chosenShuttle.routes;
    if (!routeData && bks.length > 0 && bks[0].route_id) {
      const { data: fallbackRoute } = await supabase
        .from('routes')
        .select('*')
        .eq('id', bks[0].route_id)
        .maybeSingle();
      routeData = fallbackRoute;
    }
    setRoute(routeData);
    setBookings(bks);

    // Fetch route stops
    if (routeData?.id) {
      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .eq('route_id', routeData.id)
        .order('stop_order');
      setRouteStops(stopsData || []);
    }

    const userIds = [...new Set(bks.map(b => b.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', userIds);
      const map: Record<string, any> = {};
      (profilesData || []).forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Find nearest route stop to a given lat/lng
  const findNearestStop = useCallback((lat: number, lng: number): RouteStop | null => {
    if (!routeStops.length) return null;
    let nearest = routeStops[0];
    let minDist = haversineDistance({ lat, lng }, { lat: nearest.lat, lng: nearest.lng });
    for (const s of routeStops) {
      const d = haversineDistance({ lat, lng }, { lat: s.lat, lng: s.lng });
      if (d < minDist) { minDist = d; nearest = s; }
    }
    return nearest;
  }, [routeStops]);

  // Build active stops from route stops + bookings
  useEffect(() => {
    if (!route) { setActiveStops([]); return; }

    // If no route stops defined, create virtual stops from custom locations
    if (!routeStops.length) {
      const virtualStops: ActiveStop[] = [];
      bookings.forEach(b => {
        const profile = profiles[b.user_id];
        const name = profile?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger');
        const passenger: StopPassenger = {
          bookingId: b.id, userId: b.user_id, name,
          phone: profile?.phone, boardingCode: b.boarding_code,
          status: b.status, type: 'pickup',
          totalPrice: parseFloat(b.total_price || 0),
          paymentProofUrl: b.payment_proof_url, seats: b.seats || 1,
        };
        if (b.status === 'confirmed' && (b.custom_pickup_lat || b.pickup_stop_id)) {
          const lat = b.custom_pickup_lat || 0;
          const lng = b.custom_pickup_lng || 0;
          const stopName = b.custom_pickup_name || 'Pickup';
          virtualStops.push({
            stop: { id: `virtual-pickup-${b.id}`, name_en: stopName, name_ar: stopName, lat, lng, stop_order: 0, stop_type: 'pickup' },
            pickupPassengers: [{ ...passenger, type: 'pickup' }],
            dropoffPassengers: [],
          });
        }
        if (b.status === 'boarded' && (b.custom_dropoff_lat || b.dropoff_stop_id)) {
          const lat = b.custom_dropoff_lat || 0;
          const lng = b.custom_dropoff_lng || 0;
          const stopName = b.custom_dropoff_name || 'Dropoff';
          virtualStops.push({
            stop: { id: `virtual-dropoff-${b.id}`, name_en: stopName, name_ar: stopName, lat, lng, stop_order: 999, stop_type: 'dropoff' },
            pickupPassengers: [],
            dropoffPassengers: [{ ...passenger, type: 'dropoff' }],
          });
        }
      });
      setActiveStops(virtualStops);
      return;
    }

    const stops: ActiveStop[] = [];

    for (const stop of routeStops) {
      const pickupPassengers: StopPassenger[] = [];
      const dropoffPassengers: StopPassenger[] = [];

      bookings.forEach(b => {
        const profile = profiles[b.user_id];
        const name = profile?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger');

        // Match by stop ID, or by nearest stop if using custom location
        const pickupMatch = b.pickup_stop_id === stop.id ||
          (!b.pickup_stop_id && b.custom_pickup_lat && findNearestStop(b.custom_pickup_lat, b.custom_pickup_lng)?.id === stop.id);

        const dropoffMatch = b.dropoff_stop_id === stop.id ||
          (!b.dropoff_stop_id && b.custom_dropoff_lat && findNearestStop(b.custom_dropoff_lat, b.custom_dropoff_lng)?.id === stop.id);

        if (pickupMatch && b.status === 'confirmed') {
          pickupPassengers.push({
            bookingId: b.id, userId: b.user_id, name,
            phone: profile?.phone, boardingCode: b.boarding_code,
            status: b.status, type: 'pickup',
            totalPrice: parseFloat(b.total_price || 0),
            paymentProofUrl: b.payment_proof_url, seats: b.seats || 1,
          });
        }

        if (dropoffMatch && b.status === 'boarded') {
          dropoffPassengers.push({
            bookingId: b.id, userId: b.user_id, name,
            phone: profile?.phone, status: b.status, type: 'dropoff',
            totalPrice: parseFloat(b.total_price || 0),
            paymentProofUrl: b.payment_proof_url, seats: b.seats || 1,
          });
        }
      });

      if (pickupPassengers.length > 0 || dropoffPassengers.length > 0) {
        stops.push({ stop, pickupPassengers, dropoffPassengers });
      }
    }

    setActiveStops(stops);
  }, [route, routeStops, bookings, profiles, lang, findNearestStop]);

  // Update driver location & push to DB
  useEffect(() => {
    if (!shuttle?.id || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverLocation(loc);
        await supabase.from('shuttles').update({
          current_lat: loc.lat,
          current_lng: loc.lng,
        }).eq('id', shuttle.id);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [shuttle?.id]);

  // Auto-detect arrival at current stop
  useEffect(() => {
    if (!driverLocation || activeStops.length === 0) return;
    if (currentStopIndex >= activeStops.length) return;

    const currentActive = activeStops[currentStopIndex];
    const dist = haversineDistance(driverLocation, { lat: currentActive.stop.lat, lng: currentActive.stop.lng });

    if (dist <= REACH_THRESHOLD_M && !reachedStopsRef.current.has(currentStopIndex)) {
      reachedStopsRef.current.add(currentStopIndex);
      if (currentActive.pickupPassengers.length > 0) {
        setArrivedAt(Date.now());
        setWaitSeconds(0);
      }
      toast({
        title: lang === 'ar'
          ? `📍 وصلت إلى ${currentActive.stop.name_ar}`
          : `📍 Reached ${currentActive.stop.name_en}`,
      });
    }
  }, [driverLocation, activeStops, currentStopIndex, lang, toast]);

  // Reset arrivedAt when stop changes
  useEffect(() => {
    setArrivedAt(null);
    setWaitSeconds(0);
  }, [currentStopIndex]);

  // Tick the wait timer
  useEffect(() => {
    if (arrivedAt === null) return;
    const interval = setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - arrivedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const waitTimeSec = waitTimeMinutes * 60;

  const advanceToNextStop = () => {
    if (currentStopIndex < activeStops.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
    }
  };

  const goToPreviousStop = () => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex(prev => prev - 1);
    }
  };

  const skipPassenger = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const refundAmount = Math.round(parseFloat(booking.total_price || 0) * 0.5 * 100) / 100;

    const { error } = await supabase.from('bookings').update({
      status: 'cancelled',
      skipped_at: new Date().toISOString(),
      driver_arrived_at: arrivedAt ? new Date(arrivedAt).toISOString() : new Date().toISOString(),
      skip_refund_amount: refundAmount,
    }).eq('id', bookingId);

    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
      return;
    }

    setBookings(prev => prev.map(b => b.id === bookingId
      ? { ...b, status: 'cancelled', skipped_at: new Date().toISOString(), skip_refund_amount: refundAmount }
      : b
    ));

    toast({
      title: lang === 'ar' ? 'تم تخطي الراكب' : 'Passenger Skipped',
      description: lang === 'ar'
        ? `سيتم استرداد ${refundAmount} جنيه (50%) للراكب`
        : `${refundAmount} EGP (50%) will be refunded to the passenger`,
    });
  };

  const verifyBoarding = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    if (booking.boarding_code !== boardingInput) {
      toast({
        title: lang === 'ar' ? 'رمز خاطئ' : 'Wrong Code',
        description: lang === 'ar' ? 'رمز الصعود غير صحيح' : 'Invalid boarding code',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('bookings').update({
      status: 'boarded',
      boarded_at: new Date().toISOString(),
    }).eq('id', bookingId);

    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
      return;
    }

    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'boarded', boarded_at: new Date().toISOString() } : b));
    setBoardingInput('');
    setVerifyingBooking(null);

    // Show payment info
    const amountDue = booking.payment_proof_url ? 0 : parseFloat(booking.total_price || 0);
    toast({
      title: lang === 'ar' ? 'تم التأكيد ✓' : 'Boarded! ✓',
      description: amountDue > 0
        ? (lang === 'ar' ? `💵 مطلوب كاش: ${amountDue} جنيه` : `💵 Cash needed: ${amountDue} EGP`)
        : (lang === 'ar' ? '✅ مدفوع عبر InstaPay — 0 جنيه' : '✅ Paid via InstaPay — 0 EGP'),
    });
  };

  const markDroppedOff = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').update({
      status: 'completed',
      dropped_off_at: new Date().toISOString(),
    }).eq('id', bookingId);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
      return;
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b));
    toast({ title: lang === 'ar' ? 'تم الإنزال ✓' : 'Dropped Off ✓' });
  };

  const completeRide = async () => {
    const boardedBookings = bookings.filter(b => b.status === 'boarded');
    if (boardedBookings.length === 0) return;
    const now = new Date().toISOString();
    await Promise.all(boardedBookings.map(b =>
      supabase.from('bookings').update({ status: 'completed', dropped_off_at: now }).eq('id', b.id)
    ));
    if (shuttle?.id) {
      await supabase.from('shuttles').update({ status: 'inactive' }).eq('id', shuttle.id);
    }
    setBookings(prev => prev.map(b => b.status === 'boarded' ? { ...b, status: 'completed', dropped_off_at: now } : b));
    toast({ title: lang === 'ar' ? 'تم إنهاء الرحلة ✓' : 'Ride completed! ✓' });
  };

  // IDs of stops that actually have booked passengers
  const bookedStopIds = new Set<string>();
  bookings.forEach(b => {
    if (['confirmed', 'boarded'].includes(b.status)) {
      if (b.pickup_stop_id) bookedStopIds.add(b.pickup_stop_id);
      if (b.dropoff_stop_id) bookedStopIds.add(b.dropoff_stop_id);
      if (!b.pickup_stop_id && b.custom_pickup_lat) {
        const nearest = findNearestStop(b.custom_pickup_lat, b.custom_pickup_lng);
        if (nearest) bookedStopIds.add(nearest.id);
      }
      if (!b.dropoff_stop_id && b.custom_dropoff_lat) {
        const nearest = findNearestStop(b.custom_dropoff_lat, b.custom_dropoff_lng);
        if (nearest) bookedStopIds.add(nearest.id);
      }
    }
  });

  const buildGoogleMapsUrl = (fromIndex?: number) => {
    if (!route) return null;

    // Only include route stops that have at least one booking
    const relevantStops = routeStops
      .slice(fromIndex ?? 0)
      .filter(stop => bookedStopIds.has(stop.id));

    const origin = driverLocation
      ? `${driverLocation.lat},${driverLocation.lng}`
      : `${route.origin_lat},${route.origin_lng}`;
    const destination = `${route.destination_lat},${route.destination_lng}`;
    const waypoints = relevantStops.map(stop => `${stop.lat},${stop.lng}`).join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  };

  const currentActive = activeStops[currentStopIndex] || null;
  const currentRouteStopIndex = currentActive
    ? Math.max(routeStops.findIndex(stop => stop.id === currentActive.stop.id), 0)
    : 0;
  const boardedCount = bookings.filter(b => b.status === 'boarded').length;
  const totalCount = bookings.length;
  const allCompleted = totalCount > 0 && bookings.every(b => b.status === 'completed' || b.status === 'cancelled');
  const googleMapsUrl = buildGoogleMapsUrl();

  // Build markers
  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' | 'purple' }[] = [];
  if (route) {
    markers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'A', color: 'green' });
    markers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'B', color: 'red' });
  }
  activeStops.forEach((as, i) => {
    markers.push({ lat: as.stop.lat, lng: as.stop.lng, label: `${i + 1}`, color: i === currentStopIndex ? 'orange' : 'blue' });
  });
  if (driverLocation) {
    markers.push({ lat: driverLocation.lat, lng: driverLocation.lng, label: '🚐', color: 'purple' });
  }

  const dirOrigin = driverLocation || (route ? { lat: route.origin_lat, lng: route.origin_lng } : undefined);
  const dirDest = currentActive ? { lat: currentActive.stop.lat, lng: currentActive.stop.lng } : (route ? { lat: route.destination_lat, lng: route.destination_lng } : undefined);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if all passengers at current stop are handled
  const allPickupsHandledAtStop = currentActive
    ? currentActive.pickupPassengers.every(p => {
        const b = bookings.find(bk => bk.id === p.bookingId);
        return b?.status === 'boarded' || b?.status === 'cancelled';
      })
    : true;
  const allDropoffsHandledAtStop = currentActive
    ? currentActive.dropoffPassengers.every(p => {
        const b = bookings.find(bk => bk.id === p.bookingId);
        return b?.status === 'completed' || b?.status === 'cancelled';
      })
    : true;
  const canAdvance = allPickupsHandledAtStop && allDropoffsHandledAtStop;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-14 px-4 gap-3">
          <Link to="/driver-dashboard">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-base font-bold text-foreground">
            {lang === 'ar' ? 'الرحلة النشطة' : 'Active Ride'}
          </h1>
          <span className="ms-auto text-xs px-2.5 py-1 rounded-full font-medium bg-primary/10 text-primary">
            {currentStopIndex}/{activeStops.length} {lang === 'ar' ? 'توقفات' : 'stops'}
          </span>
        </div>
      </header>

      {/* Navigate Full Trip button */}
      {googleMapsUrl && (
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary-foreground" />
              <span className="text-primary-foreground font-semibold text-sm">
                {lang === 'ar' ? 'افتح الرحلة كاملة في خرائط جوجل' : 'Navigate Full Trip in Google Maps'}
              </span>
            </div>
            <ExternalLink className="w-4 h-4 text-primary-foreground" />
          </div>
        </a>
      )}

      {/* Map */}
      <div className="h-[280px] relative">
        <MapView
          className="h-full"
          markers={markers}
          origin={dirOrigin}
          destination={dirDest}
          showDirections={!!(dirOrigin && dirDest)}
          center={driverLocation || undefined}
          zoom={13}
          showUserLocation={false}
        />
        <div className="absolute top-3 start-3 z-[5] bg-card border border-border rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{boardedCount}</span>
            <span className="text-xs text-muted-foreground">/ {totalCount}</span>
          </div>
          <div className="w-px h-5 bg-border" />
          <span className="text-xs text-muted-foreground">
            {lang === 'ar' ? 'في الشاتل' : 'on board'}
          </span>
        </div>
      </div>

      {/* Current stop card */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentActive ? (
          <div className="rounded-2xl border-2 p-5 bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                {currentStopIndex + 1}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === 'ar' ? 'التوقف التالي' : 'Next Stop'}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {lang === 'ar' ? currentActive.stop.name_ar : currentActive.stop.name_en}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? currentActive.stop.name_ar : currentActive.stop.name_en}</span>
            </div>

            {/* Navigate to this stop and remaining stops */}
            <a
              href={buildGoogleMapsUrl(currentRouteStopIndex) || undefined}
              target="_blank" rel="noopener noreferrer" className="mb-4 block"
            >
              <Button variant="secondary" className="w-full gap-2">
                <Navigation className="w-4 h-4" />
                {lang === 'ar' ? 'افتح الملاحة في خرائط جوجل' : 'Open Navigation in Google Maps'}
                <ArrowRight className="w-4 h-4 ms-auto" />
              </Button>
            </a>

            {/* "I Arrived" button + timer */}
            {!arrivedAt && (
              <Button
                className="w-full mb-3"
                variant="outline"
                disabled={driverLocation ? haversineDistance(driverLocation, { lat: currentActive.stop.lat, lng: currentActive.stop.lng }) > REACH_THRESHOLD_M : true}
                onClick={() => {
                  setArrivedAt(Date.now());
                  setWaitSeconds(0);
                  // Update driver_arrived_at for all pickups at this stop
                  currentActive.pickupPassengers.forEach(p => {
                    supabase.from('bookings').update({ driver_arrived_at: new Date().toISOString() }).eq('id', p.bookingId);
                  });
                  toast({
                    title: lang === 'ar' ? `⏱️ بدأ العد — ${waitTimeMinutes} دقيقة` : `⏱️ Timer started — ${waitTimeMinutes} min`,
                  });
                }}
              >
                <Clock className="w-4 h-4 me-2" />
                {driverLocation && haversineDistance(driverLocation, { lat: currentActive.stop.lat, lng: currentActive.stop.lng }) <= REACH_THRESHOLD_M
                  ? (lang === 'ar' ? 'وصلت — ابدأ العد' : "I've Arrived — Start Timer")
                  : (lang === 'ar' ? 'بعيد عن التوقف' : 'Too far from stop')}
              </Button>
            )}

            {arrivedAt && (
              <div className="bg-card border border-border rounded-xl p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {lang === 'ar' ? 'وقت الانتظار' : 'Wait Time'}
                  </span>
                </div>
                <span className={`text-sm font-bold ${waitSeconds >= waitTimeSec ? 'text-destructive' : 'text-foreground'}`}>
                  {Math.floor(waitSeconds / 60)}:{String(waitSeconds % 60).padStart(2, '0')} / {waitTimeMinutes}:00
                </span>
              </div>
            )}

            {/* Pickup passengers at this stop */}
            {currentActive.pickupPassengers.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {lang === 'ar' ? `صعود (${currentActive.pickupPassengers.length})` : `Pickups (${currentActive.pickupPassengers.length})`}
                </p>
                {currentActive.pickupPassengers.map(p => {
                  const b = bookings.find(bk => bk.id === p.bookingId);
                  const isBoarded = b?.status === 'boarded';
                  const isCancelled = b?.status === 'cancelled';
                  const amountDue = p.paymentProofUrl ? 0 : p.totalPrice;

                  return (
                    <div key={p.bookingId} className={`bg-card border rounded-xl p-3 ${isBoarded ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : isCancelled ? 'opacity-50' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">({p.seats} {lang === 'ar' ? 'مقعد' : 'seat'})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.phone && (
                            <a href={`tel:${p.phone}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Phone className="w-3.5 h-3.5" /></Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatBookingId(p.bookingId)}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Payment info */}
                      <div className="flex items-center gap-1.5 text-xs mb-2">
                        <DollarSign className="w-3 h-3" />
                        {amountDue > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {lang === 'ar' ? `💵 كاش: ${amountDue} جنيه` : `💵 Cash: ${amountDue} EGP`}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">
                            {lang === 'ar' ? '✅ مدفوع — 0 جنيه' : '✅ Paid — 0 EGP'}
                          </span>
                        )}
                      </div>

                      {isBoarded ? (
                        <span className="text-xs text-green-600 font-medium">✓ {lang === 'ar' ? 'صعد' : 'Boarded'}</span>
                      ) : isCancelled ? (
                        <span className="text-xs text-destructive font-medium">{lang === 'ar' ? 'تم التخطي' : 'Skipped'}</span>
                      ) : verifyingBooking === p.bookingId ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={boardingInput}
                            onChange={(e) => setBoardingInput(e.target.value)}
                            placeholder={lang === 'ar' ? 'الرمز المكون من 6 أرقام' : '6-digit code'}
                            className="h-9 text-sm flex-1 font-mono tracking-widest text-center"
                            maxLength={6}
                            autoFocus
                          />
                          <Button size="sm" onClick={() => verifyBoarding(p.bookingId)} disabled={boardingInput.length !== 6}>
                            <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'تأكيد' : 'Verify'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setVerifyingBooking(null); setBoardingInput(''); }}>✕</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="flex-1" onClick={() => { setVerifyingBooking(p.bookingId); setBoardingInput(''); }}>
                            <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'تأكيد صعود' : 'Verify'}
                          </Button>
                          {arrivedAt && waitSeconds >= waitTimeSec && (
                            <Button size="sm" variant="destructive" onClick={() => skipPassenger(p.bookingId)}>
                              <SkipForward className="w-3.5 h-3.5 me-1" />
                              {lang === 'ar' ? 'تخطي' : 'Skip'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dropoff passengers at this stop */}
            {currentActive.dropoffPassengers.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {lang === 'ar' ? `نزول (${currentActive.dropoffPassengers.length})` : `Drop-offs (${currentActive.dropoffPassengers.length})`}
                </p>
                {currentActive.dropoffPassengers.map(p => {
                  const b = bookings.find(bk => bk.id === p.bookingId);
                  const isCompleted = b?.status === 'completed';

                  return (
                    <div key={`drop-${p.bookingId}`} className={`bg-card border rounded-xl p-3 ${isCompleted ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-border'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        {isCompleted ? (
                          <span className="text-xs text-green-600 font-medium">✓ {lang === 'ar' ? 'نزل' : 'Dropped off'}</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => markDroppedOff(p.bookingId)}>
                            <DropOff className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'تأكيد نزول' : 'Drop off'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center gap-2 mt-3">
              {currentStopIndex > 0 && (
                <Button variant="outline" onClick={goToPreviousStop}>
                  <Undo2 className="w-4 h-4 me-1" />
                  {lang === 'ar' ? 'السابق' : 'Previous'}
                </Button>
              )}
              {currentStopIndex < activeStops.length - 1 && (
                <Button className="flex-1" onClick={advanceToNextStop} disabled={!canAdvance}>
                  <ArrowRight className="w-4 h-4 me-1" />
                  {lang === 'ar' ? 'التوقف التالي' : 'Next Stop'}
                </Button>
              )}
            </div>
          </div>
        ) : activeStops.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            {lang === 'ar' ? 'لا يوجد ركاب اليوم' : 'No passengers today'}
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-800 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">
              {lang === 'ar' ? 'تم الانتهاء من جميع التوقفات!' : 'All stops completed!'}
            </p>
          </div>
        )}

        {/* Upcoming stops preview */}
        {activeStops.length > currentStopIndex + 1 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {lang === 'ar' ? 'التوقفات القادمة' : 'Upcoming Stops'}
            </h4>
            <div className="space-y-2">
              {activeStops.slice(currentStopIndex + 1, currentStopIndex + 4).map((as, i) => (
                <div key={as.stop.id} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-blue-100 text-blue-700">
                    {currentStopIndex + 2 + i}
                  </span>
                  <span className="text-foreground flex-1 truncate">
                    {lang === 'ar' ? as.stop.name_ar : as.stop.name_en}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {as.pickupPassengers.length > 0 && `${as.pickupPassengers.length}↑`}
                    {as.pickupPassengers.length > 0 && as.dropoffPassengers.length > 0 && ' '}
                    {as.dropoffPassengers.length > 0 && `${as.dropoffPassengers.length}↓`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On-board summary */}
        {boardedCount > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">
              {lang === 'ar'
                ? `${boardedCount} راكب في الشاتل الآن`
                : `${boardedCount} passenger${boardedCount > 1 ? 's' : ''} currently on board`}
            </p>
          </div>
        )}
      </div>

      {/* Complete Ride button */}
      {boardedCount > 0 && !allCompleted && (
        <div className="border-t border-border bg-card p-4">
          <Button className="w-full" size="lg" variant="destructive" onClick={completeRide}>
            <Flag className="w-5 h-5 me-2" />
            {lang === 'ar'
              ? `إنهاء الرحلة (${boardedCount} راكب)`
              : `Complete Ride (${boardedCount} passengers)`}
          </Button>
        </div>
      )}

      <RideChat
        bookingId={chatBookingId || ''}
        isOpen={!!chatBookingId}
        onClose={() => setChatBookingId(null)}
        otherName={chatBookingId ? profiles[bookings.find(b => b.id === chatBookingId)?.user_id]?.full_name : undefined}
      />
    </div>
  );
};

export default ActiveRide;
