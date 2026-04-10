import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import MapView from '@/components/MapView';
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Car, RefreshCw,
  Radio, Users, Navigation, Phone, MessageCircle, Key, ArrowRight,
  Shield, Share2, ExternalLink, Star, CheckCircle2
} from 'lucide-react';
import RideChat from '@/components/RideChat';
import { useToast } from '@/hooks/use-toast';

interface PassengerStop {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
  isCurrentUser: boolean;
  boardingCode?: string;
  status: string;
  orderIndex: number; // order along the route
}

const TrackShuttle = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
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

  // All bookings on this ride (for calculating stops before current user)
  const [rideBookings, setRideBookings] = useState<any[]>([]);
  const [passengerStops, setPassengerStops] = useState<PassengerStop[]>([]);

  // ETA
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [stopsBeforeYou, setStopsBeforeYou] = useState(0);
  const [notificationSent, setNotificationSent] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  }, []);

  // Proximity notification: notify when shuttle is within ~1km of user's pickup
  useEffect(() => {
    if (notificationSent || !shuttle?.current_lat || !shuttle?.current_lng || !booking || !route) return;
    if (notifPermission !== 'granted') return;
    if (booking.status === 'boarded') return;

    const pickupLat = booking.custom_pickup_lat ?? route.origin_lat;
    const pickupLng = booking.custom_pickup_lng ?? route.origin_lng;

    // Haversine distance
    const toRad = (d: number) => d * Math.PI / 180;
    const R = 6371000; // meters
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

      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'shuttle-approaching',
      } as NotificationOptions);
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

      // Fetch driver profile
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

      // Fetch all bookings on same shuttle+date+time for ordering
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

  // Build ordered passenger stops along the route
  useEffect(() => {
    if (!route || !rideBookings.length || !user) return;

    const routeOrigin = { lat: route.origin_lat, lng: route.origin_lng };
    const routeDest = { lat: route.destination_lat, lng: route.destination_lng };

    // Calculate distance along route direction (projection onto route line)
    const calcRouteProgress = (point: { lat: number; lng: number }) => {
      const dx = point.lat - routeOrigin.lat;
      const dy = point.lng - routeOrigin.lng;
      const rx = routeDest.lat - routeOrigin.lat;
      const ry = routeDest.lng - routeOrigin.lng;
      const len = Math.sqrt(rx * rx + ry * ry);
      if (len === 0) return 0;
      return (dx * rx + dy * ry) / (len * len);
    };

    const stops: PassengerStop[] = [];

    rideBookings.forEach((b) => {
      const pickupLat = b.custom_pickup_lat ?? route.origin_lat;
      const pickupLng = b.custom_pickup_lng ?? route.origin_lng;
      const dropoffLat = b.custom_dropoff_lat ?? route.destination_lat;
      const dropoffLng = b.custom_dropoff_lng ?? route.destination_lng;
      const isMe = b.user_id === user.id;
      const name = isMe
        ? (lang === 'ar' ? 'أنت' : 'You')
        : (lang === 'ar' ? 'راكب' : 'Passenger');

      stops.push({
        userId: b.user_id,
        name,
        lat: pickupLat,
        lng: pickupLng,
        type: 'pickup',
        isCurrentUser: isMe,
        boardingCode: isMe ? b.boarding_code : undefined,
        status: b.status,
        orderIndex: calcRouteProgress({ lat: pickupLat, lng: pickupLng }),
      });

      // Only show dropoffs if boarded
      if (b.status === 'boarded') {
        stops.push({
          userId: b.user_id,
          name,
          lat: dropoffLat,
          lng: dropoffLng,
          type: 'dropoff',
          isCurrentUser: isMe,
          status: b.status,
          orderIndex: calcRouteProgress({ lat: dropoffLat, lng: dropoffLng }),
        });
      }
    });

    // Sort by route progress
    stops.sort((a, b) => a.orderIndex - b.orderIndex);
    setPassengerStops(stops);
  }, [route, rideBookings, user, lang]);

  // Calculate ETA using Google Maps Directions
  useEffect(() => {
    if (!shuttle?.current_lat || !shuttle?.current_lng || !booking || !route) return;
    if (typeof google === 'undefined' || !google?.maps?.DirectionsService) return;

    const myPickupLat = booking.custom_pickup_lat ?? route.origin_lat;
    const myPickupLng = booking.custom_pickup_lng ?? route.origin_lng;
    const shuttleLoc = { lat: shuttle.current_lat, lng: shuttle.current_lng };
    const myPickup = { lat: myPickupLat, lng: myPickupLng };

    // Find pickup stops before the current user along the route
    const myProgress = passengerStops.find(s => s.isCurrentUser && s.type === 'pickup')?.orderIndex ?? 0;
    const stopsBeforeMe = passengerStops.filter(
      s => s.type === 'pickup' && !s.isCurrentUser && s.orderIndex < myProgress && s.status !== 'boarded'
    );
    setStopsBeforeYou(stopsBeforeMe.length);

    // Build waypoints for stops before user
    const waypoints = stopsBeforeMe.map(s => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    const ds = new google.maps.DirectionsService();
    ds.route(
      {
        origin: shuttleLoc,
        destination: myPickup,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          let totalSeconds = 0;
          result.routes[0]?.legs?.forEach(leg => {
            totalSeconds += leg.duration?.value ?? 0;
          });
          // Add ~1 min per intermediate stop for boarding
          totalSeconds += stopsBeforeMe.length * 60;
          setEtaMinutes(Math.ceil(totalSeconds / 60));
        }
      }
    );
  }, [shuttle?.current_lat, shuttle?.current_lng, booking, route, passengerStops]);

  // Supabase Realtime subscription for live shuttle location
  useEffect(() => {
    if (!shuttle?.id) return;
    const channel = supabase
      .channel(`shuttle-track-${shuttle.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shuttles',
        filter: `id=eq.${shuttle.id}`,
      }, (payload) => {
        setShuttle((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
  }, [shuttle?.id]);

  // Polling fallback every 10s
  useEffect(() => {
    if (!shuttle?.id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('shuttles')
        .select('current_lat, current_lng, status')
        .eq('id', shuttle.id)
        .single();
      if (data) setShuttle((prev: any) => ({ ...prev, ...data }));
    }, 10000);
    return () => clearInterval(interval);
  }, [shuttle?.id]);

  // Build tracking markers: shuttle → stops before user → YOU
  const myPickupLat = booking?.custom_pickup_lat ?? route?.origin_lat;
  const myPickupLng = booking?.custom_pickup_lng ?? route?.origin_lng;

  // Find stops before current user along the route
  const myProgress = passengerStops.find(s => s.isCurrentUser && s.type === 'pickup')?.orderIndex ?? 0;
  const stopsBeforeMe = passengerStops.filter(
    s => s.type === 'pickup' && !s.isCurrentUser && s.orderIndex < myProgress && s.status !== 'boarded'
  );

  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' | 'purple' }[] = [];

  // Shuttle marker
  if (shuttle?.current_lat && shuttle?.current_lng) {
    markers.push({ lat: shuttle.current_lat, lng: shuttle.current_lng, label: '🚐', color: 'blue' });
  }

  // Intermediate stop markers (other passengers' pickups before the user)
  stopsBeforeMe.forEach((s, i) => {
    markers.push({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'orange' });
  });

  // Big "YOU" marker — the user's pickup
  if (myPickupLat && myPickupLng) {
    markers.push({ lat: myPickupLat, lng: myPickupLng, label: lang === 'ar' ? 'أنت' : 'YOU', color: 'purple' });
  }

  // Directions: shuttle → (intermediate stops) → user's pickup
  const trackOrigin = (shuttle?.current_lat && shuttle?.current_lng)
    ? { lat: shuttle.current_lat, lng: shuttle.current_lng } : undefined;
  const trackDestination = (myPickupLat && myPickupLng)
    ? { lat: myPickupLat, lng: myPickupLng } : undefined;
  const trackWaypoints = stopsBeforeMe.map(s => ({ lat: s.lat, lng: s.lng }));

  const isBoarded = booking?.status === 'boarded';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
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
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setSosActive(true)}
              title="SOS"
            >
              <Shield className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {
              const url = `${window.location.origin}/track?booking=${bookingId}`;
              if (navigator.share) {
                navigator.share({
                  title: lang === 'ar' ? 'تتبع رحلتي' : 'Track My Ride',
                  text: lang === 'ar' ? 'تتبع رحلتي المباشرة على مسار' : 'Track my live ride on Massar',
                  url,
                });
              } else {
                navigator.clipboard.writeText(url);
                toast({ title: lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied!' });
              }
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
            {(driverApplication?.phone || driver?.phone) && (
              <a href={`tel:${driverApplication?.phone || driver?.phone}`}>
                <Button variant="ghost" size="icon" title={lang === 'ar' ? 'اتصل بالسائق' : 'Call Driver'}>
                  <Phone className="w-4 h-4" />
                </Button>
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

      {/* Map — fixed height */}
      <div className="relative" style={{ height: '45vh', minHeight: '280px' }}>
        {(!shuttle?.current_lat || !shuttle?.current_lng) && !loading ? (
          <div className="h-full bg-muted flex flex-col items-center justify-center text-center p-6">
            <Car className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {lang === 'ar' ? 'الرحلة لم تبدأ بعد' : 'Ride hasn\'t started yet'}
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
            center={shuttle?.current_lat ? { lat: shuttle.current_lat, lng: shuttle.current_lng } : undefined}
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

      {/* Card below map — full width, scrollable */}
      {booking && !loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-card border-t border-border w-full">
            {/* ETA Banner */}
            {etaMinutes !== null && !isBoarded && (
              <div className="bg-primary px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary-foreground" />
                  <div>
                    <p className="text-primary-foreground font-bold text-lg leading-tight">
                      {etaMinutes} {lang === 'ar' ? 'دقيقة' : 'min'}
                    </p>
                    <p className="text-primary-foreground/80 text-xs">
                      {lang === 'ar' ? 'الوقت المتوقع للوصول إليك' : 'Estimated arrival to you'}
                    </p>
                  </div>
                </div>
                {stopsBeforeYou > 0 && (
                  <div className="bg-primary-foreground/20 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-primary-foreground font-bold text-sm">{stopsBeforeYou}</p>
                    <p className="text-primary-foreground/80 text-[10px] leading-tight">
                      {lang === 'ar' ? 'توقفات قبلك' : 'stops before you'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {isBoarded && (
              <div className="bg-green-600 px-5 py-3 flex items-center gap-2">
                <Car className="w-5 h-5 text-white" />
                <p className="text-white font-semibold">
                  {lang === 'ar' ? 'أنت في الشاتل الآن! استمتع بالرحلة' : "You're on board! Enjoy your ride"}
                </p>
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Route info */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">
                  {lang === 'ar' ? route?.name_ar : route?.name_en}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  shuttle?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {shuttle?.status === 'active'
                    ? (lang === 'ar' ? 'في الطريق' : 'On the way')
                    : (lang === 'ar' ? 'في الانتظار' : 'Waiting')}
                </span>
              </div>

              {/* Route endpoints */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 text-green-600 shrink-0" />
                <span className="truncate">{lang === 'ar' ? route?.origin_name_ar : route?.origin_name_en}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <MapPin className="w-3 h-3 text-destructive shrink-0" />
                <span className="truncate">{lang === 'ar' ? route?.destination_name_ar : route?.destination_name_en}</span>
              </div>

              {/* Driver Info */}
              {(driver || driverApplication) && (
                <div className="bg-surface rounded-xl p-3 space-y-2">
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
                        {driverApplication?.vehicle_model || shuttle?.vehicle_model}
                        {driverApplication?.vehicle_year ? ` (${driverApplication.vehicle_year})` : ''}
                        {' · '}
                        {shuttle?.vehicle_plate}
                      </p>
                    </div>
                    {(driverApplication?.phone || driver?.phone) && (
                      <a href={`tel:${driverApplication?.phone || driver?.phone}`}>
                        <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                          <Phone className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                  {driverApplication?.license_number && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ps-[52px]">
                      <Shield className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'رخصة:' : 'License:'} {driverApplication.license_number}</span>
                    </div>
                  )}
                  {driverRating && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ps-[52px]">
                      <Star className="w-3 h-3 fill-secondary text-secondary" />
                      <span>{driverRating.avg} ({driverRating.count} {lang === 'ar' ? 'تقييم' : 'ratings'})</span>
                    </div>
                  )}
                </div>
              )}

              {/* Boarding code */}
              {booking.boarding_code && !isBoarded && (
                <div className="bg-surface rounded-xl p-3 flex items-center gap-3">
                  <Key className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {lang === 'ar' ? 'رمز الصعود' : 'Boarding Code'}
                    </p>
                    <p className="text-xl font-mono font-bold text-foreground tracking-[0.3em]">
                      {booking.boarding_code}
                    </p>
                  </div>
                </div>
              )}

              {/* Schedule */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{booking.scheduled_date} · {booking.scheduled_time}</span>
                <span className="ms-auto font-semibold text-primary">{booking.total_price} EGP</span>
              </div>

              {/* Live Stop Timeline */}
              {passengerStops.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    {lang === 'ar' ? 'مسار الرحلة المباشر' : 'Live Route Progress'}
                  </p>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute start-[11px] top-3 bottom-3 w-0.5 bg-border" />
                    
                    {/* Route Origin */}
                    <div className="flex items-center gap-3 mb-1 relative">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center z-10 shrink-0">
                        <MapPin className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {lang === 'ar' ? route?.origin_name_ar : route?.origin_name_en}
                      </span>
                    </div>

                    {/* Passenger stops */}
                    {passengerStops.filter(s => s.type === 'pickup').map((stop, i) => {
                      const isBoarded = stop.status === 'boarded';
                      const isSkipped = stop.status === 'cancelled';
                      const isMe = stop.isCurrentUser;
                      
                      const shuttleLoc = shuttle?.current_lat && shuttle?.current_lng
                        ? { lat: shuttle.current_lat, lng: shuttle.current_lng }
                        : null;
                      
                      const routeOrigin = { lat: route?.origin_lat || 0, lng: route?.origin_lng || 0 };
                      const routeDest = { lat: route?.destination_lat || 0, lng: route?.destination_lng || 0 };
                      const calcProg = (lat: number, lng: number) => {
                        const dx = lat - routeOrigin.lat;
                        const dy = lng - routeOrigin.lng;
                        const rx = routeDest.lat - routeOrigin.lat;
                        const ry = routeDest.lng - routeOrigin.lng;
                        const len2 = rx * rx + ry * ry;
                        return len2 === 0 ? 0 : (dx * rx + dy * ry) / len2;
                      };
                      
                      const driverProgress = shuttleLoc ? calcProg(shuttleLoc.lat, shuttleLoc.lng) : -1;
                      const isPassed = isBoarded || (driverProgress > stop.orderIndex && driverProgress >= 0);
                      const isCurrent = !isPassed && !isSkipped && (
                        i === 0 || passengerStops.filter(s => s.type === 'pickup').slice(0, i).every(
                          prev => prev.status === 'boarded' || prev.status === 'cancelled'
                        )
                      );

                      return (
                        <div key={`${stop.userId}-${stop.type}-${i}`} className="flex items-center gap-3 py-1.5 relative">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 transition-all ${
                            isPassed ? 'bg-green-500' :
                            isSkipped ? 'bg-muted line-through' :
                            isCurrent ? 'bg-primary ring-4 ring-primary/20 animate-pulse' :
                            'bg-muted-foreground/20'
                          }`}>
                            {isPassed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            ) : isCurrent ? (
                              <span className="text-[10px] font-bold text-primary-foreground">📍</span>
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${
                              isMe ? 'text-primary font-bold' : 
                              isPassed ? 'text-muted-foreground' : 'text-foreground'
                            }`}>
                              {isMe ? (lang === 'ar' ? '⭐ أنت' : '⭐ You') : stop.name}
                            </p>
                            {isMe && stop.boardingCode && !booking?.boarded_at && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {lang === 'ar' ? 'رمز:' : 'Code:'} {stop.boardingCode}
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            isPassed ? 'bg-green-100 text-green-700' :
                            isSkipped ? 'bg-destructive/10 text-destructive' :
                            isCurrent ? 'bg-primary/10 text-primary' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {isPassed ? (lang === 'ar' ? 'صعد ✓' : 'Boarded ✓') :
                             isSkipped ? (lang === 'ar' ? 'تخطي' : 'Skipped') :
                             isCurrent ? (lang === 'ar' ? 'التالي' : 'Next') :
                             (lang === 'ar' ? 'في الانتظار' : 'Waiting')}
                          </span>
                        </div>
                      );
                    })}

                    {/* Dropoff stops */}
                    {passengerStops.filter(s => s.type === 'dropoff').length > 0 && (
                      <div className="my-1.5 ms-9 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {lang === 'ar' ? '— نزول —' : '— Drop-offs —'}
                      </div>
                    )}
                    {passengerStops.filter(s => s.type === 'dropoff').map((stop, i) => {
                      const isCompleted = stop.status === 'completed';
                      const isMe = stop.isCurrentUser;
                      return (
                        <div key={`${stop.userId}-dropoff-${i}`} className="flex items-center gap-3 py-1.5 relative">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 ${
                            isCompleted ? 'bg-green-500' : 'bg-purple-200 dark:bg-purple-900'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <span className="text-[10px]">🏁</span>
                            )}
                          </div>
                          <p className={`text-xs flex-1 min-w-0 truncate ${
                            isMe ? 'text-primary font-bold' : 'text-foreground'
                          }`}>
                            {isMe ? (lang === 'ar' ? '⭐ أنت — نزول' : '⭐ You — Drop-off') : `${stop.name} — ${lang === 'ar' ? 'نزول' : 'Drop-off'}`}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isCompleted ? 'bg-green-100 text-green-700' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300'
                          }`}>
                            {isCompleted ? (lang === 'ar' ? 'تم ✓' : 'Done ✓') : (lang === 'ar' ? 'قادم' : 'Upcoming')}
                          </span>
                        </div>
                      );
                    })}

                    {/* Route Destination */}
                    <div className="flex items-center gap-3 mt-1 relative">
                      <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center z-10 shrink-0">
                        <MapPin className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {lang === 'ar' ? route?.destination_name_ar : route?.destination_name_en}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <RideChat
        bookingId={bookingId || ''}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* SOS Emergency Dialog */}
      {sosActive && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-card border border-destructive rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-3 flex items-center justify-center">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                {lang === 'ar' ? 'طوارئ SOS' : 'Emergency SOS'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ar'
                  ? 'اختر إجراء الطوارئ المناسب'
                  : 'Choose the appropriate emergency action'}
              </p>
            </div>
            <div className="space-y-2">
              <a href="tel:122" className="block">
                <Button variant="destructive" className="w-full" size="lg">
                  <Phone className="w-5 h-5 me-2" />
                  {lang === 'ar' ? 'اتصل بالشرطة (122)' : 'Call Police (122)'}
                </Button>
              </a>
              <a href="tel:123" className="block">
                <Button variant="destructive" className="w-full" size="lg">
                  <Phone className="w-5 h-5 me-2" />
                  {lang === 'ar' ? 'اتصل بالإسعاف (123)' : 'Call Ambulance (123)'}
                </Button>
              </a>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => {
                  const url = `${window.location.origin}/track?booking=${bookingId}`;
                  const text = lang === 'ar'
                    ? `أحتاج مساعدة! تتبع موقعي: ${url}`
                    : `I need help! Track my location: ${url}`;
                  if (navigator.share) {
                    navigator.share({ title: 'SOS', text, url });
                  } else {
                    navigator.clipboard.writeText(text);
                    toast({ title: lang === 'ar' ? 'تم نسخ الرابط' : 'Link copied!' });
                  }
                }}
              >
                <Share2 className="w-5 h-5 me-2" />
                {lang === 'ar' ? 'شارك موقعك مع شخص' : 'Share location with someone'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSosActive(false)}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default TrackShuttle;
