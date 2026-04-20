import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import PhotoGallery from './components/PhotoGallery';
import VideoSection from './components/VideoSection';
import Footer from './components/Footer';
import CustomCursor from './components/CustomCursor';
import GalleryPage from './components/GalleryPage';
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

function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0 }}
      onClick={scrollToTop}
      className="fixed bottom-12 right-12 z-40 bg-white border border-ink/5 p-4 rounded-full shadow-xl text-ink hover:bg-ink hover:text-white transition-all cursor-pointer"
    >
      <ChevronUp size={20} />
    </motion.button>
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
      <BackToTop />
      
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



