import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Globe, LogOut, User, MapPin, Clock, Users, Car, Calendar, DollarSign, Navigation, CheckCircle2, XCircle, Loader2, Play } from 'lucide-react';

type TabType = 'overview' | 'trips' | 'schedule' | 'shuttle';

const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>('overview');
  const [shuttle, setShuttle] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [route, setRoute] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Get profile
      const { data: profileData } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      setProfile(profileData);

      // Get driver's shuttle
      const { data: shuttleData } = await supabase.from('shuttles').select('*, routes(*)').eq('driver_id', user.id).limit(1).maybeSingle();
      
      if (shuttleData) {
        setShuttle(shuttleData);
        setRoute(shuttleData.routes);

        // Get bookings for this shuttle
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('*, routes(*)')
          .eq('shuttle_id', shuttleData.id)
          .order('scheduled_date', { ascending: true })
          .limit(50);
        setBookings(bookingsData || []);

        // Get schedules
        const { data: schedulesData } = await supabase
          .from('shuttle_schedules')
          .select('*')
          .eq('shuttle_id', shuttleData.id)
          .order('day_of_week');
        setSchedules(schedulesData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const updateShuttleStatus = async (newStatus: string) => {
    if (!shuttle) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from('shuttles').update({ status: newStatus }).eq('id', shuttle.id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setShuttle({ ...shuttle, status: newStatus });
      toast({ title: t('driverDash.statusUpdated') });
    }
    setUpdatingStatus(false);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      toast({ title: t('driverDash.bookingUpdated') });
    }
  };

  const dayNames = lang === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-muted text-muted-foreground',
    maintenance: 'bg-secondary/20 text-secondary',
    pending: 'bg-secondary/20 text-secondary',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
  };

  const tabs: { key: TabType; icon: any; label: string }[] = [
    { key: 'overview', icon: Car, label: t('driverDash.overview') },
    { key: 'trips', icon: Navigation, label: t('driverDash.trips') },
    { key: 'schedule', icon: Calendar, label: t('driverDash.schedule') },
    { key: 'shuttle', icon: MapPin, label: t('driverDash.shuttleInfo') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayBookings = bookings.filter(b => b.scheduled_date === new Date().toISOString().split('T')[0] && b.status !== 'cancelled');
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{t('driverDash.driverPanel')}</span>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* No shuttle assigned */}
        {!shuttle && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Car className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{t('driverDash.noShuttle')}</h2>
            <p className="text-muted-foreground mb-4">{t('driverDash.noShuttleDesc')}</p>
            <Link to="/driver-apply"><Button>{t('driverDash.applyNow')}</Button></Link>
          </div>
        )}

        {shuttle && (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 overflow-x-auto">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Navigation className="w-5 h-5 text-primary" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{todayBookings.length}</p>
                    <p className="text-sm text-muted-foreground">{t('driverDash.todayTrips')}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center"><Clock className="w-5 h-5 text-secondary" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{pendingBookings.length}</p>
                    <p className="text-sm text-muted-foreground">{t('driverDash.pendingBookings')}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{totalEarnings.toFixed(0)} EGP</p>
                    <p className="text-sm text-muted-foreground">{t('driverDash.totalEarnings')}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{shuttle.capacity}</p>
                    <p className="text-sm text-muted-foreground">{t('driverDash.capacity')}</p>
                  </div>
                </div>

                {/* Shuttle status quick toggle */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{t('driverDash.shuttleStatus')}</h3>
                      <p className="text-sm text-muted-foreground">{shuttle.vehicle_model} · {shuttle.vehicle_plate}</p>
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusColors[shuttle.status] || ''}`}>
                      {t(`driverDash.status.${shuttle.status}`)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={shuttle.status === 'active' ? 'default' : 'outline'}
                      onClick={() => updateShuttleStatus('active')} disabled={updatingStatus}>
                      <CheckCircle2 className="w-4 h-4 me-1" />{t('driverDash.goOnline')}
                    </Button>
                    <Button size="sm" variant={shuttle.status === 'inactive' ? 'destructive' : 'outline'}
                      onClick={() => updateShuttleStatus('inactive')} disabled={updatingStatus}>
                      <XCircle className="w-4 h-4 me-1" />{t('driverDash.goOffline')}
                    </Button>
                  </div>
                  {shuttle.status === 'active' && todayBookings.length > 0 && (
                    <Link to="/active-ride" className="mt-3 block">
                      <Button className="w-full" size="lg">
                        <Play className="w-5 h-5 me-2" />
                        {lang === 'ar' ? 'بدء الرحلة' : 'Start Ride'}
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Today's trips */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3">{t('driverDash.todaySchedule')}</h3>
                  {todayBookings.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                      {t('driverDash.noTripsToday')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayBookings.map(b => (
                        <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground text-sm">{b.scheduled_time} · {b.seats} {t('booking.seat')}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.status]}`}>
                            {t(`booking.status.${b.status}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trips Tab */}
            {tab === 'trips' && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('driverDash.allBookings')}</h2>
                {bookings.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                    {t('driverDash.noBookingsYet')}
                  </div>
                ) : (
                  bookings.map(b => (
                    <div key={b.id} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                          <p className="text-sm text-muted-foreground">{b.scheduled_date} · {b.scheduled_time}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>
                          {t(`booking.status.${b.status}`)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{b.seats} {t('booking.seat')}</span>
                          <span className="font-medium text-foreground">{b.total_price} EGP</span>
                        </div>
                        {b.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => updateBookingStatus(b.id, 'confirmed')}>
                              <CheckCircle2 className="w-3.5 h-3.5 me-1" />{t('driverDash.confirm')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, 'cancelled')}>
                              <XCircle className="w-3.5 h-3.5 me-1" />{t('driverDash.reject')}
                            </Button>
                          </div>
                        )}
                        {b.status === 'confirmed' && (
                          <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, 'completed')}>
                            {t('driverDash.complete')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">{t('driverDash.weeklySchedule')}</h2>
                {schedules.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                    {t('driverDash.noSchedule')}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {schedules.map(s => (
                      <div key={s.id} className="bg-card border border-border rounded-xl p-5">
                        <h4 className="font-semibold text-foreground mb-2">{dayNames[s.day_of_week]}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{s.departure_time}</span>
                          <span>→</span>
                          <span>{s.arrival_time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shuttle Info Tab */}
            {tab === 'shuttle' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">{t('driverDash.vehicleInfo')}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehicleModel')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_model}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driver.vehiclePlate')}</p>
                      <p className="font-medium text-foreground">{shuttle.vehicle_plate}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.capacity')}</p>
                      <p className="font-medium text-foreground">{shuttle.capacity} {t('booking.seat')}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('driverDash.shuttleStatus')}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[shuttle.status]}`}>
                        {t(`driverDash.status.${shuttle.status}`)}
                      </span>
                    </div>
                  </div>
                </div>

                {route && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('driverDash.assignedRoute')}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-green-500" />
                      <span className="text-foreground">{lang === 'ar' ? route.origin_name_ar : route.origin_name_en}</span>
                      <span className="text-muted-foreground">→</span>
                      <MapPin className="w-4 h-4 text-destructive" />
                      <span className="text-foreground">{lang === 'ar' ? route.destination_name_ar : route.destination_name_en}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{route.estimated_duration_minutes} {t('booking.min')}</span>
                      <span>{route.price} EGP/{t('booking.perSeat')}</span>
                    </div>
                  </div>
                )}

                {/* Shuttle status controls */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4">{t('driverDash.updateStatus')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['active', 'inactive', 'maintenance'].map(s => (
                      <Button key={s} size="sm" variant={shuttle.status === s ? 'default' : 'outline'}
                        onClick={() => updateShuttleStatus(s)} disabled={updatingStatus}>
                        {t(`driverDash.status.${s}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
