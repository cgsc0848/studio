import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PhotoGallery from './components/PhotoGallery';
import VideoSection from './components/VideoSection';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import GalleryPage from './components/GalleryPage';
import { cn } from './lib/utils';
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
  const { location } = window;

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

  const sections = [
    { id: 'hero', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'cinematography', label: 'Films' },
    { id: 'photography', label: 'Stills' },
  ];

  return (
    <div className="fixed right-6 md:right-12 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-8">
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="group relative flex items-center justify-center p-2"
          >
            <span className={cn(
              "w-1 h-1 rounded-full transition-all duration-500",
              activeSection === section.id ? "bg-accent scale-[3]" : "bg-ink/20 group-hover:bg-ink/40"
            )} />
            <span className="absolute right-full mr-4 text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-ink/60">
              {section.label}
            </span>
          </button>
        ))}
      </div>
      
      <div className="w-[1px] h-12 bg-ink/5" />

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 10 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="p-2 text-ink/40 hover:text-ink transition-colors"
        title="Back to Top"
      >
        <ChevronUp size={20} />
      </motion.button>
    </div>
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
              referrerPolicy="no-referrer"
              fetchPriority="high"
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



