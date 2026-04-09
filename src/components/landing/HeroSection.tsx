import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowRight, ArrowLeft, Users, Route, Building2 } from 'lucide-react';

const HeroSection = () => {
  const { t, lang } = useLanguage();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const stats = [
    { icon: Users, value: '50K+', label: t('hero.riders') },
    { icon: Route, value: '200+', label: t('hero.routes') },
    { icon: Building2, value: '12', label: t('hero.cities') },
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-hero opacity-[0.03]" />
      <div className="absolute top-20 -right-32 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute bottom-20 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary font-medium text-sm mb-8">
            <MapPin className="w-4 h-4" />
            {t('hero.tagline')}
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-foreground mb-6">
            {t('hero.title')}
            <br />
            <span className="text-gradient">{t('hero.titleHighlight')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" className="text-base px-8 py-6 gap-2 rounded-xl">
              {t('hero.cta')}
              <Arrow className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 py-6 rounded-xl">
              {t('hero.ctaSecondary')}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 sm:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <stat.icon className="w-5 h-5 text-secondary" />
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</span>
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
