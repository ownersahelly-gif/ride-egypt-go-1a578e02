import { useEffect, useState } from 'react';
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
  CheckCircle2, Navigation, Loader2, UserCheck, LogOut as DropOff
} from 'lucide-react';

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
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pickup' | 'dropoff'>('pickup');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
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
        .select('*, stops!bookings_pickup_stop_id_fkey(name_en, name_ar, lat, lng, stop_order), dropoff:stops!bookings_dropoff_stop_id_fkey(name_en, name_ar, lat, lng, stop_order)')
        .eq('shuttle_id', shuttleData.id)
        .eq('scheduled_date', today)
        .in('status', ['confirmed', 'boarded']);

      const bks = (bookingsData || []).sort((a: any, b: any) => {
        const orderA = a.stops?.stop_order ?? 999;
        const orderB = b.stops?.stop_order ?? 999;
        return orderA - orderB;
      });
      setBookings(bks);

      // Determine phase
      const allBoarded = bks.length > 0 && bks.every(b => b.status === 'boarded' || b.boarded_at);
      setPhase(allBoarded ? 'dropoff' : 'pickup');

      // Fetch profiles for passengers
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
    };
    fetchData();
  }, [user]);

  // Update driver location periodically
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
      toast({ title: lang === 'ar' ? 'رمز خاطئ' : 'Wrong Code', description: lang === 'ar' ? 'رمز الصعود غير صحيح' : 'Invalid boarding code', variant: 'destructive' });
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
    setSelectedBooking(null);
    toast({ title: lang === 'ar' ? 'تم التأكيد' : 'Boarded!', description: lang === 'ar' ? 'تم تأكيد صعود الراكب' : 'Passenger boarding confirmed' });

    // Check if all boarded
    const updated = bookings.map(b => b.id === bookingId ? { ...b, status: 'boarded' } : b);
    if (updated.every(b => b.status === 'boarded')) setPhase('dropoff');
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
    toast({ title: lang === 'ar' ? 'تم الإنزال' : 'Dropped Off' });
  };

  // Build markers
  const markers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (route) {
    markers.push({ lat: route.origin_lat, lng: route.origin_lng, label: 'S', color: 'green' });
    markers.push({ lat: route.destination_lat, lng: route.destination_lng, label: 'E', color: 'red' });
  }
  
  const activeBookings = bookings.filter(b => b.status !== 'completed').sort((a: any, b: any) => {
    if (phase === 'pickup') return (a.stops?.stop_order ?? 999) - (b.stops?.stop_order ?? 999);
    return (a.dropoff?.stop_order ?? 999) - (b.dropoff?.stop_order ?? 999);
  });
  activeBookings.forEach((b, i) => {
    if (phase === 'pickup' && b.status === 'confirmed') {
      // Use custom pickup if available, otherwise use stop
      const lat = b.custom_pickup_lat || b.stops?.lat;
      const lng = b.custom_pickup_lng || b.stops?.lng;
      if (lat && lng) {
        markers.push({ lat, lng, label: `P${i + 1}`, color: 'green' });
      }
    }
    if ((phase === 'dropoff' || b.status === 'boarded') && b.dropoff?.lat) {
      markers.push({ lat: b.dropoff.lat, lng: b.dropoff.lng, label: `D${i + 1}`, color: 'red' });
    }
  });

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
          <Link to="/driver-dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-base font-bold text-foreground">{lang === 'ar' ? 'الرحلة النشطة' : 'Active Ride'}</h1>
          <span className={`ms-auto text-xs px-2.5 py-1 rounded-full font-medium ${
            phase === 'pickup' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
          }`}>
            {phase === 'pickup' 
              ? (lang === 'ar' ? '🔄 جاري الاستلام' : '🔄 Picking up')
              : (lang === 'ar' ? '📍 جاري الإنزال' : '📍 Dropping off')}
          </span>
        </div>
      </header>

      {/* Map */}
      <div className="h-[300px] relative">
        <MapView
          className="h-full"
          markers={markers}
          origin={route ? { lat: route.origin_lat, lng: route.origin_lng } : undefined}
          destination={route ? { lat: route.destination_lat, lng: route.destination_lng } : undefined}
          showDirections={!!route}
          zoom={12}
          showUserLocation={true}
        />
      </div>

      {/* Passengers list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">
            {lang === 'ar' ? `الركاب (${activeBookings.length})` : `Passengers (${activeBookings.length})`}
          </h2>
        </div>

        {activeBookings.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            {lang === 'ar' ? 'لا يوجد ركاب اليوم' : 'No passengers today'}
          </div>
        )}

        {activeBookings.map((b, i) => {
          const profile = profiles[b.user_id];
          const isBoarded = b.status === 'boarded';
          return (
            <div key={b.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isBoarded ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
                  }`}>
                    {isBoarded ? <UserCheck className="w-4 h-4" /> : `P${i + 1}`}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{profile?.full_name || (lang === 'ar' ? 'راكب' : 'Passenger')}</p>
                    {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isBoarded ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
                }`}>
                  {isBoarded ? (lang === 'ar' ? 'في الشاتل' : 'On board') : (lang === 'ar' ? 'في الانتظار' : 'Waiting')}
                </span>
              </div>

              {/* Pickup & Dropoff info */}
              <div className="text-xs text-muted-foreground space-y-1 mb-3">
                <div className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-green-500" />
                  <span>
                    {b.custom_pickup_name
                      ? `📍 ${b.custom_pickup_name}`
                      : (lang === 'ar' ? (b.stops?.name_ar || 'نقطة الركوب') : (b.stops?.name_en || 'Pickup'))}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-destructive" />
                  <span>{lang === 'ar' ? (b.dropoff?.name_ar || 'نقطة النزول') : (b.dropoff?.name_en || 'Dropoff')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setChatBookingId(b.id)}>
                  <MessageCircle className="w-3.5 h-3.5 me-1" />
                  {lang === 'ar' ? 'محادثة' : 'Chat'}
                </Button>

                {!isBoarded && phase === 'pickup' && (
                  <>
                    {selectedBooking === b.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={boardingInput}
                          onChange={(e) => setBoardingInput(e.target.value)}
                          placeholder={lang === 'ar' ? 'أدخل رمز الصعود' : 'Enter code'}
                          className="h-8 text-sm flex-1"
                          maxLength={6}
                        />
                        <Button size="sm" onClick={() => verifyBoarding(b.id)} disabled={boardingInput.length !== 6}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => { setSelectedBooking(b.id); setBoardingInput(''); }}>
                        <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                        {lang === 'ar' ? 'تأكيد صعود' : 'Verify'}
                      </Button>
                    )}
                  </>
                )}

                {isBoarded && (
                  <Button size="sm" variant="outline" onClick={() => markDroppedOff(b.id)}>
                    <DropOff className="w-3.5 h-3.5 me-1" />
                    {lang === 'ar' ? 'إنزال' : 'Drop off'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat modal */}
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
