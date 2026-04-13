import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import MapToolbar from '@/components/global-map/MapToolbar';
import UserSidebar from '@/components/global-map/UserSidebar';
import RouteBuilder from '@/components/global-map/RouteBuilder';
import {
  type RouteRequestUser, type FilterState, type RouteStop, type CircleZone,
  deduplicateRequests, isInRadius, ZONE_COLORS,
} from '@/components/global-map/types';
import { Loader2, EyeOff, Save } from 'lucide-react';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const libraries: ('places' | 'drawing' | 'geometry')[] = ['places', 'drawing', 'geometry'];

const GlobalMap = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY, libraries });

  // Data
  const [allUsers, setAllUsers] = useState<RouteRequestUser[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [filters, setFilters] = useState<FilterState>({ timeFrom: '', timeTo: '', days: [], commonDaysOnly: false });
  const [showFilters, setShowFilters] = useState(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<RouteRequestUser | null>(null);
  const [showLines, setShowLines] = useState(false);
  const [showConnectedRoutes, setShowConnectedRoutes] = useState(false);
  const [connectedDirections, setConnectedDirections] = useState<google.maps.DirectionsResult[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [originalPositions, setOriginalPositions] = useState<Record<string, { oLat: number; oLng: number; dLat: number; dLng: number }>>({});
  const [zonesLocked, setZonesLocked] = useState(false);

  // Circle zones
  const [circleZones, setCircleZones] = useState<CircleZone[]>([]);
  const [addingCircleType, setAddingCircleType] = useState<'pickup' | 'dropoff' | null>(null);
  const [addingCirclePairId, setAddingCirclePairId] = useState<string>('');

  // Route builder
  const [routeMode, setRouteMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [endPoint, setEndPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [generatedRoute, setGeneratedRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeNameEn, setRouteNameEn] = useState('');
  const [routeNameAr, setRouteNameAr] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingConnectedRoute, setSavingConnectedRoute] = useState(false);
  const [connectedRouteInfo, setConnectedRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [reqRes, profRes] = await Promise.all([
        supabase.from('route_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name, phone'),
      ]);
      const profileMap: Record<string, any> = {};
      (profRes.data || []).forEach(p => { profileMap[p.user_id] = p; });
      setAllUsers(deduplicateRequests(reqRes.data || [], profileMap));
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get unique pair IDs
  const pairIds = [...new Set(circleZones.map(z => z.pairId))];

  // Circle zone filtering: for each pair, user's pickup must be in pair's pickup circle AND dropoff in pair's dropoff circle
  // If multiple pairs, show union of all matching users
  const getZoneFilteredUserIds = (): Set<string> | null => {
    if (circleZones.length === 0) return null; // no zone filtering

    const matchedIds = new Set<string>();
    
    for (const pairId of pairIds) {
      const pickupZone = circleZones.find(z => z.pairId === pairId && z.type === 'pickup');
      const dropoffZone = circleZones.find(z => z.pairId === pairId && z.type === 'dropoff');
      
      for (const u of allUsers) {
        if (hiddenUserIds.has(u.id)) continue;
        
        let pickupMatch = true;
        let dropoffMatch = true;
        
        if (pickupZone) {
          pickupMatch = isInRadius(u.originLat, u.originLng, pickupZone.lat, pickupZone.lng, pickupZone.radius);
        }
        if (dropoffZone) {
          dropoffMatch = isInRadius(u.destinationLat, u.destinationLng, dropoffZone.lat, dropoffZone.lng, dropoffZone.radius);
        }
        
        if (pickupMatch && dropoffMatch) {
          matchedIds.add(u.id);
        }
      }
    }
    
    return matchedIds;
  };

  const zoneFilteredIds = getZoneFilteredUserIds();

  // Filter logic
  const filteredUsers = allUsers.filter(u => {
    if (hiddenUserIds.has(u.id)) return false;

    // Zone filter
    if (zoneFilteredIds !== null && !zoneFilteredIds.has(u.id)) return false;

    // Time filter
    if (filters.timeFrom && u.preferredTime) {
      if (u.preferredTime < filters.timeFrom) return false;
    }
    if (filters.timeTo && u.preferredTime) {
      if (u.preferredTime > filters.timeTo) return false;
    }
    if ((filters.timeFrom || filters.timeTo) && !u.preferredTime) return false;

    // Day filter
    if (filters.days.length > 0) {
      if (u.preferredDays.length === 0) return false;
      if (filters.commonDaysOnly) {
        // User must have ALL selected days
        if (!filters.days.every(d => u.preferredDays.includes(d))) return false;
      } else {
        if (!filters.days.some(d => u.preferredDays.includes(d))) return false;
      }
    }

    return true;
  });

  // Hourly distribution (all non-hidden users, ignoring time filter)
  const hourlyDistribution = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) counts[h] = 0;
    allUsers.forEach(u => {
      if (hiddenUserIds.has(u.id)) return;
      if (zoneFilteredIds !== null && !zoneFilteredIds.has(u.id)) return;
      if (filters.days.length > 0 && (u.preferredDays.length === 0 || !filters.days.some(d => u.preferredDays.includes(d)))) return;
      if (u.preferredTime) {
        const hour = parseInt(u.preferredTime.split(':')[0], 10);
        if (!isNaN(hour)) counts[hour]++;
      }
    });
    return Object.entries(counts).map(([h, count]) => ({ hour: Number(h), count }));
  }, [allUsers, hiddenUserIds, zoneFilteredIds, filters.days]);

  // Map click handler
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Adding a circle zone
    if (addingCircleType && addingCirclePairId) {
      const pairIndex = pairIds.indexOf(addingCirclePairId);
      const pairName = circleZones.find(z => z.pairId === addingCirclePairId)?.pairName || addingCirclePairId;
      const newZone: CircleZone = {
        id: crypto.randomUUID(),
        pairId: addingCirclePairId,
        pairName,
        type: addingCircleType,
        lat, lng,
        radius: 5000,
      };
      setCircleZones(prev => [...prev, newZone]);
      setAddingCircleType(null);
      setAddingCirclePairId('');
      return;
    }

    // Route building
    if (!routeMode) return;

    const geocoder = new google.maps.Geocoder();
    let name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res.results[0]) name = res.results[0].formatted_address.split(',').slice(0, 2).join(',');
    } catch {}

    if (!startPoint) {
      setStartPoint({ lat, lng, name });
    } else if (!endPoint) {
      setEndPoint({ lat, lng, name });
    } else {
      const newStop: RouteStop = {
        id: crypto.randomUUID(),
        lat, lng, name,
        assignedUsers: [],
        order: routeStops.length,
      };
      setRouteStops(prev => [...prev, newStop]);
    }
  }, [routeMode, startPoint, endPoint, routeStops, addingCircleType, addingCirclePairId, circleZones, pairIds]);

  // Generate optimized route
  const handleGenerateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) {
      toast({ title: 'Set start and end points first', variant: 'destructive' });
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const waypoints = routeStops.map(s => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    try {
      const result = await directionsService.route({
        origin: new google.maps.LatLng(startPoint.lat, startPoint.lng),
        destination: new google.maps.LatLng(endPoint.lat, endPoint.lng),
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setGeneratedRoute(result);

      if (result.routes[0]?.waypoint_order) {
        const order = result.routes[0].waypoint_order;
        const reordered = order.map((i, idx) => ({ ...routeStops[i], order: idx }));
        setRouteStops(reordered);
      }

      const legs = result.routes[0]?.legs || [];
      const totalDist = legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
      const totalDur = legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
      setRouteInfo({
        distance: `${(totalDist / 1000).toFixed(1)} km`,
        duration: `${Math.round(totalDur / 60)} min`,
      });
    } catch (err: any) {
      toast({ title: 'Route generation failed', description: err.message, variant: 'destructive' });
    }
  }, [startPoint, endPoint, routeStops, toast]);

  // Show connected routes
  const handleToggleConnectedRoutes = useCallback(async () => {
    if (showConnectedRoutes) {
      setShowConnectedRoutes(false);
      setConnectedDirections([]);
      setConnectedRouteInfo(null);
      // Restore original positions
      if (Object.keys(originalPositions).length > 0) {
        setAllUsers(prev => prev.map(u => {
          const orig = originalPositions[u.id];
          if (orig) return { ...u, originLat: orig.oLat, originLng: orig.oLng, destinationLat: orig.dLat, destinationLng: orig.dLng };
          return u;
        }));
        setOriginalPositions({});
      }
      return;
    }

    const users = filteredUsers.slice(0, 25);
    if (users.length < 2) {
      toast({ title: 'Need at least 2 visible users', variant: 'destructive' });
      return;
    }

    // Save original positions before allowing dragging
    const positions: Record<string, { oLat: number; oLng: number; dLat: number; dLng: number }> = {};
    users.forEach(u => { positions[u.id] = { oLat: u.originLat, oLng: u.originLng, dLat: u.destinationLat, dLng: u.destinationLng }; });
    setOriginalPositions(positions);

    setLoadingRoutes(true);
    setShowConnectedRoutes(true);
    const ds = new google.maps.DirectionsService();
    const results: google.maps.DirectionsResult[] = [];

    try {
      const pickupPoints = users.map(u => ({ lat: u.originLat, lng: u.originLng }));
      if (pickupPoints.length <= 25) {
        const pickupOrigin = pickupPoints[0];
        const pickupDest = pickupPoints[pickupPoints.length - 1];
        const pickupWaypoints = pickupPoints.slice(1, -1).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        }));
        try {
          const pickupRoute = await ds.route({
            origin: new google.maps.LatLng(pickupOrigin.lat, pickupOrigin.lng),
            destination: new google.maps.LatLng(pickupDest.lat, pickupDest.lng),
            waypoints: pickupWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(pickupRoute);
        } catch (e) {
          console.error('Pickup chain route failed:', e);
        }
      }

      const dropoffPoints = users.map(u => ({ lat: u.destinationLat, lng: u.destinationLng }));
      if (dropoffPoints.length <= 25) {
        const dropOrigin = dropoffPoints[0];
        const dropDest = dropoffPoints[dropoffPoints.length - 1];
        const dropWaypoints = dropoffPoints.slice(1, -1).map(p => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          stopover: true,
        }));
        try {
          const dropoffRoute = await ds.route({
            origin: new google.maps.LatLng(dropOrigin.lat, dropOrigin.lng),
            destination: new google.maps.LatLng(dropDest.lat, dropDest.lng),
            waypoints: dropWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(dropoffRoute);
        } catch (e) {
          console.error('Dropoff chain route failed:', e);
        }
      }

      if (results.length >= 1) {
        const pickupRoute = results[0];
        const lastPickupLeg = pickupRoute.routes[0]?.legs;
        const lastPickup = lastPickupLeg?.[lastPickupLeg.length - 1]?.end_location;
        const dropoffRoute = results.length >= 2 ? results[1] : null;
        const firstDropoff = dropoffRoute?.routes[0]?.legs?.[0]?.start_location;
        if (lastPickup && firstDropoff) {
          try {
            const bridgeRoute = await ds.route({
              origin: lastPickup,
              destination: firstDropoff,
              travelMode: google.maps.TravelMode.DRIVING,
            });
            results.splice(1, 0, bridgeRoute);
          } catch (e) {
            console.error('Bridge route failed:', e);
          }
        }
      }
    } catch (err) {
      console.error('Connected routes error:', err);
    }

    setConnectedDirections(results);

    // Calculate total duration/distance
    let totalDist = 0;
    let totalDur = 0;
    results.forEach(dir => {
      dir.routes[0]?.legs?.forEach(l => {
        totalDist += l.distance?.value || 0;
        totalDur += l.duration?.value || 0;
      });
    });
    setConnectedRouteInfo({
      distance: `${(totalDist / 1000).toFixed(1)} km`,
      duration: `${Math.round(totalDur / 60)} min`,
    });

    setLoadingRoutes(false);
  }, [showConnectedRoutes, filteredUsers, toast]);

  // Auto-recalculate connected routes after marker drag
  const recalculateConnectedRoutes = useCallback(async (users: RouteRequestUser[]) => {
    if (!showConnectedRoutes || users.length < 2) return;
    setLoadingRoutes(true);
    const ds = new google.maps.DirectionsService();
    const results: google.maps.DirectionsResult[] = [];

    try {
      const pickupPoints = users.map(u => ({ lat: u.originLat, lng: u.originLng }));
      if (pickupPoints.length >= 2 && pickupPoints.length <= 25) {
        try {
          const pickupRoute = await ds.route({
            origin: new google.maps.LatLng(pickupPoints[0].lat, pickupPoints[0].lng),
            destination: new google.maps.LatLng(pickupPoints[pickupPoints.length - 1].lat, pickupPoints[pickupPoints.length - 1].lng),
            waypoints: pickupPoints.slice(1, -1).map(p => ({ location: new google.maps.LatLng(p.lat, p.lng), stopover: true })),
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(pickupRoute);
        } catch (e) { console.error('Pickup recalc failed:', e); }
      }

      const dropoffPoints = users.map(u => ({ lat: u.destinationLat, lng: u.destinationLng }));
      if (dropoffPoints.length >= 2 && dropoffPoints.length <= 25) {
        try {
          const dropoffRoute = await ds.route({
            origin: new google.maps.LatLng(dropoffPoints[0].lat, dropoffPoints[0].lng),
            destination: new google.maps.LatLng(dropoffPoints[dropoffPoints.length - 1].lat, dropoffPoints[dropoffPoints.length - 1].lng),
            waypoints: dropoffPoints.slice(1, -1).map(p => ({ location: new google.maps.LatLng(p.lat, p.lng), stopover: true })),
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });
          results.push(dropoffRoute);
        } catch (e) { console.error('Dropoff recalc failed:', e); }
      }

      // Bridge
      if (results.length >= 2) {
        const lastPickupLeg = results[0].routes[0]?.legs;
        const lastPickup = lastPickupLeg?.[lastPickupLeg.length - 1]?.end_location;
        const firstDropoff = results[1]?.routes[0]?.legs?.[0]?.start_location;
        if (lastPickup && firstDropoff) {
          try {
            const bridge = await ds.route({ origin: lastPickup, destination: firstDropoff, travelMode: google.maps.TravelMode.DRIVING });
            results.splice(1, 0, bridge);
          } catch (e) { console.error('Bridge recalc failed:', e); }
        }
      }
    } catch (err) { console.error('Recalculate error:', err); }

    setConnectedDirections(results);
    let totalDist = 0, totalDur = 0;
    results.forEach(dir => { dir.routes[0]?.legs?.forEach(l => { totalDist += l.distance?.value || 0; totalDur += l.duration?.value || 0; }); });
    setConnectedRouteInfo({ distance: `${(totalDist / 1000).toFixed(1)} km`, duration: `${Math.round(totalDur / 60)} min` });
    setLoadingRoutes(false);
  }, [showConnectedRoutes]);

  // Save route
  const handleSaveRoute = async () => {
    if (!startPoint || !endPoint || !routeNameEn) return;
    setSaving(true);
    try {
      const durationMin = routeInfo ? parseInt(routeInfo.duration) || 30 : 30;
      const { data: routeData, error: routeErr } = await supabase.from('routes').insert({
        name_en: routeNameEn,
        name_ar: routeNameAr || routeNameEn,
        origin_name_en: startPoint.name,
        origin_name_ar: startPoint.name,
        origin_lat: startPoint.lat,
        origin_lng: startPoint.lng,
        destination_name_en: endPoint.name,
        destination_name_ar: endPoint.name,
        destination_lat: endPoint.lat,
        destination_lng: endPoint.lng,
        price: parseFloat(price) || 0,
        estimated_duration_minutes: durationMin,
        status: 'active',
      }).select().single();

      if (routeErr) throw routeErr;

      if (routeStops.length > 0 && routeData) {
        const stopsToInsert = routeStops.map((s, i) => ({
          route_id: routeData.id,
          name_en: s.name,
          name_ar: s.name,
          lat: s.lat,
          lng: s.lng,
          stop_order: i + 1,
          stop_type: 'both' as const,
        }));
        await supabase.from('stops').insert(stopsToInsert);
      }

      toast({ title: 'Route saved!', description: `${routeNameEn} created with ${routeStops.length} stops` });
      handleClearRoute();
      navigate('/admin');
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteStops([]);
    setGeneratedRoute(null);
    setRouteInfo(null);
    setRouteNameEn('');
    setRouteNameAr('');
    setPrice('');
  };

  // Save connected route to route management
  const handleSaveConnectedRoute = async () => {
    if (connectedDirections.length === 0) return;
    setSavingConnectedRoute(true);
    try {
      // Extract start and end from the connected directions
      const pickupRoute = connectedDirections[0];
      const lastRoute = connectedDirections[connectedDirections.length - 1];
      const startLeg = pickupRoute?.routes[0]?.legs?.[0];
      const lastLegs = lastRoute?.routes[0]?.legs;
      const endLeg = lastLegs?.[lastLegs.length - 1];

      const originName = startLeg?.start_address || 'Start';
      const destName = endLeg?.end_address || 'End';
      const originLat = startLeg?.start_location?.lat() || 0;
      const originLng = startLeg?.start_location?.lng() || 0;
      const destLat = endLeg?.end_location?.lat() || 0;
      const destLng = endLeg?.end_location?.lng() || 0;

      // Collect all waypoints as stops (all pickups then all dropoffs)
      const users = filteredUsers.slice(0, 25);
      const allStops: { name: string; lat: number; lng: number; type: string }[] = [];

      // Pickup stops from optimized order
      const pickupLegs = pickupRoute?.routes[0]?.legs || [];
      pickupLegs.forEach((leg, i) => {
        if (i === 0) {
          allStops.push({ name: leg.start_address || `Pickup ${i+1}`, lat: leg.start_location.lat(), lng: leg.start_location.lng(), type: 'pickup' });
        }
        allStops.push({ name: leg.end_address || `Pickup ${i+2}`, lat: leg.end_location.lat(), lng: leg.end_location.lng(), type: 'pickup' });
      });

      // Dropoff stops from optimized order
      const dropoffRoute = connectedDirections.length >= 3 ? connectedDirections[2] : connectedDirections.length >= 2 ? connectedDirections[1] : null;
      const dropoffLegs = dropoffRoute?.routes[0]?.legs || [];
      dropoffLegs.forEach((leg, i) => {
        if (i === 0) {
          allStops.push({ name: leg.start_address || `Dropoff ${i+1}`, lat: leg.start_location.lat(), lng: leg.start_location.lng(), type: 'dropoff' });
        }
        allStops.push({ name: leg.end_address || `Dropoff ${i+2}`, lat: leg.end_location.lat(), lng: leg.end_location.lng(), type: 'dropoff' });
      });

      // Deduplicate stops by proximity
      const uniqueStops: typeof allStops = [];
      allStops.forEach(s => {
        const exists = uniqueStops.some(e => Math.abs(e.lat - s.lat) < 0.001 && Math.abs(e.lng - s.lng) < 0.001);
        if (!exists) uniqueStops.push(s);
      });

      // Calculate total distance/duration
      let totalDur = 0;
      connectedDirections.forEach(dir => {
        dir.routes[0]?.legs?.forEach(l => { totalDur += l.duration?.value || 0; });
      });

      const routeName = `${originName.split(',')[0]} → ${destName.split(',')[0]}`;
      const { data: routeData, error: routeErr } = await supabase.from('routes').insert({
        name_en: routeName,
        name_ar: routeName,
        origin_name_en: originName,
        origin_name_ar: originName,
        origin_lat: originLat,
        origin_lng: originLng,
        destination_name_en: destName,
        destination_name_ar: destName,
        destination_lat: destLat,
        destination_lng: destLng,
        price: 0,
        estimated_duration_minutes: Math.round(totalDur / 60),
        status: 'active',
      }).select().single();

      if (routeErr) throw routeErr;

      if (uniqueStops.length > 0 && routeData) {
        const stopsInsert = uniqueStops.map((s, i) => ({
          route_id: routeData.id,
          name_en: s.name.split(',').slice(0, 2).join(','),
          name_ar: s.name.split(',').slice(0, 2).join(','),
          lat: s.lat,
          lng: s.lng,
          stop_order: i + 1,
          stop_type: s.type as 'pickup' | 'dropoff' | 'both',
        }));
        await supabase.from('stops').insert(stopsInsert);
      }

      toast({ title: 'Route saved!', description: `${routeName} with ${uniqueStops.length} stops` });
      navigate('/admin');
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingConnectedRoute(false);
    }
  };

  // Open route in Google Maps
  const handleOpenInGoogleMaps = useCallback(() => {
    const users = filteredUsers.slice(0, 25);
    if (users.length < 1) return;

    // Build ordered points: all pickups then all dropoffs
    const pickups = users.map(u => ({ lat: u.originLat, lng: u.originLng }));
    const dropoffs = users.map(u => ({ lat: u.destinationLat, lng: u.destinationLng }));
    const allPoints = [...pickups, ...dropoffs];

    // Deduplicate by proximity
    const unique: { lat: number; lng: number }[] = [];
    allPoints.forEach(p => {
      if (!unique.some(u => Math.abs(u.lat - p.lat) < 0.0005 && Math.abs(u.lng - p.lng) < 0.0005)) {
        unique.push(p);
      }
    });

    if (unique.length < 2) return;

    const origin = unique[0];
    const destination = unique[unique.length - 1];
    // Google Maps URL supports max ~10 waypoints
    const waypoints = unique.slice(1, -1).slice(0, 10);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    if (waypoints.length > 0) {
      const wp = waypoints.map(p => `${p.lat},${p.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(wp)}`;
    }
    window.open(url, '_blank');
  }, [filteredUsers]);

  const handleAssignUser = (userId: string, stopId: string) => {
    setRouteStops(prev => prev.map(s => {
      if (s.id === stopId) {
        const has = s.assignedUsers.includes(userId);
        return { ...s, assignedUsers: has ? s.assignedUsers.filter(u => u !== userId) : [...s.assignedUsers, userId] };
      }
      return s;
    }));
  };

  const toggleHide = (userId: string) => {
    setHiddenUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
    if (selectedUser?.id === userId) setSelectedUser(null);
  };

  // Circle zone helpers
  const handleUpdateZoneRadius = (zoneId: string, radius: number) => {
    setCircleZones(prev => prev.map(z => z.id === zoneId ? { ...z, radius } : z));
  };

  const handleMoveZone = (zoneId: string, lat: number, lng: number) => {
    setCircleZones(prev => prev.map(z => z.id === zoneId ? { ...z, lat, lng } : z));
  };

  const handleDeleteZone = (zoneId: string) => {
    setCircleZones(prev => prev.filter(z => z.id !== zoneId));
  };

  const handleDeletePair = (pairId: string) => {
    setCircleZones(prev => prev.filter(z => z.pairId !== pairId));
  };

  const getZoneColor = (zone: CircleZone) => {
    const idx = pairIds.indexOf(zone.pairId) % ZONE_COLORS.length;
    const colors = ZONE_COLORS[idx];
    return zone.type === 'pickup' ? colors.pickup : colors.dropoff;
  };

  if (!isLoaded || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const routeColors = ['#22c55e', '#ef4444', '#f59e0b'];

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <MapToolbar
        filters={filters}
        onFiltersChange={setFilters}
        showLines={showLines}
        onToggleLines={() => setShowLines(!showLines)}
        showConnectedRoutes={showConnectedRoutes}
        onToggleConnectedRoutes={handleToggleConnectedRoutes}
        onGenerateRoute={handleGenerateRoute}
        routeMode={routeMode}
        onToggleRouteMode={() => { setRouteMode(!routeMode); if (routeMode) handleClearRoute(); }}
        visibleCount={filteredUsers.length}
        totalCount={allUsers.length}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        loadingRoutes={loadingRoutes}
        circleZones={circleZones}
        onAddCircleZone={(pairId, type) => { setAddingCirclePairId(pairId); setAddingCircleType(type); }}
        onCreatePair={(name) => {
          const pairId = crypto.randomUUID().slice(0, 8);
          // Just store the pair name, zones added via map clicks
          setCircleZones(prev => [...prev, {
            id: crypto.randomUUID(),
            pairId,
            pairName: name,
            type: 'pickup',
            lat: 30.05,
            lng: 31.25,
            radius: 5000,
          }]);
        }}
        onDeletePair={handleDeletePair}
        onDeleteZone={handleDeleteZone}
        onUpdateZoneRadius={handleUpdateZoneRadius}
        addingCircleType={addingCircleType}
        addingCirclePairId={addingCirclePairId}
        onCancelAdding={() => { setAddingCircleType(null); setAddingCirclePairId(''); }}
        hourlyDistribution={hourlyDistribution}
        canSaveConnectedRoute={showConnectedRoutes && connectedDirections.length > 0}
        onSaveConnectedRoute={handleSaveConnectedRoute}
        savingConnectedRoute={savingConnectedRoute}
        onOpenInGoogleMaps={handleOpenInGoogleMaps}
        onFilterCommonDays={() => setFilters(f => ({ ...f, commonDaysOnly: !f.commonDaysOnly }))}
        commonDaysActive={!!filters.commonDaysOnly}
        zonesLocked={zonesLocked}
        onToggleZonesLocked={() => setZonesLocked(l => !l)}
      />

      <UserSidebar
        users={allUsers}
        hiddenUserIds={hiddenUserIds}
        onToggleHide={toggleHide}
        onHideAll={(ids) => setHiddenUserIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; })}
        onUnhideAll={() => setHiddenUserIds(new Set())}
        onSelectUser={(u) => setSelectedUser(selectedUser?.id === u.id ? null : u)}
        selectedUserId={selectedUser?.id || null}
        routeMode={routeMode}
        routeStops={routeStops}
        onAssignUser={handleAssignUser}
      />

      {routeMode && (
        <RouteBuilder
          stops={routeStops}
          startPoint={startPoint}
          endPoint={endPoint}
          onRemoveStop={(id) => setRouteStops(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })))}
          onReorderStops={setRouteStops}
          onClearRoute={handleClearRoute}
          onSaveRoute={handleSaveRoute}
          routeInfo={routeInfo}
          users={filteredUsers}
          saving={saving}
          routeNameEn={routeNameEn}
          routeNameAr={routeNameAr}
          onRouteNameEnChange={setRouteNameEn}
          onRouteNameArChange={setRouteNameAr}
          price={price}
          onPriceChange={setPrice}
        />
      )}

      {/* Adding circle instruction */}
      {addingCircleType && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          Click on the map to place {addingCircleType} circle
          <Button variant="ghost" size="sm" className="ml-2 text-primary-foreground h-6" onClick={() => { setAddingCircleType(null); setAddingCirclePairId(''); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Connected route info overlay */}
      {showConnectedRoutes && connectedRouteInfo && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-card/95 backdrop-blur border border-border px-5 py-3 rounded-xl shadow-lg flex items-center gap-4">
          <div className="text-sm font-medium text-foreground">🛣️ {connectedRouteInfo.distance}</div>
          <div className="text-sm font-medium text-foreground">⏱️ {connectedRouteInfo.duration}</div>
          <div className="text-xs text-muted-foreground">{filteredUsers.length} users</div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={cairoCenter}
        zoom={11}
        onClick={handleMapClick}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          gestureHandling: 'greedy',
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        }}
      >
        {/* Circle zones */}
        {circleZones.map(zone => {
          const color = getZoneColor(zone);
          return (
            <Circle
              key={zone.id}
              center={{ lat: zone.lat, lng: zone.lng }}
              radius={zone.radius}
              draggable={!zonesLocked}
              onDragEnd={(e) => {
                if (e.latLng && !zonesLocked) handleMoveZone(zone.id, e.latLng.lat(), e.latLng.lng());
              }}
              options={{
                fillColor: color,
                fillOpacity: 0.12,
                strokeColor: color,
                strokeWeight: 2,
                strokeOpacity: 0.7,
              }}
            />
          );
        })}

        {/* Zone labels */}
        {circleZones.map(zone => (
          <Marker
            key={`label-${zone.id}`}
            position={{ lat: zone.lat, lng: zone.lng }}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28"><rect width="120" height="28" rx="6" fill="${getZoneColor(zone)}" opacity="0.85"/><text x="60" y="18" text-anchor="middle" fill="white" font-size="11" font-family="Arial" font-weight="bold">${zone.pairName} ${zone.type === 'pickup' ? '🟢 PU' : '🔴 DO'}</text></svg>`)}`,
              scaledSize: new google.maps.Size(120, 28),
              anchor: new google.maps.Point(60, 14),
            }}
            clickable={false}
          />
        ))}

        {/* Pickup markers (green) */}
        {filteredUsers.map(u => (
          <Marker
            key={`p-${u.id}`}
            position={{ lat: u.originLat, lng: u.originLng }}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
            draggable={showConnectedRoutes}
            onClick={() => setSelectedUser(u)}
            onDragEnd={(e) => {
              if (!e.latLng) return;
              const newLat = e.latLng.lat(), newLng = e.latLng.lng();
              setAllUsers(prev => {
                const updated = prev.map(usr => usr.id === u.id ? { ...usr, originLat: newLat, originLng: newLng } : usr);
                // Auto-recalculate with updated positions
                const visible = updated.filter(usr => !hiddenUserIds.has(usr.id));
                setTimeout(() => recalculateConnectedRoutes(visible.slice(0, 25)), 100);
                return updated;
              });
            }}
          />
        ))}

        {/* Dropoff markers (red) */}
        {filteredUsers.map(u => (
          <Marker
            key={`d-${u.id}`}
            position={{ lat: u.destinationLat, lng: u.destinationLng }}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
            draggable={showConnectedRoutes}
            onClick={() => setSelectedUser(u)}
            onDragEnd={(e) => {
              if (!e.latLng) return;
              const newLat = e.latLng.lat(), newLng = e.latLng.lng();
              setAllUsers(prev => {
                const updated = prev.map(usr => usr.id === u.id ? { ...usr, destinationLat: newLat, destinationLng: newLng } : usr);
                const visible = updated.filter(usr => !hiddenUserIds.has(usr.id));
                setTimeout(() => recalculateConnectedRoutes(visible.slice(0, 25)), 100);
                return updated;
              });
            }}
          />
        ))}

        {/* Pickup→Dropoff lines */}
        {showLines && filteredUsers.map(u => (
          <Polyline
            key={`line-${u.id}`}
            path={[
              { lat: u.originLat, lng: u.originLng },
              { lat: u.destinationLat, lng: u.destinationLng },
            ]}
            options={{
              strokeColor: '#6366f1',
              strokeWeight: 1.5,
              strokeOpacity: 0.5,
              geodesic: true,
            }}
          />
        ))}

        {/* Connected routes */}
        {connectedDirections.map((dir, i) => (
          <DirectionsRenderer
            key={`cr-${i}`}
            directions={dir}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: routeColors[i] || '#f59e0b',
                strokeWeight: 3,
                strokeOpacity: 0.7,
              },
            }}
          />
        ))}

        {/* Connected route start/end markers */}
        {showConnectedRoutes && connectedDirections.length > 0 && (() => {
          const firstRoute = connectedDirections[0];
          const lastRoute = connectedDirections[connectedDirections.length - 1];
          const startLoc = firstRoute?.routes[0]?.legs?.[0]?.start_location;
          const lastLegs = lastRoute?.routes[0]?.legs;
          const endLoc = lastLegs?.[lastLegs.length - 1]?.end_location;
          return (
            <>
              {startLoc && (
                <Marker
                  position={{ lat: startLoc.lat(), lng: startLoc.lng() }}
                  icon={{
                    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#22c55e" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">S</text></svg>`)}`,
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 20),
                  }}
                  zIndex={100}
                />
              )}
              {endLoc && (
                <Marker
                  position={{ lat: endLoc.lat(), lng: endLoc.lng() }}
                  icon={{
                    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="#ef4444" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">E</text></svg>`)}`,
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 20),
                  }}
                  zIndex={100}
                />
              )}
            </>
          );
        })()}

        {/* Generated route */}
        {generatedRoute && (
          <DirectionsRenderer
            directions={generatedRoute}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.8 },
            }}
          />
        )}

        {/* Route builder markers */}
        {startPoint && (
          <Marker
            position={{ lat: startPoint.lat, lng: startPoint.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(40, 40) }}
            label={{ text: 'S', color: 'white', fontWeight: 'bold' }}
          />
        )}
        {endPoint && (
          <Marker
            position={{ lat: endPoint.lat, lng: endPoint.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png', scaledSize: new google.maps.Size(40, 40) }}
            label={{ text: 'E', color: 'white', fontWeight: 'bold' }}
          />
        )}
        {routeStops.map((s, i) => (
          <Marker
            key={s.id}
            position={{ lat: s.lat, lng: s.lng }}
            icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png', scaledSize: new google.maps.Size(36, 36) }}
            label={{ text: `${i + 1}`, color: 'white', fontWeight: 'bold' }}
            draggable
            onDragEnd={(e) => {
              if (!e.latLng) return;
              setRouteStops(prev => prev.map(st => st.id === s.id ? { ...st, lat: e.latLng!.lat(), lng: e.latLng!.lng() } : st));
            }}
          />
        ))}

        {/* InfoWindow with Hide button */}
        {selectedUser && (
          <InfoWindow
            position={{ lat: selectedUser.originLat, lng: selectedUser.originLng }}
            onCloseClick={() => setSelectedUser(null)}
          >
            <div className="text-xs space-y-1 max-w-[220px]">
              <p className="font-bold">{selectedUser.name}</p>
              {selectedUser.phone && <p>📞 {selectedUser.phone}</p>}
              <p>🟢 {selectedUser.originName}</p>
              <p>🔴 {selectedUser.destinationName}</p>
              {selectedUser.preferredTime && <p>🕐 {selectedUser.preferredTime}</p>}
              {selectedUser.preferredDays.length > 0 && (
                <p>📅 {selectedUser.preferredDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</p>
              )}
              <p className="text-gray-400">{selectedUser.requestIds.length} request(s)</p>
              <button
                onClick={() => toggleHide(selectedUser.id)}
                style={{
                  marginTop: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                👁‍🗨 Hide User
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default GlobalMap;
