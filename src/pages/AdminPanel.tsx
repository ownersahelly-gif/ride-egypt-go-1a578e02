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
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import {
  ChevronLeft, Route, Users, Car, Ticket, BarChart3, Plus, Edit, Trash2,
  CheckCircle2, XCircle, MapPin, Clock, Search, Globe, LogOut, Shield,
  Loader2, Eye, Database, Settings, Phone, Package, ListOrdered
} from 'lucide-react';

type AdminTab = 'routes' | 'drivers' | 'shuttles' | 'bookings' | 'analytics' | 'approvals' | 'settings' | 'carpool' | 'users' | 'route_requests';

const AdminPanel = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { toast: legacyToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // InstaPay settings
  const [instapayPhone, setInstapayPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // Bundle management
  const [bundles, setBundles] = useState<any[]>([]);
  const [carpoolVerifications, setCarpoolVerifications] = useState<any[]>([]);
  const [carpoolProfiles, setCarpoolProfiles] = useState<Record<string, any>>({});
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [bundleForm, setBundleForm] = useState({ route_id: '', bundle_type: 'weekly', ride_count: 10, price: 200, discount_percentage: 15 });
  const [savingBundle, setSavingBundle] = useState(false);

  // Data states
  const [routes, setRoutes] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [shuttles, setShuttles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBookings: 0, totalRevenue: 0, activeRoutes: 0, activeDrivers: 0, pendingApps: 0 });
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [routeRequests, setRouteRequests] = useState<any[]>([]);
  const [routeRequestProfiles, setRouteRequestProfiles] = useState<Record<string, any>>({});

  // Stops management
  const [expandedRouteStops, setExpandedRouteStops] = useState<string | null>(null);
  const [routeStopsMap, setRouteStopsMap] = useState<Record<string, any[]>>({});
  const [stopForm, setStopForm] = useState({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both', arrival_time: '' });
  const [addingStop, setAddingStop] = useState(false);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [globalWaitingTime, setGlobalWaitingTime] = useState('3');
  const [savingWaitingTime, setSavingWaitingTime] = useState(false);

  // Route form
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
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
    const [routesRes, appsRes, shuttlesRes, bookingsRes, settingsRes, bundlesRes, carpoolVerRes, profilesRes, routeReqRes] = await Promise.all([
      supabase.from('routes').select('*').order('created_at', { ascending: false }),
      supabase.from('driver_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('shuttles').select('*, routes(name_en, name_ar)').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, routes(name_en, name_ar)').order('created_at', { ascending: true }).limit(200),
      supabase.from('app_settings').select('*').eq('key', 'instapay_phone').single(),
      supabase.from('ride_bundles').select('*, routes(name_en, name_ar)').order('created_at', { ascending: false }),
      supabase.from('carpool_verifications').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('route_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setAllProfiles(profilesRes.data || []);
    const rrs = routeReqRes.data || [];
    setRouteRequests(rrs);
    const rrUserIds = [...new Set(rrs.map((r: any) => r.user_id))];
    if (rrUserIds.length > 0) {
      const rrMap: Record<string, any> = {};
      (profilesRes.data || []).filter((p: any) => rrUserIds.includes(p.user_id)).forEach((p: any) => { rrMap[p.user_id] = p; });
      setRouteRequestProfiles(rrMap);
    }

    if (settingsRes.data) setInstapayPhone(settingsRes.data.value);
    // Fetch global waiting time
    const { data: waitData } = await supabase.from('app_settings').select('value').eq('key', 'stop_waiting_time_minutes').single();
    if (waitData) setGlobalWaitingTime(waitData.value);
    setBundles(bundlesRes.data || []);
    const cvs = carpoolVerRes.data || [];
    setCarpoolVerifications(cvs);
    // Fetch profiles for carpool verifications
    const cvUserIds = [...new Set(cvs.map((v: any) => v.user_id))];
    if (cvUserIds.length > 0) {
      const { data: cvProfs } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', cvUserIds);
      const cvMap: Record<string, any> = {};
      (cvProfs || []).forEach((p: any) => { cvMap[p.user_id] = p; });
      setCarpoolProfiles(cvMap);
    }

    setRoutes(routesRes.data || []);

    // Fetch all stops grouped by route for stop counts
    const allRouteIds = (routesRes.data || []).map((r: any) => r.id);
    if (allRouteIds.length > 0) {
      const { data: allStops } = await supabase.from('stops').select('*').in('route_id', allRouteIds).order('stop_order');
      const stopsMap: Record<string, any[]> = {};
      (allStops || []).forEach((s: any) => {
        if (!stopsMap[s.route_id]) stopsMap[s.route_id] = [];
        stopsMap[s.route_id].push(s);
      });
      setRouteStopsMap(stopsMap);
    }

    setApplications(appsRes.data || []);
    setShuttles(shuttlesRes.data || []);
    const bks = bookingsRes.data || [];

    // Fetch profiles for all booking user_ids
    const userIds = [...new Set(bks.map(b => b.user_id))];
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    }

    setBookings(bks.map(b => ({ ...b, profile: profileMap[b.user_id] })));

    setStats({
      totalBookings: bks.length,
      totalRevenue: bks.filter(b => b.status === 'completed').reduce((s, b) => s + Number(b.total_price || 0), 0),
      activeRoutes: (routesRes.data || []).filter(r => r.status === 'active').length,
      activeDrivers: (shuttlesRes.data || []).filter(s => s.status === 'active').length,
      pendingApps: (appsRes.data || []).filter(a => a.status === 'pending').length,
    });
    setLoading(false);
  };

  const saveInstapayPhone = async () => {
    setSavingPhone(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'instapay_phone', value: instapayPhone },
      { onConflict: 'key' }
    );
    if (error) toast.error(error.message);
    else toast.success(lang === 'ar' ? 'تم حفظ رقم InstaPay' : 'InstaPay number saved');
    setSavingPhone(false);
  };

  const createRoute = async () => {
    const routeData = {
      ...routeForm,
      description_en: `${routeForm.origin_name_en} to ${routeForm.destination_name_en}`,
      description_ar: `${routeForm.origin_name_ar} إلى ${routeForm.destination_name_ar}`,
      status: 'active',
    };
    if (editingRouteId) {
      const { error } = await supabase.from('routes').update(routeData).eq('id', editingRouteId);
      if (error) { toast.error(error.message); return; }
      toast.success(lang === 'ar' ? 'تم تحديث المسار' : 'Route updated!');
    } else {
      const { error } = await supabase.from('routes').insert(routeData);
      if (error) { toast.error(error.message); return; }
      toast.success('Route created!');
    }
    setShowRouteForm(false);
    setEditingRouteId(null);
    setRouteForm({ name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '', destination_name_en: '', destination_name_ar: '', origin_lat: 30.0444, origin_lng: 31.2357, destination_lat: 30.0131, destination_lng: 31.2089, price: 25, estimated_duration_minutes: 30 });
    fetchAllData();
  };

  const startEditRoute = (route: any) => {
    setRouteForm({
      name_en: route.name_en, name_ar: route.name_ar,
      origin_name_en: route.origin_name_en, origin_name_ar: route.origin_name_ar,
      destination_name_en: route.destination_name_en, destination_name_ar: route.destination_name_ar,
      origin_lat: route.origin_lat, origin_lng: route.origin_lng,
      destination_lat: route.destination_lat, destination_lng: route.destination_lng,
      price: route.price, estimated_duration_minutes: route.estimated_duration_minutes,
    });
    setEditingRouteId(route.id);
    setShowRouteForm(true);
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

  // --- Stops management ---
  const fetchStopsForRoute = async (routeId: string) => {
    const { data } = await supabase.from('stops').select('*').eq('route_id', routeId).order('stop_order');
    setRouteStopsMap(prev => ({ ...prev, [routeId]: data || [] }));
  };

  const toggleRouteStops = async (routeId: string) => {
    if (expandedRouteStops === routeId) {
      setExpandedRouteStops(null);
      return;
    }
    setExpandedRouteStops(routeId);
    setStopForm({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both', arrival_time: '' });
    setEditingStopId(null);
    if (!routeStopsMap[routeId]) await fetchStopsForRoute(routeId);
  };

  const addStop = async (routeId: string) => {
    if (!stopForm.name_en || !stopForm.name_ar) return;
    setAddingStop(true);
    if (editingStopId) {
      const { error } = await supabase.from('stops').update({
        name_en: stopForm.name_en,
        name_ar: stopForm.name_ar,
        lat: stopForm.lat,
        lng: stopForm.lng,
        stop_type: stopForm.stop_type,
        // keep existing stop_order when editing
        arrival_time: stopForm.arrival_time || null,
      }).eq('id', editingStopId);
      if (error) toast.error(error.message);
      else {
        toast.success(lang === 'ar' ? 'تم تحديث نقطة التوقف' : 'Stop updated');
        setEditingStopId(null);
        setStopForm({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both', arrival_time: '' });
        await fetchStopsForRoute(routeId);
      }
    } else {
      const { error } = await supabase.from('stops').insert({
        route_id: routeId,
        name_en: stopForm.name_en,
        name_ar: stopForm.name_ar,
        lat: stopForm.lat,
        lng: stopForm.lng,
        stop_type: stopForm.stop_type,
        stop_order: routeStopsMap[routeId]?.length || 0,
        arrival_time: stopForm.arrival_time || null,
      });
      if (error) toast.error(error.message);
      else {
        toast.success(lang === 'ar' ? 'تمت إضافة نقطة التوقف' : 'Stop added');
        setStopForm({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both', arrival_time: '' });
        await fetchStopsForRoute(routeId);
      }
    }
    setAddingStop(false);
  };

  const startEditStop = (stop: any) => {
    setEditingStopId(stop.id);
    setStopForm({
      name_en: stop.name_en,
      name_ar: stop.name_ar,
      lat: stop.lat,
      lng: stop.lng,
      stop_type: stop.stop_type,
      
      arrival_time: stop.arrival_time || '',
    });
  };

  const saveGlobalWaitingTime = async () => {
    setSavingWaitingTime(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'stop_waiting_time_minutes', value: globalWaitingTime },
      { onConflict: 'key' }
    );
    if (error) toast.error(error.message);
    else toast.success(lang === 'ar' ? 'تم حفظ وقت الانتظار' : 'Waiting time saved');
    setSavingWaitingTime(false);
  };

  const deleteStop = async (stopId: string, routeId: string) => {
    const { error } = await supabase.from('stops').delete().eq('id', stopId);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === 'ar' ? 'تم حذف نقطة التوقف' : 'Stop deleted');
      // Re-order remaining stops
      const remaining = (routeStopsMap[routeId] || []).filter(s => s.id !== stopId);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].stop_order !== i) {
          await supabase.from('stops').update({ stop_order: i }).eq('id', remaining[i].id);
        }
      }
      await fetchStopsForRoute(routeId);
    }
  };

  const moveStop = async (routeId: string, index: number, direction: 'up' | 'down') => {
    const stops = [...(routeStopsMap[routeId] || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length) return;
    // Swap stop_order values
    const currentStop = stops[index];
    const targetStop = stops[targetIndex];
    await Promise.all([
      supabase.from('stops').update({ stop_order: targetIndex }).eq('id', currentStop.id),
      supabase.from('stops').update({ stop_order: index }).eq('id', targetStop.id),
    ]);
    await fetchStopsForRoute(routeId);
  };


  const seedTestData = async () => {
    try {
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

      const testShuttles = [
        { vehicle_model: 'Toyota HiAce 2024', vehicle_plate: 'ق ب ج 1234', capacity: 14, status: 'active' },
        { vehicle_model: 'Mercedes Sprinter 2023', vehicle_plate: 'أ ب ت 5678', capacity: 16, status: 'active' },
        { vehicle_model: 'Ford Transit 2024', vehicle_plate: 'م ن و 9012', capacity: 12, status: 'active' },
      ];

      const { data: insertedShuttles, error: shuttleErr } = await supabase.from('shuttles').insert(testShuttles).select();
      if (shuttleErr) throw shuttleErr;

      if (insertedRoutes && insertedShuttles) {
        for (let i = 0; i < Math.min(insertedRoutes.length, insertedShuttles.length); i++) {
          await supabase.from('shuttles').update({ route_id: insertedRoutes[i].id }).eq('id', insertedShuttles[i].id);
        }

        const rideInstances: any[] = [];
        const today = new Date();
        for (let i = 0; i < 14; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dayOfWeek = date.getDay();
          if (dayOfWeek === 5) continue;
          const dateStr = date.toISOString().split('T')[0];

          for (let j = 0; j < insertedRoutes.length; j++) {
            const shuttle = insertedShuttles[j % insertedShuttles.length];
            rideInstances.push({
              route_id: insertedRoutes[j].id, shuttle_id: shuttle.id, driver_id: user!.id,
              ride_date: dateStr, departure_time: '08:00', available_seats: shuttle.capacity,
              total_seats: shuttle.capacity, status: 'scheduled',
            });
            rideInstances.push({
              route_id: insertedRoutes[j].id, shuttle_id: shuttle.id, driver_id: user!.id,
              ride_date: dateStr, departure_time: '17:00', available_seats: shuttle.capacity,
              total_seats: shuttle.capacity, status: 'scheduled',
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

  // --- Booking approval ---
  const handleBookingApproval = async (bookingId: string, action: 'confirmed' | 'rejected') => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const { error } = await supabase.from('bookings').update({ status: action }).eq('id', bookingId);
    if (error) { toast.error(error.message); return; }

    // If rejecting, restore the seat
    if (action === 'rejected' && booking.shuttle_id && booking.route_id) {
      const { data: ride } = await supabase.from('ride_instances')
        .select('id, available_seats')
        .eq('shuttle_id', booking.shuttle_id)
        .eq('route_id', booking.route_id)
        .eq('ride_date', booking.scheduled_date)
        .eq('departure_time', booking.scheduled_time)
        .single();
      if (ride) {
        await supabase.from('ride_instances').update({ available_seats: ride.available_seats + 1 }).eq('id', ride.id);
      }
    }

    toast.success(action === 'confirmed'
      ? (lang === 'ar' ? 'تم قبول الحجز' : 'Booking approved')
      : (lang === 'ar' ? 'تم رفض الحجز' : 'Booking rejected'));
    fetchAllData();
  };

  // Promote waitlist passenger
  const promoteWaitlist = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'pending', waitlist_position: null }).eq('id', bookingId);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === 'ar' ? 'تمت ترقية الراكب من قائمة الانتظار' : 'Passenger promoted from waitlist');
    fetchAllData();
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const waitlistBookings = bookings.filter(b => b.status === 'waitlist').sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0));

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
    { key: 'approvals', icon: CheckCircle2, label: lang === 'ar' ? 'الموافقات' : 'Approvals' },
    { key: 'carpool', icon: Car, label: lang === 'ar' ? 'مشاركة الرحلات' : 'Carpool' },
    { key: 'routes', icon: Route, label: lang === 'ar' ? 'المسارات' : 'Routes' },
    { key: 'drivers', icon: Users, label: lang === 'ar' ? 'السائقين' : 'Drivers' },
    { key: 'shuttles', icon: Car, label: lang === 'ar' ? 'الشاتلات' : 'Shuttles' },
    { key: 'bookings', icon: Ticket, label: lang === 'ar' ? 'الحجوزات' : 'Bookings' },
    { key: 'users', icon: Users, label: lang === 'ar' ? 'المستخدمين' : 'Users' },
    { key: 'route_requests', icon: MapPin, label: lang === 'ar' ? 'طلبات المسارات' : 'Route Requests' },
    { key: 'settings', icon: Settings, label: lang === 'ar' ? 'الإعدادات' : 'Settings' },
  ];

  const handleCarpoolVerification = async (verificationId: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    const { error } = await supabase.from('carpool_verifications').update({ status, admin_notes: adminNotes || null }).eq('id', verificationId);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved'
      ? (lang === 'ar' ? 'تم قبول التحقق' : 'Verification approved')
      : (lang === 'ar' ? 'تم رفض التحقق' : 'Verification rejected'));
    fetchAllData();
  };

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
    waitlist: 'bg-amber-100 text-amber-700',
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
              <Button onClick={() => { setEditingRouteId(null); setRouteForm({ name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '', destination_name_en: '', destination_name_ar: '', origin_lat: 30.0444, origin_lng: 31.2357, destination_lat: 30.0131, destination_lng: 31.2089, price: 25, estimated_duration_minutes: 30 }); setShowRouteForm(!showRouteForm); }}>
                <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'مسار جديد' : 'New Route'}
              </Button>
            </div>

            {showRouteForm && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-foreground">{editingRouteId ? (lang === 'ar' ? 'تعديل المسار' : 'Edit Route') : (lang === 'ar' ? 'إنشاء مسار' : 'Create Route')}</h3>
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
                      {lang === 'ar' ? 'نقطة الانطلاق' : 'Origin'}
                    </Label>
                    <PlacesAutocomplete
                      placeholder={lang === 'ar' ? 'ابحث عن نقطة الانطلاق...' : 'Search origin location...'}
                      onSelect={(place) => setRouteForm(p => ({ ...p, origin_lat: parseFloat(place.lat.toFixed(6)), origin_lng: parseFloat(place.lng.toFixed(6)), origin_name_en: p.origin_name_en || place.name, origin_name_ar: p.origin_name_ar || place.name }))}
                      iconColor="text-green-500"
                    />
                    <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
                      <MapView
                        className="h-full w-full"
                        center={{ lat: routeForm.origin_lat, lng: routeForm.origin_lng }}
                        zoom={13}
                        markers={[{ lat: routeForm.origin_lat, lng: routeForm.origin_lng, label: 'A', color: 'green' }]}
                        onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, origin_lat: parseFloat(lat.toFixed(6)), origin_lng: parseFloat(lng.toFixed(6)) }))}
                        showUserLocation={false}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{routeForm.origin_lat.toFixed(4)}, {routeForm.origin_lng.toFixed(4)}</p>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-destructive" />
                      {lang === 'ar' ? 'نقطة الوصول' : 'Destination'}
                    </Label>
                    <PlacesAutocomplete
                      placeholder={lang === 'ar' ? 'ابحث عن نقطة الوصول...' : 'Search destination location...'}
                      onSelect={(place) => setRouteForm(p => ({ ...p, destination_lat: parseFloat(place.lat.toFixed(6)), destination_lng: parseFloat(place.lng.toFixed(6)), destination_name_en: p.destination_name_en || place.name, destination_name_ar: p.destination_name_ar || place.name }))}
                      iconColor="text-destructive"
                    />
                    <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
                      <MapView
                        className="h-full w-full"
                        center={{ lat: routeForm.destination_lat, lng: routeForm.destination_lng }}
                        zoom={13}
                        markers={[{ lat: routeForm.destination_lat, lng: routeForm.destination_lng, label: 'B', color: 'red' }]}
                        onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, destination_lat: parseFloat(lat.toFixed(6)), destination_lng: parseFloat(lng.toFixed(6)) }))}
                        showUserLocation={false}
                      />
                    </div>
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
                    <CheckCircle2 className="w-4 h-4 me-1" />{editingRouteId ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'إنشاء' : 'Create')}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowRouteForm(false); setEditingRouteId(null); }}>
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
                  <span className="flex items-center gap-1">
                    <ListOrdered className="w-3 h-3 inline" />
                    {routeStopsMap[route.id]?.length || 0} {lang === 'ar' ? 'نقاط' : 'stops'}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => startEditRoute(route)}>
                    <Edit className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'تعديل' : 'Edit'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleRouteStops(route.id)}>
                    <ListOrdered className="w-3.5 h-3.5 me-1" />
                    {lang === 'ar' ? 'نقاط التوقف' : 'Stops'} ({routeStopsMap[route.id]?.length || '...'})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleRouteStatus(route.id, route.status)}>
                    {route.status === 'active' ? (lang === 'ar' ? 'تعطيل' : 'Deactivate') : (lang === 'ar' ? 'تفعيل' : 'Activate')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المسار؟' : 'Are you sure you want to delete this route?')) return;
                    await supabase.from('stops').delete().eq('route_id', route.id);
                    await supabase.from('routes').delete().eq('id', route.id);
                    toast.success(lang === 'ar' ? 'تم حذف المسار' : 'Route deleted');
                    fetchAllData();
                  }}>
                    <Trash2 className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'حذف' : 'Delete'}
                  </Button>
                </div>

                {/* Stops management panel */}
                {expandedRouteStops === route.id && (
                  <div className="mt-4 border-t border-border pt-4 space-y-4">
                    <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-primary" />
                      {lang === 'ar' ? 'نقاط التوقف' : 'Bus Stops'}
                    </h4>

                    {/* Existing stops */}
                    {(routeStopsMap[route.id] || []).length > 0 ? (
                      <div className="space-y-2">
                        {(routeStopsMap[route.id] || []).map((stop: any, idx: number) => (
                          <div key={stop.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                              <div>
                                <p className="font-medium text-foreground">{lang === 'ar' ? stop.name_ar : stop.name_en}</p>
                                <p className="text-xs text-muted-foreground">
                                  {stop.stop_type === 'both' ? '↕ Pickup & Dropoff' : stop.stop_type === 'pickup' ? '🟢 Pickup only' : '🔴 Dropoff only'}
                                  {' · '}{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                                  {stop.arrival_time && <> · <Clock className="w-3 h-3 inline" /> {stop.arrival_time}</>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" disabled={idx === 0} onClick={() => moveStop(route.id, idx, 'up')}>
                                <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" disabled={idx === (routeStopsMap[route.id] || []).length - 1} onClick={() => moveStop(route.id, idx, 'down')}>
                                <ChevronLeft className="w-3.5 h-3.5 -rotate-90" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={() => startEditStop(stop)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => deleteStop(stop.id, route.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد نقاط توقف بعد' : 'No stops yet. Add stops below.'}</p>
                    )}

                    {/* Add/Edit stop form */}
                    <div className="bg-surface rounded-xl p-4 space-y-3 border border-border">
                      <p className="text-sm font-medium text-foreground">
                        {editingStopId
                          ? (lang === 'ar' ? 'تعديل نقطة التوقف' : 'Edit Stop')
                          : (lang === 'ar' ? 'إضافة نقطة توقف' : 'Add New Stop')}
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name (EN)</Label>
                          <Input value={stopForm.name_en} onChange={e => setStopForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Gate 3" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Name (AR)</Label>
                          <Input value={stopForm.name_ar} onChange={e => setStopForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="بوابة 3" className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{lang === 'ar' ? 'النوع' : 'Type'}</Label>
                          <select value={stopForm.stop_type} onChange={e => setStopForm(p => ({ ...p, stop_type: e.target.value }))}
                            className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground">
                            <option value="both">↕ Pickup & Dropoff</option>
                            <option value="pickup">🟢 Pickup only</option>
                            <option value="dropoff">🔴 Dropoff only</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> {lang === 'ar' ? 'وقت الوصول' : 'Arrival Time'}</Label>
                          <Input type="time" value={stopForm.arrival_time} onChange={e => setStopForm(p => ({ ...p, arrival_time: e.target.value }))} className="h-9 text-sm" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Search className="w-3 h-3" /> {lang === 'ar' ? 'ابحث عن الموقع' : 'Search location'}</Label>
                        <PlacesAutocomplete
                          placeholder={lang === 'ar' ? 'ابحث عن موقع...' : 'Search for a place...'}
                          onSelect={(place) => setStopForm(p => ({ ...p, lat: parseFloat(place.lat.toFixed(6)), lng: parseFloat(place.lng.toFixed(6)), name_en: p.name_en || place.name, name_ar: p.name_ar || place.name }))}
                          iconColor="text-primary"
                        />
                        <div className="h-[300px] w-full overflow-hidden rounded-lg border border-border bg-muted">
                          <MapView
                            className="h-full w-full"
                            center={stopForm.lat !== 0 ? { lat: stopForm.lat, lng: stopForm.lng } : { lat: route.origin_lat, lng: route.origin_lng }}
                            zoom={stopForm.lat !== 0 ? 15 : 11}
                            origin={{ lat: route.origin_lat, lng: route.origin_lng }}
                            destination={{ lat: route.destination_lat, lng: route.destination_lng }}
                            waypoints={(routeStopsMap[route.id] || []).map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                            showDirections={true}
                            markers={[
                              { lat: route.origin_lat, lng: route.origin_lng, label: 'A', color: 'green' },
                              { lat: route.destination_lat, lng: route.destination_lng, label: 'B', color: 'red' },
                              ...(stopForm.lat !== 0 ? [{ lat: stopForm.lat, lng: stopForm.lng, label: '📍', color: 'orange' as const }] : []),
                              ...(routeStopsMap[route.id] || []).map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                            ]}
                            onMapClick={(lat, lng) => setStopForm(p => ({ ...p, lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) }))}
                            showUserLocation={false}
                          />
                        </div>
                        {stopForm.lat !== 0 && <p className="text-xs text-muted-foreground">{stopForm.lat.toFixed(4)}, {stopForm.lng.toFixed(4)}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addStop(route.id)} disabled={!stopForm.name_en || !stopForm.name_ar || stopForm.lat === 0 || addingStop}>
                          {addingStop ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : editingStopId ? <Edit className="w-3.5 h-3.5 me-1" /> : <Plus className="w-3.5 h-3.5 me-1" />}
                          {editingStopId ? (lang === 'ar' ? 'تحديث' : 'Update Stop') : (lang === 'ar' ? 'إضافة' : 'Add Stop')}
                        </Button>
                        {editingStopId && (
                          <Button size="sm" variant="outline" onClick={() => { setEditingStopId(null); setStopForm({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both', arrival_time: '' }); }}>
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                    <p className="font-medium text-foreground">{app.vehicle_model} · {lang === 'ar' ? 'سنة' : 'Year'}: {app.vehicle_year}</p>
                    <p className="text-sm text-muted-foreground">
                      {app.phone && <>{lang === 'ar' ? 'الهاتف' : 'Phone'}: {app.phone} · </>}
                      {lang === 'ar' ? 'لوحة السيارة' : 'Plate'}: {app.license_number}
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
                        { url: app.criminal_record_url, label: lang === 'ar' ? 'صورة الوجه' : 'Face Photo' },
                        { url: app.id_front_url, label: lang === 'ar' ? 'بطاقة أمام' : 'ID Front' },
                        { url: app.id_back_url, label: lang === 'ar' ? 'بطاقة خلف' : 'ID Back' },
                        { url: app.driving_license_url, label: lang === 'ar' ? 'رخصة قيادة' : 'License' },
                        { url: app.car_license_url, label: lang === 'ar' ? 'رخصة سيارة' : 'Car License' },
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

        {/* Approvals Tab */}
        {tab === 'approvals' && (
          <div className="space-y-6">
            {/* Pending Bookings */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-secondary" />
                {lang === 'ar' ? `حجوزات في انتظار الموافقة (${pendingBookings.length})` : `Pending Approval (${pendingBookings.length})`}
              </h2>
              {pendingBookings.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  {lang === 'ar' ? 'لا توجد حجوزات معلقة' : 'No pending bookings'}
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookings.map((b, idx) => (
                    <div key={b.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">#{idx + 1}</span>
                            <p className="font-semibold text-foreground">{b.profile?.full_name || 'Unknown'}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{b.profile?.phone || 'No phone'}</p>
                          <p className="text-sm font-medium text-foreground">{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.scheduled_date} · {b.scheduled_time?.slice(0, 5)} · {b.seats} {lang === 'ar' ? 'مقعد' : 'seat(s)'} · {b.total_price} EGP
                          </p>
                          {b.custom_pickup_name && (
                            <p className="text-xs text-muted-foreground">
                              📍 {lang === 'ar' ? 'الركوب' : 'Pickup'}: {b.custom_pickup_name}
                            </p>
                          )}
                          {b.custom_dropoff_name && (
                            <p className="text-xs text-muted-foreground">
                              📍 {lang === 'ar' ? 'النزول' : 'Dropoff'}: {b.custom_dropoff_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {lang === 'ar' ? 'الطلب' : 'Requested'}: {new Date(b.created_at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>{b.status}</span>
                      </div>

                      {/* Payment Proof */}
                      {b.payment_proof_url ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {lang === 'ar' ? 'إثبات الدفع InstaPay:' : 'InstaPay Payment Proof:'}
                          </p>
                          <a href={b.payment_proof_url} target="_blank" rel="noopener noreferrer">
                            <img src={b.payment_proof_url} alt="Payment proof" className="w-full max-w-xs h-48 object-contain rounded-lg border border-border bg-muted cursor-pointer hover:opacity-80 transition-opacity" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-destructive">{lang === 'ar' ? 'لم يتم إرفاق إثبات دفع' : 'No payment proof attached'}</p>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleBookingApproval(b.id, 'confirmed')}>
                          <CheckCircle2 className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'قبول' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBookingApproval(b.id, 'rejected')}>
                          <XCircle className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waitlist */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                {lang === 'ar' ? `قائمة الانتظار (${waitlistBookings.length})` : `Waitlist (${waitlistBookings.length})`}
              </h2>
              {waitlistBookings.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  {lang === 'ar' ? 'لا أحد في قائمة الانتظار' : 'No one on the waitlist'}
                </div>
              ) : (
                <div className="space-y-2">
                  {waitlistBookings.map(b => (
                    <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full font-mono">
                            #{b.waitlist_position}
                          </span>
                          <p className="font-medium text-foreground text-sm">{b.profile?.full_name || 'Unknown'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en} · {b.scheduled_date} · {b.scheduled_time?.slice(0, 5)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => promoteWaitlist(b.id)}>
                        {lang === 'ar' ? 'ترقية' : 'Promote'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                      <p className="font-medium text-foreground text-sm">{b.profile?.full_name || 'Unknown'} — {lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
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

        {/* Carpool Verifications Tab */}
        {tab === 'carpool' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات التحقق - مشاركة الرحلات' : 'Carpool Verifications'}</h2>

            {carpoolVerifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {lang === 'ar' ? 'لا توجد طلبات تحقق' : 'No verification requests'}
              </div>
            ) : (
              <div className="space-y-4">
                {carpoolVerifications.map(v => (
                  <div key={v.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-foreground">{carpoolProfiles[v.user_id]?.full_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{carpoolProfiles[v.user_id]?.phone || ''}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        v.status === 'approved' ? 'bg-green-100 text-green-700' :
                        v.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                        'bg-secondary/20 text-secondary'
                      }`}>{v.status}</span>
            </div>

            {/* Global Stop Waiting Time */}
            <div className="bg-card border border-border rounded-xl p-6 max-w-lg">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'وقت انتظار الباص في المحطة' : 'Bus Waiting Time at Stops'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === 'ar'
                  ? 'عدد الدقائق التي ينتظرها الباص في كل محطة (ينطبق على جميع المسارات)'
                  : 'How many minutes the bus waits at each stop (applies to all routes globally)'}
              </p>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={globalWaitingTime}
                  onChange={(e) => setGlobalWaitingTime(e.target.value)}
                  className="w-24 font-mono"
                />
                <span className="text-sm text-muted-foreground">{lang === 'ar' ? 'دقائق' : 'minutes'}</span>
                <Button onClick={saveGlobalWaitingTime} disabled={savingWaitingTime}>
                  {savingWaitingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </div>
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div><span className="text-muted-foreground">{lang === 'ar' ? 'اللوحة:' : 'Plate:'}</span> <span className="font-medium">{v.license_plate}</span></div>
                      <div><span className="text-muted-foreground">{lang === 'ar' ? 'السيارة:' : 'Vehicle:'}</span> <span className="font-medium">{v.vehicle_model}</span></div>
                    </div>

                    {/* Document Links */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {v.id_front_url && <a href={v.id_front_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10">{lang === 'ar' ? 'بطاقة أمام' : 'ID Front'}</a>}
                      {v.id_back_url && <a href={v.id_back_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10">{lang === 'ar' ? 'بطاقة خلف' : 'ID Back'}</a>}
                      {v.driving_license_url && <a href={v.driving_license_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10">{lang === 'ar' ? 'رخصة قيادة' : 'Driving License'}</a>}
                      {v.car_license_url && <a href={v.car_license_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10">{lang === 'ar' ? 'رخصة سيارة' : 'Car License'}</a>}
                      {v.selfie_url && <a href={v.selfie_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10">{lang === 'ar' ? 'صورة شخصية' : 'Selfie'}</a>}
                    </div>

                    {v.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => handleCarpoolVerification(v.id, 'approved')}>
                          <CheckCircle2 className="w-4 h-4 me-1" />{lang === 'ar' ? 'موافقة' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCarpoolVerification(v.id, 'rejected')}>
                          <XCircle className="w-4 h-4 me-1" />{lang === 'ar' ? 'رفض' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h2>

            <div className="bg-card border border-border rounded-xl p-6 max-w-lg">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'رقم InstaPay' : 'InstaPay Phone Number'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === 'ar'
                  ? 'الرقم الذي سيظهر للركاب لتحويل المبلغ عبر InstaPay'
                  : 'This number will be shown to passengers so they can transfer payment via InstaPay'}
              </p>
              <div className="flex gap-2">
                <Input
                  value={instapayPhone}
                  onChange={(e) => setInstapayPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="font-mono"
                  dir="ltr"
                />
                <Button onClick={saveInstapayPhone} disabled={savingPhone}>
                  {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </div>

            {/* Bundles Management */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-secondary" />
                  {lang === 'ar' ? 'الباقات' : 'Ride Bundles'}
                </h3>
                <Button size="sm" onClick={() => setShowBundleForm(!showBundleForm)}>
                  <Plus className="w-4 h-4 me-1" />{lang === 'ar' ? 'إضافة' : 'Add'}
                </Button>
              </div>

              {showBundleForm && (
                <div className="bg-surface rounded-xl p-4 space-y-3 border border-border">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{lang === 'ar' ? 'المسار' : 'Route'}</Label>
                      <select className="w-full border border-border rounded-lg p-2 bg-card text-foreground text-sm"
                        value={bundleForm.route_id} onChange={e => setBundleForm(p => ({ ...p, route_id: e.target.value }))}>
                        <option value="">{lang === 'ar' ? 'اختر مسار' : 'Select route'}</option>
                        {routes.filter(r => r.status === 'active').map(r => (
                          <option key={r.id} value={r.id}>{lang === 'ar' ? r.name_ar : r.name_en}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>{lang === 'ar' ? 'النوع' : 'Type'}</Label>
                      <select className="w-full border border-border rounded-lg p-2 bg-card text-foreground text-sm"
                        value={bundleForm.bundle_type} onChange={e => setBundleForm(p => ({ ...p, bundle_type: e.target.value }))}>
                        <option value="weekly">{lang === 'ar' ? 'أسبوعي' : 'Weekly'}</option>
                        <option value="monthly">{lang === 'ar' ? 'شهري' : 'Monthly'}</option>
                      </select>
                    </div>
                    <div>
                      <Label>{lang === 'ar' ? 'عدد الرحلات' : 'Ride Count'}</Label>
                      <Input type="number" value={bundleForm.ride_count} onChange={e => setBundleForm(p => ({ ...p, ride_count: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <Label>{lang === 'ar' ? 'سعر الباقة (EGP)' : 'Bundle Price (EGP)'}</Label>
                      <Input type="number" value={bundleForm.price} onChange={e => setBundleForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <Label>{lang === 'ar' ? 'نسبة الخصم %' : 'Discount %'}</Label>
                      <Input type="number" value={bundleForm.discount_percentage} onChange={e => setBundleForm(p => ({ ...p, discount_percentage: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <Button disabled={savingBundle || !bundleForm.route_id} onClick={async () => {
                    setSavingBundle(true);
                    const { error } = await supabase.from('ride_bundles').insert({ ...bundleForm, is_active: true });
                    if (error) toast.error(error.message);
                    else { toast.success(lang === 'ar' ? 'تم إنشاء الباقة' : 'Bundle created'); setShowBundleForm(false); fetchAllData(); }
                    setSavingBundle(false);
                  }}>
                    {savingBundle ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'إنشاء الباقة' : 'Create Bundle')}
                  </Button>
                </div>
              )}

              {bundles.length > 0 ? (
                <div className="space-y-2">
                  {bundles.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border">
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {b.bundle_type === 'weekly' ? (lang === 'ar' ? 'أسبوعي' : 'Weekly') : (lang === 'ar' ? 'شهري' : 'Monthly')}
                          {' — '}{lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.ride_count} {lang === 'ar' ? 'رحلة' : 'rides'} · {b.price} EGP · {b.discount_percentage}% {lang === 'ar' ? 'خصم' : 'off'}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        await supabase.from('ride_bundles').delete().eq('id', b.id);
                        fetchAllData();
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد باقات بعد' : 'No bundles yet'}</p>
              )}
            </div>

            {/* Test Trip Launcher */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'بدء رحلة تجريبية' : 'Start Test Trip'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ar'
                  ? 'يحدث حجز مؤكد إلى اليوم ويشغل موقع GPS للشاتل للاختبار المباشر'
                  : 'Moves a confirmed booking to today and sets shuttle GPS for live testing'}
              </p>
              <Button
                onClick={async () => {
                  try {
                    // Find a confirmed or pending booking
                    const { data: testBooking } = await supabase
                      .from('bookings')
                      .select('*, shuttles(*), routes(*)')
                      .in('status', ['confirmed', 'pending'])
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();

                    if (!testBooking) {
                      toast.error(lang === 'ar' ? 'لا يوجد حجز للتجربة' : 'No booking found to test');
                      return;
                    }

                    const todayStr = new Date().toISOString().split('T')[0];
                    const route = testBooking.routes;
                    const shuttleId = testBooking.shuttle_id;

                    // Update booking to today + confirmed
                    await supabase.from('bookings').update({
                      scheduled_date: todayStr,
                      status: 'confirmed',
                    }).eq('id', testBooking.id);

                    // Update or create ride instances for today
                    await supabase.from('ride_instances').update({
                      ride_date: todayStr,
                    }).eq('shuttle_id', shuttleId).eq('route_id', testBooking.route_id);

                    // Set shuttle GPS to route origin (simulating driver at start)
                    if (route) {
                      await supabase.from('shuttles').update({
                        current_lat: route.origin_lat,
                        current_lng: route.origin_lng,
                        status: 'active',
                      }).eq('id', shuttleId);
                    }

                    toast.success(lang === 'ar'
                      ? `تم تفعيل رحلة تجريبية: ${testBooking.id.slice(0, 8)}...`
                      : `Test trip activated: ${testBooking.id.slice(0, 8)}...`);
                    fetchAllData();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed');
                  }
                }}
                className="w-full"
              >
                <Car className="w-4 h-4 me-2" />
                {lang === 'ar' ? 'تفعيل رحلة تجريبية الآن' : 'Activate Test Trip Now'}
              </Button>
            </div>
          </div>
        )}
        {/* Users Tab */}
        {tab === 'users' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'المستخدمين المسجلين' : 'Registered Users'}</h2>
            <p className="text-sm text-muted-foreground">{lang === 'ar' ? `${allProfiles.length} مستخدم مسجل` : `${allProfiles.length} registered users`}</p>
            {allProfiles.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا يوجد مستخدمين بعد' : 'No users yet'}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'تاريخ التسجيل' : 'Joined'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProfiles.map((p: any) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-medium text-foreground">{p.full_name || '—'}</td>
                          <td className="p-3 text-muted-foreground">{p.phone || '—'}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.user_type === 'admin' ? 'bg-primary/10 text-primary' : p.user_type === 'driver' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                              {p.user_type}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Route Requests Tab */}
        {tab === 'route_requests' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات المسارات' : 'Route Requests'}</h2>
            <p className="text-sm text-muted-foreground">{lang === 'ar' ? `${routeRequests.length} طلب` : `${routeRequests.length} requests`}</p>
            {routeRequests.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا توجد طلبات مسارات بعد' : 'No route requests yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {routeRequests.map((rr: any) => {
                  const prof = routeRequestProfiles[rr.user_id];
                  const dayLabels = lang === 'ar'
                    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return (
                    <div key={rr.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{prof?.full_name || rr.user_id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(rr.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[rr.status] || 'bg-muted text-muted-foreground'}`}>
                          {rr.status}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span className="text-foreground">{rr.origin_name}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                          <span className="text-foreground">{rr.destination_name}</span>
                        </div>
                      </div>
                      {rr.preferred_time && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {rr.preferred_time}
                        </p>
                      )}
                      {rr.preferred_days && rr.preferred_days.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {rr.preferred_days.map((d: number) => (
                            <span key={d} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{dayLabels[d]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
