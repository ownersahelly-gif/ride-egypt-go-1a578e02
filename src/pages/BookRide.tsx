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
  MapPin, Clock, Users, ArrowRight, ChevronLeft, ChevronRight,
  Calendar, AlertCircle, Car, User as UserIcon, Loader2, CheckCircle2,
  Navigation, Upload, Image as ImageIcon, ListOrdered, Phone, History, Package, Bookmark
} from 'lucide-react';

/** Haversine distance in km */
const haversineDistanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

type PointSelection = { lat: number; lng: number; name: string } | null;

const BookRide = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [searchPickup, setSearchPickup] = useState('');
  const [searchDropoff, setSearchDropoff] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'browse' | 'details'>('browse');

  // Pickup
  const [pickupMode, setPickupMode] = useState<'start' | 'stop'>('start');
  const [selectedPickupStop, setSelectedPickupStop] = useState<any>(null);

  // Dropoff
  const [dropoffMode, setDropoffMode] = useState<'end' | 'stop'>('end');
  const [selectedDropoffStop, setSelectedDropoffStop] = useState<any>(null);

  // Trip direction
  const [tripDirection, setTripDirection] = useState<'go' | 'return' | 'both'>('both');

  // Date / rides
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rideInstances, setRideInstances] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [shuttleInfo, setShuttleInfo] = useState<any>(null);

  // Route directions result
  const [routeDirections, setRouteDirections] = useState<any>(null);

  // Route stops
  const [routeStops, setRouteStops] = useState<any[]>([]);

  // Saved locations
  const [savedLocations, setSavedLocations] = useState<any[]>([]);

  // Bundles
  const [availableBundles, setAvailableBundles] = useState<any[]>([]);
  const [activeBundlePurchase, setActiveBundlePurchase] = useState<any>(null);
  const [useBundle, setUseBundle] = useState(false);
  const [showBundleSection, setShowBundleSection] = useState(false);

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

  // Fetch route directions when ride is selected
  useEffect(() => {
    if (!selectedRide?.routes || typeof google === 'undefined' || !google?.maps?.DirectionsService) { setRouteDirections(null); return; }
    const ds = new google.maps.DirectionsService();
    const wps = routeStops.map((s: any) => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));
    ds.route({
      origin: { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng },
      destination: { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng },
      waypoints: wps.length > 0 ? wps : undefined,
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) setRouteDirections(result);
    });
  }, [selectedRide?.route_id, routeStops]);

  // Real-time subscription for stops changes
  useEffect(() => {
    if (!selectedRide?.route_id) return;
    const routeId = selectedRide.route_id;
    const channel = supabase
      .channel('stops-realtime-bookride')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stops', filter: `route_id=eq.${routeId}` }, async () => {
        const { data: stops } = await supabase.from('stops').select('*').eq('route_id', routeId).order('stop_order');
        setRouteStops(stops || []);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRide?.route_id]);

  const selectRide = async (ride: any) => {
    setSelectedRide(ride);
    setDriverProfile(ride.driver_profile);
    setShuttleInfo(ride.shuttle_info);
    setSelectedPickupStop(null);
    setSelectedDropoffStop(null);
    setPickupMode('start');
    setDropoffMode('end');
    setUseBundle(false);
    setTripDirection('both');
    setStep('details');

    const { data: stops } = await supabase
      .from('stops')
      .select('*')
      .eq('route_id', ride.route_id)
      .order('stop_order');
    setRouteStops(stops || []);

    if (user && ride.route_id) {
      const [{ data: savedLocs }, { data: bundles }, { data: purchases }] = await Promise.all([
        supabase.from('saved_locations').select('*').eq('user_id', user.id).eq('route_id', ride.route_id).order('use_count', { ascending: false }).limit(5),
        supabase.from('ride_bundles').select('*').eq('route_id', ride.route_id).eq('is_active', true),
        supabase.from('bundle_purchases').select('*').eq('user_id', user.id).eq('route_id', ride.route_id).eq('status', 'active').gt('rides_remaining', 0).gt('expires_at', new Date().toISOString()).limit(1),
      ]);
      setSavedLocations(savedLocs || []);
      setAvailableBundles(bundles || []);
      setActiveBundlePurchase(purchases?.[0] || null);
    }
  };

  const filteredRides = rideInstances.filter((ri) => {
    const route = ri.routes;
    if (!route) return false;
    if (searchPickup) {
      const q = searchPickup.toLowerCase();
      const originEn = route.origin_name_en?.toLowerCase() || '';
      const originAr = route.origin_name_ar || '';
      const destEn = route.destination_name_en?.toLowerCase() || '';
      const destAr = route.destination_name_ar || '';
      const matchesPickup = ri.direction === 'return'
        ? (destEn.startsWith(q) || destAr.startsWith(q))
        : (originEn.startsWith(q) || originAr.startsWith(q));
      if (!matchesPickup) return false;
    }
    if (searchDropoff) {
      const q = searchDropoff.toLowerCase();
      const originEn = route.origin_name_en?.toLowerCase() || '';
      const originAr = route.origin_name_ar || '';
      const destEn = route.destination_name_en?.toLowerCase() || '';
      const destAr = route.destination_name_ar || '';
      const matchesDropoff = ri.direction === 'return'
        ? (originEn.startsWith(q) || originAr.startsWith(q))
        : (destEn.startsWith(q) || destAr.startsWith(q));
      if (!matchesDropoff) return false;
    }
    return true;
  });

  // --- Validity ---
  const isPickupValid = pickupMode === 'start' ? true : !!selectedPickupStop;
  const isDropoffValid = dropoffMode === 'end' ? true : !!selectedDropoffStop;

  // Dynamic price - use route price directly
  const dynamicPrice = selectedRide?.routes?.price || 0;

  // InstaPay payment proof
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [instapayPhone, setInstapayPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'instapay_phone').single()
      .then(({ data }) => { if (data) setInstapayPhone(data.value); });
  }, []);

  const handlePaymentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: lang === 'ar' ? 'الملف كبير جداً' : 'File too large', variant: 'destructive' });
      return;
    }
    setPaymentProof(file);
    setPaymentPreview(URL.createObjectURL(file));
  };

  const isRideFull = selectedRide?.available_seats === 0;

  // Find closest stop to a searched location
  const findClosestStop = (point: { lat: number; lng: number }, stopType?: 'pickup' | 'dropoff'): any | null => {
    if (!routeStops.length) return null;
    let filteredStops = routeStops;
    if (stopType === 'pickup') {
      filteredStops = routeStops.filter(s => s.stop_type === 'pickup' || s.stop_type === 'both');
    } else if (stopType === 'dropoff') {
      filteredStops = routeStops.filter(s => s.stop_type === 'dropoff' || s.stop_type === 'both');
    }
    if (!filteredStops.length) filteredStops = routeStops;
    let closest = filteredStops[0];
    let minDist = haversineDistanceKm(point, { lat: closest.lat, lng: closest.lng });
    for (let i = 1; i < filteredStops.length; i++) {
      const d = haversineDistanceKm(point, { lat: filteredStops[i].lat, lng: filteredStops[i].lng });
      if (d < minDist) { minDist = d; closest = filteredStops[i]; }
    }
    return closest;
  };

  const handleSearchAndMatchStop = (place: { lat: number; lng: number; name: string }, type: 'pickup' | 'dropoff') => {
    const closest = findClosestStop(place, type);
    if (closest) {
      if (type === 'pickup') {
        setSelectedPickupStop(closest);
        setPickupMode('stop');
      } else {
        setSelectedDropoffStop(closest);
        setDropoffMode('stop');
      }
      const dist = haversineDistanceKm(place, { lat: closest.lat, lng: closest.lng });
      toast({
        title: lang === 'ar' ? '📍 أقرب نقطة توقف' : '📍 Nearest stop matched',
        description: lang === 'ar'
          ? `${closest.name_ar} (${dist.toFixed(1)} كم)`
          : `${closest.name_en} (${dist.toFixed(1)} km away)`,
      });
    }
  };

  // --- Booking ---
  const handleBook = async (asWaitlist = false) => {
    if (!user || !selectedRide) return;
    if (!isPickupValid || !isDropoffValid) {
      toast({ title: lang === 'ar' ? 'اختر نقاط الركوب والنزول' : 'Select pickup & dropoff', variant: 'destructive' });
      return;
    }
    const usingBundle = useBundle && activeBundlePurchase;
    if (!asWaitlist && !usingBundle && !paymentProof) {
      toast({ title: lang === 'ar' ? 'أرفق إثبات الدفع' : 'Attach payment proof', variant: 'destructive' });
      return;
    }
    if (!asWaitlist && selectedRide.available_seats < 1) {
      toast({ title: lang === 'ar' ? 'لا توجد مقاعد' : 'No seats available', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let proofUrl: string | null = null;
      if (paymentProof && !usingBundle) {
        setUploadingProof(true);
        const ext = paymentProof.name.split('.').pop();
        const filePath = `instapay-proofs/${user.id}/${Date.now()}.${ext}`;
        const { uploadToBunny } = await import('@/lib/bunnyUpload');
        proofUrl = await uploadToBunny(paymentProof, filePath);
        setUploadingProof(false);
      }

      let waitlistPos: number | null = null;
      if (asWaitlist) {
        const { data: existingWaitlist } = await supabase
          .from('bookings').select('waitlist_position')
          .eq('route_id', selectedRide.route_id).eq('scheduled_date', selectedRide.ride_date)
          .eq('scheduled_time', selectedRide.departure_time).eq('status', 'waitlist')
          .order('waitlist_position', { ascending: false }).limit(1);
        waitlistPos = ((existingWaitlist?.[0]?.waitlist_position as number) || 0) + 1;
      }

      const route = selectedRide.routes;
      const pickupLat = pickupMode === 'stop' && selectedPickupStop ? selectedPickupStop.lat : route.origin_lat;
      const pickupLng = pickupMode === 'stop' && selectedPickupStop ? selectedPickupStop.lng : route.origin_lng;
      const pickupName = pickupMode === 'stop' && selectedPickupStop
        ? (lang === 'ar' ? selectedPickupStop.name_ar : selectedPickupStop.name_en)
        : (lang === 'ar' ? route.origin_name_ar : route.origin_name_en);
      const dropoffLat = dropoffMode === 'stop' && selectedDropoffStop ? selectedDropoffStop.lat : route.destination_lat;
      const dropoffLng = dropoffMode === 'stop' && selectedDropoffStop ? selectedDropoffStop.lng : route.destination_lng;
      const dropoffName = dropoffMode === 'stop' && selectedDropoffStop
        ? (lang === 'ar' ? selectedDropoffStop.name_ar : selectedDropoffStop.name_en)
        : (lang === 'ar' ? route.destination_name_ar : route.destination_name_en);

      const basePrice = dynamicPrice;
      const singlePrice = usingBundle ? 0 : basePrice;
      const bookingStatus = asWaitlist ? 'waitlist' : (usingBundle ? 'confirmed' : 'pending');

      const directions: ('go' | 'return')[] = tripDirection === 'both' ? ['go', 'return'] : [tripDirection as 'go' | 'return'];

      let returnRideInstance: any = null;
      if (tripDirection === 'both') {
        const { data: returnRides } = await supabase
          .from('ride_instances').select('*')
          .eq('route_id', selectedRide.route_id).eq('ride_date', selectedRide.ride_date)
          .eq('direction', 'return').eq('status', 'scheduled')
          .order('departure_time').limit(1);
        returnRideInstance = returnRides?.[0] || null;
      }

      const bookingsToInsert = directions.map((dir) => {
        const isReturn = dir === 'return';
        const rideForDir = isReturn && returnRideInstance ? returnRideInstance : selectedRide;
        return {
          user_id: user.id,
          route_id: selectedRide.route_id,
          shuttle_id: rideForDir.shuttle_id,
          seats: 1,
          total_price: singlePrice,
          scheduled_date: rideForDir.ride_date,
          scheduled_time: rideForDir.departure_time,
          status: bookingStatus,
          payment_proof_url: proofUrl,
          waitlist_position: waitlistPos,
          custom_pickup_lat: isReturn ? dropoffLat : pickupLat,
          custom_pickup_lng: isReturn ? dropoffLng : pickupLng,
          custom_pickup_name: isReturn ? dropoffName : pickupName,
          custom_dropoff_lat: isReturn ? pickupLat : dropoffLat,
          custom_dropoff_lng: isReturn ? pickupLng : dropoffLng,
          custom_dropoff_name: isReturn ? pickupName : dropoffName,
          trip_direction: dir,
        };
      });

      const { error } = await supabase.from('bookings').insert(bookingsToInsert);
      if (error) throw error;

      if (usingBundle && activeBundlePurchase) {
        await supabase.from('bundle_purchases').update({
          rides_remaining: activeBundlePurchase.rides_remaining - directions.length,
        }).eq('id', activeBundlePurchase.id);
      }

      if (!asWaitlist) {
        await supabase.from('ride_instances').update({
          available_seats: selectedRide.available_seats - 1,
        }).eq('id', selectedRide.id);
        if (returnRideInstance) {
          await supabase.from('ride_instances').update({
            available_seats: returnRideInstance.available_seats - 1,
          }).eq('id', returnRideInstance.id);
        }
      }

      // Save location
      if (user && selectedRide.route_id) {
        const existing = savedLocations.find(sl =>
          sl.pickup_lat === pickupLat && sl.pickup_lng === pickupLng &&
          sl.dropoff_lat === dropoffLat && sl.dropoff_lng === dropoffLng
        );
        if (existing) {
          await supabase.from('saved_locations').update({ use_count: (existing.use_count || 0) + 1 }).eq('id', existing.id);
        } else {
          await supabase.from('saved_locations').insert({
            user_id: user.id,
            route_id: selectedRide.route_id,
            pickup_lat: pickupLat,
            pickup_lng: pickupLng,
            pickup_name: pickupName,
            dropoff_lat: dropoffLat,
            dropoff_lng: dropoffLng,
            dropoff_name: dropoffName,
            label: `${pickupName} → ${dropoffName}`,
          });
        }
      }

      toast({
        title: asWaitlist
          ? (lang === 'ar' ? 'تم إضافتك لقائمة الانتظار' : 'Added to waitlist')
          : usingBundle
          ? (lang === 'ar' ? 'تم الحجز من الباقة' : 'Booked from bundle')
          : (lang === 'ar' ? 'تم الحجز بنجاح' : 'Booking submitted'),
        description: asWaitlist
          ? (lang === 'ar' ? `ترتيبك: #${waitlistPos}` : `Your position: #${waitlistPos}`)
          : usingBundle
          ? (lang === 'ar' ? `متبقي ${activeBundlePurchase!.rides_remaining - 1} رحلة` : `${activeBundlePurchase!.rides_remaining - 1} rides remaining`)
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

  // --- Buy Bundle ---
  const handleBuyBundle = async (bundle: any) => {
    if (!user || !paymentProof) {
      toast({ title: lang === 'ar' ? 'أرفق إثبات الدفع' : 'Attach payment proof', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let proofUrl: string | null = null;
      if (paymentProof) {
        const ext = paymentProof.name.split('.').pop();
        const filePath = `instapay-proofs/${user.id}/bundle_${Date.now()}.${ext}`;
        const { uploadToBunny } = await import('@/lib/bunnyUpload');
        proofUrl = await uploadToBunny(paymentProof, filePath);
      }
      const expiresAt = new Date();
      if (bundle.bundle_type === 'weekly') expiresAt.setDate(expiresAt.getDate() + 7);
      else expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase.from('bundle_purchases').insert({
        user_id: user.id,
        bundle_id: bundle.id,
        route_id: bundle.route_id,
        rides_remaining: bundle.ride_count,
        rides_total: bundle.ride_count,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        payment_proof_url: proofUrl,
      });
      if (error) throw error;

      toast({
        title: lang === 'ar' ? 'تم شراء الباقة!' : 'Bundle purchased!',
        description: lang === 'ar' ? `${bundle.ride_count} رحلة متاحة` : `${bundle.ride_count} rides available`,
      });
      const { data: purchases } = await supabase.from('bundle_purchases').select('*')
        .eq('user_id', user.id).eq('route_id', bundle.route_id).eq('status', 'active')
        .gt('rides_remaining', 0).gt('expires_at', new Date().toISOString()).limit(1);
      setActiveBundlePurchase(purchases?.[0] || null);
      setPaymentProof(null); setPaymentPreview(null); setShowBundleSection(false);
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // Apply saved location
  const applySavedLocation = (saved: any) => {
    if (saved.pickup_lat && saved.pickup_lng) {
      const closest = findClosestStop({ lat: saved.pickup_lat, lng: saved.pickup_lng }, 'pickup');
      if (closest && haversineDistanceKm({ lat: saved.pickup_lat, lng: saved.pickup_lng }, { lat: closest.lat, lng: closest.lng }) < 0.5) {
        setPickupMode('stop');
        setSelectedPickupStop(closest);
      } else {
        setPickupMode('start');
        setSelectedPickupStop(null);
      }
    }
    if (saved.dropoff_lat && saved.dropoff_lng) {
      const closest = findClosestStop({ lat: saved.dropoff_lat, lng: saved.dropoff_lng }, 'dropoff');
      if (closest && haversineDistanceKm({ lat: saved.dropoff_lat, lng: saved.dropoff_lng }, { lat: closest.lat, lng: closest.lng }) < 0.5) {
        setDropoffMode('stop');
        setSelectedDropoffStop(closest);
      } else {
        setDropoffMode('end');
        setSelectedDropoffStop(null);
      }
    }
    toast({ title: lang === 'ar' ? 'تم تطبيق الموقع المحفوظ' : 'Saved location applied' });
  };

  const dateOptions = getDateOptions();

  // Map markers
  const mapMarkers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (selectedRide?.routes) {
    mapMarkers.push(
      { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng, label: 'A', color: 'green' },
      { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng, label: 'B', color: 'red' },
    );
    if (selectedPickupStop && pickupMode === 'stop') {
      mapMarkers.push({ lat: selectedPickupStop.lat, lng: selectedPickupStop.lng, label: '📍', color: 'green' });
    }
    if (selectedDropoffStop && dropoffMode === 'stop') {
      mapMarkers.push({ lat: selectedDropoffStop.lat, lng: selectedDropoffStop.lng, label: '📍', color: 'red' });
    }
    routeStops.forEach((stop: any) => {
      mapMarkers.push({ lat: stop.lat, lng: stop.lng, label: (stop.stop_order + 1).toString(), color: 'blue' });
    });
  }

  // --- Stop selector (matching Dashboard pattern) ---
  const renderStopSelector = (type: 'pickup' | 'dropoff') => {
    const isPickupType = type === 'pickup';
    const mode = isPickupType ? pickupMode : dropoffMode;
    const selectedStop = isPickupType ? selectedPickupStop : selectedDropoffStop;
    const startLabel = isPickupType
      ? (lang === 'ar' ? '🚏 نقطة الانطلاق' : '🚏 Starting Point')
      : (lang === 'ar' ? '🏁 نقطة الوصول' : '🏁 End Point');
    const stopLabel = lang === 'ar' ? '📍 نقطة توقف' : '📍 Bus Stop';
    const isStartMode = mode === 'start' || mode === 'end';

    const filteredStops = routeStops.filter((s: any) =>
      isPickupType ? (s.stop_type === 'pickup' || s.stop_type === 'both') : (s.stop_type === 'dropoff' || s.stop_type === 'both')
    );

    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm">
          <MapPin className={`w-4 h-4 ${isPickupType ? 'text-green-500' : 'text-destructive'}`} />
          {isPickupType ? (lang === 'ar' ? 'نقطة الركوب' : 'Pickup') : (lang === 'ar' ? 'نقطة النزول' : 'Dropoff')}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => {
            if (isPickupType) { setPickupMode('start'); setSelectedPickupStop(null); }
            else { setDropoffMode('end'); setSelectedDropoffStop(null); }
          }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isStartMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
            {startLabel}
          </button>
          {filteredStops.length > 0 && (
            <button onClick={() => {
              if (isPickupType) { setPickupMode('stop'); setSelectedPickupStop(null); }
              else { setDropoffMode('stop'); setSelectedDropoffStop(null); }
            }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${mode === 'stop' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
              {stopLabel}
            </button>
          )}
        </div>

        {isStartMode && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="font-medium text-xs">
              {isPickupType ? (lang === 'ar' ? selectedRide?.routes?.origin_name_ar : selectedRide?.routes?.origin_name_en) : (lang === 'ar' ? selectedRide?.routes?.destination_name_ar : selectedRide?.routes?.destination_name_en)}
            </p>
          </div>
        )}

        {mode === 'stop' && (
          <div className="space-y-2">
            <PlacesAutocomplete
              placeholder={isPickupType ? (lang === 'ar' ? 'ابحث عن موقعك...' : 'Search your location...') : (lang === 'ar' ? 'ابحث عن وجهتك...' : 'Search your destination...')}
              onSelect={(place) => handleSearchAndMatchStop(place, type)}
              iconColor={isPickupType ? 'text-green-500' : 'text-destructive'}
            />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredStops.map((stop: any) => (
                <button
                  key={stop.id}
                  onClick={() => {
                    if (isPickupType) setSelectedPickupStop(stop);
                    else setSelectedDropoffStop(stop);
                  }}
                  className={`w-full text-start px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-2 ${
                    selectedStop?.id === stop.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/50'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lang === 'ar' ? stop.name_ar : stop.name_en}</span>
                </button>
              ))}
            </div>
            {selectedStop && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium">{lang === 'ar' ? selectedStop.name_ar : selectedStop.name_en} ✓</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border sticky top-0 z-40 shrink-0 safe-area-top">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">{t('booking.title')}</h1>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="container mx-auto px-4 py-6 max-w-2xl safe-area-bottom pb-8">
        {step === 'browse' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <MapPin className="absolute start-3 top-3 h-5 w-5 text-green-500" />
                <Input
                  placeholder={lang === 'ar' ? 'من أين؟ (نقطة الركوب)' : 'From where? (Pickup)'}
                  className="ps-11 h-12 text-base rounded-xl"
                  value={searchPickup}
                  onChange={(e) => setSearchPickup(e.target.value)}
                />
              </div>
              <div className="relative">
                <MapPin className="absolute start-3 top-3 h-5 w-5 text-destructive" />
                <Input
                  placeholder={lang === 'ar' ? 'إلى أين؟ (نقطة النزول)' : 'To where? (Dropoff)'}
                  className="ps-11 h-12 text-base rounded-xl"
                  value={searchDropoff}
                  onChange={(e) => setSearchDropoff(e.target.value)}
                />
              </div>
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
                        {ride.direction === 'return' && (
                          <span className="text-xs ms-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {lang === 'ar' ? 'عودة' : 'Return'}
                          </span>
                        )}
                        {ride.direction === 'go' && (
                          <span className="text-xs ms-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            {lang === 'ar' ? 'ذهاب' : 'Going'}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="truncate">
                          {ride.direction === 'return'
                            ? (lang === 'ar' ? ride.routes?.destination_name_ar : ride.routes?.destination_name_en)
                            : (lang === 'ar' ? ride.routes?.origin_name_ar : ride.routes?.origin_name_en)}
                        </span>
                        <ArrowRight className={`w-4 h-4 shrink-0 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                        <MapPin className="w-4 h-4 text-destructive shrink-0" />
                        <span className="truncate">
                          {ride.direction === 'return'
                            ? (lang === 'ar' ? ride.routes?.origin_name_ar : ride.routes?.origin_name_en)
                            : (lang === 'ar' ? ride.routes?.destination_name_ar : ride.routes?.destination_name_en)}
                        </span>
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
                  <p className="text-xl font-bold text-primary">{dynamicPrice} EGP</p>
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
              </div>
              <div className="h-[280px]">
                <MapView
                  className="h-full"
                  markers={mapMarkers}
                  origin={selectedRide.routes ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng } : undefined}
                  destination={selectedRide.routes ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng } : undefined}
                  waypoints={routeStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                  showDirections={!!selectedRide.routes}
                  zoom={12}
                  showUserLocation={false}
                />
              </div>
            </div>

            {/* Saved Locations */}
            {savedLocations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  {lang === 'ar' ? 'المواقع السابقة' : 'Previous Locations'}
                </h3>
                <div className="space-y-2">
                  {savedLocations.map((sl) => (
                    <button
                      key={sl.id}
                      onClick={() => applySavedLocation(sl)}
                      className="w-full text-start bg-surface hover:bg-muted rounded-xl p-3 transition-colors border border-border"
                    >
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-secondary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {sl.pickup_name} → {sl.dropoff_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lang === 'ar' ? `استُخدم ${sl.use_count} مرة` : `Used ${sl.use_count} time${sl.use_count > 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pickup */}
            {renderStopSelector('pickup')}

            {/* Dropoff */}
            <div ref={dropoffRef}>
              {renderStopSelector('dropoff')}
            </div>

            {/* Trip Direction */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                {lang === 'ar' ? 'نوع الرحلة' : 'Trip Type'}
              </h3>
              {selectedRide.direction === 'go' ? (
                <div className="flex items-center gap-2 text-sm p-3 rounded-xl bg-surface border border-border">
                  <span className="font-medium text-foreground">{lang === 'ar' ? 'ذهاب فقط' : 'Going Only'}</span>
                  <span className="ms-auto font-bold text-primary">{dynamicPrice} EGP</span>
                </div>
              ) : selectedRide.direction === 'return' ? (
                <div className="flex items-center gap-2 text-sm p-3 rounded-xl bg-surface border border-border">
                  <span className="font-medium text-foreground">{lang === 'ar' ? 'عودة فقط' : 'Return Only'}</span>
                  <span className="ms-auto font-bold text-primary">{dynamicPrice} EGP</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'go' as const, labelAr: 'ذهاب فقط', labelEn: 'Going Only', priceMultiplier: 1 },
                    { value: 'return' as const, labelAr: 'عودة فقط', labelEn: 'Return Only', priceMultiplier: 1 },
                    { value: 'both' as const, labelAr: 'ذهاب وعودة', labelEn: 'Round Trip', priceMultiplier: 2 },
                  ]).map(opt => (
                    <button key={opt.value} onClick={() => setTripDirection(opt.value)}
                      className={`px-2 py-3 rounded-xl text-center border-2 transition-colors ${
                        tripDirection === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}>
                      <p className="text-sm font-medium">{lang === 'ar' ? opt.labelAr : opt.labelEn}</p>
                      <p className="text-xs mt-1 opacity-80">{dynamicPrice * opt.priceMultiplier} EGP</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Bundle */}
            {activeBundlePurchase && (
              <div className="bg-card border-2 border-secondary rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-secondary" />
                  {lang === 'ar' ? 'لديك باقة نشطة!' : 'You have an active bundle!'}
                </h3>
                <div className="bg-secondary/10 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'رحلات متبقية' : 'Rides remaining'}</p>
                      <p className="text-2xl font-bold text-secondary">{activeBundlePurchase.rides_remaining}/{activeBundlePurchase.rides_total}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'تنتهي في' : 'Expires'}</p>
                      <p className="text-sm font-medium text-foreground">{new Date(activeBundlePurchase.expires_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setUseBundle(!useBundle)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                    useBundle
                      ? 'bg-secondary text-secondary-foreground border-secondary'
                      : 'bg-card text-foreground border-border hover:border-secondary'
                  }`}
                >
                  {useBundle
                    ? (lang === 'ar' ? '✓ سيتم الخصم من الباقة' : '✓ Using bundle ride')
                    : (lang === 'ar' ? 'استخدم رحلة من الباقة' : 'Use a bundle ride')}
                </button>
              </div>
            )}

            {/* Available Bundles */}
            {availableBundles.length > 0 && !activeBundlePurchase && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <button
                  onClick={() => setShowBundleSection(!showBundleSection)}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-secondary" />
                    {lang === 'ar' ? 'باقات مخفضة' : 'Discounted Bundles'}
                  </h3>
                  <span className="text-xs text-secondary font-medium">
                    {lang === 'ar' ? `وفّر حتى ${Math.max(...availableBundles.map((b: any) => b.discount_percentage))}%` : `Save up to ${Math.max(...availableBundles.map((b: any) => b.discount_percentage))}%`}
                  </span>
                </button>

                {showBundleSection && (
                  <div className="space-y-3 pt-2">
                    {availableBundles.map((bundle: any) => {
                      const singlePrice = selectedRide.routes?.price || 0;
                      const bundlePricePerRide = bundle.price / bundle.ride_count;
                      const savings = (singlePrice * bundle.ride_count) - bundle.price;
                      return (
                        <div key={bundle.id} className="bg-surface rounded-xl p-4 border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-foreground">
                                {bundle.bundle_type === 'weekly'
                                  ? (lang === 'ar' ? 'باقة أسبوعية' : 'Weekly Bundle')
                                  : (lang === 'ar' ? 'باقة شهرية' : 'Monthly Bundle')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {bundle.ride_count} {lang === 'ar' ? 'رحلة' : 'rides'}
                              </p>
                            </div>
                            <div className="text-end">
                              <p className="text-xl font-bold text-primary">{bundle.price} EGP</p>
                              <p className="text-xs text-muted-foreground line-through">{singlePrice * bundle.ride_count} EGP</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-secondary/10 text-secondary font-medium px-2 py-1 rounded-full">
                              {lang === 'ar' ? `وفّر ${savings} جنيه` : `Save ${savings} EGP`}
                            </span>
                            <span className="text-muted-foreground">
                              {lang === 'ar' ? `${bundlePricePerRide.toFixed(0)} جنيه/رحلة` : `${bundlePricePerRide.toFixed(0)} EGP/ride`}
                            </span>
                          </div>
                          <Button
                            className="w-full"
                            variant="secondary"
                            size="sm"
                            disabled={loading || !paymentProof}
                            onClick={() => handleBuyBundle(bundle)}
                          >
                            <Package className="w-4 h-4 me-1" />
                            {lang === 'ar' ? 'شراء الباقة' : 'Buy Bundle'}
                          </Button>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground text-center">
                      {lang === 'ar' ? 'ارفع إثبات الدفع أدناه ثم اضغط "شراء الباقة"' : 'Upload payment proof below then click "Buy Bundle"'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* InstaPay Payment */}
            {!useBundle && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  {lang === 'ar' ? 'الدفع عبر InstaPay' : 'Pay via InstaPay'}
                </h3>
                <div className="bg-surface rounded-xl p-4 text-sm text-muted-foreground space-y-2">
                  <p>{lang === 'ar' ? 'حوّل المبلغ عبر InstaPay ثم ارفع لقطة شاشة للتحويل:' : 'Transfer the amount via InstaPay then upload a screenshot:'}</p>
                  <p className="font-bold text-foreground text-lg">{tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP</p>
                  {tripDirection === 'both' && <p className="text-xs text-muted-foreground">{lang === 'ar' ? '(ذهاب + عودة)' : '(Going + Return)'}</p>}
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

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePaymentFile} />

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
            )}

            {/* Summary & Book */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">
                  {tripDirection === 'both' ? (lang === 'ar' ? 'ذهاب وعودة' : 'Round Trip') : tripDirection === 'go' ? (lang === 'ar' ? 'ذهاب فقط' : 'Going Only') : (lang === 'ar' ? 'عودة فقط' : 'Return Only')}
                </span>
                {useBundle ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">{tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP</span>
                    <span className="text-lg font-bold text-secondary">{lang === 'ar' ? 'من الباقة' : 'Bundle'}</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-primary">{tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP</span>
                )}
              </div>
              {tripDirection === 'both' && !useBundle && (
                <p className="text-[10px] text-muted-foreground mb-2">{lang === 'ar' ? `${dynamicPrice} × 2 رحلة` : `${dynamicPrice} × 2 trips`}</p>
              )}

              {!isRideFull ? (
                <Button className="w-full mt-3" size="lg" onClick={() => handleBook(false)}
                  disabled={loading || !isPickupValid || !isDropoffValid || (!useBundle && !paymentProof)}>
                  {loading ? (
                    <><Loader2 className="w-4 h-4 me-1 animate-spin" />{lang === 'ar' ? 'جاري الحجز...' : 'Booking...'}</>
                  ) : useBundle ? (
                    <><Package className="w-4 h-4 me-1" />{lang === 'ar' ? 'احجز من الباقة' : 'Book from Bundle'}</>
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
        </div>
      </main>
    </div>
  );
};

export default BookRide;
