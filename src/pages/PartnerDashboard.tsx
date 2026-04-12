import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapView from '@/components/MapView';
import {
  Building2, Copy, Users, DollarSign, Route, Plus, Loader2,
  CheckCircle2, Clock, XCircle, MapPin, Trash2, Pencil,
  Globe, LogOut, ListOrdered, Package, ChevronUp, ChevronDown
} from 'lucide-react';

const PartnerDashboard = () => {
  const { user, signOut } = useAuth();
  const { lang, setLang, appName } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [routeRequests, setRouteRequests] = useState<any[]>([]);
  const [packageRequests, setPackageRequests] = useState<any[]>([]);
  const [referralProfiles, setReferralProfiles] = useState<Record<string, any>>({});

  // Apply form
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ name: '', contact_email: '', contact_phone: '', bank_details: '' });
  const [applying, setApplying] = useState(false);

  // Route request form (mirrors admin)
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({
    name_en: '', name_ar: '',
    origin_name_en: '', origin_name_ar: '',
    destination_name_en: '', destination_name_ar: '',
    origin_lat: 30.0444, origin_lng: 31.2357,
    destination_lat: 30.0131, destination_lng: 31.2089,
    price: 25, estimated_duration_minutes: 30,
    stops: [] as { name_en: string; name_ar: string; lat: number; lng: number; stop_type: string }[],
  });
  const [newStop, setNewStop] = useState({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both' });
  const [submittingRoute, setSubmittingRoute] = useState(false);

  // Package request form
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [packageForm, setPackageForm] = useState({
    package_name_en: '', package_name_ar: '', ride_count: 10, validity_days: 30, suggested_price: 0, route_request_id: '',
  });
  const [submittingPackage, setSubmittingPackage] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: partnerData } = await supabase
      .from('partner_companies')
      .select('*')
      .eq('user_id', user!.id)
      .single();

    if (partnerData) {
      setPartner(partnerData);
      const [{ data: refs }, { data: earns }, { data: routes }, { data: pkgs }] = await Promise.all([
        supabase.from('partner_referrals').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
        supabase.from('partner_earnings').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
        supabase.from('partner_route_requests').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
        supabase.from('partner_package_requests').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
      ]);
      setReferrals(refs || []);
      setEarnings(earns || []);
      setRouteRequests(routes || []);
      setPackageRequests(pkgs || []);

      const userIds = [...new Set((refs || []).map((r: any) => r.referred_user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, phone, user_type').in('user_id', userIds);
        const pMap: Record<string, any> = {};
        (profs || []).forEach((p: any) => { pMap[p.user_id] = p; });
        setReferralProfiles(pMap);
      }
    }
    setLoading(false);
  };

  const generateSixDigitCode = () => String(Math.floor(100000 + Math.random() * 900000));

  const handleApply = async () => {
    if (!applyForm.name || !applyForm.contact_phone) {
      toast({ title: lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    setApplying(true);
    const { error } = await supabase.from('partner_companies').insert({
      user_id: user!.id,
      name: applyForm.name,
      contact_email: applyForm.contact_email || null,
      contact_phone: applyForm.contact_phone,
      bank_details: applyForm.bank_details || null,
      referral_code: generateSixDigitCode(),
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Application submitted!' });
      setShowApply(false);
      fetchData();
    }
    setApplying(false);
  };

  const resetRouteForm = () => {
    setRouteForm({ name_en: '', name_ar: '', origin_name_en: '', origin_name_ar: '', origin_lat: 30.0444, origin_lng: 31.2357, destination_name_en: '', destination_name_ar: '', destination_lat: 30.0131, destination_lng: 31.2089, price: 25, estimated_duration_minutes: 30, stops: [] });
    setEditingRouteId(null);
  };

  const handleEditRoute = (r: any) => {
    const stops = Array.isArray(r.stops_json) ? r.stops_json : [];
    setRouteForm({
      name_en: r.name_en, name_ar: r.name_ar,
      origin_name_en: r.origin_name, origin_name_ar: '',
      destination_name_en: r.destination_name, destination_name_ar: '',
      origin_lat: r.origin_lat, origin_lng: r.origin_lng,
      destination_lat: r.destination_lat, destination_lng: r.destination_lng,
      price: r.price, estimated_duration_minutes: r.estimated_duration_minutes,
      stops: stops.map((s: any) => ({ name_en: s.name_en || '', name_ar: s.name_ar || '', lat: s.lat || 0, lng: s.lng || 0, stop_type: s.stop_type || 'both' })),
    });
    setEditingRouteId(r.id);
    setShowRouteForm(true);
  };

  const handleSubmitRoute = async () => {
    if (!routeForm.name_en || !routeForm.origin_name_en || !routeForm.destination_name_en) {
      toast({ title: lang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setSubmittingRoute(true);
    const payload = {
      name_en: routeForm.name_en,
      name_ar: routeForm.name_ar || routeForm.name_en,
      origin_name: routeForm.origin_name_en,
      origin_lat: routeForm.origin_lat,
      origin_lng: routeForm.origin_lng,
      destination_name: routeForm.destination_name_en,
      destination_lat: routeForm.destination_lat,
      destination_lng: routeForm.destination_lng,
      price: routeForm.price,
      estimated_duration_minutes: routeForm.estimated_duration_minutes,
      stops_json: routeForm.stops,
      status: 'pending' as const,
    };

    let error;
    if (editingRouteId) {
      ({ error } = await supabase.from('partner_route_requests').update(payload).eq('id', editingRouteId));
    } else {
      ({ error } = await supabase.from('partner_route_requests').insert({ ...payload, partner_id: partner.id }));
    }
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? (editingRouteId ? 'تم تحديث الطلب!' : 'تم إرسال طلب المسار!') : (editingRouteId ? 'Route request updated!' : 'Route request submitted!') });
      setShowRouteForm(false);
      resetRouteForm();
      fetchData();
    }
    setSubmittingRoute(false);
  };

  const handleSubmitPackage = async () => {
    if (!packageForm.package_name_en) {
      toast({ title: lang === 'ar' ? 'يرجى ملء اسم الباقة' : 'Please fill package name', variant: 'destructive' });
      return;
    }
    setSubmittingPackage(true);
    const { error } = await supabase.from('partner_package_requests').insert({
      partner_id: partner.id,
      route_request_id: packageForm.route_request_id || null,
      package_name_en: packageForm.package_name_en,
      package_name_ar: packageForm.package_name_ar || packageForm.package_name_en,
      ride_count: packageForm.ride_count,
      validity_days: packageForm.validity_days,
      suggested_price: packageForm.suggested_price,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلب الباقة!' : 'Package request submitted!' });
      setShowPackageForm(false);
      setPackageForm({ package_name_en: '', package_name_ar: '', ride_count: 10, validity_days: 30, suggested_price: 0, route_request_id: '' });
      fetchData();
    }
    setSubmittingPackage(false);
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(partner.referral_code);
    toast({ title: lang === 'ar' ? 'تم نسخ الكود!' : 'Code copied!' });
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const stops = [...routeForm.stops];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= stops.length) return;
    [stops[index], stops[target]] = [stops[target], stops[index]];
    setRouteForm(p => ({ ...p, stops }));
  };

  const PartnerHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="p-2 rounded-full bg-primary-foreground/10">
            <Globe className="w-5 h-5" />
          </button>
          <button onClick={handleSignOut} className="p-2 rounded-full bg-primary-foreground/10">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
    </div>
  );

  // Commission is from platform profit (10%), not from total price
  // So displayed commission_percentage% is actually (commission_percentage% of 10%)
  const platformCutPercent = 10;
  const partnerCommissionDisplay = partner?.commission_percentage || 0;
  const effectiveTripPercent = (platformCutPercent * partnerCommissionDisplay) / 100;

  const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
  const totalEarnings = earnings.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!partner) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <PartnerHeader title={lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8 max-w-md mx-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!showApply ? (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">
                  {lang === 'ar' ? `كن شريكاً في ${appName}` : `Become a ${appName} Partner`}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {lang === 'ar'
                    ? 'هل لديك مجموعة واتساب للنقل أو شركة نقل صغيرة؟ انضم لنا واكسب نسبة من كل رحلة يحجزها عملاؤك!'
                    : 'Running a WhatsApp transport group or a small transport company? Join us and earn a percentage from every ride your clients book!'}
                </p>
                <ul className="text-sm text-start space-y-2 text-muted-foreground mb-6">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {lang === 'ar' ? 'كود إحالة فريد لمشاركته مع عملائك' : 'Unique referral code to share with your clients'}</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {lang === 'ar' ? 'اكسب نسبة من كل رحلة' : 'Earn commission on every ride'}</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {lang === 'ar' ? 'أضف مساراتك الخاصة' : 'Add your own routes'}</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {lang === 'ar' ? 'لوحة تحكم لتتبع أرباحك' : 'Dashboard to track your earnings'}</li>
                </ul>
                <Button onClick={() => setShowApply(true)} className="w-full gap-2" size="lg">
                  <Building2 className="w-5 h-5" />
                  {lang === 'ar' ? 'تقدم الآن' : 'Apply Now'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">{lang === 'ar' ? 'طلب شراكة' : 'Partner Application'}</h3>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'اسم الشركة / المجموعة' : 'Company / Group Name'} *</Label>
                <Input value={applyForm.name} onChange={e => setApplyForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'} *</Label>
                <Input value={applyForm.contact_phone} onChange={e => setApplyForm(p => ({ ...p, contact_phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
                <Input value={applyForm.contact_email} onChange={e => setApplyForm(p => ({ ...p, contact_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'تفاصيل الحساب البنكي' : 'Bank/InstaPay Details'}</Label>
                <Input value={applyForm.bank_details} onChange={e => setApplyForm(p => ({ ...p, bank_details: e.target.value }))} placeholder={lang === 'ar' ? 'رقم InstaPay أو تفاصيل الحساب' : 'InstaPay number or account details'} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowApply(false)} className="flex-1">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button onClick={handleApply} disabled={applying} className="flex-1">{applying ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'إرسال' : 'Submit')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (partner.status === 'pending') {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <PartnerHeader title={lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8 max-w-md mx-auto text-center" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}</h2>
          <p className="text-muted-foreground">{lang === 'ar' ? 'سنراجع طلبك ونتواصل معك قريبًا' : 'We\'ll review your application and get back to you soon.'}</p>
        </div>
      </div>
    );
  }

  if (partner.status === 'rejected') {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <PartnerHeader title={lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'} />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-8 max-w-md mx-auto text-center" style={{ WebkitOverflowScrolling: 'touch' }}>
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'تم رفض طلبك' : 'Application Rejected'}</h2>
          {partner.notes && <p className="text-muted-foreground">{partner.notes}</p>}
        </div>
      </div>
    );
  }

  // Active partner dashboard
  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <PartnerHeader
        title={lang === 'ar' ? 'لوحة الشريك' : 'Partner Dashboard'}
        subtitle={`${partner.name} — ${lang === 'ar' ? `عمولتك: ${partnerCommissionDisplay}% من أرباح الرحلة` : `Commission: ${partnerCommissionDisplay}% of ride profit`}`}
      />

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-4 py-6 space-y-6 pb-12">
          {/* Referral Code */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
              <Copy className="w-5 h-5 text-primary" />
              {lang === 'ar' ? 'كود الإحالة' : 'Referral Code'}
            </h3>
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-muted rounded-xl px-4 py-3 text-center">
                <span className="text-2xl font-bold tracking-[0.3em] text-foreground">{partner.referral_code}</span>
              </div>
              <Button variant="outline" size="icon" onClick={copyReferralCode}><Copy className="w-4 h-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {lang === 'ar' ? 'يكتب العملاء هذا الكود عند التسجيل للربط بحسابك' : 'Customers enter this code during signup to be linked to your account'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'مُحالين' : 'Referrals'}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalEarnings.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{pendingEarnings.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'قيد الدفع' : 'Pending'}</p>
            </div>
          </div>

          {/* Commission Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-foreground font-medium mb-1">
              {lang === 'ar'
                ? `عمولتك ${partnerCommissionDisplay}% من أرباح الرحلة`
                : `Your commission is ${partnerCommissionDisplay}% of the ride profit`}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? 'يتم احتساب عمولتك تلقائياً عند إكمال عملائك المُحالين لأي رحلة'
                : 'Automatically calculated when your referred clients complete rides'}
            </p>
          </div>

          {/* Referred Users */}
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-primary" />
              {lang === 'ar' ? 'المستخدمون المُحالون' : 'Referred Users'} ({referrals.length})
            </h3>
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
                {lang === 'ar' ? 'لا يوجد مُحالون بعد. شارك كودك!' : 'No referrals yet. Share your code!'}
              </p>
            ) : (
              <div className="space-y-2">
                {referrals.slice(0, 10).map(r => {
                  const p = referralProfiles[r.referred_user_id];
                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p?.full_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Route Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Route className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'طلبات المسارات' : 'Route Requests'}
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowRouteForm(true)} className="gap-1">
                <Plus className="w-4 h-4" />
                {lang === 'ar' ? 'طلب مسار' : 'Request Route'}
              </Button>
            </div>

            {showRouteForm && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-4">
                <h4 className="font-semibold text-foreground">{lang === 'ar' ? 'طلب مسار جديد' : 'New Route Request'}</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name (EN) *</Label>
                    <Input value={routeForm.name_en} onChange={e => setRouteForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Madinaty - Smart Village" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name (AR)</Label>
                    <Input value={routeForm.name_ar} onChange={e => setRouteForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مدينتي - القرية الذكية" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origin (EN)</Label>
                    <Input value={routeForm.origin_name_en} onChange={e => setRouteForm(p => ({ ...p, origin_name_en: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origin (AR)</Label>
                    <Input value={routeForm.origin_name_ar} onChange={e => setRouteForm(p => ({ ...p, origin_name_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Destination (EN)</Label>
                    <Input value={routeForm.destination_name_en} onChange={e => setRouteForm(p => ({ ...p, destination_name_en: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Destination (AR)</Label>
                    <Input value={routeForm.destination_name_ar} onChange={e => setRouteForm(p => ({ ...p, destination_name_ar: e.target.value }))} />
                  </div>
                </div>

                {/* Origin map */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-green-500" />
                    {lang === 'ar' ? 'نقطة الانطلاق' : 'Origin Location'}
                  </Label>
                  <PlacesAutocomplete
                    placeholder={lang === 'ar' ? 'ابحث عن نقطة الانطلاق...' : 'Search origin location...'}
                    onSelect={(place) => setRouteForm(p => ({ ...p, origin_lat: parseFloat(place.lat.toFixed(6)), origin_lng: parseFloat(place.lng.toFixed(6)), origin_name_en: p.origin_name_en || place.name, origin_name_ar: p.origin_name_ar || place.name }))}
                    iconColor="text-green-500"
                  />
                  <div className="h-[250px] w-full overflow-hidden rounded-lg border border-border">
                    <MapView
                      className="h-full w-full"
                      center={{ lat: routeForm.origin_lat, lng: routeForm.origin_lng }}
                      zoom={13}
                      gestureHandling="cooperative"
                      markers={[{ lat: routeForm.origin_lat, lng: routeForm.origin_lng, label: 'A', color: 'green' }]}
                      onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, origin_lat: parseFloat(lat.toFixed(6)), origin_lng: parseFloat(lng.toFixed(6)) }))}
                      showUserLocation={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{routeForm.origin_lat.toFixed(4)}, {routeForm.origin_lng.toFixed(4)}</p>
                </div>

                {/* Destination map */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-destructive" />
                    {lang === 'ar' ? 'نقطة الوصول' : 'Destination Location'}
                  </Label>
                  <PlacesAutocomplete
                    placeholder={lang === 'ar' ? 'ابحث عن نقطة الوصول...' : 'Search destination location...'}
                    onSelect={(place) => setRouteForm(p => ({ ...p, destination_lat: parseFloat(place.lat.toFixed(6)), destination_lng: parseFloat(place.lng.toFixed(6)), destination_name_en: p.destination_name_en || place.name, destination_name_ar: p.destination_name_ar || place.name }))}
                    iconColor="text-destructive"
                  />
                  <div className="h-[250px] w-full overflow-hidden rounded-lg border border-border">
                    <MapView
                      className="h-full w-full"
                      center={{ lat: routeForm.destination_lat, lng: routeForm.destination_lng }}
                      zoom={13}
                      gestureHandling="cooperative"
                      markers={[{ lat: routeForm.destination_lat, lng: routeForm.destination_lng, label: 'B', color: 'red' }]}
                      onMapClick={(lat, lng) => setRouteForm(p => ({ ...p, destination_lat: parseFloat(lat.toFixed(6)), destination_lng: parseFloat(lng.toFixed(6)) }))}
                      showUserLocation={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{routeForm.destination_lat.toFixed(4)}, {routeForm.destination_lng.toFixed(4)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'السعر (جنيه)' : 'Price (EGP)'}</Label>
                    <Input type="number" value={routeForm.price} onChange={e => setRouteForm(p => ({ ...p, price: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'المدة (دقيقة)' : 'Duration (min)'}</Label>
                    <Input type="number" value={routeForm.estimated_duration_minutes} onChange={e => setRouteForm(p => ({ ...p, estimated_duration_minutes: Number(e.target.value) }))} />
                  </div>
                </div>

                {/* Stops */}
                <div className="space-y-3">
                  <Label className="text-xs flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-primary" />
                    {lang === 'ar' ? 'نقاط التوقف' : 'Bus Stops'}
                  </Label>

                  {/* Stops map with directions */}
                  <div className="h-[280px] w-full overflow-hidden rounded-lg border border-border">
                    <MapView
                      className="h-full w-full"
                      center={{ lat: routeForm.origin_lat, lng: routeForm.origin_lng }}
                      zoom={11}
                      gestureHandling="cooperative"
                      origin={{ lat: routeForm.origin_lat, lng: routeForm.origin_lng }}
                      destination={{ lat: routeForm.destination_lat, lng: routeForm.destination_lng }}
                      waypoints={routeForm.stops.filter(s => s.lat !== 0).map(s => ({ lat: s.lat, lng: s.lng }))}
                      showDirections={routeForm.origin_lat !== routeForm.destination_lat || routeForm.origin_lng !== routeForm.destination_lng}
                      markers={[
                        { lat: routeForm.origin_lat, lng: routeForm.origin_lng, label: 'A', color: 'green' },
                        { lat: routeForm.destination_lat, lng: routeForm.destination_lng, label: 'B', color: 'red' },
                        ...routeForm.stops.filter(s => s.lat !== 0).map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}`, color: 'blue' as const })),
                        ...(newStop.lat !== 0 ? [{ lat: newStop.lat, lng: newStop.lng, label: '📍', color: 'orange' as const }] : []),
                      ]}
                      onMapClick={(lat, lng) => setNewStop(p => ({ ...p, lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) }))}
                      showUserLocation={false}
                    />
                  </div>

                  {routeForm.stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{stop.name_en}</p>
                        <p className="text-xs text-muted-foreground">{stop.name_ar} • {stop.stop_type === 'both' ? '↕' : stop.stop_type === 'pickup' ? '🟢' : '🔴'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveStop(i, 'up')} disabled={i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveStop(i, 'down')} disabled={i === routeForm.stops.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setRouteForm(p => ({ ...p, stops: p.stops.filter((_, j) => j !== i) }))} className="p-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}

                  {/* Add stop form */}
                  <div className="bg-muted/30 rounded-xl p-3 space-y-2 border border-dashed border-border">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={newStop.name_en} onChange={e => setNewStop(p => ({ ...p, name_en: e.target.value }))} placeholder="Stop name (EN)" className="text-sm" />
                      <Input value={newStop.name_ar} onChange={e => setNewStop(p => ({ ...p, name_ar: e.target.value }))} placeholder="اسم التوقف (AR)" className="text-sm" />
                    </div>
                    <PlacesAutocomplete
                      placeholder={lang === 'ar' ? 'ابحث عن الموقع...' : 'Search stop location...'}
                      onSelect={(place) => setNewStop(p => ({ ...p, lat: place.lat, lng: place.lng, name_en: p.name_en || place.name }))}
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newStop.stop_type}
                        onChange={e => setNewStop(p => ({ ...p, stop_type: e.target.value }))}
                        className="text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                      >
                        <option value="both">↕ Pickup & Dropoff</option>
                        <option value="pickup">🟢 Pickup only</option>
                        <option value="dropoff">🔴 Dropoff only</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (newStop.name_en) {
                          setRouteForm(p => ({ ...p, stops: [...p.stops, { ...newStop }] }));
                          setNewStop({ name_en: '', name_ar: '', lat: 0, lng: 0, stop_type: 'both' });
                        }
                      }} className="gap-1">
                        <Plus className="w-4 h-4" /> {lang === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowRouteForm(false); resetRouteForm(); }} className="flex-1">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                  <Button onClick={handleSubmitRoute} disabled={submittingRoute} className="flex-1">
                    {submittingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingRouteId ? (lang === 'ar' ? 'تحديث وإعادة إرسال' : 'Update & Resubmit') : (lang === 'ar' ? 'إرسال الطلب' : 'Submit Request'))}
                  </Button>
                </div>
              </div>
            )}

            {routeRequests.length === 0 && !showRouteForm ? (
              <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
                {lang === 'ar' ? 'لم تقدم طلبات مسارات بعد' : 'No route requests yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {routeRequests.map(r => {
                  const stops = Array.isArray(r.stops_json) ? r.stops_json : [];
                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-foreground text-sm">{r.name_en}</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditRoute(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.status === 'approved' ? 'bg-green-100 text-green-700' :
                            r.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                            'bg-amber-100 text-amber-700'
                          }`}>{r.status}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.origin_name} → {r.destination_name}</p>
                      <p className="text-xs text-muted-foreground">{r.price} EGP • {r.estimated_duration_minutes} min • {stops.length} stops</p>
                      {r.admin_notes && <p className="text-xs text-amber-600 mt-1">{r.admin_notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Package Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {lang === 'ar' ? 'طلبات الباقات' : 'Package Requests'}
              </h3>
              <Button size="sm" variant="outline" onClick={() => setShowPackageForm(true)} className="gap-1">
                <Plus className="w-4 h-4" />
                {lang === 'ar' ? 'طلب باقة' : 'Request Package'}
              </Button>
            </div>

            {showPackageForm && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-4">
                <h4 className="font-semibold text-foreground">{lang === 'ar' ? 'طلب باقة جديدة' : 'New Package Request'}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Package Name (EN) *</Label>
                    <Input value={packageForm.package_name_en} onChange={e => setPackageForm(p => ({ ...p, package_name_en: e.target.value }))} placeholder="e.g. Weekly Pass" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Package Name (AR)</Label>
                    <Input value={packageForm.package_name_ar} onChange={e => setPackageForm(p => ({ ...p, package_name_ar: e.target.value }))} placeholder="مثال: باقة أسبوعية" />
                  </div>
                </div>
                {routeRequests.filter(r => r.status === 'approved').length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'المسار (اختياري)' : 'Route (optional)'}</Label>
                    <select
                      value={packageForm.route_request_id}
                      onChange={e => setPackageForm(p => ({ ...p, route_request_id: e.target.value }))}
                      className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                    >
                      <option value="">{lang === 'ar' ? 'اختر مسار' : 'Select route'}</option>
                      {routeRequests.filter(r => r.status === 'approved').map(r => (
                        <option key={r.id} value={r.id}>{r.name_en}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'عدد الرحلات' : 'Rides'}</Label>
                    <Input type="number" value={packageForm.ride_count} onChange={e => setPackageForm(p => ({ ...p, ride_count: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'الصلاحية (يوم)' : 'Validity (days)'}</Label>
                    <Input type="number" value={packageForm.validity_days} onChange={e => setPackageForm(p => ({ ...p, validity_days: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{lang === 'ar' ? 'السعر المقترح' : 'Suggested Price'}</Label>
                    <Input type="number" value={packageForm.suggested_price} onChange={e => setPackageForm(p => ({ ...p, suggested_price: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPackageForm(false)} className="flex-1">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                  <Button onClick={handleSubmitPackage} disabled={submittingPackage} className="flex-1">
                    {submittingPackage ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'إرسال' : 'Submit')}
                  </Button>
                </div>
              </div>
            )}

            {packageRequests.length === 0 && !showPackageForm ? (
              <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
                {lang === 'ar' ? 'لم تقدم طلبات باقات بعد' : 'No package requests yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {packageRequests.map(pkg => (
                  <div key={pkg.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-foreground text-sm">{pkg.package_name_en}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        pkg.status === 'approved' ? 'bg-green-100 text-green-700' :
                        pkg.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                        'bg-amber-100 text-amber-700'
                      }`}>{pkg.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{pkg.ride_count} rides • {pkg.validity_days} days • {pkg.suggested_price} EGP</p>
                    {pkg.admin_notes && <p className="text-xs text-amber-600 mt-1">{pkg.admin_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earnings History */}
          {earnings.length > 0 && (
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-500" />
                {lang === 'ar' ? 'سجل الأرباح' : 'Earnings History'}
              </h3>
              <div className="space-y-2">
                {earnings.slice(0, 20).map(e => (
                  <div key={e.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{Number(e.amount).toFixed(2)} EGP</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.status === 'paid' ? (lang === 'ar' ? 'مدفوع' : 'Paid') : (lang === 'ar' ? 'قيد الانتظار' : 'Pending')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
