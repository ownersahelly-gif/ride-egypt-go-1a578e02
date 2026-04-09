import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X, Globe } from 'lucide-react';

const Navbar = () => {
  const { t, lang, setLang } = useLanguage();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { key: 'nav.home', href: '#' },
    { key: 'nav.howItWorks', href: '#how-it-works' },
    { key: 'nav.features', href: '#features' },
    { key: 'nav.drivers', href: '#drivers' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <a href="#" className="text-2xl font-bold text-primary font-arabic">
          {lang === 'ar' ? 'مسار' : 'Massar'}
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a key={link.key} href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t(link.key)}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md">
            <Globe className="w-4 h-4" />
            {lang === 'en' ? 'عربي' : 'EN'}
          </button>
          {user ? (
            <Link to="/dashboard">
              <Button size="sm">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</Button>
            </Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">{t('nav.login')}</Button></Link>
              <Link to="/signup"><Button size="sm">{t('nav.signup')}</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-4 pb-4 space-y-3">
          {navLinks.map((link) => (
            <a key={link.key} href={link.href}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2"
              onClick={() => setMobileOpen(false)}>
              {t(link.key)}
            </a>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
            {user ? (
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button size="sm">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="sm">{t('nav.login')}</Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button size="sm">{t('nav.signup')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
