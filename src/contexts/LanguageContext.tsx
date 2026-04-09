import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.home': 'Home',
    'nav.howItWorks': 'How It Works',
    'nav.features': 'Features',
    'nav.drivers': 'For Drivers',
    'nav.login': 'Log In',
    'nav.signup': 'Sign Up',
    // Hero
    'hero.tagline': 'Smart Shuttle Service',
    'hero.title': 'Your Daily Commute,',
    'hero.titleHighlight': 'Reimagined',
    'hero.subtitle': 'Affordable shared rides across Egypt. Book a seat on a shuttle near you, or request a new route. Smart, safe, and always on time.',
    'hero.cta': 'Book a Ride',
    'hero.ctaSecondary': 'Become a Driver',
    'hero.riders': 'Active Riders',
    'hero.routes': 'Routes',
    'hero.cities': 'Cities',
    // How it works
    'how.title': 'How It Works',
    'how.subtitle': 'Get from A to B in three simple steps',
    'how.step1.title': 'Set Your Route',
    'how.step1.desc': 'Enter your pickup and drop-off locations. We\'ll find the best shuttle match for your trip.',
    'how.step2.title': 'Book Your Seat',
    'how.step2.desc': 'Choose from available shuttles, see pricing and estimated arrival. Reserve your seat instantly.',
    'how.step3.title': 'Ride & Arrive',
    'how.step3.desc': 'Track your shuttle in real-time. Enjoy a comfortable, affordable ride to your destination.',
    // Features
    'features.title': 'Why Choose Massar?',
    'features.subtitle': 'Built for Egypt, designed for everyone',
    'features.realtime.title': 'Real-Time Tracking',
    'features.realtime.desc': 'Track your shuttle live on the map. Know exactly when it arrives.',
    'features.affordable.title': 'Affordable Rides',
    'features.affordable.desc': 'Share the cost with other riders. Save up to 70% compared to private rides.',
    'features.safe.title': 'Safe & Verified',
    'features.safe.desc': 'All drivers are verified. Vehicles are inspected regularly for your safety.',
    'features.smart.title': 'Smart Routing',
    'features.smart.desc': 'Our algorithm finds the optimal route to minimize your travel time.',
    'features.demand.title': 'On-Demand Routes',
    'features.demand.desc': 'No shuttle on your route? Request one and we\'ll create it when demand is enough.',
    'features.seats.title': 'Seat Reservation',
    'features.seats.desc': 'Reserve your seat in advance. No standing, no overcrowding.',
    // Drivers
    'drivers.title': 'Drive With Massar',
    'drivers.subtitle': 'Earn more with flexible shuttle driving',
    'drivers.earn': 'Earn consistently with scheduled routes and guaranteed passengers.',
    'drivers.existing': 'Former Uber/Careem driver? Fast-track your onboarding with verified credentials.',
    'drivers.new': 'New to driving? We\'ll guide you through our simple verification process.',
    'drivers.cta': 'Apply to Drive',
    // Footer
    'footer.tagline': 'Smart shuttle service for Egypt.',
    'footer.company': 'Company',
    'footer.about': 'About Us',
    'footer.careers': 'Careers',
    'footer.contact': 'Contact',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.rights': '© 2026 Massar. All rights reserved.',
    // CTA
    'cta.title': 'Ready to Ride?',
    'cta.subtitle': 'Download the app and start your journey today.',
    'cta.button': 'Get Started',
  },
  ar: {
    'nav.home': 'الرئيسية',
    'nav.howItWorks': 'كيف يعمل',
    'nav.features': 'المميزات',
    'nav.drivers': 'للسائقين',
    'nav.login': 'تسجيل الدخول',
    'nav.signup': 'إنشاء حساب',
    'hero.tagline': 'خدمة شاتل ذكية',
    'hero.title': 'رحلتك اليومية،',
    'hero.titleHighlight': 'بشكل جديد',
    'hero.subtitle': 'رحلات مشتركة بأسعار معقولة في جميع أنحاء مصر. احجز مقعدك في شاتل قريب منك، أو اطلب مسار جديد. ذكي وآمن ودائماً في الوقت.',
    'hero.cta': 'احجز رحلة',
    'hero.ctaSecondary': 'انضم كسائق',
    'hero.riders': 'راكب نشط',
    'hero.routes': 'مسار',
    'hero.cities': 'مدن',
    'how.title': 'كيف يعمل',
    'how.subtitle': 'من النقطة أ إلى ب في ثلاث خطوات بسيطة',
    'how.step1.title': 'حدد مسارك',
    'how.step1.desc': 'أدخل نقطة الانطلاق والوصول. سنجد أفضل شاتل مناسب لرحلتك.',
    'how.step2.title': 'احجز مقعدك',
    'how.step2.desc': 'اختر من الشاتلات المتاحة، شاهد الأسعار ووقت الوصول المتوقع. احجز مقعدك فوراً.',
    'how.step3.title': 'اركب وصل',
    'how.step3.desc': 'تتبع الشاتل في الوقت الفعلي. استمتع برحلة مريحة وبأسعار معقولة.',
    'features.title': 'لماذا مسار؟',
    'features.subtitle': 'مصمم لمصر، مصنوع للجميع',
    'features.realtime.title': 'تتبع مباشر',
    'features.realtime.desc': 'تتبع الشاتل على الخريطة مباشرة. اعرف بالضبط متى يصل.',
    'features.affordable.title': 'أسعار معقولة',
    'features.affordable.desc': 'شارك التكلفة مع الركاب الآخرين. وفر حتى ٧٠٪ مقارنة بالرحلات الخاصة.',
    'features.safe.title': 'آمن وموثق',
    'features.safe.desc': 'جميع السائقين موثقين. يتم فحص المركبات بانتظام لسلامتك.',
    'features.smart.title': 'توجيه ذكي',
    'features.smart.desc': 'خوارزميتنا تجد المسار الأمثل لتقليل وقت رحلتك.',
    'features.demand.title': 'مسارات حسب الطلب',
    'features.demand.desc': 'لا يوجد شاتل على مسارك؟ اطلب واحداً وسننشئه عندما يكون الطلب كافياً.',
    'features.seats.title': 'حجز المقاعد',
    'features.seats.desc': 'احجز مقعدك مسبقاً. لا وقوف، لا ازدحام.',
    'drivers.title': 'قُد مع مسار',
    'drivers.subtitle': 'اكسب أكثر مع قيادة الشاتل المرنة',
    'drivers.earn': 'اكسب بانتظام مع مسارات مجدولة وركاب مضمونين.',
    'drivers.existing': 'سائق أوبر/كريم سابق؟ سرّع عملية التسجيل بأوراقك الموثقة.',
    'drivers.new': 'جديد في القيادة؟ سنرشدك خلال عملية التحقق البسيطة.',
    'drivers.cta': 'تقدم للقيادة',
    'footer.tagline': 'خدمة شاتل ذكية لمصر.',
    'footer.company': 'الشركة',
    'footer.about': 'عن مسار',
    'footer.careers': 'الوظائف',
    'footer.contact': 'اتصل بنا',
    'footer.legal': 'قانوني',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.terms': 'شروط الخدمة',
    'footer.rights': '© ٢٠٢٦ مسار. جميع الحقوق محفوظة.',
    'cta.title': 'جاهز للركوب؟',
    'cta.subtitle': 'حمّل التطبيق وابدأ رحلتك اليوم.',
    'cta.button': 'ابدأ الآن',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
  }, [lang, dir]);

  const t = (key: string): string => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
