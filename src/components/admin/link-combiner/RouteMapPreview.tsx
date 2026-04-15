import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, MapPin, Trash2, GripVertical, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { OrderedStop } from './types';
import { buildGoogleMapsLink, haversine } from './utils';

/** Reverse-geocode a position to get a readable address */
function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  });
}

interface Props {
  stops: OrderedStop[];
  onReorder: (stops: OrderedStop[]) => void;
  lang: string;
}

const PICKUP_COLORS = ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'];
const DROPOFF_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];

const RouteMapPreview = ({ stops, onReorder, lang }: Props) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialCenter] = useState<google.maps.LatLngLiteral>(() => {
    if (stops.length === 0) return { lat: 30.05, lng: 31.25 };
    const lat = stops.reduce((sum, stop) => sum + stop.lat, 0) / stops.length;
    const lng = stops.reduce((sum, stop) => sum + stop.lng, 0) / stops.length;
    return { lat, lng };
  });
  const hasInitializedView = useRef(false);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    if (hasInitializedView.current) return;
    hasInitializedView.current = true;
    map.setCenter(initialCenter);
    map.setZoom(11);
  }, [initialCenter]);

  // Fetch real road directions whenever stops change
  useEffect(() => {
    if (stops.length < 2) {
      setRoutePath([]);
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const origin = { lat: stops[0].lat, lng: stops[0].lng };
    const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };

    // Google Directions supports max 25 waypoints
    const waypoints = stops.slice(1, -1).map(s => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));

    setRouteLoading(true);

    directionsService.route(
      {
        origin,
        destination,
        waypoints: waypoints.slice(0, 25),
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false, // keep user's order
      },
      (result, status) => {
        setRouteLoading(false);
        if (status === 'OK' && result) {
          // Extract full polyline path from all legs
          const path: google.maps.LatLngLiteral[] = [];
          let totalDist = 0;
          let totalDur = 0;
          result.routes[0].legs.forEach(leg => {
            leg.steps.forEach(step => {
              step.path.forEach(point => {
                path.push({ lat: point.lat(), lng: point.lng() });
              });
            });
            totalDist += leg.distance?.value || 0;
            totalDur += leg.duration?.value || 0;
          });
          setRoutePath(path);
          setRouteDistance(totalDist / 1000); // km
          setRouteDuration(Math.round(totalDur / 60)); // minutes
        } else {
          // Fallback to straight lines
          setRoutePath(stops.map(s => ({ lat: s.lat, lng: s.lng })));
          setRouteDistance(null);
          setRouteDuration(null);
        }
      }
    );
  }, [stops]);

  const straightDistance = useMemo(() => {
    let d = 0;
    for (let i = 1; i < stops.length; i++) {
      d += haversine(stops[i - 1], stops[i]);
    }
    return d;
  }, [stops]);

  const handleMarkerDragEnd = useCallback(async (idx: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const newName = await reverseGeocode(newLat, newLng);
    const newStops = [...stops];
    newStops[idx] = { ...newStops[idx], lat: newLat, lng: newLng, name: newName };
    onReorder(newStops);
    toast.success(lang === 'ar' ? 'تم تحديث الموقع' : 'Location updated');
  }, [stops, onReorder, lang]);

  const deleteStop = useCallback((idx: number) => {
    const newStops = stops.filter((_, i) => i !== idx);
    onReorder(newStops);
    toast.success(lang === 'ar' ? 'تم حذف المحطة' : 'Stop removed');
  }, [stops, onReorder, lang]);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    dragRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const from = dragRef.current;
    if (from === null || from === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const newStops = [...stops];
    const [moved] = newStops.splice(from, 1);
    newStops.splice(idx, 0, moved);
    onReorder(newStops);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  const finalLink = useMemo(() => buildGoogleMapsLink(stops), [stops]);

  const copyLink = () => {
    navigator.clipboard.writeText(finalLink);
    toast.success(lang === 'ar' ? 'تم النسخ!' : 'Copied!');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('combined_routes' as any).insert({
        name: routeName.trim() || null,
        stops_json: stops,
        final_link: finalLink,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(lang === 'ar' ? 'تم حفظ المسار بنجاح!' : 'Route saved successfully!');
    } catch (err: any) {
      toast.error(err.message || (lang === 'ar' ? 'فشل في الحفظ' : 'Failed to save'));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-border relative" style={{ height: 350 }}>
        {routeLoading && (
          <div className="absolute top-2 left-2 z-10 bg-background/80 rounded-md px-2 py-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            {lang === 'ar' ? 'جارِ تحميل المسار...' : 'Loading route...'}
          </div>
        )}
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          options={{ disableDefaultUI: true, zoomControl: true }}
        >
          {stops.map((stop, idx) => (
            <Marker
              key={`marker-${idx}`}
              position={{ lat: stop.lat, lng: stop.lng }}
              draggable
              onDragEnd={(e) => handleMarkerDragEnd(idx, e)}
              label={{
                text: `${idx + 1}`,
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '11px',
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor: stop.type === 'P'
                  ? PICKUP_COLORS[stop.linkIdx % PICKUP_COLORS.length]
                  : DROPOFF_COLORS[stop.linkIdx % DROPOFF_COLORS.length],
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          ))}
          {routePath.length >= 2 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: '#4285F4',
                strokeOpacity: 0.9,
                strokeWeight: 4,
                geodesic: true,
              }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span>{stops.length} {lang === 'ar' ? 'محطة' : 'stops'}</span>
        {routeDistance !== null ? (
          <span className="font-medium text-foreground">
            {routeDistance.toFixed(1)} km {lang === 'ar' ? 'بالطريق' : 'by road'}
          </span>
        ) : (
          <span>~{straightDistance.toFixed(1)} km {lang === 'ar' ? 'مسافة مباشرة' : 'straight-line'}</span>
        )}
        {routeDuration !== null && (
          <span className="font-medium text-foreground">
            ~{routeDuration} {lang === 'ar' ? 'دقيقة' : 'min'}
          </span>
        )}
      </div>

      {/* Draggable stop list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {stops.map((stop, idx) => (
          <div
            key={`${stop.linkIdx}-${stop.type}-${idx}`}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-colors ${
              dragIdx === idx
                ? 'opacity-50 border-primary bg-primary/10'
                : overIdx === idx
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/30'
            }`}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="font-mono font-bold text-foreground w-5 shrink-0">{idx + 1}</span>
            <MapPin className={`w-3 h-3 shrink-0 ${stop.type === 'P' ? 'text-emerald-500' : 'text-destructive'}`} />
            <div className="flex-1 min-w-0">
              <span className="truncate block">{stop.name}</span>
              <span className="text-muted-foreground">
                {lang === 'ar'
                  ? `شخص ${stop.linkIdx + 1} — ${stop.type === 'P' ? 'التقاط' : 'توصيل'}`
                  : `Person ${stop.linkIdx + 1} — ${stop.type === 'P' ? 'Pickup' : 'Dropoff'}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:bg-destructive/10"
              onClick={() => deleteStop(idx)}
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Save & Final link */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-primary">
          {lang === 'ar' ? 'الرابط النهائي' : 'Final Route Link'}
        </p>
        <div className="flex gap-2">
          <input readOnly value={finalLink} className="text-xs flex-1 font-mono bg-background border border-input rounded px-2 py-1 min-w-0" />
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(finalLink, '_blank')}>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        {/* Save to database */}
        <div className="flex gap-2 items-end pt-2 border-t border-border">
          <div className="flex-1">
            <Input
              placeholder={lang === 'ar' ? 'اسم المسار (اختياري)...' : 'Route name (optional)...'}
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || stops.length < 2} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {lang === 'ar' ? 'حفظ' : 'Save Route'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {lang === 'ar'
            ? 'اسحب المحطات لتغيير الترتيب أو احذفها — الخريطة والرابط يتحدثان تلقائياً'
            : 'Drag stops to reorder or delete them — map and link update automatically'}
        </p>
      </div>
    </div>
  );
};

export default RouteMapPreview;
