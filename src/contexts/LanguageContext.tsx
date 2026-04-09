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
    // Auth
    'auth.loginTitle': 'Welcome Back',
    'auth.loginSubtitle': 'Sign in to your Massar account',
    'auth.signupTitle': 'Create Account',
    'auth.signupSubtitle': 'Join Massar and start riding',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.fullNamePlaceholder': 'Ahmed Mohamed',
    'auth.login': 'Sign In',
    'auth.signup': 'Create Account',
    'auth.loading': 'Loading...',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.signupLink': 'Sign up',
    'auth.loginLink': 'Sign in',
    'auth.error': 'Error',
    'auth.success': 'Success',
    'auth.checkEmail': 'Check your email for a confirmation link.',
    'auth.passwordMin': 'Password must be at least 6 characters.',
    // Dashboard
    'dashboard.welcome': 'Welcome',
    'dashboard.subtitle': 'Where would you like to go today?',
    'dashboard.bookRide': 'Book a Ride',
    'dashboard.bookRideDesc': 'Find and book a shuttle on available routes',
    'dashboard.myBookings': 'My Bookings',
    'dashboard.myBookingsDesc': 'View and manage your trip history',
    'dashboard.requestRoute': 'Request Route',
    'dashboard.requestRouteDesc': 'Suggest a new shuttle route',
    'dashboard.recentBookings': 'Recent Bookings',
    'dashboard.noBookings': 'No bookings yet',
    'dashboard.bookFirst': 'Book Your First Ride',
    // Booking
    'booking.title': 'Book a Ride',
    'booking.searchPlaceholder': 'Search routes, locations...',
    'booking.noRoutes': 'No routes found',
    'booking.requestNew': 'Request a New Route',
    'booking.backToRoutes': 'Back to routes',
    'booking.perSeat': 'per seat',
    'booking.minutes': 'minutes',
    'booking.min': 'min',
    'booking.pickupStop': 'Pickup Stop',
    'booking.dropoffStop': 'Drop-off Stop',
    'booking.selectStop': 'Select a stop',
    'booking.date': 'Date',
    'booking.time': 'Time',
    'booking.seats': 'Seats',
    'booking.total': 'Total',
    'booking.confirm': 'Confirm Booking',
    'booking.success': 'Booking Confirmed!',
    'booking.successDesc': 'Your ride has been booked successfully.',
    'booking.cancelled': 'Booking cancelled',
    'booking.cancel': 'Cancel',
    'booking.seat': 'seat(s)',
    'booking.status.pending': 'Pending',
    'booking.status.confirmed': 'Confirmed',
    'booking.status.completed': 'Completed',
    'booking.status.cancelled': 'Cancelled',
    // Route Request
    'routeRequest.origin': 'Pickup Location',
    'routeRequest.destination': 'Drop-off Location',
    'routeRequest.originPlaceholder': 'e.g. Maadi, Cairo',
    'routeRequest.destPlaceholder': 'e.g. Smart Village, 6th October',
    'routeRequest.preferredTime': 'Preferred Time',
    'routeRequest.submit': 'Submit Request',
    'routeRequest.success': 'Request Submitted!',
    'routeRequest.successDesc': 'We\'ll notify you when this route becomes available.',
    // Profile
    'profile.title': 'My Profile',
    'profile.phone': 'Phone Number',
    'profile.save': 'Save Changes',
    'profile.saved': 'Profile updated!',
    // Driver
    'driver.applyTitle': 'Apply to Drive',
    'driver.licenseNumber': 'License Number',
    'driver.vehicleModel': 'Vehicle Model',
    'driver.vehiclePlate': 'Vehicle Plate',
    'driver.vehicleYear': 'Vehicle Year',
    'driver.experience': 'Experience (years)',
    'driver.submit': 'Submit Application',
    'driver.applicationSuccess': 'Application Submitted!',
    'driver.applicationSuccessDesc': 'We\'ll review your application and get back to you.',
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
    // Auth
    'auth.loginTitle': 'مرحباً بعودتك',
    'auth.loginSubtitle': 'سجل دخولك إلى حسابك في مسار',
    'auth.signupTitle': 'إنشاء حساب',
    'auth.signupSubtitle': 'انضم إلى مسار وابدأ رحلتك',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.fullName': 'الاسم الكامل',
    'auth.fullNamePlaceholder': 'أحمد محمد',
    'auth.login': 'تسجيل الدخول',
    'auth.signup': 'إنشاء حساب',
    'auth.loading': 'جاري التحميل...',
    'auth.noAccount': 'ليس لديك حساب؟',
    'auth.hasAccount': 'لديك حساب بالفعل؟',
    'auth.signupLink': 'أنشئ حساب',
    'auth.loginLink': 'سجل دخول',
    'auth.error': 'خطأ',
    'auth.success': 'تم بنجاح',
    'auth.checkEmail': 'تحقق من بريدك الإلكتروني لرابط التأكيد.',
    'auth.passwordMin': 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.',
    // Dashboard
    'dashboard.welcome': 'مرحباً',
    'dashboard.subtitle': 'إلى أين تريد الذهاب اليوم؟',
    'dashboard.bookRide': 'احجز رحلة',
    'dashboard.bookRideDesc': 'ابحث واحجز شاتل على المسارات المتاحة',
    'dashboard.myBookings': 'حجوزاتي',
    'dashboard.myBookingsDesc': 'عرض وإدارة سجل رحلاتك',
    'dashboard.requestRoute': 'اطلب مسار',
    'dashboard.requestRouteDesc': 'اقترح مسار شاتل جديد',
    'dashboard.recentBookings': 'الحجوزات الأخيرة',
    'dashboard.noBookings': 'لا توجد حجوزات بعد',
    'dashboard.bookFirst': 'احجز رحلتك الأولى',
    // Booking
    'booking.title': 'احجز رحلة',
    'booking.searchPlaceholder': 'ابحث عن مسارات، مواقع...',
    'booking.noRoutes': 'لا توجد مسارات',
    'booking.requestNew': 'اطلب مسار جديد',
    'booking.backToRoutes': 'العودة للمسارات',
    'booking.perSeat': 'للمقعد',
    'booking.minutes': 'دقيقة',
    'booking.min': 'د',
    'booking.pickupStop': 'نقطة الركوب',
    'booking.dropoffStop': 'نقطة النزول',
    'booking.selectStop': 'اختر محطة',
    'booking.date': 'التاريخ',
    'booking.time': 'الوقت',
    'booking.seats': 'المقاعد',
    'booking.total': 'الإجمالي',
    'booking.confirm': 'تأكيد الحجز',
    'booking.success': 'تم الحجز!',
    'booking.successDesc': 'تم حجز رحلتك بنجاح.',
    'booking.cancelled': 'تم إلغاء الحجز',
    'booking.cancel': 'إلغاء',
    'booking.seat': 'مقعد/مقاعد',
    'booking.status.pending': 'قيد الانتظار',
    'booking.status.confirmed': 'مؤكد',
    'booking.status.completed': 'مكتمل',
    'booking.status.cancelled': 'ملغي',
    // Route Request
    'routeRequest.origin': 'نقطة الانطلاق',
    'routeRequest.destination': 'نقطة الوصول',
    'routeRequest.originPlaceholder': 'مثلاً المعادي، القاهرة',
    'routeRequest.destPlaceholder': 'مثلاً القرية الذكية، ٦ أكتوبر',
    'routeRequest.preferredTime': 'الوقت المفضل',
    'routeRequest.submit': 'إرسال الطلب',
    'routeRequest.success': 'تم إرسال الطلب!',
    'routeRequest.successDesc': 'سنبلغك عندما يصبح هذا المسار متاحاً.',
    // Profile
    'profile.title': 'حسابي',
    'profile.phone': 'رقم الهاتف',
    'profile.save': 'حفظ التغييرات',
    'profile.saved': 'تم تحديث الملف الشخصي!',
    // Driver
    'driver.applyTitle': 'تقدم للقيادة',
    'driver.licenseNumber': 'رقم الرخصة',
    'driver.vehicleModel': 'موديل السيارة',
    'driver.vehiclePlate': 'رقم اللوحة',
    'driver.vehicleYear': 'سنة الصنع',
    'driver.experience': 'الخبرة (سنوات)',
    'driver.submit': 'إرسال الطلب',
    'driver.applicationSuccess': 'تم إرسال الطلب!',
    'driver.applicationSuccessDesc': 'سنراجع طلبك ونتواصل معك.',
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
