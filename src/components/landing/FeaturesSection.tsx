import { useLanguage } from '@/contexts/LanguageContext';
import { Navigation, Wallet, ShieldCheck, Brain, Bell, Armchair } from 'lucide-react';

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: Navigation, title: t('features.realtime.title'), desc: t('features.realtime.desc') },
    { icon: Wallet, title: t('features.affordable.title'), desc: t('features.affordable.desc') },
    { icon: ShieldCheck, title: t('features.safe.title'), desc: t('features.safe.desc') },
    { icon: Brain, title: t('features.smart.title'), desc: t('features.smart.desc') },
    { icon: Bell, title: t('features.demand.title'), desc: t('features.demand.desc') },
    { icon: Armchair, title: t('features.seats.title'), desc: t('features.seats.desc') },
  ];

  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t('features.title')}</h2>
          <p className="text-muted-foreground text-lg">{t('features.subtitle')}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card border border-border rounded-2xl p-7 hover:border-secondary/40 hover:shadow-card-hover transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-5 group-hover:bg-secondary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
