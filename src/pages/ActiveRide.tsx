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
  Phone, Clock, AlertCircle, Flag, SkipForward, ArrowRight, Undo2
} from 'lucide-react';

interface OrderedStop {
  bookingId: string;
  userId: string;
  name: string;
  phone?: string;
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
  locationName: string;
  boardingCode?: string;
  status: string;
  routeProgress: number;
  isCustom: boolean;
  reached: boolean;
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
  const [loading, setLoading] = useState(true);
  const [boardingInput, setBoardingInput] = useState('');
  const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<OrderedStop[]>([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const reachedStopsRef = useRef<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    // Find the shuttle that has today's bookings (not just any shuttle)
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
      // Fallback to first shuttle
      chosenShuttle = allShuttles?.[0] || null;
    }

    if (!chosenShuttle) { setLoading(false); return; }
    setShuttle(chosenShuttle);

    // Get route: from shuttle relation, or fallback to booking's route
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

  // Build ordered stops
  useEffect(() => {
    if (!route || !bookings.length) { setOrderedStops([]); return; }

    const routeOrigin = { lat: route.origin_lat, lng: route.origin_lng };
    const routeDest = { lat: route.destination_lat, lng: route.destination_lng };

    const calcProgress = (lat: number, lng: number) => {
      const dx = lat - routeOrigin.lat;
      const dy = lng - routeOrigin.lng;
      const rx = routeDest.lat - routeOrigin.lat;
      const ry = routeDest.lng - routeOrigin.lng;
      const len2 = rx * rx + ry * ry;
      if (len2 === 0) return 0;
      return Math.max(0, Math.min(1, (dx * rx + dy * ry) / len2));
    };

    const stops: OrderedStop[] = [];

    bookings.forEach((b) => {
      const profile = profiles[b.user_id];
      const name = profile?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger');

      const pickupLat = b.custom_pickup_lat ?? route.origin_lat;
      const pickupLng = b.custom_pickup_lng ?? route.origin_lng;
      const isCustomPickup = !!(b.custom_pickup_lat && b.custom_pickup_lng);

      const dropoffLat = b.custom_dropoff_lat ?? route.destination_lat;
      const dropoffLng = b.custom_dropoff_lng ?? route.destination_lng;
      const isCustomDropoff = !!(b.custom_dropoff_lat && b.custom_dropoff_lng);

      // Always add pickup (for confirmed passengers)
      if (b.status === 'confirmed') {
        stops.push({
          bookingId: b.id,
          userId: b.user_id,
          name,
          phone: profile?.phone,
          lat: pickupLat,
          lng: pickupLng,
          type: 'pickup',
          locationName: b.custom_pickup_name || (lang === 'ar' ? route.origin_name_ar : route.origin_name_en),
          boardingCode: b.boarding_code,
          status: b.status,
          routeProgress: calcProgress(pickupLat, pickupLng),
          isCustom: isCustomPickup,
          reached: false,
        });
      }

      // Only add dropoff for passengers who actually boarded (verified boarding code)
      if (b.status === 'boarded') {
        stops.push({
          bookingId: b.id,
          userId: b.user_id,
          name,
          phone: profile?.phone,
          lat: dropoffLat,
          lng: dropoffLng,
          type: 'dropoff',
          locationName: b.custom_dropoff_name || (lang === 'ar' ? route.destination_name_ar : route.destination_name_en),
          status: b.status,
          routeProgress: calcProgress(dropoffLat, dropoffLng),
          isCustom: isCustomDropoff,
          reached: false,
        });
      }
    });

    // Sort: all pickups first (by route progress), then all dropoffs (by route progress)
    const pickups = stops.filter(s => s.type === 'pickup').sort((a, b) => a.routeProgress - b.routeProgress);
    const dropoffs = stops.filter(s => s.type === 'dropoff').sort((a, b) => a.routeProgress - b.routeProgress);
    setOrderedStops([...pickups, ...dropoffs]);
  }, [route, bookings, profiles, lang]);

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

  // Auto-advance when driver reaches current stop
  useEffect(() => {
    if (!driverLocation || orderedStops.length === 0) return;
    if (currentStopIndex >= orderedStops.length) return;

    const currentStop = orderedStops[currentStopIndex];
    const dist = haversineDistance(driverLocation, { lat: currentStop.lat, lng: currentStop.lng });

    if (dist <= REACH_THRESHOLD_M && !reachedStopsRef.current.has(currentStopIndex)) {
      reachedStopsRef.current.add(currentStopIndex);
      toast({
        title: currentStop.type === 'pickup'
          ? (lang === 'ar' ? `📍 وصلت لنقطة صعود ${currentStop.name}` : `📍 Reached ${currentStop.name}'s pickup`)
          : (lang === 'ar' ? `📍 وصلت لنقطة نزول ${currentStop.name}` : `📍 Reached ${currentStop.name}'s dropoff`),
      });
    }
  }, [driverLocation, orderedStops, currentStopIndex, lang, toast]);

  const advanceToNextStop = () => {
    if (currentStopIndex < orderedStops.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
    }
  };

  const goToPreviousStop = () => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex(prev => prev - 1);
    }
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
    toast({ title: lang === 'ar' ? 'تم التأكيد ✓' : 'Boarded! ✓' });
    // Auto-advance after boarding
    advanceToNextStop();
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
    advanceToNextStop();
  };

  const completeRide = async () => {
    const boardedBookings = bookings.filter(b => b.status === 'boarded');
    if (boardedBookings.length === 0) return;
    const now = new Date().toISOString();
    const promises = boardedBookings.map(b =>
      supabase.from('bookings').update({ status: 'completed', dropped_off_at: now }).eq('id', b.id)
    );
    await Promise.all(promises);
    if (shuttle?.id) {
      await supabase.from('shuttles').update({ status: 'inactive' }).eq('id', shuttle.id);
    }
    setBookings(prev => prev.map(b => b.status === 'boarded' ? { ...b, status: 'completed', dropped_off_at: now } : b));
    toast({ title: lang === 'ar' ? 'تم إنهاء الرحلة ✓' : 'Ride completed! ✓' });
  };

  // Current stop and next stop
  const currentStop = orderedStops[currentStopIndex] || null;
  const nextStop = orderedStops[currentStopIndex + 1] || null;
  const completedStops = currentStopIndex;
  const totalStops = orderedStops.length;

  // Build markers — only show: route start, route end, current stop, driver location
  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' | 'purple' }[] = [];
  if (route) {
    markers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'A', color: 'green' });
    markers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'B', color: 'red' });
  }
  if (driverLocation) {
    markers.push({ lat: driverLocation.lat, lng: driverLocation.lng, label: '🚐', color: 'blue' });
  }
  if (currentStop) {
    markers.push({
      lat: currentStop.lat,
      lng: currentStop.lng,
      label: currentStop.type === 'pickup' ? '📍' : '🏁',
      color: currentStop.type === 'pickup' ? 'orange' : 'purple',
    });
  }

  // Directions: driver location → current stop only (1 waypoint, never exceeds limit)
  const dirOrigin = driverLocation || (route ? { lat: route.origin_lat, lng: route.origin_lng } : undefined);
  const dirDest = currentStop ? { lat: currentStop.lat, lng: currentStop.lng } : (route ? { lat: route.destination_lat, lng: route.destination_lng } : undefined);

  const boardedCount = bookings.filter(b => b.status === 'boarded').length;
  const totalCount = bookings.length;
  const allCompleted = totalCount > 0 && bookings.every(b => b.status === 'completed');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            {completedStops}/{totalStops} {lang === 'ar' ? 'توقفات' : 'stops'}
          </span>
        </div>
      </header>

      {/* Map — shows only route to NEXT stop */}
      <div className="h-[300px] relative">
        <MapView
          className="h-full"
          markers={markers}
          origin={dirOrigin}
          destination={dirDest}
          showDirections={!!(dirOrigin && dirDest)}
          center={driverLocation || undefined}
          zoom={14}
          showUserLocation={false}
        />
        {/* Floating stats */}
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
        {currentStop ? (
          <div className={`rounded-2xl border-2 p-5 ${
            currentStop.type === 'pickup'
              ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800'
              : 'bg-purple-50 border-purple-300 dark:bg-purple-950/30 dark:border-purple-800'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                currentStop.type === 'pickup'
                  ? 'bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                  : 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}>
                {currentStopIndex + 1}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {currentStop.type === 'pickup'
                    ? (lang === 'ar' ? 'التوقف التالي — صعود' : 'Next Stop — Pickup')
                    : (lang === 'ar' ? 'التوقف التالي — نزول' : 'Next Stop — Drop-off')}
                </p>
                <p className="text-lg font-bold text-foreground">{currentStop.name}</p>
              </div>
              {currentStop.phone && (
                <a href={`tel:${currentStop.phone}`}>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Phone className="w-4 h-4" />
                  </Button>
                </a>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{currentStop.locationName}</span>
              {currentStop.isCustom && (
                <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full ms-1">
                  {lang === 'ar' ? 'مخصص' : 'Custom'}
                </span>
              )}
            </div>

            {/* Navigate with Google Maps — opens turn-by-turn directions */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 block"
            >
              <Button variant="secondary" className="w-full gap-2">
                <Navigation className="w-4 h-4" />
                {lang === 'ar' ? 'افتح الملاحة في خرائط جوجل' : 'Navigate in Google Maps'}
                <ArrowRight className="w-4 h-4 ms-auto" />
              </Button>
            </a>

            {/* Action buttons */}
            {currentStop.type === 'pickup' ? (
              verifyingBooking === currentStop.bookingId ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={boardingInput}
                    onChange={(e) => setBoardingInput(e.target.value)}
                    placeholder={lang === 'ar' ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'}
                    className="h-10 text-sm flex-1 font-mono tracking-widest text-center"
                    maxLength={6}
                    autoFocus
                  />
                  <Button onClick={() => verifyBoarding(currentStop.bookingId)} disabled={boardingInput.length !== 6}>
                    <CheckCircle2 className="w-4 h-4 me-1" />
                    {lang === 'ar' ? 'تأكيد' : 'Verify'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setVerifyingBooking(null); setBoardingInput(''); }}>✕</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {currentStopIndex > 0 && (
                    <Button variant="outline" onClick={goToPreviousStop} title={lang === 'ar' ? 'رجوع' : 'Previous'}>
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button className="flex-1" onClick={() => { setVerifyingBooking(currentStop.bookingId); setBoardingInput(''); }}>
                    <CheckCircle2 className="w-4 h-4 me-2" />
                    {lang === 'ar' ? 'تأكيد صعود' : 'Verify Boarding'}
                  </Button>
                  <Button variant="outline" onClick={() => setChatBookingId(currentStop.bookingId)}>
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={advanceToNextStop} title={lang === 'ar' ? 'تخطي' : 'Skip'}>
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                {currentStopIndex > 0 && (
                  <Button variant="outline" onClick={goToPreviousStop} title={lang === 'ar' ? 'رجوع' : 'Previous'}>
                    <Undo2 className="w-4 h-4" />
                  </Button>
                )}
                <Button className="flex-1" variant="outline" onClick={() => markDroppedOff(currentStop.bookingId)}>
                  <DropOff className="w-4 h-4 me-2" />
                  {lang === 'ar' ? 'تأكيد الإنزال' : 'Confirm Drop-off'}
                </Button>
                <Button variant="outline" onClick={() => setChatBookingId(currentStop.bookingId)}>
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={advanceToNextStop} title={lang === 'ar' ? 'تخطي' : 'Skip'}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ) : orderedStops.length === 0 ? (
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
        {nextStop && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {lang === 'ar' ? 'التوقفات القادمة' : 'Upcoming Stops'}
            </h4>
            <div className="space-y-2">
              {orderedStops.slice(currentStopIndex + 1, currentStopIndex + 4).map((stop, i) => (
                <div key={`upcoming-${stop.bookingId}-${stop.type}`} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    stop.type === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                  }`}>{currentStopIndex + 2 + i}</span>
                  <span className="text-foreground flex-1 truncate">{stop.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    stop.type === 'pickup' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {stop.type === 'pickup' ? (lang === 'ar' ? 'صعود' : 'Pickup') : (lang === 'ar' ? 'نزول' : 'Dropoff')}
                  </span>
                </div>
              ))}
              {orderedStops.length - currentStopIndex - 1 > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{orderedStops.length - currentStopIndex - 4} {lang === 'ar' ? 'توقفات أخرى' : 'more stops'}
                </p>
              )}
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
          <Button
            className="w-full"
            size="lg"
            variant="destructive"
            onClick={completeRide}
          >
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
