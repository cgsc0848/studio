import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

  const categories = useMemo(() => {
    if (activeType === 'photos') {
      return ['All', ...(settings.photoCategories || [])];
    }
    return ['All', ...(settings.videoCategories || [])];
  }, [activeType, settings.photoCategories, settings.videoCategories]);

  const filteredItems = useMemo(() => {
    if (activeType === 'photos') {
      return activeCategory.toLowerCase() === 'all' ? photos : photos.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
    }
    return activeCategory.toLowerCase() === 'all' ? videos : videos.filter(v => v.category.toLowerCase() === activeCategory.toLowerCase());
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

  useEffect(() => {
    if (selectedPhoto) {
      const img = new Image();
      img.src = selectedPhoto.url;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          canvas.width = 1;
          canvas.height = 1;
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          setModalBgColor(`rgba(${r}, ${g}, ${b}, 0.98)`);
        } catch (e) {
          setModalBgColor('rgba(26, 26, 26, 0.95)');
        }
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
      const ytIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i);
      const id = ytIdMatch?.[1] || '';
      if (id) {
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
      }
    }
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      let bvid = '';
      const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
      if (bvMatch) bvid = bvMatch[0];
      if (bvid) return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&as_wide=1&allowfullscreen=true&autoplay=0&danmaku=0`;
    }
    if (url.includes('xinpianchang.com')) {
      if (url.includes('player.xinpianchang.com')) {
        return url.replace(/&amp;/g, '&');
      }
      const match = url.match(/a(\d+)/);
      if (match) return `https://www.xinpianchang.com/player/v1/a${match[1]}`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop()?.split('?')[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1`;
    }
    return url;
  };

  const getSafeThumbnail = (thumbnail: string, videoUrl: string) => {
    if (!thumbnail || !videoUrl) return thumbnail;
    
    // Ensure https for any thumbnail
    let safeThumb = thumbnail.replace('http://', 'https://');

    // Check for YouTube specifically
    if (safeThumb.includes('youtube.com') || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      let url = videoUrl;
      if (url.includes('<iframe')) {
        const match = url.match(/src="([^"]+)"/);
        if (match) url = match[1];
      }
      
      const ytIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i);
      const id = ytIdMatch?.[1];
      if (id && id.length === 11) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    
    return safeThumb;
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

  const getCategoryLabel = (cat: string) => {
    const key = cat.toLowerCase();
    if (settings?.categoryLabels?.[key]) return settings.categoryLabels[key];
    
    // Check specific categories for translations
    if (activeType === 'photos') {
      return (t.photography.categories as any)[key] || cat;
    }
    return (t.cinematography.categories as any)[key] || cat;
  };

  const categoryCounts = useMemo(() => {
    const items = activeType === 'photos' ? photos : videos;
    const counts: Record<string, number> = { all: items.length };
    items.forEach(item => {
      const cat = (item.category || '').toLowerCase();
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activeType, photos, videos]);

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
                    activeCategory.toLowerCase() === cat.toLowerCase() ? "text-ink border-ink" : "text-ink/40 border-transparent hover:text-ink"
                  )}
                >
                  {getCategoryLabel(cat)} <span className="opacity-40 text-[9px] ml-0.5">({cat.toLowerCase() === 'all' ? categoryCounts.all : (categoryCounts[cat.toLowerCase()] || 0)})</span>
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
                <p className="text-[10px] uppercase tracking-widest text-ink/40">{getCategoryLabel(item.category)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Photo Modal (Portaled for precision centering) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedPhoto && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-8 transition-colors duration-700"
              style={{ 
                backgroundColor: modalBgColor,
                height: '100dvh'
              }}
            >
              <div className="absolute inset-0 cursor-zoom-out" onClick={() => setSelectedPhoto(null)} />
              
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 md:top-8 md:right-8 text-white/40 hover:text-white transition-colors z-[10005] bg-black/20 p-2 rounded-full backdrop-blur-md"
              >
                <X size={28} />
              </button>

              {filteredItems.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('prev'); }}
                    className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-2 md:p-4 text-white/40 hover:text-white transition-colors z-[10005] bg-black/10 hover:bg-black/20 rounded-full"
                  >
                    <ChevronLeft size={40} className="md:w-12 md:h-12" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigatePhoto('next'); }}
                    className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-2 md:p-4 text-white/40 hover:text-white transition-colors z-[10005] bg-black/10 hover:bg-black/20 rounded-full"
                  >
                    <ChevronRight size={40} className="md:w-12 md:h-12" />
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
              >
                <img 
                  src={selectedPhoto.url} 
                  alt={selectedPhoto.title}
                  className="max-w-full max-h-[70dvh] md:max-h-[85dvh] object-contain shadow-[0_20px_50px_rgba(0,0,0,0.5)] select-none block mx-auto"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-8 text-center text-white">
                  <h3 className="text-lg font-medium tracking-tight">{selectedPhoto.title}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{selectedPhoto.category}</p>
                  <p className="text-[10px] text-white/20 mt-1">{photoIndex + 1} / {filteredItems.length}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Video Modal - Theater Mode (Portaled for precision centering) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedVideo && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/98 p-4 md:p-8 overflow-hidden"
              style={{ height: '100dvh' }}
            >
              {/* Background Backdrop Blur */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" onClick={() => setSelectedVideo(null)} />
              
              <div className="relative w-full max-w-[1600px] h-full max-h-[90dvh] flex flex-col lg:flex-row gap-8 z-[10000]">
                {/* Main Player Area */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] uppercase tracking-widest text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        {selectedVideo.category}
                      </span>
                      <h3 className="text-xl font-serif text-white truncate max-w-md">{selectedVideo.title}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedVideo(null)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all border border-white/10"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <motion.div 
                     key={selectedVideo.id}
                     initial={{ scale: 0.98, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ duration: 0.4 }}
                     className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 relative"
                  >
                    {selectedVideo.videoUrl && (
                      selectedVideo.videoUrl.includes('youtube.com') || 
                      selectedVideo.videoUrl.includes('youtu.be') || 
                      selectedVideo.videoUrl.includes('bilibili.com') || 
                      selectedVideo.videoUrl.includes('vimeo.com') ||
                      selectedVideo.videoUrl.includes('xinpianchang.com')
                    ) ? (
                      <div className="w-full h-full">
                        <iframe 
                          src={getEmbedUrl(selectedVideo.videoUrl) || undefined}
                          className="w-full h-full border-0"
                          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; compute-pressure"
                          title={selectedVideo.title}
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
                  </motion.div>
                  
                  <div className="mt-6 p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl hidden lg:block overflow-y-auto max-h-[120px] custom-scrollbar">
                    <p className="text-white/60 text-sm leading-relaxed">{selectedVideo.description}</p>
                  </div>
                </div>

                {/* Sidebar: All Videos */}
                <aside className="w-full lg:w-80 h-full flex flex-col bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h4 className="text-[10px] uppercase tracking-[0.3em] font-medium text-white/60">
                      {language === 'en' ? 'Category Gallery' : '分类作品'}
                    </h4>
                    <span className="text-[10px] font-mono text-white/40">{videos.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {videos.filter(v => activeCategory === 'All' || v.category === activeCategory).map((video) => (
                      <div 
                        key={video.id}
                        onClick={() => setSelectedVideo(video)}
                        className={cn(
                          "group flex gap-4 p-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10 hover:bg-white/5",
                          selectedVideo.id === video.id ? "bg-white/10 border-white/20" : ""
                        )}
                      >
                        <div className="w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0 relative">
                          <img 
                            src={getSafeThumbnail(video.thumbnail, video.videoUrl)} 
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                            referrerPolicy="no-referrer"
                          />
                          {selectedVideo.id === video.id && (
                            <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h5 className={cn(
                            "text-xs font-medium truncate transition-colors",
                            selectedVideo.id === video.id ? "text-white" : "text-white/80 group-hover:text-white"
                          )}>
                            {video.title}
                          </h5>
                          <p className="text-[9px] uppercase tracking-widest text-white/30 mt-1">{video.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
