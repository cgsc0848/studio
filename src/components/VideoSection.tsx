import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Video, Category } from '@/src/types';
import { Play, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '../LanguageContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function VideoSection() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Video));
      setAllVideos(videoData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
      setAllVideos([]);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedVideo]);

  const CATEGORIES: Category[] = ['All', 'Editorial', 'Cinematic', 'Commercial', 'Personal'];

  const filteredVideos = activeCategory === 'All' 
    ? allVideos 
    : allVideos.filter(v => v.category === activeCategory);

  const getCategoryDesc = (cat: Category) => {
    switch(cat) {
      case 'Cinematic': return t.cinematography.desc.cinematic;
      case 'Commercial': return t.cinematography.desc.commercial;
      case 'Personal': return t.cinematography.desc.personal;
      case 'Editorial': return t.cinematography.desc.editorial;
      default: return '';
    }
  };

  const getCategoryName = (cat: Category) => {
    switch(cat) {
      case 'All': return t.cinematography.categories.all;
      case 'Cinematic': return t.cinematography.categories.cinematic;
      case 'Commercial': return t.cinematography.categories.commercial;
      case 'Personal': return t.cinematography.categories.personal;
      case 'Editorial': return t.cinematography.categories.editorial;
      default: return cat;
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // Extract src if an iframe tag is pasted
    if (url.includes('<iframe')) {
      const match = url.match(/src="([^"]+)"/);
      if (match) url = match[1];
    }

    // Ensure protocol
    if (url.startsWith('//')) url = 'https:' + url;
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const ytIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      const id = ytIdMatch?.[1] || '';
      if (id) {
        return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
      }
    }
    
    // Bilibili
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      let bvid = '';
      const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
      if (bvMatch) {
        bvid = bvMatch[0];
      }
      
      if (bvid) {
        // Updated Bilibili embed URL parameters to prevent common playback errors
        return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&as_wide=1&allowfullscreen=true&autoplay=0&danmaku=0&autoplay=0`;
      }
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop()?.split('?')[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1`;
    }
    
    return url;
  };

  const getSafeThumbnail = (thumbnail: string, videoUrl: string) => {
    if (!thumbnail || !videoUrl) return thumbnail;
    if (thumbnail.includes('img.youtube.com/vi/iframe') || thumbnail.includes('maxresdefault.jpg')) {
       const ytIdMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
       const id = ytIdMatch?.[1];
       if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    return thumbnail;
  };

  return (
    <section id="cinematography" className="py-24 px-6 md:px-12 bg-ink text-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-16 md:gap-24">
          <div>
            <div className="mb-16">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-4 block">{t.cinematography.label}</span>
              <h2 className="text-4xl md:text-6xl font-serif mb-8">{t.cinematography.title}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <AnimatePresence mode="popLayout">
                {filteredVideos.map((video) => (
                  <motion.div
                    key={video.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.6 }}
                    className="group relative aspect-video overflow-hidden bg-white/5 cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="mb-4 absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-white bg-accent px-2 py-1 font-medium">{getCategoryName(video.category)}</span>
                    </div>
                    <div 
                      className="absolute inset-0 z-10" 
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    <img 
                      src={getSafeThumbnail(video.thumbnail, video.videoUrl) || undefined} 
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-80 select-none"
                      referrerPolicy="no-referrer"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    
                    <div className="absolute inset-0 flex flex-col justify-center items-center bg-ink/20 backdrop-blur-[2px] opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 z-20 max-md:opacity-100">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center bg-white/10 backdrop-blur-md text-white z-30 pointer-events-none"
                      >
                        <Play size={20} fill="currentColor" />
                      </motion.button>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-ink/80 to-transparent">
                      <h3 className="text-xl font-serif">{video.title}</h3>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <aside className="flex flex-col">
            <h3 className="text-[10px] uppercase tracking-[2px] mb-8 border-b border-white/10 pb-2 text-white/60">{t.cinematography.sidebarTitle}</h3>
            <ul className="space-y-10">
              {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                <li 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "cursor-pointer transition-all duration-300 group",
                    activeCategory === cat ? "opacity-100" : "opacity-40 hover:opacity-70"
                  )}
                >
                  <div className="font-serif text-2xl flex items-baseline gap-3">
                    {getCategoryName(cat)} <span className="text-[10px] font-sans opacity-50">/ 0{allVideos.filter(v => v.category === cat).length}</span>
                  </div>
                  <p className="text-xs mt-2 text-white/60 leading-relaxed max-w-[240px]">
                    {getCategoryDesc(cat)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-12 flex justify-between text-[10px] uppercase tracking-widest text-white/20">
              <span>China</span>
              <span>© {new Date().getFullYear()} 0848 Studio</span>
            </div>
          </aside>
        </div>
      </div>

      {/* Video Modal - Theater Mode (Portaled to Body for absolute centering) */}
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
                      <span className="text-[10px] uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                        {getCategoryName(selectedVideo.category)}
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
                    {selectedVideo.videoUrl && (selectedVideo.videoUrl.includes('youtube.com') || selectedVideo.videoUrl.includes('youtu.be') || selectedVideo.videoUrl.includes('bilibili.com') || selectedVideo.videoUrl.includes('vimeo.com')) ? (
                      <iframe 
                        src={getEmbedUrl(selectedVideo.videoUrl) || undefined}
                        className="w-full h-full border-0 absolute inset-0"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts allow-popups allow-presentation"
                        title={selectedVideo.title}
                      />
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
                      {language === 'en' ? 'More Highlights' : '更多精彩'}
                    </h4>
                    <span className="text-[10px] font-mono text-accent">{allVideos.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {allVideos.map((video) => (
                      <div 
                        key={video.id}
                        onClick={() => setSelectedVideo(video)}
                        className={cn(
                          "group flex gap-4 p-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10 hover:bg-white/5",
                          selectedVideo.id === video.id ? "bg-white/10 border-white/20 ring-1 ring-accent/30" : ""
                        )}
                      >
                        <div className="w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0 relative">
                          <img 
                            src={getSafeThumbnail(video.thumbnail, video.videoUrl)} 
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                            referrerPolicy="no-referrer"
                          />
                          {selectedVideo.id === video.id && (
                            <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className={cn(
                            "text-xs font-medium truncate transition-colors",
                            selectedVideo.id === video.id ? "text-accent" : "text-white/80 group-hover:text-white"
                          )}>
                            {video.title}
                          </h5>
                          <p className="text-[9px] uppercase tracking-widest text-white/30 mt-1">{getCategoryName(video.category)}</p>
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
    </section>
  );
}

