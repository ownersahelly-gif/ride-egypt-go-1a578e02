import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

const Login = () => {
  const { signIn } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-6">{t('auth.loginTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card p-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="name@example.com" className="ps-10"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••••" className="ps-10"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('auth.login')}
            <Arrow className="w-4 h-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">{t('auth.signupLink')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
