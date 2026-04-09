import { useLanguage } from '@/contexts/LanguageContext';
import { MapPin, Ticket, Navigation } from 'lucide-react';

const HowItWorks = () => {
  const { t } = useLanguage();

  const steps = [
    { icon: MapPin, title: t('how.step1.title'), desc: t('how.step1.desc'), num: '01' },
    { icon: Ticket, title: t('how.step2.title'), desc: t('how.step2.desc'), num: '02' },
    { icon: Navigation, title: t('how.step3.title'), desc: t('how.step3.desc'), num: '03' },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-surface">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t('how.title')}</h2>
          <p className="text-muted-foreground text-lg">{t('how.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative bg-card rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-shadow duration-300 group"
            >
              <div className="absolute top-6 end-6 text-5xl font-extrabold text-muted/50 select-none">
                {step.num}
              </div>
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
