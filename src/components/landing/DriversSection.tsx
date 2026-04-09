import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap, UserCheck } from 'lucide-react';

const DriversSection = () => {
  const { t } = useLanguage();

  const points = [
    { icon: CheckCircle2, text: t('drivers.earn') },
    { icon: Zap, text: t('drivers.existing') },
    { icon: UserCheck, text: t('drivers.new') },
  ];

  return (
    <section id="drivers" className="py-24 bg-hero relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/95" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">{t('drivers.title')}</h2>
          <p className="text-primary-foreground/70 text-lg mb-12">{t('drivers.subtitle')}</p>

          <div className="space-y-6 mb-12">
            {points.map((point) => (
              <div key={point.text} className="flex items-start gap-4 text-start">
                <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <point.icon className="w-5 h-5 text-secondary" />
                </div>
                <p className="text-primary-foreground/90 text-lg leading-relaxed">{point.text}</p>
              </div>
            ))}
          </div>

          <Button size="lg" variant="secondary" className="text-base px-8 py-6 rounded-xl font-semibold">
            {t('drivers.cta')}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DriversSection;
