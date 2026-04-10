import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, MapPin, Navigation } from 'lucide-react';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapView from '@/components/MapView';

type Location = { name: string; lat: number; lng: number };

const RequestRoute = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const passedState = (location.state as any) || {};

  const [origin, setOrigin] = useState<Location>(
    passedState.origin || { name: '', lat: 0, lng: 0 }
  );
  const [destination, setDestination] = useState<Location>(
    passedState.destination || { name: '', lat: 0, lng: 0 }
  );
  const [preferredTime, setPreferredTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePin, setActivePin] = useState<'origin' | 'destination' | null>(null);

  const handleMapClick = (lat: number, lng: number) => {
    if (!activePin) return;
    const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    if (activePin === 'origin') {
      setOrigin({ name: label, lat, lng });
    } else {
      setDestination({ name: label, lat, lng });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !origin.name || !destination.name) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('route_requests').insert({
        user_id: user.id,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_name: destination.name,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        preferred_time: preferredTime || null,
      });
      if (error) throw error;
      toast({ title: t('routeRequest.success'), description: t('routeRequest.successDesc') });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const markers = [
    ...(origin.lat ? [{ lat: origin.lat, lng: origin.lng, label: 'A', color: 'green' as const }] : []),
    ...(destination.lat ? [{ lat: destination.lat, lng: destination.lng, label: 'B', color: 'red' as const }] : []),
  ];

  const mapCenter = origin.lat ? { lat: origin.lat, lng: origin.lng }
    : destination.lat ? { lat: destination.lat, lng: destination.lng }
    : undefined;

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('dashboard.requestRoute')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Map */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MapPin className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              {activePin === 'origin'
                ? (lang === 'ar' ? 'انقر على الخريطة لتحديد نقطة الانطلاق' : 'Click the map to set pickup location')
                : activePin === 'destination'
                ? (lang === 'ar' ? 'انقر على الخريطة لتحديد نقطة الوصول' : 'Click the map to set drop-off location')
                : (lang === 'ar' ? 'اختر زر "تحديد على الخريطة" أدناه أو ابحث بالنص' : 'Use "Pick on map" buttons below, or search by text')}
            </p>
          </div>
          <MapView
            className="h-[350px]"
            markers={markers}
            center={mapCenter}
            zoom={13}
            onMapClick={handleMapClick}
            origin={origin.lat && destination.lat ? origin : undefined}
            destination={origin.lat && destination.lat ? destination : undefined}
            showDirections={!!(origin.lat && destination.lat)}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-green-500" />
              {t('routeRequest.origin')}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <PlacesAutocomplete
                  placeholder={t('routeRequest.originPlaceholder')}
                  value={origin.name}
                  iconColor="text-green-500"
                  onSelect={(place) => { setOrigin(place); setActivePin(null); }}
                />
              </div>
              <Button
                type="button"
                variant={activePin === 'origin' ? 'default' : 'outline'}
                size="sm"
                className="shrink-0 mt-0"
                onClick={() => setActivePin(activePin === 'origin' ? null : 'origin')}
              >
                <MapPin className="w-4 h-4 me-1" />
                {lang === 'ar' ? 'الخريطة' : 'Map'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-destructive" />
              {t('routeRequest.destination')}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <PlacesAutocomplete
                  placeholder={t('routeRequest.destPlaceholder')}
                  value={destination.name}
                  iconColor="text-destructive"
                  onSelect={(place) => { setDestination(place); setActivePin(null); }}
                />
              </div>
              <Button
                type="button"
                variant={activePin === 'destination' ? 'default' : 'outline'}
                size="sm"
                className="shrink-0 mt-0"
                onClick={() => setActivePin(activePin === 'destination' ? null : 'destination')}
              >
                <MapPin className="w-4 h-4 me-1" />
                {lang === 'ar' ? 'الخريطة' : 'Map'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('routeRequest.preferredTime')}</Label>
            <Input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading || !origin.name || !destination.name}>
            {loading ? t('auth.loading') : t('routeRequest.submit')}
          </Button>
        </form>
      </main>
      <div className="h-20" />
      <BottomNav />
    </div>
  );
};

export default RequestRoute;
