import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import MapView from '@/components/MapView';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import BottomNav from '@/components/BottomNav';
import { useBookingNotifications } from '@/hooks/useBookingNotifications';
import { useRideMessageNotifications } from '@/hooks/useRideMessageNotifications';
import {
  MapPin, Clock, Users, ArrowRight, Calendar, AlertCircle, Car,
  User as UserIcon, Loader2, CheckCircle2, XCircle, Navigation,
  Upload, Image as ImageIcon, ListOrdered, Phone, History, Package,
  Bookmark, Globe, LogOut, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/** Haversine distance in km */
const haversineDistanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/** Project point onto the closest position on line segment A→B (in lat/lng space) */
const closestPointOnSegment = (
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { lat: number; lng: number } => {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) return a; // segment is a point
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return { lat: a.lat + t * dy, lng: a.lng + t * dx };
};


type PointSelection = { lat: number; lng: number; name: string } | null;

const Dashboard = () => {
  useBookingNotifications();
  useRideMessageNotifications();
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Booking flow state
  const [step, setStep] = useState<'search' | 'results' | 'details'>('search');
  const [pickup, setPickup] = useState<PointSelection>(null);
  const [dropoff, setDropoff] = useState<PointSelection>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pricePerKm, setPricePerKm] = useState(5);

  // Ride instances
  const [rideInstances, setRideInstances] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [shuttleInfo, setShuttleInfo] = useState<any>(null);

  // Detail step states
  const [pickupMode, setPickupMode] = useState<'start' | 'nearby'>('start');
  const [customPickup, setCustomPickup] = useState<PointSelection>(null);
  const [validatingPickup, setValidatingPickup] = useState(false);
  const [pickupResult, setPickupResult] = useState<{ ok: boolean; minutes: number; onRoute: boolean } | null>(null);
  const [dropoffMode, setDropoffMode] = useState<'end' | 'nearby'>('end');
  const [customDropoff, setCustomDropoff] = useState<PointSelection>(null);
  const [validatingDropoff, setValidatingDropoff] = useState(false);
  const [dropoffResult, setDropoffResult] = useState<{ ok: boolean; minutes: number; onRoute: boolean } | null>(null);
  const [mapClickTarget, setMapClickTarget] = useState<'pickup' | 'dropoff'>('pickup');
  const [tripDirection, setTripDirection] = useState<'go' | 'return' | 'both'>('both');
  const [routeDirections, setRouteDirections] = useState<any>(null);
  const [nearestRoutePoint, setNearestRoutePoint] = useState<{ lat: number; lng: number } | null>(null);

  // Saved locations & bundles
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [availableBundles, setAvailableBundles] = useState<any[]>([]);
  const [activeBundlePurchase, setActiveBundlePurchase] = useState<any>(null);
  const [useBundle, setUseBundle] = useState(false);
  const [showBundleSection, setShowBundleSection] = useState(false);

  // Payment
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [instapayPhone, setInstapayPhone] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [drivingDistanceKm, setDrivingDistanceKm] = useState<number | null>(null);

  // Compute real driving distance between pickup & dropoff
  useEffect(() => {
    if (!pickup || !dropoff) { setDrivingDistanceKm(null); return; }
    if (typeof google === 'undefined' || !google?.maps?.DirectionsService) {
      setDrivingDistanceKm(haversineDistanceKm(pickup, dropoff));
      return;
    }
    const ds = new google.maps.DirectionsService();
    ds.route({ origin: pickup, destination: dropoff, travelMode: google.maps.TravelMode.DRIVING }, (res, status) => {
      if (status === 'OK' && res?.routes?.[0]?.legs?.[0]?.distance?.value) {
        setDrivingDistanceKm(res.routes[0].legs[0].distance.value / 1000);
      } else {
        setDrivingDistanceKm(haversineDistanceKm(pickup, dropoff));
      }
    });
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // Estimated price from real driving distance
  const estimatedPrice = drivingDistanceKm !== null
    ? Math.max(10, Math.round(drivingDistanceKm * pricePerKm))
    : null;

  // Fetch user profile, roles, settings
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: profileData }, { data: rolesData }, { data: settingsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('app_settings').select('value').eq('key', 'price_per_km').single(),
      ]);
      setProfile(profileData);
      if (settingsData?.value) setPricePerKm(parseFloat(settingsData.value));
      const roles = (rolesData || []).map(r => r.role);
      setIsAdmin(roles.includes('admin'));
      const driverFlag = profileData?.user_type === 'driver' || roles.includes('moderator');
      setIsDriver(driverFlag);
      if (driverFlag) { navigate('/driver-dashboard'); return; }
    };
    fetchData();

    supabase.from('app_settings').select('value').eq('key', 'instapay_phone').single()
      .then(({ data }) => { if (data) setInstapayPhone(data.value); });
  }, [user]);

  // Date options
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

  // Search for rides when user has both pickup + dropoff
  const searchRides = async () => {
    if (!pickup || !dropoff) return;
    setLoadingRides(true);
    setStep('results');

    const { data } = await supabase
      .from('ride_instances')
      .select('*, routes(name_en, name_ar, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, price, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)')
      .eq('ride_date', selectedDate)
      .eq('status', 'scheduled')
      .order('departure_time');

    if (data && data.length > 0) {
      // Filter rides where pickup is near origin and dropoff is near destination (within 10km)
      const matchedRides = data.filter(ri => {
        const route = ri.routes;
        if (!route) return false;
        const pickupToOrigin = haversineDistanceKm(pickup, { lat: route.origin_lat, lng: route.origin_lng });
        const pickupToDest = haversineDistanceKm(pickup, { lat: route.destination_lat, lng: route.destination_lng });
        const dropoffToOrigin = haversineDistanceKm(dropoff, { lat: route.origin_lat, lng: route.origin_lng });
        const dropoffToDest = haversineDistanceKm(dropoff, { lat: route.destination_lat, lng: route.destination_lng });

        // Match "go" direction: pickup near origin, dropoff near destination
        const goMatch = pickupToOrigin < 10 && dropoffToDest < 10;
        // Match "return" direction: pickup near destination, dropoff near origin
        const returnMatch = pickupToDest < 10 && dropoffToOrigin < 10;
        return goMatch || returnMatch;
      });

      // Enrich with driver/shuttle info
      const driverIds = [...new Set(matchedRides.map(r => r.driver_id))];
      const shuttleIds = [...new Set(matchedRides.map(r => r.shuttle_id))];
      const [{ data: profiles }, { data: shuttles }] = await Promise.all([
        driverIds.length > 0 ? supabase.from('profiles').select('user_id, full_name, avatar_url, phone').in('user_id', driverIds) : { data: [] },
        shuttleIds.length > 0 ? supabase.from('shuttles').select('id, vehicle_model, vehicle_plate, capacity').in('id', shuttleIds) : { data: [] },
      ]);
      const pMap: Record<string, any> = {};
      (profiles || []).forEach(p => { pMap[p.user_id] = p; });
      const sMap: Record<string, any> = {};
      (shuttles || []).forEach(s => { sMap[s.id] = s; });
      setRideInstances(matchedRides.map(r => ({ ...r, driver_profile: pMap[r.driver_id], shuttle_info: sMap[r.shuttle_id] })));
    } else {
      setRideInstances([]);
    }
    setLoadingRides(false);
  };

  // Route directions for on-route checking
  useEffect(() => {
    if (!selectedRide?.routes || typeof google === 'undefined' || !google?.maps?.DirectionsService) { setRouteDirections(null); return; }

    const isReturnRide = selectedRide.direction === 'return';
    const origin = isReturnRide
      ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng }
      : { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng };
    const destination = isReturnRide
      ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
      : { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng };

    const ds = new google.maps.DirectionsService();
    ds.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) setRouteDirections(result);
      else setRouteDirections(null);
    });
  }, [selectedRide?.route_id, selectedRide?.direction]);

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
    setUseBundle(false);
    setTripDirection('both');
    setStep('details');

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

  // Validate custom point using Google Directions driving distance
  /** Find nearest point on route polyline (straight-line) for the visual connection line */
  const findNearestRoutePoint = (point: { lat: number; lng: number }): { nearest: { lat: number; lng: number } | null } => {
    let nearest: { lat: number; lng: number } | null = null;
    let minDist = Infinity;
    if (routeDirections) {
      const path = routeDirections.routes?.[0]?.overview_path;
      if (path && path.length > 1) {
        for (let i = 0; i < path.length - 1; i++) {
          const a = { lat: path[i].lat(), lng: path[i].lng() };
          const b = { lat: path[i + 1].lat(), lng: path[i + 1].lng() };
          const projected = closestPointOnSegment(point, a, b);
          const d = haversineDistanceKm(point, projected);
          if (d < minDist) { minDist = d; nearest = projected; }
        }
      } else if (path && path.length === 1) {
        nearest = { lat: path[0].lat(), lng: path[0].lng() };
      }
    }
    if (!nearest && selectedRide?.routes) {
      const dO = haversineDistanceKm(point, { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng });
      const dD = haversineDistanceKm(point, { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng });
      nearest = dO < dD
        ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
        : { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng };
    }
    return { nearest };
  };

  const MAX_DISTANCE_KM = 0.7;
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

    const { nearest } = findNearestRoutePoint(point);
    setNearestRoutePoint(nearest);

    const isReturnRide = selectedRide.direction === 'return';
    const origin = isReturnRide
      ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng }
      : { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng };
    const destination = isReturnRide
      ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
      : { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng };

    const getRouteDistanceKm = (result: google.maps.DirectionsResult | null) =>
      (result?.routes?.[0]?.legs || []).reduce((sum, leg) => sum + ((leg.distance?.value || 0) / 1000), 0);

    try {
      if (typeof google === 'undefined' || !google?.maps?.DirectionsService) throw new Error('Directions unavailable');

      const directionsService = new google.maps.DirectionsService();
      const getDirections = (waypoints?: google.maps.DirectionsWaypoint[]) =>
        new Promise<google.maps.DirectionsResult | null>((resolve) => {
          directionsService.route({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            waypoints,
            optimizeWaypoints: false,
          }, (res, status) => {
            resolve(status === 'OK' ? res : null);
          });
        });

      const baseResult = routeDirections || await getDirections();
      const waypointResult = await getDirections([{ location: point, stopover: true }]);

      const baseDistanceKm = getRouteDistanceKm(baseResult);
      const withWaypointDistanceKm = getRouteDistanceKm(waypointResult);
      const extraDistanceKm = Math.max(0, withWaypointDistanceKm - baseDistanceKm);
      const ok = extraDistanceKm <= MAX_DISTANCE_KM;
      const onRoute = extraDistanceKm <= 0.1;

      setResult({ ok, minutes: Math.round(extraDistanceKm * 10) / 10, onRoute });

      if (!ok) {
        toast({
          title: lang === 'ar' ? 'موقع بعيد عن المسار' : 'Too far from route',
          description: lang === 'ar'
            ? 'هذا الموقع بعيد جداً عن المسار، يرجى اختيار موقع أقرب'
            : 'This location is too far from the route, please pick a closer spot',
          variant: 'destructive',
        });
      } else {
        toast({
          title: lang === 'ar' ? '✅ موقع مقبول' : '✅ Location accepted',
          description: lang === 'ar'
            ? `إضافة هذا الموقع تزيد الرحلة ${extraDistanceKm.toFixed(1)} كم`
            : `This point adds ${extraDistanceKm.toFixed(1)} km to the route`,
        });
      }
    } catch {
      const fallbackKm = nearest ? haversineDistanceKm(point, nearest) * 2 : 999;
      const ok = fallbackKm <= MAX_DISTANCE_KM;
      const onRoute = fallbackKm <= 0.1;
      setResult({ ok, minutes: Math.round(fallbackKm * 10) / 10, onRoute });
    } finally {
      setValidating(false);
    }
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

  const isPickupValid = pickupMode === 'start' ? true : (!!customPickup && pickupResult?.ok === true);
  const isDropoffValid = dropoffMode === 'end' ? true : (!!customDropoff && dropoffResult?.ok === true);

  // Dynamic price calculation using real driving distance
  const [detailDrivingDistKm, setDetailDrivingDistKm] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedRide?.routes) { setDetailDrivingDistKm(null); return; }
    const route = selectedRide.routes;
    const pLat = pickupMode === 'start' ? route.origin_lat : (customPickup?.lat ?? route.origin_lat);
    const pLng = pickupMode === 'start' ? route.origin_lng : (customPickup?.lng ?? route.origin_lng);
    const dLat = dropoffMode === 'end' ? route.destination_lat : (customDropoff?.lat ?? route.destination_lat);
    const dLng = dropoffMode === 'end' ? route.destination_lng : (customDropoff?.lng ?? route.destination_lng);
    const from = { lat: pLat, lng: pLng };
    const to = { lat: dLat, lng: dLng };
    if (typeof google === 'undefined' || !google?.maps?.DirectionsService) {
      setDetailDrivingDistKm(haversineDistanceKm(from, to));
      return;
    }
    const ds = new google.maps.DirectionsService();
    ds.route({ origin: from, destination: to, travelMode: google.maps.TravelMode.DRIVING }, (res, status) => {
      if (status === 'OK' && res?.routes?.[0]?.legs?.[0]?.distance?.value) {
        setDetailDrivingDistKm(res.routes[0].legs[0].distance.value / 1000);
      } else {
        setDetailDrivingDistKm(haversineDistanceKm(from, to));
      }
    });
  }, [selectedRide?.route_id, pickupMode, dropoffMode, customPickup?.lat, customPickup?.lng, customDropoff?.lat, customDropoff?.lng]);

  const dynamicPrice = detailDrivingDistKm !== null ? Math.max(10, Math.round(detailDrivingDistKm * pricePerKm)) : 0;

  const isRideFull = selectedRide?.available_seats === 0;
  const isNearbyMode = pickupMode === 'nearby' || dropoffMode === 'nearby';

  // Payment file handler
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

  // Handle sign out
  const handleSignOut = async () => { await signOut(); navigate('/'); };

  // Booking handler
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
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('instapay-proofs').upload(filePath, paymentProof);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('instapay-proofs').getPublicUrl(filePath);
        proofUrl = urlData?.publicUrl || filePath;
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
      const pickupLat = pickupMode === 'start' ? route.origin_lat : customPickup?.lat;
      const pickupLng = pickupMode === 'start' ? route.origin_lng : customPickup?.lng;
      const pickupName = pickupMode === 'start' ? (lang === 'ar' ? route.origin_name_ar : route.origin_name_en) : customPickup?.name;
      const dropoffLat = dropoffMode === 'end' ? route.destination_lat : customDropoff?.lat;
      const dropoffLng = dropoffMode === 'end' ? route.destination_lng : customDropoff?.lng;
      const dropoffName = dropoffMode === 'end' ? (lang === 'ar' ? route.destination_name_ar : route.destination_name_en) : customDropoff?.name;

      const basePrice = dynamicPrice;

      if (tripDirection === 'both') {
        // Create TWO separate bookings for round trips
        const goPrice = usingBundle ? 0 : basePrice;
        const returnPrice = usingBundle ? 0 : basePrice;

        const commonFields = {
          user_id: user.id,
          route_id: selectedRide.route_id,
          shuttle_id: selectedRide.shuttle_id,
          seats: 1,
          scheduled_date: selectedRide.ride_date,
          scheduled_time: selectedRide.departure_time,
          status: asWaitlist ? 'waitlist' : (usingBundle ? 'confirmed' : 'pending'),
          payment_proof_url: proofUrl,
          waitlist_position: waitlistPos,
        };

        // GO booking: pickup → dropoff as entered
        const { error: goErr } = await supabase.from('bookings').insert({
          ...commonFields,
          total_price: goPrice,
          custom_pickup_lat: pickupLat,
          custom_pickup_lng: pickupLng,
          custom_pickup_name: pickupName,
          custom_dropoff_lat: dropoffLat,
          custom_dropoff_lng: dropoffLng,
          custom_dropoff_name: dropoffName,
          trip_direction: 'go',
        });
        if (goErr) throw goErr;

        // RETURN booking: swap pickup ↔ dropoff
        const { error: retErr } = await supabase.from('bookings').insert({
          ...commonFields,
          total_price: returnPrice,
          custom_pickup_lat: dropoffLat,
          custom_pickup_lng: dropoffLng,
          custom_pickup_name: dropoffName,
          custom_dropoff_lat: pickupLat,
          custom_dropoff_lng: pickupLng,
          custom_dropoff_name: pickupName,
          trip_direction: 'return',
        });
        if (retErr) throw retErr;
      } else {
        const totalPrice = usingBundle ? 0 : basePrice;
        const { error } = await supabase.from('bookings').insert({
          user_id: user.id,
          route_id: selectedRide.route_id,
          shuttle_id: selectedRide.shuttle_id,
          seats: 1,
          total_price: totalPrice,
          scheduled_date: selectedRide.ride_date,
          scheduled_time: selectedRide.departure_time,
          status: asWaitlist ? 'waitlist' : (usingBundle ? 'confirmed' : 'pending'),
          payment_proof_url: proofUrl,
          waitlist_position: waitlistPos,
          custom_pickup_lat: pickupLat,
          custom_pickup_lng: pickupLng,
          custom_pickup_name: pickupName,
          custom_dropoff_lat: dropoffLat,
          custom_dropoff_lng: dropoffLng,
          custom_dropoff_name: dropoffName,
          trip_direction: tripDirection,
        });
        if (error) throw error;
      }

      if (usingBundle && activeBundlePurchase) {
        await supabase.from('bundle_purchases').update({
          rides_remaining: activeBundlePurchase.rides_remaining - (tripDirection === 'both' ? 2 : 1),
        }).eq('id', activeBundlePurchase.id);
      }

      if (!asWaitlist) {
        await supabase.from('ride_instances').update({
          available_seats: selectedRide.available_seats - 1,
        }).eq('id', selectedRide.id);
      }

      // Save location
      if (user && selectedRide.route_id) {
        const existing = savedLocations.find(sl =>
          sl.pickup_lat === pickupLat && sl.pickup_lng === pickupLng &&
          sl.dropoff_lat === dropoffLat && sl.dropoff_lng === dropoffLng
        );
        if (existing) {
          await supabase.from('saved_locations').update({ use_count: existing.use_count + 1 }).eq('id', existing.id);
        } else {
          await supabase.from('saved_locations').insert({
            user_id: user.id, route_id: selectedRide.route_id,
            pickup_lat: pickupLat, pickup_lng: pickupLng, pickup_name: pickupName,
            dropoff_lat: dropoffLat, dropoff_lng: dropoffLng, dropoff_name: dropoffName,
            label: `${pickupName} → ${dropoffName}`,
          });
        }
      }

      toast({
        title: asWaitlist
          ? (lang === 'ar' ? 'تم إضافتك لقائمة الانتظار' : 'Added to waitlist')
          : usingBundle ? (lang === 'ar' ? 'تم الحجز من الباقة' : 'Booked from bundle')
          : (lang === 'ar' ? 'تم الحجز بنجاح' : 'Booking submitted'),
      });
      navigate('/my-bookings');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setUploadingProof(false);
    }
  };

  // Buy bundle
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
        const filePath = `${user.id}/bundle_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('instapay-proofs').upload(filePath, paymentProof);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('instapay-proofs').getPublicUrl(filePath);
        proofUrl = urlData?.publicUrl || filePath;
      }
      const expiresAt = new Date();
      if (bundle.bundle_type === 'weekly') expiresAt.setDate(expiresAt.getDate() + 7);
      else expiresAt.setDate(expiresAt.getDate() + 30);
      const { error } = await supabase.from('bundle_purchases').insert({
        user_id: user.id, bundle_id: bundle.id, route_id: bundle.route_id,
        rides_remaining: bundle.ride_count, rides_total: bundle.ride_count,
        expires_at: expiresAt.toISOString(), status: 'active', payment_proof_url: proofUrl,
      });
      if (error) throw error;
      toast({ title: lang === 'ar' ? 'تم شراء الباقة!' : 'Bundle purchased!' });
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
      const isDefault = saved.pickup_lat === selectedRide?.routes?.origin_lat && saved.pickup_lng === selectedRide?.routes?.origin_lng;
      if (isDefault) { setPickupMode('start'); setCustomPickup(null); setPickupResult(null); }
      else { setPickupMode('nearby'); setCustomPickup({ lat: saved.pickup_lat, lng: saved.pickup_lng, name: saved.pickup_name }); setPickupResult({ ok: true, minutes: 0, onRoute: true }); }
    }
    if (saved.dropoff_lat && saved.dropoff_lng) {
      const isDefault = saved.dropoff_lat === selectedRide?.routes?.destination_lat && saved.dropoff_lng === selectedRide?.routes?.destination_lng;
      if (isDefault) { setDropoffMode('end'); setCustomDropoff(null); setDropoffResult(null); }
      else { setDropoffMode('nearby'); setCustomDropoff({ lat: saved.dropoff_lat, lng: saved.dropoff_lng, name: saved.dropoff_name }); setDropoffResult({ ok: true, minutes: 0, onRoute: true }); }
    }
    toast({ title: lang === 'ar' ? 'تم تطبيق الموقع المحفوظ' : 'Saved location applied' });
  };

  const dateOptions = getDateOptions();

  // Map markers
  const mapMarkers: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' }[] = [];
  if (step === 'search') {
    if (pickup) mapMarkers.push({ lat: pickup.lat, lng: pickup.lng, label: 'A', color: 'green' });
    if (dropoff) mapMarkers.push({ lat: dropoff.lat, lng: dropoff.lng, label: 'B', color: 'red' });
  }
  if (step === 'details' && selectedRide?.routes) {
    mapMarkers.push(
      { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng, label: 'A', color: 'green' },
      { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng, label: 'B', color: 'red' },
    );
    if (customPickup && pickupMode === 'nearby') mapMarkers.push({ lat: customPickup.lat, lng: customPickup.lng, label: '📍', color: 'green' });
    if (customDropoff && dropoffMode === 'nearby') mapMarkers.push({ lat: customDropoff.lat, lng: customDropoff.lng, label: '📍', color: 'red' });
  }

  // Point selector renderer
  const renderPointSelector = (
    type: 'pickup' | 'dropoff',
    mode: 'start' | 'end' | 'nearby',
    setMode: (m: any) => void,
    customPoint: PointSelection,
    validating: boolean,
    result: { ok: boolean; minutes: number; onRoute: boolean } | null,
  ) => {
    const isPickupType = type === 'pickup';
    const startLabel = isPickupType ? (lang === 'ar' ? '🚏 نقطة الانطلاق' : '🚏 Starting Point') : (lang === 'ar' ? '🏁 نقطة الوصول' : '🏁 End Point');
    const nearbyLabel = lang === 'ar' ? '📍 اختر من الخريطة' : '📍 Pick on map';
    const isStartMode = mode === 'start' || mode === 'end';

    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm">
          <MapPin className={`w-4 h-4 ${isPickupType ? 'text-green-500' : 'text-destructive'}`} />
          {isPickupType ? (lang === 'ar' ? 'نقطة الركوب' : 'Pickup') : (lang === 'ar' ? 'نقطة النزول' : 'Dropoff')}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => {
            if (isPickupType) { setMode('start'); setCustomPickup(null); setPickupResult(null); }
            else { setMode('end'); setCustomDropoff(null); setDropoffResult(null); }
          }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isStartMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
            {startLabel}
          </button>
          <button onClick={() => {
            setMode('nearby'); setMapClickTarget(type);
            if (isPickupType) { setCustomPickup(null); setPickupResult(null); }
            else { setCustomDropoff(null); setDropoffResult(null); }
          }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${mode === 'nearby' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}>
            {nearbyLabel}
          </button>
        </div>

        {isStartMode && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 text-green-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="font-medium text-xs">
              {isPickupType ? (lang === 'ar' ? selectedRide?.routes?.origin_name_ar : selectedRide?.routes?.origin_name_en) : (lang === 'ar' ? selectedRide?.routes?.destination_name_ar : selectedRide?.routes?.destination_name_en)}
            </p>
          </div>
        )}

        {mode === 'nearby' && (
          <div className="space-y-2">
            <PlacesAutocomplete
              placeholder={isPickupType ? (lang === 'ar' ? 'ابحث عن موقع الركوب...' : 'Search pickup...') : (lang === 'ar' ? 'ابحث عن موقع النزول...' : 'Search dropoff...')}
              onSelect={(place) => { setMapClickTarget(type); validateCustomPoint({ lat: place.lat, lng: place.lng, name: place.name }, type); }}
              iconColor={isPickupType ? 'text-green-500' : 'text-destructive'}
            />
            {validating && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />{lang === 'ar' ? 'جاري التحقق...' : 'Checking...'}</div>}
            {customPoint && result && (
              <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
                {result.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                <div className="flex-1 min-w-0">
                  <span className="font-medium block truncate">{customPoint.name}</span>
                  <span className="text-[10px] opacity-75">
                    {result.ok
                      ? (lang === 'ar' ? `${result.minutes} كم زيادة على المسار ✓` : `${result.minutes} km added to route ✓`)
                      : (lang === 'ar' ? 'بعيد جداً عن المسار' : 'Too far from route')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0 z-10">
        <div className="flex items-center gap-2">
          {step !== 'search' && (
            <Button variant="ghost" size="sm" className="rounded-full gap-1" onClick={() => {
              if (step === 'details') { setStep('results'); setSelectedRide(null); setRouteDirections(null); setNearestRoutePoint(null); setCustomPickup(null); setCustomDropoff(null); setPickupResult(null); setDropoffResult(null); }
              else { setStep('search'); setRideInstances([]); }
            }}>
              <Back className="w-5 h-5" />
              <span className="text-sm">{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </Button>
          )}
          <Link to="/" className="text-xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Shield className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="rounded-full p-2 hover:bg-muted transition-colors">
            <Globe className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Map section - fills remaining space above card */}
      <div className="flex-1 min-h-0 relative">
        <MapView
          className="h-full w-full rounded-none"
          markers={mapMarkers}
          origin={step === 'details' && selectedRide?.routes ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng } : (pickup && dropoff ? pickup : undefined)}
          destination={step === 'details' && selectedRide?.routes ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng } : (pickup && dropoff ? dropoff : undefined)}
          showDirections={step === 'details' ? !!selectedRide?.routes : (!!pickup && !!dropoff)}
          center={
            step === 'details' && selectedRide?.routes && mapClickTarget === 'dropoff' && dropoffMode === 'nearby'
              ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng }
              : step === 'details' && selectedRide?.routes && mapClickTarget === 'pickup' && pickupMode === 'nearby'
              ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
              : undefined
          }
          zoom={step === 'details' && isNearbyMode ? 14 : 12}
          showUserLocation
          onMapClick={step === 'details' && isNearbyMode ? handleMapClick : undefined}
          connectionLine={
            nearestRoutePoint && (customPickup || customDropoff)
              ? {
                  from: (customPickup && pickupMode === 'nearby' ? customPickup : customDropoff) || { lat: 0, lng: 0 },
                  to: nearestRoutePoint,
                  color: (pickupResult?.ok === false || dropoffResult?.ok === false) ? '#EF4444' : '#22C55E',
                }
              : null
          }
        />
        {/* Tap-on-map hint when nearby mode is active */}
        {step === 'details' && isNearbyMode && (
          <div className="absolute top-3 inset-x-0 flex justify-center z-10 pointer-events-none">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg text-xs font-medium flex items-center gap-2 animate-pulse">
              <Navigation className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'اضغط على الخريطة لاختيار الموقع' : 'Tap on the map to pick a location'}
            </div>
          </div>
        )}
      </div>

      {/* Bottom card - full width */}
      <div className="shrink-0 max-h-[45vh] overflow-y-auto bg-card border-t border-border pb-16">
        {step === 'search' && (
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              {lang === 'ar' ? 'إلى أين تريد الذهاب؟' : 'Where are you going?'}
            </h2>

            {/* Pickup */}
            <div className="space-y-2">
              <PlacesAutocomplete
                placeholder={lang === 'ar' ? 'من أين؟ (نقطة الركوب)' : 'From where? (Pickup)'}
                onSelect={(place) => setPickup(place)}
                value={pickup?.name || ''}
                iconColor="text-green-500"
              />
              <PlacesAutocomplete
                placeholder={lang === 'ar' ? 'إلى أين؟ (نقطة النزول)' : 'To where? (Dropoff)'}
                onSelect={(place) => setDropoff(place)}
                value={dropoff?.name || ''}
                iconColor="text-destructive"
              />
            </div>

            {/* Date selector */}
            <div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateOptions.slice(0, 5).map((opt) => (
                  <button key={opt.date} onClick={() => setSelectedDate(opt.date)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${
                      selectedDate === opt.date
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated price */}
            {estimatedPrice && (
              <div className="flex items-center justify-between bg-surface rounded-xl p-3">
                <span className="text-sm text-muted-foreground">{lang === 'ar' ? 'السعر المقدّر' : 'Estimated price'}</span>
                <span className="text-lg font-bold text-primary">{estimatedPrice} EGP</span>
              </div>
            )}

            {/* Search button */}
            <Button className="w-full h-12 text-base rounded-xl" onClick={searchRides}
              disabled={!pickup || !dropoff || loadingRides}>
              {loadingRides ? (
                <><Loader2 className="w-4 h-4 me-2 animate-spin" />{lang === 'ar' ? 'جاري البحث...' : 'Searching...'}</>
              ) : (
                lang === 'ar' ? 'ابحث عن رحلة' : 'Search Rides'
              )}
            </Button>
          </div>
        )}

        {step === 'results' && (
          <div className="p-4 space-y-3">
            <h2 className="text-lg font-bold text-foreground">
              {lang === 'ar' ? 'الرحلات المتاحة' : 'Available Rides'}
            </h2>

            {loadingRides ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                {lang === 'ar' ? 'جاري البحث...' : 'Searching...'}
              </div>
            ) : rideInstances.length > 0 ? (
              <div className="space-y-2">
                {rideInstances.map((ride) => (
                  <button key={ride.id} onClick={() => selectRide(ride)}
                    className="w-full text-start bg-card border border-border rounded-xl p-4 hover:border-secondary/40 hover:shadow-card-hover transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Car className="w-3 h-3" />
                          <span>{ride.shuttle_info?.vehicle_model}</span>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-lg font-bold text-primary">
                          {estimatedPrice ?? '...'} EGP
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                      <span className="flex-1 break-words">
                        {ride.direction === 'return'
                          ? (lang === 'ar' ? ride.routes?.destination_name_ar : ride.routes?.destination_name_en)
                          : (lang === 'ar' ? ride.routes?.origin_name_ar : ride.routes?.origin_name_en)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 text-destructive shrink-0" />
                      <span className="flex-1 break-words">
                        {ride.direction === 'return'
                          ? (lang === 'ar' ? ride.routes?.origin_name_ar : ride.routes?.origin_name_en)
                          : (lang === 'ar' ? ride.routes?.destination_name_ar : ride.routes?.destination_name_en)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />{ride.departure_time?.slice(0, 5)}
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${ride.available_seats <= 3 ? 'text-destructive' : 'text-green-600'}`}>
                        <Users className="w-3 h-3" />
                        {ride.available_seats}/{ride.total_seats}
                      </span>
                      {ride.direction === 'return' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium text-[10px]">
                          {lang === 'ar' ? 'عودة' : 'Return'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">
                  {lang === 'ar' ? 'لا توجد رحلات متاحة لهذا المسار' : 'No rides available for this route'}
                </p>
                <Button size="sm" onClick={() => navigate('/request-route', {
                  state: {
                    origin: pickup ? { name: pickup.name || '', lat: pickup.lat, lng: pickup.lng } : undefined,
                    destination: dropoff ? { name: dropoff.name || '', lat: dropoff.lat, lng: dropoff.lng } : undefined,
                  }
                })}>{lang === 'ar' ? 'اطلب هذا المسار' : 'Request this route'}</Button>
              </div>
            )}
          </div>
        )}

        {step === 'details' && selectedRide && (
          <div className="p-4 space-y-4">
            {/* Driver & Vehicle */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {driverProfile?.avatar_url ? (
                  <img src={driverProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground">{driverProfile?.full_name || (lang === 'ar' ? 'سائق' : 'Driver')}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Car className="w-3 h-3" />
                  <span>{shuttleInfo?.vehicle_model} · {shuttleInfo?.vehicle_plate}</span>
                </div>
              </div>
              <div className="text-end">
                <p className="text-xl font-bold text-primary">{dynamicPrice} EGP</p>
                <p className="text-[10px] text-muted-foreground">{selectedRide.departure_time?.slice(0, 5)}</p>
              </div>
            </div>

            {/* Saved locations */}
            {savedLocations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <History className="w-3 h-3" />{lang === 'ar' ? 'مواقع سابقة' : 'Previous'}
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {savedLocations.slice(0, 3).map(sl => (
                    <button key={sl.id} onClick={() => applySavedLocation(sl)}
                      className="bg-surface hover:bg-muted rounded-lg px-3 py-1.5 text-[10px] border border-border whitespace-nowrap">
                      {sl.pickup_name?.split(',')[0]} → {sl.dropoff_name?.split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pickup & Dropoff */}
            {renderPointSelector('pickup', pickupMode, setPickupMode, customPickup, validatingPickup, pickupResult)}
            {renderPointSelector('dropoff', dropoffMode, setDropoffMode, customDropoff, validatingDropoff, dropoffResult)}

            {/* Trip Direction */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'go' as const, labelAr: 'ذهاب', labelEn: 'Going', mult: 1 },
                { value: 'return' as const, labelAr: 'عودة', labelEn: 'Return', mult: 1 },
                { value: 'both' as const, labelAr: 'ذهاب وعودة', labelEn: 'Round Trip', mult: 2 },
              ]).map(opt => (
                <button key={opt.value} onClick={() => setTripDirection(opt.value)}
                  className={`px-2 py-2.5 rounded-xl text-center border-2 transition-colors ${
                    tripDirection === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  }`}>
                  <p className="text-xs font-medium">{lang === 'ar' ? opt.labelAr : opt.labelEn}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{dynamicPrice * opt.mult} EGP</p>
                </button>
              ))}
            </div>

            {/* Active Bundle */}
            {activeBundlePurchase && (
              <button
                onClick={() => setUseBundle(!useBundle)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border-2 transition-colors flex items-center gap-2 ${
                  useBundle ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-card text-foreground border-border hover:border-secondary'
                }`}>
                <Package className="w-4 h-4" />
                {useBundle
                  ? (lang === 'ar' ? `✓ من الباقة (${activeBundlePurchase.rides_remaining} متبقي)` : `✓ Using bundle (${activeBundlePurchase.rides_remaining} left)`)
                  : (lang === 'ar' ? `استخدم الباقة (${activeBundlePurchase.rides_remaining} متبقي)` : `Use bundle (${activeBundlePurchase.rides_remaining} left)`)}
              </button>
            )}

            {/* Payment */}
            {!useBundle && (
              <div className="space-y-3">
                <div className="bg-surface rounded-xl p-3 text-sm space-y-1">
                  <p className="text-muted-foreground text-xs">{lang === 'ar' ? 'حوّل عبر InstaPay:' : 'Transfer via InstaPay:'}</p>
                  <p className="font-bold text-foreground">{tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP</p>
                  {instapayPhone && <p className="font-mono text-xs" dir="ltr">{lang === 'ar' ? 'إلى: ' : 'To: '}{instapayPhone}</p>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePaymentFile} />
                {paymentPreview ? (
                  <div className="space-y-2">
                    <img src={paymentPreview} alt="" className="w-full h-32 object-contain rounded-lg border border-border bg-muted" />
                    <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3 h-3 me-1" />{lang === 'ar' ? 'تغيير' : 'Change'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-16 border-dashed border-2 flex-col gap-1"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'ارفع إثبات InstaPay' : 'Upload InstaPay proof'}</span>
                  </Button>
                )}
              </div>
            )}

            {/* Book button */}
            {!isRideFull ? (
              <Button className="w-full h-12 text-base rounded-xl" onClick={() => handleBook(false)}
                disabled={loading || !isPickupValid || !isDropoffValid || (!useBundle && !paymentProof)}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 me-1 animate-spin" />{lang === 'ar' ? 'جاري الحجز...' : 'Booking...'}</>
                ) : (
                  lang === 'ar' ? `تأكيد الحجز · ${tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP` : `Confirm · ${tripDirection === 'both' ? dynamicPrice * 2 : dynamicPrice} EGP`
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-destructive font-medium p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="w-3 h-3" />{lang === 'ar' ? 'مكتمل' : 'Full'}
                </div>
                <Button className="w-full" variant="secondary" onClick={() => handleBook(true)}
                  disabled={loading || !isPickupValid || !isDropoffValid}>
                  <ListOrdered className="w-4 h-4 me-1" />
                  {lang === 'ar' ? 'قائمة الانتظار' : 'Join Waitlist'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
};

export default Dashboard;
