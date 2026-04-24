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
  const { settings, language } = useLanguage();
  const labels = language === 'en' ? settings.navLabels_en : settings.navLabels_zh;

  useEffect(() => {
    const handleScroll = () => {
      // Toggle visibility
      setIsVisible(window.pageYOffset > 500);

      // detect active section
      const sections = ['hero', 'about', 'cinematography', 'photography'];
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [isNavVisible, setIsNavVisible] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsNavVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsNavVisible(false);
      }, 3000); // 3秒无操作后隐藏
    };

    const handleMouseMove = () => {
      setIsNavVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsNavVisible(false);
      }, 3000);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    // 初始化计时器
    timeout = setTimeout(() => {
      setIsNavVisible(false);
    }, 3000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const sections = [
    { id: 'hero', label: labels?.['home'] || (language === 'en' ? 'Home' : '首页') },
    { id: 'about', label: labels?.['about'] || (language === 'en' ? 'About' : '关于') },
    { id: 'cinematography', label: labels?.['films'] || (language === 'en' ? 'Films' : '影像') },
    { id: 'photography', label: labels?.['stills'] || (language === 'en' ? 'Stills' : '摄影') },
    { id: 'contact', label: language === 'en' ? 'Contact' : '联系' },
  ];

  return (
    <>
      {/* Mobile Back to Top */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-10 right-6 z-40 md:hidden bg-bg-paper border border-ink/10 p-3 rounded-full shadow-lg text-ink"
      >
        <ChevronUp size={20} />
      </motion.button>

      {/* Desktop Sidebar Nav */}
      <div className={cn(
        "fixed right-6 md:right-12 top-1/2 -translate-y-1/2 z-[100] hidden md:flex flex-col items-center gap-10 transition-all duration-700",
        (document.body.style.overflow === 'hidden' || !isNavVisible) ? "opacity-0 translate-x-4 pointer-events-none" : "opacity-100 translate-x-0"
      )}>
        <div className="flex flex-col gap-8 mix-blend-difference">
          {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="group relative flex items-center justify-center p-2"
          >
            <span className={cn(
              "w-2 h-2 rounded-full transition-all duration-500 bg-white",
              activeSection === section.id 
                ? "scale-[2.8]" 
                : "opacity-40 group-hover:opacity-100 scale-125"
            )} />
            <span className="absolute right-full mr-8 text-[11px] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 whitespace-nowrap text-white font-bold">
              {section.label}
            </span>
          </button>
        ))}
      </div>
      
      <div className="w-[1.5px] h-12 bg-white/30 rounded-full mix-blend-difference" />

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 10 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-white/80 transition-all mix-blend-difference"
        title="Back to Top"
      >
        <ChevronUp size={24} />
      </motion.button>
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
    <div className="min-h-screen selection:bg-ink selection:text-bg-paper">
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



