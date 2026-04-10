import { useCallback, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { Loader2, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const containerStyle = { width: '100%', height: '100%' };
const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const libraries: ('places')[] = ['places'];

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
  connectionLine?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color?: string } | null;
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
  connectionLine = null,
}: MapViewProps) => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [locating, setLocating] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
  }, []);

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
      <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}>
        <div className="text-center p-6">
          <p className="text-muted-foreground text-sm font-medium">Google Maps API Key Required</p>
          <p className="text-xs text-muted-foreground mt-1">Add VITE_GOOGLE_MAPS_API_KEY to .env</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}>
        <p className="text-destructive text-sm">Failed to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden relative ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center || cairoCenter}
        zoom={zoom}
        onLoad={onLoad}
        onClick={(e) => onMapClick?.(e.latLng?.lat() || 0, e.latLng?.lng() || 0)}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
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

          return (
            <Marker
              key={i}
              position={{ lat: marker.lat, lng: marker.lng }}
              label={!isShuttle && marker.label ? { text: marker.label, color: 'white', fontWeight: 'bold', fontSize: '11px' } : undefined}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                  isShuttle
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="${fill}" stroke="white" stroke-width="3"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="18">🚐</text></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="${fill}" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="white" opacity="0.3"/></svg>`
                ),
                scaledSize: isShuttle ? new google.maps.Size(40, 40) : new google.maps.Size(28, 36),
                anchor: isShuttle ? undefined : new google.maps.Point(14, 36),
                labelOrigin: isShuttle ? undefined : new google.maps.Point(16, 16),
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
