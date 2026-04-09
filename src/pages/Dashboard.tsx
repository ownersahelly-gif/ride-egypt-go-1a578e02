import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Ticket, Plus, LogOut, Globe, User, Navigation } from 'lucide-react';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: profileData }, { data: bookingsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('bookings').select('*, routes(*), shuttles(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ]);
      setProfile(profileData);
      setBookings(bookingsData || []);
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground">
              <Globe className="w-5 h-5" />
            </button>
            <Link to="/profile">
              <Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {t('dashboard.welcome')}, {profile?.full_name || user?.email?.split('@')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Link to="/book" className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 hover:shadow-card-hover transition-all group">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20">
              <Navigation className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">{t('dashboard.bookRide')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.bookRideDesc')}</p>
          </Link>

          <Link to="/my-bookings" className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 hover:shadow-card-hover transition-all group">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary/20">
              <Ticket className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="font-semibold text-foreground">{t('dashboard.myBookings')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.myBookingsDesc')}</p>
          </Link>

          <Link to="/request-route" className="bg-card border border-border rounded-2xl p-6 hover:border-secondary/40 hover:shadow-card-hover transition-all group">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-4 group-hover:bg-green-100">
              <Plus className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-foreground">{t('dashboard.requestRoute')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.requestRouteDesc')}</p>
          </Link>
        </div>

        {/* Recent Bookings */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">{t('dashboard.recentBookings')}</h2>
          {bookings.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">{t('dashboard.noBookings')}</p>
              <Link to="/book">
                <Button className="mt-4">{t('dashboard.bookFirst')}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {lang === 'ar' ? booking.routes?.name_ar : booking.routes?.name_en}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        {booking.scheduled_date} · {booking.scheduled_time}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{booking.total_price} EGP</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[booking.status] || ''}`}>
                      {t(`booking.status.${booking.status}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
