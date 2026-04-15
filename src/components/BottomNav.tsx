import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Ticket, Route, User, Car, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BottomNav = () => {
  const { lang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/dashboard', icon: Home, labelEn: 'Home', labelAr: 'الرئيسية' },
    { path: '/my-bookings', icon: Ticket, labelEn: 'Bookings', labelAr: 'حجوزاتي' },
    { path: '/wallet', icon: Wallet, labelEn: 'Wallet', labelAr: 'المحفظة' },
    { path: '/carpool', icon: Car, labelEn: 'Carpool', labelAr: 'مشاركة' },
    { path: '/profile', icon: User, labelEn: 'Profile', labelAr: 'حسابي' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-border bg-card/95 backdrop-blur-sm"
      style={{
        height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitTransform: 'translate3d(0,0,0)',
        transform: 'translate3d(0,0,0)',
      }}
    >
      <div className="grid h-full grid-cols-5">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          const Icon = tab.icon;
          const isHome = tab.path === '/dashboard';
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onDoubleClick={isHome ? (e) => { e.preventDefault(); navigate('/admin'); } : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors active:scale-[0.98] ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
