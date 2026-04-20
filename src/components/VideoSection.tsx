import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
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
      
      // If no videos in DB, provide sample data
      if (videoData.length === 0) {
        const samples: Video[] = [
          { id: 'v1', title: 'Urban Rhythms', category: 'Cinematic', thumbnail: 'https://picsum.photos/seed/v1/800/450', videoUrl: 'https://vimeo.com/22439234', description: 'Exploring the pulse of the city.', createdAt: new Date().toISOString() },
          { id: 'v2', title: 'The Silent Muse', category: 'Editorial', thumbnail: 'https://picsum.photos/seed/v2/800/450', videoUrl: 'https://vimeo.com/76979871', description: 'A study in stillness and light.', createdAt: new Date().toISOString() },
          { id: 'v3', title: 'Modern Commerce', category: 'Commercial', thumbnail: 'https://picsum.photos/seed/v3/800/450', videoUrl: 'https://vimeo.com/22439234', description: 'Visual energy for the modern brand.', createdAt: new Date().toISOString() },
          { id: 'v4', title: 'Personal Diary', category: 'Personal', thumbnail: 'https://picsum.photos/seed/v4/800/450', videoUrl: 'https://vimeo.com/76979871', description: 'Quiet moments captured on film.', createdAt: new Date().toISOString() },
        ];
        setAllVideos(samples);
      } else {
        setAllVideos(videoData);
      }
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
      let id = '';
      if (url.includes('v=')) {
        id = url.split('v=')[1].split('&')[0];
      } else if (url.includes('shorts/')) {
        id = url.split('shorts/')[1].split('?')[0];
      } else {
        id = url.split('/').pop()?.split('?')[0] || '';
      }
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    // Bilibili
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      // If it's already a player URL, preserve its params but ensure it's https
      if (url.includes('player.bilibili.com')) {
        let finalUrl = url.startsWith('//') ? 'https:' + url : url;
        if (!finalUrl.includes('high_quality')) finalUrl += '&high_quality=1';
        if (!finalUrl.includes('as_wide')) finalUrl += '&as_wide=1';
        return finalUrl;
      }

      let bvid = '';
      const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
      if (bvMatch) {
        bvid = bvMatch[0];
      }
      
      if (bvid) {
        return `https://player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&as_wide=1&allowfullscreen=true&autoplay=1&danmaku=0`;
      }
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop()?.split('?')[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    
    return url;
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
                      src={video.thumbnail || undefined} 
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

      {/* Video Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4 md:p-8"
            style={{ height: '100dvh' }}
          >
            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>
            <div className="w-full max-w-6xl max-h-[75dvh] aspect-video bg-black shadow-2xl relative overflow-hidden flex items-center justify-center">
              {selectedVideo.videoUrl && (selectedVideo.videoUrl.includes('youtube.com') || selectedVideo.videoUrl.includes('youtu.be') || selectedVideo.videoUrl.includes('bilibili.com') || selectedVideo.videoUrl.includes('vimeo.com')) ? (
                <iframe 
                  src={getEmbedUrl(selectedVideo.videoUrl) || undefined}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  referrerPolicy={selectedVideo.videoUrl.includes('bilibili.com') ? "no-referrer" : "no-referrer-when-downgrade"}
                  sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts allow-popups allow-presentation allow-fullscreen"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

