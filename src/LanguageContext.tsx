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
    heroTitle: '0848 Studio',
    heroSubtitle: 'Visual Storytelling through Light & Motion',
    heroImageUrl: 'https://picsum.photos/seed/cinema/1920/1080',
    aboutTitle: 'The Vision Behind the Lens',
    aboutDesc: 'Capturing the essence of moments through a unique lens, blending traditional techniques with modern visual storytelling.',
    aboutYears: '10+',
    aboutProjects: '200+',
    aboutImageUrl: 'https://picsum.photos/seed/artist/800/1000',
    galleryLayout: 'masonry',
    primaryColor: '#1a1a1a',
    fontFamily: 'serif'
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
        const data = snapshot.data() as SiteSettings;
        setSettings(data);
        
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
