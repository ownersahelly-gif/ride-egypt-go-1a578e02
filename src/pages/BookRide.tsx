import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import MapView from '@/components/MapView';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import {
  MapPin, Clock, Users, ArrowRight, Search, ChevronLeft, ChevronRight,
  Calendar, AlertCircle, Car, User as UserIcon, Loader2, CheckCircle2, XCircle,
  Navigation, Upload, Image as ImageIcon, ListOrdered, Phone
} from 'lucide-react';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/** Check if a point is close to the route polyline (within ~50m) */
const isPointOnRoute = (
  point: { lat: number; lng: number },
  routeResult: any,
): boolean => {
  if (!routeResult || typeof google === 'undefined' || !google?.maps) return false;
  const path = routeResult.routes[0]?.overview_path;
  if (!path) return false;
  const pt = new google.maps.LatLng(point.lat, point.lng);
  const isOnPoly = google.maps.geometry?.poly?.isLocationOnEdge(pt, new google.maps.Polyline({ path }), 5e-4);
  if (isOnPoly) return true;
  // Fallback: check distance to each path point
  for (const p of path) {
    const dist = google.maps.geometry?.spherical?.computeDistanceBetween(pt, p);
    if (dist !== undefined && dist < 80) return true;
  }
  return false;
};

/** Calculate driving-time deviation: prevStop → custom → nextStop vs prevStop → nextStop */
const calcDeviation = (
  prevStop: { lat: number; lng: number },
  nextStop: { lat: number; lng: number },
  customPoint: { lat: number; lng: number },
): Promise<number> => {
  if (typeof google === 'undefined' || !google?.maps?.DirectionsService) return Promise.resolve(999);
  const ds = new google.maps.DirectionsService();
  const directReq = (): Promise<number> =>
    new Promise((res) =>
      ds.route(
        { origin: prevStop, destination: nextStop, travelMode: google.maps.TravelMode.DRIVING },
        (r, s) => res(s === 'OK' && r ? (r.routes[0]?.legs[0]?.duration?.value ?? 0) : 0),
      ),
    );
  const detourReq = (): Promise<number> =>
    new Promise((res) =>
      ds.route(
        {
          origin: prevStop,
          destination: nextStop,
          waypoints: [{ location: customPoint, stopover: true }],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (r, s) => {
          if (s !== 'OK' || !r) return res(99999);
          const legs = r.routes[0]?.legs ?? [];
          res(legs.reduce((sum, l) => sum + (l.duration?.value ?? 0), 0));
        },
      ),
    );
  return Promise.all([directReq(), detourReq()]).then(([direct, detour]) => (detour - direct) / 60);
};

type PointSelection = { lat: number; lng: number; name: string } | null;

const BookRide = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'browse' | 'details'>('browse');

  // Pickup
  const [pickupMode, setPickupMode] = useState<'start' | 'nearby'>('start');
  const [customPickup, setCustomPickup] = useState<PointSelection>(null);
  const [validatingPickup, setValidatingPickup] = useState(false);
  const [pickupResult, setPickupResult] = useState<{ ok: boolean; minutes: number; onRoute: boolean } | null>(null);

  // Dropoff
  const [dropoffMode, setDropoffMode] = useState<'end' | 'nearby'>('end');
  const [customDropoff, setCustomDropoff] = useState<PointSelection>(null);
  const [validatingDropoff, setValidatingDropoff] = useState(false);
  const [dropoffResult, setDropoffResult] = useState<{ ok: boolean; minutes: number; onRoute: boolean } | null>(null);

  // Which one is being set via map click
  const [mapClickTarget, setMapClickTarget] = useState<'pickup' | 'dropoff'>('pickup');

  // Date / rides
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rideInstances, setRideInstances] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [shuttleInfo, setShuttleInfo] = useState<any>(null);

  // Route directions result for on-route checking
  const [routeDirections, setRouteDirections] = useState<any>(null);

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

  useEffect(() => { fetchRideInstances(selectedDate); }, [selectedDate]);

  const fetchRideInstances = async (date: string) => {
    setLoadingRides(true);
    const { data } = await supabase
      .from('ride_instances')
      .select('*, routes(name_en, name_ar, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, price, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)')
      .eq('ride_date', date)
      .eq('status', 'scheduled')
      .order('departure_time');

    if (data && data.length > 0) {
      const driverIds = [...new Set(data.map(r => r.driver_id))];
      const shuttleIds = [...new Set(data.map(r => r.shuttle_id))];
      const [{ data: profiles }, { data: shuttles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, avatar_url, phone').in('user_id', driverIds),
        supabase.from('shuttles').select('id, vehicle_model, vehicle_plate, capacity').in('id', shuttleIds),
      ]);
      const pMap: Record<string, any> = {};
      (profiles || []).forEach(p => { pMap[p.user_id] = p; });
      const sMap: Record<string, any> = {};
      (shuttles || []).forEach(s => { sMap[s.id] = s; });
      setRideInstances(data.map(r => ({ ...r, driver_profile: pMap[r.driver_id], shuttle_info: sMap[r.shuttle_id] })));
    } else {
      setRideInstances([]);
    }
    setLoadingRides(false);
  };

  // Fetch route directions when ride is selected (for on-route checking)
  useEffect(() => {
    if (!selectedRide?.routes || typeof google === 'undefined' || !google?.maps?.DirectionsService) { setRouteDirections(null); return; }
    const ds = new google.maps.DirectionsService();
    ds.route({
      origin: { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng },
      destination: { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng },
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) setRouteDirections(result);
    });
  }, [selectedRide?.route_id]);

  const selectRide = async (ride: any) => {
    setSelectedRide(ride);
    setDriverProfile(ride.driver_profile);
    setShuttleInfo(ride.shuttle_info);
    setCustomPickup(null);
    setCustomDropoff(null);
    setPickupResult(null);
    setDropoffResult(null);
    setPickupMode('start');
    setDropoffMode('end');
    setStep('details');
  };

  const filteredRides = rideInstances.filter((ri) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ri.routes?.name_en?.toLowerCase().includes(q) || ri.routes?.name_ar?.includes(q) ||
      ri.routes?.origin_name_en?.toLowerCase().includes(q) || ri.routes?.destination_name_en?.toLowerCase().includes(q);
  });

  // --- Validate a custom point (pickup or dropoff) ---
  const validateCustomPoint = useCallback(async (
    point: { lat: number; lng: number; name: string },
    type: 'pickup' | 'dropoff',
  ) => {
    if (!selectedRide?.routes) return;
    const setValidating = type === 'pickup' ? setValidatingPickup : setValidatingDropoff;
    const setResult = type === 'pickup' ? setPickupResult : setDropoffResult;
    const setCustom = type === 'pickup' ? setCustomPickup : setCustomDropoff;

    setValidating(true);
    setResult(null);
    setCustom(point);

    // Check if point is on the route polyline
    const onRoute = isPointOnRoute(point, routeDirections);
    if (onRoute) {
      setResult({ ok: true, minutes: 0, onRoute: true });
      setValidating(false);
      return;
    }

    // Not on route — check deviation
    const origin = { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng };
    const dest = { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng };

    try {
      const deviation = await calcDeviation(origin, dest, point);
      const ok = deviation <= 5;
      setResult({ ok, minutes: Math.round(deviation * 10) / 10, onRoute: false });
      if (!ok) {
        toast({
          title: lang === 'ar' ? 'موقع بعيد عن المسار' : 'Too far from route',
          description: lang === 'ar'
            ? `هذا الموقع سيضيف ${Math.round(deviation)} دقائق إنحراف (الحد الأقصى 5 دقائق)`
            : `This location adds ${Math.round(deviation)} min deviation (max 5 min allowed)`,
          variant: 'destructive',
        });
      }
    } catch {
      setResult({ ok: false, minutes: 99, onRoute: false });
    }
    setValidating(false);
  }, [selectedRide, routeDirections, lang, toast]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (step !== 'details') return;
    const target = (pickupMode === 'nearby' && mapClickTarget === 'pickup') ? 'pickup'
      : (dropoffMode === 'nearby' && mapClickTarget === 'dropoff') ? 'dropoff'
      : (pickupMode === 'nearby') ? 'pickup'
      : (dropoffMode === 'nearby') ? 'dropoff'
      : null;
    if (!target) return;

    if (typeof google !== 'undefined') {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const name = status === 'OK' && results?.[0] ? results[0].formatted_address : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        validateCustomPoint({ lat, lng, name }, target);
      });
    } else {
      validateCustomPoint({ lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }, target);
    }
  }, [step, pickupMode, dropoffMode, mapClickTarget, validateCustomPoint]);

  // --- Validity ---
  const isPickupValid = pickupMode === 'start' ? true : (!!customPickup && pickupResult?.ok === true);
  const isDropoffValid = dropoffMode === 'end' ? true : (!!customDropoff && dropoffResult?.ok === true);

  // InstaPay payment proof
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [instapayPhone, setInstapayPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch InstaPay phone number
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'instapay_phone').single()
      .then(({ data }) => { if (data) setInstapayPhone(data.value); });
  }, []);

  const handlePaymentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: lang === 'ar' ? 'الملف كبير جداً' : 'File too large', description: lang === 'ar' ? 'الحد الأقصى 5 ميجا' : 'Max 5MB', variant: 'destructive' });
      return;
    }
    setPaymentProof(file);
    setPaymentPreview(URL.createObjectURL(file));
  };

  const isRideFull = selectedRide?.available_seats === 0;

  // --- Booking ---
  const handleBook = async (asWaitlist = false) => {
    if (!user || !selectedRide) return;
    if (!isPickupValid || !isDropoffValid) {
      toast({ title: lang === 'ar' ? 'اختر نقاط الركوب والنزول' : 'Select pickup & dropoff', variant: 'destructive' });
      return;
    }
    if (!asWaitlist && !paymentProof) {
      toast({ title: lang === 'ar' ? 'أرفق إثبات الدفع' : 'Attach payment proof', description: lang === 'ar' ? 'أرسل لقطة شاشة من InstaPay' : 'Upload InstaPay screenshot', variant: 'destructive' });
      return;
    }
    if (!asWaitlist && selectedRide.available_seats < 1) {
      toast({ title: lang === 'ar' ? 'لا توجد مقاعد' : 'No seats available', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let proofUrl: string | null = null;

      // Upload payment proof
      if (paymentProof) {
        setUploadingProof(true);
        const ext = paymentProof.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('instapay-proofs')
          .upload(filePath, paymentProof);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('instapay-proofs').getPublicUrl(filePath);
        proofUrl = urlData?.publicUrl || filePath;
        setUploadingProof(false);
      }

      // Calculate waitlist position
      let waitlistPos: number | null = null;
      if (asWaitlist) {
        const { data: existingWaitlist } = await supabase
          .from('bookings')
          .select('waitlist_position')
          .eq('route_id', selectedRide.route_id)
          .eq('scheduled_date', selectedRide.ride_date)
          .eq('scheduled_time', selectedRide.departure_time)
          .eq('status', 'waitlist')
          .order('waitlist_position', { ascending: false })
          .limit(1);
        waitlistPos = ((existingWaitlist?.[0]?.waitlist_position as number) || 0) + 1;
      }

      const bookingData: any = {
        user_id: user.id,
        route_id: selectedRide.route_id,
        shuttle_id: selectedRide.shuttle_id,
        seats: 1,
        total_price: selectedRide.routes?.price || 0,
        scheduled_date: selectedRide.ride_date,
        scheduled_time: selectedRide.departure_time,
        status: asWaitlist ? 'waitlist' : 'pending',
        payment_proof_url: proofUrl,
        waitlist_position: waitlistPos,
      };

      // Pickup
      if (pickupMode === 'start') {
        bookingData.custom_pickup_lat = selectedRide.routes.origin_lat;
        bookingData.custom_pickup_lng = selectedRide.routes.origin_lng;
        bookingData.custom_pickup_name = lang === 'ar' ? selectedRide.routes.origin_name_ar : selectedRide.routes.origin_name_en;
      } else if (customPickup) {
        bookingData.custom_pickup_lat = customPickup.lat;
        bookingData.custom_pickup_lng = customPickup.lng;
        bookingData.custom_pickup_name = customPickup.name;
      }

      // Dropoff
      if (dropoffMode === 'end') {
        bookingData.custom_dropoff_lat = selectedRide.routes.destination_lat;
        bookingData.custom_dropoff_lng = selectedRide.routes.destination_lng;
        bookingData.custom_dropoff_name = lang === 'ar' ? selectedRide.routes.destination_name_ar : selectedRide.routes.destination_name_en;
      } else if (customDropoff) {
        bookingData.custom_dropoff_lat = customDropoff.lat;
        bookingData.custom_dropoff_lng = customDropoff.lng;
        bookingData.custom_dropoff_name = customDropoff.name;
      }

      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      if (!asWaitlist) {
        await supabase.from('ride_instances').update({
          available_seats: selectedRide.available_seats - 1,
        }).eq('id', selectedRide.id);
      }

      toast({
        title: asWaitlist
          ? (lang === 'ar' ? 'تم إضافتك لقائمة الانتظار' : 'Added to waitlist')
          : (lang === 'ar' ? 'تم الحجز بنجاح' : 'Booking submitted'),
        description: asWaitlist
          ? (lang === 'ar' ? `ترتيبك: #${waitlistPos}` : `Your position: #${waitlistPos}`)
          : (lang === 'ar' ? 'في انتظار موافقة المسؤول' : 'Waiting for admin approval'),
      });
      navigate('/my-bookings');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setUploadingProof(false);
    }
  };

  const dateOptions = getDateOptions();

  // Map markers
  const mapMarkers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (selectedRide?.routes) {
    mapMarkers.push(
      { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng, label: 'A', color: 'green' },
      { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng, label: 'B', color: 'red' },
    );
  }
  if (customPickup && pickupMode === 'nearby') {
    mapMarkers.push({ lat: customPickup.lat, lng: customPickup.lng, label: '📍', color: 'green' });
  }
  if (customDropoff && dropoffMode === 'nearby') {
    mapMarkers.push({ lat: customDropoff.lat, lng: customDropoff.lng, label: '📍', color: 'red' });
  }

  const isNearbyMode = pickupMode === 'nearby' || dropoffMode === 'nearby';

  // --- Render helper for point selection (shared by pickup & dropoff) ---
  const renderPointSelector = (
    type: 'pickup' | 'dropoff',
    mode: 'start' | 'end' | 'nearby',
    setMode: (m: any) => void,
    customPoint: PointSelection,
    validating: boolean,
    result: { ok: boolean; minutes: number; onRoute: boolean } | null,
  ) => {
    const isPickup = type === 'pickup';
    const startLabel = isPickup
      ? (lang === 'ar' ? '🚏 نقطة الانطلاق' : '🚏 Starting Point')
      : (lang === 'ar' ? '🏁 نقطة الوصول' : '🏁 End Point');
    const nearbyLabel = lang === 'ar' ? '🗺️ موقع قريب (≤5 د)' : '🗺️ Nearby (≤5 min)';

    const isStartMode = mode === 'start' || mode === 'end';

    return (
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-1">
          <MapPin className={`w-4 h-4 ${isPickup ? 'text-green-500' : 'text-destructive'}`} />
          {isPickup
            ? (lang === 'ar' ? 'نقطة الركوب' : 'Pickup Location')
            : (lang === 'ar' ? 'نقطة النزول' : 'Dropoff Location')}
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isPickup) { setMode('start'); setCustomPickup(null); setPickupResult(null); }
              else { setMode('end'); setCustomDropoff(null); setDropoffResult(null); }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              isStartMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            }`}>
            {startLabel}
          </button>
          <button
            onClick={() => {
              setMode('nearby');
              setMapClickTarget(type);
              if (isPickup) { setCustomPickup(null); setPickupResult(null); }
              else { setCustomDropoff(null); setDropoffResult(null); }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'nearby' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            }`}>
            {nearbyLabel}
          </button>
        </div>

        {isStartMode && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <div>
                <p className="font-medium">
                  {isPickup
                    ? (lang === 'ar' ? selectedRide?.routes?.origin_name_ar : selectedRide?.routes?.origin_name_en)
                    : (lang === 'ar' ? selectedRide?.routes?.destination_name_ar : selectedRide?.routes?.destination_name_en)}
                </p>
                <p className="text-xs">
                  {isPickup
                    ? (lang === 'ar' ? 'الباص ينتظر 5 دقائق عند نقطة الانطلاق' : 'Bus waits 5 min at starting point')
                    : (lang === 'ar' ? 'نقطة النهاية للمسار' : 'Route end point')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                const lat = isPickup ? selectedRide?.routes?.origin_lat : selectedRide?.routes?.destination_lat;
                const lng = isPickup ? selectedRide?.routes?.origin_lng : selectedRide?.routes?.destination_lng;
                const label = isPickup
                  ? (lang === 'ar' ? selectedRide?.routes?.origin_name_ar : selectedRide?.routes?.origin_name_en)
                  : (lang === 'ar' ? selectedRide?.routes?.destination_name_ar : selectedRide?.routes?.destination_name_en);
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`, '_blank');
              }}
            >
              <Navigation className="w-4 h-4" />
              {lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
            </Button>
          </div>
        )}

        {mode === 'nearby' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? 'اضغط على الخريطة أو ابحث. إذا كان الموقع على المسار (الخط الأزرق) يتم قبوله تلقائياً. وإلا فالحد الأقصى 5 دقائق انحراف.'
                : 'Tap the map or search. If on the route (blue line) it\'s auto-accepted. Otherwise max 5 min deviation.'}
            </p>

            <PlacesAutocomplete
              placeholder={isPickup
                ? (lang === 'ar' ? 'ابحث عن موقع الركوب...' : 'Search pickup location...')
                : (lang === 'ar' ? 'ابحث عن موقع النزول...' : 'Search dropoff location...')}
              onSelect={(place) => {
                setMapClickTarget(type);
                validateCustomPoint({ lat: place.lat, lng: place.lng, name: place.name }, type);
              }}
              iconColor={isPickup ? 'text-green-500' : 'text-destructive'}
            />

            {validating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === 'ar' ? 'جاري التحقق...' : 'Checking...'}
              </div>
            )}

            {customPoint && result && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                  result.ok ? 'bg-green-50 text-green-700' : 'bg-destructive/10 text-destructive'
                }`}>
                  {result.ok ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <div>
                        <p className="font-medium">{customPoint.name}</p>
                        <p className="text-xs">
                          {result.onRoute
                            ? (lang === 'ar' ? 'على المسار مباشرة ✓' : 'Directly on route ✓')
                            : (lang === 'ar' ? `+${result.minutes} دقيقة إنحراف ✓` : `+${result.minutes} min deviation ✓`)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <div>
                        <p className="font-medium">{lang === 'ar' ? 'موقع بعيد جداً' : 'Too far from route'}</p>
                        <p className="text-xs">
                          {lang === 'ar' ? `+${result.minutes} دقيقة (الحد 5 دقائق)` : `+${result.minutes} min (max 5 min)`}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {result.ok && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${customPoint.lat},${customPoint.lng}&travelmode=driving`, '_blank');
                    }}
                  >
                    <Navigation className="w-4 h-4" />
                    {lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
                      className="w-full text-start bg-card border border-border rounded-xl p-5 hover:border-secondary/40 hover:shadow-card-hover transition-all">
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
                          <AlertCircle className="w-3 h-3" />{lang === 'ar' ? 'عدد قليل!' : 'Few seats left!'}
                        </div>
                      )}
                      {ride.available_seats === 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-destructive font-medium">
                          <AlertCircle className="w-3 h-3" />{lang === 'ar' ? 'مكتمل' : 'Full'}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {lang === 'ar' ? 'لا توجد رحلات' : 'No rides available'}
                  </p>
                  <Link to="/request-route"><Button className="mt-4">{t('booking.requestNew')}</Button></Link>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'details' && selectedRide && (
          <div className="space-y-5">
            <button onClick={() => { setStep('browse'); setSelectedRide(null); setRouteDirections(null); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Back className="w-4 h-4" />{t('booking.backToRoutes')}
            </button>

            {/* Driver & Vehicle */}
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
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {lang === 'ar' ? 'خريطة المسار' : 'Route Map'}
                </span>
                {isNearbyMode && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    {lang === 'ar' ? '👆 اضغط على الخريطة لتحديد الموقع' : '👆 Tap map to set location'}
                  </span>
                )}
              </div>
              <div className="h-[280px]">
                <MapView
                  className="h-full"
                  markers={mapMarkers}
                  origin={selectedRide.routes ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng } : undefined}
                  destination={selectedRide.routes ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng } : undefined}
                  showDirections={!!selectedRide.routes}
                  zoom={12}
                  showUserLocation={false}
                  onMapClick={isNearbyMode ? handleMapClick : undefined}
                />
              </div>
            </div>

            {/* Pickup */}
            {renderPointSelector('pickup', pickupMode, setPickupMode, customPickup, validatingPickup, pickupResult)}

            {/* Dropoff */}
            {renderPointSelector('dropoff', dropoffMode, setDropoffMode, customDropoff, validatingDropoff, dropoffResult)}

            {/* InstaPay Payment */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                {lang === 'ar' ? 'الدفع عبر InstaPay' : 'Pay via InstaPay'}
              </h3>
              <div className="bg-surface rounded-xl p-4 text-sm text-muted-foreground space-y-2">
                <p>{lang === 'ar' ? 'حوّل المبلغ عبر InstaPay ثم ارفع لقطة شاشة للتحويل:' : 'Transfer the amount via InstaPay then upload a screenshot:'}</p>
                <p className="font-bold text-foreground text-lg">{selectedRide.routes?.price} EGP</p>
                {instapayPhone && (
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-3 mt-2">
                    <Phone className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'حوّل إلى هذا الرقم:' : 'Transfer to this number:'}</p>
                      <p className="font-bold text-foreground text-lg font-mono" dir="ltr">{instapayPhone}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs">{lang === 'ar' ? 'سيتم مراجعة الدفع من قبل المسؤول' : 'Payment will be reviewed by admin'}</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePaymentFile}
              />

              {paymentPreview ? (
                <div className="space-y-2">
                  <img src={paymentPreview} alt="Payment proof" className="w-full h-48 object-contain rounded-lg border border-border bg-muted" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 me-1" />
                    {lang === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed border-2 flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {lang === 'ar' ? 'ارفع لقطة شاشة InstaPay' : 'Upload InstaPay Screenshot'}
                  </span>
                </Button>
              )}
            </div>

            {/* Summary & Book */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{lang === 'ar' ? 'مقعد واحد' : '1 Seat'}</span>
                <span className="text-lg font-bold text-primary">{selectedRide.routes?.price} EGP</span>
              </div>

              {!isRideFull ? (
                <Button className="w-full mt-3" size="lg" onClick={() => handleBook(false)}
                  disabled={loading || !isPickupValid || !isDropoffValid || !paymentProof}>
                  {loading ? (
                    <><Loader2 className="w-4 h-4 me-1 animate-spin" />{lang === 'ar' ? 'جاري الحجز...' : 'Booking...'}</>
                  ) : (
                    lang === 'ar' ? 'تأكيد الحجز' : 'Confirm Booking'
                  )}
                </Button>
              ) : (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center gap-2 text-sm text-destructive font-medium p-2 bg-destructive/10 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {lang === 'ar' ? 'الرحلة مكتملة العدد' : 'This ride is full'}
                  </div>
                  <Button className="w-full" size="lg" variant="secondary" onClick={() => handleBook(true)}
                    disabled={loading || !isPickupValid || !isDropoffValid}>
                    <ListOrdered className="w-4 h-4 me-1" />
                    {loading
                      ? (lang === 'ar' ? 'جاري التسجيل...' : 'Joining...')
                      : (lang === 'ar' ? 'الانضمام لقائمة الانتظار' : 'Join Waitlist')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookRide;
