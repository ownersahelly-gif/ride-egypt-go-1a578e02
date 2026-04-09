import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Car } from 'lucide-react';

const DriverApply = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [form, setForm] = useState({
    license_number: '', vehicle_model: '', vehicle_plate: '', vehicle_year: '', experience_years: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('driver_applications').insert({
        user_id: user.id,
        license_number: form.license_number,
        vehicle_model: form.vehicle_model,
        vehicle_plate: form.vehicle_plate,
        vehicle_year: parseInt(form.vehicle_year),
        experience_years: parseInt(form.experience_years) || 0,
      });
      if (error) throw error;
      toast({ title: t('driver.applicationSuccess'), description: t('driver.applicationSuccessDesc') });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('driver.applyTitle')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
            <Car className="w-8 h-8 text-secondary" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t('driver.licenseNumber')}</Label>
            <Input value={form.license_number} onChange={(e) => update('license_number', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('driver.vehicleModel')}</Label>
            <Input value={form.vehicle_model} onChange={(e) => update('vehicle_model', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('driver.vehiclePlate')}</Label>
            <Input value={form.vehicle_plate} onChange={(e) => update('vehicle_plate', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('driver.vehicleYear')}</Label>
              <Input type="number" value={form.vehicle_year} onChange={(e) => update('vehicle_year', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t('driver.experience')}</Label>
              <Input type="number" value={form.experience_years} onChange={(e) => update('experience_years', e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('driver.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default DriverApply;
