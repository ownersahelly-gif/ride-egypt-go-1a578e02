import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import MapView from '@/components/MapView';
import {
  MapPin, Clock, Users, ArrowRight, Search, ChevronLeft, ChevronRight,
  Calendar, AlertCircle, Car, User as UserIcon
} from 'lucide-react';

const BookRide = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [search, setSearch] = useState('');
  const [selectedPickup, setSelectedPickup] = useState('');
  const [selectedDropoff, setSelectedDropoff] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'browse' | 'details'>('browse');

  // Date-based browsing
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rideInstances, setRideInstances] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [shuttleInfo, setShuttleInfo] = useState<any>(null);

  const getDateOptions = () => {
    const options: { label: string; date: string }[] = [];
    const today = new Date();
    const dayNames = lang === 'ar'
      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      let label = '';
      if (i === 0) label = lang === 'ar' ? 'اليوم' : 'Today';
      else if (i === 1) label = lang === 'ar' ? 'غداً' : 'Tomorrow';
      else label = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
      options.push({ label, date: dateStr });
    }
    return options;
  };

  useEffect(() => {
    fetchRideInstances(selectedDate);
  }, [selectedDate]);

  const fetchRideInstances = async (date: string) => {
    setLoadingRides(true);
    const { data } = await supabase
      .from('ride_instances')
      .select('*, routes(name_en, name_ar, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, price, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)')
      .eq('ride_date', date)
      .eq('status', 'scheduled')
      .order('departure_time');

    if (data && data.length > 0) {
      // Fetch driver profiles and shuttle info for all rides
      const driverIds = [...new Set(data.map(r => r.driver_id))];
      const shuttleIds = [...new Set(data.map(r => r.shuttle_id))];

      const [{ data: profiles }, { data: shuttles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, avatar_url, phone').in('user_id', driverIds),
        supabase.from('shuttles').select('id, vehicle_model, vehicle_plate, capacity').in('id', shuttleIds),
      ]);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
      const shuttleMap: Record<string, any> = {};
      (shuttles || []).forEach(s => { shuttleMap[s.id] = s; });

      const enriched = data.map(r => ({
        ...r,
        driver_profile: profileMap[r.driver_id] || null,
        shuttle_info: shuttleMap[r.shuttle_id] || null,
      }));
      setRideInstances(enriched);
    } else {
      setRideInstances([]);
    }
    setLoadingRides(false);
  };

  const selectRide = async (ride: any) => {
    setSelectedRide(ride);
    setDriverProfile(ride.driver_profile);
    setShuttleInfo(ride.shuttle_info);
    // Load stops for this route
    const { data } = await supabase.from('stops').select('*').eq('route_id', ride.route_id).order('stop_order');
    setStops(data || []);
    setSelectedPickup('');
    setSelectedDropoff('');
    setStep('details');
  };

  const filteredRides = rideInstances.filter((ri) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ri.routes?.name_en?.toLowerCase().includes(q) || ri.routes?.name_ar?.includes(q) ||
      ri.routes?.origin_name_en?.toLowerCase().includes(q) || ri.routes?.destination_name_en?.toLowerCase().includes(q);
  });

  const handleBook = async () => {
    if (!user || !selectedRide) return;
    if (!selectedPickup || !selectedDropoff) {
      toast({ title: lang === 'ar' ? 'اختر المحطات' : 'Select stops', description: lang === 'ar' ? 'يرجى اختيار نقطة الركوب والنزول' : 'Please select pickup and dropoff stops', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (selectedRide.available_seats < 1) {
        toast({ title: lang === 'ar' ? 'لا توجد مقاعد' : 'No seats available', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        user_id: user.id,
        route_id: selectedRide.route_id,
        shuttle_id: selectedRide.shuttle_id,
        pickup_stop_id: selectedPickup,
        dropoff_stop_id: selectedDropoff,
        seats: 1,
        total_price: selectedRide.routes?.price || 0,
        scheduled_date: selectedRide.ride_date,
        scheduled_time: selectedRide.departure_time,
        status: 'pending',
      });
      if (error) throw error;

      await supabase.from('ride_instances').update({
        available_seats: selectedRide.available_seats - 1,
      }).eq('id', selectedRide.id);

      toast({ title: t('booking.success'), description: t('booking.successDesc') });
      navigate('/my-bookings');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const dateOptions = getDateOptions();
  const pickupStops = stops.filter(s => s.stop_type !== 'dropoff');
  const dropoffStops = stops.filter(s => s.stop_type !== 'pickup');

  // Ensure dropoff is after pickup in stop_order
  const selectedPickupOrder = stops.find(s => s.id === selectedPickup)?.stop_order ?? -1;
  const validDropoffs = dropoffStops.filter(s => s.stop_order > selectedPickupOrder);

  // Map markers for route details
  const routeMarkers = stops.map(s => ({
    lat: s.lat, lng: s.lng, label: s.stop_order.toString(),
    color: (s.id === selectedPickup ? 'green' : s.id === selectedDropoff ? 'red' : undefined) as 'green' | 'red' | undefined,
  }));

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">{t('booking.title')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {step === 'browse' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input placeholder={t('booking.searchPlaceholder')} className="ps-11 h-12 text-base rounded-xl"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">
                <Calendar className="w-4 h-4 inline me-1" />
                {lang === 'ar' ? 'اختر اليوم' : 'Select Day'}
              </Label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dateOptions.map((opt) => (
                  <button key={opt.date} onClick={() => setSelectedDate(opt.date)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border transition-colors ${
                      selectedDate === opt.date
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} className="w-48" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {lang === 'ar' ? 'الرحلات المتاحة' : 'Available Rides'}
              </h2>

              {loadingRides ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                </div>
              ) : filteredRides.length > 0 ? (
                <div className="space-y-3">
                  {filteredRides.map((ride) => (
                    <button key={ride.id} onClick={() => selectRide(ride)}
                      disabled={ride.available_seats === 0}
                      className="w-full text-start bg-card border border-border rounded-xl p-5 hover:border-secondary/40 hover:shadow-card-hover transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                      {/* Driver info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          {ride.driver_profile?.avatar_url ? (
                            <img src={ride.driver_profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {ride.driver_profile?.full_name || (lang === 'ar' ? 'سائق' : 'Driver')}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Car className="w-3 h-3" />
                            <span>{ride.shuttle_info?.vehicle_model} · {ride.shuttle_info?.vehicle_plate}</span>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-primary">{ride.routes?.price} EGP</span>
                      </div>

                      <h3 className="font-semibold text-foreground text-sm mb-2">
                        {lang === 'ar' ? ride.routes?.name_ar : ride.routes?.name_en}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="truncate">{lang === 'ar' ? ride.routes?.origin_name_ar : ride.routes?.origin_name_en}</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                        <MapPin className="w-4 h-4 text-destructive shrink-0" />
                        <span className="truncate">{lang === 'ar' ? ride.routes?.destination_name_ar : ride.routes?.destination_name_en}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />{ride.departure_time?.slice(0, 5)}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />{ride.routes?.estimated_duration_minutes} {t('booking.min')}
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${ride.available_seats <= 3 ? 'text-destructive' : 'text-green-600'}`}>
                          <Users className="w-3.5 h-3.5" />
                          {ride.available_seats}/{ride.total_seats} {lang === 'ar' ? 'متاح' : 'left'}
                        </span>
                      </div>
                      {ride.available_seats <= 3 && ride.available_seats > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-destructive font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {lang === 'ar' ? 'عدد قليل متبقي!' : 'Few seats left!'}
                        </div>
                      )}
                      {ride.available_seats === 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-destructive font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {lang === 'ar' ? 'مكتمل' : 'Full'}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {lang === 'ar' ? 'لا توجد رحلات متاحة في هذا اليوم' : 'No rides available on this day'}
                  </p>
                  <Link to="/request-route"><Button className="mt-4">{t('booking.requestNew')}</Button></Link>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'details' && selectedRide && (
          <div className="space-y-5">
            <button onClick={() => { setStep('browse'); setSelectedRide(null); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Back className="w-4 h-4" />{t('booking.backToRoutes')}
            </button>

            {/* Driver & Vehicle Card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {driverProfile?.avatar_url ? (
                    <img src={driverProfile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <UserIcon className="w-7 h-7 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    {driverProfile?.full_name || (lang === 'ar' ? 'سائق' : 'Driver')}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Car className="w-4 h-4" />
                    <span>{shuttleInfo?.vehicle_model}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{shuttleInfo?.vehicle_plate}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-primary">{selectedRide.routes?.price} EGP</p>
                  <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'للراكب' : 'per person'}</p>
                </div>
                <div className="bg-surface rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{selectedRide.departure_time?.slice(0, 5)}</p>
                  <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الانطلاق' : 'Departure'}</p>
                </div>
                <div className="bg-surface rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${selectedRide.available_seats <= 3 ? 'text-destructive' : 'text-green-600'}`}>
                    {selectedRide.available_seats}/{selectedRide.total_seats}
                  </p>
                  <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'متاح' : 'Seats'}</p>
                </div>
              </div>
            </div>

            {/* Route Map */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="h-[250px]">
                <MapView
                  className="h-full"
                  markers={routeMarkers}
                  origin={selectedRide.routes ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng } : undefined}
                  destination={selectedRide.routes ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng } : undefined}
                  showDirections={!!selectedRide.routes}
                  zoom={12}
                  showUserLocation={false}
                />
              </div>
            </div>

            {/* Stop Selection */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground">
                {lang === 'ar' ? 'اختر محطات الركوب والنزول' : 'Select Pickup & Dropoff Stops'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'المحطات على مسار السائق فقط' : 'These are stops along the driver\'s route'}
              </p>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-green-500" />
                  {t('booking.pickupStop')}
                </Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedPickup} onChange={(e) => { setSelectedPickup(e.target.value); setSelectedDropoff(''); }}>
                  <option value="">{t('booking.selectStop')}</option>
                  {pickupStops.map(s => (
                    <option key={s.id} value={s.id}>
                      {lang === 'ar' ? s.name_ar : s.name_en} (#{s.stop_order})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-destructive" />
                  {t('booking.dropoffStop')}
                </Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedDropoff} onChange={(e) => setSelectedDropoff(e.target.value)}
                  disabled={!selectedPickup}>
                  <option value="">{t('booking.selectStop')}</option>
                  {validDropoffs.map(s => (
                    <option key={s.id} value={s.id}>
                      {lang === 'ar' ? s.name_ar : s.name_en} (#{s.stop_order})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary & Book */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{lang === 'ar' ? 'عدد المقاعد' : 'Seats'}</span>
                <span className="font-medium text-foreground">1</span>
              </div>
              <div className="flex items-center justify-between mb-4 border-t border-border pt-3">
                <span className="text-lg font-bold">{t('booking.total')}</span>
                <span className="text-lg font-bold text-primary">{selectedRide.routes?.price} EGP</span>
              </div>

              <Button className="w-full" size="lg" onClick={handleBook}
                disabled={loading || selectedRide.available_seats === 0 || !selectedPickup || !selectedDropoff}>
                {loading ? t('auth.loading') : (selectedRide.available_seats === 0
                  ? (lang === 'ar' ? 'مكتمل' : 'Full')
                  : t('booking.confirm'))}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookRide;
