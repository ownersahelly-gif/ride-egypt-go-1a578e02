import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import MapView from '@/components/MapView';
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Car, RefreshCw,
  Radio, Users, Navigation, Phone, MessageCircle, Key, ArrowRight,
  Shield, Share2, ExternalLink, Star, CheckCircle2, AlertCircle, Heart,
  LogOut, AlertTriangle
} from 'lucide-react';
import RideChat from '@/components/RideChat';
import { useToast } from '@/hooks/use-toast';
import { useSmoothMarker } from '@/hooks/useSmoothMarker';
import RideRating from '@/components/RideRating';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PassengerStop {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
  isCurrentUser: boolean;
  boardingCode?: string;
  status: string;
  orderIndex: number;
}

const TrackShuttle = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [booking, setBooking] = useState<any>(null);
  const [shuttle, setShuttle] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverApplication, setDriverApplication] = useState<any>(null);
  const [driverRating, setDriverRating] = useState<{ avg: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [driverStopStatus, setDriverStopStatus] = useState<{
    atStopId?: string;
    atStopNameEn?: string;
    atStopNameAr?: string;
    atStopIndex?: number;
    headingToStopId?: string;
    headingToStopNameEn?: string;
    headingToStopNameAr?: string;
    headingToStopIndex?: number;
  } | null>(null);

  const [rideBookings, setRideBookings] = useState<any[]>([]);
  const [passengerStops, setPassengerStops] = useState<PassengerStop[]>([]);

  // Exit trip state — two-step confirmation
  const [showExitStep1, setShowExitStep1] = useState(false);
  const [showExitStep2, setShowExitStep2] = useState(false);
  const [exiting, setExiting] = useState(false);

  const { position: smoothDriverPos, updatePosition: updateSmoothPos } = useSmoothMarker(1200);

  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [stopsBeforeYou, setStopsBeforeYou] = useState(0);
  const [notificationSent, setNotificationSent] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  // Proximity notification
  useEffect(() => {
    if (notificationSent || !shuttle?.current_lat || !shuttle?.current_lng || !booking || !route) return;
    if (notifPermission !== 'granted') return;
    if (booking.status === 'boarded') return;

    const pickupLat = booking.custom_pickup_lat ?? route.origin_lat;
    const pickupLng = booking.custom_pickup_lng ?? route.origin_lng;

    const toRad = (d: number) => d * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(pickupLat - shuttle.current_lat);
    const dLng = toRad(pickupLng - shuttle.current_lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(shuttle.current_lat)) * Math.cos(toRad(pickupLat)) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance <= 1000) {
      const title = lang === 'ar' ? '🚐 الشاتل يقترب!' : '🚐 Shuttle approaching!';
      const body = lang === 'ar'
        ? `الشاتل على بعد أقل من كيلومتر من نقطة الصعود الخاصة بك${etaMinutes ? ` (${etaMinutes} دقيقة)` : ''}`
        : `Your shuttle is less than 1km away from your pickup${etaMinutes ? ` (${etaMinutes} min)` : ''}`;

      new Notification(title, { body, icon: '/favicon.ico', tag: 'shuttle-approaching' });
      setNotificationSent(true);
    }
  }, [shuttle?.current_lat, shuttle?.current_lng, booking, route, notificationSent, notifPermission, lang, etaMinutes]);

  const fetchData = useCallback(async () => {
    if (!bookingId || !user) { setLoading(false); return; }
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, routes(*), shuttles(*)')
      .eq('id', bookingId)
      .single();

    if (bookingData) {
      setBooking(bookingData);
      setRoute(bookingData.routes);
      setShuttle(bookingData.shuttles);

      if (bookingData.shuttles?.driver_id) {
        const driverId = bookingData.shuttles.driver_id;
        const [profileRes, appRes, ratingsRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url, phone').eq('user_id', driverId).single(),
          supabase.from('driver_applications').select('license_number, vehicle_model, vehicle_year, phone').eq('user_id', driverId).eq('status', 'approved').single(),
          supabase.from('ratings').select('rating').eq('driver_id', driverId),
        ]);
        setDriver(profileRes.data);
        setDriverApplication(appRes.data);
        if (ratingsRes.data && ratingsRes.data.length > 0) {
          const avg = ratingsRes.data.reduce((sum, r) => sum + r.rating, 0) / ratingsRes.data.length;
          setDriverRating({ avg: Math.round(avg * 10) / 10, count: ratingsRes.data.length });
        }
      }

      if (bookingData.shuttle_id && bookingData.scheduled_date) {
        const { data: allBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('shuttle_id', bookingData.shuttle_id)
          .eq('scheduled_date', bookingData.scheduled_date)
          .eq('scheduled_time', bookingData.scheduled_time)
          .in('status', ['confirmed', 'boarded', 'pending']);
        setRideBookings(allBookings || []);
      }
    }
    setLoading(false);
  }, [bookingId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time booking status subscription
  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`booking-status-${bookingId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setBooking((prev: any) => ({ ...prev, ...updated }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  const [routeStops, setRouteStops] = useState<any[]>([]);

  useEffect(() => {
    if (!route?.id) return;
    const fetchStops = async () => {
      const { data } = await supabase
        .from('stops')
        .select('*')
        .eq('route_id', route.id)
        .order('stop_order');
      setRouteStops(data || []);
    };
    fetchStops();
  }, [route?.id]);

  useEffect(() => {
    if (!route || !routeStops.length || !rideBookings.length || !user) return;

    const stops: PassengerStop[] = [];
    routeStops.forEach((rs, idx) => {
      rideBookings.forEach((b) => {
        const isMe = b.user_id === user.id;
        const name = isMe ? (lang === 'ar' ? 'أنت' : 'You') : (lang === 'ar' ? 'راكب' : 'Passenger');
        if (b.pickup_stop_id === rs.id) {
          stops.push({
            userId: b.user_id, name, lat: rs.lat, lng: rs.lng,
            type: 'pickup', isCurrentUser: isMe,
            boardingCode: isMe ? b.boarding_code : undefined,
            status: b.status, orderIndex: idx,
          });
        }
        if (b.dropoff_stop_id === rs.id && b.status === 'boarded') {
          stops.push({
            userId: b.user_id, name, lat: rs.lat, lng: rs.lng,
            type: 'dropoff', isCurrentUser: isMe,
            status: b.status, orderIndex: idx + 0.5,
          });
        }
      });
    });
    stops.sort((a, b) => a.orderIndex - b.orderIndex);
    setPassengerStops(stops);
  }, [route, routeStops, rideBookings, user, lang]);

  // ETA calculation
  useEffect(() => {
    if (!booking || !route) return;
    if (typeof google === 'undefined' || !google?.maps?.DirectionsService) return;

    const myPickupLat = booking.custom_pickup_lat ?? route.origin_lat;
    const myPickupLng = booking.custom_pickup_lng ?? route.origin_lng;
    const myPickup = { lat: myPickupLat, lng: myPickupLng };

    const myProgressVal = passengerStops.find(s => s.isCurrentUser && s.type === 'pickup')?.orderIndex ?? 0;
    const stopsBeforeMe = passengerStops.filter(
      s => s.type === 'pickup' && !s.isCurrentUser && s.orderIndex < myProgressVal && s.status !== 'boarded'
    );
    setStopsBeforeYou(stopsBeforeMe.length);

    const ds = new google.maps.DirectionsService();

    if (shuttle?.current_lat && shuttle?.current_lng && shuttle?.status === 'active') {
      const waypoints = stopsBeforeMe.map(s => ({
        location: new google.maps.LatLng(s.lat, s.lng), stopover: true,
      }));
      ds.route({
        origin: { lat: shuttle.current_lat, lng: shuttle.current_lng },
        destination: myPickup, waypoints, optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === 'OK' && result) {
          let totalSeconds = 0;
          result.routes[0]?.legs?.forEach(leg => { totalSeconds += leg.duration?.value ?? 0; });
          totalSeconds += stopsBeforeMe.length * 60;
          setEtaMinutes(Math.ceil(totalSeconds / 60));
        }
      });
    } else {
      const routeOrigin = { lat: route.origin_lat, lng: route.origin_lng };
      const distToOriginM = Math.sqrt(
        Math.pow((myPickup.lat - routeOrigin.lat) * 111320, 2) +
        Math.pow((myPickup.lng - routeOrigin.lng) * 111320 * Math.cos(myPickup.lat * Math.PI / 180), 2),
      );
      if (stopsBeforeMe.length === 0 && distToOriginM < 300) {
        setEtaMinutes(0);
      } else {
        const waypoints = stopsBeforeMe.map(s => ({
          location: new google.maps.LatLng(s.lat, s.lng), stopover: true,
        }));
        ds.route({
          origin: routeOrigin, destination: myPickup, waypoints,
          optimizeWaypoints: false, travelMode: google.maps.TravelMode.DRIVING,
        }, (result, status) => {
          if (status === 'OK' && result) {
            let driveSeconds = 0;
            result.routes[0]?.legs?.forEach(leg => { driveSeconds += leg.duration?.value ?? 0; });
            driveSeconds += stopsBeforeMe.length * 60;
            setEtaMinutes(Math.ceil(driveSeconds / 60));
          }
        });
      }
    }
  }, [shuttle?.current_lat, shuttle?.current_lng, booking, route, passengerStops]);

  // Live location via broadcast — STOP if boarded/completed/cancelled
  useEffect(() => {
    if (!shuttle?.id) return;
    if (['boarded', 'completed', 'cancelled'].includes(booking?.status)) return;

    const channel = supabase
      .channel(`shuttle-live-${shuttle.id}`)
      .on('broadcast', { event: 'driver-location' }, (payload) => {
        const { lat, lng, stopId, stopNameEn, stopNameAr, stopIndex, headingToStopId, headingToStopNameEn, headingToStopNameAr, headingToStopIndex } = payload.payload;
        if (lat && lng) {
          setShuttle((prev: any) => ({ ...prev, current_lat: lat, current_lng: lng, status: 'active' }));
          updateSmoothPos({ lat, lng });
          setIsLive(true);
        }
        if (stopId) {
          setDriverStopStatus({ atStopId: stopId, atStopNameEn: stopNameEn, atStopNameAr: stopNameAr, atStopIndex: stopIndex });
        } else if (headingToStopId) {
          setDriverStopStatus({ headingToStopId, headingToStopNameEn, headingToStopNameAr, headingToStopIndex });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shuttle?.id, booking?.status]);

  // Fallback: postgres_changes + polling
  useEffect(() => {
    if (!shuttle?.id) return;
    if (['boarded', 'completed', 'cancelled'].includes(booking?.status)) return;

    const channel = supabase
      .channel(`shuttle-track-${shuttle.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'shuttles',
        filter: `id=eq.${shuttle.id}`,
      }, (payload) => {
        const newData = payload.new as any;
        setShuttle((prev: any) => ({ ...prev, ...newData }));
        if (newData.current_lat && newData.current_lng) {
          updateSmoothPos({ lat: newData.current_lat, lng: newData.current_lng });
        }
      })
      .subscribe();

    const interval = setInterval(async () => {
      const { data } = await supabase.from('shuttles').select('current_lat, current_lng, status').eq('id', shuttle.id).single();
      if (data) setShuttle((prev: any) => ({ ...prev, ...data }));
    }, 15000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [shuttle?.id, booking?.status]);

  // === EXIT TRIP HANDLER ===
  const handleExitTrip = async () => {
    if (!bookingId || exiting) return;
    setExiting(true);
    try {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      // Create refund request
      if (booking?.total_price > 0) {
        await supabase.from('refunds').insert({
          user_id: user!.id,
          booking_id: bookingId,
          amount: booking.total_price,
          reason: 'Rider exited trip voluntarily',
          status: 'pending',
          refund_type: 'pending',
        });
      }

      toast({
        title: lang === 'ar' ? 'تم الخروج من الرحلة' : 'Trip exited',
        description: lang === 'ar' ? 'تم إلغاء حجزك. سيتم مراجعة طلب الاسترداد.' : 'Your booking has been cancelled. Refund request will be reviewed.',
      });
      navigate('/my-bookings');
    } catch (e) {
      toast({ title: lang === 'ar' ? 'حدث خطأ' : 'Error', variant: 'destructive' });
    } finally {
      setExiting(false);
      setShowExitStep2(false);
    }
  };

  const shuttleIsActive = shuttle?.status === 'active';
  const hasLiveGps = !!(smoothDriverPos && shuttleIsActive);
  const isBoarded = booking?.status === 'boarded';
  const isCompleted = booking?.status === 'completed';
  const isSkipped = booking?.status === 'cancelled' && booking?.skipped_at;

  const myPickupLat = booking?.custom_pickup_lat ?? route?.origin_lat;
  const myPickupLng = booking?.custom_pickup_lng ?? route?.origin_lng;

  const myProgress = passengerStops.find(s => s.isCurrentUser && s.type === 'pickup')?.orderIndex ?? 0;
  const stopsBeforeMe = passengerStops.filter(
    s => s.type === 'pickup' && !s.isCurrentUser && s.orderIndex < myProgress && s.status !== 'boarded'
  );

  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' | 'purple' }[] = [];
  if (hasLiveGps && smoothDriverPos) {
    markers.push({ lat: smoothDriverPos.lat, lng: smoothDriverPos.lng, label: '🚐', color: 'blue' });
  }
  stopsBeforeMe.forEach((s, i) => {
    markers.push({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'orange' });
  });
  if (myPickupLat && myPickupLng && !isBoarded && !isCompleted && !isSkipped) {
    markers.push({ lat: myPickupLat, lng: myPickupLng, label: lang === 'ar' ? 'أنت' : 'YOU', color: 'purple' });
  }

  const trackOrigin = (hasLiveGps && smoothDriverPos) ? { lat: smoothDriverPos.lat, lng: smoothDriverPos.lng } : undefined;
  const trackDestination = (myPickupLat && myPickupLng) ? { lat: myPickupLat, lng: myPickupLng } : undefined;
  const trackWaypoints = stopsBeforeMe.map(s => ({ lat: s.lat, lng: s.lng }));

  // ===== FULL-SCREEN STATUS OVERLAYS =====

  // Completed — "Thank you for using Massar"
  if (!loading && isCompleted) {
    return (
      <div className="h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {lang === 'ar' ? 'شكرًا لاستخدامك مسار!' : 'Thank you for using Massar!'}
        </h1>
        <p className="text-muted-foreground mb-8">
          {lang === 'ar' ? 'نتمنى لك يومًا سعيدًا 🌟' : 'We hope you had a great ride 🌟'}
        </p>
        <Button size="lg" className="mb-4" onClick={() => setShowRating(true)}>
          <Star className="w-4 h-4 me-2" />
          {lang === 'ar' ? 'قيّم رحلتك' : 'Rate your ride'}
        </Button>
        {booking && (
          <RideRating
            bookingId={booking.id}
            driverId={shuttle?.driver_id}
            isOpen={showRating}
            onClose={() => setShowRating(false)}
            onRated={() => setShowRating(false)}
          />
        )}
        <Link to="/my-bookings">
          <Button variant="outline" size="lg">
            {lang === 'ar' ? 'العودة للحجوزات' : 'Back to Bookings'}
          </Button>
        </Link>
      </div>
    );
  }

  // Skipped — "Driver skipped you"
  if (!loading && isSkipped) {
    return (
      <div className="h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {lang === 'ar' ? 'تم تخطيك من قبل السائق' : 'Driver has skipped you'}
        </h1>
        <p className="text-muted-foreground mb-4 max-w-xs">
          {lang === 'ar'
            ? 'تجاوزت الوقت المسموح للوصول إلى السائق. يرجى الالتزام بالموعد في المرة القادمة.'
            : 'You exceeded the allowed time to reach the driver. Please be on time next time.'}
        </p>
        {booking?.skip_refund_amount > 0 && (
          <p className="text-sm text-primary font-medium mb-6">
            {lang === 'ar'
              ? `سيتم استرداد ${booking.skip_refund_amount} جنيه (50%)`
              : `${booking.skip_refund_amount} EGP (50%) will be refunded`}
          </p>
        )}
        <Link to="/my-bookings">
          <Button size="lg">
            {lang === 'ar' ? 'العودة للحجوزات' : 'Back to Bookings'}
          </Button>
        </Link>
      </div>
    );
  }

  // Boarded — "Have a safe ride"
  if (!loading && isBoarded) {
    return (
      <div className="h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
          <Car className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {lang === 'ar' ? 'رحلة آمنة! 🚐' : 'Have a safe ride! 🚐'}
        </h1>
        <p className="text-muted-foreground mb-4 max-w-xs">
          {lang === 'ar'
            ? 'أنت الآن في الشاتل. استرخِ واستمتع بالرحلة.'
            : "You're on the shuttle now. Sit back and enjoy the ride."}
        </p>
        <div className="bg-card border border-border rounded-xl p-4 w-full max-w-sm mb-6 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground truncate">{lang === 'ar' ? route?.origin_name_ar : route?.origin_name_en}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-destructive" />
            <span className="text-muted-foreground truncate">{lang === 'ar' ? route?.destination_name_ar : route?.destination_name_en}</span>
          </div>
        </div>
        {(driver || driverApplication) && (
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="text-start">
              <p className="font-medium text-foreground text-sm">{driver?.full_name || (lang === 'ar' ? 'السائق' : 'Driver')}</p>
              <p className="text-xs text-muted-foreground">{shuttle?.vehicle_model} · {shuttle?.vehicle_plate}</p>
            </div>
            {(driverApplication?.phone || driver?.phone) && (
              <a href={`tel:${driverApplication?.phone || driver?.phone}`}>
                <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                  <Phone className="w-4 h-4" />
                </Button>
              </a>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={() => setSosActive(true)} className="text-destructive">
            <Shield className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setChatOpen(true)}>
            <MessageCircle className="w-4 h-4 me-2" />
            {lang === 'ar' ? 'محادثة' : 'Chat'}
          </Button>
        </div>

        <RideChat
          bookingId={bookingId || ''}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          otherName={driver?.full_name}
        />

        {sosActive && (
          <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
            <div className="bg-card border border-destructive rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center mb-5">
                <Shield className="w-8 h-8 text-destructive mx-auto mb-3" />
                <h3 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}</h3>
              </div>
              <div className="space-y-2">
                <a href="tel:122" className="block"><Button variant="destructive" className="w-full" size="lg"><Phone className="w-5 h-5 me-2" />{lang === 'ar' ? 'الشرطة (122)' : 'Police (122)'}</Button></a>
                <a href="tel:123" className="block"><Button variant="destructive" className="w-full" size="lg"><Phone className="w-5 h-5 me-2" />{lang === 'ar' ? 'الإسعاف (123)' : 'Ambulance (123)'}</Button></a>
                <Button variant="ghost" className="w-full" onClick={() => setSosActive(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== NORMAL TRACKING VIEW (waiting / en route) =====
  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-14 px-4 gap-3">
          <Link to="/my-bookings">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'تتبع الرحلة' : 'Track Ride'}</h1>
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Radio className="w-3 h-3 animate-pulse" />
              {lang === 'ar' ? 'مباشر' : 'Live'}
            </span>
          )}
          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => {
              const url = `${window.location.origin}/track?booking=${bookingId}`;
              const text = lang === 'ar' ? `تتبع رحلتي على مسار: ${url}` : `Track my ride on Massar: ${url}`;
              if (navigator.share) { navigator.share({ title: 'Massar', text, url }); }
              else { navigator.clipboard.writeText(url); toast({ title: lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied!' }); }
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSosActive(true)}>
              <Shield className="w-4 h-4" />
            </Button>
            {(driverApplication?.phone || driver?.phone) && (
              <a href={`tel:${driverApplication?.phone || driver?.phone}`}>
                <Button variant="ghost" size="icon"><Phone className="w-4 h-4" /></Button>
              </a>
            )}
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(true)}>
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative" style={{ height: '40vh', minHeight: '260px' }}>
        {!hasLiveGps && !loading ? (
          <div className="h-full bg-muted flex flex-col items-center justify-center text-center p-6">
            <Car className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {lang === 'ar' ? 'الرحلة لم تبدأ بعد' : "Ride hasn't started yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {lang === 'ar'
                ? 'سيظهر الموقع المباشر للشاتل هنا عندما يبدأ السائق الرحلة'
                : 'The live shuttle location will appear here once the driver starts the ride'}
            </p>
          </div>
        ) : (
          <MapView
            className="h-full w-full"
            markers={markers}
            origin={trackOrigin}
            destination={trackDestination}
            waypoints={trackWaypoints}
            showDirections={!!trackOrigin && !!trackDestination}
            center={hasLiveGps ? { lat: shuttle.current_lat, lng: shuttle.current_lng } : undefined}
            zoom={14}
            showUserLocation={false}
          />
        )}
        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>

      {/* Stop status */}
      {driverStopStatus && (
        <div className="bg-accent px-5 py-2.5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent-foreground" />
          <p className="text-accent-foreground text-sm font-medium">
            {driverStopStatus.atStopId
              ? (lang === 'ar' ? `📍 السائق عند: ${driverStopStatus.atStopNameAr}` : `📍 Driver at: ${driverStopStatus.atStopNameEn}`)
              : driverStopStatus.headingToStopId
                ? (lang === 'ar' ? `🚐 متجه إلى: ${driverStopStatus.headingToStopNameAr}` : `🚐 Heading to: ${driverStopStatus.headingToStopNameEn}`)
                : ''}
          </p>
        </div>
      )}

      {booking && !loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-card border-t border-border w-full">
            {/* ETA Banner */}
            {etaMinutes !== null && hasLiveGps && (
              <div className="bg-primary px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary-foreground" />
                  <div>
                    <p className="text-primary-foreground font-bold text-lg leading-tight">
                      {etaMinutes === 0
                        ? (lang === 'ar' ? 'نقطة الانطلاق' : 'Starting point')
                        : etaMinutes >= 60
                          ? `${Math.floor(etaMinutes / 60)}${lang === 'ar' ? ' ساعة' : 'h'} ${etaMinutes % 60}${lang === 'ar' ? ' د' : 'm'}`
                          : `${etaMinutes} ${lang === 'ar' ? 'دقيقة' : 'min'}`}
                    </p>
                    <p className="text-primary-foreground/80 text-xs">
                      {etaMinutes === 0
                        ? (lang === 'ar' ? 'السائق يبدأ من موقعك' : 'Driver starts at your location')
                        : (lang === 'ar' ? 'الوقت المتوقع للوصول إليك' : 'Estimated arrival to you')}
                    </p>
                  </div>
                </div>
                {stopsBeforeYou > 0 && (
                  <div className="bg-primary-foreground/20 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-primary-foreground font-bold text-sm">{stopsBeforeYou}</p>
                    <p className="text-primary-foreground/80 text-[10px]">{lang === 'ar' ? 'توقفات قبلك' : 'stops before you'}</p>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* BIG Boarding Code — front and center */}
              {booking.boarding_code && (
                <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-5 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {lang === 'ar' ? 'رمز الصعود — أعطه للسائق' : 'Boarding Code — Give to driver'}
                  </p>
                  <p className="text-4xl font-mono font-black text-primary tracking-[0.4em]">
                    {booking.boarding_code}
                  </p>
                </div>
              )}

              {/* Navigate to pickup */}
              {myPickupLat && myPickupLng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${myPickupLat},${myPickupLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button className="w-full" size="lg">
                    <Navigation className="w-4 h-4 me-2" />
                    {lang === 'ar' ? 'اذهب لنقطة الصعود' : 'Navigate to Pickup'}
                  </Button>
                </a>
              )}

              {/* Route info compact */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 text-green-600 shrink-0" />
                <span className="truncate">{lang === 'ar' ? route?.origin_name_ar : route?.origin_name_en}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <MapPin className="w-3 h-3 text-destructive shrink-0" />
                <span className="truncate">{lang === 'ar' ? route?.destination_name_ar : route?.destination_name_en}</span>
              </div>

              {/* Driver Info */}
              {(driver || driverApplication) && (
                <div className="bg-surface rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {driver?.avatar_url ? (
                        <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{driver?.full_name || (lang === 'ar' ? 'السائق' : 'Driver')}</p>
                      <p className="text-xs text-muted-foreground">
                        {driverApplication?.vehicle_model || shuttle?.vehicle_model} · {shuttle?.vehicle_plate}
                      </p>
                    </div>
                    {driverRating && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-secondary text-secondary" />
                        <span>{driverRating.avg}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{booking.scheduled_date} · {booking.scheduled_time}</span>
                <span className="ms-auto font-semibold text-primary">{booking.total_price} EGP</span>
              </div>

              {/* Exit Trip Button */}
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 mt-2"
                onClick={() => setShowExitStep1(true)}
              >
                <LogOut className="w-4 h-4 me-2" />
                {lang === 'ar' ? 'الخروج من الرحلة' : 'Exit Trip'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <RideChat
        bookingId={bookingId || ''}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        otherName={driver?.full_name}
      />

      {/* SOS */}
      {sosActive && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-card border border-destructive rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <Shield className="w-8 h-8 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}</h3>
            </div>
            <div className="space-y-2">
              <a href="tel:122" className="block"><Button variant="destructive" className="w-full" size="lg"><Phone className="w-5 h-5 me-2" />{lang === 'ar' ? 'الشرطة (122)' : 'Police (122)'}</Button></a>
              <a href="tel:123" className="block"><Button variant="destructive" className="w-full" size="lg"><Phone className="w-5 h-5 me-2" />{lang === 'ar' ? 'الإسعاف (123)' : 'Ambulance (123)'}</Button></a>
              <Button variant="outline" className="w-full" size="lg" onClick={() => {
                const url = `${window.location.origin}/track?booking=${bookingId}`;
                const text = lang === 'ar' ? `أحتاج مساعدة! تتبع موقعي: ${url}` : `I need help! Track my location: ${url}`;
                if (navigator.share) { navigator.share({ title: 'SOS', text, url }); }
                else { navigator.clipboard.writeText(text); toast({ title: lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied!' }); }
              }}>
                <Share2 className="w-5 h-5 me-2" />{lang === 'ar' ? 'شارك موقعك' : 'Share location'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSosActive(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT STEP 1 — First warning */}
      <AlertDialog open={showExitStep1} onOpenChange={setShowExitStep1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {lang === 'ar' ? 'هل تريد الخروج من الرحلة؟' : 'Exit this trip?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === 'ar'
                ? 'إذا خرجت الآن سيتم إلغاء حجزك. لن تتمكن من الصعود في هذه الرحلة.'
                : 'If you exit now, your booking will be cancelled. You will not be able to board this ride.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === 'ar' ? 'البقاء' : 'Stay'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                setShowExitStep1(false);
                setShowExitStep2(true);
              }}
            >
              {lang === 'ar' ? 'نعم، أريد الخروج' : 'Yes, I want to exit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* EXIT STEP 2 — Final confirmation */}
      <AlertDialog open={showExitStep2} onOpenChange={setShowExitStep2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {lang === 'ar' ? 'تأكيد نهائي' : 'Final Confirmation'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-foreground">
                {lang === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه!' : 'This action cannot be undone!'}
              </p>
              <p>
                {lang === 'ar'
                  ? '• سيتم إلغاء حجزك نهائيًا\n• سيتم إرسال طلب استرداد للمراجعة\n• لن تتمكن من العودة لهذه الرحلة'
                  : '• Your booking will be permanently cancelled\n• A refund request will be submitted for review\n• You cannot rejoin this ride'}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleExitTrip();
              }}
              disabled={exiting}
            >
              {exiting
                ? (lang === 'ar' ? 'جارٍ الخروج...' : 'Exiting...')
                : (lang === 'ar' ? 'خروج نهائي من الرحلة' : 'Exit Trip Permanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrackShuttle;
