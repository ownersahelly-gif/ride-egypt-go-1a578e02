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
import { ChevronLeft, ChevronRight, MapPin, Navigation, Calendar } from 'lucide-react';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapPinPicker from '@/components/MapPinPicker';

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
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePin, setActivePin] = useState<'origin' | 'destination' | null>(null);

  const dayLabels = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (day: number) => {
    setPreferredDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const selectWeekdays = () => setPreferredDays([0, 1, 2, 3, 4]);
  const selectWeekend = () => setPreferredDays([5, 6]);
  const selectAll = () => setPreferredDays([0, 1, 2, 3, 4, 5, 6]);

  const handlePinConfirm = (type: 'origin' | 'destination', loc: { lat: number; lng: number; name: string }) => {
    if (type === 'origin') setOrigin(loc);
    else setDestination(loc);
    setActivePin(null);
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
        preferred_days: preferredDays.length > 0 ? preferredDays : null,
      } as any);
      if (error) throw error;
      toast({ title: t('routeRequest.success'), description: t('routeRequest.successDesc') });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
        <MapPinPicker
          className="h-[350px] border border-border rounded-2xl"
          activePin={activePin}
          origin={origin.lat ? origin : undefined}
          destination={destination.lat ? destination : undefined}
          onConfirm={handlePinConfirm}
          onCancel={() => setActivePin(null)}
        />

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

          {/* Preferred Days */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {lang === 'ar' ? 'الأيام المفضلة' : 'Preferred Days'}
            </Label>
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    preferredDays.includes(i)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectWeekdays}>
                {lang === 'ar' ? 'أيام الأسبوع' : 'Weekdays'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectWeekend}>
                {lang === 'ar' ? 'عطلة نهاية الأسبوع' : 'Weekend'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                {lang === 'ar' ? 'كل الأيام' : 'Every day'}
              </Button>
            </div>
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
