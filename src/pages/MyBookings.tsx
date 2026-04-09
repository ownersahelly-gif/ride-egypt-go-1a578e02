import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MyBookings = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('bookings').select('*, routes(*)').eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setBookings(data || []); setLoading(false); });
  }, [user]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast({ title: t('auth.error'), description: error.message, variant: 'destructive' }); return; }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
    toast({ title: t('booking.cancelled') });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('dashboard.myBookings')}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : bookings.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('dashboard.noBookings')}</p>
            <Link to="/book"><Button className="mt-4">{t('dashboard.bookFirst')}</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{lang === 'ar' ? booking.routes?.name_ar : booking.routes?.name_en}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[booking.status] || ''}`}>
                    {t(`booking.status.${booking.status}`)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.scheduled_date}</span>
                  <span>{booking.scheduled_time}</span>
                  <span>{booking.seats} {t('booking.seat')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{booking.total_price} EGP</span>
                  {booking.status === 'pending' && (
                    <Button variant="destructive" size="sm" onClick={() => cancelBooking(booking.id)}>{t('booking.cancel')}</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyBookings;
