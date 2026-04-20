import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Photo } from '@/src/types';
import { useLanguage } from '../LanguageContext';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

function PhotoItem({ photo, index, onSelect }: { photo: Photo, index: number, onSelect: (p: Photo) => void, key?: any }) {
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
        <span className="text-[9px] uppercase tracking-[0.2em] text-accent font-medium">{photo.category}</span>
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
          referrerPolicy="no-referrer"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
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
  const [modalBgColor, setModalBgColor] = useState('rgba(26, 26, 26, 0.95)');
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
      img.crossOrigin = "Anonymous";
      img.src = selectedPhoto.url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 1;
        canvas.height = 1;
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setModalBgColor(`rgba(${r}, ${g}, ${b}, 0.98)`);
      };
      img.onerror = () => setModalBgColor('rgba(26, 26, 26, 0.95)');
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
      
      // If no photos in DB, provide sample data
      if (photoData.length === 0) {
        const samples: Photo[] = [
          { id: 's1', url: 'https://picsum.photos/seed/p1/800/1000', title: 'Urban Geometry', category: 'Editorial', aspectRatio: '4/5', createdAt: new Date().toISOString() },
          { id: 's2', url: 'https://picsum.photos/seed/p2/800/1000', title: 'Light Play', category: 'Personal', aspectRatio: '4/5', createdAt: new Date().toISOString() },
          { id: 's3', url: 'https://picsum.photos/seed/p3/800/1000', title: 'Soulful Portraits', category: 'Commercial', aspectRatio: '4/5', createdAt: new Date().toISOString() },
          { id: 's4', url: 'https://picsum.photos/seed/p4/800/1000', title: 'Minimalist Void', category: 'Editorial', aspectRatio: '4/5', createdAt: new Date().toISOString() },
          { id: 's5', url: 'https://picsum.photos/seed/p5/800/1000', title: 'Grit & Grace', category: 'Personal', aspectRatio: '4/5', createdAt: new Date().toISOString() },
          { id: 's6', url: 'https://picsum.photos/seed/p6/800/1000', title: 'Modern Muse', category: 'Editorial', aspectRatio: '4/5', createdAt: new Date().toISOString() },
        ];
        setPhotos(samples);
      } else {
        setPhotos(photoData);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'photos');
      setPhotos([]);
    });

    return () => unsubscribe();
  }, []);

  const getLayoutClass = () => {
    switch(settings.galleryLayout) {
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
              <h2 className="text-4xl md:text-5xl font-serif leading-tight">{t.photography.title}</h2>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] font-medium text-ink/60 flex gap-8">
              <Link to="/gallery/All" className="text-ink border-b border-ink pb-1">{t.photography.categories.all}</Link>
              <Link to="/gallery/Editorial" className="hover:text-ink transition-colors pb-1 border-b border-transparent">{t.photography.categories.editorial}</Link>
              <Link to="/gallery/Personal" className="hover:text-ink transition-colors pb-1 border-b border-transparent">{t.photography.categories.personal}</Link>
            </div>
          </div>

          <div className={getLayoutClass()}>
            {photos.slice(0, 6).map((photo, index) => (
              <PhotoItem key={photo.id} photo={photo} index={index} onSelect={setSelectedPhoto} />
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/gallery/All" className="inline-block text-xs uppercase tracking-[0.3em] border border-ink/20 px-8 py-4 hover:bg-ink hover:text-bg-paper transition-all">
              {language === 'en' ? 'View All Works' : '查看全部作品'}
            </Link>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 transition-colors duration-700"
            style={{ backgroundColor: modalBgColor }}
          >
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => setSelectedPhoto(null)} />
            
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors z-[110]"
            >
              <X size={32} />
            </button>

            {photos.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); navigatePhoto('prev'); }}
                  className="absolute left-8 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white transition-colors z-[110] bg-black/10 hover:bg-black/20 rounded-full"
                >
                  <ChevronLeft size={48} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); navigatePhoto('next'); }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-4 text-white/40 hover:text-white transition-colors z-[110] bg-black/10 hover:bg-black/20 rounded-full"
                >
                  <ChevronRight size={48} />
                </button>
              </>
            )}

            <motion.div 
              key={selectedPhoto.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center justify-center z-[105]"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedPhoto.url || undefined} 
                alt={selectedPhoto.title}
                className="max-w-full max-h-[85vh] object-contain shadow-2xl select-none"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-16 left-0 right-0 text-center">
                <h3 className="text-lg font-medium tracking-tight text-white">{selectedPhoto.title}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/60 mt-2">{selectedPhoto.category}</p>
                <p className="text-[10px] text-white/20 mt-1">{photoIndex + 1} / {photos.length}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


