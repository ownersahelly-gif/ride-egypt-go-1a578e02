import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Car, Users, Upload, Camera, CheckCircle2, Phone, Eye, EyeOff, Building2 } from 'lucide-react';

type UserRole = 'rider' | 'driver' | 'company';

interface UploadedFile {
  file: File;
  preview: string;
}

const FileUploadField = ({
  label,
  value,
  onChange,
  required = true,
  accept = 'image/*',
}: {
  label: string;
  value: UploadedFile | null;
  onChange: (f: UploadedFile | null) => void;
  required?: boolean;
  accept?: string;
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
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
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
          <span className="text-sm text-muted-foreground">{label}</span>
        </button>
      )}
    </div>
  );
};

const StepIndicator = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {Array.from({ length: total }, (_, i) => (
      <div key={i} className={`h-2 rounded-full transition-all ${i + 1 === current ? 'w-8 bg-primary' : i + 1 < current ? 'w-8 bg-primary/40' : 'w-8 bg-border'}`} />
    ))}
  </div>
);

// Company Signup Component
const CompanySignup = ({ lang, t, appName, signUp, navigate, toast, referralCode, setRole, Arrow, BackArrow }: any) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Company details
  const [companyName, setCompanyName] = useState('');
  const [numClients, setNumClients] = useState('');
  const [numDrivers, setNumDrivers] = useState('');
  const [numRoutes, setNumRoutes] = useState('');
  const [bankDetails, setBankDetails] = useState('');

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      toast({ title: lang === 'ar' ? 'يجب الموافقة على الشروط والأحكام' : 'You must accept the Terms & Conditions', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const signUpData = await signUp(email, password, fullName);
      const userId = signUpData?.user?.id;
      if (!userId) throw new Error('Signup failed');

      let hasSession = !!signUpData?.session;
      if (!hasSession) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
          const { data: { session } } = await supabase.auth.getSession();
          hasSession = !!session;
        } catch {}
      }

      if (hasSession) {
        await supabase.from('profiles').update({
          user_type: 'customer' as const,
          phone: phone || null,
          accepted_terms_at: new Date().toISOString(),
        }).eq('user_id', userId);

        // Create partner company
        const referralCode = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + Math.random().toString(36).slice(2, 6);
        await supabase.from('partner_companies').insert({
          user_id: userId,
          name: companyName,
          contact_email: email,
          contact_phone: phone,
          bank_details: bankDetails || null,
          referral_code: referralCode,
          notes: `Clients: ${numClients}, Drivers: ${numDrivers}, Routes: ${numRoutes}`,
        });

        // Set English as default for partners
        localStorage.setItem('massar_lang', 'en');

        toast({
          title: 'Account Created!',
          description: 'Your partner application is under review',
        });
        navigate('/partner');
      } else {
        toast({
          title: lang === 'ar' ? 'تم إنشاء حسابك!' : 'Account Created!',
          description: lang === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني' : 'Please confirm your email, then log in',
        });
        navigate('/login');
      }
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">{appName}</Link>
          <h1 className="text-2xl font-bold text-foreground mt-4">
            {lang === 'ar' ? 'تسجيل شركة / مجموعة نقل' : 'Register as Company / Transport Group'}
          </h1>
        </div>

        <StepIndicator current={step} total={2} />

        <div className="bg-card rounded-2xl shadow-card p-6 space-y-4">
          <button type="button" onClick={() => { if (step === 1) setRole(null); else setStep(1); }} className="text-sm text-primary hover:underline flex items-center gap-1">
            <BackArrow className="w-4 h-4" />
            {step === 1 ? (lang === 'ar' ? 'تغيير نوع الحساب' : 'Change account type') : (lang === 'ar' ? 'الخطوة السابقة' : 'Previous step')}
          </button>

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>{t('auth.fullName')}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={lang === 'ar' ? 'اسمك الكامل' : 'Your full name'} className="ps-10" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'اسم الشركة / المجموعة' : 'Company / Group Name'}</Label>
                <div className="relative">
                  <Building2 className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={lang === 'ar' ? 'مثال: مجموعة نقل القاهرة' : 'e.g. Cairo Transport Group'} className="ps-10" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
                <div className="relative">
                  <Phone className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="tel" placeholder="01xxxxxxxxx" className="ps-10" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="name@example.com" className="ps-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="ps-10 pe-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full gap-2" size="lg" onClick={() => {
                if (!fullName || !companyName || !phone || !email || !password) {
                  toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', variant: 'destructive' });
                  return;
                }
                if (password.length < 6) {
                  toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
                  return;
                }
                setStep(2);
              }}>
                {lang === 'ar' ? 'التالي' : 'Next'}
                <Arrow className="w-4 h-4" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عدد العملاء الحاليين' : 'Number of current clients'}</Label>
                <Input type="number" placeholder={lang === 'ar' ? 'مثال: 50' : 'e.g. 50'} value={numClients} onChange={(e) => setNumClients(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عدد السائقين' : 'Number of drivers'}</Label>
                <Input type="number" placeholder={lang === 'ar' ? 'مثال: 5' : 'e.g. 5'} value={numDrivers} onChange={(e) => setNumDrivers(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'عدد المسارات' : 'Number of routes'}</Label>
                <Input type="number" placeholder={lang === 'ar' ? 'مثال: 3' : 'e.g. 3'} value={numRoutes} onChange={(e) => setNumRoutes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'تفاصيل الحساب البنكي / InstaPay' : 'Bank / InstaPay Details'}</Label>
                <Input placeholder={lang === 'ar' ? 'رقم InstaPay أو تفاصيل الحساب' : 'InstaPay number or account details'} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} />
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3 pt-2 border-t border-border">
                <input
                  type="checkbox"
                  id="acceptTermsCompany"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
                />
                <Label htmlFor="acceptTermsCompany" className="cursor-pointer text-sm leading-relaxed">
                  {lang === 'ar'
                    ? <>أوافق على <Link to="/legal?section=terms" target="_blank" className="text-primary underline">الشروط والأحكام</Link> و<Link to="/legal?section=privacy" target="_blank" className="text-primary underline">سياسة الخصوصية</Link></>
                    : <>I agree to the <Link to="/legal?section=terms" target="_blank" className="text-primary underline">Terms & Conditions</Link> and <Link to="/legal?section=privacy" target="_blank" className="text-primary underline">Privacy Policy</Link></>}
                </Label>
              </div>

              <Button className="w-full gap-2" size="lg" disabled={loading || !acceptedTerms} onClick={handleSubmit}>
                {loading ? (lang === 'ar' ? 'جاري التسجيل...' : 'Creating account...') : (lang === 'ar' ? 'إرسال طلب الشراكة' : 'Submit Partner Application')}
                <Arrow className="w-4 h-4" />
              </Button>
            </>
          )}

          <Link to="/login" className="block text-center text-sm text-primary font-medium hover:underline">
            {t('auth.hasAccount')} {t('auth.loginLink')}
          </Link>
        </div>
      </div>
    </div>
  );
};

const Signup = () => {
  const { signUp } = useAuth();
  const { t, lang, appName } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [driverStep, setDriverStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const referralCode = searchParams.get('ref') || '';

  // Driver photos
  const [facePhoto, setFacePhoto] = useState<UploadedFile | null>(null);
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<UploadedFile | null>(null);
  const [carLicense, setCarLicense] = useState<UploadedFile | null>(null);

  // Car details
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carPhoto, setCarPhoto] = useState<UploadedFile | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<UploadedFile | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const [wasUber, setWasUber] = useState(false);
  const [uberProof, setUberProof] = useState<UploadedFile | null>(null);

  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const uploadFile = async (userId: string, file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `driver-documents/${userId}/${folder}_${Date.now()}.${ext}`;
    const { uploadToBunny } = await import('@/lib/bunnyUpload');
    return await uploadToBunny(file, path);
  };

  const handleRiderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast({ title: lang === 'ar' ? 'يجب الموافقة على الشروط والأحكام' : 'You must accept the Terms & Conditions', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const signUpData = await signUp(email, password, fullName);
      const userId = signUpData?.user?.id;
      if (!userId) throw new Error('Signup failed');

      let hasSession = !!signUpData?.session;
      if (!hasSession) {
        try {
          await supabase.auth.signInWithPassword({ email, password });
          const { data: { session } } = await supabase.auth.getSession();
          hasSession = !!session;
        } catch {}
      }

      if (hasSession) {
        await supabase.from('profiles').update({
          user_type: 'customer' as const,
          ...(phone ? { phone } : {}),
          accepted_terms_at: new Date().toISOString(),
        }).eq('user_id', userId);

        // Track referral if present
        if (referralCode) {
          const { data: partner } = await supabase.from('partner_companies').select('id').eq('referral_code', referralCode).eq('status', 'approved').single();
          if (partner) {
            await supabase.from('profiles').update({ referred_by_partner_id: partner.id }).eq('user_id', userId);
            await supabase.from('partner_referrals').insert({ partner_id: partner.id, referred_user_id: userId, referral_code_used: referralCode });
          }
        }
      }

      if (!hasSession) {
        toast({
          title: lang === 'ar' ? 'تم إنشاء حسابك!' : 'Account Created!',
          description: lang === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني ثم سجل الدخول' : 'Please confirm your email, then log in',
        });
        navigate('/login');
        return;
      }

      toast({ title: t('auth.success'), description: lang === 'ar' ? 'تم إنشاء حسابك بنجاح' : 'Account created successfully' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSubmit = async () => {
    if (!acceptedTerms) {
      toast({ title: lang === 'ar' ? 'يجب الموافقة على الشروط والأحكام' : 'You must accept the Terms & Conditions', variant: 'destructive' });
      return;
    }
    // Validate step 3
    if (!carBrand || !carModel || !carYear || !licenseNumber) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى ملء جميع حقول السيارة' : 'Please fill all car fields', variant: 'destructive' });
      return;
    }
    if (!carPhoto) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى رفع صورة السيارة' : 'Please upload a car photo', variant: 'destructive' });
      return;
    }
    if (wasUber && !uberProof) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى رفع إثبات العمل في أوبر' : 'Please upload Uber/Careem proof', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Create account with email = phone@massar.app (no email needed for drivers)
      const driverEmail = `${phone.replace(/[^0-9]/g, '')}@driver.massar.app`;
      const signUpData = await signUp(driverEmail, password, fullName);
      const userId = signUpData?.user?.id;
      if (!userId) throw new Error('Signup failed');

      let hasSession = !!signUpData?.session;
      if (!hasSession) {
        try {
          await supabase.auth.signInWithPassword({ email: driverEmail, password });
          const { data: { session } } = await supabase.auth.getSession();
          hasSession = !!session;
        } catch {}
      }

      if (hasSession) {
        await supabase.from('profiles').update({
          user_type: 'driver' as const,
          phone,
          accepted_terms_at: new Date().toISOString(),
        }).eq('user_id', userId);

        // Track referral if present
        if (referralCode) {
          const { data: partner } = await supabase.from('partner_companies').select('id').eq('referral_code', referralCode).eq('status', 'approved').single();
          if (partner) {
            await supabase.from('profiles').update({ referred_by_partner_id: partner.id }).eq('user_id', userId);
            await supabase.from('partner_referrals').insert({ partner_id: partner.id, referred_user_id: userId, referral_code_used: referralCode });
          }
        }

        // Upload all documents
        const uploads = await Promise.all([
          facePhoto ? uploadFile(userId, facePhoto.file, 'face_photo') : null,
          idFront ? uploadFile(userId, idFront.file, 'id_front') : null,
          idBack ? uploadFile(userId, idBack.file, 'id_back') : null,
          drivingLicense ? uploadFile(userId, drivingLicense.file, 'driving_license') : null,
          carLicense ? uploadFile(userId, carLicense.file, 'car_license') : null,
          carPhoto ? uploadFile(userId, carPhoto.file, 'car_photo') : null,
          wasUber && uberProof ? uploadFile(userId, uberProof.file, 'uber_proof') : null,
          profilePhoto ? uploadFile(userId, profilePhoto.file, 'profile_photo') : null,
        ]);

        // Save profile photo as avatar
        if (uploads[7]) {
          await supabase.from('profiles').update({ avatar_url: uploads[7] }).eq('user_id', userId);
        }

        await supabase.from('driver_applications').insert({
          user_id: userId,
          license_number: licenseNumber,
          vehicle_model: `${carBrand} ${carModel}`,
          vehicle_plate: licenseNumber,
          vehicle_year: parseInt(carYear),
          phone,
          id_front_url: uploads[1],
          id_back_url: uploads[2],
          driving_license_url: uploads[3],
          car_license_url: uploads[4],
          criminal_record_url: uploads[0], // face photo stored here
          was_uber_driver: wasUber,
          uber_proof_url: uploads[6],
          notes: wasUber
            ? (lang === 'ar' ? 'سائق أوبر/كريم سابق' : 'Former Uber/Careem driver')
            : null,
        });

        toast({
          title: lang === 'ar' ? 'تم إرسال طلبك!' : 'Application Submitted!',
          description: lang === 'ar' ? 'سيراجع الأدمن طلبك وسيتم إبلاغك بالقبول' : 'Admin will review your application and notify you',
        });
        navigate('/driver-dashboard');
      } else {
        toast({
          title: lang === 'ar' ? 'تم إنشاء حسابك!' : 'Account Created!',
          description: lang === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني' : 'Please confirm your email, then log in',
        });
        navigate('/login');
      }
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const validateDriverStep1 = () => {
    if (!fullName || !phone || !password) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', variant: 'destructive' });
      return false;
    }
    if (password.length < 6) {
      toast({ title: t('auth.error'), description: t('auth.passwordMin'), variant: 'destructive' });
      return false;
    }
    return true;
  };

  const validateDriverStep2 = () => {
    if (!facePhoto || !idFront || !idBack || !drivingLicense || !carLicense) {
      toast({ title: t('auth.error'), description: lang === 'ar' ? 'يرجى رفع جميع الصور المطلوبة' : 'Please upload all required photos', variant: 'destructive' });
      return false;
    }
    return true;
  };

  // Step 0: Role selection
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="text-3xl font-bold text-primary font-arabic">
              {appName}
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
                  {lang === 'ar' ? `انضم كسائق واكسب مع ${appName}` : `Join as a driver and earn with ${appName}`}
                </p>
              </div>
            </button>

            <button
              onClick={() => setRole('company')}
              className="w-full bg-card border-2 border-border rounded-2xl p-6 hover:border-amber-500 transition-all text-start flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 shrink-0">
                <Building2 className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">
                  {lang === 'ar' ? 'شركة / مجموعة نقل' : 'Company / Transport Group'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {lang === 'ar' ? 'لديك مجموعة واتساب أو شركة نقل؟ انضم كشريك' : 'Have a WhatsApp group or transport company? Join as partner'}
                </p>
              </div>
            </button>
          </div>

          <Link to="/login" className="block text-center text-sm text-primary font-medium hover:underline mt-6">
            {t('auth.hasAccount')} {t('auth.loginLink')}
          </Link>
        </div>
      </div>
    );
  }

  // Company signup flow
  if (role === 'company') {
    return <CompanySignup lang={lang} t={t} appName={appName} signUp={signUp} navigate={navigate} toast={toast} referralCode={referralCode} setRole={setRole} Arrow={Arrow} BackArrow={BackArrow} />;
  }

  // Rider: simple form
  if (role === 'rider') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Link to="/" className="text-3xl font-bold text-primary font-arabic">
              {appName}
            </Link>
            <h1 className="text-2xl font-bold text-foreground mt-4">
              {lang === 'ar' ? 'إنشاء حساب راكب' : 'Create Rider Account'}
            </h1>
          </div>

          <form onSubmit={handleRiderSubmit} className="bg-card rounded-2xl shadow-card p-6 space-y-4">
            <button type="button" onClick={() => setRole(null)} className="text-sm text-primary hover:underline flex items-center gap-1">
              <BackArrow className="w-4 h-4" />
              {lang === 'ar' ? 'تغيير نوع الحساب' : 'Change account type'}
            </button>

            <div className="space-y-2">
              <Label>{t('auth.fullName')}</Label>
              <div className="relative">
                <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('auth.fullNamePlaceholder')} className="ps-10" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="tel" placeholder="01xxxxxxxxx" className="ps-10" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="email" type="email" placeholder="name@example.com" className="ps-10" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="ps-10 pe-10" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Terms acceptance */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="acceptTermsRider"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
              />
              <Label htmlFor="acceptTermsRider" className="cursor-pointer text-sm leading-relaxed">
                {lang === 'ar'
                  ? <>أوافق على <Link to="/legal?section=terms" target="_blank" className="text-primary underline">الشروط والأحكام</Link> و<Link to="/legal?section=privacy" target="_blank" className="text-primary underline">سياسة الخصوصية</Link></>
                  : <>I agree to the <Link to="/legal?section=terms" target="_blank" className="text-primary underline">Terms & Conditions</Link> and <Link to="/legal?section=privacy" target="_blank" className="text-primary underline">Privacy Policy</Link></>}
              </Label>
            </div>

            {referralCode && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {lang === 'ar' ? `كود الإحالة: ${referralCode}` : `Referral code: ${referralCode}`}
              </p>
            )}

            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading || !acceptedTerms}>
              {loading ? (lang === 'ar' ? 'جاري التسجيل...' : 'Creating account...') : t('auth.signup')}
              <Arrow className="w-4 h-4" />
            </Button>

            <Link to="/login" className="block text-center text-sm text-primary font-medium hover:underline">
              {t('auth.hasAccount')} {t('auth.loginLink')}
            </Link>
          </form>
        </div>
      </div>
    );
  }

  // Driver: multi-step form
  return (
    <div
      className="h-[100dvh] bg-surface overflow-y-auto px-4 py-8"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="w-full max-w-md mx-auto pb-8">
        <div className="text-center mb-4">
          <Link to="/" className="text-3xl font-bold text-primary font-arabic">
            {appName}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-4">
            {lang === 'ar' ? 'تسجيل كسائق' : 'Sign Up as Driver'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {driverStep === 1 && (lang === 'ar' ? 'المعلومات الأساسية' : 'Basic Information')}
            {driverStep === 2 && (lang === 'ar' ? 'الصور والمستندات' : 'Photos & Documents')}
            {driverStep === 3 && (lang === 'ar' ? 'معلومات السيارة' : 'Car Information')}
          </p>
        </div>

        <StepIndicator current={driverStep} total={3} />

        <div className="bg-card rounded-2xl shadow-card p-6 space-y-4 mb-8">
          <button
            type="button"
            onClick={() => {
              if (driverStep === 1) setRole(null);
              else setDriverStep(driverStep - 1);
            }}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <BackArrow className="w-4 h-4" />
            {driverStep === 1
              ? (lang === 'ar' ? 'تغيير نوع الحساب' : 'Change account type')
              : (lang === 'ar' ? 'الخطوة السابقة' : 'Previous step')}
          </button>

          {/* Step 1: Name, Phone, Password */}
          {driverStep === 1 && (
            <>
              <div className="space-y-2">
                <Label>{t('auth.fullName')}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('auth.fullNamePlaceholder')} className="ps-10" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="tel" placeholder="01xxxxxxxxx" className="ps-10" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="ps-10 pe-10" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                </div>
              </div>

              <Button type="button" className="w-full gap-2" size="lg" onClick={() => { if (validateDriverStep1()) setDriverStep(2); }}>
                {lang === 'ar' ? 'التالي' : 'Next'}
                <Arrow className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Step 2: Face photo, ID, Driving License, Car License */}
          {driverStep === 2 && (
            <>
              <FileUploadField
                label={lang === 'ar' ? 'صورة شخصية واضحة (وجهك)' : 'Clear face photo (selfie)'}
                value={facePhoto}
                onChange={setFacePhoto}
              />

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

              <Button type="button" className="w-full gap-2" size="lg" onClick={() => { if (validateDriverStep2()) setDriverStep(3); }}>
                {lang === 'ar' ? 'التالي' : 'Next'}
                <Arrow className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Step 3: Car details + Uber/Careem */}
          {driverStep === 3 && (
            <>
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => profilePhotoRef.current?.click()}
                  className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary transition-colors"
                >
                  {profilePhoto ? (
                    <img src={profilePhoto.preview} alt="" className="w-24 h-24 rounded-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-primary" />
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-primary/80 text-primary-foreground text-[10px] py-0.5 text-center">
                    {lang === 'ar' ? 'صورتك' : 'Your Photo'}
                  </div>
                </button>
                <input
                  ref={profilePhotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setProfilePhoto({ file, preview: URL.createObjectURL(file) });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {lang === 'ar' ? 'صورة البروفايل (ستظهر للركاب)' : 'Profile picture (visible to riders)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'ماركة السيارة' : 'Car Brand'}</Label>
                <Input placeholder={lang === 'ar' ? 'مثال: تويوتا' : 'e.g. Toyota'} value={carBrand} onChange={(e) => setCarBrand(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'موديل السيارة' : 'Car Model'}</Label>
                <Input placeholder={lang === 'ar' ? 'مثال: هايس' : 'e.g. HiAce'} value={carModel} onChange={(e) => setCarModel(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'سنة الصنع' : 'Year of Make'}</Label>
                <Input type="number" placeholder="2020" value={carYear} onChange={(e) => setCarYear(e.target.value)} required />
              </div>

              <FileUploadField
                label={lang === 'ar' ? 'صورة السيارة' : 'Car Photo'}
                value={carPhoto}
                onChange={setCarPhoto}
              />

              <div className="space-y-2">
                <Label>{lang === 'ar' ? 'رقم لوحة السيارة' : 'Car License Plate Number'}</Label>
                <Input placeholder={lang === 'ar' ? 'مثال: ن س ر ١ ١ ١' : 'e.g. ABC 123'} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
              </div>

              {/* Uber/Careem */}
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
                    {lang === 'ar' ? 'هل كنت تعمل في أوبر/كريم سابقاً؟' : 'Were you previously with Uber/Careem?'}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ms-8">
                  {lang === 'ar' ? 'إضافة إثبات يسرّع قبول طلبك' : 'Adding proof fast-tracks your acceptance'}
                </p>
              </div>

              {wasUber && (
                <FileUploadField
                  label={lang === 'ar' ? 'إثبات العمل في أوبر/كريم' : 'Uber/Careem proof (screenshot)'}
                  value={uberProof}
                  onChange={setUberProof}
                />
              )}

              {/* Terms acceptance for drivers */}
              <div className="flex items-start gap-3 pt-2 border-t border-border">
                <input
                  type="checkbox"
                  id="acceptTermsDriver"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
                />
                <Label htmlFor="acceptTermsDriver" className="cursor-pointer text-sm leading-relaxed">
                  {lang === 'ar'
                    ? <>أوافق على <Link to="/legal?section=terms" target="_blank" className="text-primary underline">الشروط والأحكام</Link> و<Link to="/legal?section=privacy" target="_blank" className="text-primary underline">سياسة الخصوصية</Link> بما فيها نسبة المنصة والتزامات السائق المالية</>
                    : <>I agree to the <Link to="/legal?section=terms" target="_blank" className="text-primary underline">Terms & Conditions</Link> and <Link to="/legal?section=privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>, including platform commission and driver payment obligations</>}
                </Label>
              </div>

              <Button type="button" className="w-full gap-2" size="lg" disabled={loading || !acceptedTerms} onClick={handleDriverSubmit}>
                {loading ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : (lang === 'ar' ? 'إرسال طلب التسجيل' : 'Submit Application')}
                <Arrow className="w-4 h-4" />
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {lang === 'ar'
                  ? 'بالضغط على إرسال، سيتم إنشاء حسابك ومراجعة طلبك من قبل الإدارة'
                  : 'By submitting, your account will be created and your application reviewed by admin'}
              </p>
            </>
          )}

          <Link to="/login" className="block text-center text-sm text-primary font-medium hover:underline">
            {t('auth.hasAccount')} {t('auth.loginLink')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
