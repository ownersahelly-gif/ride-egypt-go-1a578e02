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
import { useToast } from '@/hooks/use-toast';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import { ChevronLeft, ChevronRight, MapPin, Clock, Users, Fuel, RefreshCw } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const CarpoolPost = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [origin, setOrigin] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [seats, setSeats] = useState(3);
  const [isDaily, setIsDaily] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [shareFuel, setShareFuel] = useState(false);
  const [fuelAmount, setFuelAmount] = useState('');
  const [allowSwap, setAllowSwap] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dayLabels = lang === 'ar'
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (d: number) => {
    setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSubmit = async () => {
    if (!user || !origin || !destination) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: lang === 'ar' ? 'يرجى تحديد نقطة الانطلاق والوصول' : 'Please set origin and destination', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('carpool_routes').insert({
        user_id: user.id,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_name: destination.name,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        departure_time: departureTime + ':00',
        is_daily: isDaily,
        days_of_week: isDaily ? daysOfWeek : [],
        share_fuel: shareFuel,
        fuel_share_amount: shareFuel ? parseFloat(fuelAmount) || 0 : 0,
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
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold">{lang === 'ar' ? 'أضف رحلة جديدة' : 'Post a Ride'}</h1>
      </div>

      <div className="p-4 space-y-4">
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
              {origin && <p className="text-xs text-muted-foreground mt-1">✓ {origin.name}</p>}
            </div>
            <div>
              <Label>{lang === 'ar' ? 'إلى أين' : 'To'}</Label>
              <PlacesAutocomplete
                placeholder={lang === 'ar' ? 'الوجهة' : 'Destination'}
                onSelect={(place) => setDestination({ name: place.name, lat: place.lat, lng: place.lng })}
              />
              {destination && <p className="text-xs text-muted-foreground mt-1">✓ {destination.name}</p>}
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

        {/* Fuel & Swap */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fuel className="w-4 h-4" />{lang === 'ar' ? 'خيارات إضافية' : 'Options'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{lang === 'ar' ? 'مشاركة تكلفة البنزين' : 'Share fuel cost'}</p>
                <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'كل راكب يدفع حصته من البنزين' : 'Each passenger pays their share'}</p>
              </div>
              <Switch checked={shareFuel} onCheckedChange={setShareFuel} />
            </div>
            {shareFuel && (
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

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (lang === 'ar' ? 'جاري النشر...' : 'Posting...') : (lang === 'ar' ? 'نشر الرحلة' : 'Post Ride')}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CarpoolPost;
