import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import MapView from '@/components/MapView';
import {
  ChevronLeft, Route, Users, Car, Ticket, BarChart3, Plus, Edit, Trash2,
  CheckCircle2, XCircle, MapPin, Clock, Search, Globe, LogOut, Shield,
  Loader2, Eye, Database
} from 'lucide-react';

type AdminTab = 'routes' | 'drivers' | 'shuttles' | 'bookings' | 'analytics' | 'approvals';

const AdminPanel = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { toast: legacyToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Data states
  const [routes, setRoutes] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [shuttles, setShuttles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBookings: 0, totalRevenue: 0, activeRoutes: 0, activeDrivers: 0, pendingApps: 0 });

  // Route form
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeForm, setRouteForm] = useState({
    name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '',
    destination_name_en: '', destination_name_ar: '', origin_lat: 30.0444,
    origin_lng: 31.2357, destination_lat: 30.0131, destination_lng: 31.2089,
    price: 25, estimated_duration_minutes: 30,
  });

  // Shuttle assignment
  const [assignForm, setAssignForm] = useState({ shuttle_id: '', route_id: '', driver_id: '' });

  useEffect(() => {
    if (!user) return;
    // Check admin role
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }).then(({ data }) => {
      setIsAdmin(!!data);
      if (data) fetchAllData();
      else setLoading(false);
    });
  }, [user]);

  const fetchAllData = async () => {
    const [routesRes, appsRes, shuttlesRes, bookingsRes] = await Promise.all([
      supabase.from('routes').select('*').order('created_at', { ascending: false }),
      supabase.from('driver_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('shuttles').select('*, routes(name_en, name_ar)').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, routes(name_en, name_ar)').order('created_at', { ascending: false }).limit(100),
    ]);

    setRoutes(routesRes.data || []);
    setApplications(appsRes.data || []);
    setShuttles(shuttlesRes.data || []);
    const bks = bookingsRes.data || [];
    setBookings(bks);

    setStats({
      totalBookings: bks.length,
      totalRevenue: bks.filter(b => b.status === 'completed').reduce((s, b) => s + Number(b.total_price || 0), 0),
      activeRoutes: (routesRes.data || []).filter(r => r.status === 'active').length,
      activeDrivers: (shuttlesRes.data || []).filter(s => s.status === 'active').length,
      pendingApps: (appsRes.data || []).filter(a => a.status === 'pending').length,
    });
    setLoading(false);
  };

  const createRoute = async () => {
    const { error } = await supabase.from('routes').insert({
      ...routeForm,
      description_en: `${routeForm.origin_name_en} to ${routeForm.destination_name_en}`,
      description_ar: `${routeForm.origin_name_ar} إلى ${routeForm.destination_name_ar}`,
      status: 'active',
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Route created!');
    setShowRouteForm(false);
    setRouteForm({ name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '', destination_name_en: '', destination_name_ar: '', origin_lat: 30.0444, origin_lng: 31.2357, destination_lat: 30.0131, destination_lng: 31.2089, price: 25, estimated_duration_minutes: 30 });
    fetchAllData();
  };

  const toggleRouteStatus = async (id: string, current: string) => {
    const newStatus = current === 'active' ? 'inactive' : 'active';
    await supabase.from('routes').update({ status: newStatus }).eq('id', id);
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    toast.success('Route status updated');
  };

  const handleApplication = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('driver_applications').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }

    if (status === 'approved') {
      const app = applications.find(a => a.id === id);
      if (app) {
        // Create shuttle for approved driver
        await supabase.from('shuttles').insert({
          driver_id: app.user_id,
          vehicle_model: app.vehicle_model,
          vehicle_plate: app.vehicle_plate,
          status: 'inactive',
        });
        // Update profile to driver
        await supabase.from('profiles').update({ user_type: 'driver' }).eq('user_id', app.user_id);
      }
    }

    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    toast.success(`Application ${status}`);
    fetchAllData();
  };

  const assignShuttleRoute = async () => {
    if (!assignForm.shuttle_id || !assignForm.route_id) return;
    const { error } = await supabase.from('shuttles').update({ route_id: assignForm.route_id }).eq('id', assignForm.shuttle_id);
    if (error) { toast.error(error.message); return; }
    toast.success('Shuttle assigned to route');
    setAssignForm({ shuttle_id: '', route_id: '', driver_id: '' });
    fetchAllData();
  };

  const deleteRoute = async (id: string) => {
    await supabase.from('routes').update({ status: 'inactive' }).eq('id', id);
    fetchAllData();
    toast.success('Route deactivated');
  };

  const seedTestData = async () => {
    try {
      // 1. Create test routes
      const testRoutes = [
        {
          name_en: 'Madinaty - Smart Village', name_ar: 'مدينتي - القرية الذكية',
          origin_name_en: 'Madinaty Gate 1', origin_name_ar: 'بوابة مدينتي 1',
          destination_name_en: 'Smart Village', destination_name_ar: 'القرية الذكية',
          origin_lat: 30.1070, origin_lng: 31.6387, destination_lat: 30.0712, destination_lng: 31.0167,
          price: 35, estimated_duration_minutes: 60, status: 'active',
          description_en: 'Madinaty to Smart Village', description_ar: 'مدينتي إلى القرية الذكية',
        },
        {
          name_en: 'Nasr City - Downtown', name_ar: 'مدينة نصر - وسط البلد',
          origin_name_en: 'City Stars', origin_name_ar: 'سيتي ستارز',
          destination_name_en: 'Tahrir Square', destination_name_ar: 'ميدان التحرير',
          origin_lat: 30.0731, origin_lng: 31.3455, destination_lat: 30.0444, destination_lng: 31.2357,
          price: 20, estimated_duration_minutes: 35, status: 'active',
          description_en: 'Nasr City to Downtown Cairo', description_ar: 'مدينة نصر إلى وسط البلد',
        },
        {
          name_en: '6th October - Mohandessin', name_ar: '6 أكتوبر - المهندسين',
          origin_name_en: 'Mall of Arabia', origin_name_ar: 'مول العرب',
          destination_name_en: 'Mohandessin', destination_name_ar: 'المهندسين',
          origin_lat: 29.9726, origin_lng: 30.9461, destination_lat: 30.0561, destination_lng: 31.2001,
          price: 25, estimated_duration_minutes: 45, status: 'active',
          description_en: '6th October to Mohandessin', description_ar: '6 أكتوبر إلى المهندسين',
        },
      ];

      const { data: insertedRoutes, error: routeErr } = await supabase.from('routes').insert(testRoutes).select();
      if (routeErr) throw routeErr;

      // 2. Create test shuttles
      const testShuttles = [
        { vehicle_model: 'Toyota HiAce 2024', vehicle_plate: 'ق ب ج 1234', capacity: 14, status: 'active' },
        { vehicle_model: 'Mercedes Sprinter 2023', vehicle_plate: 'أ ب ت 5678', capacity: 16, status: 'active' },
        { vehicle_model: 'Ford Transit 2024', vehicle_plate: 'م ن و 9012', capacity: 12, status: 'active' },
      ];

      const { data: insertedShuttles, error: shuttleErr } = await supabase.from('shuttles').insert(testShuttles).select();
      if (shuttleErr) throw shuttleErr;

      // 3. Assign routes to shuttles
      if (insertedRoutes && insertedShuttles) {
        for (let i = 0; i < Math.min(insertedRoutes.length, insertedShuttles.length); i++) {
          await supabase.from('shuttles').update({ route_id: insertedRoutes[i].id }).eq('id', insertedShuttles[i].id);
        }

        // 4. Create ride instances for the next 2 weeks
        const rideInstances: any[] = [];
        const today = new Date();
        for (let i = 0; i < 14; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dayOfWeek = date.getDay();
          // Skip Friday (5)
          if (dayOfWeek === 5) continue;
          const dateStr = date.toISOString().split('T')[0];

          for (let j = 0; j < insertedRoutes.length; j++) {
            const shuttle = insertedShuttles[j % insertedShuttles.length];
            // Morning ride
            rideInstances.push({
              route_id: insertedRoutes[j].id,
              shuttle_id: shuttle.id,
              driver_id: user!.id, // admin as placeholder driver
              ride_date: dateStr,
              departure_time: '08:00',
              available_seats: shuttle.capacity,
              total_seats: shuttle.capacity,
              status: 'scheduled',
            });
            // Evening ride
            rideInstances.push({
              route_id: insertedRoutes[j].id,
              shuttle_id: shuttle.id,
              driver_id: user!.id,
              ride_date: dateStr,
              departure_time: '17:00',
              available_seats: shuttle.capacity,
              total_seats: shuttle.capacity,
              status: 'scheduled',
            });
          }
        }

        const { error: rideErr } = await supabase.from('ride_instances').upsert(rideInstances, { onConflict: 'shuttle_id,ride_date,departure_time' });
        if (rideErr) throw rideErr;
      }

      toast.success(lang === 'ar' ? 'تم إضافة البيانات التجريبية!' : 'Test data seeded successfully!');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed data');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-card border border-border rounded-2xl p-12 text-center max-w-md">
          <Shield className="w-16 h-16 text-destructive/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'غير مصرح' : 'Access Denied'}</h2>
          <p className="text-muted-foreground mb-4">{lang === 'ar' ? 'تحتاج صلاحيات المشرف للوصول' : 'You need admin privileges to access this panel.'}</p>
          <Link to="/dashboard"><Button>{lang === 'ar' ? 'العودة' : 'Go Back'}</Button></Link>
        </div>
      </div>
    );
  }

  const tabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: 'analytics', icon: BarChart3, label: lang === 'ar' ? 'التحليلات' : 'Analytics' },
    { key: 'routes', icon: Route, label: lang === 'ar' ? 'المسارات' : 'Routes' },
    { key: 'drivers', icon: Users, label: lang === 'ar' ? 'السائقين' : 'Drivers' },
    { key: 'shuttles', icon: Car, label: lang === 'ar' ? 'الشاتلات' : 'Shuttles' },
    { key: 'bookings', icon: Ticket, label: lang === 'ar' ? 'الحجوزات' : 'Bookings' },
  ];

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-muted text-muted-foreground',
    pending: 'bg-secondary/20 text-secondary',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-destructive/10 text-destructive',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive',
    boarded: 'bg-primary/10 text-primary',
    maintenance: 'bg-secondary/20 text-secondary',
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <Link to="/" className="text-xl font-bold text-primary">{lang === 'ar' ? 'مسار' : 'Massar'}</Link>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Button variant="ghost" size="icon" onClick={() => signOut()}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
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

        {/* Analytics Tab */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: lang === 'ar' ? 'إجمالي الحجوزات' : 'Total Bookings', value: stats.totalBookings, icon: Ticket },
                { label: lang === 'ar' ? 'الإيرادات' : 'Revenue', value: `${stats.totalRevenue.toFixed(0)} EGP`, icon: BarChart3 },
                { label: lang === 'ar' ? 'المسارات النشطة' : 'Active Routes', value: stats.activeRoutes, icon: Route },
                { label: lang === 'ar' ? 'السائقين النشطين' : 'Active Drivers', value: stats.activeDrivers, icon: Car },
                { label: lang === 'ar' ? 'طلبات معلقة' : 'Pending Apps', value: stats.pendingApps, icon: Users },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5">
                  <s.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent bookings chart placeholder */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">{lang === 'ar' ? 'الحجوزات الأخيرة' : 'Recent Bookings'}</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                {['pending', 'confirmed', 'boarded', 'completed'].map(status => {
                  const count = bookings.filter(b => b.status === status).length;
                  return (
                    <div key={status} className="bg-surface rounded-lg p-4">
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[status]}`}>{status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seed Test Data */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">{lang === 'ar' ? 'بيانات تجريبية' : 'Test Data'}</h3>
              <p className="text-sm text-muted-foreground mb-4">{lang === 'ar' ? 'إضافة مسارات وشاتلات ورحلات تجريبية' : 'Add sample routes, shuttles, and ride instances for testing'}</p>
              <Button onClick={seedTestData} variant="outline">
                <Database className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة بيانات تجريبية' : 'Seed Test Data'}
              </Button>
            </div>
          </div>
        )}

        {/* Routes Tab */}
        {tab === 'routes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'إدارة المسارات' : 'Route Management'}</h2>
              <Button onClick={() => setShowRouteForm(!showRouteForm)}>
                <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'مسار جديد' : 'New Route'}
              </Button>
            </div>

            {showRouteForm && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-foreground">{lang === 'ar' ? 'إنشاء مسار' : 'Create Route'}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name (EN)</Label>
                    <Input value={routeForm.name_en} onChange={e => setRouteForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Madinaty - Smart Village" />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (AR)</Label>
                    <Input value={routeForm.name_ar} onChange={e => setRouteForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مدينتي - القرية الذكية" />
                  </div>
                  <div className="space-y-2">
                    <Label>Origin (EN)</Label>
                    <Input value={routeForm.origin_name_en} onChange={e => setRouteForm(p => ({ ...p, origin_name_en: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Origin (AR)</Label>
                    <Input value={routeForm.origin_name_ar} onChange={e => setRouteForm(p => ({ ...p, origin_name_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination (EN)</Label>
                    <Input value={routeForm.destination_name_en} onChange={e => setRouteForm(p => ({ ...p, destination_name_en: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination (AR)</Label>
                    <Input value={routeForm.destination_name_ar} onChange={e => setRouteForm(p => ({ ...p, destination_name_ar: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-500" />
                      {lang === 'ar' ? 'نقطة الانطلاق (انقر على الخريطة)' : 'Origin (click on map)'}
                    </Label>
                    <MapView
                      className="h-[200px]"
                      center={{ lat: routeForm.origin_lat, lng: routeForm.origin_lng }}
                      zoom={12}
                      markers={[{ lat: routeForm.origin_lat, lng: routeForm.origin_lng, label: 'A', color: 'green' }]}
                      onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, origin_lat: parseFloat(lat.toFixed(6)), origin_lng: parseFloat(lng.toFixed(6)) }))}
                      showUserLocation={false}
                    />
                    <p className="text-xs text-muted-foreground">{routeForm.origin_lat.toFixed(4)}, {routeForm.origin_lng.toFixed(4)}</p>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-destructive" />
                      {lang === 'ar' ? 'نقطة الوصول (انقر على الخريطة)' : 'Destination (click on map)'}
                    </Label>
                    <MapView
                      className="h-[200px]"
                      center={{ lat: routeForm.destination_lat, lng: routeForm.destination_lng }}
                      zoom={12}
                      markers={[{ lat: routeForm.destination_lat, lng: routeForm.destination_lng, label: 'B', color: 'red' }]}
                      onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, destination_lat: parseFloat(lat.toFixed(6)), destination_lng: parseFloat(lng.toFixed(6)) }))}
                      showUserLocation={false}
                    />
                    <p className="text-xs text-muted-foreground">{routeForm.destination_lat.toFixed(4)}, {routeForm.destination_lng.toFixed(4)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{lang === 'ar' ? 'السعر للفرد (جنيه)' : 'Price per person (EGP)'}</Label>
                    <Input type="number" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: parseFloat(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" value={routeForm.estimated_duration_minutes} onChange={e => setRouteForm(p => ({ ...p, estimated_duration_minutes: parseInt(e.target.value) }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={createRoute} disabled={!routeForm.name_en || !routeForm.name_ar}>
                    <CheckCircle2 className="w-4 h-4 me-1" />{lang === 'ar' ? 'إنشاء' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowRouteForm(false)}>
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )}

            {routes.map(route => (
              <div key={route.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{lang === 'ar' ? route.name_ar : route.name_en}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[route.status]}`}>{route.status}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <MapPin className="w-3.5 h-3.5 text-green-500" />
                  <span>{lang === 'ar' ? route.origin_name_ar : route.origin_name_en}</span>
                  <span>→</span>
                  <MapPin className="w-3.5 h-3.5 text-destructive" />
                  <span>{lang === 'ar' ? route.destination_name_ar : route.destination_name_en}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{route.price} EGP</span>
                  <span><Clock className="w-3 h-3 inline me-1" />{route.estimated_duration_minutes} min</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleRouteStatus(route.id, route.status)}>
                    {route.status === 'active' ? (lang === 'ar' ? 'تعطيل' : 'Deactivate') : (lang === 'ar' ? 'تفعيل' : 'Activate')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات السائقين' : 'Driver Applications'}</h2>
            {applications.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا توجد طلبات' : 'No applications yet'}
              </div>
            ) : applications.map(app => (
              <div key={app.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{app.vehicle_model} · {app.vehicle_plate}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.phone && <>{lang === 'ar' ? 'الهاتف' : 'Phone'}: {app.phone} · </>}
                      {lang === 'ar' ? 'الخبرة' : 'Experience'}: {app.experience_years} {lang === 'ar' ? 'سنة' : 'yrs'}
                    </p>
                    {app.was_uber_driver && (
                      <span className="inline-block text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full mt-1 font-medium">
                        {lang === 'ar' ? '⚡ سائق أوبر/كريم سابق' : '⚡ Former Uber/Careem driver'}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[app.status]}`}>{app.status}</span>
                </div>

                {app.notes && <p className="text-sm text-muted-foreground mb-3">{app.notes}</p>}

                {/* Document previews */}
                {(app.id_front_url || app.id_back_url || app.driving_license_url || app.car_license_url || app.criminal_record_url) && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      {lang === 'ar' ? 'المستندات المرفقة:' : 'Uploaded Documents:'}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {[
                        { url: app.id_front_url, label: lang === 'ar' ? 'بطاقة أمام' : 'ID Front' },
                        { url: app.id_back_url, label: lang === 'ar' ? 'بطاقة خلف' : 'ID Back' },
                        { url: app.driving_license_url, label: lang === 'ar' ? 'رخصة قيادة' : 'License' },
                        { url: app.car_license_url, label: lang === 'ar' ? 'رخصة سيارة' : 'Car License' },
                        { url: app.criminal_record_url, label: lang === 'ar' ? 'فيش' : 'Criminal Rec.' },
                      ].filter(d => d.url).map((doc, i) => (
                        <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="block border border-border rounded-lg overflow-hidden hover:border-primary transition-colors group">
                          <img src={doc.url} alt={doc.label} className="w-full h-16 object-cover" />
                          <p className="text-[10px] text-muted-foreground text-center py-1 group-hover:text-primary">{doc.label}</p>
                        </a>
                      ))}
                    </div>
                    {app.uber_proof_url && (
                      <div className="mt-2">
                        <a href={app.uber_proof_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-secondary hover:underline">
                          <Eye className="w-3 h-3" />
                          {lang === 'ar' ? 'عرض إثبات أوبر/كريم' : 'View Uber/Careem proof'}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApplication(app.id, 'approved')}>
                      <CheckCircle2 className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'قبول' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApplication(app.id, 'rejected')}>
                      <XCircle className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'رفض' : 'Reject'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Shuttles Tab */}
        {tab === 'shuttles' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'إدارة الشاتلات' : 'Shuttle Management'}</h2>

            {/* Assignment form */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3">{lang === 'ar' ? 'تعيين مسار' : 'Assign Route to Shuttle'}</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignForm.shuttle_id} onChange={e => setAssignForm(p => ({ ...p, shuttle_id: e.target.value }))}>
                  <option value="">{lang === 'ar' ? 'اختر شاتل' : 'Select Shuttle'}</option>
                  {shuttles.map(s => <option key={s.id} value={s.id}>{s.vehicle_model} - {s.vehicle_plate}</option>)}
                </select>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignForm.route_id} onChange={e => setAssignForm(p => ({ ...p, route_id: e.target.value }))}>
                  <option value="">{lang === 'ar' ? 'اختر مسار' : 'Select Route'}</option>
                  {routes.filter(r => r.status === 'active').map(r => <option key={r.id} value={r.id}>{lang === 'ar' ? r.name_ar : r.name_en}</option>)}
                </select>
                <Button onClick={assignShuttleRoute} disabled={!assignForm.shuttle_id || !assignForm.route_id}>
                  {lang === 'ar' ? 'تعيين' : 'Assign'}
                </Button>
              </div>
            </div>

            {shuttles.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground">{s.vehicle_model} · {s.vehicle_plate}</p>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ar' ? 'السعة' : 'Capacity'}: {s.capacity} ·
                      {s.routes ? ` ${lang === 'ar' ? s.routes.name_ar : s.routes.name_en}` : (lang === 'ar' ? ' بدون مسار' : ' No route')}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[s.status]}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bookings Tab */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'جميع الحجوزات' : 'All Bookings'}</h2>
            {bookings.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا توجد حجوزات' : 'No bookings'}
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                      <p className="text-xs text-muted-foreground">{b.scheduled_date} · {b.scheduled_time} · {b.seats} seat(s) · {b.total_price} EGP</p>
                      {b.boarding_code && <p className="text-xs text-muted-foreground font-mono">Code: {b.boarding_code}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
