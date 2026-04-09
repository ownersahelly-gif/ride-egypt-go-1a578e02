import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

const RequestRoute = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [originName, setOriginName] = useState('');
  const [destName, setDestName] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('route_requests').insert({
        user_id: user.id,
        origin_name: originName,
        origin_lat: 30.0444, // Default Cairo coords — would use Maps API
        origin_lng: 31.2357,
        destination_name: destName,
        destination_lat: 30.0131,
        destination_lng: 31.2089,
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

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('dashboard.requestRoute')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t('routeRequest.origin')}</Label>
            <div className="relative">
              <MapPin className="absolute start-3 top-3 h-4 w-4 text-green-500" />
              <Input className="ps-10" placeholder={t('routeRequest.originPlaceholder')}
                value={originName} onChange={(e) => setOriginName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('routeRequest.destination')}</Label>
            <div className="relative">
              <MapPin className="absolute start-3 top-3 h-4 w-4 text-destructive" />
              <Input className="ps-10" placeholder={t('routeRequest.destPlaceholder')}
                value={destName} onChange={(e) => setDestName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('routeRequest.preferredTime')}</Label>
            <Input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('routeRequest.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default RequestRoute;
