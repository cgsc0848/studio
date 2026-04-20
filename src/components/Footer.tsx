import { motion } from 'motion/react';
import { Instagram, Twitter, Mail } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer id="contact" className="py-24 px-6 md:px-12 bg-bg-paper border-t border-ink/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-24">
          <div>
            <h2 className="text-5xl md:text-7xl font-serif mb-12 leading-tight">{t.footer.cta}</h2>
            <a href="mailto:cgsc0848@gmail.com" className="text-xl md:text-2xl font-serif border-b border-ink pb-2 hover:opacity-60 transition-opacity">
              cgsc0848@gmail.com
            </a>
          </div>
          
          <div className="flex flex-col justify-between">
            <div className="grid grid-cols-1 gap-12">
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40 mb-6 block">{t.footer.social}</span>
                <ul className="space-y-4 text-xs uppercase tracking-widest font-medium">
                  <li><a href="#" className="hover:text-ink/60 transition-colors">Instagram</a></li>
                  <li><a href="#" className="hover:text-ink/60 transition-colors">Twitter</a></li>
                  <li><a href="#" className="hover:text-ink/60 transition-colors">LinkedIn</a></li>
                </ul>
              </div>
            </div>
            
            <div className="mt-12 md:mt-0 flex items-center gap-6">
              <Instagram size={18} className="text-ink/40 hover:text-ink transition-colors cursor-pointer" />
              <Twitter size={18} className="text-ink/40 hover:text-ink transition-colors cursor-pointer" />
              <Mail size={18} className="text-ink/40 hover:text-ink transition-colors cursor-pointer" />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-ink/5 gap-6">
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40">© {new Date().getFullYear()} 0848 Studio</span>
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.3em] text-ink/40">
            <a href="#" className="hover:text-ink transition-colors">{t.footer.privacy}</a>
            <a href="#" className="hover:text-ink transition-colors">{t.footer.terms}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

