import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { getReferrerPolicy, getSafeImageUrl } from '../lib/utils';

export default function Hero() {
  const { t, settings } = useLanguage();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % t.hero.quotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [t.hero.quotes.length]);

  return (
    <section className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-ink">
      <AnimatePresence>
        {(settings.heroImageUrl || settings.heroImagePath) && (
          <motion.div 
            key={settings.heroImagePath || settings.heroImageUrl}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            <img 
              src={getSafeImageUrl(settings.heroImageUrl)} 
              alt="Artistic Hero"
              className="w-full h-full object-cover"
              fetchPriority="high"
              crossOrigin="anonymous"
              referrerPolicy={getReferrerPolicy(settings.heroImageUrl)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="relative inline-block"
        >
          <div className="h-8 overflow-hidden mb-6">
            <AnimatePresence mode="wait">
              <motion.span 
                key={quoteIndex}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-[10px] uppercase tracking-[0.4em] text-white/60 block"
              >
                {t.hero.label} {new Date().getFullYear()} — {t.hero.quotes[quoteIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
          <h1 className="text-6xl md:text-8xl text-ink font-serif italic leading-[1.1] bg-bg-paper/40 backdrop-blur-xl border border-white/10 p-6 md:p-10 shadow-[20px_20px_60px_rgba(0,0,0,0.1)]">
            {settings.heroTitle || t.hero.title}<br />
            {settings.famousCars && (
              <span className="block text-2xl md:text-3xl not-italic font-sans font-light tracking-widest mt-4 opacity-80 uppercase">
                {settings.famousCars}
              </span>
            )}
            <span className="text-sm md:text-lg not-italic font-sans font-light tracking-normal mt-2 block opacity-60">
              {settings.remarks || settings.heroSubtitle || t.hero.subtitle}
            </span>
          </h1>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
      >
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/40 to-transparent" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{t.hero.scroll}</span>
      </motion.div>
    </section>
  );
}

