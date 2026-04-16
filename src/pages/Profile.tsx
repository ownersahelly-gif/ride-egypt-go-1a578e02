import { useEffect, useState, useRef } from 'react';
import BottomNav from '@/components/BottomNav';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, ChevronRight, User, Camera, Loader2, Shield, FileText, MapPin, Scale, ChevronRight as ChevronRightIcon, Trash2, AlertTriangle, HelpCircle, Building2 } from 'lucide-react';

const Profile = () => {
  const { user, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const photoRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          setAvatarUrl(data.avatar_url || null);
        }
      });
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: lang === 'ar' ? 'الملف كبير جداً (الحد 5MB)' : 'File too large (max 5MB)', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `profile-photos/${user.id}/${Date.now()}.${ext}`;
      const { uploadToBunny } = await import('@/lib/bunnyUpload');
      const url = await uploadToBunny(file, filePath);
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      setAvatarUrl(url);
      toast({ title: lang === 'ar' ? 'تم تحديث الصورة' : 'Photo updated' });
    } catch (error: any) {
      toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('user_id', user.id);
    if (error) toast({ title: t('auth.error'), description: error.message, variant: 'destructive' });
    else toast({ title: t('profile.saved') });
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: user.id, self_delete: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await signOut();
      navigate('/login', { replace: true });
      toast({ title: lang === 'ar' ? 'تم حذف حسابك بنجاح' : 'Your account has been deleted' });
    } catch (err: any) {
      toast({
        title: lang === 'ar' ? 'فشل حذف الحساب' : 'Failed to delete account',
        description: err.message,
        variant: 'destructive',
      });
    }
    setDeleting(false);
  };

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border shrink-0 z-40 safe-area-top">
        <div className="container mx-auto flex items-center h-16 px-4 gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><Back className="w-5 h-5" /></Button></Link>
          <h1 className="text-lg font-bold text-foreground">{t('profile.title')}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto container mx-auto px-4 py-8 max-w-lg pb-24">
        {/* Avatar upload */}
        <div className="flex justify-center mb-6">
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            disabled={uploading}
            className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-primary" />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-primary/80 text-primary-foreground text-[9px] py-0.5 text-center">
              <Camera className="w-3 h-3 mx-auto" />
            </div>
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground mb-6">
          {lang === 'ar' ? 'اضغط لتغيير صورتك' : 'Tap to change your photo'}
        </p>

        <form onSubmit={handleSave} className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t('auth.email')}</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>{t('auth.fullName')}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('profile.phone')}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 1XX XXX XXXX" />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? t('auth.loading') : t('profile.save')}
          </Button>
        </form>

        {/* Support & Legal Section */}
        <div className="mt-6 bg-card rounded-2xl border border-border overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground px-6 pt-5 pb-2">
            {lang === 'ar' ? 'الدعم والقانوني' : 'Support & Legal'}
          </h3>
          <Link
            to="/communities"
            className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground flex-1">{lang === 'ar' ? 'المجتمعات' : 'Communities'}</span>
            <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            to="/support"
            className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors border-t border-border"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground flex-1">{lang === 'ar' ? 'الدعم والمساعدة' : 'Support & Help'}</span>
            <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
          </Link>
          {[
            { icon: Shield, label: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' }, section: 'privacy' },
            { icon: FileText, label: { en: 'Terms of Service', ar: 'شروط الخدمة' }, section: 'terms' },
            { icon: MapPin, label: { en: 'Location Data Usage', ar: 'استخدام بيانات الموقع' }, section: 'location' },
            { icon: Scale, label: { en: 'Licenses & Copyright', ar: 'التراخيص وحقوق الطبع' }, section: 'licenses' },
          ].map((item) => (
            <Link
              key={item.section}
              to={`/legal?section=${item.section}`}
              className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors border-t border-border"
            >
              <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground flex-1">{item.label[lang]}</span>
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {/* Danger Zone — Delete Account */}
        <div className="mt-6 bg-destructive/5 border border-destructive/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {lang === 'ar' ? 'منطقة الخطر' : 'Danger Zone'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {lang === 'ar'
              ? 'حذف حسابك سيؤدي إلى إزالة جميع بياناتك بشكل نهائي ولا يمكن التراجع عنه.'
              : 'Deleting your account will permanently remove all your data and cannot be undone.'}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2" disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {lang === 'ar' ? 'حذف حسابي' : 'Delete My Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  {lang === 'ar' ? 'تأكيد حذف الحساب' : 'Confirm Account Deletion'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {lang === 'ar'
                    ? 'هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم حذف جميع بياناتك بما فيها الحجوزات والرسائل والملف الشخصي بشكل دائم.'
                    : 'This action is permanent and cannot be undone. All your data will be deleted, including bookings, messages, and your profile.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {lang === 'ar' ? 'حذف حسابي نهائياً' : 'Delete My Account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
};

export default Profile;
