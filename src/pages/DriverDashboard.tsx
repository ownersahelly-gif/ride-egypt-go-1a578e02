import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Globe, LogOut, User, MapPin, Clock, Users, Car, Calendar, DollarSign, Navigation, CheckCircle2, XCircle, Loader2, Play, Plus, Trash2, Repeat, TrendingUp, Star, Route, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { useDriverBookingNotifications } from '@/hooks/useBookingNotifications';

type TabType = 'overview' | 'routes' | 'trips' | 'earnings' | 'schedule' | 'shuttle';

const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>('overview');
  const [shuttle, setShuttle] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [route, setRoute] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Schedule states
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedRouteForSchedule, setSelectedRouteForSchedule] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    route_id: '',
    days: [] as number[],
    departure_time: '08:00',
    return_time: '17:00',
    is_recurring: true,
    min_passengers: 5,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Route request states
  const [showRouteRequest, setShowRouteRequest] = useState(false);
  const [routeRequestForm, setRouteRequestForm] = useState({
    origin_name: '',
    destination_name: '',
    preferred_time: '08:00',
  });
  const [savingRouteRequest, setSavingRouteRequest] = useState(false);

  useDriverBookingNotifications(shuttle?.id || null);

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: profileData }, { data: shuttleData }, { data: routesData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('shuttles').select('*, routes(*)').eq('driver_id', user.id).limit(1).maybeSingle(),
        supabase.from('routes').select('*, stops(*)').eq('status', 'active'),
      ]);

      setProfile(profileData);
      setAllRoutes(routesData || []);

      if (shuttleData) {
        setShuttle(shuttleData);
        setRoute(shuttleData.routes);

        const [{ data: bookingsData }, { data: schedulesData }] = await Promise.all([
          supabase.from('bookings').select('*, routes(*)').eq('shuttle_id', shuttleData.id).order('scheduled_date', { ascending: true }).limit(50),
          supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes)').eq('driver_id', user.id).order('day_of_week'),
        ]);
        setBookings(bookingsData || []);
        setDriverSchedules(schedulesData || []);
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

  const toggleDay = (day: number) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day],
    }));
  };

  const openScheduleForRoute = (routeObj: any) => {
    setSelectedRouteForSchedule(routeObj);
    setScheduleForm(prev => ({ ...prev, route_id: routeObj.id }));
    setShowScheduleForm(true);
    setTab('schedule');
  };

  const saveSchedule = async () => {
    if (!user || !shuttle || !scheduleForm.route_id || scheduleForm.days.length === 0) return;
    setSavingSchedule(true);

    // Create departure entries
    const departureEntries = scheduleForm.days.map(day => ({
      driver_id: user.id,
      route_id: scheduleForm.route_id,
      shuttle_id: shuttle.id,
      day_of_week: day,
      departure_time: scheduleForm.departure_time,
      is_recurring: scheduleForm.is_recurring,
      is_active: true,
      min_passengers: scheduleForm.min_passengers,
      return_time: scheduleForm.return_time || null,
    }));

    const { error } = await supabase.from('driver_schedules').insert(departureEntries);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم حفظ الجدول بنجاح!' : 'Schedule saved successfully!' });
      await generateRideInstances(departureEntries);
      const { data } = await supabase.from('driver_schedules').select('*, routes(name_en, name_ar, price, origin_name_en, origin_name_ar, destination_name_en, destination_name_ar, estimated_duration_minutes)').eq('driver_id', user.id).order('day_of_week');
      setDriverSchedules(data || []);
      setShowScheduleForm(false);
      setSelectedRouteForSchedule(null);
      setScheduleForm({ route_id: '', days: [], departure_time: '08:00', return_time: '17:00', is_recurring: true, min_passengers: 5 });
    }
    setSavingSchedule(false);
  };

  const generateRideInstances = async (scheduleEntries: any[]) => {
    if (!user || !shuttle) return;
    const instances: any[] = [];
    const today = new Date();

    for (const entry of scheduleEntries) {
      const weeksAhead = entry.is_recurring ? 4 : 1;
      for (let w = 0; w < weeksAhead; w++) {
        for (let d = 0; d < 7; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() + (w * 7) + d);
          if (date.getDay() === entry.day_of_week && date >= today) {
            instances.push({
              driver_id: user.id,
              route_id: entry.route_id,
              shuttle_id: shuttle.id,
              ride_date: date.toISOString().split('T')[0],
              departure_time: entry.departure_time,
              available_seats: shuttle.capacity,
              total_seats: shuttle.capacity,
              status: 'scheduled',
            });
          }
        }
      }
    }

    if (instances.length > 0) {
      await supabase.from('ride_instances').upsert(instances, { onConflict: 'shuttle_id,ride_date,departure_time' });
    }
  };

  const deleteSchedule = async (id: string) => {
    const { error } = await supabase.from('driver_schedules').delete().eq('id', id);
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      setDriverSchedules(prev => prev.filter(s => s.id !== id));
      toast({ title: lang === 'ar' ? 'تم حذف الجدول' : 'Schedule removed' });
    }
  };

  const submitRouteRequest = async () => {
    if (!user || !routeRequestForm.origin_name || !routeRequestForm.destination_name) return;
    setSavingRouteRequest(true);
    const { error } = await supabase.from('route_requests').insert({
      user_id: user.id,
      origin_name: routeRequestForm.origin_name,
      origin_lat: 0,
      origin_lng: 0,
      destination_name: routeRequestForm.destination_name,
      destination_lat: 0,
      destination_lng: 0,
      preferred_time: routeRequestForm.preferred_time,
      status: 'pending',
    });
    if (error) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Route request submitted!', description: lang === 'ar' ? 'سيتم مراجعته وإضافته قريباً' : 'It will be reviewed and added soon' });
      setShowRouteRequest(false);
      setRouteRequestForm({ origin_name: '', destination_name: '', preferred_time: '08:00' });
    }
    setSavingRouteRequest(false);
  };

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
    { key: 'routes', icon: Route, label: lang === 'ar' ? 'المسارات' : 'Routes' },
    { key: 'trips', icon: Navigation, label: t('driverDash.trips') },
    { key: 'earnings', icon: TrendingUp, label: lang === 'ar' ? 'الأرباح' : 'Earnings' },
    { key: 'schedule', icon: Calendar, label: t('driverDash.schedule') },
    { key: 'shuttle', icon: MapPin, label: t('driverDash.shuttleInfo') },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const todayBookings = bookings.filter(b => b.scheduled_date === new Date().toISOString().split('T')[0] && b.status !== 'cancelled');
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

  // Calculate expected earnings per route based on price * capacity * scheduled days per week
  const getExpectedEarnings = (routeObj: any) => {
    const price = parseFloat(routeObj.price || 0);
    const capacity = shuttle?.capacity || 14;
    // Driver gets 90% of fare
    const driverShare = price * 0.9;
    return {
      perTrip: driverShare * capacity,
      perDay: driverShare * capacity * 2, // going + return
      perWeek: driverShare * capacity * 2 * 5, // 5 working days
      perMonth: driverShare * capacity * 2 * 22, // ~22 working days
      pricePerSeat: price,
      driverPerSeat: driverShare,
    };
  };

  // Get routes the driver is already scheduled on
  const scheduledRouteIds = new Set(driverSchedules.map(s => s.route_id));

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="text-2xl font-bold text-primary font-arabic">{lang === 'ar' ? 'مسار' : 'Massar'}</Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{t('driverDash.driverPanel')}</span>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Link to="/profile"><Button variant="ghost" size="icon"><User className="w-5 h-5" /></Button></Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {!shuttle && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}</h2>
            <p className="text-muted-foreground mb-4">{lang === 'ar' ? 'تم استلام طلبك وجاري مراجعته. سيتم تفعيل حسابك تلقائياً عند الموافقة.' : 'Your application has been received and is being reviewed. Your account will be activated automatically once approved.'}</p>
          </div>
        )}

        {shuttle && (
          <>
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: Navigation, value: todayBookings.length, label: t('driverDash.todayTrips'), bg: 'bg-primary/10', color: 'text-primary' },
                    { icon: Clock, value: pendingBookings.length, label: t('driverDash.pendingBookings'), bg: 'bg-secondary/10', color: 'text-secondary' },
                    { icon: DollarSign, value: `${totalEarnings.toFixed(0)} EGP`, label: t('driverDash.totalEarnings'), bg: 'bg-green-50', color: 'text-green-600' },
                    { icon: Users, value: shuttle.capacity, label: t('driverDash.capacity'), bg: 'bg-primary/10', color: 'text-primary' },
                  ].map((s, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-5">
                      <div className={`w-10 h-10 rounded-lg mb-2 flex items-center justify-center ${s.bg}`}>
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <p className="text-2xl font-bold text-foreground">{s.value}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Quick action: if no schedules, prompt to browse routes */}
                {driverSchedules.length === 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Route className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">
                          {lang === 'ar' ? 'ابدأ بتحديد مسارك!' : 'Get started — choose your route!'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {lang === 'ar' ? 'تصفح المسارات المتاحة واختر الأنسب لك، ثم حدد أيام ومواعيد عملك' : 'Browse available routes, pick the best one for you, then set your working days and times'}
                        </p>
                        <Button onClick={() => setTab('routes')}>
                          <Route className="w-4 h-4 me-1" />
                          {lang === 'ar' ? 'تصفح المسارات' : 'Browse Routes'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

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
                        <Play className="w-5 h-5 me-2" />{lang === 'ar' ? 'بدء الرحلة' : 'Start Ride'}
                      </Button>
                    </Link>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-3">{t('driverDash.todaySchedule')}</h3>
                  {todayBookings.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('driverDash.noTripsToday')}</div>
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
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Routes Tab - Browse & Choose Routes */}
            {tab === 'routes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {lang === 'ar' ? 'المسارات المتاحة' : 'Available Routes'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang === 'ar' ? 'اختر مسارك وابدأ العمل عليه' : 'Choose a route and start working on it'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowRouteRequest(!showRouteRequest)}>
                    <Plus className="w-4 h-4 me-1" />
                    {lang === 'ar' ? 'طلب مسار جديد' : 'Request New Route'}
                  </Button>
                </div>

                {/* Route Request Form */}
                {showRouteRequest && (
                  <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">
                        {lang === 'ar' ? 'طلب مسار جديد' : 'Request a New Route'}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ar' ? 'لا تجد المسار اللي عاوزه؟ قولنا نقطة البداية والنهاية وهنراجعه ونضيفه' : "Can't find your route? Tell us the start and end points and we'll review and add it"}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'نقطة البداية' : 'Starting Point'}</Label>
                        <Input
                          placeholder={lang === 'ar' ? 'مثال: مدينتي' : 'e.g. Madinaty'}
                          value={routeRequestForm.origin_name}
                          onChange={e => setRouteRequestForm(p => ({ ...p, origin_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'نقطة النهاية' : 'Destination'}</Label>
                        <Input
                          placeholder={lang === 'ar' ? 'مثال: القرية الذكية' : 'e.g. Smart Village'}
                          value={routeRequestForm.destination_name}
                          onChange={e => setRouteRequestForm(p => ({ ...p, destination_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'الوقت المفضل' : 'Preferred Time'}</Label>
                      <Input type="time" value={routeRequestForm.preferred_time}
                        onChange={e => setRouteRequestForm(p => ({ ...p, preferred_time: e.target.value }))}
                        className="w-48" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={submitRouteRequest} disabled={savingRouteRequest || !routeRequestForm.origin_name || !routeRequestForm.destination_name}>
                        {savingRouteRequest ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRouteRequest(false)}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Route Cards */}
                {allRoutes.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Route className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">{lang === 'ar' ? 'لا توجد مسارات متاحة حالياً' : 'No routes available yet'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {allRoutes.map(r => {
                      const earnings = getExpectedEarnings(r);
                      const isScheduled = scheduledRouteIds.has(r.id);
                      const stopsCount = r.stops?.length || 0;

                      return (
                        <div key={r.id} className={`bg-card border rounded-2xl p-6 transition-all ${isScheduled ? 'border-primary/40 bg-primary/[0.02]' : 'border-border hover:border-primary/20'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-foreground">
                                  {lang === 'ar' ? r.name_ar : r.name_en}
                                </h3>
                                {isScheduled && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                    {lang === 'ar' ? 'مُجدول' : 'Scheduled'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5 text-green-500" />
                                <span>{lang === 'ar' ? r.origin_name_ar : r.origin_name_en}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                                <MapPin className="w-3.5 h-3.5 text-destructive" />
                                <span>{lang === 'ar' ? r.destination_name_ar : r.destination_name_en}</span>
                              </div>
                            </div>
                          </div>

                          {/* Route Details Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{r.price} EGP</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'سعر المقعد' : 'Per Seat'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{r.estimated_duration_minutes}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'دقيقة' : 'Minutes'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <MapPin className="w-4 h-4 text-secondary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{stopsCount}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'محطات' : 'Stops'}</p>
                            </div>
                            <div className="bg-surface rounded-xl p-3 text-center">
                              <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                              <p className="text-lg font-bold text-foreground">{shuttle.capacity}</p>
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'مقعد' : 'Seats'}</p>
                            </div>
                          </div>

                          {/* Expected Earnings */}
                          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                {lang === 'ar' ? 'الأرباح المتوقعة (حصة السائق 70%)' : 'Expected Earnings (Driver gets 70%)'}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perTrip.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'لكل رحلة (ممتلئة)' : 'Per trip (full)'}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perWeek.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'أسبوعياً' : 'Weekly'}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-700 dark:text-green-400">{earnings.perMonth.toFixed(0)} EGP</p>
                                <p className="text-xs text-green-600/70">{lang === 'ar' ? 'شهرياً' : 'Monthly'}</p>
                              </div>
                            </div>
                            <p className="text-xs text-green-600/60 mt-2 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              {lang === 'ar' ? `${earnings.driverPerSeat.toFixed(0)} جنيه للسائق من كل مقعد × ${shuttle.capacity} مقعد` : `${earnings.driverPerSeat.toFixed(0)} EGP driver share per seat × ${shuttle.capacity} seats`}
                            </p>
                          </div>

                          {/* Action Button */}
                          {!isScheduled ? (
                            <Button className="w-full" size="lg" onClick={() => openScheduleForRoute(r)}>
                              <Calendar className="w-4 h-4 me-2" />
                              {lang === 'ar' ? 'اختر هذا المسار وحدد جدولك' : 'Choose This Route & Set Schedule'}
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full" onClick={() => setTab('schedule')}>
                              <Calendar className="w-4 h-4 me-2" />
                              {lang === 'ar' ? 'عرض الجدول' : 'View Schedule'}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Trips Tab */}
            {tab === 'trips' && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-foreground mb-4">{t('driverDash.allBookings')}</h2>
                {bookings.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">{t('driverDash.noBookingsYet')}</div>
                ) : bookings.map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                        <p className="text-sm text-muted-foreground">{b.scheduled_date} · {b.scheduled_time}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>{t(`booking.status.${b.status}`)}</span>
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
                        <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, 'completed')}>{t('driverDash.complete')}</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Earnings Tab */}
            {tab === 'earnings' && (() => {
              const completed = bookings.filter(b => b.status === 'completed');
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              const dayOfWeek = today.getDay();
              const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const weekStart = new Date(today);
              weekStart.setDate(today.getDate() - mondayOffset);
              const weekStartStr = weekStart.toISOString().split('T')[0];
              const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

              const dailyEarnings = completed.filter(b => b.scheduled_date === todayStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const weeklyEarnings = completed.filter(b => b.scheduled_date >= weekStartStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const monthlyEarnings = completed.filter(b => b.scheduled_date >= monthStartStr).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const allTimeEarnings = completed.reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
              const dailyRides = completed.filter(b => b.scheduled_date === todayStr).length;
              const weeklyRides = completed.filter(b => b.scheduled_date >= weekStartStr).length;
              const monthlyRides = completed.filter(b => b.scheduled_date >= monthStartStr).length;

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: lang === 'ar' ? 'اليوم' : 'Today', amount: dailyEarnings, rides: dailyRides, bg: 'bg-green-50 dark:bg-green-900/20' },
                      { label: lang === 'ar' ? 'هذا الأسبوع' : 'This Week', amount: weeklyEarnings, rides: weeklyRides, bg: 'bg-primary/5' },
                      { label: lang === 'ar' ? 'هذا الشهر' : 'This Month', amount: monthlyEarnings, rides: monthlyRides, bg: 'bg-secondary/5' },
                    ].map((period, i) => (
                      <div key={i} className={`rounded-2xl border border-border p-5 ${period.bg}`}>
                        <p className="text-sm text-muted-foreground mb-1">{period.label}</p>
                        <p className="text-3xl font-bold text-foreground">{period.amount.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">EGP</span></p>
                        <p className="text-xs text-muted-foreground mt-1">{period.rides} {lang === 'ar' ? 'رحلة' : 'rides'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{lang === 'ar' ? 'الإجمالي' : 'All Time'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{allTimeEarnings.toFixed(0)} EGP</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Navigation className="w-4 h-4 text-primary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الرحلات' : 'Total Rides'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.length}</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-primary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'إجمالي الركاب' : 'Total Passengers'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.reduce((s, b) => s + (b.seats || 1), 0)}</p>
                      </div>
                      <div className="bg-surface rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-secondary" />
                          <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'متوسط الرحلة' : 'Avg per Ride'}</p>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{completed.length > 0 ? (allTimeEarnings / completed.length).toFixed(0) : 0} EGP</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="font-semibold text-foreground mb-4">{lang === 'ar' ? 'آخر الرحلات المكتملة' : 'Recent Completed Rides'}</h3>
                    {completed.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">{lang === 'ar' ? 'لا يوجد رحلات مكتملة بعد' : 'No completed rides yet'}</p>
                    ) : (
                      <div className="space-y-2">
                        {completed.slice(0, 10).map(b => (
                          <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div>
                              <p className="text-sm font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                              <p className="text-xs text-muted-foreground">{b.scheduled_date} · {b.scheduled_time}</p>
                            </div>
                            <div className="text-end">
                              <p className="font-semibold text-foreground">{b.total_price} EGP</p>
                              <p className="text-xs text-muted-foreground">{b.seats} {lang === 'ar' ? 'مقعد' : 'seat'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">
                    {lang === 'ar' ? 'جدول الرحلات' : 'My Route Schedule'}
                  </h2>
                  <Button onClick={() => { setShowScheduleForm(!showScheduleForm); setSelectedRouteForSchedule(null); }}>
                    <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة جدول' : 'Add Schedule'}
                  </Button>
                </div>

                {showScheduleForm && (
                  <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 space-y-5">
                    <h3 className="font-semibold text-foreground">{lang === 'ar' ? 'جدول جديد' : 'New Schedule'}</h3>

                    {/* Selected route info */}
                    {selectedRouteForSchedule && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="font-medium text-foreground">
                          {lang === 'ar' ? selectedRouteForSchedule.name_ar : selectedRouteForSchedule.name_en}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lang === 'ar' ? selectedRouteForSchedule.origin_name_ar : selectedRouteForSchedule.origin_name_en} → {lang === 'ar' ? selectedRouteForSchedule.destination_name_ar : selectedRouteForSchedule.destination_name_en}
                        </p>
                      </div>
                    )}

                    {/* Route selection (if not pre-selected) */}
                    {!selectedRouteForSchedule && (
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'اختر المسار' : 'Select Route'}</Label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={scheduleForm.route_id} onChange={e => setScheduleForm(p => ({ ...p, route_id: e.target.value }))}>
                          <option value="">{lang === 'ar' ? 'اختر مسار...' : 'Choose a route...'}</option>
                          {allRoutes.map(r => (
                            <option key={r.id} value={r.id}>
                              {lang === 'ar' ? r.name_ar : r.name_en} - {r.price} EGP
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Day selection */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'اختر أيام العمل' : 'Select Working Days'}</Label>
                      <div className="flex flex-wrap gap-2">
                        {dayNames.map((name, i) => (
                          <button key={i} onClick={() => toggleDay(i)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              scheduleForm.days.includes(i)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                            }`}>
                            {name}
                          </button>
                        ))}
                      </div>
                      {/* Quick select */}
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'الأحد - الخميس' : 'Sun - Thu'}
                        </button>
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [1, 2, 3, 4, 5] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'الإثنين - الجمعة' : 'Mon - Fri'}
                        </button>
                        <button onClick={() => setScheduleForm(p => ({ ...p, days: [0, 1, 2, 3, 4, 5, 6] }))}
                          className="text-xs text-primary hover:underline">
                          {lang === 'ar' ? 'كل الأيام' : 'All Days'}
                        </button>
                      </div>
                    </div>

                    {/* Times */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت الذهاب (الصباح)' : 'Departure Time (Morning)'}</Label>
                        <Input type="time" value={scheduleForm.departure_time}
                          onChange={e => setScheduleForm(p => ({ ...p, departure_time: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{lang === 'ar' ? 'وقت العودة (المساء)' : 'Return Time (Evening)'}</Label>
                        <Input type="time" value={scheduleForm.return_time}
                          onChange={e => setScheduleForm(p => ({ ...p, return_time: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Minimum passengers */}
                    <div className="space-y-2">
                      <Label>{lang === 'ar' ? 'أقل عدد ركاب لانطلاق الرحلة' : 'Minimum Passengers for Trip to Go'}</Label>
                      <div className="flex items-center gap-3">
                        <Input type="number" min={1} max={shuttle.capacity}
                          value={scheduleForm.min_passengers}
                          onChange={e => setScheduleForm(p => ({ ...p, min_passengers: parseInt(e.target.value) || 1 }))}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {lang === 'ar' ? `من أصل ${shuttle.capacity} مقعد` : `out of ${shuttle.capacity} seats`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          {lang === 'ar' ? 'لو عدد الحجوزات أقل من الحد الأدنى، الرحلة مش هتنطلق والركاب هيتبلغوا' : "If bookings are below minimum, the trip won't depart and riders will be notified"}
                        </p>
                      </div>
                    </div>

                    {/* Recurring toggle */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={scheduleForm.is_recurring}
                        onCheckedChange={(checked) => setScheduleForm(p => ({ ...p, is_recurring: !!checked }))}
                      />
                      <div>
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <Repeat className="w-4 h-4 text-primary" />
                          {lang === 'ar' ? 'تكرار أسبوعي (كل أسبوع نفس الأيام)' : 'Repeat weekly (same days every week)'}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {scheduleForm.is_recurring
                            ? (lang === 'ar' ? 'سيتم إنشاء رحلات تلقائياً لمدة 4 أسابيع قادمة' : 'Rides will be auto-created for the next 4 weeks')
                            : (lang === 'ar' ? 'هذا الأسبوع فقط' : 'This week only')}
                        </p>
                      </div>
                    </div>

                    {/* Expected earnings preview */}
                    {scheduleForm.route_id && scheduleForm.days.length > 0 && (() => {
                      const selectedRoute = allRoutes.find(r => r.id === scheduleForm.route_id);
                      if (!selectedRoute) return null;
                      const earnings = getExpectedEarnings(selectedRoute);
                      const tripsPerWeek = scheduleForm.days.length * (scheduleForm.return_time ? 2 : 1);
                      const weeklyEstimate = earnings.driverPerSeat * shuttle.capacity * tripsPerWeek;

                      return (
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
                          <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                            {lang === 'ar' ? 'الأرباح المتوقعة بهذا الجدول' : 'Expected Earnings with This Schedule'}
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            ~{weeklyEstimate.toFixed(0)} EGP / {lang === 'ar' ? 'أسبوع' : 'week'}
                          </p>
                          <p className="text-xs text-green-600/70 mt-1">
                            {tripsPerWeek} {lang === 'ar' ? 'رحلة/أسبوع × ' : 'trips/week × '}{shuttle.capacity} {lang === 'ar' ? 'مقعد' : 'seats'} × {earnings.driverPerSeat.toFixed(0)} EGP
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex gap-2 pt-2">
                      <Button onClick={saveSchedule} disabled={savingSchedule || !scheduleForm.route_id || scheduleForm.days.length === 0}>
                        {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <CheckCircle2 className="w-4 h-4 me-1" />}
                        {lang === 'ar' ? 'حفظ الجدول' : 'Save Schedule'}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowScheduleForm(false); setSelectedRouteForSchedule(null); }}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing schedules */}
                {driverSchedules.length === 0 && !showScheduleForm ? (
                  <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">{lang === 'ar' ? 'لم تحدد أي جدول بعد' : 'No schedules set yet'}</p>
                    <p className="text-sm text-muted-foreground mb-4">{lang === 'ar' ? 'تصفح المسارات واختر الأنسب لك' : 'Browse routes and pick the best one for you'}</p>
                    <Button variant="outline" onClick={() => setTab('routes')}>
                      <Route className="w-4 h-4 me-1" />
                      {lang === 'ar' ? 'تصفح المسارات' : 'Browse Routes'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      driverSchedules.reduce((acc: Record<string, any[]>, s) => {
                        const key = s.route_id;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(s);
                        return acc;
                      }, {})
                    ).map(([routeId, schedules]) => {
                      const routeInfo = (schedules as any[])[0]?.routes;
                      return (
                        <div key={routeId} className="bg-card border border-border rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-foreground">
                                {lang === 'ar' ? routeInfo?.name_ar : routeInfo?.name_en}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {lang === 'ar' ? routeInfo?.origin_name_ar : routeInfo?.origin_name_en} → {lang === 'ar' ? routeInfo?.destination_name_ar : routeInfo?.destination_name_en}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-foreground">{routeInfo?.price} EGP/{lang === 'ar' ? 'مقعد' : 'seat'}</span>
                          </div>

                          {/* Schedule details */}
                          <div className="space-y-2">
                            {(schedules as any[]).sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-foreground w-24">{dayNames[s.day_of_week]}</span>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{s.departure_time?.slice(0, 5)}</span>
                                    {s.return_time && (
                                      <>
                                        <ArrowRight className="w-3 h-3" />
                                        <span>{s.return_time?.slice(0, 5)}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="w-3 h-3" />
                                    <span>{lang === 'ar' ? `حد أدنى ${s.min_passengers}` : `Min ${s.min_passengers}`}</span>
                                  </div>
                                  {s.is_recurring && <Repeat className="w-3 h-3 text-primary" />}
                                </div>
                                <button onClick={() => deleteSchedule(s.id)} className="text-destructive/60 hover:text-destructive p-1">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
