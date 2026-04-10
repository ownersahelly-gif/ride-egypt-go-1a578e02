import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, Route, User, Car } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNav = () => {
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/dashboard', icon: Home, labelEn: 'Home', labelAr: 'الرئيسية' },
    { path: '/my-bookings', icon: Ticket, labelEn: 'Bookings', labelAr: 'حجوزاتي' },
    { path: '/carpool', icon: Car, labelEn: 'Carpool', labelAr: 'مشاركة' },
    { path: '/request-route', icon: Route, labelEn: 'Request', labelAr: 'طلب مسار' },
    { path: '/profile', icon: User, labelEn: 'Profile', labelAr: 'حسابي' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;
          const isHome = tab.path === '/dashboard';
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onDoubleClick={isHome ? (e) => { e.preventDefault(); navigate('/admin'); } : undefined}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 transition-colors ${
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
