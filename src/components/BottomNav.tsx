import { Link, useLocation } from 'react-router-dom';
import { Home, Ticket, Route, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNav = () => {
  const { lang } = useLanguage();
  const location = useLocation();

  const tabs = [
    { path: '/dashboard', icon: Home, labelEn: 'Home', labelAr: 'الرئيسية' },
    { path: '/my-bookings', icon: Ticket, labelEn: 'Bookings', labelAr: 'حجوزاتي' },
    { path: '/request-route', icon: Route, labelEn: 'Request', labelAr: 'طلب مسار' },
    { path: '/profile', icon: User, labelEn: 'Profile', labelAr: 'حسابي' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
