import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12h } from '@/lib/utils';
import { sendPushNotification } from '@/lib/pushNotifications';
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
  Loader2, Eye, Database, Settings, Phone, Package, ListOrdered, RotateCcw,
  Building2, DollarSign, Link2, ChevronDown, ChevronUp, MessageSquare, Send, Calendar,
  Copy, ExternalLink, Bell
} from 'lucide-react';
import PackagePricing from '@/components/admin/PackagePricing';
import LinkCombiner from '@/components/admin/LinkCombiner';
import CommunitiesAdmin from '@/components/admin/CommunitiesAdmin';

type AdminTab = 'routes' | 'drivers' | 'shuttles' | 'bookings' | 'analytics' | 'approvals' | 'settings' | 'carpool' | 'communities' | 'users' | 'route_requests' | 'packages' | 'content' | 'refunds' | 'earnings' | 'partners' | 'partner_routes' | 'partner_packages';

const AdminPanel = () => {
  const { user, signOut } = useAuth();
  const { t, lang, setLang, appName } = useLanguage();
  const { toast: legacyToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // App name settings
  const [appNameEnSetting, setAppNameEnSetting] = useState('Massar');
  const [appNameArSetting, setAppNameArSetting] = useState('مسار');
  const [savingAppName, setSavingAppName] = useState(false);

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
  const [dragStopIndex, setDragStopIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Content settings
  const [contentSettings, setContentSettings] = useState<Record<string, string>>({});
  const [savingContent, setSavingContent] = useState(false);

  // Refund management
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundProfiles, setRefundProfiles] = useState<Record<string, any>>({});
  const [processingRefund, setProcessingRefund] = useState<string | null>(null);

  // Partner/Earnings management
  const [partnerCompanies, setPartnerCompanies] = useState<any[]>([]);
  const [platformEarnings, setPlatformEarnings] = useState<any[]>([]);
  const [partnerRouteRequests, setPartnerRouteRequests] = useState<any[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<Record<string, any>>({});
  const [expandedPartnerRoute, setExpandedPartnerRoute] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [partnerPackageRequests, setPartnerPackageRequests] = useState<any[]>([]);

  // Published trips
  const [publishedTrips, setPublishedTrips] = useState<any[]>([]);
  const [publishRouteId, setPublishRouteId] = useState<string | null>(null);
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [publishTime, setPublishTime] = useState('08:00');
  const [publishingTrip, setPublishingTrip] = useState(false);

  // User filters
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [userTimeFilter, setUserTimeFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');

  // Route form
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({
    name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '',
    destination_name_en: '', destination_name_ar: '', origin_lat: 30.0444,
    origin_lng: 31.2357, destination_lat: 30.0131, destination_lng: 31.2089,
    price: 25, estimated_duration_minutes: 30,
  });
  const [mapsLink, setMapsLink] = useState('');
  const [parsingLink, setParsingLink] = useState(false);
  const [importedStops, setImportedStops] = useState<{ lat: number; lng: number; name: string }[]>([]);

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
    // Fetch ALL app_settings for content
    const { data: allSettings } = await supabase.from('app_settings').select('key, value');
    if (allSettings) {
      const sMap: Record<string, string> = {};
      allSettings.forEach((row: any) => {
        sMap[row.key] = row.value;
        if (row.key === 'app_name_en') setAppNameEnSetting(row.value);
        if (row.key === 'app_name_ar') setAppNameArSetting(row.value);
      });
      setContentSettings(sMap);
    }
    // Fetch global waiting time
    const waitVal = (allSettings || []).find((s: any) => s.key === 'stop_waiting_time_minutes');
    if (waitVal) setGlobalWaitingTime(waitVal.value);
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
    // Fetch refunds
    const { data: refundsData } = await supabase.from('refunds').select('*').order('created_at', { ascending: false });
    setRefunds(refundsData || []);
    const refundUserIds = [...new Set((refundsData || []).map((r: any) => r.user_id))];
    if (refundUserIds.length > 0) {
      const rpMap: Record<string, any> = {};
      (profilesRes.data || []).filter((p: any) => refundUserIds.includes(p.user_id)).forEach((p: any) => { rpMap[p.user_id] = p; });
      setRefundProfiles(rpMap);
    }

    // Fetch partner data
    const [{ data: partners }, { data: pEarnings }, { data: pRouteReqs }, { data: pPkgReqs }] = await Promise.all([
      supabase.from('partner_companies').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_earnings').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('partner_route_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_package_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setPartnerCompanies(partners || []);
    setPlatformEarnings(pEarnings || []);
    setPartnerRouteRequests(pRouteReqs || []);
    setPartnerPackageRequests(pPkgReqs || []);
    // Fetch profiles for partners
    const partnerUserIds = [...new Set((partners || []).map((p: any) => p.user_id))];
    if (partnerUserIds.length > 0) {
      const ppMap: Record<string, any> = {};
      (profilesRes.data || []).filter((p: any) => partnerUserIds.includes(p.user_id)).forEach((p: any) => { ppMap[p.user_id] = p; });
      setPartnerProfiles(ppMap);
    }

    // Fetch published trips
    const { data: pubTrips } = await supabase.from('published_trips').select('*').order('trip_date', { ascending: false }).limit(100);
    setPublishedTrips(pubTrips || []);

    setLoading(false);
  };

  const handlePublishTrip = async () => {
    if (!publishRouteId) return;
    setPublishingTrip(true);
    const { error } = await supabase.from('published_trips').insert({
      route_id: publishRouteId,
      departure_time: publishTime,
      trip_date: publishDate,
      status: 'active',
    });
    if (error) toast.error(error.message);
    else {
      toast.success(lang === 'ar' ? 'تم نشر الرحلة' : 'Trip published');
      setPublishRouteId(null);
      fetchAllData();
    }
    setPublishingTrip(false);
  };

  const handleUnpublishTrip = async (tripId: string) => {
    await supabase.from('published_trips').update({ status: 'closed' }).eq('id', tripId);
    toast.success(lang === 'ar' ? 'تم إلغاء النشر' : 'Trip unpublished');
    fetchAllData();
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
  const saveAppName = async () => {
    setSavingAppName(true);
    const { error: e1 } = await supabase.from('app_settings').upsert(
      { key: 'app_name_en', value: appNameEnSetting },
      { onConflict: 'key' }
    );
    const { error: e2 } = await supabase.from('app_settings').upsert(
      { key: 'app_name_ar', value: appNameArSetting },
      { onConflict: 'key' }
    );
    if (e1 || e2) toast.error((e1 || e2)!.message);
    else toast.success(lang === 'ar' ? 'تم حفظ اسم التطبيق - أعد تحميل الصفحة لرؤية التغييرات' : 'App name saved - reload the page to see changes');
    setSavingAppName(false);
  };

  const parseGoogleMapsLink = async () => {
    if (!mapsLink.trim()) return;
    setParsingLink(true);
    try {
      // Parse Google Maps directions URL
      // Format: https://www.google.com/maps/dir/Place1/Place2/Place3/@lat,lng,zoom
      // Or: https://www.google.com/maps/dir/lat1,lng1/lat2,lng2/...
      let url = mapsLink.trim();
      
      // Extract the path after /dir/
      const dirMatch = url.match(/\/dir\/(.+?)(?:\/@|$|\?)/);
      if (!dirMatch) {
        toast.error(lang === 'ar' ? 'رابط غير صالح - استخدم رابط اتجاهات Google Maps' : 'Invalid link - use a Google Maps directions URL');
        setParsingLink(false);
        return;
      }

      const segments = dirMatch[1].split('/').filter(s => s.trim() !== '');
      if (segments.length < 2) {
        toast.error(lang === 'ar' ? 'يجب أن يحتوي الرابط على نقطتين على الأقل' : 'Link must have at least 2 points');
        setParsingLink(false);
        return;
      }

      // Geocode each segment to get lat/lng and name
      const geocoder = new google.maps.Geocoder();
      const resolveSegment = (seg: string): Promise<{ lat: number; lng: number; name: string }> => {
        return new Promise((resolve, reject) => {
          // Check if segment is already coordinates
          const coordMatch = seg.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
          if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              const name = status === 'OK' && results?.[0] ? results[0].formatted_address : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              resolve({ lat, lng, name });
            });
          } else {
            // It's a place name, geocode it
            const decoded = decodeURIComponent(seg.replace(/\+/g, ' '));
            geocoder.geocode({ address: decoded }, (results, status) => {
              if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng(), name: results[0].formatted_address });
              } else {
                reject(new Error(`Could not find: ${decoded}`));
              }
            });
          }
        });
      };

      const points = await Promise.all(segments.map(s => resolveSegment(s)));
      const origin = points[0];
      const destination = points[points.length - 1];
      const middleStops = points.slice(1, -1);

      setRouteForm(p => ({
        ...p,
        origin_lat: parseFloat(origin.lat.toFixed(6)),
        origin_lng: parseFloat(origin.lng.toFixed(6)),
        origin_name_en: origin.name,
        origin_name_ar: origin.name,
        destination_lat: parseFloat(destination.lat.toFixed(6)),
        destination_lng: parseFloat(destination.lng.toFixed(6)),
        destination_name_en: destination.name,
        destination_name_ar: destination.name,
        name_en: p.name_en || `${origin.name.split(',')[0]} → ${destination.name.split(',')[0]}`,
        name_ar: p.name_ar || `${origin.name.split(',')[0]} → ${destination.name.split(',')[0]}`,
      }));

      setImportedStops(middleStops);
      toast.success(lang === 'ar' 
        ? `تم استيراد ${points.length} نقاط (${middleStops.length} محطات وسطية)` 
        : `Imported ${points.length} points (${middleStops.length} intermediate stops)`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse link');
    }
    setParsingLink(false);
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
      // Insert imported stops for edited route
      if (importedStops.length > 0) {
        const stopsToInsert = importedStops.map((s, i) => ({
          route_id: editingRouteId,
          name_en: s.name,
          name_ar: s.name,
          lat: s.lat,
          lng: s.lng,
          stop_order: i + 1,
          stop_type: 'both',
        }));
        await supabase.from('stops').insert(stopsToInsert);
      }
      toast.success(lang === 'ar' ? 'تم تحديث المسار' : 'Route updated!');
    } else {
      const { data: newRoute, error } = await supabase.from('routes').insert(routeData).select().single();
      if (error) { toast.error(error.message); return; }
      // Auto-insert imported stops
      if (newRoute && importedStops.length > 0) {
        const stopsToInsert = importedStops.map((s, i) => ({
          route_id: newRoute.id,
          name_en: s.name,
          name_ar: s.name,
          lat: s.lat,
          lng: s.lng,
          stop_order: i + 1,
          stop_type: 'both',
        }));
        await supabase.from('stops').insert(stopsToInsert);
      }
      toast.success(lang === 'ar' ? 'تم إنشاء المسار مع المحطات' : 'Route created with stops!');
    }
    setShowRouteForm(false);
    setEditingRouteId(null);
    setImportedStops([]);
    setMapsLink('');
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

  // --- Find nearest stop number for a booking ---
  const findNearestStopNumber = (routeId: string | null, lat: number | null, lng: number | null): number | null => {
    if (!routeId || lat == null || lng == null) return null;
    const stops = routeStopsMap[routeId];
    if (!stops || stops.length === 0) return null;
    let minDist = Infinity;
    let nearestOrder: number | null = null;
    for (const s of stops) {
      const d = Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2);
      if (d < minDist) { minDist = d; nearestOrder = s.stop_order + 1; }
    }
    return nearestOrder;
  };

  // --- Stops management ---
  const fetchStopsForRoute = async (routeId: string) => {
    const { data } = await supabase.from('stops').select('*').eq('route_id', routeId).order('stop_order');
    setRouteStopsMap(prev => ({ ...prev, [routeId]: data || [] }));
  };

  // Find paired (return/original) route by naming convention
  const findPairedRouteId = (routeId: string): string | null => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return null;
    
    const returnSuffix = ' (Return)';
    const returnSuffixAr = ' (عودة)';
    
    if (route.name_en.endsWith(returnSuffix)) {
      // This is a return route — find the original
      const originalName = route.name_en.slice(0, -returnSuffix.length);
      const original = routes.find(r => r.name_en === originalName && r.id !== routeId);
      return original?.id || null;
    } else {
      // This is an original route — find the return
      const returnRoute = routes.find(r => r.name_en === `${route.name_en}${returnSuffix}` && r.id !== routeId);
      return returnRoute?.id || null;
    }
  };

  // Sync a stop to the paired route (add it in reversed order)
  const syncStopToPairedRoute = async (pairedRouteId: string, stopData: { name_en: string; name_ar: string; lat: number; lng: number; stop_type: string; arrival_time?: string | null }) => {
    // Get current stops of paired route
    const { data: pairedStops } = await supabase.from('stops').select('*').eq('route_id', pairedRouteId).order('stop_order');
    const currentCount = pairedStops?.length || 0;
    
    // Add stop at the beginning (since the paired route is reversed, a new stop at the end of route A goes to the beginning of route B)
    // Actually, we insert at position 0 and shift others
    // First shift all existing stops +1
    if (pairedStops && pairedStops.length > 0) {
      await Promise.all(pairedStops.map(s => 
        supabase.from('stops').update({ stop_order: s.stop_order + 1 }).eq('id', s.id)
      ));
    }
    
    await supabase.from('stops').insert({
      route_id: pairedRouteId,
      name_en: stopData.name_en,
      name_ar: stopData.name_ar,
      lat: stopData.lat,
      lng: stopData.lng,
      stop_type: stopData.stop_type,
      stop_order: 0,
      arrival_time: stopData.arrival_time || null,
    });
    
    await fetchStopsForRoute(pairedRouteId);
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
    const pairedRouteId = findPairedRouteId(routeId);
    
    if (editingStopId) {
      // Find the old stop data before updating (to find match in paired route)
      const oldStop = (routeStopsMap[routeId] || []).find(s => s.id === editingStopId);
      
      const { error } = await supabase.from('stops').update({
        name_en: stopForm.name_en,
        name_ar: stopForm.name_ar,
        lat: stopForm.lat,
        lng: stopForm.lng,
        stop_type: stopForm.stop_type,
        arrival_time: stopForm.arrival_time || null,
      }).eq('id', editingStopId);
      if (error) toast.error(error.message);
      else {
        toast.success(lang === 'ar' ? 'تم تحديث نقطة التوقف' : 'Stop updated');
        
        // Sync update to paired route
        if (pairedRouteId && oldStop) {
          const { data: pairedStops } = await supabase.from('stops').select('*').eq('route_id', pairedRouteId).order('stop_order');
          const matchingStop = pairedStops?.find(s => s.name_en === oldStop.name_en && s.name_ar === oldStop.name_ar);
          if (matchingStop) {
            await supabase.from('stops').update({
              name_en: stopForm.name_en,
              name_ar: stopForm.name_ar,
              lat: stopForm.lat,
              lng: stopForm.lng,
              stop_type: stopForm.stop_type,
              arrival_time: stopForm.arrival_time || null,
            }).eq('id', matchingStop.id);
            await fetchStopsForRoute(pairedRouteId);
            toast.info(lang === 'ar' ? 'تم تحديث المحطة في المسار المعاكس أيضاً' : 'Stop also updated in paired route');
          }
        }
        
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
        
        // Sync to paired route
        if (pairedRouteId) {
          await syncStopToPairedRoute(pairedRouteId, {
            name_en: stopForm.name_en,
            name_ar: stopForm.name_ar,
            lat: stopForm.lat,
            lng: stopForm.lng,
            stop_type: stopForm.stop_type,
            arrival_time: stopForm.arrival_time || null,
          });
          toast.info(lang === 'ar' ? 'تمت إضافة المحطة في المسار المعاكس أيضاً' : 'Stop also added to paired route');
        }
        
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
    // Get stop data before deleting (for paired route sync)
    const stopToDelete = (routeStopsMap[routeId] || []).find(s => s.id === stopId);
    
    const { error } = await supabase.from('stops').delete().eq('id', stopId);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === 'ar' ? 'تم حذف نقطة التوقف' : 'Stop deleted');
      
      // Sync delete to paired route
      const pairedRouteId = findPairedRouteId(routeId);
      if (pairedRouteId && stopToDelete) {
        const { data: pairedStops } = await supabase.from('stops').select('*').eq('route_id', pairedRouteId).order('stop_order');
        const matchingStop = pairedStops?.find(s => s.name_en === stopToDelete.name_en && s.name_ar === stopToDelete.name_ar);
        if (matchingStop) {
          await supabase.from('stops').delete().eq('id', matchingStop.id);
          // Re-order paired route stops
          const pairedRemaining = (pairedStops || []).filter(s => s.id !== matchingStop.id);
          for (let i = 0; i < pairedRemaining.length; i++) {
            if (pairedRemaining[i].stop_order !== i) {
              await supabase.from('stops').update({ stop_order: i }).eq('id', pairedRemaining[i].id);
            }
          }
          await fetchStopsForRoute(pairedRouteId);
          toast.info(lang === 'ar' ? 'تم حذف المحطة من المسار المعاكس أيضاً' : 'Stop also deleted from paired route');
        }
      }
      
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

  const handleStopDrop = async (routeId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const stops = [...(routeStopsMap[routeId] || [])];
    const [moved] = stops.splice(fromIndex, 1);
    stops.splice(toIndex, 0, moved);
    setRouteStopsMap(prev => ({ ...prev, [routeId]: stops }));
    await Promise.all(stops.map((s, i) => 
      supabase.from('stops').update({ stop_order: i }).eq('id', s.id)
    ));
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

  // Reverse route - duplicate route in opposite direction with stops snapped to return road
  const reverseRoute = async (route: any) => {
    if (!confirm(lang === 'ar' 
      ? 'سيتم إنشاء مسار معكوس من الوجهة إلى نقطة الانطلاق مع نقل المحطات للطريق المعاكس. متابعة؟' 
      : 'This will create a reversed route from destination to origin with stops snapped to the return road. Continue?')) return;

    toast.info(lang === 'ar' ? 'جاري إنشاء المسار المعكوس...' : 'Creating reversed route...');

    // Create the reversed route
    const { data: newRoute, error: routeError } = await supabase.from('routes').insert({
      name_en: `${route.name_en} (Return)`,
      name_ar: `${route.name_ar} (عودة)`,
      origin_name_en: route.destination_name_en,
      origin_name_ar: route.destination_name_ar,
      origin_lat: route.destination_lat,
      origin_lng: route.destination_lng,
      destination_name_en: route.origin_name_en,
      destination_name_ar: route.origin_name_ar,
      destination_lat: route.origin_lat,
      destination_lng: route.origin_lng,
      price: route.price,
      estimated_duration_minutes: route.estimated_duration_minutes,
      status: 'active',
    }).select().single();

    if (routeError || !newRoute) {
      toast.error(routeError?.message || 'Failed to create route');
      return;
    }

    // Fetch original stops
    const { data: originalStops } = await supabase.from('stops')
      .select('*')
      .eq('route_id', route.id)
      .order('stop_order', { ascending: true });

    if (originalStops && originalStops.length > 0) {
      // Reverse the stops order
      const reversedStops = [...originalStops].reverse();

      // Try to snap each stop to the return road using Google Directions API
      let snappedStops = reversedStops;
      
      if (window.google?.maps) {
        try {
          const directionsService = new google.maps.DirectionsService();
          
          // Get directions for the return route
          const waypoints = reversedStops.slice(1, -1).map(s => ({
            location: new google.maps.LatLng(s.lat, s.lng),
            stopover: true,
          }));

          const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            directionsService.route({
              origin: new google.maps.LatLng(route.destination_lat, route.destination_lng),
              destination: new google.maps.LatLng(route.origin_lat, route.origin_lng),
              waypoints: waypoints.length > 0 ? waypoints : undefined,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false,
            }, (res, status) => {
              if (status === 'OK' && res) resolve(res);
              else reject(status);
            });
          });

          // Extract snapped waypoint locations from legs
          if (result.routes[0]?.legs) {
            const legs = result.routes[0].legs;
            // Each leg's end_location is the snapped waypoint (except the last leg which ends at destination)
            const snappedCoords: { lat: number; lng: number }[] = [];
            
            // First stop is the route destination (now origin) - use as-is
            snappedCoords.push({ lat: route.destination_lat, lng: route.destination_lng });
            
            // Intermediate stops from leg end locations
            for (let i = 0; i < legs.length - 1; i++) {
              const endLoc = legs[i].end_location;
              snappedCoords.push({ lat: endLoc.lat(), lng: endLoc.lng() });
            }
            
            // Last stop is the route origin (now destination) - use as-is
            snappedCoords.push({ lat: route.origin_lat, lng: route.origin_lng });

            // Apply snapped coords to intermediate stops only (skip first and last as they're origin/dest)
            snappedStops = reversedStops.map((stop, i) => {
              if (i > 0 && i < reversedStops.length - 1 && snappedCoords[i]) {
                return { ...stop, lat: snappedCoords[i].lat, lng: snappedCoords[i].lng };
              }
              return stop;
            });
          }
        } catch (err) {
          console.warn('Could not snap stops to return road, using original coords:', err);
        }
      }

      // Insert reversed stops
      const stopsToInsert = snappedStops.map((s, i) => ({
        route_id: newRoute.id,
        name_en: s.name_en,
        name_ar: s.name_ar,
        lat: parseFloat(s.lat.toFixed(6)),
        lng: parseFloat(s.lng.toFixed(6)),
        stop_order: i + 1,
        stop_type: s.stop_type,
      }));

      const { error: stopsError } = await supabase.from('stops').insert(stopsToInsert);
      if (stopsError) {
        toast.error(lang === 'ar' ? 'تم إنشاء المسار لكن فشل إضافة المحطات' : 'Route created but failed to add stops');
      }
    }

    toast.success(lang === 'ar' ? 'تم إنشاء المسار المعكوس بنجاح!' : 'Reversed route created successfully!');
    fetchAllData();
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const waitlistBookings = bookings.filter(b => b.status === 'waitlist').sort((a, b) => (a.waitlist_position || 0) - (b.waitlist_position || 0));

  if (loading) {
    return <div className="h-screen flex items-center justify-center overflow-hidden"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
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
    { key: 'communities', icon: Building2, label: lang === 'ar' ? 'المجتمعات' : 'Communities' },
    { key: 'routes', icon: Route, label: lang === 'ar' ? 'المسارات' : 'Routes' },
    { key: 'packages', icon: Package, label: lang === 'ar' ? 'الباقات' : 'Packages' },
    { key: 'drivers', icon: Users, label: lang === 'ar' ? 'السائقين' : 'Drivers' },
    { key: 'shuttles', icon: Car, label: lang === 'ar' ? 'الشاتلات' : 'Shuttles' },
    { key: 'bookings', icon: Ticket, label: lang === 'ar' ? 'الحجوزات' : 'Bookings' },
    { key: 'refunds', icon: RotateCcw, label: lang === 'ar' ? 'المبالغ المستردة' : 'Refunds' },
    { key: 'earnings', icon: DollarSign, label: lang === 'ar' ? 'الإيرادات' : 'Earnings' },
    { key: 'partners', icon: Building2, label: lang === 'ar' ? 'الشركاء' : 'Partners' },
    { key: 'partner_routes', icon: Link2, label: lang === 'ar' ? 'مسارات الشركاء' : 'Partner Routes' },
    { key: 'partner_packages', icon: Package, label: lang === 'ar' ? 'باقات الشركاء' : 'Partner Packages' },
    { key: 'users', icon: Users, label: lang === 'ar' ? 'المستخدمين' : 'Users' },
    { key: 'route_requests', icon: MapPin, label: lang === 'ar' ? 'طلبات المسارات' : 'Route Requests' },
    { key: 'content', icon: Globe, label: lang === 'ar' ? 'المحتوى' : 'Content' },
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
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <Link to="/" className="text-xl font-bold text-primary">{appName}</Link>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/driver-test">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Eye className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'اختبار السائق' : 'Test Driver'}
              </Button>
            </Link>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 text-muted-foreground hover:text-foreground"><Globe className="w-5 h-5" /></button>
            <Button variant="ghost" size="icon" onClick={() => signOut()}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-6 pb-24">
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

            <LinkCombiner lang={lang} />

            {showRouteForm && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <h3 className="font-semibold text-foreground">{editingRouteId ? (lang === 'ar' ? 'تعديل المسار' : 'Edit Route') : (lang === 'ar' ? 'إنشاء مسار' : 'Create Route')}</h3>
                
                {/* Google Maps Link Import */}
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="w-4 h-4" />
                    {lang === 'ar' ? 'استيراد من رابط Google Maps' : 'Import from Google Maps Link'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'ar' 
                      ? 'الصق رابط اتجاهات Google Maps مع جميع المحطات وسيتم استيراد كل شيء تلقائياً'
                      : 'Paste a Google Maps directions link with all stops and everything will be auto-imported'}
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={mapsLink} 
                      onChange={e => setMapsLink(e.target.value)} 
                      placeholder="https://www.google.com/maps/dir/Origin/Stop1/Stop2/Destination/..." 
                      className="flex-1"
                    />
                    <Button onClick={parseGoogleMapsLink} disabled={parsingLink || !mapsLink.trim()} variant="secondary">
                      {parsingLink ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Globe className="w-4 h-4 me-1" />}
                      {lang === 'ar' ? 'استيراد' : 'Import'}
                    </Button>
                  </div>
                  {importedStops.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-foreground">{lang === 'ar' ? `${importedStops.length} محطات مستوردة:` : `${importedStops.length} imported stops:`}</p>
                      {importedStops.map((s, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          {i + 1}. {s.name.substring(0, 60)}{s.name.length > 60 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
                  <Button size="sm" variant="default" onClick={() => setPublishRouteId(publishRouteId === route.id ? null : route.id)}>
                    <Calendar className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'خطة' : 'Plan'}
                  </Button>
                  <Button size="sm" variant={route.status === 'active' ? 'outline' : 'secondary'} onClick={async () => {
                    const newStatus = route.status === 'active' ? 'draft' : 'active';
                    const { error } = await supabase.from('routes').update({ status: newStatus }).eq('id', route.id);
                    if (error) { toast.error(error.message); } else {
                      toast.success(newStatus === 'active'
                        ? (lang === 'ar' ? 'المسار متاح للسائقين الآن' : 'Route is now live for drivers')
                        : (lang === 'ar' ? 'المسار مخفي عن السائقين' : 'Route hidden from drivers'));
                      fetchAllData();
                    }
                  }}>
                    <Send className="w-3.5 h-3.5 me-1" />
                    {route.status === 'active'
                      ? (lang === 'ar' ? 'إيقاف السائقين' : 'Unpublish Driver')
                      : (lang === 'ar' ? 'نشر للسائقين' : 'Publish Driver')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => reverseRoute(route)}>
                    <Copy className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'عكس المسار' : 'Reverse Route'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const stops = (routeStopsMap[route.id] || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
                    const points = [
                      `${route.origin_lat},${route.origin_lng}`,
                      ...stops.map((s: any) => `${s.lat},${s.lng}`),
                      `${route.destination_lat},${route.destination_lng}`,
                    ];
                    const url = `https://www.google.com/maps/dir/${points.join('/')}`;
                    window.open(url, '_blank');
                  }}>
                    <ExternalLink className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'رابط الخريطة' : 'Maps Link'}
                  </Button>
                </div>

                {/* Publish Trip Form */}
                {publishRouteId === route.id && (
                  <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                    <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      {lang === 'ar' ? 'نشر رحلة جديدة' : 'Publish New Trip'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ar' ? 'سيتم عرض هذا المسار للمستخدمين للحجز والتخطيط' : 'This route will be shown to users for booking and planning'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{lang === 'ar' ? 'التاريخ' : 'Date'}</Label>
                        <Input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">{lang === 'ar' ? 'وقت المغادرة' : 'Departure Time'}</Label>
                        <Input type="time" value={publishTime} onChange={e => setPublishTime(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handlePublishTrip} disabled={publishingTrip}>
                        {publishingTrip ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : <Send className="w-3.5 h-3.5 me-1" />}
                        {lang === 'ar' ? 'نشر' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPublishRouteId(null)}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Published trips for this route */}
                {publishedTrips.filter(pt => pt.route_id === route.id && pt.status === 'active').length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{lang === 'ar' ? 'الرحلات المنشورة:' : 'Published trips:'}</p>
                    {publishedTrips.filter(pt => pt.route_id === route.id && pt.status === 'active').map(pt => (
                      <div key={pt.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-xs">
                        <span className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-primary" />
                          <span className="font-medium">{pt.trip_date}</span>
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{pt.departure_time?.slice(0, 5)}</span>
                        </span>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => handleUnpublishTrip(pt.id)}>
                          <XCircle className="w-3 h-3 me-1" />{lang === 'ar' ? 'إلغاء' : 'Remove'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

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
                          <div key={stop.id}
                            draggable
                            onDragStart={() => setDragStopIndex(idx)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                            onDragEnd={() => { setDragStopIndex(null); setDragOverIndex(null); }}
                            onDrop={() => { if (dragStopIndex !== null) handleStopDrop(route.id, dragStopIndex, idx); setDragStopIndex(null); setDragOverIndex(null); }}
                            className={`flex items-center justify-between bg-surface rounded-lg px-3 py-2 text-sm cursor-grab active:cursor-grabbing transition-all ${
                              dragOverIndex === idx ? 'ring-2 ring-primary/50 scale-[1.01]' : ''
                            } ${dragStopIndex === idx ? 'opacity-40' : ''}`}
                          >
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
                            {b.scheduled_date} · {formatTime12h(b.scheduled_time, lang)} · {b.seats} {lang === 'ar' ? 'مقعد' : 'seat(s)'} · {b.total_price} EGP
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
                          {lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en} · {b.scheduled_date} · {formatTime12h(b.scheduled_time, lang)}
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
                {bookings.filter(b => b.status === 'quote_pending').length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-secondary" />
                      {lang === 'ar' ? 'طلبات بانتظار السعر' : 'Quote Pending Requests'}
                    </h3>
                    <div className="space-y-2">
                      {bookings.filter(b => b.status === 'quote_pending').map(b => (
                        <div key={b.id} className="bg-card border-2 border-secondary/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-foreground text-sm">{b.profile?.full_name || 'Unknown'} — {lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                              <p className="text-xs text-muted-foreground">{b.scheduled_date} · {b.scheduled_time?.slice(0, 5)} · {b.trip_direction}</p>
                              {(() => {
                                const pNum = findNearestStopNumber(b.route_id, b.custom_pickup_lat, b.custom_pickup_lng);
                                const dNum = findNearestStopNumber(b.route_id, b.custom_dropoff_lat, b.custom_dropoff_lng);
                                return (pNum || dNum) ? <p className="text-xs text-muted-foreground font-medium">🔢 {lang === 'ar' ? 'وقفة' : 'Stop'} {pNum ?? '?'} → {lang === 'ar' ? 'وقفة' : 'Stop'} {dNum ?? '?'}</p> : null;
                              })()}
                              {b.custom_pickup_name && <p className="text-xs text-muted-foreground">📍 {b.custom_pickup_name} → {b.custom_dropoff_name}</p>}
                              {b.profile?.phone && <p className="text-xs text-muted-foreground">📞 {b.profile.phone}</p>}
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-secondary/20 text-secondary">quote_pending</span>
                          </div>
                          <div className="flex gap-2 items-center mt-2">
                            <Input
                              type="number"
                              placeholder={lang === 'ar' ? 'السعر (EGP)' : 'Price (EGP)'}
                              className="w-32"
                              id={`price-${b.id}`}
                            />
                            <Button size="sm" onClick={async () => {
                              const priceInput = document.getElementById(`price-${b.id}`) as HTMLInputElement;
                              const price = parseFloat(priceInput?.value);
                              if (!price || price <= 0) { toast.error(lang === 'ar' ? 'أدخل سعر صحيح' : 'Enter a valid price'); return; }
                              await supabase.from('bookings').update({ total_price: price, status: 'pending' }).eq('id', b.id);
                              toast.success(lang === 'ar' ? 'تم إرسال السعر للعميل' : 'Price sent to customer');
                              fetchAllData();
                            }}>
                              <CheckCircle2 className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'إرسال السعر' : 'Send Price'}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={async () => {
                              await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
                              toast.success(lang === 'ar' ? 'تم الرفض' : 'Rejected');
                              fetchAllData();
                            }}>
                              <XCircle className="w-3.5 h-3.5 me-1" />{lang === 'ar' ? 'رفض' : 'Reject'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {bookings.filter(b => b.status !== 'quote_pending').map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{b.profile?.full_name || 'Unknown'} — {lang === 'ar' ? b.routes?.name_ar : b.routes?.name_en}</p>
                      <p className="text-xs text-muted-foreground">{b.scheduled_date} · {b.scheduled_time} · {b.seats} seat(s) · {b.total_price} EGP</p>
                      {(() => {
                        const pNum = findNearestStopNumber(b.route_id, b.custom_pickup_lat, b.custom_pickup_lng);
                        const dNum = findNearestStopNumber(b.route_id, b.custom_dropoff_lat, b.custom_dropoff_lng);
                        return (pNum || dNum) ? <p className="text-xs text-muted-foreground font-medium">🔢 {lang === 'ar' ? 'وقفة' : 'Stop'} {pNum ?? '?'} → {lang === 'ar' ? 'وقفة' : 'Stop'} {dNum ?? '?'}</p> : null;
                      })()}
                      {b.custom_pickup_name && (
                        <p className="text-xs text-muted-foreground">
                          📍 {b.custom_pickup_name} → {b.custom_dropoff_name}
                        </p>
                      )}
                      {b.profile?.phone && <p className="text-xs text-muted-foreground">📞 {b.profile.phone}</p>}
                      {b.boarding_code && <p className="text-xs text-muted-foreground font-mono">Code: {b.boarding_code}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[b.status]}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Carpool Tab */}
        {tab === 'carpool' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات تحقق الكاربول' : 'Carpool Verifications'}</h2>
            {carpoolVerifications.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا توجد طلبات' : 'No verifications yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {carpoolVerifications.map(v => (
                  <div key={v.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{carpoolProfiles[v.user_id]?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{carpoolProfiles[v.user_id]?.phone || 'No phone'}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[v.status]}`}>{v.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div><span className="text-muted-foreground">{lang === 'ar' ? 'اللوحة:' : 'Plate:'}</span> <span className="font-medium">{v.license_plate}</span></div>
                      <div><span className="text-muted-foreground">{lang === 'ar' ? 'السيارة:' : 'Vehicle:'}</span> <span className="font-medium">{v.vehicle_model}</span></div>
                    </div>
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

        {/* Content Tab */}
        {tab === 'content' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'إدارة المحتوى' : 'Content Management'}</h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'ar' ? 'غيّر النصوص والمحتوى المعروض للمستخدمين بدون تحديث التطبيق' : 'Change text and content shown to users without updating the app'}
            </p>

            {/* Hero Section */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{lang === 'ar' ? '🏠 الصفحة الرئيسية (Hero)' : '🏠 Hero Section'}</h3>
              {[
                { key: 'hero_tagline', label: lang === 'ar' ? 'الشعار' : 'Tagline' },
                { key: 'hero_title', label: lang === 'ar' ? 'العنوان الرئيسي' : 'Main Title' },
                { key: 'hero_title_highlight', label: lang === 'ar' ? 'العنوان المميز' : 'Highlighted Title' },
                { key: 'hero_subtitle', label: lang === 'ar' ? 'الوصف' : 'Subtitle' },
              ].map(field => (
                <div key={field.key} className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{field.label} (EN)</Label>
                    <Input
                      value={contentSettings[`${field.key}_en`] || ''}
                      onChange={(e) => setContentSettings(prev => ({ ...prev, [`${field.key}_en`]: e.target.value }))}
                      placeholder={`${field.label} in English`}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{field.label} (AR)</Label>
                    <Input
                      value={contentSettings[`${field.key}_ar`] || ''}
                      onChange={(e) => setContentSettings(prev => ({ ...prev, [`${field.key}_ar`]: e.target.value }))}
                      placeholder={`${field.label} بالعربية`}
                      dir="rtl"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Announcement Banner */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{lang === 'ar' ? '📢 إعلان للمستخدمين' : '📢 Announcement Banner'}</h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'يظهر في أعلى لوحة القيادة. اتركه فارغاً لإخفائه.' : 'Shows at the top of the dashboard. Leave empty to hide.'}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">English</Label>
                  <Input
                    value={contentSettings.announcement_en || ''}
                    onChange={(e) => setContentSettings(prev => ({ ...prev, announcement_en: e.target.value }))}
                    placeholder="e.g. 🎉 New routes available!"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label className="text-xs">العربية</Label>
                  <Input
                    value={contentSettings.announcement_ar || ''}
                    onChange={(e) => setContentSettings(prev => ({ ...prev, announcement_ar: e.target.value }))}
                    placeholder="مثال: 🎉 مسارات جديدة متاحة!"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{lang === 'ar' ? '📞 معلومات التواصل' : '📞 Contact Info'}</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">{lang === 'ar' ? 'الهاتف' : 'Phone'}</Label>
                  <Input value={contentSettings.contact_phone || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, contact_phone: e.target.value }))} placeholder="+20..." dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input value={contentSettings.contact_email || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, contact_email: e.target.value }))} placeholder="info@..." dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={contentSettings.contact_whatsapp || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, contact_whatsapp: e.target.value }))} placeholder="+20..." dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs">{lang === 'ar' ? 'بريد الدعم (صفحة Support)' : 'Support Email (Support page)'}</Label>
                  <Input value={contentSettings.support_email || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, support_email: e.target.value }))} placeholder="support@massar-app.com" dir="ltr" />
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{lang === 'ar' ? '🌐 روابط التواصل الاجتماعي' : '🌐 Social Links'}</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Facebook</Label>
                  <Input value={contentSettings.social_facebook || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, social_facebook: e.target.value }))} placeholder="https://facebook.com/..." dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs">Instagram</Label>
                  <Input value={contentSettings.social_instagram || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, social_instagram: e.target.value }))} placeholder="https://instagram.com/..." dir="ltr" />
                </div>
                <div>
                  <Label className="text-xs">Twitter / X</Label>
                  <Input value={contentSettings.social_twitter || ''} onChange={(e) => setContentSettings(prev => ({ ...prev, social_twitter: e.target.value }))} placeholder="https://x.com/..." dir="ltr" />
                </div>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-foreground">{lang === 'ar' ? '⚙️ تشغيل/إيقاف الميزات' : '⚙️ Feature Toggles'}</h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'تحكم في إظهار أو إخفاء الأقسام للمستخدمين' : 'Control which sections are visible to users'}
              </p>
              {[
                { key: 'feature_carpool_enabled', label: lang === 'ar' ? 'مشاركة الرحلات (Carpool)' : 'Carpool' },
                { key: 'feature_packages_enabled', label: lang === 'ar' ? 'الباقات (Packages)' : 'Packages' },
                { key: 'feature_track_shuttle_enabled', label: lang === 'ar' ? 'تتبع الشاتل' : 'Track Shuttle' },
              ].map(toggle => (
                <div key={toggle.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{toggle.label}</span>
                  <Button
                    variant={contentSettings[toggle.key] !== 'false' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentSettings(prev => ({
                      ...prev,
                      [toggle.key]: prev[toggle.key] === 'false' ? 'true' : 'false',
                    }))}
                  >
                    {contentSettings[toggle.key] !== 'false' ? (lang === 'ar' ? 'مفعّل' : 'Enabled') : (lang === 'ar' ? 'معطّل' : 'Disabled')}
                  </Button>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <Button
              className="w-full"
              disabled={savingContent}
              onClick={async () => {
                setSavingContent(true);
                const contentKeys = [
                  'hero_tagline_en', 'hero_tagline_ar', 'hero_title_en', 'hero_title_ar',
                  'hero_title_highlight_en', 'hero_title_highlight_ar', 'hero_subtitle_en', 'hero_subtitle_ar',
                  'announcement_en', 'announcement_ar',
                  'contact_phone', 'contact_email', 'contact_whatsapp', 'support_email',
                  'social_facebook', 'social_instagram', 'social_twitter',
                  'feature_carpool_enabled', 'feature_packages_enabled', 'feature_track_shuttle_enabled',
                ];
                let hasError = false;
                for (const key of contentKeys) {
                  if (contentSettings[key] !== undefined) {
                    const { error } = await supabase.from('app_settings').upsert(
                      { key, value: contentSettings[key] || '' },
                      { onConflict: 'key' }
                    );
                    if (error) { toast.error(error.message); hasError = true; break; }
                  }
                }
                if (!hasError) toast.success(lang === 'ar' ? 'تم حفظ المحتوى — أعد تحميل لرؤية التغييرات' : 'Content saved — reload to see changes');
                setSavingContent(false);
              }}
            >
              {savingContent ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {lang === 'ar' ? 'حفظ جميع التغييرات' : 'Save All Changes'}
            </Button>
          </div>
        )}

        {/* Packages Tab */}
        {tab === 'packages' && (
          <PackagePricing lang={lang} routes={routes} />
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h2>

            {/* App Name Settings */}
            <div className="bg-card border border-border rounded-xl p-6 max-w-lg">
              <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'اسم التطبيق' : 'App Name'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === 'ar'
                  ? 'غيّر اسم التطبيق الذي يظهر للمستخدمين في كل مكان'
                  : 'Change the app name shown to users everywhere'}
              </p>
              <div className="space-y-3">
                <div>
                  <Label>{lang === 'ar' ? 'الاسم بالإنجليزية' : 'English Name'}</Label>
                  <Input
                    value={appNameEnSetting}
                    onChange={(e) => setAppNameEnSetting(e.target.value)}
                    placeholder="Massar"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>{lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Name'}</Label>
                  <Input
                    value={appNameArSetting}
                    onChange={(e) => setAppNameArSetting(e.target.value)}
                    placeholder="مسار"
                    dir="rtl"
                  />
                </div>
                <Button onClick={saveAppName} disabled={savingAppName}>
                  {savingAppName ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </div>

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

            {/* Test VoIP Call */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-lg">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'اختبار مكالمة VoIP' : 'Test VoIP Call'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {lang === 'ar'
                  ? 'أدخل معرف المستخدم لإرسال إشعار مكالمة واردة تجريبية'
                  : 'Enter a user ID to send a test incoming call push notification'}
              </p>
              <div className="space-y-3">
                <div>
                  <Label>{lang === 'ar' ? 'معرف المستخدم' : 'User ID'}</Label>
                  <Input
                    id="test-call-user-id"
                    placeholder="e.g. a1b2c3d4-..."
                    className="font-mono text-xs"
                    dir="ltr"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={async () => {
                    const userIdInput = (document.getElementById('test-call-user-id') as HTMLInputElement)?.value?.trim();
                    if (!userIdInput) {
                      toast.error(lang === 'ar' ? 'أدخل معرف المستخدم' : 'Enter a user ID');
                      return;
                    }
                    try {
                      const randomTripId = crypto.randomUUID();
                      const { data: callRes, error: callErr } = await supabase.functions.invoke('initiate-call', {
                        body: {
                          recipientUserId: userIdInput,
                          callerName: 'Admin Test',
                          tripId: randomTripId,
                        },
                      });

                      if (callErr || callRes?.error) {
                        const errMsg = callRes?.error || callErr?.message || '';
                        if (errMsg.includes('No device token')) {
                          toast.error(lang === 'ar'
                            ? 'هذا المستخدم لم يفتح التطبيق على هاتفه بعد أو لم يسمح بالإشعارات. يجب أن يفتح التطبيق على جهاز iOS/Android أولاً.'
                            : 'This user has not opened the app on their phone yet or has not allowed notifications. They must open the native app on iOS/Android first.');
                        } else {
                          toast.error(errMsg || (lang === 'ar' ? 'فشل إرسال المكالمة' : 'Call failed'));
                        }
                      } else {
                        toast.success(lang === 'ar' ? 'تم إرسال إشعار المكالمة!' : 'Call notification sent!');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Failed');
                    }
                  }}
                >
                  <Phone className="w-4 h-4 me-2" />
                  {lang === 'ar' ? 'إرسال مكالمة تجريبية' : 'Send Test Call'}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Users Tab */}
        {tab === 'users' && (() => {
          const now = new Date();
          const filteredUsers = allProfiles.filter((p: any) => {
            if (userTypeFilter !== 'all' && p.user_type !== userTypeFilter) return false;
            if (userTimeFilter !== 'all') {
              const joined = new Date(p.created_at);
              const hoursAgo = (now.getTime() - joined.getTime()) / (1000 * 60 * 60);
              if (hoursAgo > parseInt(userTimeFilter)) return false;
            }
            if (userSearch) {
              const q = userSearch.toLowerCase();
              if (!(p.full_name || '').toLowerCase().includes(q) && !(p.phone || '').toLowerCase().includes(q)) return false;
            }
            return true;
          });

          return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'المستخدمين المسجلين' : 'Registered Users'}</h2>
            <p className="text-sm text-muted-foreground">{lang === 'ar' ? `${filteredUsers.length} من ${allProfiles.length} مستخدم` : `${filteredUsers.length} of ${allProfiles.length} users`}</p>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={lang === 'ar' ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
                  className="ps-9"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
                value={userTypeFilter}
                onChange={(e) => setUserTypeFilter(e.target.value)}
              >
                <option value="all">{lang === 'ar' ? 'الكل' : 'All Types'}</option>
                <option value="customer">{lang === 'ar' ? 'راكب' : 'Customer'}</option>
                <option value="driver">{lang === 'ar' ? 'سائق' : 'Driver'}</option>
                <option value="admin">{lang === 'ar' ? 'أدمن' : 'Admin'}</option>
              </select>
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
                value={userTimeFilter}
                onChange={(e) => setUserTimeFilter(e.target.value)}
              >
                <option value="all">{lang === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
                <option value="24">{lang === 'ar' ? 'آخر 24 ساعة' : 'Last 24 hours'}</option>
                <option value="48">{lang === 'ar' ? 'آخر 48 ساعة' : 'Last 48 hours'}</option>
                <option value="168">{lang === 'ar' ? 'آخر أسبوع' : 'Last 7 days'}</option>
                <option value="720">{lang === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}</option>
              </select>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                {lang === 'ar' ? 'لا يوجد مستخدمين مطابقين' : 'No matching users'}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'معرف المستخدم' : 'User ID'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'تاريخ التسجيل' : 'Joined'}</th>
                        <th className="text-start p-3 font-medium text-muted-foreground">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((p: any) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-medium text-foreground">{p.full_name || '—'}</td>
                          <td className="p-3">
                            <button
                              className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                navigator.clipboard.writeText(p.user_id);
                                toast.success(lang === 'ar' ? 'تم نسخ المعرف' : 'User ID copied');
                              }}
                              title={p.user_id}
                            >
                              {p.user_id.slice(0, 8)}…
                              <Copy className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="p-3 text-muted-foreground">{p.phone || '—'}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.user_type === 'admin' ? 'bg-primary/10 text-primary' : p.user_type === 'driver' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                              {p.user_type}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="p-3 flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              title={lang === 'ar' ? 'إرسال إشعار تجريبي' : 'Send test push notification'}
                              onClick={async () => {
                                try {
                                  toast.loading(lang === 'ar' ? 'جاري الإرسال...' : 'Sending...', { id: `push-${p.user_id}` });
                                  const data = await sendPushNotification({
                                    notification_type: 'test',
                                    record: { user_id: p.user_id }
                                  });
                                  toast.success(
                                    lang === 'ar' ? 'تم إرسال الإشعار' : 'Push notification sent!',
                                    { id: `push-${p.user_id}`, description: data?.message || '' }
                                  );
                                } catch (err: any) {
                                  toast.error(
                                    lang === 'ar' ? 'فشل إرسال الإشعار' : 'Failed to send notification',
                                    { id: `push-${p.user_id}`, description: err.message }
                                  );
                                }
                              }}
                            >
                              <Bell className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={p.user_id === user?.id}
                              onClick={async () => {
                                const confirmMsg = lang === 'ar'
                                  ? `هل أنت متأكد من حذف المستخدم "${p.full_name || p.user_id}"؟ سيتم حذف جميع بياناته نهائياً.`
                                  : `Are you sure you want to permanently delete user "${p.full_name || p.user_id}"? All their data, bookings, and files will be removed.`;
                                if (!window.confirm(confirmMsg)) return;
                                const secondConfirm = lang === 'ar'
                                  ? 'تأكيد نهائي: هذا الإجراء لا يمكن التراجع عنه. متابعة؟'
                                  : 'Final confirmation: This action cannot be undone. Continue?';
                                if (!window.confirm(secondConfirm)) return;
                                try {
                                  toast.loading(lang === 'ar' ? 'جاري حذف المستخدم...' : 'Deleting user...', { id: 'delete-user' });
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                                  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                                  const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${session?.access_token || anonKey}`,
                                      apikey: anonKey,
                                    },
                                    body: JSON.stringify({ user_id: p.user_id }),
                                  });
                                  const result = await res.json();
                                  if (!res.ok) throw new Error(result.error || 'Failed to delete user');
                                  toast.success(
                                    lang === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully',
                                    { id: 'delete-user', description: lang === 'ar' ? `تم حذف ${result.bunny_files_deleted} ملف` : `${result.bunny_files_deleted} files removed` }
                                  );
                                  setAllProfiles(prev => prev.filter(pr => pr.user_id !== p.user_id));
                                } catch (err: any) {
                                  toast.error(lang === 'ar' ? 'فشل حذف المستخدم' : 'Failed to delete user', {
                                    id: 'delete-user',
                                    description: err.message,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Route Requests Tab */}
        {tab === 'route_requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات المسارات' : 'Route Requests'}</h2>
                <p className="text-sm text-muted-foreground">{lang === 'ar' ? `${routeRequests.length} طلب` : `${routeRequests.length} requests`}</p>
              </div>
              <Link to="/admin/global-map">
                <Button className="gap-2">
                  <Globe className="w-4 h-4" />
                  {lang === 'ar' ? 'الخريطة الشاملة' : 'Global Map'}
                </Button>
              </Link>
            </div>
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

        {/* Refunds Tab */}
        {tab === 'refunds' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'إدارة المبالغ المستردة' : 'Refund Management'}</h2>
              <button
                onClick={async () => {
                  // Auto-detect refundable bookings: paid bookings with cancelled/deleted trips
                  const { data: cancelledBookings } = await supabase
                    .from('bookings')
                    .select('*, routes(name_en, name_ar)')
                    .in('status', ['cancelled'])
                    .not('payment_proof_url', 'is', null)
                    .order('created_at', { ascending: false });
                  
                  const existingBookingIds = refunds.map(r => r.booking_id);
                  const newRefundable = (cancelledBookings || []).filter(b => !existingBookingIds.includes(b.id));
                  
                  if (newRefundable.length === 0) {
                    toast.info(lang === 'ar' ? 'لا توجد حجوزات جديدة تستحق الاسترداد' : 'No new refundable bookings found');
                    return;
                  }
                  
                  for (const b of newRefundable) {
                    await supabase.from('refunds').insert({
                      booking_id: b.id,
                      user_id: b.user_id,
                      amount: Number(b.total_price || 0),
                      reason: lang === 'ar' ? 'رحلة ملغاة - دفع مؤكد' : 'Cancelled trip - payment confirmed',
                      status: 'pending',
                      refund_type: 'pending',
                    });
                  }
                  toast.success(`${newRefundable.length} ${lang === 'ar' ? 'استرداد جديد' : 'new refunds detected'}`);
                  fetchAllData();
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {lang === 'ar' ? 'كشف تلقائي' : 'Auto-detect Refunds'}
              </button>
            </div>

            {refunds.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <RotateCcw className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{lang === 'ar' ? 'لا توجد طلبات استرداد' : 'No refund requests'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {refunds.map(r => {
                  const profile = refundProfiles[r.user_id];
                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{profile?.full_name || r.user_id.slice(0, 8)}</p>
                          {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-lg text-foreground">{r.amount} EGP</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.status === 'processed' ? 'bg-green-100 text-green-700' :
                            r.status === 'credited' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {r.status === 'processed' ? (lang === 'ar' ? 'تم الاسترداد' : 'Processed') :
                             r.status === 'credited' ? (lang === 'ar' ? 'أُضيف للرصيد' : 'Credited') :
                             (lang === 'ar' ? 'قيد المراجعة' : 'Pending')}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.reason}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                      
                      {r.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            disabled={processingRefund === r.id}
                            onClick={async () => {
                              setProcessingRefund(r.id);
                              await supabase.from('refunds').update({
                                status: 'processed',
                                refund_type: 'cash',
                                processed_by: user?.id,
                                processed_at: new Date().toISOString(),
                              }).eq('id', r.id);
                              toast.success(lang === 'ar' ? 'تم تحديد كمسترد' : 'Marked as refunded');
                              setProcessingRefund(null);
                              fetchAllData();
                            }}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            {lang === 'ar' ? 'تم الاسترداد نقداً' : 'Mark Refunded (Cash)'}
                          </button>
                          <button
                            disabled={processingRefund === r.id}
                            onClick={async () => {
                              setProcessingRefund(r.id);
                              // Add to wallet balance
                              const { data: userProfile } = await supabase.from('profiles').select('wallet_balance').eq('user_id', r.user_id).single();
                              const currentBalance = Number(userProfile?.wallet_balance || 0);
                              await supabase.from('profiles').update({ wallet_balance: currentBalance + Number(r.amount) }).eq('user_id', r.user_id);
                              await supabase.from('refunds').update({
                                status: 'credited',
                                refund_type: 'wallet_credit',
                                processed_by: user?.id,
                                processed_at: new Date().toISOString(),
                              }).eq('id', r.id);
                              toast.success(lang === 'ar' ? 'تمت إضافة المبلغ للمحفظة' : 'Added to wallet balance');
                              setProcessingRefund(null);
                              fetchAllData();
                            }}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            {lang === 'ar' ? 'أضف للمحفظة' : 'Add to Wallet'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Platform Earnings Tab */}
        {tab === 'earnings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'إيرادات المنصة' : 'Platform Earnings'}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <DollarSign className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{platformEarnings.reduce((s, e) => s + Number(e.amount), 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'إجمالي العمولات' : 'Total Commission'}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <DollarSign className="w-5 h-5 text-amber-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{platformEarnings.filter(e => e.payment_method === 'cash' && e.driver_payment_status === 'pending').reduce((s, e) => s + Number(e.amount), 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'مستحق من السائقين (نقدي)' : 'Owed by Drivers (Cash)'}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">{platformEarnings.filter(e => e.driver_payment_status === 'paid').reduce((s, e) => s + Number(e.amount), 0).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'تم التحصيل' : 'Collected'}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <BarChart3 className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-foreground">{platformEarnings.length}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'إجمالي المعاملات' : 'Total Transactions'}</p>
              </div>
            </div>
            {platformEarnings.length > 0 && (
              <div className="space-y-2">
                {platformEarnings.slice(0, 50).map(e => (
                  <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{Number(e.amount).toFixed(2)} EGP</p>
                      <p className="text-xs text-muted-foreground">{e.payment_method} • {new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.driver_payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.driver_payment_status === 'paid' ? (lang === 'ar' ? 'مدفوع' : 'Paid') : (lang === 'ar' ? 'معلق' : 'Pending')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Partners Tab */}
        {tab === 'partners' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'الشركاء' : 'Partners'}</h2>
            {partnerCompanies.length === 0 ? (
              <p className="text-muted-foreground">{lang === 'ar' ? 'لا يوجد شركاء بعد' : 'No partners yet'}</p>
            ) : (
              <div className="space-y-3">
                {partnerCompanies.map(p => {
                  const profile = partnerProfiles[p.user_id];
                  return (
                    <div key={p.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{profile?.full_name || 'Unknown'} • {p.contact_phone}</p>
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'كود' : 'Code'}: {p.referral_code} • {lang === 'ar' ? 'النسبة' : 'Commission'}: {p.commission_percentage}%</p>
                          {p.bank_details && <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الحساب' : 'Bank'}: {p.bank_details}</p>}
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${
                          p.status === 'approved' ? 'bg-green-100 text-green-700' :
                          p.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          p.status === 'suspended' ? 'bg-destructive/10 text-destructive' :
                          'bg-amber-100 text-amber-700'
                        }`}>{p.status}</span>
                      </div>
                      {/* Commission adjustment */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">{lang === 'ar' ? 'النسبة %' : 'Commission %'}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          className="w-20 text-sm"
                          defaultValue={p.commission_percentage}
                          onBlur={async (e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val <= 50) {
                              await supabase.from('partner_companies').update({ commission_percentage: val }).eq('id', p.id);
                              toast.success(lang === 'ar' ? 'تم تحديث النسبة' : 'Commission updated');
                              fetchAllData();
                            }
                          }}
                        />
                      </div>
                      {p.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await supabase.from('partner_companies').update({ status: 'approved' }).eq('id', p.id);
                              toast.success(lang === 'ar' ? 'تم قبول الشريك' : 'Partner approved');
                              fetchAllData();
                            }}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                          >{lang === 'ar' ? 'قبول' : 'Approve'}</button>
                          <button
                            onClick={async () => {
                              await supabase.from('partner_companies').update({ status: 'rejected' }).eq('id', p.id);
                              toast.success(lang === 'ar' ? 'تم رفض الشريك' : 'Partner rejected');
                              fetchAllData();
                            }}
                            className="flex-1 px-3 py-2 bg-destructive text-white rounded-lg text-sm font-medium hover:bg-destructive/90"
                          >{lang === 'ar' ? 'رفض' : 'Reject'}</button>
                        </div>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={async () => {
                            await supabase.from('partner_companies').update({ status: 'suspended' }).eq('id', p.id);
                            toast.success(lang === 'ar' ? 'تم تعليق الشريك' : 'Partner suspended');
                            fetchAllData();
                          }}
                          className="w-full px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20"
                        >{lang === 'ar' ? 'تعليق' : 'Suspend'}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Partner Routes Tab */}
        {tab === 'partner_routes' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات مسارات الشركاء' : 'Partner Route Requests'}</h2>
            {partnerRouteRequests.length === 0 ? (
              <p className="text-muted-foreground">{lang === 'ar' ? 'لا توجد طلبات مسارات من الشركاء' : 'No partner route requests yet'}</p>
            ) : (
              <div className="space-y-4">
                {partnerRouteRequests.map(r => {
                  const partner = partnerCompanies.find((p: any) => p.id === r.partner_id);
                  const stops = Array.isArray(r.stops_json) ? r.stops_json : [];
                  const isExpanded = expandedPartnerRoute === r.id;
                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Header - always visible */}
                      <button
                        className="w-full px-5 py-4 flex items-center justify-between text-start hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedPartnerRoute(isExpanded ? null : r.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-foreground">{r.name_en}</p>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 ${
                              r.status === 'approved' ? 'bg-green-100 text-green-700' :
                              r.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                              r.status === 'draft' ? 'bg-muted text-muted-foreground' :
                              'bg-amber-100 text-amber-700'
                            }`}>{r.status}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{r.origin_name} → {r.destination_name} • {r.price} EGP • {r.estimated_duration_minutes} min • {stops.length} stops</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{lang === 'ar' ? 'من' : 'By'}: {partner?.name || 'Unknown'} • {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                          {/* Route info grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</p>
                              <p className="text-sm font-medium text-foreground">{r.name_en}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</p>
                              <p className="text-sm font-medium text-foreground">{r.name_ar || '—'}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'السعر' : 'Price'}</p>
                              <p className="text-sm font-medium text-foreground">{r.price} EGP</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'المدة' : 'Duration'}</p>
                              <p className="text-sm font-medium text-foreground">{r.estimated_duration_minutes} min</p>
                            </div>
                          </div>

                          {/* Origin & Destination */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" /> {lang === 'ar' ? 'نقطة الانطلاق' : 'Origin'}</p>
                              <p className="text-sm font-medium text-foreground">{r.origin_name}</p>
                              <p className="text-xs text-muted-foreground">{r.origin_lat?.toFixed(4)}, {r.origin_lng?.toFixed(4)}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3 text-destructive" /> {lang === 'ar' ? 'نقطة الوصول' : 'Destination'}</p>
                              <p className="text-sm font-medium text-foreground">{r.destination_name}</p>
                              <p className="text-xs text-muted-foreground">{r.destination_lat?.toFixed(4)}, {r.destination_lng?.toFixed(4)}</p>
                            </div>
                          </div>

                          {/* Map */}
                          <div className="h-[300px] rounded-lg border border-border overflow-hidden">
                            <MapView
                              className="h-full w-full"
                              origin={{ lat: r.origin_lat, lng: r.origin_lng }}
                              destination={{ lat: r.destination_lat, lng: r.destination_lng }}
                              showDirections={true}
                              gestureHandling="cooperative"
                              waypoints={stops.filter((s: any) => s.lat).map((s: any) => ({ lat: s.lat, lng: s.lng }))}
                              markers={[
                                { lat: r.origin_lat, lng: r.origin_lng, label: 'A', color: 'green' },
                                { lat: r.destination_lat, lng: r.destination_lng, label: 'B', color: 'red' },
                                ...stops.filter((s: any) => s.lat).map((s: any, i: number) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                              ]}
                              showUserLocation={false}
                            />
                          </div>

                          {/* Stops list */}
                          {stops.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-foreground mb-2">{lang === 'ar' ? 'نقاط التوقف' : 'Bus Stops'} ({stops.length})</p>
                              <div className="space-y-1">
                                {stops.map((s: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-foreground">{s.name_en || s.name || '—'}</p>
                                      {s.name_ar && <p className="text-xs text-muted-foreground">{s.name_ar}</p>}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{s.stop_type || 'both'}</span>
                                    <span className="text-xs text-muted-foreground">{s.lat?.toFixed(4)}, {s.lng?.toFixed(4)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Admin notes */}
                          {r.admin_notes && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-sm text-amber-800"><strong>{lang === 'ar' ? 'ملاحظات الإدارة' : 'Admin Notes'}:</strong> {r.admin_notes}</p>
                            </div>
                          )}

                          {/* Actions */}
                          {r.status === 'pending' && (
                            <div className="space-y-3">
                              {showRejectInput === r.id ? (
                                <div className="space-y-2">
                                  <Label className="text-sm">{lang === 'ar' ? 'سبب الرفض / ملاحظات للشريك' : 'Rejection reason / Notes for partner'}</Label>
                                  <textarea
                                    value={rejectNotes[r.id] || ''}
                                    onChange={e => setRejectNotes(p => ({ ...p, [r.id]: e.target.value }))}
                                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background min-h-[80px]"
                                    placeholder={lang === 'ar' ? 'اكتب ملاحظاتك هنا...' : 'Write your notes here...'}
                                  />
                                  <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setShowRejectInput(null)} className="flex-1">
                                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      className="flex-1"
                                      onClick={async () => {
                                        await supabase.from('partner_route_requests').update({ status: 'rejected', admin_notes: rejectNotes[r.id] || null }).eq('id', r.id);
                                        toast.success(lang === 'ar' ? 'تم رفض المسار' : 'Route rejected — partner will see your notes');
                                        setShowRejectInput(null);
                                        fetchAllData();
                                      }}
                                    >
                                      <XCircle className="w-4 h-4 mr-1" /> {lang === 'ar' ? 'تأكيد الرفض' : 'Confirm Reject'}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={async () => {
                                      // Approve: create real route + stops
                                      const { data: newRoute, error: routeErr } = await supabase.from('routes').insert({
                                        name_en: r.name_en,
                                        name_ar: r.name_ar || r.name_en,
                                        origin_name_en: r.origin_name,
                                        origin_name_ar: r.origin_name,
                                        origin_lat: r.origin_lat,
                                        origin_lng: r.origin_lng,
                                        destination_name_en: r.destination_name,
                                        destination_name_ar: r.destination_name,
                                        destination_lat: r.destination_lat,
                                        destination_lng: r.destination_lng,
                                        price: r.price,
                                        estimated_duration_minutes: r.estimated_duration_minutes,
                                        status: 'active',
                                      }).select().single();
                                      
                                      if (routeErr) {
                                        toast.error(routeErr.message);
                                        return;
                                      }

                                      // Insert stops if any
                                      if (stops.length > 0 && newRoute) {
                                        const stopsToInsert = stops.map((s: any, i: number) => ({
                                          route_id: newRoute.id,
                                          name_en: s.name_en || s.name || `Stop ${i + 1}`,
                                          name_ar: s.name_ar || s.name_en || s.name || `محطة ${i + 1}`,
                                          lat: s.lat,
                                          lng: s.lng,
                                          stop_order: i,
                                          stop_type: s.stop_type || 'both',
                                        }));
                                        await supabase.from('stops').insert(stopsToInsert);
                                      }

                                      await supabase.from('partner_route_requests').update({ status: 'approved' }).eq('id', r.id);
                                      toast.success(lang === 'ar' ? 'تم قبول المسار وإنشاؤه!' : 'Route approved & created as active route!');
                                      fetchAllData();
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" /> {lang === 'ar' ? 'قبول وإنشاء المسار' : 'Approve & Create Route'}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => setShowRejectInput(r.id)}
                                  >
                                    <MessageSquare className="w-4 h-4 mr-1" /> {lang === 'ar' ? 'رفض مع ملاحظات' : 'Reject with Notes'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Communities Tab */}
        {tab === 'communities' && (
          <CommunitiesAdmin lang={lang} />
        )}

        {/* Partner Packages Tab */}
        {tab === 'partner_packages' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">{lang === 'ar' ? 'طلبات باقات الشركاء' : 'Partner Package Requests'}</h2>
            {partnerPackageRequests.length === 0 ? (
              <p className="text-muted-foreground">{lang === 'ar' ? 'لا توجد طلبات باقات' : 'No partner package requests yet'}</p>
            ) : (
              <div className="space-y-3">
                {partnerPackageRequests.map((pkg: any) => {
                  const partner = partnerCompanies.find((p: any) => p.id === pkg.partner_id);
                  const linkedRoute = partnerRouteRequests.find((r: any) => r.id === pkg.route_request_id);
                  return (
                    <div key={pkg.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-foreground">{pkg.package_name_en}</p>
                          {pkg.package_name_ar && <p className="text-sm text-muted-foreground">{pkg.package_name_ar}</p>}
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'من' : 'By'}: {partner?.name || 'Unknown'}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full ${
                          pkg.status === 'approved' ? 'bg-green-100 text-green-700' :
                          pkg.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-amber-100 text-amber-700'
                        }`}>{pkg.status}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'رحلات' : 'Rides'}</p>
                          <p className="text-lg font-bold text-foreground">{pkg.ride_count}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'أيام' : 'Days'}</p>
                          <p className="text-lg font-bold text-foreground">{pkg.validity_days}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'السعر' : 'Price'}</p>
                          <p className="text-lg font-bold text-foreground">{pkg.suggested_price} EGP</p>
                        </div>
                      </div>
                      {linkedRoute && (
                        <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'المسار' : 'Route'}: {linkedRoute.name_en}</p>
                      )}
                      {pkg.admin_notes && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <p className="text-xs text-amber-800"><strong>Notes:</strong> {pkg.admin_notes}</p>
                        </div>
                      )}
                      {pkg.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              await supabase.from('partner_package_requests').update({ status: 'approved' }).eq('id', pkg.id);
                              toast.success(lang === 'ar' ? 'تم قبول الباقة' : 'Package approved');
                              fetchAllData();
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> {lang === 'ar' ? 'قبول' : 'Approve'}
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={async () => {
                              const notes = prompt(lang === 'ar' ? 'ملاحظات الرفض' : 'Rejection notes');
                              await supabase.from('partner_package_requests').update({ status: 'rejected', admin_notes: notes || null }).eq('id', pkg.id);
                              toast.success(lang === 'ar' ? 'تم رفض الباقة' : 'Package rejected');
                              fetchAllData();
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> {lang === 'ar' ? 'رفض' : 'Reject'}
                          </Button>
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
