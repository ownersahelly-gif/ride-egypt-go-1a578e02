import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import MapView from '@/components/MapView';
import {
  ChevronLeft, ChevronRight, MapPin, Clock, Car, RefreshCw,
  Radio, Users, Navigation, Phone, MessageCircle, Key, ArrowRight
} from 'lucide-react';
import RideChat from '@/components/RideChat';

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
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [booking, setBooking] = useState<any>(null);
  const [shuttle, setShuttle] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
        const { data: driverProfile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, phone')
          .eq('user_id', bookingData.shuttles.driver_id)
          .single();
        setDriver(driverProfile);
      }

      // Fetch all bookings on same shuttle+date+time for ordering
      if (bookingData.shuttle_id && bookingData.scheduled_date) {
        const { data: allBookings } = await supabase
          .from('bookings')
          .select('*, profiles!bookings_user_id_fkey(full_name)')
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
        : (b.profiles?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger'));

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

  // Build markers
  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (route) {
    markers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'A', color: 'green' });
    markers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'B', color: 'red' });
  }
  if (shuttle?.current_lat && shuttle?.current_lng) {
    markers.push({ lat: shuttle.current_lat, lng: shuttle.current_lng, label: '🚐', color: 'blue' });
  }
  // Show current user's custom pickup/dropoff
  if (booking?.custom_pickup_lat && booking?.custom_pickup_lng) {
    markers.push({ lat: booking.custom_pickup_lat, lng: booking.custom_pickup_lng, label: 'P', color: 'green' });
  }
  if (booking?.custom_dropoff_lat && booking?.custom_dropoff_lng) {
    markers.push({ lat: booking.custom_dropoff_lat, lng: booking.custom_dropoff_lng, label: 'D', color: 'red' });
  }

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
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(true)}>
              <MessageCircle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          className="h-full min-h-[350px]"
          markers={markers}
          origin={route ? { lat: route.origin_lat, lng: route.origin_lng } : undefined}
          destination={route ? { lat: route.destination_lat, lng: route.destination_lng } : undefined}
          showDirections={!!route}
          center={shuttle?.current_lat ? { lat: shuttle.current_lat, lng: shuttle.current_lng } : undefined}
          zoom={14}
          showUserLocation
        />

        {/* ETA Floating Card */}
        {booking && !loading && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="bg-card border border-border rounded-2xl shadow-lg max-w-lg mx-auto overflow-hidden">
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
                {driver && (
                  <div className="flex items-center gap-3 bg-surface rounded-xl p-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {driver.avatar_url ? (
                        <img src={driver.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{driver.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {shuttle?.vehicle_model} · {shuttle?.vehicle_plate}
                      </p>
                    </div>
                    {driver.phone && (
                      <a href={`tel:${driver.phone}`}>
                        <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                          <Phone className="w-4 h-4" />
                        </Button>
                      </a>
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

                {/* Stops timeline (pickups before you) */}
                {stopsBeforeYou > 0 && !isBoarded && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {lang === 'ar' ? 'التوقفات قبلك على الطريق' : 'Stops before you on the route'}
                    </p>
                    <div className="space-y-1.5">
                      {passengerStops
                        .filter(s => s.type === 'pickup' && !s.isCurrentUser && s.status !== 'boarded')
                        .filter(s => {
                          const myStop = passengerStops.find(ps => ps.isCurrentUser && ps.type === 'pickup');
                          return myStop ? s.orderIndex < myStop.orderIndex : false;
                        })
                        .map((stop, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-bold text-secondary">
                              {i + 1}
                            </div>
                            <span className="text-muted-foreground">{stop.name}</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-muted-foreground/70">
                              {lang === 'ar' ? 'صعود' : 'Pickup'}
                            </span>
                          </div>
                        ))}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                          ★
                        </div>
                        <span className="font-medium text-foreground">
                          {lang === 'ar' ? 'أنت' : 'You'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>

      {/* Chat */}
      <RideChat
        bookingId={bookingId || ''}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
};


export default TrackShuttle;
