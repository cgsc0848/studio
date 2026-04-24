import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Photo } from '@/src/types';
import { useLanguage } from '../LanguageContext';
import { Link } from 'react-router-dom';
import { cn, getReferrerPolicy } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

// Custom Color Extraction Utility
const getDominantColor = (img: HTMLImageElement): [number, number, number] => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [20, 20, 20];

    // Downsample significantly for performance and privacy
    const size = 64;
    const ratio = Math.min(1, size / img.width, size / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    const colors: {r: number, g: number, b: number, count: number, score: number}[] = [];
    const colorMap: Record<string, number> = {};

    for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel for speed
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];

      if (a < 200) continue; 

      // Simple quantization
      const qr = Math.round(r / 15) * 15;
      const qg = Math.round(g / 15) * 15;
      const qb = Math.round(b / 15) * 15;
      const key = `${qr},${qg},${qb}`;

      if (colorMap[key] === undefined) {
        // Calculate "vibrancy" score: higher saturation and avoiding pure blacks/whites
        const max = Math.max(qr, qg, qb);
        const min = Math.min(qr, qg, qb);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = max / 255;
        
        // Score: favor medium brightness and high saturation
        const score = saturation * 2 + (1 - Math.abs(brightness - 0.5) * 2);
        
        colorMap[key] = colors.length;
        colors.push({ r: qr, g: qg, b: qb, count: 1, score });
      } else {
        colors[colorMap[key]].count++;
      }
    }

    if (colors.length === 0) return [20, 20, 20];

    // Sort by count * score to find the most "dominant vibrant" color
    colors.sort((a, b) => (b.count * b.score) - (a.count * a.score));
    
    const best = colors[0];
    return [best.r, best.g, best.b];
  } catch (e) {
    console.warn('Color extraction failed (CORS?):', e);
    return [20, 20, 20];
  }
};

function PhotoItem({ photo, index, onSelect, getCategoryName }: { photo: Photo, index: number, onSelect: (p: Photo) => void, getCategoryName: (c: string) => string, key?: any }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: index * 0.1 }}
      className="relative group cursor-none"
    >
      <div className="mb-4">
        <span className="text-[9px] uppercase tracking-[0.2em] text-accent font-medium">{getCategoryName(photo.category)}</span>
      </div>
      <div 
        className="overflow-hidden bg-ink/5 relative aspect-[4/5] cursor-zoom-in"
        onClick={() => onSelect(photo)}
      >
        <AnimatePresence>
          {!isLoaded && !error && (
            <motion.div 
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-ink/[0.02] animate-pulse"
            >
              <div className="w-4 h-4 rounded-full border border-ink/10 border-t-ink/40 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Transparent overlay to prevent right-click/drag on the image itself */}
        <div 
          className="absolute inset-0 z-10" 
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
        <img
          src={photo.url || undefined}
          alt={photo.title}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "w-full h-full object-cover transition-all duration-1000 group-hover:scale-105 select-none",
            isLoaded ? "opacity-100 filter-none" : "opacity-30 blur-lg"
          )}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          referrerPolicy={getReferrerPolicy(photo.url)}
        />
      </div>
      <div className="mt-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div>
          <h3 className="text-sm font-medium tracking-tight">{photo.title}</h3>
        </div>
        <span className="text-[10px] text-ink/40 italic">0{index + 1}</span>
      </div>
    </motion.div>
  );
}

// Simple context-like provider for selected photo state if needed, but for simplicity we keep it in the main component
// and pass down or use a simple shared state if componentized. Here I will just refactor the main loop.

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [modalBgColor, setModalBgColor] = useState('rgba(11, 11, 11, 0.95)');
  const { t, settings, language } = useLanguage();

  const photoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return photos.findIndex(item => item.id === selectedPhoto.id);
  }, [selectedPhoto, photos]);

  const navigatePhoto = useCallback((direction: 'next' | 'prev') => {
    if (photoIndex === -1) return;
    let nextIndex = direction === 'next' ? photoIndex + 1 : photoIndex - 1;
    if (nextIndex < 0) nextIndex = photos.length - 1;
    if (nextIndex >= photos.length) nextIndex = 0;
    setSelectedPhoto(photos[nextIndex]);
  }, [photoIndex, photos]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: photos.length };
    photos.forEach(p => {
      const cat = (p.category || '').toLowerCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [photos]);

  const getCategoryName = (cat: string) => {
    if (cat.toLowerCase() === 'all') return language === 'en' ? 'All' : '全部';
    const key = cat.toLowerCase();
    if (settings?.categoryLabels?.[key]) return settings.categoryLabels[key];
    const trans = (t.photography.categories as any)[key];
    return trans || cat;
  };

  useEffect(() => {
    if (selectedPhoto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedPhoto]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhoto) {
        if (e.key === 'ArrowRight') navigatePhoto('next');
        if (e.key === 'ArrowLeft') navigatePhoto('prev');
        if (e.key === 'Escape') setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, navigatePhoto]);

  useEffect(() => {
    if (selectedPhoto) {
      const img = new Image();
      img.crossOrigin = 'anonymous'; 
      const url = selectedPhoto.url;
      // Do NOT append v=timestamp here to avoid breaking Aliyun OSS Signed URLs
      img.src = url;
      
      img.onload = () => {
        const color = getDominantColor(img);
        const boost = (val: number, factor = 1.1) => Math.min(255, Math.round(val * factor));
        const r = boost(color[0]);
        const g = boost(color[1]);
        const b = boost(color[2]);
        setModalBgColor(`rgba(${r}, ${g}, ${b}, 0.7)`);
      };
      img.onerror = () => {
        // Fallback for CORS or missing images
        setModalBgColor('rgba(20, 20, 20, 0.4)');
      };
    }
  }, [selectedPhoto]);

  useEffect(() => {
    const q = query(
      collection(db, 'photos'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photoData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Photo));
      
      photoData.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        const weightA = a.orderWeight || 0;
        const weightB = b.orderWeight || 0;
        if (weightA !== weightB) return weightB - weightA;

        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setPhotos(photoData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'photos');
      setPhotos([]);
    });

    return () => unsubscribe();
  }, []);

  const getLayoutClass = () => {
    switch(settings.photoLayout || settings.galleryLayout) {
      case 'grid': return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';
      case 'editorial': return 'flex flex-col gap-24';
      case 'masonry': 
      default: return 'columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8';
    }
  };

  return (
    <section id="photography" className="py-24 px-6 md:px-12 bg-bg-paper">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[80px_1fr] gap-12">
        <div className="hidden md:flex flex-col justify-end">
          <span className="writing-vertical-rl rotate-180 text-[10px] uppercase tracking-[4px] opacity-40 pb-5">{t.photography.verticalLabel} {new Date().getFullYear()}</span>
        </div>

        <div>
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-md">
              <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40 mb-4 block">{t.photography.label}</span>
              <h2 className="text-4xl md:text-5xl font-serif leading-tight">{settings.photoTitle || t.photography.title}</h2>
              {settings.photoSubtitle && (
                <p className="text-ink/60 text-sm mt-4 leading-relaxed italic">
                  {settings.photoSubtitle}
                </p>
              )}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] font-medium text-ink/60 flex flex-wrap justify-end gap-x-8 gap-y-4">
              <Link to="/gallery/All" className="text-ink border-b border-ink pb-1">
                {getCategoryName('All')} <span className="opacity-40 text-[10px] ml-1">({categoryCounts.all || 0})</span>
              </Link>
              {(settings.photoCategories || []).map(cat => (
                <Link 
                  key={cat}
                  to={`/gallery/${cat}`} 
                  className="hover:text-ink transition-colors pb-1 border-b border-transparent"
                >
                  {getCategoryName(cat)} <span className="opacity-40 text-[10px] ml-1">({categoryCounts[cat.toLowerCase()] || 0})</span>
                </Link>
              ))}
            </div>
          </div>

          <div className={getLayoutClass()}>
            {photos.slice(0, 6).map((photo, index) => (
              <PhotoItem key={photo.id} photo={photo} index={index} onSelect={setSelectedPhoto} getCategoryName={getCategoryName} />
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/gallery/All" className="inline-block text-xs uppercase tracking-[0.3em] border border-ink/20 px-8 py-4 hover:bg-ink hover:text-bg-paper transition-all">
              {language === 'en' ? 'View All Works' : '查看全部作品'}
            </Link>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal (Portaled for precision centering) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedPhoto && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-8 overflow-hidden" style={{ height: '100dvh' }}>
              {/* Blurred Image Background (Vibrant Layer) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-0 overflow-hidden"
              >
                <div 
                  className="absolute inset-[-15%] bg-cover bg-center blur-[120px] scale-110 opacity-50 transition-all duration-1000"
                  style={{ backgroundImage: `url(${selectedPhoto.url})` }}
                />
              </motion.div>

              {/* Tint Surface Layer with Backdrop Blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[1] backdrop-blur-2xl transition-colors duration-1000"
                style={{ backgroundColor: modalBgColor }}
                onClick={() => setSelectedPhoto(null)}
              />
              
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 md:top-8 md:right-8 text-white/40 hover:text-white transition-colors z-[10005] bg-black/20 p-2 rounded-full backdrop-blur-md"
              >
                <X size={28} />
              </button>

              {photos.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('prev'); }}
                    className="absolute left-8 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white transition-colors z-[10005] bg-black/10 hover:bg-black/20 rounded-full"
                  >
                    <ChevronLeft size={48} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('next'); }}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white transition-colors z-[10005] bg-black/10 hover:bg-black/20 rounded-full"
                  >
                    <ChevronRight size={48} />
                  </button>
                </>
              )}

              <motion.div 
                key={selectedPhoto.id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative max-w-[98vw] max-h-[92dvh] w-fit flex flex-col items-center justify-center z-[10000] mx-auto"
                onClick={(e) => e.stopPropagation()}
                style={{ filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.4))' }}
              >
                <img 
                  src={selectedPhoto.url || undefined} 
                  alt={selectedPhoto.title}
                  className="max-w-full max-h-[70dvh] md:max-h-[85dvh] object-contain select-none block mx-auto rounded-sm border border-white/5"
                  referrerPolicy={getReferrerPolicy(selectedPhoto.url)}
                />
                <div className="mt-8 text-center text-white">
                  <h3 className="text-lg font-medium tracking-tight">{selectedPhoto.title}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/60 mt-1">{selectedPhoto.category}</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}


