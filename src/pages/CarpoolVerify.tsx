import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Upload, Shield, CheckCircle2, Clock } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const CarpoolVerify = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;

  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({
    id_front: null, id_back: null, driving_license: null, car_license: null, selfie: null,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from('carpool_verifications').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setVerification(data); setLoading(false); });
  }, [user]);

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from('carpool-documents').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('carpool-documents').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) return;
    const required = ['id_front', 'id_back', 'driving_license', 'car_license', 'selfie'];
    const missing = required.filter(k => !files[k]);
    if (missing.length > 0 || !licensePlate || !vehicleModel) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: lang === 'ar' ? 'يرجى ملء جميع الحقول ورفع جميع المستندات' : 'Please fill all fields and upload all documents', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const urls: Record<string, string> = {};
      for (const key of required) {
        const file = files[key]!;
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${key}.${ext}`;
        urls[key] = await uploadFile(file, path);
      }

      const { error } = await supabase.from('carpool_verifications').upsert({
        user_id: user.id,
        id_front_url: urls.id_front,
        id_back_url: urls.id_back,
        driving_license_url: urls.driving_license,
        car_license_url: urls.car_license,
        selfie_url: urls.selfie,
        license_plate: licensePlate,
        vehicle_model: vehicleModel,
        status: 'pending',
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast({ title: lang === 'ar' ? 'تم الإرسال' : 'Submitted', description: lang === 'ar' ? 'سيتم مراجعة طلبك قريباً' : 'Your verification will be reviewed soon' });
      navigate('/carpool');
    } catch (e: any) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  if (verification?.status === 'approved') {
    return (
      <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
          <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
          <h1 className="text-xl font-bold">{lang === 'ar' ? 'التحقق من الهوية' : 'Identity Verification'}</h1>
        </div>
        <div className="p-6 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-lg font-bold mb-2">{lang === 'ar' ? 'تم التحقق!' : 'Verified!'}</h2>
          <p className="text-muted-foreground">{lang === 'ar' ? 'حسابك موثق ويمكنك المشاركة في الرحلات' : 'Your account is verified and you can participate in rides'}</p>
          <Button className="mt-6" onClick={() => navigate('/carpool')}>{lang === 'ar' ? 'العودة' : 'Go Back'}</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (verification?.status === 'pending') {
    return (
      <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
          <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
          <h1 className="text-xl font-bold">{lang === 'ar' ? 'التحقق من الهوية' : 'Identity Verification'}</h1>
        </div>
        <div className="p-6 text-center">
          <Clock className="w-16 h-16 mx-auto text-secondary mb-4" />
          <h2 className="text-lg font-bold mb-2">{lang === 'ar' ? 'قيد المراجعة' : 'Under Review'}</h2>
          <p className="text-muted-foreground">{lang === 'ar' ? 'طلبك قيد المراجعة وسيتم إخطارك عند الموافقة' : 'Your application is being reviewed. You will be notified when approved.'}</p>
          <Button className="mt-6" variant="outline" onClick={() => navigate('/carpool')}>{lang === 'ar' ? 'العودة' : 'Go Back'}</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const fileFields = [
    { key: 'id_front', label: lang === 'ar' ? 'البطاقة (أمام)' : 'ID Card (Front)' },
    { key: 'id_back', label: lang === 'ar' ? 'البطاقة (خلف)' : 'ID Card (Back)' },
    { key: 'driving_license', label: lang === 'ar' ? 'رخصة القيادة' : 'Driving License' },
    { key: 'car_license', label: lang === 'ar' ? 'رخصة السيارة' : 'Car License' },
    { key: 'selfie', label: lang === 'ar' ? 'صورة شخصية' : 'Selfie Photo' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-primary text-primary-foreground px-4 pt-12 pb-6">
        <button onClick={() => navigate('/carpool')} className="mb-3"><Back className="w-6 h-6" /></button>
        <h1 className="text-xl font-bold">{lang === 'ar' ? 'التحقق من الهوية' : 'Identity Verification'}</h1>
        <p className="text-sm text-primary-foreground/70 mt-1">
          {lang === 'ar' ? 'للمشاركة في الرحلات يجب التحقق من هويتك' : 'Verify your identity to participate in carpooling'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">{lang === 'ar' ? 'معلومات السيارة' : 'Vehicle Info'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{lang === 'ar' ? 'رقم اللوحة' : 'License Plate'}</Label>
              <Input value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="ABC 1234" />
            </div>
            <div>
              <Label>{lang === 'ar' ? 'موديل السيارة' : 'Vehicle Model'}</Label>
              <Input value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} placeholder="Toyota Corolla 2020" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{lang === 'ar' ? 'المستندات المطلوبة' : 'Required Documents'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {fileFields.map(({ key, label }) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="mt-1">
                  <label className="flex items-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {files[key] ? files[key]!.name : (lang === 'ar' ? 'اختر ملف' : 'Choose file')}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) setFiles(prev => ({ ...prev, [key]: f }));
                    }} />
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
          <Shield className="w-4 h-4 mr-2" />
          {submitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (lang === 'ar' ? 'إرسال للمراجعة' : 'Submit for Review')}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default CarpoolVerify;
