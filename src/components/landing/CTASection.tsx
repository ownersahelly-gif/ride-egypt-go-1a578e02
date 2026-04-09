import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const CTASection = () => {
  const { t, lang } = useLanguage();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center bg-surface rounded-3xl p-12 sm:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-secondary/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 relative z-10">{t('cta.title')}</h2>
          <p className="text-muted-foreground text-lg mb-8 relative z-10">{t('cta.subtitle')}</p>
          <Link to="/signup" className="relative z-10">
            <Button size="lg" className="text-base px-8 py-6 gap-2 rounded-xl">
              {t('cta.button')}
              <Arrow className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
