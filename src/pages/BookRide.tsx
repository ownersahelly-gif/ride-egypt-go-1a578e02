import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Users, ArrowLeft, ArrowRight, Search, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';

const BookRide = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [routes, setRoutes] = useState<any[]>([]);
  const [stops, setStops] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedPickup, setSelectedPickup] = useState('');
  const [selectedDropoff, setSelectedDropoff] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'search' | 'details'>('search');

  useEffect(() => {
    supabase.from('routes').select('*').eq('status', 'active').then(({ data }) => {
      setRoutes(data || []);
    });
  }, []);

  const loadStops = async (routeId: string) => {
    if (stops[routeId]) return;
    const { data } = await supabase.from('stops').select('*').eq('route_id', routeId).order('stop_order');
    setStops((prev) => ({ ...prev, [routeId]: data || [] }));
  };

  const selectRoute = (route: any) => {
    setSelectedRoute(route);
    loadStops(route.id);
    setStep('details');
  };

  const filteredRoutes = routes.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.name_en.toLowerCase().includes(q) || r.name_ar.includes(q) ||
      r.origin_name_en.toLowerCase().includes(q) || r.destination_name_en.toLowerCase().includes(q);
  });

  const handleBook = async () => {
    if (!user || !selectedRoute || !date || !time) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        user_id: user.id,
        route_id: selectedRoute.id,
        pickup_stop_id: selectedPickup || null,
        dropoff_stop_id: selectedDropoff || null,
        seats,
        total_price: selectedRoute.price * seats,
        scheduled_date: date,
        scheduled_time: time,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: t('booking.success'), description: t('booking.successDesc') });
      navigate('/my-bookings');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const routeStops = selectedRoute ? stops[selectedRoute.id] || [] : [];

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">{t('booking.title')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {step === 'search' && (
          <>
            <div className="relative mb-6">
              <Search className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input placeholder={t('booking.searchPlaceholder')} className="ps-11 h-12 text-base rounded-xl"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {filteredRoutes.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('booking.noRoutes')}</p>
                <Link to="/request-route"><Button className="mt-4">{t('booking.requestNew')}</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRoutes.map((route) => (
                  <button key={route.id} onClick={() => selectRoute(route)}
                    className="w-full text-start bg-card border border-border rounded-xl p-5 hover:border-secondary/40 hover:shadow-card-hover transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{lang === 'ar' ? route.name_ar : route.name_en}</h3>
                      <span className="text-lg font-bold text-primary">{route.price} EGP</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span>{lang === 'ar' ? route.origin_name_ar : route.origin_name_en}</span>
                      <ArrowRight className="w-4 h-4" />
                      <MapPin className="w-4 h-4 text-destructive" />
                      <span>{lang === 'ar' ? route.destination_name_ar : route.destination_name_en}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{route.estimated_duration_minutes} {t('booking.min')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'details' && selectedRoute && (
          <div className="space-y-6">
            <button onClick={() => setStep('search')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <Back className="w-4 h-4" />{t('booking.backToRoutes')}
            </button>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-1">{lang === 'ar' ? selectedRoute.name_ar : selectedRoute.name_en}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span>{lang === 'ar' ? selectedRoute.origin_name_ar : selectedRoute.origin_name_en}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{lang === 'ar' ? selectedRoute.destination_name_ar : selectedRoute.destination_name_en}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{selectedRoute.price} EGP</p>
                  <p className="text-xs text-muted-foreground">{t('booking.perSeat')}</p>
                </div>
                <div className="bg-surface rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{selectedRoute.estimated_duration_minutes}</p>
                  <p className="text-xs text-muted-foreground">{t('booking.minutes')}</p>
                </div>
              </div>

              {routeStops.length > 0 && (
                <div className="space-y-3 mb-6">
                  <div className="space-y-2">
                    <Label>{t('booking.pickupStop')}</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedPickup} onChange={(e) => setSelectedPickup(e.target.value)}>
                      <option value="">{t('booking.selectStop')}</option>
                      {routeStops.filter(s => s.stop_type !== 'dropoff').map(s => (
                        <option key={s.id} value={s.id}>{lang === 'ar' ? s.name_ar : s.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('booking.dropoffStop')}</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedDropoff} onChange={(e) => setSelectedDropoff(e.target.value)}>
                      <option value="">{t('booking.selectStop')}</option>
                      {routeStops.filter(s => s.stop_type !== 'pickup').map(s => (
                        <option key={s.id} value={s.id}>{lang === 'ar' ? s.name_ar : s.name_en}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>{t('booking.date')}</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <Label>{t('booking.time')}</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <Label>{t('booking.seats')}</Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={() => setSeats(Math.max(1, seats - 1))} disabled={seats <= 1}>-</Button>
                  <span className="text-lg font-bold w-8 text-center">{seats}</span>
                  <Button variant="outline" size="icon" onClick={() => setSeats(Math.min(10, seats + 1))} disabled={seats >= 10}>+</Button>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('booking.total')}</span>
                  <span className="text-primary">{selectedRoute.price * seats} EGP</span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleBook} disabled={loading || !date || !time}>
                {loading ? t('auth.loading') : t('booking.confirm')}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookRide;
