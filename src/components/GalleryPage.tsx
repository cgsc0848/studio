import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Photo, Video } from '@/src/types';
import { useLanguage } from '../LanguageContext';
import { ArrowLeft, Play, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function GalleryPage() {
  const { category: initialCategory } = useParams<{ category: string }>();
  const [activeType, setActiveType] = useState<'photos' | 'videos'>('photos');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [modalBgColor, setModalBgColor] = useState('rgba(26, 26, 26, 0.95)');
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'All');
  const { t, language, settings } = useLanguage();

  const getLayoutClass = () => {
    if (activeType === 'videos') return 'grid grid-cols-1 md:grid-cols-2 gap-8';
    
    switch(settings.galleryLayout) {
      case 'grid': return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';
      case 'editorial': return 'flex flex-col gap-24';
      case 'masonry': 
      default: return 'columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8 block';
    }
  };

  const filteredItems = useMemo(() => {
    if (activeType === 'photos') {
      return activeCategory === 'All' ? photos : photos.filter(p => p.category === activeCategory);
    }
    return activeCategory === 'All' ? videos : videos.filter(v => v.category === activeCategory);
  }, [activeType, activeCategory, photos, videos]);

  const photoIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return filteredItems.findIndex(item => item.id === selectedPhoto.id);
  }, [selectedPhoto, filteredItems]);

  const navigatePhoto = useCallback((direction: 'next' | 'prev') => {
    if (photoIndex === -1) return;
    let nextIndex = direction === 'next' ? photoIndex + 1 : photoIndex - 1;
    if (nextIndex < 0) nextIndex = filteredItems.length - 1;
    if (nextIndex >= filteredItems.length) nextIndex = 0;
    setSelectedPhoto(filteredItems[nextIndex] as Photo);
  }, [photoIndex, filteredItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhoto) {
        if (e.key === 'ArrowRight') navigatePhoto('next');
        if (e.key === 'ArrowLeft') navigatePhoto('prev');
        if (e.key === 'Escape') setSelectedPhoto(null);
      }
      if (selectedVideo && e.key === 'Escape') setSelectedVideo(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, selectedVideo, navigatePhoto]);

  useEffect(() => {
    if (selectedPhoto || selectedVideo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedPhoto, selectedVideo]);

  // Extract color when photo changes
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
        // Darken the color for better text contrast if needed, or keep it as is
        setModalBgColor(`rgba(${r}, ${g}, ${b}, 0.98)`);
      };
      img.onerror = () => setModalBgColor('rgba(26, 26, 26, 0.95)');
    }
  }, [selectedPhoto]);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('<iframe')) {
      const match = url.match(/src="([^"]+)"/);
      if (match) url = match[1];
    }
    if (url.startsWith('//')) url = 'https:' + url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = '';
      if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      else if (url.includes('shorts/')) id = url.split('shorts/')[1].split('?')[0];
      else id = url.split('/').pop()?.split('?')[0] || '';
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    }
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      if (url.includes('player.bilibili.com')) {
        if (!url.includes('high_quality')) url += '&high_quality=1';
        if (!url.includes('as_wide')) url += '&as_wide=1';
        return url;
      }
      let bvid = '';
      const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
      if (bvMatch) bvid = bvMatch[0];
      if (bvid) return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&as_wide=1&allowfullscreen=true&autoplay=1&danmaku=0`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop()?.split('?')[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return url;
  };

  useEffect(() => {
    const qPhotos = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
    const unsubscribePhotos = onSnapshot(qPhotos, (snapshot) => {
      setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'photos'));

    const qVideos = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribeVideos = onSnapshot(qVideos, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'videos'));

    return () => {
      unsubscribePhotos();
      unsubscribeVideos();
    };
  }, []);

  const categories = activeType === 'photos' 
    ? ['All', 'Editorial', 'Personal', 'Commercial']
    : ['All', 'Cinematic', 'Commercial', 'Personal', 'Editorial'];

  return (
    <div className="min-h-screen bg-bg-paper pt-32 pb-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink/40 hover:text-ink transition-colors mb-12">
          <ArrowLeft size={14} />
          {language === 'en' ? 'Back to Home' : '返回首页'}
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-ink/40 mb-4 block">
              {language === 'en' ? 'Portfolio' : '作品集'}
            </span>
            <h1 className="text-5xl md:text-7xl font-serif">
              {activeType === 'photos' ? (language === 'en' ? 'Stills' : '摄影') : (language === 'en' ? 'Films' : '影片')}
            </h1>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex bg-ink/5 p-1 rounded-full">
              <button 
                onClick={() => { setActiveType('photos'); setActiveCategory('All'); }}
                className={cn(
                  "px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all",
                  activeType === 'photos' ? "bg-ink text-white" : "text-ink/40 hover:text-ink"
                )}
              >
                {language === 'en' ? 'Stills' : '摄影'}
              </button>
              <button 
                onClick={() => { setActiveType('videos'); setActiveCategory('All'); }}
                className={cn(
                  "px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all",
                  activeType === 'videos' ? "bg-ink text-white" : "text-ink/40 hover:text-ink"
                )}
              >
                {language === 'en' ? 'Films' : '影片'}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "text-[10px] uppercase tracking-widest pb-1 border-b transition-all",
                    activeCategory === cat ? "text-ink border-ink" : "text-ink/40 border-transparent hover:text-ink"
                  )}
                >
                  {cat === 'All' ? (language === 'en' ? 'All' : '全部') : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={getLayoutClass()}>
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.05 }}
              className="relative group cursor-pointer"
              onClick={() => {
                if ('videoUrl' in item) {
                  setSelectedVideo(item as Video);
                } else {
                  setSelectedPhoto(item as Photo);
                }
              }}
            >
              <div className="overflow-hidden bg-ink/5 relative">
                <div 
                  className="absolute inset-0 z-10" 
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
                <img
                  src={('url' in item ? item.url : item.thumbnail) || undefined}
                  alt={item.title}
                  loading="lazy"
                  className={cn(
                    "w-full object-cover transition-transform duration-1000 group-hover:scale-105 select-none",
                    activeType === 'photos' ? "h-auto" : "aspect-video"
                  )}
                  referrerPolicy="no-referrer"
                />
                {'videoUrl' in item && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={20} className="text-ink fill-ink ml-1" />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium tracking-tight">{item.title}</h3>
                <p className="text-[10px] uppercase tracking-widest text-ink/40">{item.category}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-2 md:p-8 transition-colors duration-700"
            style={{ 
              backgroundColor: modalBgColor,
              height: '100dvh'
            }}
          >
            <div className="absolute inset-0 cursor-zoom-out" onClick={() => setSelectedPhoto(null)} />
            
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 md:top-8 md:right-8 text-white/40 hover:text-white transition-colors z-[2010] bg-black/20 p-2 rounded-full backdrop-blur-md"
            >
              <X size={28} />
            </button>

            {filteredItems.length > 1 && (
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative max-w-[98vw] max-h-[92dvh] w-fit flex flex-col items-center justify-center z-[2005]"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedPhoto.url} 
                alt={selectedPhoto.title}
                className="max-w-full max-h-[70dvh] md:max-h-[85dvh] object-contain shadow-[0_20px_50px_rgba(0,0,0,0.5)] select-none"
                referrerPolicy="no-referrer"
              />
              <div className="mt-8 text-center text-white">
                <h3 className="text-lg font-medium tracking-tight">{selectedPhoto.title}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/60 mt-2">{selectedPhoto.category}</p>
                <p className="text-[10px] text-white/20 mt-1">{photoIndex + 1} / {filteredItems.length}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/98 p-2 md:p-8"
            style={{ height: '100dvh' }}
          >
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 md:top-8 md:right-8 text-white/60 hover:text-white transition-colors z-[2010] bg-black/20 p-2 rounded-full backdrop-blur-md"
            >
              <X size={28} />
            </button>
            <motion.div 
              key={selectedVideo.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-6xl h-fit max-h-[85dvh] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative flex items-center justify-center z-[2005]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/5">
                {selectedVideo.videoUrl && (selectedVideo.videoUrl.includes('youtube.com') || selectedVideo.videoUrl.includes('youtu.be') || selectedVideo.videoUrl.includes('bilibili.com') || selectedVideo.videoUrl.includes('vimeo.com')) ? (
                  <div className="w-full h-full">
                    <iframe 
                      src={getEmbedUrl(selectedVideo.videoUrl) || undefined}
                      className="w-full h-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                      sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts allow-popups allow-presentation allow-fullscreen"
                    />
                  </div>
                ) : selectedVideo.videoUrl ? (
                  <video 
                    src={selectedVideo.videoUrl || undefined} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20 text-xs uppercase tracking-widest">
                    {language === 'en' ? 'No video URL provided' : '未提供视频链接'}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-16 left-0 right-0 text-center pointer-events-none">
                <h3 className="text-lg font-medium tracking-tight text-white">{selectedVideo.title}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/60 mt-1">{selectedVideo.category}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
