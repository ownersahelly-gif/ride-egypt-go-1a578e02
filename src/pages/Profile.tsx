import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) { setFullName(data.full_name || ''); setPhone(data.phone || ''); }
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('user_id', user.id);
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else toast({ title: t('profile.saved') });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('profile.title')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-10 h-10 text-primary" />
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t('auth.email')}</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>{t('auth.fullName')}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('profile.phone')}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 1XX XXX XXXX" />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('profile.save')}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Profile;
