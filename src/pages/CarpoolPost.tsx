import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import MapView from '@/components/MapView';
import { ChevronLeft, ChevronRight, MapPin, Clock, Users, Fuel, RefreshCw, Building2, AlertCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const MODE_LABELS: Record<string, { en: string; ar: string }> = {
  car_sharing: { en: 'Car-sharing only (no money)', ar: 'مشاركة فقط (بدون مال)' },
  fuel_share: { en: 'Share fuel cost', ar: 'مشاركة وقود' },
  paid: { en: 'Paid ride', ar: 'رحلة مدفوعة' },
};

const CarpoolPost = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [origin, setOrigin] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [hasReturn, setHasReturn] = useState(false);
  const [returnTime, setReturnTime] = useState('17:00');
  const [seats, setSeats] = useState(3);
  const [isDaily, setIsDaily] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [shareFuel, setShareFuel] = useState(false);
  const [fuelAmount, setFuelAmount] = useState('');
  const [allowSwap, setAllowSwap] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pinMode, setPinMode] = useState<'origin' | 'destination' | null>(null);

  // Communities
  const [myCommunities, setMyCommunities] = useState<any[]>([]);
  const [communityId, setCommunityId] = useState<string>('');
  const [mode, setMode] = useState<string>('car_sharing');

  useEffect(() => {
    if (!user) return;
    supabase.from('community_memberships')
      .select('community_id, communities(*)')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .then(({ data }) => {
        const list = (data || []).map((m: any) => m.communities).filter(Boolean);
        setMyCommunities(list);
        if (list.length === 1) {
          setCommunityId(list[0].id);
          // pick first allowed mode
          const allowed = list[0].allowed_modes || [];
          if (allowed.length > 0) setMode(allowed[0]);
        }
      });
  }, [user]);

  const selectedCommunity = myCommunities.find(c => c.id === communityId);
  const allowedModes: string[] = selectedCommunity?.allowed_modes || [];

  // Auto-sync shareFuel switch with mode for backwards compat
  useEffect(() => {
    setShareFuel(mode === 'fuel_share' || mode === 'paid');
  }, [mode]);

  const dayLabels = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (d: number) => {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!pinMode) return;
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (pinMode === 'origin') {
      setOrigin({ name: label, lat, lng });
      toast({ title: lang === 'ar' ? 'تم تحديد نقطة الانطلاق' : 'Origin pinned on map' });
    } else {
      setDestination({ name: label, lat, lng });
      toast({ title: lang === 'ar' ? 'تم تحديد الوجهة' : 'Destination pinned on map' });
    }
    setPinMode(null);
  };

  const mapMarkers = [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng, label: lang === 'ar' ? 'انطلاق' : 'Start', color: 'green' as const }] : []),
    ...(destination ? [{ lat: destination.lat, lng: destination.lng, label: lang === 'ar' ? 'وصول' : 'End', color: 'red' as const }] : []),
  ];

  const handleSubmit = async () => {
    if (!user || !origin || !destination) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: lang === 'ar' ? 'يرجى تحديد نقطة الانطلاق والوصول' : 'Please set origin and destination', variant: 'destructive' });
      return;
    }
    if (!communityId) {
      toast({ title: lang === 'ar' ? 'اختر مجتمعاً' : 'Select a community', description: lang === 'ar' ? 'يجب اختيار المجتمع لنشر الرحلة فيه' : 'Pick which community to post this ride into', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('carpool_routes').insert({
        user_id: user.id,
        community_id: communityId,
        mode,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_name: destination.name,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        departure_time: departureTime + ':00',
        has_return: hasReturn,
        return_time: hasReturn ? returnTime + ':00' : null,
        is_daily: isDaily,
        days_of_week: isDaily ? daysOfWeek : [],
        share_fuel: mode !== 'car_sharing',
        fuel_share_amount: mode !== 'car_sharing' ? parseFloat(fuelAmount) || 0 : 0,
        allow_car_swap: allowSwap,
        available_seats: seats,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: lang === 'ar' ? 'تم!' : 'Posted!', description: lang === 'ar' ? 'تم نشر رحلتك بنجاح' : 'Your ride has been posted' });
      navigate('/carpool');
    } catch (e: any) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6 shrink-0 safe-area-top">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold">{lang === 'ar' ? 'أضف رحلة جديدة' : 'Post a Ride'}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* No communities warning */}
        {myCommunities.length === 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{lang === 'ar' ? 'لست عضواً في أي مجتمع' : 'You\'re not in any community'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === 'ar' ? 'يجب الانضمام لمجتمع لنشر رحلة فيه' : 'You must join a community before posting a ride.'}
                </p>
                <Button size="sm" className="mt-2" onClick={() => navigate('/communities')}>
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  {lang === 'ar' ? 'استكشاف المجتمعات' : 'Browse communities'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Community + mode */}
        {myCommunities.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />{lang === 'ar' ? 'المجتمع والوضع' : 'Community & Mode'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{lang === 'ar' ? 'انشر في' : 'Post into'}</Label>
                <Select value={communityId} onValueChange={v => {
                  setCommunityId(v);
                  const c = myCommunities.find(cc => cc.id === v);
                  if (c?.allowed_modes?.length) setMode(c.allowed_modes[0]);
                }}>
                  <SelectTrigger><SelectValue placeholder={lang === 'ar' ? 'اختر المجتمع' : 'Select community'} /></SelectTrigger>
                  <SelectContent>
                    {myCommunities.map(c => (
                      <SelectItem key={c.id} value={c.id}>{lang === 'ar' ? c.name_ar : c.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCommunity && allowedModes.length > 0 && (
                <div>
                  <Label>{lang === 'ar' ? 'وضع الرحلة' : 'Ride mode'}</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedModes.map(m => (
                        <SelectItem key={m} value={m}>{lang === 'ar' ? MODE_LABELS[m]?.ar : MODE_LABELS[m]?.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === 'ar' ? 'اختر كيف يدفع الركاب لرحلتك' : 'Choose how passengers compensate for your ride'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Route */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />{lang === 'ar' ? 'المسار' : 'Route'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{lang === 'ar' ? 'من أين' : 'From'}</Label>
              <PlacesAutocomplete
                placeholder={lang === 'ar' ? 'نقطة الانطلاق' : 'Starting point'}
                onSelect={(place) => setOrigin({ name: place.name, lat: place.lat, lng: place.lng })}
              />
              {origin && <p className="text-xs text-green-600 mt-1">✓ {origin.name}</p>}
              <Button
                type="button" variant="ghost" size="sm" className="mt-1 text-xs"
                onClick={() => setPinMode(pinMode === 'origin' ? null : 'origin')}
              >
                <MapPin className="w-3 h-3 mr-1" />
                {pinMode === 'origin'
                  ? (lang === 'ar' ? '← اضغط على الخريطة' : '← Tap the map')
                  : (lang === 'ar' ? 'أو حدد على الخريطة' : 'Or pin on map')
                }
              </Button>
            </div>
            <div>
              <Label>{lang === 'ar' ? 'إلى أين' : 'To'}</Label>
              <PlacesAutocomplete
                placeholder={lang === 'ar' ? 'الوجهة' : 'Destination'}
                onSelect={(place) => setDestination({ name: place.name, lat: place.lat, lng: place.lng })}
              />
              {destination && <p className="text-xs text-green-600 mt-1">✓ {destination.name}</p>}
              <Button
                type="button" variant="ghost" size="sm" className="mt-1 text-xs"
                onClick={() => setPinMode(pinMode === 'destination' ? null : 'destination')}
              >
                <MapPin className="w-3 h-3 mr-1" />
                {pinMode === 'destination'
                  ? (lang === 'ar' ? '← اضغط على الخريطة' : '← Tap the map')
                  : (lang === 'ar' ? 'أو حدد على الخريطة' : 'Or pin on map')
                }
              </Button>
            </div>

            <div className={`rounded-xl overflow-hidden border-2 transition-colors ${pinMode ? 'border-primary' : 'border-border'}`}>
              {pinMode && (
                <div className="bg-primary text-primary-foreground text-center text-xs py-1.5 font-medium">
                  {pinMode === 'origin'
                    ? (lang === 'ar' ? '🎯 اضغط لتحديد نقطة الانطلاق' : '🎯 Tap to set your starting point')
                    : (lang === 'ar' ? '🎯 اضغط لتحديد الوجهة' : '🎯 Tap to set your destination')
                  }
                </div>
              )}
              <div className="h-56">
                <MapView
                  markers={mapMarkers}
                  origin={origin && destination ? { lat: origin.lat, lng: origin.lng } : undefined}
                  destination={origin && destination ? { lat: destination.lat, lng: destination.lng } : undefined}
                  showDirections={!!(origin && destination)}
                  center={origin ? { lat: origin.lat, lng: origin.lng } : undefined}
                  zoom={12}
                  showUserLocation
                  onMapClick={handleMapClick}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />{lang === 'ar' ? 'الموعد' : 'Schedule'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{lang === 'ar' ? 'وقت المغادرة' : 'Departure Time'}</Label>
              <Input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{lang === 'ar' ? 'سأعود في نفس اليوم' : 'I will return the same day'}</Label>
              <Switch checked={hasReturn} onCheckedChange={setHasReturn} />
            </div>
            {hasReturn && (
              <div>
                <Label>{lang === 'ar' ? 'وقت العودة' : 'Return Time'}</Label>
                <Input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>{lang === 'ar' ? 'رحلة يومية' : 'Daily ride'}</Label>
              <Switch checked={isDaily} onCheckedChange={setIsDaily} />
            </div>
            {isDaily && (
              <div className="flex flex-wrap gap-2">
                {dayLabels.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seats */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />{lang === 'ar' ? 'المقاعد' : 'Seats'}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setSeats(Math.max(1, seats - 1))}>-</Button>
              <span className="text-lg font-bold">{seats}</span>
              <Button variant="outline" size="sm" onClick={() => setSeats(Math.min(6, seats + 1))}>+</Button>
            </div>
          </CardContent>
        </Card>

        {/* Cost & Swap */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fuel className="w-4 h-4" />{lang === 'ar' ? 'خيارات إضافية' : 'Options'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mode !== 'car_sharing' && (
              <div>
                <Label>{lang === 'ar' ? 'المبلغ لكل راكب (جنيه)' : 'Amount per passenger (EGP)'}</Label>
                <Input type="number" value={fuelAmount} onChange={e => setFuelAmount(e.target.value)} placeholder="20" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />{lang === 'ar' ? 'تبادل السيارات' : 'Car swap'}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'تبادل السيارات يومياً لتوزيع الاستهلاك' : 'Swap cars daily to share wear & tear'}</p>
              </div>
              <Switch checked={allowSwap} onCheckedChange={setAllowSwap} />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <div>
          <Label>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'ar' ? 'أي معلومات إضافية...' : 'Any additional info...'} />
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || myCommunities.length === 0}>
          {submitting ? (lang === 'ar' ? 'جاري النشر...' : 'Posting...') : (lang === 'ar' ? 'نشر الرحلة' : 'Post Ride')}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CarpoolPost;
