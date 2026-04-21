import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './i18n';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface SiteSettings {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutDesc: string;
  aboutYears: string;
  aboutProjects: string;
  aboutImageUrl: string;
  galleryLayout: 'masonry' | 'grid' | 'editorial';
  primaryColor: string;
  fontFamily: 'serif' | 'sans' | 'mono';
  email: string;
  socialLinks: { platform: string; url: string; }[];
  categoryLabels: Record<string, string>;
  navLabels_en: Record<string, string>;
  navLabels_zh: Record<string, string>;
  famousCars?: string;
  remarks?: string;
  photoCategories?: string[];
  videoCategories?: string[];
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: any;
  settings: SiteSettings;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SiteSettings>({
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    aboutTitle: '',
    aboutDesc: '',
    aboutYears: '',
    aboutProjects: '',
    aboutImageUrl: '',
    galleryLayout: 'masonry',
    primaryColor: '#1a1a1a',
    fontFamily: 'serif',
    email: 'cgsc0848@gmail.com',
    socialLinks: [],
    categoryLabels: {},
    navLabels_en: {
      home: 'Home',
      about: 'About',
      films: 'Films',
      stills: 'Stills',
      editorial: 'Editorial'
    },
    navLabels_zh: {
      home: '首页',
      about: '关于',
      films: '影片',
      stills: '摄影',
      editorial: '社论'
    },
    photoCategories: [],
    videoCategories: []
  });

  useEffect(() => {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.includes('zh')) {
      setLanguage('zh');
    } else {
      setLanguage('en');
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        
        // Helper to force https on strings
        const forceHttps = (url: any) => {
          if (typeof url !== 'string') return url;
          return url.replace(/^http:\/\//i, 'https://');
        };

        const data: SiteSettings = {
          ...rawData,
          heroImageUrl: forceHttps(rawData.heroImageUrl),
          aboutImageUrl: forceHttps(rawData.aboutImageUrl),
          socialLinks: (rawData.socialLinks || []).map((link: any) => ({
            ...link,
            url: forceHttps(link.url)
          }))
        } as SiteSettings;

        setSettings(prev => ({
          ...prev,
          ...data,
          navLabels_en: data.navLabels_en || prev.navLabels_en,
          navLabels_zh: data.navLabels_zh || prev.navLabels_zh,
          categoryLabels: data.categoryLabels || {},
          socialLinks: data.socialLinks || prev.socialLinks,
          photoCategories: data.photoCategories || prev.photoCategories,
          videoCategories: data.videoCategories || prev.videoCategories
        }));
        
        // Apply global styles
        document.documentElement.style.setProperty('--accent', data.primaryColor || '#c4b095');
        document.body.className = `font-${data.fontFamily || 'serif'}`;
      }
      setLoading(false);
    }, (error) => {
      console.warn("Settings fetch error (possibly permissions):", error.message);
      // Don't keep user in forever loading if they are just not logged in/no settings doc
      setLoading(false);
    });

    // Fallback timeout for loading
    const timer = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const t = translations[language];

  const value = React.useMemo(() => ({
    language,
    setLanguage,
    t,
    settings,
    loading
  }), [language, t, settings, loading]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
