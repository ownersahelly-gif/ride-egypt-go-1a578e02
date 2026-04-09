import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Car, Users, Upload, Camera, CheckCircle2, Phone, Eye, EyeOff } from 'lucide-react';

type UserRole = 'rider' | 'driver';

interface UploadedFile {
  file: File;
  preview: string;
}

const FileUploadField = ({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: UploadedFile | null;
  onChange: (f: UploadedFile | null) => void;
  required?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange({ file, preview: URL.createObjectURL(file) });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="relative border border-border rounded-xl overflow-hidden">
          <img src={value.preview} alt={label} className="w-full h-32 object-cover" />
          <div className="absolute top-2 end-2 flex gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-card/90 backdrop-blur-sm rounded-full p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-2 start-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {value.file.name.length > 20 ? value.file.name.slice(0, 20) + '...' : value.file.name}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {label}
          </span>
        </button>
      )}
    </div>
  );
};

const Signup = () => {
  const { signUp } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Driver documents
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<UploadedFile | null>(null);
  const [carLicense, setCarLicense] = useState<UploadedFile | null>(null);
  const [criminalRecord, setCriminalRecord] = useState<UploadedFile | null>(null);
  const [wasUber, setWasUber] = useState(false);
  const [uberProof, setUberProof] = useState<UploadedFile | null>(null);

  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const uploadFile = async (userId: string, file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${folder}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('driver-documents').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('driver-documents').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
      return;
    }
    if (role === 'driver') {
      if (!idFront || !idBack || !drivingLicense || !carLicense || !criminalRecord) {
        toast({
          title: t('auth.error'),
          description: lang === 'ar' ? 'يرجى رفع جميع المستندات المطلوبة' : 'Please upload all required documents',
          variant: 'destructive',
        });
        return;
      }
      if (wasUber && !uberProof) {
        toast({
          title: t('auth.error'),
          description: lang === 'ar' ? 'يرجى رفع إثبات العمل في أوبر' : 'Please upload Uber proof document',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName);

      // Get the session after signup
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Try to sign in since email confirmation may be disabled
        await supabase.auth.signInWithPassword({ email, password });
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession) throw new Error('Could not authenticate');
      }

      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      if (!userId) throw new Error('No user ID');

      // Update phone in profile
      if (phone) {
        await supabase.from('profiles').update({ phone }).eq('user_id', userId);
      }

      if (role === 'driver') {
        // Upload all documents
        const [idFrontUrl, idBackUrl, drivingLicenseUrl, carLicenseUrl, criminalRecordUrl] = await Promise.all([
          uploadFile(userId, idFront!.file, 'id_front'),
          uploadFile(userId, idBack!.file, 'id_back'),
          uploadFile(userId, drivingLicense!.file, 'driving_license'),
          uploadFile(userId, carLicense!.file, 'car_license'),
          uploadFile(userId, criminalRecord!.file, 'criminal_record'),
        ]);

        let uberProofUrl = null;
        if (wasUber && uberProof) {
          uberProofUrl = await uploadFile(userId, uberProof.file, 'uber_proof');
        }

        await supabase.from('driver_applications').insert({
          user_id: userId,
          license_number: 'See uploaded documents',
          vehicle_model: lang === 'ar' ? 'في انتظار المراجعة' : 'Pending review',
          vehicle_plate: 'See uploaded documents',
          vehicle_year: new Date().getFullYear(),
          phone,
          id_front_url: idFrontUrl,
          id_back_url: idBackUrl,
          driving_license_url: drivingLicenseUrl,
          car_license_url: carLicenseUrl,
          criminal_record_url: criminalRecordUrl,
          was_uber_driver: wasUber,
          uber_proof_url: uberProofUrl,
          notes: wasUber
            ? (lang === 'ar' ? 'سائق أوبر سابق - أولوية في المراجعة' : 'Former Uber driver - priority review')
            : null,
        });

        toast({
          title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Application Submitted!',
          description: lang === 'ar'
            ? 'سيراجع الأدمن طلبك وسيتم إبلاغك بالقبول'
            : 'Admin will review your documents and notify you of acceptance',
        });
      } else {
        toast({
          title: t('auth.success'),
          description: lang === 'ar' ? 'تم إنشاء حسابك بنجاح' : 'Account created successfully',
        });
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Role selection
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="text-3xl font-bold text-primary font-arabic">
              {lang === 'ar' ? 'مسار' : 'Massar'}
            </Link>
            <h1 className="text-2xl font-bold text-foreground mt-6">
              {lang === 'ar' ? 'إنشاء حساب' : 'Create Account'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {lang === 'ar' ? 'اختر نوع حسابك' : 'Choose your account type'}
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setRole('rider')}
              className="w-full bg-card border-2 border-border rounded-2xl p-6 hover:border-primary transition-all text-start flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 shrink-0">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {lang === 'ar' ? 'راكب - أريد حجز رحلة' : 'Rider - I want to book a ride'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'ar' ? 'احجز رحلات واستمتع بخدمة الشاتل' : 'Book rides and enjoy shuttle service'}
                </p>
              </div>
            </button>

            <button
              onClick={() => setRole('driver')}
              className="w-full bg-card border-2 border-border rounded-2xl p-6 hover:border-secondary transition-all text-start flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 shrink-0">
                <Car className="w-7 h-7 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {lang === 'ar' ? 'سائق - أريد العمل كسائق' : 'Driver - I want to drive'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'ar' ? 'انضم كسائق واكسب مع مسار (يتطلب موافقة الأدمن)' : 'Join as a driver and earn with Massar (requires admin approval)'}
                </p>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.loginLink')}</Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">
            {lang === 'ar' ? 'مسار' : 'Massar'}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-4">
            {role === 'driver'
              ? (lang === 'ar' ? 'تسجيل كسائق' : 'Sign Up as Driver')
              : (lang === 'ar' ? 'إنشاء حساب راكب' : 'Create Rider Account')}
          </h1>
          {role === 'driver' && (
            <p className="text-sm text-muted-foreground mt-2">
              {lang === 'ar' ? 'سيتم مراجعة طلبك من قبل الإدارة' : 'Your application will be reviewed by admin'}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-card p-6 space-y-4">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {lang === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {lang === 'ar' ? 'تغيير نوع الحساب' : 'Change account type'}
          </button>

          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.fullName')}</Label>
            <div className="relative">
              <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder={t('auth.fullNamePlaceholder')} className="ps-10"
                value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
            <div className="relative">
              <Phone className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="phone" type="tel" placeholder="01xxxxxxxxx" className="ps-10"
                value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="name@example.com" className="ps-10"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="ps-10 pe-10"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Driver Documents */}
          {role === 'driver' && (
            <>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {lang === 'ar' ? 'المستندات المطلوبة' : 'Required Documents'}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {lang === 'ar' ? 'ارفع صور واضحة لجميع المستندات' : 'Upload clear photos of all documents'}
                </p>
              </div>

              <FileUploadField
                label={lang === 'ar' ? 'صورة البطاقة (الوجه الأمامي)' : 'ID Card (Front)'}
                value={idFront}
                onChange={setIdFront}
              />

              <FileUploadField
                label={lang === 'ar' ? 'صورة البطاقة (الوجه الخلفي)' : 'ID Card (Back)'}
                value={idBack}
                onChange={setIdBack}
              />

              <FileUploadField
                label={lang === 'ar' ? 'رخصة القيادة' : 'Driving License'}
                value={drivingLicense}
                onChange={setDrivingLicense}
              />

              <FileUploadField
                label={lang === 'ar' ? 'رخصة السيارة' : 'Car License'}
                value={carLicense}
                onChange={setCarLicense}
              />

              <FileUploadField
                label={lang === 'ar' ? 'شهادة الفيش والتشبيه (السجل الجنائي)' : 'Criminal Record Certificate'}
                value={criminalRecord}
                onChange={setCriminalRecord}
              />

              {/* Uber Question */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="wasUber"
                    checked={wasUber}
                    onChange={(e) => {
                      setWasUber(e.target.checked);
                      if (!e.target.checked) setUberProof(null);
                    }}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="wasUber" className="cursor-pointer text-sm">
                    {lang === 'ar' ? 'هل كنت تعمل في أوبر/كريم سابقاً؟' : 'Were you previously working with Uber/Careem?'}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ms-8">
                  {lang === 'ar' ? 'إضافة إثبات يسرّع عملية قبول طلبك' : 'Adding proof will fast-track your acceptance'}
                </p>
              </div>

              {wasUber && (
                <FileUploadField
                  label={lang === 'ar' ? 'إثبات العمل في أوبر/كريم (لقطة شاشة أو مستند)' : 'Uber/Careem proof (screenshot or document)'}
                  value={uberProof}
                  onChange={setUberProof}
                />
              )}
            </>
          )}

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading
              ? (lang === 'ar' ? 'جاري التسجيل...' : 'Submitting...')
              : role === 'driver'
                ? (lang === 'ar' ? 'إرسال طلب التسجيل' : 'Submit Application')
                : t('auth.signup')}
            <Arrow className="w-4 h-4" />
          </Button>

          {role === 'driver' && (
            <p className="text-xs text-center text-muted-foreground">
              {lang === 'ar'
                ? 'بالضغط على إرسال، سيتم إنشاء حسابك ومراجعة طلبك من قبل الإدارة'
                : 'By submitting, your account will be created and your application reviewed by admin'}
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.loginLink')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
