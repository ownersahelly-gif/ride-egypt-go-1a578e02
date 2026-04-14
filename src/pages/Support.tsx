import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Mail, HelpCircle, ChevronDown, ArrowLeft, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQ_ITEMS = [
  {
    q_en: 'How do I create an account?',
    q_ar: 'كيف أنشئ حساباً؟',
    a_en: 'Download the Massar app or visit our website, tap "Sign Up", enter your email and create a password. You\'ll receive a confirmation email to verify your account.',
    a_ar: 'حمّل تطبيق مسار أو زر موقعنا، اضغط "إنشاء حساب"، أدخل بريدك الإلكتروني وأنشئ كلمة مرور. ستصلك رسالة تأكيد لتفعيل حسابك.',
  },
  {
    q_en: 'How do I book a ride?',
    q_ar: 'كيف أحجز رحلة؟',
    a_en: 'Go to the Dashboard, select your route, choose your preferred date and time, pick your pickup and dropoff stops, then confirm your booking. You\'ll receive a boarding code for your trip.',
    a_ar: 'اذهب إلى لوحة التحكم، اختر مسارك، حدد التاريخ والوقت المفضلين، اختر نقطتي الركوب والنزول، ثم أكد حجزك. ستحصل على رمز ركوب لرحلتك.',
  },
  {
    q_en: 'How do I delete my account?',
    q_ar: 'كيف أحذف حسابي؟',
    a_en: 'Go to Profile in the app, scroll down to the "Danger Zone" section, and tap "Delete My Account". You\'ll be asked to confirm. This action is permanent and all your data will be deleted.',
    a_ar: 'اذهب إلى الملف الشخصي في التطبيق، مرر لأسفل إلى قسم "منطقة الخطر"، واضغط "حذف حسابي". سيُطلب منك التأكيد. هذا الإجراء نهائي وسيتم حذف جميع بياناتك.',
  },
  {
    q_en: 'How do I contact support?',
    q_ar: 'كيف أتواصل مع الدعم؟',
    a_en: 'You can reach us by sending an email to the support address listed on this page. We typically respond within 24 hours.',
    a_ar: 'يمكنك التواصل معنا عبر إرسال بريد إلكتروني إلى عنوان الدعم المذكور في هذه الصفحة. نرد عادة خلال 24 ساعة.',
  },
  {
    q_en: 'How do I update my payment information?',
    q_ar: 'كيف أحدّث معلومات الدفع الخاصة بي؟',
    a_en: 'Go to Profile in the app to update your personal information. For payment method changes, contact our support team and we\'ll assist you.',
    a_ar: 'اذهب إلى الملف الشخصي في التطبيق لتحديث معلوماتك الشخصية. لتغيير طريقة الدفع، تواصل مع فريق الدعم وسنساعدك.',
  },
];

const Support = () => {
  const { lang } = useLanguage();
  const { settings } = useAppSettings();
  const isAr = lang === 'ar';

  const appName = isAr ? settings.app_name_ar : settings.app_name_en;
  const supportEmail = settings.support_email || 'support@massar-app.com';

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="container mx-auto flex items-center h-16 px-4 gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-foreground">
            {isAr ? 'الدعم والمساعدة' : 'Support & Help'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-2xl space-y-10">
        {/* App Identity */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <Bus className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-extrabold text-foreground">{appName}</h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            {isAr
              ? 'مسار هو تطبيق نقل مشترك في مصر يوفر رحلات شاتل موثوقة وبأسعار معقولة للتنقل اليومي.'
              : 'Massar is a shared-ride platform in Egypt providing reliable and affordable shuttle rides for daily commuters.'}
          </p>
        </div>

        {/* Contact Us */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {isAr ? 'تواصل معنا' : 'Contact Us'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? 'إذا كان لديك أي أسئلة أو مشاكل، لا تتردد في التواصل معنا عبر البريد الإلكتروني.'
              : 'If you have any questions or issues, feel free to reach out to us via email.'}
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            {supportEmail}
          </a>
        </section>

        {/* FAQ */}
        <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h3>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`}>
                <AccordionTrigger className="text-sm font-medium text-start">
                  {isAr ? item.q_ar : item.q_en}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {isAr ? item.a_ar : item.a_en}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          © {new Date().getFullYear()} {appName}.{' '}
          {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </p>
      </main>
    </div>
  );
};

export default Support;
