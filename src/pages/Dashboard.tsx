import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
const MapView = lazy(() => import("@/components/MapView"));
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import BottomNav from "@/components/BottomNav";
import {
  MapPin,
  Clock,
  Users,
  ArrowRight,
  Calendar,
  AlertCircle,
  Car,
  User as UserIcon,
  Loader2,
  CheckCircle2,
  Upload,
  ListOrdered,
  History,
  Package,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { Label } from "@/components/ui/label";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

/** Haversine distance in km */
const haversineDistanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/** Project point onto the closest position on line segment A→B (in lat/lng space) */
type PointSelection = { lat: number; lng: number; name: string } | null;

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang, appName } = useLanguage();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === "ar" ? ChevronRight : ChevronLeft;

  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  // Booking flow state
  const [step, setStep] = useState<"search" | "results" | "details">("search");
  const [pickup, setPickup] = useState<PointSelection>(null);
  const [dropoff, setDropoff] = useState<PointSelection>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [pricePerKm, setPricePerKm] = useState(5);

  // Ride instances
  const [rideInstances, setRideInstances] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [shuttleInfo, setShuttleInfo] = useState<any>(null);
  const [driverRatings, setDriverRatings] = useState<Record<string, { avg: number; count: number }>>({});

  // Detail step states
  const [pickupMode, setPickupMode] = useState<"start" | "stop">("start");
  const [selectedPickupStop, setSelectedPickupStop] = useState<any>(null);
  const [dropoffMode, setDropoffMode] = useState<"end" | "stop">("end");
  const [selectedDropoffStop, setSelectedDropoffStop] = useState<any>(null);
  const [tripDirection, setTripDirection] = useState<"go" | "return" | "both">("both");
  const [routeDirections, setRouteDirections] = useState<any>(null);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [availableDirections, setAvailableDirections] = useState<("go" | "return")[]>([]);

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
  const [instapayPhone, setInstapayPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [drivingDistanceKm, setDrivingDistanceKm] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Uber/Careem pattern: hide map when keyboard is open, OR when exactly one of
  // pickup/dropoff is filled (so user naturally completes the second field).
  // Show map on initial state (both empty) and once both are selected.
  const mapVisible =
    step !== "search" ||
    (!keyboardOpen && ((!!pickup && !!dropoff) || (!pickup && !dropoff)));

  // Track keyboard open/close (Capacitor on native, visualViewport on web)
  useEffect(() => {
    let cleanupNative: (() => void) | undefined;
    let usingNative = false;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Keyboard } = await import("@capacitor/keyboard");
          usingNative = true;
          const showSub = await Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
          const hideSub = await Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
          cleanupNative = () => {
            showSub.remove();
            hideSub.remove();
          };
        }
      } catch {
        // ignore — fallback below
      }
    })();

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const onVV = () => {
      if (usingNative || !vv) return;
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOpen(diff > 80);
    };
    vv?.addEventListener("resize", onVV);
    vv?.addEventListener("scroll", onVV);

    return () => {
      cleanupNative?.();
      vv?.removeEventListener("resize", onVV);
      vv?.removeEventListener("scroll", onVV);
    };
  }, []);

  // Compute real driving distance between pickup & dropoff
  useEffect(() => {
    if (!pickup || !dropoff) {
      setDrivingDistanceKm(null);
      return;
    }
    if (typeof google === "undefined" || !google?.maps?.DirectionsService) {
      setDrivingDistanceKm(haversineDistanceKm(pickup, dropoff));
      return;
    }
    const ds = new google.maps.DirectionsService();
    ds.route({ origin: pickup, destination: dropoff, travelMode: google.maps.TravelMode.DRIVING }, (res, status) => {
      if (status === "OK" && res?.routes?.[0]?.legs?.[0]?.distance?.value) {
        setDrivingDistanceKm(res.routes[0].legs[0].distance.value / 1000);
      } else {
        setDrivingDistanceKm(haversineDistanceKm(pickup, dropoff));
      }
    });
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // Estimated price from real driving distance
  const estimatedPrice = drivingDistanceKm !== null ? Math.max(10, Math.round(drivingDistanceKm * pricePerKm)) : null;

  // Fetch settings from cache/hook
  useEffect(() => {
    if (settings.price_per_km) setPricePerKm(parseFloat(settings.price_per_km));
    setInstapayPhone(settings.instapay_phone || "");
  }, [settings.instapay_phone, settings.price_per_km]);

  // Fetch user profile (if logged in)
  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const [{ data: profileData }, { data: rolesData }, { data: partnerData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("partner_companies").select("status").eq("user_id", user.id).maybeSingle(),
      ]);
      setProfile(profileData);
      const roles = (rolesData || []).map((r) => r.role);
      setIsAdmin(roles.includes("admin"));
      if (partnerData) {
        setIsPartner(true);
        setPartnerStatus(partnerData.status);
        // Partners go straight to partner dashboard
        navigate("/partner");
        return;
      }
      const driverFlag = profileData?.user_type === "driver" || roles.includes("moderator");
      setIsDriver(driverFlag);
      if (driverFlag) {
        navigate("/driver-dashboard");
        return;
      }
    };
    fetchUserData();
  }, [navigate, user]);

  // Date options
  const getDateOptions = () => {
    const options: { label: string; date: string }[] = [];
    const today = new Date();
    const dayNames =
      lang === "ar"
        ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      let label = "";
      if (i === 0) label = lang === "ar" ? "اليوم" : "Today";
      else if (i === 1) label = lang === "ar" ? "غداً" : "Tomorrow";
      else label = `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
      options.push({ label, date: dateStr });
    }
    return options;
  };

  // Search for rides when user has both pickup + dropoff
  const searchRides = async () => {
    if (!pickup || !dropoff) return;
    setLoadingRides(true);
    setStep("results");

    // Fetch both ride_instances and published_trips
    const [{ data: riData }, { data: ptData }] = await Promise.all([
      supabase
        .from("ride_instances")
        .select(
          "*, routes(name_en, name_ar, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, price, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)",
        )
        .eq("ride_date", selectedDate)
        .eq("status", "scheduled")
        .order("departure_time"),
      supabase
        .from("published_trips")
        .select(
          "*, routes(name_en, name_ar, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, price, estimated_duration_minutes, origin_lat, origin_lng, destination_lat, destination_lng)",
        )
        .eq("trip_date", selectedDate)
        .eq("status", "active")
        .order("departure_time"),
    ]);

    const allResults: any[] = [];

    // Process ride_instances (existing logic)
    const data = riData || [];
    if (data.length > 0) {
      const matchedRides = data.filter((ri) => {
        const route = ri.routes;
        if (!route) return false;
        const pickupToOrigin = haversineDistanceKm(pickup, { lat: route.origin_lat, lng: route.origin_lng });
        const pickupToDest = haversineDistanceKm(pickup, { lat: route.destination_lat, lng: route.destination_lng });
        const dropoffToOrigin = haversineDistanceKm(dropoff, { lat: route.origin_lat, lng: route.origin_lng });
        const dropoffToDest = haversineDistanceKm(dropoff, { lat: route.destination_lat, lng: route.destination_lng });
        const goMatch = pickupToOrigin < 10 && dropoffToDest < 10;
        const returnMatch = pickupToDest < 10 && dropoffToOrigin < 10;
        return goMatch || returnMatch;
      });

      const driverIds = [...new Set(matchedRides.map((r) => r.driver_id))];
      const shuttleIds = [...new Set(matchedRides.map((r) => r.shuttle_id))];
      const [{ data: profiles }, { data: shuttles }, { data: ratings }] = await Promise.all([
        driverIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, avatar_url, phone").in("user_id", driverIds)
          : { data: [] },
        shuttleIds.length > 0
          ? supabase.from("shuttles").select("id, vehicle_model, vehicle_plate, capacity").in("id", shuttleIds)
          : { data: [] },
        driverIds.length > 0
          ? supabase.from("ratings").select("driver_id, rating").in("driver_id", driverIds)
          : { data: [] },
      ]);
      const pMap: Record<string, any> = {};
      (profiles || []).forEach((p) => {
        pMap[p.user_id] = p;
      });
      const sMap: Record<string, any> = {};
      (shuttles || []).forEach((s) => {
        sMap[s.id] = s;
      });
      const ratingsMap: Record<string, { total: number; count: number }> = {};
      (ratings || []).forEach((r) => {
        if (!r.driver_id) return;
        if (!ratingsMap[r.driver_id]) ratingsMap[r.driver_id] = { total: 0, count: 0 };
        ratingsMap[r.driver_id].total += r.rating;
        ratingsMap[r.driver_id].count += 1;
      });
      const driverRatingsResult: Record<string, { avg: number; count: number }> = {};
      Object.entries(ratingsMap).forEach(([id, { total, count }]) => {
        driverRatingsResult[id] = { avg: total / count, count };
      });
      setDriverRatings(driverRatingsResult);
      allResults.push(
        ...matchedRides.map((r) => ({
          ...r,
          _type: "ride",
          driver_profile: pMap[r.driver_id],
          shuttle_info: sMap[r.shuttle_id],
        })),
      );
    }

    // Process published_trips
    if (ptData && ptData.length > 0) {
      const matchedTrips = ptData.filter((pt) => {
        const route = pt.routes;
        if (!route) return false;
        const pickupToOrigin = haversineDistanceKm(pickup, { lat: route.origin_lat, lng: route.origin_lng });
        const pickupToDest = haversineDistanceKm(pickup, { lat: route.destination_lat, lng: route.destination_lng });
        const dropoffToOrigin = haversineDistanceKm(dropoff, { lat: route.origin_lat, lng: route.origin_lng });
        const dropoffToDest = haversineDistanceKm(dropoff, { lat: route.destination_lat, lng: route.destination_lng });
        return (pickupToOrigin < 10 && dropoffToDest < 10) || (pickupToDest < 10 && dropoffToOrigin < 10);
      });
      allResults.push(
        ...matchedTrips.map((pt) => ({
          ...pt,
          _type: "published",
          ride_date: pt.trip_date,
          route_id: pt.route_id,
          direction: "go",
          available_seats: 14,
          total_seats: 14,
        })),
      );
    }

    setRideInstances(allResults);
    setLoadingRides(false);
  };

  // Route directions for on-route checking
  useEffect(() => {
    if (!selectedRide?.routes || typeof google === "undefined" || !google?.maps?.DirectionsService) {
      setRouteDirections(null);
      return;
    }

    const isReturnRide = selectedRide.direction === "return";
    const origin = isReturnRide
      ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng }
      : { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng };
    const destination = isReturnRide
      ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
      : { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng };

    const ds = new google.maps.DirectionsService();
    ds.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) setRouteDirections(result);
        else setRouteDirections(null);
      },
    );
  }, [selectedRide?.route_id, selectedRide?.direction]);

  const selectRide = async (ride: any) => {
    setSelectedRide(ride);
    setDriverProfile(ride.driver_profile);
    setShuttleInfo(ride.shuttle_info);
    setSelectedPickupStop(null);
    setSelectedDropoffStop(null);
    setPickupMode("start");
    setDropoffMode("end");
    setUseBundle(false);
    setStep("details");

    // Fetch stops for this route
    const { data: stops } = await supabase.from("stops").select("*").eq("route_id", ride.route_id).order("stop_order");
    setRouteStops(stops || []);

    // Check available directions for this route+date
    const { data: allRides } = await supabase
      .from("ride_instances")
      .select("direction")
      .eq("route_id", ride.route_id)
      .eq("ride_date", ride.ride_date)
      .eq("status", "scheduled");
    const dirs = [...new Set((allRides || []).map((r) => r.direction))] as ("go" | "return")[];
    setAvailableDirections(dirs);
    // Set default trip direction based on available directions
    if (dirs.length === 1) {
      setTripDirection(dirs[0]);
    } else if (dirs.includes("go") && dirs.includes("return")) {
      setTripDirection("both");
    } else {
      setTripDirection(ride.direction || "go");
    }

    if (user && ride.route_id) {
      const [{ data: savedLocs }, { data: bundles }, { data: purchases }] = await Promise.all([
        supabase
          .from("saved_locations")
          .select("*")
          .eq("user_id", user.id)
          .eq("route_id", ride.route_id)
          .order("use_count", { ascending: false })
          .limit(5),
        supabase.from("ride_bundles").select("*").eq("route_id", ride.route_id).eq("is_active", true),
        supabase
          .from("bundle_purchases")
          .select("*")
          .eq("user_id", user.id)
          .eq("route_id", ride.route_id)
          .eq("status", "active")
          .gt("rides_remaining", 0)
          .gt("expires_at", new Date().toISOString())
          .limit(1),
      ]);
      setSavedLocations(savedLocs || []);
      setAvailableBundles(bundles || []);
      setActiveBundlePurchase(purchases?.[0] || null);
    }
  };

  // Real-time subscription for stops changes
  useEffect(() => {
    if (!selectedRide?.route_id) return;
    const routeId = selectedRide.route_id;
    const channel = supabase
      .channel("stops-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stops", filter: `route_id=eq.${routeId}` },
        async () => {
          const { data: stops } = await supabase.from("stops").select("*").eq("route_id", routeId).order("stop_order");
          setRouteStops(stops || []);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRide?.route_id]);

  // Find closest stop to a searched location
  const findClosestStop = (point: { lat: number; lng: number }, stopType?: "pickup" | "dropoff"): any | null => {
    if (!routeStops.length) return null;
    let filteredStops = routeStops;
    if (stopType === "pickup") {
      filteredStops = routeStops.filter((s) => s.stop_type === "pickup" || s.stop_type === "both");
    } else if (stopType === "dropoff") {
      filteredStops = routeStops.filter((s) => s.stop_type === "dropoff" || s.stop_type === "both");
    }
    if (!filteredStops.length) filteredStops = routeStops;
    let closest = filteredStops[0];
    let minDist = haversineDistanceKm(point, { lat: closest.lat, lng: closest.lng });
    for (let i = 1; i < filteredStops.length; i++) {
      const d = haversineDistanceKm(point, { lat: filteredStops[i].lat, lng: filteredStops[i].lng });
      if (d < minDist) {
        minDist = d;
        closest = filteredStops[i];
      }
    }
    return closest;
  };

  const handleSearchAndMatchStop = (place: { lat: number; lng: number; name: string }, type: "pickup" | "dropoff") => {
    const closest = findClosestStop(place, type);
    if (closest) {
      if (type === "pickup") {
        setSelectedPickupStop(closest);
        setPickupMode("stop");
      } else {
        setSelectedDropoffStop(closest);
        setDropoffMode("stop");
      }
      const dist = haversineDistanceKm(place, { lat: closest.lat, lng: closest.lng });
      toast({
        title: lang === "ar" ? "📍 أقرب نقطة توقف" : "📍 Nearest stop matched",
        description:
          lang === "ar"
            ? `${lang === "ar" ? closest.name_ar : closest.name_en} (${dist.toFixed(1)} كم)`
            : `${closest.name_en} (${dist.toFixed(1)} km away)`,
      });
    }
  };

  const isPickupValid = true; // Always valid - either start point or a predefined stop
  const isDropoffValid = true;

  // Dynamic price - use route price directly
  const dynamicPrice = selectedRide?.routes?.price || 0;

  const isRideFull = selectedRide?.available_seats === 0;

  // Payment file handler
  const handlePaymentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: lang === "ar" ? "الملف كبير جداً" : "File too large", variant: "destructive" });
      return;
    }
    setPaymentProof(file);
    setPaymentPreview(URL.createObjectURL(file));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Booking handler
  const handleBook = async (asWaitlist = false) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!selectedRide) return;
    setLoading(true);
    try {
      let proofUrl: string | null = null;
      const usingBundle = useBundle && activeBundlePurchase;
      if (paymentProof && !usingBundle) {
        setUploadingProof(true);
        const ext = paymentProof.name.split(".").pop();
        const filePath = `instapay-proofs/${user.id}/${Date.now()}.${ext}`;
        const { uploadToBunny } = await import("@/lib/bunnyUpload");
        proofUrl = await uploadToBunny(paymentProof, filePath);
        setUploadingProof(false);
      }

      let waitlistPos: number | null = null;
      if (asWaitlist) {
        const { data: existingWaitlist } = await supabase
          .from("bookings")
          .select("waitlist_position")
          .eq("route_id", selectedRide.route_id)
          .eq("scheduled_date", selectedRide.ride_date)
          .eq("scheduled_time", selectedRide.departure_time)
          .eq("status", "waitlist")
          .order("waitlist_position", { ascending: false })
          .limit(1);
        waitlistPos = ((existingWaitlist?.[0]?.waitlist_position as number) || 0) + 1;
      }

      const route = selectedRide.routes;
      const pickupLat = pickupMode === "stop" && selectedPickupStop ? selectedPickupStop.lat : route.origin_lat;
      const pickupLng = pickupMode === "stop" && selectedPickupStop ? selectedPickupStop.lng : route.origin_lng;
      const pickupName =
        pickupMode === "stop" && selectedPickupStop
          ? lang === "ar"
            ? selectedPickupStop.name_ar
            : selectedPickupStop.name_en
          : lang === "ar"
            ? route.origin_name_ar
            : route.origin_name_en;
      const dropoffLat =
        dropoffMode === "stop" && selectedDropoffStop ? selectedDropoffStop.lat : route.destination_lat;
      const dropoffLng =
        dropoffMode === "stop" && selectedDropoffStop ? selectedDropoffStop.lng : route.destination_lng;
      const dropoffName =
        dropoffMode === "stop" && selectedDropoffStop
          ? lang === "ar"
            ? selectedDropoffStop.name_ar
            : selectedDropoffStop.name_en
          : lang === "ar"
            ? route.destination_name_ar
            : route.destination_name_en;

      const basePrice = dynamicPrice;

      if (tripDirection === "both") {
        const goPrice = usingBundle ? 0 : basePrice;
        const returnPrice = usingBundle ? 0 : basePrice;
        const commonFields: any = {
          user_id: user.id,
          route_id: selectedRide.route_id,
          seats: 1,
          scheduled_date: selectedRide.ride_date || selectedRide.trip_date,
          scheduled_time: selectedRide.departure_time,
          status: asWaitlist ? "waitlist" : usingBundle ? "confirmed" : "pending",
          payment_proof_url: proofUrl,
          waitlist_position: waitlistPos,
        };
        if (selectedRide.shuttle_id) commonFields.shuttle_id = selectedRide.shuttle_id;
        const { error: goErr } = await supabase.from("bookings").insert({
          ...commonFields,
          total_price: goPrice,
          custom_pickup_lat: pickupLat,
          custom_pickup_lng: pickupLng,
          custom_pickup_name: pickupName,
          custom_dropoff_lat: dropoffLat,
          custom_dropoff_lng: dropoffLng,
          custom_dropoff_name: dropoffName,
          trip_direction: "go",
        });
        if (goErr) throw goErr;
        const { error: retErr } = await supabase.from("bookings").insert({
          ...commonFields,
          total_price: returnPrice,
          custom_pickup_lat: dropoffLat,
          custom_pickup_lng: dropoffLng,
          custom_pickup_name: dropoffName,
          custom_dropoff_lat: pickupLat,
          custom_dropoff_lng: pickupLng,
          custom_dropoff_name: pickupName,
          trip_direction: "return",
        });
        if (retErr) throw retErr;
      } else {
        const totalPrice = usingBundle ? 0 : basePrice;
        const bookingPayload: any = {
          user_id: user.id,
          route_id: selectedRide.route_id,
          seats: 1,
          total_price: totalPrice,
          scheduled_date: selectedRide.ride_date || selectedRide.trip_date,
          scheduled_time: selectedRide.departure_time,
          status: asWaitlist ? "waitlist" : usingBundle ? "confirmed" : "pending",
          payment_proof_url: proofUrl,
          waitlist_position: waitlistPos,
          custom_pickup_lat: pickupLat,
          custom_pickup_lng: pickupLng,
          custom_pickup_name: pickupName,
          custom_dropoff_lat: dropoffLat,
          custom_dropoff_lng: dropoffLng,
          custom_dropoff_name: dropoffName,
          trip_direction: tripDirection,
        };
        if (selectedRide.shuttle_id) bookingPayload.shuttle_id = selectedRide.shuttle_id;
        const { error } = await supabase.from("bookings").insert(bookingPayload);
        if (error) throw error;
      }

      if (usingBundle && activeBundlePurchase) {
        await supabase
          .from("bundle_purchases")
          .update({
            rides_remaining: activeBundlePurchase.rides_remaining - (tripDirection === "both" ? 2 : 1),
          })
          .eq("id", activeBundlePurchase.id);
      }

      if (!asWaitlist && selectedRide._type !== "published" && selectedRide.id) {
        await supabase
          .from("ride_instances")
          .update({
            available_seats: selectedRide.available_seats - 1,
          })
          .eq("id", selectedRide.id);
      }

      if (user && selectedRide.route_id) {
        const existing = savedLocations.find(
          (sl: any) =>
            sl.pickup_lat === pickupLat &&
            sl.pickup_lng === pickupLng &&
            sl.dropoff_lat === dropoffLat &&
            sl.dropoff_lng === dropoffLng,
        );
        if (existing) {
          await supabase
            .from("saved_locations")
            .update({ use_count: existing.use_count + 1 })
            .eq("id", existing.id);
        } else {
          await supabase.from("saved_locations").insert({
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
          ? lang === "ar"
            ? "تم إضافتك لقائمة الانتظار"
            : "Added to waitlist"
          : usingBundle
            ? lang === "ar"
              ? "تم الحجز من الباقة"
              : "Booked from bundle"
            : lang === "ar"
              ? "تم الحجز بنجاح"
              : "Booking submitted",
      });
      navigate("/my-bookings");
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setUploadingProof(false);
    }
  };

  const handleBuyBundle = async (bundle: any) => {
    if (!user || !paymentProof) {
      toast({ title: lang === "ar" ? "أرفق إثبات الدفع" : "Attach payment proof", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let proofUrl: string | null = null;
      if (paymentProof) {
        const ext = paymentProof.name.split(".").pop();
        const filePath = `instapay-proofs/${user.id}/bundle_${Date.now()}.${ext}`;
        const { uploadToBunny } = await import("@/lib/bunnyUpload");
        proofUrl = await uploadToBunny(paymentProof, filePath);
      }
      const expiresAt = new Date();
      if (bundle.bundle_type === "weekly") expiresAt.setDate(expiresAt.getDate() + 7);
      else expiresAt.setDate(expiresAt.getDate() + 30);
      const { error } = await supabase.from("bundle_purchases").insert({
        user_id: user.id,
        bundle_id: bundle.id,
        route_id: bundle.route_id,
        rides_remaining: bundle.ride_count,
        rides_total: bundle.ride_count,
        expires_at: expiresAt.toISOString(),
        status: "active",
        payment_proof_url: proofUrl,
      });
      if (error) throw error;
      toast({ title: lang === "ar" ? "تم شراء الباقة!" : "Bundle purchased!" });
      const { data: purchases } = await supabase
        .from("bundle_purchases")
        .select("*")
        .eq("user_id", user.id)
        .eq("route_id", bundle.route_id)
        .eq("status", "active")
        .gt("rides_remaining", 0)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      setActiveBundlePurchase(purchases?.[0] || null);
      setPaymentProof(null);
      setPaymentPreview(null);
      setShowBundleSection(false);
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const applySavedLocation = (saved: any) => {
    if (saved.pickup_lat && saved.pickup_lng) {
      const closest = findClosestStop({ lat: saved.pickup_lat, lng: saved.pickup_lng }, "pickup");
      if (
        closest &&
        haversineDistanceKm({ lat: saved.pickup_lat, lng: saved.pickup_lng }, { lat: closest.lat, lng: closest.lng }) <
          0.5
      ) {
        setPickupMode("stop");
        setSelectedPickupStop(closest);
      } else {
        setPickupMode("start");
        setSelectedPickupStop(null);
      }
    }
    if (saved.dropoff_lat && saved.dropoff_lng) {
      const closest = findClosestStop({ lat: saved.dropoff_lat, lng: saved.dropoff_lng }, "dropoff");
      if (
        closest &&
        haversineDistanceKm(
          { lat: saved.dropoff_lat, lng: saved.dropoff_lng },
          { lat: closest.lat, lng: closest.lng },
        ) < 0.5
      ) {
        setDropoffMode("stop");
        setSelectedDropoffStop(closest);
      } else {
        setDropoffMode("end");
        setSelectedDropoffStop(null);
      }
    }
    toast({ title: lang === "ar" ? "تم تطبيق الموقع المحفوظ" : "Saved location applied" });
  };

  const dateOptions = getDateOptions();

  const mapMarkers: { lat: number; lng: number; label?: string; color?: "red" | "green" | "blue" }[] = [];
  if (step === "search" || step === "results") {
    if (pickup) mapMarkers.push({ lat: pickup.lat, lng: pickup.lng, label: "A", color: "green" });
    if (dropoff) mapMarkers.push({ lat: dropoff.lat, lng: dropoff.lng, label: "B", color: "red" });
  }
  if (step === "details" && selectedRide?.routes) {
    mapMarkers.push(
      { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng, label: "A", color: "green" },
      { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng, label: "B", color: "red" },
    );
    if (selectedPickupStop && pickupMode === "stop") {
      mapMarkers.push({ lat: selectedPickupStop.lat, lng: selectedPickupStop.lng, label: "📍", color: "green" });
    }
    if (selectedDropoffStop && dropoffMode === "stop") {
      mapMarkers.push({ lat: selectedDropoffStop.lat, lng: selectedDropoffStop.lng, label: "📍", color: "red" });
    }
    routeStops.forEach((stop: any) => {
      mapMarkers.push({ lat: stop.lat, lng: stop.lng, label: (stop.stop_order + 1).toString(), color: "blue" });
    });
  }

  const renderStopSelector = (type: "pickup" | "dropoff") => {
    const isPickupType = type === "pickup";
    const mode = isPickupType ? pickupMode : dropoffMode;
    const selectedStop = isPickupType ? selectedPickupStop : selectedDropoffStop;
    const startLabel = isPickupType
      ? lang === "ar"
        ? "🚏 نقطة الانطلاق"
        : "🚏 Starting Point"
      : lang === "ar"
        ? "🏁 نقطة الوصول"
        : "🏁 End Point";
    const stopLabel = lang === "ar" ? "📍 نقطة توقف" : "📍 Bus Stop";
    const isStartMode = mode === "start" || mode === "end";

    const filteredStops = routeStops.filter((s: any) =>
      isPickupType
        ? s.stop_type === "pickup" || s.stop_type === "both"
        : s.stop_type === "dropoff" || s.stop_type === "both",
    );

    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm">
          <MapPin className={`w-4 h-4 ${isPickupType ? "text-green-500" : "text-destructive"}`} />
          {isPickupType ? (lang === "ar" ? "نقطة الركوب" : "Pickup") : lang === "ar" ? "نقطة النزول" : "Dropoff"}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isPickupType) {
                setPickupMode("start");
                setSelectedPickupStop(null);
              } else {
                setDropoffMode("end");
                setSelectedDropoffStop(null);
              }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isStartMode ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
          >
            {startLabel}
          </button>
          {filteredStops.length > 0 && (
            <button
              onClick={() => {
                if (isPickupType) {
                  setPickupMode("stop");
                  setSelectedPickupStop(null);
                } else {
                  setDropoffMode("stop");
                  setSelectedDropoffStop(null);
                }
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${mode === "stop" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
            >
              {stopLabel}
            </button>
          )}
        </div>

        {isStartMode && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="font-medium text-xs">
              {isPickupType
                ? lang === "ar"
                  ? selectedRide?.routes?.origin_name_ar
                  : selectedRide?.routes?.origin_name_en
                : lang === "ar"
                  ? selectedRide?.routes?.destination_name_ar
                  : selectedRide?.routes?.destination_name_en}
            </p>
          </div>
        )}

        {mode === "stop" && (
          <div className="space-y-2">
            <PlacesAutocomplete
              placeholder={
                isPickupType
                  ? lang === "ar"
                    ? "ابحث عن موقعك..."
                    : "Search your location..."
                  : lang === "ar"
                    ? "ابحث عن وجهتك..."
                    : "Search your destination..."
              }
              onSelect={(place) => handleSearchAndMatchStop(place, type)}
              iconColor={isPickupType ? "text-green-500" : "text-destructive"}
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
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                    {stop.stop_order + 1}
                  </span>
                  <span className="truncate">{lang === "ar" ? stop.name_ar : stop.name_en}</span>
                </button>
              ))}
            </div>
            {selectedStop && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-medium">
                  #{selectedStop.stop_order + 1} {lang === "ar" ? selectedStop.name_ar : selectedStop.name_en} ✓
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const tripDirectionOptions = (() => {
    const opts: { value: "go" | "return" | "both"; labelAr: string; labelEn: string; mult: number }[] = [];
    if (availableDirections.includes("go")) {
      opts.push({ value: "go", labelAr: "ذهاب", labelEn: "Going", mult: 1 });
    }
    if (availableDirections.includes("return")) {
      opts.push({ value: "return", labelAr: "عودة", labelEn: "Return", mult: 1 });
    }
    if (availableDirections.includes("go") && availableDirections.includes("return")) {
      opts.push({ value: "both", labelAr: "ذهاب وعودة", labelEn: "Round Trip", mult: 2 });
    }
    return opts;
  })();

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden bg-surface"
      style={{
        paddingBottom: keyboardOpen ? "0px" : "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold text-primary font-arabic">
            {appName}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Shield className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="rounded-full px-2.5 py-1.5 hover:bg-muted transition-colors text-xs font-medium"
              >
                {lang === "en" ? "عربي" : "EN"}
              </button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="rounded-full px-2.5 py-1.5 hover:bg-muted transition-colors text-xs font-medium"
              >
                {lang === "en" ? "عربي" : "EN"}
              </button>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {lang === "ar" ? "تسجيل الدخول" : "Log in"}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">{lang === "ar" ? "إنشاء حساب" : "Sign up"}</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Announcement Banner */}
      {(lang === "ar" ? settings.announcement_ar : settings.announcement_en) && (
        <div className="bg-secondary/10 text-secondary px-4 py-2 text-sm text-center font-medium shrink-0">
          {lang === "ar" ? settings.announcement_ar : settings.announcement_en}
        </div>
      )}

      {/* Partner Banner */}
      {isPartner && (
        <Link
          to="/partner"
          className={`block px-4 py-2.5 text-sm text-center font-medium shrink-0 ${
            partnerStatus === "approved"
              ? "bg-green-100 text-green-700"
              : partnerStatus === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {partnerStatus === "approved"
            ? lang === "ar"
              ? "🏢 لوحة الشريك — اضغط لإدارة شركتك"
              : "🏢 Partner Dashboard — tap to manage"
            : partnerStatus === "pending"
              ? lang === "ar"
                ? "⏳ طلب الشراكة قيد المراجعة — اضغط للتفاصيل"
                : "⏳ Partner application under review — tap for details"
              : lang === "ar"
                ? "❌ تم رفض طلب الشراكة — اضغط للتفاصيل"
                : "❌ Partner application rejected — tap for details"}
        </Link>
      )}

      <div
        className={cn(
          "relative bg-muted",
          !mapVisible ? "hidden" : "flex-1 min-h-[300px]",
        )}
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{lang === "ar" ? "جاري تجهيز الخريطة..." : "Preparing map..."}</span>
              </div>
            </div>
          }
        >
          <MapView
            key={step === "details" ? `details-${selectedRide?.route_id || "none"}` : `search-${pickup?.lat || "none"}-${pickup?.lng || "none"}-${dropoff?.lat || "none"}-${dropoff?.lng || "none"}`}
            className="h-full w-full rounded-none"
            markers={mapMarkers}
            origin={
              step === "details" && selectedRide?.routes
                ? { lat: selectedRide.routes.origin_lat, lng: selectedRide.routes.origin_lng }
                : pickup && dropoff
                  ? pickup
                  : undefined
            }
            destination={
              step === "details" && selectedRide?.routes
                ? { lat: selectedRide.routes.destination_lat, lng: selectedRide.routes.destination_lng }
                : pickup && dropoff
                  ? dropoff
                  : undefined
            }
            waypoints={
              step === "details" && selectedRide?.routes
                ? routeStops.map((s: any) => ({ lat: s.lat, lng: s.lng }))
                : []
            }
            showDirections={step === "details" ? !!selectedRide?.routes : !!pickup && !!dropoff}
            zoom={12}
            showUserLocation
          />
        </Suspense>
      </div>

      <div
        className={`${mapVisible ? "shrink-0" : "flex-1 min-h-0"} overflow-y-auto bg-card border-t border-border`}
        style={{
          maxHeight: mapVisible ? (step === "search" ? "auto" : "50dvh") : undefined,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {step === "search" && (
          <div className="px-4 pt-3 pb-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "إلى أين تريد الذهاب؟" : "Where are you going?"}
              </h2>
              <Link to="/book-ride">
                <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1">
                  <ListOrdered className="w-3.5 h-3.5" />
                  {lang === "ar" ? "الرحلات المتاحة" : "Available Routes"}
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              <PlacesAutocomplete
                placeholder={lang === "ar" ? "من أين؟ (نقطة الركوب)" : "From where? (Pickup)"}
                onSelect={(place) => setPickup(place)}
                value={pickup?.name || ""}
                iconColor="text-green-500"
              />
              <PlacesAutocomplete
                placeholder={lang === "ar" ? "إلى أين؟ (نقطة النزول)" : "To where? (Dropoff)"}
                onSelect={(place) => setDropoff(place)}
                value={dropoff?.name || ""}
                iconColor="text-destructive"
              />
            </div>
            <div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateOptions.slice(0, 5).map((opt) => (
                  <button
                    key={opt.date}
                    onClick={() => setSelectedDate(opt.date)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${selectedDate === opt.date ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {estimatedPrice && (
              <div className="flex items-center justify-between bg-surface rounded-xl p-3">
                <span className="text-sm text-muted-foreground">
                  {lang === "ar" ? "السعر المقدّر" : "Estimated price"}
                </span>
                <span className="text-lg font-bold text-primary">{estimatedPrice} EGP</span>
              </div>
            )}
            <Button
              className="w-full h-12 text-base rounded-xl"
              onClick={searchRides}
              disabled={!pickup || !dropoff || loadingRides}
            >
              {loadingRides ? (
                <>
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  {lang === "ar" ? "جاري البحث..." : "Searching..."}
                </>
              ) : lang === "ar" ? (
                "ابحث عن رحلة"
              ) : (
                "Search Rides"
              )}
            </Button>
          </div>
        )}

        {step === "results" && (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1 shrink-0"
                onClick={() => {
                  setStep("search");
                  setRideInstances([]);
                }}
              >
                <Back className="w-4 h-4" />
                <span className="text-sm">{lang === "ar" ? "رجوع" : "Back"}</span>
              </Button>
              <h2 className="text-lg font-bold text-foreground flex-1">
                {lang === "ar" ? "الرحلات المتاحة" : "Available Rides"}
              </h2>
            </div>
            {loadingRides ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                {lang === "ar" ? "جاري البحث..." : "Searching..."}
              </div>
            ) : rideInstances.length > 0 ? (
              <div className="space-y-2">
                {rideInstances.map((ride) => (
                  <button
                    key={ride.id}
                    onClick={() => selectRide(ride)}
                    className="w-full text-start bg-card border border-border rounded-xl p-4 hover:border-secondary/40 hover:shadow-card-hover transition-all"
                  >
                    {ride._type === "published" ? (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                            <Car className="w-5 h-5 text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {lang === "ar"
                                ? ride.routes?.name_ar || "رحلة متاحة"
                                : ride.routes?.name_en || "Available Trip"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lang === "ar" ? "احجز مقعدك الآن" : "Book your seat now"}
                            </p>
                          </div>
                          <div className="text-end">
                            <span className="text-lg font-bold text-primary">{ride.routes?.price ?? "..."} EGP</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {ride.driver_profile?.avatar_url ? (
                            <img
                              src={ride.driver_profile.avatar_url}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {ride.driver_profile?.full_name || (lang === "ar" ? "سائق" : "Driver")}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Car className="w-3 h-3" />
                            <span>{ride.shuttle_info?.vehicle_model}</span>
                          </div>
                          {driverRatings[ride.driver_id] && (
                            <div className="flex items-center gap-1 text-xs mt-0.5">
                              <Star className="w-3 h-3 fill-secondary text-secondary" />
                              <span className="font-medium text-foreground">
                                {driverRatings[ride.driver_id].avg.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground">({driverRatings[ride.driver_id].count})</span>
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <span className="text-lg font-bold text-primary">{ride.routes?.price ?? "..."} EGP</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                      <span className="flex-1 break-words">
                        {ride.direction === "return"
                          ? lang === "ar"
                            ? ride.routes?.destination_name_ar
                            : ride.routes?.destination_name_en
                          : lang === "ar"
                            ? ride.routes?.origin_name_ar
                            : ride.routes?.origin_name_en}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3 text-destructive shrink-0" />
                      <span className="flex-1 break-words">
                        {ride.direction === "return"
                          ? lang === "ar"
                            ? ride.routes?.origin_name_ar
                            : ride.routes?.origin_name_en
                          : lang === "ar"
                            ? ride.routes?.destination_name_ar
                            : ride.routes?.destination_name_en}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {ride.departure_time?.slice(0, 5)}
                      </span>
                      {ride._type !== "published" && (
                        <span
                          className={`flex items-center gap-1 font-medium ${ride.available_seats <= 3 ? "text-destructive" : "text-green-600"}`}
                        >
                          <Users className="w-3 h-3" />
                          {ride.available_seats}/{ride.total_seats}
                        </span>
                      )}
                      {ride._type === "published" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium text-[10px]">
                          {lang === "ar" ? "رحلة مخططة" : "Planned Trip"}
                        </span>
                      )}
                      {ride.direction === "return" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium text-[10px]">
                          {lang === "ar" ? "عودة" : "Return"}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {lang === "ar" ? "لا توجد رحلات متاحة لهذا المسار" : "No rides available for this route"}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!user) {
                      navigate("/login");
                      return;
                    }
                    navigate("/request-route", {
                      state: {
                        origin: pickup ? { name: pickup.name || "", lat: pickup.lat, lng: pickup.lng } : undefined,
                        destination: dropoff
                          ? { name: dropoff.name || "", lat: dropoff.lat, lng: dropoff.lng }
                          : undefined,
                      },
                    });
                  }}
                >
                  {lang === "ar" ? "اطلب هذا المسار" : "Request this route"}
                </Button>
                <Link to="/book-ride">
                  <Button variant="outline" size="sm" className="w-full mt-2 gap-1">
                    <ListOrdered className="w-3.5 h-3.5" />
                    {lang === "ar" ? "عرض جميع الرحلات المتاحة" : "See all available routes"}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    setStep("search");
                    setRideInstances([]);
                  }}
                >
                  <Back className="w-4 h-4" />
                  {lang === "ar" ? "رجوع" : "Go back"}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "details" && selectedRide && (
          <div className="p-4 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-1"
              onClick={() => {
                setStep("results");
                setSelectedRide(null);
                setRouteDirections(null);
                setSelectedPickupStop(null);
                setSelectedDropoffStop(null);
              }}
            >
              <Back className="w-4 h-4" />
              <span className="text-sm">{lang === "ar" ? "رجوع" : "Back"}</span>
            </Button>
            {selectedRide._type === "published" ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <Car className="w-6 h-6 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">
                    {lang === "ar"
                      ? selectedRide.routes?.name_ar || "رحلة مخططة"
                      : selectedRide.routes?.name_en || "Planned Trip"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ar"
                      ? "احجز مقعدك — سيتم تأكيد الرحلة لاحقاً"
                      : "Book your seat — trip will be confirmed later"}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-bold text-primary">{dynamicPrice} EGP</p>
                  <p className="text-[10px] text-muted-foreground">{selectedRide.departure_time?.slice(0, 5)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {driverProfile?.avatar_url ? (
                    <img src={driverProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">
                    {driverProfile?.full_name || (lang === "ar" ? "سائق" : "Driver")}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Car className="w-3 h-3" />
                    <span>
                      {shuttleInfo?.vehicle_model} · {shuttleInfo?.vehicle_plate}
                    </span>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-xl font-bold text-primary">{dynamicPrice} EGP</p>
                  <p className="text-[10px] text-muted-foreground">{selectedRide.departure_time?.slice(0, 5)}</p>
                </div>
              </div>
            )}

            {savedLocations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <History className="w-3 h-3" />
                  {lang === "ar" ? "مواقع سابقة" : "Previous"}
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {savedLocations.slice(0, 3).map((sl: any) => (
                    <button
                      key={sl.id}
                      onClick={() => applySavedLocation(sl)}
                      className="bg-surface hover:bg-muted rounded-lg px-3 py-1.5 text-[10px] border border-border whitespace-nowrap"
                    >
                      {sl.pickup_name?.split(",")[0]} → {sl.dropoff_name?.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {renderStopSelector("pickup")}
            {renderStopSelector("dropoff")}

            {tripDirectionOptions.length > 1 && (
              <div className={`grid gap-2 ${tripDirectionOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {tripDirectionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTripDirection(opt.value)}
                    className={`px-2 py-2.5 rounded-xl text-center border-2 transition-colors ${tripDirection === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
                  >
                    <p className="text-xs font-medium">{lang === "ar" ? opt.labelAr : opt.labelEn}</p>
                    <p className="text-[10px] mt-0.5 opacity-80">{dynamicPrice * opt.mult} EGP</p>
                  </button>
                ))}
              </div>
            )}
            {tripDirectionOptions.length === 1 && (
              <div className="flex items-center gap-2 text-xs p-3 rounded-xl bg-surface border border-border">
                <ArrowRight className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">
                  {lang === "ar" ? tripDirectionOptions[0].labelAr : tripDirectionOptions[0].labelEn}
                </span>
                <span className="ms-auto font-bold text-primary">{dynamicPrice} EGP</span>
              </div>
            )}

            {activeBundlePurchase && (
              <button
                onClick={() => setUseBundle(!useBundle)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium border-2 transition-colors flex items-center gap-2 ${useBundle ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card text-foreground border-border hover:border-secondary"}`}
              >
                <Package className="w-4 h-4" />
                {useBundle
                  ? lang === "ar"
                    ? `✓ من الباقة (${activeBundlePurchase.rides_remaining} متبقي)`
                    : `✓ Using bundle (${activeBundlePurchase.rides_remaining} left)`
                  : lang === "ar"
                    ? `استخدم الباقة (${activeBundlePurchase.rides_remaining} متبقي)`
                    : `Use bundle (${activeBundlePurchase.rides_remaining} left)`}
              </button>
            )}

            {!useBundle && (
              <div className="space-y-3">
                <div className="bg-surface rounded-xl p-3 text-sm space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {lang === "ar" ? "حوّل عبر InstaPay:" : "Transfer via InstaPay:"}
                  </p>
                  <p className="font-bold text-foreground">
                    {tripDirection === "both" ? dynamicPrice * 2 : dynamicPrice} EGP
                  </p>
                  {instapayPhone && (
                    <p className="font-mono text-xs" dir="ltr">
                      {lang === "ar" ? "إلى: " : "To: "}
                      {instapayPhone}
                    </p>
                  )}
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
                    <img
                      src={paymentPreview}
                      alt=""
                      className="w-full h-32 object-contain rounded-lg border border-border bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 me-1" />
                      {lang === "ar" ? "تغيير" : "Change"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-16 border-dashed border-2 flex-col gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {lang === "ar" ? "ارفع إثبات InstaPay" : "Upload InstaPay proof"}
                    </span>
                  </Button>
                )}
              </div>
            )}

            {!isRideFull ? (
              <Button
                className="w-full h-12 text-base rounded-xl"
                onClick={() => handleBook(false)}
                disabled={loading || (!useBundle && !paymentProof)}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 me-1 animate-spin" />
                    {lang === "ar" ? "جاري الحجز..." : "Booking..."}
                  </>
                ) : lang === "ar" ? (
                  `تأكيد الحجز · ${tripDirection === "both" ? dynamicPrice * 2 : dynamicPrice} EGP`
                ) : (
                  `Confirm · ${tripDirection === "both" ? dynamicPrice * 2 : dynamicPrice} EGP`
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-destructive font-medium p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="w-3 h-3" />
                  {lang === "ar" ? "مكتمل" : "Full"}
                </div>
                <Button className="w-full" variant="secondary" onClick={() => handleBook(true)} disabled={loading}>
                  <ListOrdered className="w-4 h-4 me-1" />
                  {lang === "ar" ? "قائمة الانتظار" : "Join Waitlist"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
