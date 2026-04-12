import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import {
  Building2, Link2, Copy, Users, DollarSign, Route, Plus, Loader2,
  CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, MapPin, Trash2
} from 'lucide-react';

const PartnerDashboard = () => {
  const { user } = useAuth();
  const { lang, appName } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [routeRequests, setRouteRequests] = useState<any[]>([]);
  const [referralProfiles, setReferralProfiles] = useState<Record<string, any>>({});

  // Apply form
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ name: '', contact_email: '', contact_phone: '', bank_details: '' });
  const [applying, setApplying] = useState(false);

  // Route request form
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeForm, setRouteForm] = useState({
    name_en: '', name_ar: '', origin_name: '', origin_lat: 30.0444, origin_lng: 31.2357,
    destination_name: '', destination_lat: 30.0131, destination_lng: 31.2089,
    price: 25, estimated_duration_minutes: 30,
    stops: [] as { name: string; lat: number; lng: number }[],
  });
  const [newStopName, setNewStopName] = useState('');
  const [submittingRoute, setSubmittingRoute] = useState(false);

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
      const [{ data: refs }, { data: earns }, { data: routes }] = await Promise.all([
        supabase.from('partner_referrals').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
        supabase.from('partner_earnings').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
        supabase.from('partner_route_requests').select('*').eq('partner_id', partnerData.id).order('created_at', { ascending: false }),
      ]);
      setReferrals(refs || []);
      setEarnings(earns || []);
      setRouteRequests(routes || []);

      // Fetch profiles for referrals
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

  const handleApply = async () => {
    if (!applyForm.name || !applyForm.contact_phone) {
      toast({ title: lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }
    setApplying(true);
    const referralCode = applyForm.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from('partner_companies').insert({
      user_id: user!.id,
      name: applyForm.name,
      contact_email: applyForm.contact_email || null,
      contact_phone: applyForm.contact_phone,
      bank_details: applyForm.bank_details || null,
      referral_code: referralCode,
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

  const handleSubmitRoute = async () => {
    if (!routeForm.name_en || !routeForm.origin_name || !routeForm.destination_name) {
      toast({ title: lang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setSubmittingRoute(true);
    const { error } = await supabase.from('partner_route_requests').insert({
      partner_id: partner.id,
      name_en: routeForm.name_en,
      name_ar: routeForm.name_ar || routeForm.name_en,
      origin_name: routeForm.origin_name,
      origin_lat: routeForm.origin_lat,
      origin_lng: routeForm.origin_lng,
      destination_name: routeForm.destination_name,
      destination_lat: routeForm.destination_lat,
      destination_lng: routeForm.destination_lng,
      price: routeForm.price,
      estimated_duration_minutes: routeForm.estimated_duration_minutes,
      stops_json: routeForm.stops,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: lang === 'ar' ? 'تم إرسال طلب المسار!' : 'Route request submitted!' });
      setShowRouteForm(false);
      setRouteForm({ name_en: '', name_ar: '', origin_name: '', origin_lat: 30.0444, origin_lng: 31.2357, destination_name: '', destination_lat: 30.0131, destination_lng: 31.2089, price: 25, estimated_duration_minutes: 30, stops: [] });
      fetchData();
    }
    setSubmittingRoute(false);
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${partner.referral_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: lang === 'ar' ? 'تم نسخ الرابط!' : 'Link copied!' });
  };

  const totalEarnings = earnings.reduce((s, e) => s + Number(e.amount), 0);
  const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // No partner account yet
  if (!partner) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/dashboard" className="p-2 rounded-full bg-primary-foreground/10"><Back className="w-5 h-5" /></Link>
            <h1 className="text-xl font-bold">{lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'}</h1>
          </div>
        </div>

        <div className="px-4 py-8 max-w-md mx-auto">
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
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> {lang === 'ar' ? 'رابط إحالة فريد لمشاركته مع عملائك' : 'Unique referral link to share with your clients'}</li>
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
        <BottomNav />
      </div>
    );
  }

  // Pending approval
  if (partner.status === 'pending') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/dashboard" className="p-2 rounded-full bg-primary-foreground/10"><Back className="w-5 h-5" /></Link>
            <h1 className="text-xl font-bold">{lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'}</h1>
          </div>
        </div>
        <div className="px-4 py-8 max-w-md mx-auto text-center">
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'طلبك قيد المراجعة' : 'Application Under Review'}</h2>
          <p className="text-muted-foreground">{lang === 'ar' ? 'سنراجع طلبك ونتواصل معك قريبًا' : 'We\'ll review your application and get back to you soon.'}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (partner.status === 'rejected') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/dashboard" className="p-2 rounded-full bg-primary-foreground/10"><Back className="w-5 h-5" /></Link>
            <h1 className="text-xl font-bold">{lang === 'ar' ? 'برنامج الشراكة' : 'Partner Program'}</h1>
          </div>
        </div>
        <div className="px-4 py-8 max-w-md mx-auto text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{lang === 'ar' ? 'تم رفض طلبك' : 'Application Rejected'}</h2>
          {partner.notes && <p className="text-muted-foreground">{partner.notes}</p>}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Active partner dashboard
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2 rounded-full bg-primary-foreground/10"><Back className="w-5 h-5" /></Link>
          <h1 className="text-xl font-bold">{lang === 'ar' ? 'لوحة الشريك' : 'Partner Dashboard'}</h1>
        </div>
        <p className="text-sm opacity-80">{partner.name}</p>
        <p className="text-xs opacity-60">{lang === 'ar' ? `النسبة: ${partner.commission_percentage}%` : `Commission: ${partner.commission_percentage}%`}</p>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Referral Link */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
            <Link2 className="w-5 h-5 text-primary" />
            {lang === 'ar' ? 'رابط الإحالة' : 'Referral Link'}
          </h3>
          <div className="flex gap-2">
            <Input readOnly value={`${window.location.origin}/signup?ref=${partner.referral_code}`} className="text-xs" />
            <Button variant="outline" size="icon" onClick={copyReferralLink}><Copy className="w-4 h-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {lang === 'ar' ? 'شارك هذا الرابط مع عملائك وسائقيك' : 'Share this link with your clients and drivers'}
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

        {/* Referred Users */}
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            {lang === 'ar' ? 'المستخدمون المُحالون' : 'Referred Users'} ({referrals.length})
          </h3>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
              {lang === 'ar' ? 'لا يوجد مُحالون بعد. شارك رابطك!' : 'No referrals yet. Share your link!'}
            </p>
          ) : (
            <div className="space-y-2">
              {referrals.slice(0, 10).map(r => {
                const p = referralProfiles[r.referred_user_id];
                return (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p?.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{p?.user_type || 'customer'} • {new Date(r.created_at).toLocaleDateString()}</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{lang === 'ar' ? 'الاسم (EN)' : 'Name (EN)'}</Label>
                  <Input value={routeForm.name_en} onChange={e => setRouteForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. Madinaty - Smart Village" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{lang === 'ar' ? 'الاسم (AR)' : 'Name (AR)'}</Label>
                  <Input value={routeForm.name_ar} onChange={e => setRouteForm(p => ({ ...p, name_ar: e.target.value }))} placeholder="مدينتي - القرية الذكية" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{lang === 'ar' ? 'نقطة الانطلاق' : 'Origin'}</Label>
                <PlacesAutocomplete
                  value={routeForm.origin_name}
                  onSelect={place => {
                    setRouteForm(p => ({
                      ...p,
                      origin_name: place.name,
                      origin_lat: place.lat,
                      origin_lng: place.lng,
                    }));
                  }}
                  placeholder={lang === 'ar' ? 'ابحث عن نقطة الانطلاق' : 'Search origin'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{lang === 'ar' ? 'الوجهة' : 'Destination'}</Label>
                <PlacesAutocomplete
                  value={routeForm.destination_name}
                  onSelect={place => {
                    setRouteForm(p => ({
                      ...p,
                      destination_name: place.name,
                      destination_lat: place.lat,
                      destination_lng: place.lng,
                    }));
                  }}
                  placeholder={lang === 'ar' ? 'ابحث عن الوجهة' : 'Search destination'}
                />
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
              <div className="space-y-2">
                <Label className="text-xs">{lang === 'ar' ? 'نقاط التوقف' : 'Stops'}</Label>
                {routeForm.stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{stop.name}</span>
                    <button onClick={() => setRouteForm(p => ({ ...p, stops: p.stops.filter((_, j) => j !== i) }))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newStopName} onChange={e => setNewStopName(e.target.value)} placeholder={lang === 'ar' ? 'اسم نقطة التوقف' : 'Stop name'} className="text-sm" />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (newStopName) {
                      setRouteForm(p => ({ ...p, stops: [...p.stops, { name: newStopName, lat: 0, lng: 0 }] }));
                      setNewStopName('');
                    }
                  }}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRouteForm(false)} className="flex-1">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                <Button onClick={handleSubmitRoute} disabled={submittingRoute} className="flex-1">
                  {submittingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === 'ar' ? 'إرسال الطلب' : 'Submit Request')}
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
              {routeRequests.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground text-sm">{r.name_en}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'approved' ? 'bg-green-100 text-green-700' :
                      r.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-amber-100 text-amber-700'
                    }`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.origin_name} → {r.destination_name}</p>
                  <p className="text-xs text-muted-foreground">{r.price} EGP • {r.estimated_duration_minutes} min</p>
                  {r.admin_notes && <p className="text-xs text-amber-600 mt-1">{r.admin_notes}</p>}
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
      <BottomNav />
    </div>
  );
};

export default PartnerDashboard;
