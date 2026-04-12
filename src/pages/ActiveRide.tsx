import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
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
  ExternalLink, DollarSign, TrendingUp, X
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
  const [unreadBookings, setUnreadBookings] = useState<Set<string>>(new Set());
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitTimeMinutes, setWaitTimeMinutes] = useState(1);
  const [showEndRideDialog, setShowEndRideDialog] = useState(false);
  const [showEarningsSummary, setShowEarningsSummary] = useState(false);
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

    // Fetch unread message counts
    if (bks.length > 0 && user) {
      const bkIds = bks.map((b: any) => b.id);
      const { data: unreadData } = await supabase
        .from('ride_messages')
        .select('booking_id')
        .in('booking_id', bkIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      const unread = new Set<string>();
      (unreadData || []).forEach((m: any) => unread.add(m.booking_id));
      setUnreadBookings(unread);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time booking subscription — auto-refresh when bookings change
  useEffect(() => {
    if (!shuttle?.id) return;
    const channel = supabase
      .channel(`active-ride-bookings-${shuttle.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `shuttle_id=eq.${shuttle.id}`,
      }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shuttle?.id, fetchData]);

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

  // Update driver location: Broadcast for instant passenger updates + DB writes for persistence
  useEffect(() => {
    if (!shuttle?.id) return;

    let lastDbUpdate = 0;
    const DB_THROTTLE_MS = 3000; // Write to DB every 3s for Realtime subscribers
    let cancelled = false;
    let prevLat = 0;
    let prevLng = 0;
    const MIN_MOVE_M = 8; // Skip updates if moved less than 8m (noise filter)

    const broadcastChannel = supabase.channel(`shuttle-live-${shuttle.id}`);
    broadcastChannel.subscribe();

    const handleLocation = (lat: number, lng: number, speed: number | null, heading: number | null) => {
      if (cancelled) return;

      // Filter GPS noise — skip if moved less than 3 meters
      if (prevLat && prevLng) {
        const moved = haversineDistance({ lat: prevLat, lng: prevLng }, { lat, lng });
        if (moved < MIN_MOVE_M) return;
      }
      prevLat = lat;
      prevLng = lng;

      setDriverLocation({ lat, lng });
      const now = Date.now();

      // Always broadcast immediately for real-time passenger tracking
      broadcastChannel.send({
        type: 'broadcast',
        event: 'driver-location',
        payload: { lat, lng, ts: now, speed, heading },
      });

      // Write to DB periodically for Realtime postgres_changes subscribers
      if (now - lastDbUpdate >= DB_THROTTLE_MS) {
        lastDbUpdate = now;
        supabase.from('shuttles').update({
          current_lat: lat, current_lng: lng,
        }).eq('id', shuttle.id);
      }
    };

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      // Capacitor native GPS — accurate, fast, works in background on iOS
      let watchId: string | undefined;
      Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, minimumUpdateInterval: 500 },
        (position, err) => {
          if (position && !err) {
            handleLocation(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed,
              position.coords.heading
            );
          }
        }
      ).then(id => { watchId = id; });

      return () => {
        cancelled = true;
        if (watchId) Geolocation.clearWatch({ id: watchId });
        supabase.removeChannel(broadcastChannel);
      };
    } else {
      // Browser fallback with aggressive polling
      if (!navigator.geolocation) return;

      const updateLocation = (pos: GeolocationPosition) => {
        handleLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.speed,
          pos.coords.heading
        );
      };

      const watchId = navigator.geolocation.watchPosition(
        updateLocation, () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      // Aggressive polling every 2s as browser watchPosition can be unreliable
      const intervalId = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          updateLocation, () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }, 2000);

      return () => {
        cancelled = true;
        navigator.geolocation.clearWatch(watchId);
        clearInterval(intervalId);
        supabase.removeChannel(broadcastChannel);
      };
    }
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
      const nextIndex = currentStopIndex + 1;
      setCurrentStopIndex(nextIndex);

      // Broadcast "heading to next stop" status for passengers
      if (shuttle?.id && activeStops[nextIndex]) {
        const nextStop = activeStops[nextIndex].stop;
        const broadcastChannel = supabase.channel(`shuttle-live-${shuttle.id}`);
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            broadcastChannel.send({
              type: 'broadcast',
              event: 'driver-location',
              payload: {
                lat: driverLocation?.lat || nextStop.lat,
                lng: driverLocation?.lng || nextStop.lng,
                ts: Date.now(),
                headingToStopId: nextStop.id,
                headingToStopNameEn: nextStop.name_en,
                headingToStopNameAr: nextStop.name_ar,
                headingToStopIndex: nextIndex,
              },
            });
            setTimeout(() => supabase.removeChannel(broadcastChannel), 1000);
          }
        });
      }
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

    // === BOARDING CODE = LOCATION ANCHOR ===
    // Use the current stop's coordinates as the driver's confirmed location
    if (currentActive && shuttle?.id) {
      const stopLat = currentActive.stop.lat;
      const stopLng = currentActive.stop.lng;
      
      // Update driver location state
      setDriverLocation({ lat: stopLat, lng: stopLng });

      // Broadcast stop coordinates as driver location (instant for passengers)
      const broadcastChannel = supabase.channel(`shuttle-live-${shuttle.id}`);
      broadcastChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'driver-location',
            payload: { 
              lat: stopLat, 
              lng: stopLng, 
              ts: Date.now(),
              stopId: currentActive.stop.id,
              stopNameEn: currentActive.stop.name_en,
              stopNameAr: currentActive.stop.name_ar,
              stopIndex: currentStopIndex,
            },
          });
          // Clean up after sending
          setTimeout(() => supabase.removeChannel(broadcastChannel), 1000);
        }
      });

      // Persist to DB for fallback
      supabase.from('shuttles').update({
        current_lat: stopLat,
        current_lng: stopLng,
      }).eq('id', shuttle.id);
    }

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
    setShowEndRideDialog(false);
    setShowEarningsSummary(true);
  };

  // Earnings calculation
  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const cashEarnings = bookings.filter(b => b.status === 'completed' && !b.payment_proof_url).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const onlineEarnings = bookings.filter(b => b.status === 'completed' && b.payment_proof_url).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
  const completedCount = bookings.filter(b => b.status === 'completed').length;

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

    if (relevantStops.length === 0) return null;

    const origin = driverLocation
      ? `${driverLocation.lat},${driverLocation.lng}`
      : `${relevantStops[0].lat},${relevantStops[0].lng}`;
    
    // Destination = last booked stop (not route endpoint if no one goes there)
    const lastStop = relevantStops[relevantStops.length - 1];
    const destination = `${lastStop.lat},${lastStop.lng}`;
    const waypoints = relevantStops.slice(0, -1).map(stop => `${stop.lat},${stop.lng}`).join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
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
      <div className="h-screen flex items-center justify-center overflow-hidden">
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

  // Only show pickup stops in step-by-step flow
  const pickupStops = activeStops.filter(s => s.pickupPassengers.length > 0);
  const currentPickup = pickupStops[currentStopIndex] || null;
  const allPickupsDone = pickupStops.length > 0 && currentStopIndex >= pickupStops.length;

  // Check if all pickups at current stop are handled
  const allHandledAtStop = currentPickup
    ? currentPickup.pickupPassengers.every(p => {
        const b = bookings.find(bk => bk.id === p.bookingId);
        return b?.status === 'boarded' || b?.status === 'cancelled';
      })
    : true;

  // Navigate to current stop URL
  const currentStopNavUrl = currentPickup && driverLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${currentPickup.stop.lat},${currentPickup.stop.lng}&travelmode=driving`
    : null;

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {/* Simple header */}
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-14 px-4 gap-3">
          <Link to="/driver-dashboard">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-base font-bold text-foreground">
            {lang === 'ar' ? 'الرحلة النشطة' : 'Active Ride'}
          </h1>
          <span className="ms-auto text-xs px-2.5 py-1 rounded-full font-medium bg-primary/10 text-primary">
            {boardedCount}/{totalCount}
          </span>
        </div>
      </header>

      {/* Google Maps Full Trip navigation */}
      {googleMapsUrl && (
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary-foreground" />
              <span className="text-primary-foreground font-semibold text-sm">
                {lang === 'ar' ? 'افتح كل الرحلة في خرائط جوجل' : 'Navigate Full Trip'}
              </span>
            </div>
            <ExternalLink className="w-4 h-4 text-primary-foreground" />
          </div>
        </a>
      )}

      {/* Map */}
      <div className="h-[220px] relative">
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
        <div className="absolute top-3 start-3 z-[5] bg-card border border-border rounded-xl shadow-lg px-4 py-2 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">{boardedCount}</span>
          <span className="text-xs text-muted-foreground">/ {totalCount}</span>
        </div>
      </div>

      {/* Main content — super simple */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* PICKUP PHASE: Step through each stop */}
        {currentPickup && !allHandledAtStop && (
          <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 space-y-4">
            {/* Who to pickup */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {lang === 'ar' ? `التوقف ${currentStopIndex + 1} من ${pickupStops.length}` : `Stop ${currentStopIndex + 1} of ${pickupStops.length}`}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {lang === 'ar' ? 'اذهب لـ' : 'Go pickup'}
              </p>
              <div className="mt-2 space-y-3">
                {currentPickup.pickupPassengers
                  .filter(p => {
                    const b = bookings.find(bk => bk.id === p.bookingId);
                    return b?.status !== 'boarded' && b?.status !== 'cancelled';
                  })
                  .map(p => (
                    <div key={p.bookingId} className="flex items-center justify-center gap-3">
                      <p className="text-xl font-bold text-primary">{p.name}</p>
                      <div className="flex items-center gap-1">
                        {p.phone && (
                          <a href={`tel:${p.phone}`}>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                              <Phone className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setChatBookingId(p.bookingId)}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Navigate button */}
            {currentStopNavUrl && !arrivedAt && (
              <a href={currentStopNavUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2" size="lg">
                  <Navigation className="w-5 h-5" />
                  {lang === 'ar' ? 'افتح الملاحة' : 'Navigate'}
                </Button>
              </a>
            )}

            {/* I Arrived button */}
            {!arrivedAt && (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => {
                  setArrivedAt(Date.now());
                  setWaitSeconds(0);
                  currentPickup.pickupPassengers.forEach(p => {
                    supabase.from('bookings').update({ driver_arrived_at: new Date().toISOString() }).eq('id', p.bookingId);
                  });
                  toast({ title: lang === 'ar' ? `⏱️ بدأ العد — ${waitTimeMinutes} دقيقة` : `⏱️ Timer started — ${waitTimeMinutes} min` });
                }}
              >
                <Clock className="w-5 h-5 me-2" />
                {lang === 'ar' ? 'وصلت' : "I Arrived"}
              </Button>
            )}

            {/* Timer + Code verification */}
            {arrivedAt && (
              <>
                {/* Timer */}
                <div className="bg-surface rounded-xl p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {lang === 'ar' ? 'وقت الانتظار' : 'Waiting'}
                  </span>
                  <span className={`text-lg font-bold font-mono ${waitSeconds >= waitTimeSec ? 'text-destructive' : 'text-foreground'}`}>
                    {Math.floor(waitSeconds / 60)}:{String(waitSeconds % 60).padStart(2, '0')}
                  </span>
                </div>

                {/* Each passenger: code input */}
                {currentPickup.pickupPassengers.map(p => {
                  const b = bookings.find(bk => bk.id === p.bookingId);
                  if (b?.status === 'boarded' || b?.status === 'cancelled') return null;

                  return (
                    <div key={p.bookingId} className="bg-surface rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-foreground">{p.name}</span>
                        <div className="flex items-center gap-2">
                          {p.phone && (
                            <a href={`tel:${p.phone}`}>
                              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                                <Phone className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setChatBookingId(p.bookingId)}>
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {verifyingBooking === p.bookingId ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={boardingInput}
                            onChange={(e) => setBoardingInput(e.target.value)}
                            placeholder={lang === 'ar' ? '6 أرقام' : '6-digit code'}
                            className="h-12 text-center font-mono tracking-[0.3em] text-lg"
                            maxLength={6}
                            autoFocus
                          />
                          <Button size="lg" onClick={() => verifyBoarding(p.bookingId)} disabled={boardingInput.length !== 6}>
                            <CheckCircle2 className="w-5 h-5" />
                          </Button>
                        </div>
                      ) : (
                        <Button className="w-full" size="lg" onClick={() => { setVerifyingBooking(p.bookingId); setBoardingInput(''); }}>
                          <CheckCircle2 className="w-5 h-5 me-2" />
                          {lang === 'ar' ? 'أدخل الرمز' : 'Enter Code'}
                        </Button>
                      )}

                      {/* Skip button — only after timer expires */}
                      {waitSeconds >= waitTimeSec && (
                        <Button variant="destructive" className="w-full" onClick={() => skipPassenger(p.bookingId)}>
                          <SkipForward className="w-4 h-4 me-2" />
                          {lang === 'ar' ? 'تخطي' : 'Skip'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* All pickups at current stop handled → Next stop */}
        {currentPickup && allHandledAtStop && currentStopIndex < pickupStops.length - 1 && (
          <div className="rounded-2xl border-2 border-green-300 bg-green-50 dark:bg-green-950/20 p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="text-lg font-bold text-foreground">
              {lang === 'ar' ? 'تم! التالي؟' : 'Done! Next stop?'}
            </p>
            <Button className="w-full" size="lg" onClick={() => {
              setCurrentStopIndex(prev => prev + 1);
              setArrivedAt(null);
              setWaitSeconds(0);
              setVerifyingBooking(null);
              setBoardingInput('');
            }}>
              <ArrowRight className="w-5 h-5 me-2" />
              {lang === 'ar' ? 'التوقف التالي' : 'Next Stop'}
            </Button>
          </div>
        )}

        {/* Last pickup stop handled or all pickups done */}
        {(allPickupsDone || (currentPickup && allHandledAtStop && currentStopIndex >= pickupStops.length - 1)) && (
          <div className="rounded-2xl border-2 border-green-300 bg-green-50 dark:bg-green-950/20 p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="text-lg font-bold text-foreground">
              {lang === 'ar' ? 'تم جمع جميع الركاب!' : 'All passengers picked up!'}
            </p>
            <p className="text-sm text-muted-foreground">
              {lang === 'ar'
                ? 'استخدم خرائط جوجل للوصول إلى نقاط الإنزال'
                : 'Use Google Maps to navigate to drop-off points'}
            </p>
            {googleMapsUrl && (
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2" size="lg" variant="outline">
                  <Navigation className="w-5 h-5" />
                  {lang === 'ar' ? 'افتح خرائط جوجل' : 'Open Google Maps'}
                </Button>
              </a>
            )}
          </div>
        )}

        {/* No passengers */}
        {pickupStops.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            {lang === 'ar' ? 'لا يوجد ركاب اليوم' : 'No passengers today'}
          </div>
        )}
      </div>

      {/* Complete Ride button — shown when all pickups done and someone is on board */}
      {boardedCount > 0 && (allPickupsDone || (currentPickup && allHandledAtStop && currentStopIndex >= pickupStops.length - 1)) && (
        <div className="border-t border-border bg-card p-4 safe-area-bottom">
          <Button className="w-full" size="lg" variant="destructive" onClick={() => setShowEndRideDialog(true)}>
            <Flag className="w-5 h-5 me-2" />
            {lang === 'ar'
              ? `إنهاء الرحلة (${boardedCount} راكب)`
              : `Complete Ride (${boardedCount})`}
          </Button>
        </div>
      )}

      {/* End Ride Confirmation */}
      {showEndRideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-6 w-[90%] max-w-sm shadow-xl space-y-4">
            <div className="text-center">
              <Flag className="w-12 h-12 text-destructive mx-auto mb-2" />
              <h3 className="text-lg font-bold text-foreground">
                {lang === 'ar' ? 'إنهاء الرحلة؟' : 'End Ride?'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === 'ar'
                  ? `سيتم إنزال ${boardedCount} راكب وإنهاء الرحلة.`
                  : `This will drop off ${boardedCount} passenger${boardedCount > 1 ? 's' : ''} and end the ride.`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowEndRideDialog(false)}>
                {lang === 'ar' ? 'لا' : 'No'}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={completeRide}>
                {lang === 'ar' ? 'نعم، أنهِ' : 'Yes, End'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Summary */}
      {showEarningsSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-6 w-[90%] max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'ملخص الرحلة' : 'Ride Summary'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowEarningsSummary(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-primary">{totalEarnings} EGP</p>
              <p className="text-sm text-muted-foreground mt-1">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">{completedCount}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'راكب' : 'Riders'}</p>
              </div>
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">{cashEarnings} / {onlineEarnings}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'كاش / إلكتروني' : 'Cash / Online'}</p>
              </div>
            </div>
            <Link to="/driver-dashboard" className="block">
              <Button className="w-full" size="lg">
                <CheckCircle2 className="w-4 h-4 me-2" />
                {lang === 'ar' ? 'العودة' : 'Done'}
              </Button>
            </Link>
          </div>
        </div>
      )}

      <RideChat
        bookingId={chatBookingId || ''}
        isOpen={!!chatBookingId}
        onClose={() => setChatBookingId(null)}
        otherName={chatBookingId ? profiles[bookings.find(b => b.id === chatBookingId)?.user_id]?.full_name : undefined}
        onRead={() => {
          if (chatBookingId) {
            setUnreadBookings(prev => { const next = new Set(prev); next.delete(chatBookingId); return next; });
          }
        }}
      />
    </div>
  );
};

export default ActiveRide;
