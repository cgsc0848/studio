import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PhotoGallery from './components/PhotoGallery';
import VideoSection from './components/VideoSection';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import GalleryPage from './components/GalleryPage';
import ScrollToTop from './components/ScrollToTop';
import { cn, getReferrerPolicy } from './lib/utils';
import { motion, useScroll, useSpring } from 'motion/react';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { useState, useEffect, lazy, Suspense } from 'react';
import { ChevronUp, Loader2 } from 'lucide-react';

// Lazy load Admin component
const Admin = lazy(() => import('./components/Admin'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-paper">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-ink/20" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40">Loading...</span>
      </div>
    </div>
  );
}

function SidebarNav() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const { settings, language } = useLanguage();
  const labels = language === 'en' ? settings.navLabels_en : settings.navLabels_zh;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleActivity = () => {
      setIsNavVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsNavVisible(false);
      }, 8000);
    };

    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('mousemove', handleActivity);
    
    // Initial hide timer
    timeout = setTimeout(() => {
      setIsNavVisible(false);
    }, 12000);

    return () => {
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.pageYOffset > 500);
      const sections = ['hero', 'about', 'cinematography', 'photography'];
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 400 && rect.bottom >= 400) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: id === 'hero' ? 0 : offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const sections = [
    { id: 'hero', label: labels?.['home'] || (language === 'en' ? 'Home' : '首页') },
    { id: 'about', label: labels?.['about'] || (language === 'en' ? 'About' : '关于') },
    { id: 'cinematography', label: labels?.['films'] || (language === 'en' ? 'Films' : '影像') },
    { id: 'photography', label: labels?.['stills'] || (language === 'en' ? 'Stills' : '摄影') },
    { id: 'contact', label: language === 'en' ? 'Contact' : '联系' },
  ];

  return (
    <>
      {/* Desktop/Mobile Sidebar Nav */}
      <div className={cn(
        "fixed right-8 md:right-12 top-1/2 -translate-y-1/2 z-[9999] hidden md:flex flex-col items-center gap-10 transition-all duration-1000 ease-in-out",
        !isNavVisible ? "translate-x-48 opacity-0" : "translate-x-0 opacity-100"
      )}>
        <div className="flex flex-col gap-8 mix-blend-difference">
          {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="group relative flex items-center justify-center p-2"
          >
            <span className={cn(
              "w-4 h-4 rounded-full transition-all duration-500 bg-white border border-black/10 shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
              activeSection === section.id 
                ? "scale-[1.8] shadow-[0_0_20px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.8)]" 
                : "scale-100 opacity-60 group-hover:opacity-100 group-hover:scale-125"
            )} />
            <span className={cn(
              "absolute right-full mr-10 text-[10px] uppercase tracking-[0.4em] transition-all duration-500 whitespace-nowrap text-white font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
              activeSection === section.id ? "opacity-100 translate-x-0" : "opacity-0 group-hover:opacity-100 translate-x-0"
            )}>
              {section.label}
            </span>
          </button>
        ))}
      </div>
      
      <div className="w-[1.5px] h-12 bg-white opacity-40 mix-blend-difference rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-12 h-12 flex items-center justify-center rounded-full text-white transition-all font-black mix-blend-difference hover:scale-110 active:scale-95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
        title="Back to Top"
      >
        <ChevronUp size={28} strokeWidth={3} />
      </button>
    </div>
    </>
  );
}

function HomePage() {
  const { t, settings } = useLanguage();

  return (
    <>
      <Hero />
      
      <section id="about" className="py-24 px-6 md:px-12 bg-bg-paper">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <img 
              src={settings.aboutImageUrl || undefined} 
              alt="Artist Portrait"
              className="w-full aspect-[4/5] object-cover grayscale hover:grayscale-0 transition-all duration-1000"
              fetchPriority="high"
              referrerPolicy={getReferrerPolicy(settings.aboutImageUrl)}
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40 mb-6 block">{t.about.label}</span>
            <h2 className="text-4xl md:text-5xl font-serif mb-8 leading-tight">
              {settings.aboutTitle || t.about.title}
            </h2>
            <p className="text-ink/60 leading-relaxed mb-8 max-w-lg">
              {settings.aboutDesc || t.about.desc}
            </p>
            <div className="flex gap-12">
              <div>
                <span className="text-2xl font-serif block mb-1">{settings.aboutYears}</span>
                <span className="text-[10px] uppercase tracking-widest text-ink/40">{t.about.years}</span>
              </div>
              <div>
                <span className="text-2xl font-serif block mb-1">{settings.aboutProjects}</span>
                <span className="text-[10px] uppercase tracking-widest text-ink/40">{t.about.projects}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <VideoSection />
      <PhotoGallery />
    </>
  );
}

function AppContent() {
  const { loading } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-paper">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-ink/10 border-t-ink rounded-full animate-spin" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40">0848 Studio</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-paper selection:bg-ink selection:text-bg-paper relative">
      <ScrollToTop />
      <CustomCursor />
      <Navbar />
      <SidebarNav />
      
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={
            <Suspense fallback={<LoadingFallback />}>
              <Admin />
            </Suspense>
          } />
          <Route path="/gallery/:category" element={<GalleryPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppContent />
      </Router>
    </LanguageProvider>
  );
}



