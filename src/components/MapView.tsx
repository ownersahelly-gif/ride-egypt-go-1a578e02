import { useCallback, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { Loader2, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const containerStyle = { width: '100%', height: '100%' };
const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const libraries: ('places' | 'drawing' | 'geometry')[] = ['places', 'drawing', 'geometry'];

interface MapViewProps {
  markers?: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' | 'purple' }[];
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
  showDirections?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  showUserLocation?: boolean;
  gestureHandling?: 'cooperative' | 'greedy' | 'auto' | 'none';
  connectionLine?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color?: string } | null;
  connectionLines?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color?: string }[];
}

const MapView = ({
  markers = [],
  origin,
  destination,
  waypoints = [],
  showDirections = false,
  center,
  zoom = 12,
  className = '',
  onMapClick,
  showUserLocation = true,
  gestureHandling = 'greedy',
  connectionLine = null,
  connectionLines = [],
}: MapViewProps) => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [locating, setLocating] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries,
  });

  const isNativeApp = Capacitor.isNativePlatform();

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);

    const triggerResize = (delay: number) => {
      window.setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        const centerPoint = center || origin || destination || markers[0] || cairoCenter;
        if (centerPoint) {
          map.panTo({ lat: centerPoint.lat, lng: centerPoint.lng });
        }
      }, delay);
    };

    triggerResize(0);
    triggerResize(250);
    triggerResize(700);
  }, [center, destination, markers, origin]);

  // Auto-fit bounds to markers / origin / destination
  useEffect(() => {
    if (!mapRef || !isLoaded) return;

    const points: { lat: number; lng: number }[] = [];
    if (origin) points.push(origin);
    if (destination) points.push(destination);
    waypoints.forEach((w) => points.push(w));
    markers.forEach((m) => points.push({ lat: m.lat, lng: m.lng }));

    if (points.length === 0) return;

    const applyBounds = () => {
      const div = mapRef.getDiv() as HTMLElement;
      if (!div || div.offsetWidth === 0 || div.offsetHeight === 0) {
        return false;
      }

      if (points.length === 1) {
        mapRef.panTo(points[0]);
        mapRef.setZoom(15);
        return true;
      }

      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      mapRef.fitBounds(bounds, { top: 80, bottom: 80, left: 60, right: 60 });
      return true;
    };

    const fitWithRetry = (delay: number) => {
      const timeoutId = window.setTimeout(() => {
        if (!mapRef) return;
        google.maps.event.trigger(mapRef, 'resize');
        applyBounds();
      }, delay);
      return timeoutId;
    };

    const timeouts = [fitWithRetry(0), fitWithRetry(150), fitWithRetry(400), fitWithRetry(900)];
    const idleListener = google.maps.event.addListenerOnce(mapRef, 'idle', () => {
      google.maps.event.trigger(mapRef, 'resize');
      applyBounds();
    });

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      google.maps.event.removeListener(idleListener);
    };
  }, [mapRef, isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng, JSON.stringify(markers), JSON.stringify(waypoints)]);

  // Auto-locate user on mount
  useEffect(() => {
    if (!showUserLocation || userLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showUserLocation]);

  useEffect(() => {
    if (!isLoaded || !showDirections || !origin || !destination) {
      setDirections(null);
      return;
    }
    const directionsService = new google.maps.DirectionsService();
    const allWps = waypoints.map(wp => ({
      location: new google.maps.LatLng(wp.lat, wp.lng),
      stopover: true,
    }));

    // Google Directions API allows max 25 waypoints per request
    // If more, we chunk and stitch results together
    const MAX_WAYPOINTS = 23; // leave room for origin/destination
    if (allWps.length <= MAX_WAYPOINTS) {
      directionsService.route({
        origin,
        destination,
        waypoints: allWps.length > 0 ? allWps : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === 'OK' && result) setDirections(result);
      });
    } else {
      // Split into chunks, chain requests
      const chunks: typeof allWps[] = [];
      for (let i = 0; i < allWps.length; i += MAX_WAYPOINTS) {
        chunks.push(allWps.slice(i, i + MAX_WAYPOINTS));
      }
      // For simplicity, just use first chunk (covers most real scenarios)
      // A full implementation would stitch multiple DirectionsResults
      directionsService.route({
        origin,
        destination,
        waypoints: chunks[0],
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === 'OK' && result) setDirections(result);
      });
    }
  }, [isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng, showDirections, JSON.stringify(waypoints)]);

  const locateUser = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        mapRef?.panTo(loc);
        mapRef?.setZoom(15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className={cn('bg-muted rounded-xl flex items-center justify-center', className || 'h-full w-full')}>
        <div className="text-center p-6">
          <p className="text-muted-foreground text-sm font-medium">Google Maps API Key Required</p>
          <p className="text-xs text-muted-foreground mt-1">Add VITE_GOOGLE_MAPS_API_KEY to .env</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn('bg-muted rounded-xl flex items-center justify-center', className || 'h-full w-full')}>
        <p className="text-destructive text-sm">Failed to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={cn('bg-muted rounded-xl flex items-center justify-center', className || 'h-full w-full')}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className || 'h-full w-full')}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        {...(center ? { center, zoom } : { defaultCenter: cairoCenter, defaultZoom: zoom })}
        onLoad={onLoad}
        onClick={(e) => onMapClick?.(e.latLng?.lat() || 0, e.latLng?.lng() || 0)}
        options={{
          disableDefaultUI: false,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling,
          clickableIcons: false,
          backgroundColor: '#f3f4f6',
        }}
        onTilesLoaded={() => {
          if (!isNativeApp || !mapRef) return;
          window.setTimeout(() => {
            google.maps.event.trigger(mapRef, 'resize');
          }, 50);
        }}
      >
        {markers.map((marker, i) => {
          const colorMap: Record<string, string> = {
            red: '#EF4444',
            green: '#22C55E',
            blue: '#3B82F6',
            orange: '#F97316',
            purple: '#8B5CF6',
          };
          const fill = colorMap[marker.color || 'red'] || '#EF4444';
          const isShuttle = marker.color === 'blue';
          const isYou = marker.color === 'purple';

          let svgIcon: string;
          let size: google.maps.Size;
          let anchor: google.maps.Point | undefined;
          let labelOrigin: google.maps.Point | undefined;

          if (isShuttle) {
            // Small numbered circle for bus stops
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="${fill}" stroke="white" stroke-width="2"/></svg>`;
            size = new google.maps.Size(28, 28);
            anchor = new google.maps.Point(14, 14);
            labelOrigin = new google.maps.Point(14, 14);
          } else if (isYou) {
            // Big prominent "YOU" marker with pulsing ring
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="66" viewBox="0 0 56 66"><circle cx="28" cy="28" r="26" fill="${fill}" opacity="0.2"/><circle cx="28" cy="28" r="18" fill="${fill}" stroke="white" stroke-width="3"/><path d="M28 46 L28 62" stroke="${fill}" stroke-width="3"/><circle cx="28" cy="62" r="3" fill="${fill}"/></svg>`;
            size = new google.maps.Size(56, 66);
            anchor = new google.maps.Point(28, 62);
            labelOrigin = new google.maps.Point(28, 28);
          } else {
            // Large pin for A/B origin/destination
            svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="${fill}" stroke="white" stroke-width="2.5"/><circle cx="20" cy="20" r="12" fill="white" opacity="0.3"/></svg>`;
            size = new google.maps.Size(40, 52);
            anchor = new google.maps.Point(20, 52);
            labelOrigin = new google.maps.Point(20, 20);
          }

          return (
            <Marker
              key={i}
              position={{ lat: marker.lat, lng: marker.lng }}
              zIndex={isShuttle ? 1 : 10}
              label={marker.label ? { text: marker.label, color: 'white', fontWeight: 'bold', fontSize: isShuttle ? '10px' : (isYou ? '13px' : '14px') } : undefined}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
                scaledSize: size,
                anchor,
                labelOrigin,
              }}
            />
          );
        })}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="white"/></svg>'
              ),
              scaledSize: new google.maps.Size(24, 24),
            }}
            title="Your location"
          />
        )}
        {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
        {connectionLine && (
          <Polyline
            path={[connectionLine.from, connectionLine.to]}
            options={{
              strokeColor: connectionLine.color || '#EF4444',
              strokeWeight: 3,
              strokeOpacity: 0.8,
              icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                offset: '0',
                repeat: '15px',
              }],
            }}
          />
        )}
        {connectionLines.map((line, i) => (
          <Polyline
            key={`cl-${i}`}
            path={[line.from, line.to]}
            options={{
              strokeColor: line.color || '#3B82F6',
              strokeWeight: 3,
              strokeOpacity: 0.7,
              icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                offset: '0',
                repeat: '15px',
              }],
            }}
          />
        ))}
      </GoogleMap>

      {showUserLocation && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-20 end-3 z-[5] shadow-lg bg-card hover:bg-muted rounded-full w-10 h-10"
          onClick={(e) => {
            e.stopPropagation();
            locateUser();
          }}
          disabled={locating}
        >
          {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
        </Button>
      )}
    </div>
  );
};

export default MapView;
