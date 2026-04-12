import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  // App identity
  app_name_en: string;
  app_name_ar: string;
  // Hero section
  hero_title_en: string;
  hero_title_ar: string;
  hero_title_highlight_en: string;
  hero_title_highlight_ar: string;
  hero_subtitle_en: string;
  hero_subtitle_ar: string;
  hero_tagline_en: string;
  hero_tagline_ar: string;
  // Contact
  contact_phone: string;
  contact_email: string;
  contact_whatsapp: string;
  // Social
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  // Announcement banner
  announcement_en: string;
  announcement_ar: string;
  // Feature toggles
  feature_carpool_enabled: string;
  feature_packages_enabled: string;
  feature_track_shuttle_enabled: string;
  // Other
  instapay_phone: string;
  stop_waiting_time_minutes: string;
  price_per_km: string;
  global_default_factor: string;
  [key: string]: string;
}

const DEFAULTS: AppSettings = {
  app_name_en: 'Massar',
  app_name_ar: 'مسار',
  hero_title_en: '',
  hero_title_ar: '',
  hero_title_highlight_en: '',
  hero_title_highlight_ar: '',
  hero_subtitle_en: '',
  hero_subtitle_ar: '',
  hero_tagline_en: '',
  hero_tagline_ar: '',
  contact_phone: '',
  contact_email: '',
  contact_whatsapp: '',
  social_facebook: '',
  social_instagram: '',
  social_twitter: '',
  announcement_en: '',
  announcement_ar: '',
  feature_carpool_enabled: 'true',
  feature_packages_enabled: 'true',
  feature_track_shuttle_enabled: 'true',
  instapay_phone: '',
  stop_waiting_time_minutes: '3',
  price_per_km: '5',
  global_default_factor: '1',
};

let cachedSettings: AppSettings | null = null;
let fetchPromise: Promise<AppSettings> | null = null;

const fetchSettings = async (): Promise<AppSettings> => {
  const { data } = await supabase.from('app_settings').select('key, value');
  const settings = { ...DEFAULTS };
  (data || []).forEach((row: any) => {
    if (row.key && row.value !== null && row.value !== undefined) {
      settings[row.key] = row.value;
    }
  });
  cachedSettings = settings;
  return settings;
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(cachedSettings || DEFAULTS);
  const [loaded, setLoaded] = useState(!!cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoaded(true);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetchSettings();
    }
    fetchPromise.then(s => {
      setSettings(s);
      setLoaded(true);
      fetchPromise = null;
    });
  }, []);

  const refresh = async () => {
    cachedSettings = null;
    fetchPromise = null;
    const s = await fetchSettings();
    setSettings(s);
  };

  const getSetting = (key: string, lang?: 'en' | 'ar'): string => {
    if (lang) {
      return settings[`${key}_${lang}`] || settings[key] || '';
    }
    return settings[key] || '';
  };

  return { settings, loaded, refresh, getSetting };
};

export const invalidateAppSettings = () => {
  cachedSettings = null;
  fetchPromise = null;
};
