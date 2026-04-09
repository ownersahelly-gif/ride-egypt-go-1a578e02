import { useEffect, useState, useCallback } from 'react';
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
  Phone, ArrowDown, Clock, AlertCircle
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
  status: string; // confirmed, boarded, completed
  routeProgress: number; // 0-1 along the route
  isCustom: boolean;
}

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

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: shuttleData } = await supabase
      .from('shuttles')
      .select('*, routes(*)')
      .eq('driver_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!shuttleData) { setLoading(false); return; }
    setShuttle(shuttleData);
    setRoute(shuttleData.routes);

    const today = new Date().toISOString().split('T')[0];
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .eq('shuttle_id', shuttleData.id)
      .eq('scheduled_date', today)
      .in('status', ['confirmed', 'boarded']);

    const bks = bookingsData || [];
    setBookings(bks);

    // Fetch profiles
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

  // Build ordered stops along the route
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

      // Pickup
      const pickupLat = b.custom_pickup_lat ?? route.origin_lat;
      const pickupLng = b.custom_pickup_lng ?? route.origin_lng;
      const isCustomPickup = !!(b.custom_pickup_lat && b.custom_pickup_lng);

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
        });
      }

      // Dropoff (show for boarded passengers)
      if (b.status === 'boarded') {
        const dropoffLat = b.custom_dropoff_lat ?? route.destination_lat;
        const dropoffLng = b.custom_dropoff_lng ?? route.destination_lng;
        const isCustomDropoff = !!(b.custom_dropoff_lat && b.custom_dropoff_lng);

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
        });
      }
    });

    // Sort by route progress (nearest first along the route)
    stops.sort((a, b) => a.routeProgress - b.routeProgress);
    setOrderedStops(stops);
  }, [route, bookings, profiles, lang]);

  // Update driver location
  useEffect(() => {
    if (!shuttle?.id || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from('shuttles').update({
          current_lat: pos.coords.latitude,
          current_lng: pos.coords.longitude,
        }).eq('id', shuttle.id);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [shuttle?.id]);

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

  // Build markers
  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (route) {
    markers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'S', color: 'green' });
    markers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'E', color: 'red' });
  }
  orderedStops.forEach((stop, i) => {
    markers.push({
      lat: stop.lat,
      lng: stop.lng,
      label: stop.type === 'pickup' ? `P${i + 1}` : `D${i + 1}`,
      color: stop.type === 'pickup' ? 'green' : 'red',
    });
  });

  const pickupStops = orderedStops.filter(s => s.type === 'pickup');
  const dropoffStops = orderedStops.filter(s => s.type === 'dropoff');
  const allBoarded = bookings.length > 0 && bookings.every(b => b.status === 'boarded');

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
          <span className={`ms-auto text-xs px-2.5 py-1 rounded-full font-medium ${
            allBoarded ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
          }`}>
            {allBoarded
              ? (lang === 'ar' ? '📍 جاري الإنزال' : '📍 Dropping off')
              : (lang === 'ar' ? '🔄 جاري الاستلام' : '🔄 Picking up')}
          </span>
        </div>
      </header>

      {/* Map */}
      <div className="h-[280px] relative">
        <MapView
          className="h-full"
          markers={markers}
          origin={route ? { lat: route.origin_lat, lng: route.origin_lng } : undefined}
          destination={route ? { lat: route.destination_lat, lng: route.destination_lng } : undefined}
          showDirections={!!route}
          zoom={12}
          showUserLocation
        />
      </div>

      {/* Stops timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-medium">{bookings.length} {lang === 'ar' ? 'ركاب' : 'passengers'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Navigation className="w-4 h-4 text-green-600" />
            <span>{pickupStops.length} {lang === 'ar' ? 'صعود' : 'pickups'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="w-4 h-4 text-destructive" />
            <span>{dropoffStops.length} {lang === 'ar' ? 'نزول' : 'dropoffs'}</span>
          </div>
        </div>

        {/* PICKUPS SECTION */}
        {pickupStops.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {lang === 'ar' ? 'نقاط الصعود (بالترتيب)' : 'Pickup Stops (in order)'}
            </h3>
            <div className="space-y-0">
              {pickupStops.map((stop, i) => (
                <div key={`pickup-${stop.bookingId}`} className="relative">
                  {/* Timeline connector */}
                  {i < pickupStops.length - 1 && (
                    <div className="absolute top-10 start-4 w-0.5 h-[calc(100%-16px)] bg-green-200" />
                  )}
                  <div className="bg-card border border-border rounded-xl p-4 ms-0 mb-2">
                    <div className="flex items-start gap-3">
                      {/* Stop number */}
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-foreground text-sm truncate">{stop.name}</p>
                          {stop.phone && (
                            <a href={`tel:${stop.phone}`}>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Navigation className="w-3 h-3 text-green-500 shrink-0" />
                          <span className="truncate">{stop.locationName}</span>
                          {stop.isCustom && (
                            <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full">
                              {lang === 'ar' ? 'مخصص' : 'Custom'}
                            </span>
                          )}
                        </div>

                        {/* Boarding code verification */}
                        {verifyingBooking === stop.bookingId ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={boardingInput}
                              onChange={(e) => setBoardingInput(e.target.value)}
                              placeholder={lang === 'ar' ? 'أدخل الرمز المكون من 6 أرقام' : 'Enter 6-digit code'}
                              className="h-9 text-sm flex-1 font-mono tracking-widest text-center"
                              maxLength={6}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => verifyBoarding(stop.bookingId)}
                              disabled={boardingInput.length !== 6}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setVerifyingBooking(null); setBoardingInput(''); }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => { setVerifyingBooking(stop.bookingId); setBoardingInput(''); }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                              {lang === 'ar' ? 'تأكيد صعود' : 'Verify boarding'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChatBookingId(stop.bookingId)}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DROPOFFS SECTION */}
        {dropoffStops.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {lang === 'ar' ? 'نقاط النزول (بالترتيب)' : 'Drop-off Stops (in order)'}
            </h3>
            <div className="space-y-0">
              {dropoffStops.map((stop, i) => (
                <div key={`dropoff-${stop.bookingId}`} className="relative">
                  {i < dropoffStops.length - 1 && (
                    <div className="absolute top-10 start-4 w-0.5 h-[calc(100%-16px)] bg-red-200" />
                  )}
                  <div className="bg-card border border-border rounded-xl p-4 ms-0 mb-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-foreground text-sm truncate">{stop.name}</p>
                          <UserCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <MapPin className="w-3 h-3 text-destructive shrink-0" />
                          <span className="truncate">{stop.locationName}</span>
                          {stop.isCustom && (
                            <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full">
                              {lang === 'ar' ? 'مخصص' : 'Custom'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markDroppedOff(stop.bookingId)}
                          >
                            <DropOff className="w-3.5 h-3.5 me-1" />
                            {lang === 'ar' ? 'تأكيد الإنزال' : 'Confirm drop-off'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setChatBookingId(stop.bookingId)}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On-board passengers (boarded but not showing as dropoff yet if no custom dropoff) */}
        {bookings.filter(b => b.status === 'boarded').length > 0 && dropoffStops.length === 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-foreground">
              {lang === 'ar'
                ? `${bookings.filter(b => b.status === 'boarded').length} ركاب في الشاتل — سينزلون في نقطة الوصول`
                : `${bookings.filter(b => b.status === 'boarded').length} passengers on board — they'll drop off at the destination`}
            </p>
          </div>
        )}

        {orderedStops.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            {lang === 'ar' ? 'لا يوجد ركاب اليوم' : 'No passengers today'}
          </div>
        )}
      </div>

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
