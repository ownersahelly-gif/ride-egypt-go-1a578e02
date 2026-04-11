import { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Loader2, LocateFixed, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const containerStyle = { width: '100%', height: '100%' };
const cairoCenter = { lat: 30.0444, lng: 31.2357 };
const libraries: ('places')[] = ['places'];

interface MapPinPickerProps {
  activePin: 'origin' | 'destination' | null;
  origin?: { lat: number; lng: number; name: string };
  destination?: { lat: number; lng: number; name: string };
  onConfirm: (type: 'origin' | 'destination', loc: { lat: number; lng: number; name: string }) => void;
  onCancel: () => void;
  className?: string;
}

const MapPinPicker = ({ activePin, origin, destination, onConfirm, onCancel, className = '' }: MapPinPickerProps) => {
  const { lang } = useLanguage();
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY, libraries });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
    geocoderRef.current = new google.maps.Geocoder();
  }, []);

  // Track map center as user pans
  useEffect(() => {
    if (!mapRef) return;
    const listener = mapRef.addListener('idle', () => {
      const c = mapRef.getCenter();
      if (c) setCenterCoords({ lat: c.lat(), lng: c.lng() });
    });
    return () => google.maps.event.removeListener(listener);
  }, [mapRef]);

  // Show directions when both points exist and no pin is being placed
  useEffect(() => {
    if (!isLoaded || !origin?.lat || !destination?.lat) {
      setDirections(null);
      return;
    }
    if (activePin) {
      setDirections(null);
      return;
    }
    const ds = new google.maps.DirectionsService();
    ds.route({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK' && result) setDirections(result);
    });
  }, [isLoaded, origin?.lat, origin?.lng, destination?.lat, destination?.lng, activePin]);

  const getInitialCenter = () => {
    if (activePin === 'origin' && origin?.lat) return { lat: origin.lat, lng: origin.lng };
    if (activePin === 'destination' && destination?.lat) return { lat: destination.lat, lng: destination.lng };
    if (origin?.lat) return { lat: origin.lat, lng: origin.lng };
    if (destination?.lat) return { lat: destination.lat, lng: destination.lng };
    return cairoCenter;
  };

  const handleConfirm = () => {
    if (!activePin || !centerCoords) return;
    // Reverse geocode to get a name
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: centerCoords }, (results, status) => {
        const name = status === 'OK' && results?.[0]
          ? results[0].formatted_address
          : `${centerCoords.lat.toFixed(4)}, ${centerCoords.lng.toFixed(4)}`;
        onConfirm(activePin, { ...centerCoords, name: name || '' });
      });
    } else {
      onConfirm(activePin, { ...centerCoords, name: `${centerCoords.lat.toFixed(4)}, ${centerCoords.lng.toFixed(4)}` });
    }
  };

  const locateUser = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef?.panTo(loc);
        mapRef?.setZoom(15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!GOOGLE_MAPS_KEY) {
    return <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}>
      <p className="text-muted-foreground text-sm">Google Maps API Key Required</p>
    </div>;
  }

  if (loadError) return <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}><p className="text-destructive text-sm">Failed to load Maps</p></div>;
  if (!isLoaded) return <div className={`bg-muted rounded-xl flex items-center justify-center ${className}`}><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const isOriginPin = activePin === 'origin';
  const pinColor = isOriginPin ? '#22C55E' : '#EF4444';

  // Build static markers for the non-active point
  const staticMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  if (!activePin || activePin !== 'origin') {
    if (origin?.lat) staticMarkers.push({ lat: origin.lat, lng: origin.lng, label: 'A', color: '#22C55E' });
  }
  if (!activePin || activePin !== 'destination') {
    if (destination?.lat) staticMarkers.push({ lat: destination.lat, lng: destination.lng, label: 'B', color: '#EF4444' });
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={getInitialCenter()}
        zoom={14}
        onLoad={onLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        }}
      >
        {staticMarkers.map((m, i) => (
          <Marker key={i} position={{ lat: m.lat, lng: m.lng }}
            label={{ text: m.label, color: 'white', fontWeight: 'bold', fontSize: '11px' }}
            icon={{
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="${m.color}" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="white" opacity="0.3"/></svg>`
              ),
              scaledSize: new google.maps.Size(28, 36),
              anchor: new google.maps.Point(14, 36),
              labelOrigin: new google.maps.Point(16, 16),
            }}
          />
        ))}
        {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
      </GoogleMap>

      {/* Center pin overlay - always centered on screen */}
      {activePin && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center -mt-10">
            <svg width="40" height="52" viewBox="0 0 32 42">
              <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill={pinColor} stroke="white" strokeWidth="2"/>
              <circle cx="16" cy="16" r="6" fill="white" opacity="0.9"/>
            </svg>
            <div className="w-2 h-2 rounded-full bg-black/30 mt-1" />
          </div>
        </div>
      )}

      {/* Instructions banner */}
      {activePin && (
        <div className="absolute top-3 left-3 right-3 z-10">
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-4 py-2.5 shadow-lg text-center">
            <p className="text-sm font-medium text-foreground">
              {lang === 'ar'
                ? (isOriginPin ? 'حرّك الخريطة لتحديد نقطة الانطلاق' : 'حرّك الخريطة لتحديد نقطة الوصول')
                : (isOriginPin ? 'Move the map to set pickup' : 'Move the map to set drop-off')}
            </p>
          </div>
        </div>
      )}

      {/* Confirm / Cancel buttons */}
      {activePin && (
        <div className="absolute bottom-4 left-3 right-3 z-10 flex gap-2">
          <Button variant="outline" className="flex-1 bg-card/95 backdrop-blur-sm" onClick={onCancel}>
            <X className="w-4 h-4 me-1" />
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            <Check className="w-4 h-4 me-1" />
            {lang === 'ar' ? 'تأكيد' : 'Confirm'}
          </Button>
        </div>
      )}

      {/* Locate me button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute bottom-20 end-3 z-[5] shadow-lg bg-card hover:bg-muted rounded-full w-10 h-10"
        onClick={locateUser}
        disabled={locating}
      >
        {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
      </Button>
    </div>
  );
};

export default MapPinPicker;
