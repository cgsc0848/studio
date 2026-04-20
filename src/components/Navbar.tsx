import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '../LanguageContext';
import { Link, useLocation } from 'react-router-dom';
import { X, Menu } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleNavClick = (e: React.MouseEvent<HTMLElement>, id: string) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setIsMenuOpen(false);
      }
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLElement>) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navLinks = [
    { id: 'cinematography', label: t.nav.films },
    { id: 'photography', label: t.nav.stills },
    { id: 'about', label: t.nav.about },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 md:px-12 py-6 flex justify-between items-center",
          isScrolled || isMenuOpen ? "bg-bg-paper/80 backdrop-blur-md py-4 border-b border-ink/5" : "bg-transparent"
        )}
      >
        <Link to="/" onClick={handleLogoClick} className="flex items-baseline gap-2 relative z-50">
          <span className="text-2xl font-serif tracking-[2px] uppercase">0848</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[1.5px] font-medium text-ink/60">
          {navLinks.map(link => (
            <Link 
              key={link.id}
              to={`/#${link.id}`} 
              onClick={(e) => handleNavClick(e, link.id)}
              className="hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link to="/gallery/All" className="hover:text-ink transition-colors">{t.nav.editorial}</Link>
          
          <button 
            onClick={toggleLanguage}
            className="ml-4 px-2 py-1 border border-ink/20 rounded hover:bg-ink hover:text-bg-paper transition-all text-[9px] tracking-widest"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden text-ink relative z-50 p-2"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-bg-paper flex flex-col items-center justify-center gap-12"
          >
            <div className="flex flex-col items-center gap-8">
              {navLinks.map(link => (
                <Link 
                  key={link.id}
                  to={`/#${link.id}`} 
                  onClick={(e) => handleNavClick(e, link.id)}
                  className="text-3xl font-serif italic hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link to="/gallery/All" className="text-3xl font-serif italic hover:text-accent transition-colors">{t.nav.editorial}</Link>
            </div>

            <button 
              onClick={toggleLanguage}
              className="mt-12 px-8 py-3 border border-ink rounded-full text-[10px] uppercase tracking-[0.3em] hover:bg-ink hover:text-white transition-all"
            >
              {language === 'en' ? 'Switch to 中文' : '切换为 English'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

