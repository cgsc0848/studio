import React, { useState, useEffect } from 'react';
import { Photo, Video } from '@/src/types';
import { useLanguage } from '../LanguageContext';
import { auth, db, storage, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { LogOut, Plus, Trash2, Save, Image as ImageIcon, Video as VideoIcon, Settings as SettingsIcon, Layout, Type, Palette, X, CheckCircle, AlertCircle, Loader2, Menu, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SiteSettings {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  aboutTitle: string;
  aboutDesc: string;
  aboutYears: string;
  aboutProjects: string;
  aboutImageUrl: string;
  galleryLayout: 'masonry' | 'grid' | 'editorial';
  primaryColor: string;
  fontFamily: 'serif' | 'sans' | 'mono';
  email: string;
  socialLinks: { platform: string; url: string; }[];
  categoryLabels: Record<string, string>;
  navLabels_en: Record<string, string>;
  navLabels_zh: Record<string, string>;
  famousCars: string;
  remarks: string;
  photoCategories: string[];
  videoCategories: string[];
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    heroTitle: '0848 Studio',
    heroSubtitle: 'Visual Storytelling through Light & Motion',
    aboutTitle: 'The Vision Behind the Lens',
    aboutDesc: 'Capturing the essence of moments...',
    aboutYears: '10+',
    aboutProjects: '200+',
    aboutImageUrl: '',
    heroImageUrl: '',
    galleryLayout: 'masonry',
    primaryColor: '#1a1a1a',
    fontFamily: 'serif',
    email: 'cgsc0848@gmail.com',
    socialLinks: [],
    categoryLabels: {},
    navLabels_en: { home: 'Home', about: 'About', films: 'Films', stills: 'Stills', editorial: 'Editorial' },
    navLabels_zh: { home: '首页', about: '关于', films: '影片', stills: '摄影', editorial: '作品' },
    famousCars: '',
    remarks: '',
    photoCategories: ['Editorial', 'Personal'],
    videoCategories: ['Cinematic', 'Commercial', 'Personal', 'Editorial']
  });
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState<'hero' | 'about' | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content');
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ [id: string]: number } | null>(null);
  const [uploadResult, setUploadResult] = useState<{ id: string; name: string; success: boolean; url?: string; error?: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'photo' | 'video' } | null>(null);
  const [isAddingByUrl, setIsAddingByUrl] = useState<'photo' | 'video' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const { t, language, setLanguage } = useLanguage();

  const ADMIN_EMAIL = 'cgsc0848@gmail.com';

  useEffect(() => {
    let unsubscribePhotos: (() => void) | null = null;
    let unsubscribeVideos: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      if (u && u.email === ADMIN_EMAIL) {
        // Start listeners only if user is admin
        const qPhotos = query(collection(db, 'photos'));
        unsubscribePhotos = onSnapshot(qPhotos, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo));
          data.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setPhotos(data);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'photos'));

        const qVideos = query(collection(db, 'videos'));
        unsubscribeVideos = onSnapshot(qVideos, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
          data.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setVideos(data);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'videos'));

        unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SiteSettings;
            setSettings(prev => ({
              ...prev,
              ...data,
              navLabels_en: data.navLabels_en || prev.navLabels_en,
              navLabels_zh: data.navLabels_zh || prev.navLabels_zh,
              categoryLabels: data.categoryLabels || {},
              socialLinks: data.socialLinks || prev.socialLinks,
              photoCategories: data.photoCategories || prev.photoCategories,
              videoCategories: data.videoCategories || prev.videoCategories
            }));
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribePhotos) unsubscribePhotos();
      if (unsubscribeVideos) unsubscribeVideos();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [ADMIN_EMAIL]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const getThumbnailFromUrl = (url: string) => {
    if (!url) return '';
    
    let cleanUrl = url.trim();
    // Extract src if an iframe tag is pasted
    if (cleanUrl.includes('<iframe')) {
      const match = cleanUrl.match(/src="([^"]+)"/);
      if (match) cleanUrl = match[1];
    }
    
    // Clean trailing characters if URL was part of a larger paste/iframe
    // Split by common delimiters that might appear after a URL in an iframe
    cleanUrl = cleanUrl.split('"')[0].split("'")[0].split('>')[0].split(' ')[0].split('\\')[0];

    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      const ytIdMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([^"&?\/\s]{11})/i);
      const id = ytIdMatch?.[1];
      if (id && id.length === 11) {
        return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      }
    }
    
    return '';
  };

  const handleAddVideo = async () => {
    try {
      await addDoc(collection(db, 'videos'), {
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800',
        videoUrl: '',
        title: 'New Video',
        category: settings.videoCategories[0] || 'Cinematic',
        description: 'New video description',
        order: videos.length,
        createdAt: new Date().toISOString(),
        fileSize: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'videos');
    }
  };

  const fetchBilibiliInfo = async (url: string) => {
    // Check if we're in the AI Studio environment (or localhost)
    const isDev = window.location.hostname.includes('ais-dev-') || 
                  window.location.hostname.includes('ais-pre-') || 
                  window.location.hostname.includes('localhost') || 
                  window.location.hostname.includes('127.0.0.1');
    if (!isDev) {
      showToast(language === 'en' ? 'Auto-fetch is only available in AI Studio Preview. Please use manual entry on published sites.' : '自动抓取仅在预览环境可用。正式站请手动输入信息。', 'error');
      return null;
    }

    // Standardize URL
    let finalUrl = url;
    if (finalUrl.includes('b23.tv')) {
      // Short URLs might need resolving, but we can try extracting BV directly first
    }
    
    const bvMatch = url.match(/\bBV[a-zA-Z0-9]{10}\b/i);
    const avMatch = url.match(/\bav(\d+)\b/i);
    
    if (!bvMatch && !avMatch) return null;
    
    try {
      const queryParams = bvMatch ? `bvid=${bvMatch[0]}` : `aid=${avMatch?.[1]}`;
      const resp = await fetch(`/api/bilibili-info?${queryParams}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.error('Failed to fetch Bilibili info:', e);
    }
    return null;
  };

  const fetchXinpianchangInfo = async (url: string) => {
    const isDev = window.location.hostname.includes('ais-dev-') || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    if (!isDev) return null;
    
    try {
      const resp = await fetch(`/api/xinpianchang-info?url=${encodeURIComponent(url)}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.error('Failed to fetch Xinpianchang info:', e);
    }
    return null;
  };

  const handleConfirmAddByUrl = async () => {
    if (!urlInput) return;
    
    try {
      let finalUrl = urlInput;
      // Extract src if an iframe tag is pasted
      if (finalUrl.includes('<iframe')) {
        const match = finalUrl.match(/src="([^"]+)"/);
        if (match) finalUrl = match[1];
      }

      if (isAddingByUrl === 'photo') {
        await addDoc(collection(db, 'photos'), {
          url: finalUrl,
          title: titleInput || 'New Photo',
          category: categoryInput || settings.photoCategories[0] || 'Editorial',
          aspectRatio: 'portrait',
          order: photos.length,
          createdAt: new Date().toISOString(),
          fileSize: 0
        });
        showToast(language === 'en' ? 'Photo added' : '照片已添加');
      } else if (isAddingByUrl === 'video') {
        let title = titleInput || 'New Video';
        let thumbnail = getThumbnailFromUrl(finalUrl) || '';
        let description = 'New video description';

        if (finalUrl.includes('bilibili.com') || finalUrl.includes('b23.tv')) {
          const info = await fetchBilibiliInfo(finalUrl);
          if (info) {
            title = titleInput || info.title;
            thumbnail = info.thumbnail.replace('http://', 'https://');
            description = info.description || description;
          }
        } else if (finalUrl.includes('xinpianchang.com')) {
          const info = await fetchXinpianchangInfo(finalUrl);
          if (info) {
            title = titleInput || info.title;
            thumbnail = info.thumbnail;
            description = info.description || description;
          }
        }

        await addDoc(collection(db, 'videos'), {
          thumbnail: thumbnail || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800',
          videoUrl: finalUrl,
          title,
          category: categoryInput || settings.videoCategories[0] || 'Cinematic',
          description,
          order: videos.length,
          createdAt: new Date().toISOString(),
          fileSize: 0
        });
        showToast(language === 'en' ? 'Video added' : '视频已添加');
      }
      setIsAddingByUrl(null);
      setUrlInput('');
      setTitleInput('');
      setCategoryInput('');
    } catch (error: any) {
      console.error('Add by URL Error:', error);
      let msg = language === 'en' ? 'Failed to add content. Permission denied or invalid data.' : '添加内容失败。权限不足或数据无效。';
      if (error?.message?.includes('permission')) {
        msg = language === 'en' ? 'Permission denied. Only admin can add content.' : '权限不足。仅限管理员添加内容。';
      }
      showToast(msg, 'error');
    }
  };

  const handleAddPhotoByUrl = async () => {
    setIsAddingByUrl('photo');
  };

  const handleAddVideoByUrl = async () => {
    setIsAddingByUrl('video');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video' | 'about' | 'hero' | 'videoFile', existingId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      showToast(language === 'en' ? 'Storage not initialized' : '存储服务未初始化', 'error');
      return;
    }

    // Check file size (limit to 100MB for videos, 20MB for others)
    const sizeLimit = (type === 'video' || type === 'videoFile') ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > sizeLimit) {
      showToast(language === 'en' 
        ? `File too large (max ${sizeLimit / 1024 / 1024}MB)` 
        : `文件太大（最大 ${sizeLimit / 1024 / 1024}MB）`, 'error');
      return;
    }

    console.log('Starting upload for:', file.name, 'Size:', file.size, 'Type:', file.type);

    const uploadId = existingId || type;
    setUploadProgress(prev => ({ ...(prev || {}), [uploadId]: 0 }));
    
    try {
      showToast(language === 'en' ? 'Starting upload...' : '开始上传...');
      const storageRef = ref(storage, `uploads/${Date.now()}-${file.name.replace(/\s+/g, '_')}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(prev => ({ ...(prev || {}), [uploadId]: progress }));
        }, 
        (error) => {
          setUploadProgress(prev => {
            const next = { ...(prev || {}) };
            delete next[uploadId];
            return Object.keys(next).length ? next : null;
          });
          
          let errorMsg = error.message;
          if (error.code === 'storage/unauthorized') {
            errorMsg = language === 'en' ? 'Permission denied. Please log in as admin.' : '权限不足。请确保以管理员身份登录。';
          } else if (error.code === 'storage/canceled') {
            errorMsg = language === 'en' ? 'Upload canceled.' : '上传已取消。';
          }
          
          showToast(errorMsg, 'error');
          console.error('Storage Upload Error:', error);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const fileSize = file.size;

          try {
            if (type === 'about') {
              await updateDoc(doc(db, 'settings', 'global'), { aboutImageUrl: downloadURL });
              setSettings(prev => ({ ...prev, aboutImageUrl: downloadURL }));
            } else if (type === 'hero') {
              await updateDoc(doc(db, 'settings', 'global'), { heroImageUrl: downloadURL });
              setSettings(prev => ({ ...prev, heroImageUrl: downloadURL }));
            } else if (existingId) {
              const updatedAt = new Date().toISOString();
              if (type === 'photo') {
                await updateDoc(doc(db, 'photos', existingId), { url: downloadURL, fileSize, createdAt: updatedAt });
              } else if (type === 'video') {
                await updateDoc(doc(db, 'videos', existingId), { thumbnail: downloadURL, fileSize, createdAt: updatedAt });
              } else if (type === 'videoFile') {
                await updateDoc(doc(db, 'videos', existingId), { videoUrl: downloadURL, fileSize, createdAt: updatedAt });
              }
            } else {
              if (type === 'photo') {
                await addDoc(collection(db, 'photos'), {
                  url: downloadURL,
                  title: file.name.split('.')[0],
                  category: settings.photoCategories[0] || 'Editorial',
                  aspectRatio: 'portrait',
                  order: photos.length,
                  createdAt: new Date().toISOString(),
                  fileSize: fileSize
                });
              } else if (type === 'video' || type === 'videoFile') {
                await addDoc(collection(db, 'videos'), {
                  thumbnail: type === 'video' ? downloadURL : 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800',
                  videoUrl: type === 'videoFile' ? downloadURL : '',
                  title: file.name.split('.')[0],
                  category: settings.videoCategories[0] || 'Cinematic',
                  description: 'New video description',
                  order: videos.length,
                  createdAt: new Date().toISOString(),
                  fileSize: fileSize
                });
              }
            }
            setUploadResult({ id: uploadId, name: file.name, success: true, url: downloadURL });
            showToast(language === 'en' ? 'Upload successful' : '上传成功');
          } catch (dbError: any) {
            console.error('Firestore post-upload error:', dbError);
            setUploadResult({ id: uploadId, name: file.name, success: false, error: dbError.message });
            showToast(language === 'en' ? 'Upload saved, but failed to update database.' : '文件上传成功，但数据库更新失败。', 'error');
          } finally {
            setUploadProgress(prev => {
              if (!prev) return null;
              const next = { ...prev };
              delete next[uploadId];
              return Object.keys(next).length ? next : null;
            });
          }
        }
      );
    } catch (error) {
      setUploadProgress(null);
      showToast(language === 'en' ? 'Upload initialization failed' : '上传初始化失败', 'error');
      console.error('Upload Init Error:', error);
    }
  };

  const updatePhoto = (id: string, updates: Partial<Photo>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateVideo = (id: string, updates: Partial<Video>) => {
    setVideos(prev => prev.map(v => {
      if (v.id === id) {
        const updated = { ...v, ...updates };
        // Auto-generate thumbnail for YouTube if URL changes and thumbnail is placeholder/empty
        if (updates.videoUrl && (v.thumbnail.includes('picsum.photos') || !v.thumbnail)) {
          const autoThumb = getThumbnailFromUrl(updates.videoUrl);
          if (autoThumb) updated.thumbnail = autoThumb;
        }
        return updated;
      }
      return v;
    }));
  };

  const savePhoto = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    try {
      await updateDoc(doc(db, 'photos', id), {
        title: photo.title,
        category: photo.category,
        url: photo.url
      });
      showToast(language === 'en' ? 'Photo updated' : '照片已更新');
    } catch (error) {
      showToast(language === 'en' ? 'Update failed' : '更新失败', 'error');
      handleFirestoreError(error, OperationType.UPDATE, `photos/${id}`);
    }
  };

  const saveVideo = async (id: string) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;
    try {
      await updateDoc(doc(db, 'videos', id), {
        title: video.title,
        category: video.category,
        description: video.description,
        videoUrl: video.videoUrl,
        thumbnail: video.thumbnail
      });
      showToast(language === 'en' ? 'Video updated' : '视频已更新');
    } catch (error) {
      showToast(language === 'en' ? 'Update failed' : '更新失败', 'error');
      handleFirestoreError(error, OperationType.UPDATE, `videos/${id}`);
    }
  };

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      showToast(language === 'en' ? 'Settings saved successfully' : '设置保存成功');
    } catch (error) {
      showToast(language === 'en' ? 'Failed to save settings' : '保存设置失败', 'error');
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const deleteItem = (id: string, type: 'photo' | 'video') => {
    setConfirmDelete({ id, type });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    try {
      await deleteDoc(doc(db, type === 'photo' ? 'photos' : 'videos', id));
      showToast(language === 'en' ? 'Item deleted' : '已删除');
      setConfirmDelete(null);
    } catch (error) {
      showToast(language === 'en' ? 'Delete failed. Check permissions.' : '删除失败，请检查权限。', 'error');
      handleFirestoreError(error, OperationType.DELETE, `${type === 'photo' ? 'photos' : 'videos'}/${id}`);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-serif">Loading...</div>;

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-paper px-6">
        <div className="bg-white p-12 rounded-lg shadow-xl border border-ink/5 w-full max-w-md text-center">
          <h1 className="text-3xl font-serif mb-4">Admin Access</h1>
          <p className="text-ink/60 text-sm mb-8">
            {user ? `Access denied for ${user.email}. Please login with the admin account.` : 'Please sign in with your Google account to manage the portfolio.'}
          </p>
          <div className="space-y-4">
            <button 
              onClick={user ? handleLogout : handleLogin} 
              className="w-full bg-ink text-white p-4 rounded-full hover:bg-ink/80 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs font-medium"
            >
              {user ? 'Sign Out' : 'Sign in with Google'}
            </button>
            <button 
              onClick={toggleLanguage}
              className="w-full border border-ink/20 p-4 rounded-full hover:bg-ink hover:text-white transition-all text-xs uppercase tracking-widest font-medium"
            >
              {language === 'en' ? 'Switch to 中文' : '切换至 English'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12 bg-bg-paper">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-5xl font-serif mb-2">{t.admin.title}</h1>
            <p className="text-ink/40 text-[10px] uppercase tracking-[0.3em]">Logged in as {user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="./#/" 
              className="px-4 py-2 border border-ink/10 rounded-full text-[10px] uppercase tracking-widest hover:bg-ink hover:text-white transition-all flex items-center gap-2"
            >
              {language === 'en' ? 'View Site' : '访问预览'}
            </a>
            <button 
              onClick={toggleLanguage}
              className="px-4 py-2 border border-ink/10 rounded-full text-[10px] uppercase tracking-widest hover:bg-ink hover:text-white transition-all"
            >
              {language === 'en' ? '中文' : 'EN'}
            </button>
            <div className="bg-white rounded-full p-1 border border-ink/5 flex">
              <button 
                onClick={() => setActiveTab('content')}
                className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all ${activeTab === 'content' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink'}`}
              >
                {t.admin.content}
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink'}`}
              >
                {t.admin.settings}
              </button>
            </div>
            {activeTab === 'settings' && (
              <button 
                onClick={saveSettings}
                className="px-6 py-2 bg-accent text-white rounded-full text-[10px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
              >
                <Save size={14} /> {t.admin.saveSettings}
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-ink/60 hover:text-red-500 transition-colors ml-4">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {uploadProgress !== null && (
          <div className="fixed bottom-12 right-12 z-50 flex flex-col gap-4">
            {Object.entries(uploadProgress).map(([id, progress]) => (
              <div key={id} className="bg-white p-6 rounded-2xl shadow-2xl border border-ink/5 w-80">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] uppercase tracking-widest font-medium">
                    {id === 'photo' || id === 'video' || id === 'about' || id === 'hero' 
                      ? (language === 'en' ? 'Uploading New Content...' : '正在上传新内容...') 
                      : (language === 'en' ? 'Updating Item...' : '正在更新项目...')}
                  </span>
                  <span className="text-[10px] font-mono">{progress}%</span>
                </div>
                <div className="w-full bg-ink/5 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-accent h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'content' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Photos Section */}
            <section>
              <div className="flex justify-between items-end mb-8 border-b border-ink/10 pb-4">
                <h2 className="text-2xl font-serif flex items-center gap-3">
                  <ImageIcon size={20} className="text-accent" /> {t.admin.photography}
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setIsAddingByUrl('photo');
                      setCategoryInput(settings.photoCategories[0] || '');
                    }}
                    className="text-[10px] uppercase tracking-widest bg-accent text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2"
                  >
                    <Plus size={12} /> {language === 'en' ? 'Add by URL' : '通过链接添加'}
                  </button>
                  <label className="cursor-pointer text-[10px] uppercase tracking-widest bg-ink text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2">
                    <Plus size={12} /> {t.admin.addPhoto}
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} />
                  </label>
                </div>
              </div>

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                {photos.map((photo) => (
                  <div key={photo.id} className="bg-white p-4 rounded-xl border border-ink/5 flex gap-6 group">
                    <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg bg-ink/5 relative group/img">
                      <img src={photo.url || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <label className="text-white hover:text-accent cursor-pointer">
                          <Plus size={20} />
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'photo', photo.id)} />
                        </label>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <input 
                          value={photo.title} 
                          onChange={(e) => updatePhoto(photo.id, { title: e.target.value })}
                          className="w-full p-2 border-b border-ink/5 focus:border-accent outline-none text-sm font-medium"
                          placeholder="Title"
                        />
                        <select 
                          value={photo.category}
                          onChange={(e) => updatePhoto(photo.id, { category: e.target.value })}
                          className="w-full p-2 text-[10px] uppercase tracking-widest text-ink/60 outline-none hover:bg-ink/5 rounded"
                        >
                          {settings.photoCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <input 
                          value={photo.url}
                          onChange={(e) => updatePhoto(photo.id, { url: e.target.value })}
                          className="w-full p-2 text-[9px] text-ink/40 outline-none bg-ink/5 rounded"
                          placeholder="Image URL"
                        />
                        <div className="flex justify-between items-center text-[9px] text-ink/30 mt-1">
                          {photo.createdAt && (
                            <span>{formatDate(photo.createdAt)}</span>
                          )}
                          {(photo as any).fileSize && (
                            <span>{Math.round((photo as any).fileSize / 1024)} KB</span>
                          )}
                        </div>
                        <button 
                          onClick={() => savePhoto(photo.id)}
                          className="w-full mt-2 bg-accent/10 text-accent text-[10px] uppercase tracking-widest py-2 rounded-lg hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Save size={12} /> {t.admin.confirmSave}
                        </button>
                      </div>
                      <button 
                        onClick={() => deleteItem(photo.id, 'photo')}
                        className="text-red-400 hover:text-red-600 transition-colors self-end"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Videos Section */}
            <section>
              <div className="flex justify-between items-end mb-8 border-b border-ink/10 pb-4">
                <h2 className="text-2xl font-serif flex items-center gap-3">
                  <VideoIcon size={20} className="text-accent" /> {t.admin.cinematography}
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setIsAddingByUrl('video');
                      setCategoryInput(settings.videoCategories[0] || '');
                    }}
                    className="text-[10px] uppercase tracking-widest bg-accent text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2"
                  >
                    <Plus size={12} /> {language === 'en' ? 'Add by URL' : '通过链接添加'}
                  </button>
                  <label className="cursor-pointer text-[10px] uppercase tracking-widest bg-ink text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2">
                    <Plus size={12} /> {language === 'en' ? 'Upload Thumbnail' : '上传封面图'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
                  </label>
                  <label className="cursor-pointer text-[10px] uppercase tracking-widest bg-black text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg">
                    <VideoIcon size={12} /> {language === 'en' ? 'Upload Video File' : '上传视频文件'}
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'videoFile')} />
                  </label>
                </div>
              </div>

              <div className="mb-6 p-4 bg-accent/5 rounded-xl border border-accent/10">
                <h4 className="text-[10px] uppercase tracking-widest font-bold mb-2 text-accent">
                  {language === 'en' ? 'Video Upload Instructions' : '视频上传与链接说明'}
                </h4>
                <ul className="text-[10px] space-y-1 text-ink/60 list-disc pl-4">
                  <li>{language === 'en' ? 'Option 1: Click "Add Video by URL" and enter the link. YouTube thumbnails will be auto-generated.' : '方式一：点击“通过链接添加视频”，输入链接。YouTube 封面会自动生成。'}</li>
                  <li>{language === 'en' ? 'Option 2: Upload a custom thumbnail first, or manually enter a "Thumbnail URL" below.' : '方式二：上传自定义封面，或者在下方手动输入“封面图链接”。'}</li>
                  <li>{language === 'en' ? 'Bilibili: Paste the video URL (e.g., https://www.bilibili.com/video/BV...) or the full iframe embed code.' : 'Bilibili: 直接粘贴视频链接（如 https://www.bilibili.com/video/BV...）或完整的嵌入代码。'}</li>
                  <li>{language === 'en' ? 'Supported: YouTube, Bilibili, Vimeo, and direct MP4 links.' : '支持：YouTube, Bilibili, Vimeo 以及直接的 MP4 链接。'}</li>
                </ul>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                {videos.map((video) => (
                  <div key={video.id} className="bg-white p-4 rounded-xl border border-ink/5 flex flex-col gap-4 group">
                    <div className="flex gap-6">
                      <div className="w-32 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-ink/5 relative group/img">
                        <img src={video.thumbnail || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <label className="text-white hover:text-accent cursor-pointer">
                            <Plus size={20} />
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'video', video.id)} />
                          </label>
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input 
                          value={video.title} 
                          onChange={(e) => updateVideo(video.id, { title: e.target.value })}
                          className="w-full p-2 border-b border-ink/5 focus:border-accent outline-none text-sm font-medium"
                          placeholder="Video Title"
                        />
                        <select 
                          value={video.category}
                          onChange={(e) => updateVideo(video.id, { category: e.target.value })}
                          className="w-full p-2 text-[10px] uppercase tracking-widest text-ink/60 outline-none hover:bg-ink/5 rounded"
                        >
                          {settings.videoCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="flex justify-between items-center text-[9px] text-ink/30 mt-1">
                          {video.createdAt && (
                            <span>{formatDate(video.createdAt)}</span>
                          )}
                          {(video as any).fileSize && (
                            <span>{Math.round((video as any).fileSize / 1024)} KB</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <textarea 
                      value={video.description}
                      onChange={(e) => updateVideo(video.id, { description: e.target.value })}
                      className="w-full p-3 bg-ink/5 rounded-lg text-xs text-ink/60 h-20 outline-none focus:ring-1 ring-accent"
                      placeholder="Describe the film..."
                    />
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <p className="text-[9px] text-ink/40 uppercase tracking-widest mb-1">{language === 'en' ? 'Video URL or Embed Code' : '视频链接或嵌入代码'}</p>
                        <input 
                          value={video.videoUrl}
                          onChange={(e) => updateVideo(video.id, { videoUrl: e.target.value })}
                          className="w-full p-2 bg-ink/5 rounded text-[10px] outline-none focus:ring-1 ring-accent"
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] text-ink/40 uppercase tracking-widest mb-1">{language === 'en' ? 'Thumbnail URL' : '封面图链接'}</p>
                        <input 
                          value={video.thumbnail}
                          onChange={(e) => updateVideo(video.id, { thumbnail: e.target.value })}
                          className="w-full p-2 bg-ink/5 rounded text-[10px] outline-none focus:ring-1 ring-accent"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => saveVideo(video.id)}
                          className="bg-accent/10 text-accent text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-accent hover:text-white transition-all flex items-center gap-2"
                        >
                          <Save size={12} /> {t.admin.confirmSave}
                        </button>
                        <button 
                          onClick={() => deleteItem(video.id, 'video')}
                          className="text-red-400 hover:text-red-600 transition-colors p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="bg-white rounded-2xl border border-ink/5 p-8 md:p-12 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-serif">{t.admin.customization}</h2>
              <button onClick={saveSettings} className="bg-accent text-white px-8 py-3 rounded-full hover:opacity-80 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium">
                <Save size={14} /> {t.admin.save}
              </button>
            </div>

            <div className="space-y-16">
              {/* Layout Control */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Layout size={14} /> {t.admin.layout}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['masonry', 'grid', 'editorial'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings({ ...settings, galleryLayout: mode })}
                      className={`group relative p-4 rounded-xl border-2 transition-all text-left ${settings.galleryLayout === mode ? 'border-accent bg-accent/[0.02]' : 'border-ink/5 hover:border-ink/10'}`}
                    >
                      <div className="aspect-[4/3] bg-ink/5 rounded-lg mb-4 overflow-hidden relative">
                         {/* Visual Representation */}
                         {mode === 'masonry' && (
                           <div className="p-2 grid grid-cols-3 gap-1 h-full">
                              <div className="bg-ink/10 rounded-sm h-12" />
                              <div className="bg-ink/10 rounded-sm h-8" />
                              <div className="bg-ink/10 rounded-sm h-10" />
                              <div className="bg-ink/10 rounded-sm h-6" />
                              <div className="bg-ink/10 rounded-sm h-14" />
                              <div className="bg-ink/10 rounded-sm h-9" />
                           </div>
                         )}
                         {mode === 'grid' && (
                           <div className="p-2 grid grid-cols-3 gap-1 h-full">
                              {[...Array(9)].map((_, i) => <div key={i} className="bg-ink/10 rounded-sm aspect-square" />)}
                           </div>
                         )}
                         {mode === 'editorial' && (
                           <div className="p-2 flex flex-col gap-1 h-full">
                              <div className="bg-ink/10 rounded-sm h-1/2 w-full" />
                              <div className="flex gap-1 h-1/2">
                                 <div className="bg-ink/10 rounded-sm flex-1" />
                                 <div className="bg-ink/10 rounded-sm flex-1" />
                              </div>
                           </div>
                         )}
                         {settings.galleryLayout === mode && (
                           <div className="absolute inset-0 bg-accent/10 flex items-center justify-center">
                              <div className="bg-accent text-white p-1 rounded-full"><CheckCircle size={12} /></div>
                           </div>
                         )}
                      </div>
                      <span className="block text-[10px] uppercase tracking-widest font-bold text-ink mb-1">{mode}</span>
                      <p className="text-[9px] text-ink/40 leading-relaxed uppercase tracking-widest">
                         {mode === 'masonry' ? 'Dynamic mosaic layout' : mode === 'grid' ? 'Perfectly uniform grid' : 'Story-driven focus'}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Navigation Labels */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Menu size={14} /> {language === 'en' ? 'Navigation Labels' : '导航标签设置'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['home', 'about', 'films', 'stills', 'journal'].map((key) => (
                    <div key={key}>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5 font-bold">{key}</label>
                      <input 
                        placeholder={(t.nav as any)[key]}
                        value={settings?.navLabels?.[key] || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          navLabels: { ...(settings?.navLabels || {}), [key]: e.target.value }
                        })}
                        className="w-full p-3 bg-ink/5 rounded-lg outline-none focus:ring-1 ring-accent text-[10px] tracking-widest font-medium"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Video Category Labels */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <VideoIcon size={14} /> {language === 'en' ? 'Film Category Labels' : '影片分类标签设置'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {['cinematic', 'commercial', 'personal', 'editorial', 'all'].map((key) => (
                    <div key={key}>
                      <label className="block text-[9px] uppercase tracking-widest text-ink/40 mb-1.5 font-bold">{key}</label>
                      <input 
                        placeholder={(t.cinematography.categories as any)[key]}
                        value={settings?.categoryLabels?.[key] || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          categoryLabels: { ...(settings?.categoryLabels || {}), [key]: e.target.value }
                        })}
                        className="w-full p-3 bg-ink/5 rounded-lg outline-none focus:ring-1 ring-accent text-[10px] tracking-widest font-medium"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Contact & Socials */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                   <Mail size={14} /> {language === 'en' ? 'Contact & Social Media' : '联系方式与社交媒体'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{language === 'en' ? 'Contact Email' : '联系邮箱'}</label>
                    <input 
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{language === 'en' ? 'Social Links' : '社交媒体链接'}</label>
                    <div className="space-y-3">
                      {settings.socialLinks.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            placeholder="Platform"
                            value={link.platform}
                            onChange={(e) => {
                              const newLinks = [...settings.socialLinks];
                              newLinks[idx].platform = e.target.value;
                              setSettings({ ...settings, socialLinks: newLinks });
                            }}
                            className="w-24 p-3 bg-ink/5 rounded-lg outline-none text-[10px] uppercase tracking-widest font-medium"
                          />
                          <input 
                            placeholder="URL"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...settings.socialLinks];
                              newLinks[idx].url = e.target.value;
                              setSettings({ ...settings, socialLinks: newLinks });
                            }}
                            className="flex-1 p-3 bg-ink/5 rounded-lg outline-none text-[10px]"
                          />
                          <button 
                            onClick={() => {
                              const newLinks = settings.socialLinks.filter((_, i) => i !== idx);
                              setSettings({ ...settings, socialLinks: newLinks });
                            }}
                            className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setSettings({
                          ...settings,
                          socialLinks: [...settings.socialLinks, { platform: '', url: '' }]
                        })}
                        className="w-full py-3 border border-dashed border-ink/20 rounded-lg text-ink/40 text-[10px] uppercase tracking-widest hover:bg-ink/[0.02] flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> {language === 'en' ? 'Add Social Link' : '添加社交链接'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

               {/* Navigation Customization */}
               <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                   <Menu size={14} /> {language === 'en' ? 'Navigation Labels' : '导航版块自定义'}
                </h3>
                <div className="bg-ink/5 p-8 rounded-2xl space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-ink/60 font-bold border-b border-ink/5 pb-2">English Labels</label>
                        <div className="space-y-4">
                           {Object.keys(settings.navLabels_en || {}).map(key => (
                             <div key={key} className="flex items-center gap-4">
                               <label className="w-16 text-[9px] uppercase tracking-widest text-ink/30">{key}</label>
                               <input 
                                 value={(settings.navLabels_en as any)[key] || ''}
                                 onChange={(e) => setSettings({ 
                                   ...settings, 
                                   navLabels_en: { ...(settings.navLabels_en || {}), [key]: e.target.value } 
                                 })}
                                 className="flex-1 p-3 bg-white rounded-xl text-xs outline-none focus:ring-1 ring-accent border border-ink/5"
                               />
                             </div>
                           ))}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-ink/60 font-bold border-b border-ink/5 pb-2">中文名称 (ZH)</label>
                        <div className="space-y-4">
                           {Object.keys(settings.navLabels_zh || {}).map(key => (
                             <div key={key} className="flex items-center gap-4">
                               <label className="w-16 text-[9px] uppercase tracking-widest text-ink/30">{key}</label>
                               <input 
                                 value={(settings.navLabels_zh as any)[key] || ''}
                                 onChange={(e) => setSettings({ 
                                   ...settings, 
                                   navLabels_zh: { ...(settings.navLabels_zh || {}), [key]: e.target.value } 
                                 })}
                                 className="flex-1 p-3 bg-white rounded-xl text-xs outline-none focus:ring-1 ring-accent border border-ink/5"
                               />
                             </div>
                           ))}
                        </div>
                      </div>
                   </div>
                   <div className="bg-accent/5 p-4 rounded-xl border border-accent/10">
                      <p className="text-[10px] text-accent/60 leading-relaxed italic">
                        Tip: You can customize names for "home", "about", "films", "stills", and "editorial" sections in both languages.
                      </p>
                   </div>
                </div>
               </section>

              {/* Categories & Tags Management */}
               <section className="space-y-6">
                 <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                   <SettingsIcon size={14} /> {language === 'en' ? 'Categories & Tags Management' : '分类与标签管理'}
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Photo Tags */}
                    <div className="space-y-4 p-6 bg-ink/5 rounded-2xl">
                       <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-4">{language === 'en' ? 'Photo Categories' : '图库分类标签'}</label>
                       <div className="flex flex-wrap gap-2 mb-4">
                          {(settings.photoCategories || []).map((cat, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white px-3 py-1 pb-1.5 rounded-full text-[10px] uppercase tracking-widest border border-ink/10 group">
                               {cat}
                               <button 
                                 onClick={() => setSettings({ ...settings, photoCategories: (settings.photoCategories || []).filter((_, idx) => idx !== i) })} 
                                 className="text-ink/20 group-hover:text-red-500 transition-colors"
                               >
                                  <X size={10} />
                               </button>
                            </div>
                          ))}
                       </div>
                       <div className="flex gap-2">
                          <input 
                            id="newPhotoCat"
                            placeholder={language === 'en' ? 'New Tag...' : '新增标签...'}
                            className="flex-1 bg-white border border-ink/10 rounded-lg p-2 text-xs outline-none focus:ring-1 ring-accent"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.currentTarget as HTMLInputElement).value.trim();
                                if (val && !(settings.photoCategories || []).includes(val)) {
                                  setSettings({ ...settings, photoCategories: [...(settings.photoCategories || []), val] });
                                  (e.currentTarget as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              const input = document.getElementById('newPhotoCat') as HTMLInputElement;
                              const val = input.value.trim();
                              if (val && !(settings.photoCategories || []).includes(val)) {
                                setSettings({ ...settings, photoCategories: [...(settings.photoCategories || []), val] });
                                input.value = '';
                              }
                            }}
                            className="bg-ink text-white px-3 rounded-lg hover:opacity-80 transition-opacity"
                          >
                             <Plus size={14} />
                          </button>
                       </div>
                    </div>

                    {/* Video Tags */}
                    <div className="space-y-4 p-6 bg-ink/5 rounded-2xl">
                       <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold mb-4">{language === 'en' ? 'Video Categories' : '视频分类标签'}</label>
                       <div className="flex flex-wrap gap-2 mb-4">
                          {(settings.videoCategories || []).map((cat, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white px-3 py-1 pb-1.5 rounded-full text-[10px] uppercase tracking-widest border border-ink/10 group">
                               {cat}
                               <button 
                                 onClick={() => setSettings({ ...settings, videoCategories: (settings.videoCategories || []).filter((_, idx) => idx !== i) })} 
                                 className="text-ink/20 group-hover:text-red-500 transition-colors"
                               >
                                  <X size={10} />
                               </button>
                            </div>
                          ))}
                       </div>
                       <div className="flex gap-2">
                          <input 
                            id="newVideoCat"
                            placeholder={language === 'en' ? 'New Tag...' : '新增标签...'}
                            className="flex-1 bg-white border border-ink/10 rounded-lg p-2 text-xs outline-none focus:ring-1 ring-accent"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.currentTarget as HTMLInputElement).value.trim();
                                if (val && !(settings.videoCategories || []).includes(val)) {
                                  setSettings({ ...settings, videoCategories: [...(settings.videoCategories || []), val] });
                                  (e.currentTarget as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={() => {
                              const input = document.getElementById('newVideoCat') as HTMLInputElement;
                              const val = input.value.trim();
                              if (val && !(settings.videoCategories || []).includes(val)) {
                                setSettings({ ...settings, videoCategories: [...(settings.videoCategories || []), val] });
                                input.value = '';
                              }
                            }}
                            className="bg-ink text-white px-3 rounded-lg hover:opacity-80 transition-opacity"
                          >
                             <Plus size={14} />
                          </button>
                       </div>
                    </div>
                 </div>
               </section>

               {/* Visual Style & Typography */}
               <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Type size={14} /> {language === 'en' ? 'Typography & Brand' : '文字与品牌风格'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{t.admin.heroTitle}</label>
                        <input 
                          value={settings.heroTitle}
                          onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent font-serif text-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{t.admin.heroSubtitle}</label>
                        <input 
                          value={settings.heroSubtitle}
                          onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{language === 'en' ? 'Famous Cars' : '名车设置'}</label>
                        <input 
                          value={settings.famousCars}
                          onChange={(e) => setSettings({ ...settings, famousCars: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{language === 'en' ? 'Remarks' : '备注描述'}</label>
                        <textarea 
                          value={settings.remarks}
                          onChange={(e) => setSettings({ ...settings, remarks: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm h-24"
                        />
                      </div>
                   </div>
                   <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{t.admin.accentColor}</label>
                        <div className="flex gap-4">
                          <input 
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 overflow-hidden"
                          />
                          <input 
                            value={settings.primaryColor}
                            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                            className="flex-1 p-3 bg-ink/5 rounded-lg outline-none font-mono text-[10px]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-bold">{t.admin.fontFamily}</label>
                        <div className="grid grid-cols-3 gap-2">
                           {(['serif', 'sans', 'mono'] as const).map(font => (
                             <button
                               key={font}
                               onClick={() => setSettings({ ...settings, fontFamily: font })}
                               className={`py-3 rounded-lg text-[10px] uppercase tracking-widest font-medium border-2 transition-all ${settings.fontFamily === font ? 'border-accent bg-accent/5' : 'border-ink/5 hover:border-ink/10'}`}
                             >
                               {font}
                             </button>
                           ))}
                        </div>
                      </div>
                   </div>
                </div>
              </section>

              {/* Hero Image Selection */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                   <ImageIcon size={14} /> {language === 'en' ? 'Hero Background' : '首页背景图设置'}
                </h3>
                <div className="p-6 bg-ink/5 rounded-2xl flex flex-col md:flex-row gap-8 items-center">
                   <div className="w-full md:w-64 aspect-video rounded-xl overflow-hidden bg-white shadow-sm relative group">
                      {settings.heroImageUrl ? (
                        <img src={settings.heroImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink/10 font-bold tracking-[0.5em] text-[8px] uppercase">No Background</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                         <button onClick={() => setIsPhotoPickerOpen('hero')} className="p-2 bg-white text-ink rounded-full hover:bg-accent hover:text-white transition-all"><ImageIcon size={16} /></button>
                         <button onClick={() => setSettings({ ...settings, heroImageUrl: '' })} className="p-2 bg-white text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={16} /></button>
                      </div>
                   </div>
                   <div className="flex-1 space-y-4 w-full">
                      <div className="flex gap-4">
                        <label className="cursor-pointer flex-1 bg-ink text-white text-[10px] uppercase tracking-widest font-bold py-4 rounded-xl text-center hover:opacity-80 transition-opacity">
                          {language === 'en' ? 'Upload Local Image' : '上传本地图片'}
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'hero')} />
                        </label>
                        <button 
                          onClick={() => setIsPhotoPickerOpen('hero')}
                          className="flex-1 bg-white border border-ink/10 text-[10px] uppercase tracking-widest font-bold py-4 rounded-xl hover:bg-ink/5 transition-colors"
                        >
                          {language === 'en' ? 'Select from Gallery' : '从图库中选择'}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          value={settings.heroImageUrl}
                          onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                          className="w-full p-4 bg-white/60 rounded-xl outline-none focus:ring-1 ring-accent text-[10px] pr-12"
                          placeholder="Or paste external URL..."
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/20 pointer-events-none text-[8px] uppercase tracking-widest font-bold">External URL</div>
                      </div>
                   </div>
                </div>
              </section>

              {/* About Section Customization */}
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                   <ImageIcon size={14} /> {language === 'en' ? 'About Section' : '关于板块设置'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold">{t.admin.aboutTitle}</label>
                        <input 
                          value={settings.aboutTitle}
                          onChange={(e) => setSettings({ ...settings, aboutTitle: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold">{t.admin.aboutDesc}</label>
                        <textarea 
                          value={settings.aboutDesc}
                          onChange={(e) => setSettings({ ...settings, aboutDesc: e.target.value })}
                          className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm h-40 leading-relaxed"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold">{t.admin.aboutYears}</label>
                          <input 
                            value={settings.aboutYears}
                            onChange={(e) => setSettings({ ...settings, aboutYears: e.target.value })}
                            className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-bold">{t.admin.aboutProjects}</label>
                          <input 
                            value={settings.aboutProjects}
                            onChange={(e) => setSettings({ ...settings, aboutProjects: e.target.value })}
                            className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                          />
                        </div>
                      </div>
                   </div>
                   <div>
                      <div className="w-full aspect-[4/5] bg-ink/5 rounded-2xl overflow-hidden mb-6 relative group border border-ink/5 shadow-sm">
                        {settings.aboutImageUrl ? (
                          <img src={settings.aboutImageUrl} className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink/10 uppercase tracking-widest font-bold text-[8px]">No Portrait</div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                           <button onClick={() => setIsPhotoPickerOpen('about')} className="p-2 bg-white text-ink rounded-full hover:bg-accent hover:text-white transition-all"><ImageIcon size={16} /></button>
                           <button onClick={() => setSettings({ ...settings, aboutImageUrl: '' })} className="p-2 bg-white text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"><X size={16} /></button>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsPhotoPickerOpen('about')}
                        className="w-full bg-white border border-ink/10 text-[10px] uppercase tracking-widest font-bold py-4 rounded-xl hover:bg-ink/5 transition-colors mb-2"
                      >
                         {language === 'en' ? 'Choose from Gallery' : '从图库中选择'}
                      </button>
                      <label className="block cursor-pointer bg-ink/5 text-ink/40 text-[10px] uppercase tracking-widest font-bold py-4 rounded-xl text-center hover:bg-ink/10 transition-colors">
                        {language === 'en' ? 'Or Upload Local' : '或上传本地图片'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'about')} />
                      </label>
                   </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {/* Photo Gallery Picker Modal */}
        <AnimatePresence>
          {isPhotoPickerOpen && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-md p-4 md:p-8"
            >
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.95, opacity: 0 }}
                 className="bg-white rounded-3xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
               >
                  <div className="p-6 border-b border-ink/5 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <h3 className="text-2xl font-serif">{language === 'en' ? 'Select Photo from Gallery' : '从图库中选择照片'}</h3>
                    <button onClick={() => setIsPhotoPickerOpen(null)} className="p-2 hover:bg-ink/5 rounded-full transition-colors"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {photos.map((photo) => (
                        <div 
                          key={photo.id} 
                          onClick={() => {
                            if (isPhotoPickerOpen === 'hero') setSettings({ ...settings, heroImageUrl: photo.url });
                            else if (isPhotoPickerOpen === 'about') setSettings({ ...settings, aboutImageUrl: photo.url });
                            setIsPhotoPickerOpen(null);
                          }}
                          className={`group aspect-[4/5] bg-ink/5 rounded-xl overflow-hidden cursor-pointer relative border-2 transition-all ${
                            (isPhotoPickerOpen === 'hero' && settings.heroImageUrl === photo.url) || 
                            (isPhotoPickerOpen === 'about' && settings.aboutImageUrl === photo.url)
                            ? 'border-accent ring-4 ring-accent/10' : 'border-transparent hover:border-accent/40'
                          }`}
                        >
                          <img 
                            src={photo.url} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <span className="bg-white text-ink text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-lg">Select</span>
                          </div>
                        </div>
                      ))}
                      {photos.length === 0 && (
                        <div className="col-span-full py-24 flex flex-col items-center gap-4 text-ink/20">
                           <ImageIcon size={48} />
                           <p className="text-[10px] uppercase tracking-widest font-bold">No photos found in gallery.</p>
                        </div>
                      )}
                    </div>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Result Modal */}
        <AnimatePresence>
          {uploadResult && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center"
              >
                <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6 ${
                  uploadResult.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {uploadResult.success ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
                </div>
                <h3 className="text-xl font-serif mb-2">
                  {uploadResult.success 
                    ? (language === 'en' ? 'Upload Complete' : '上传已完成') 
                    : (language === 'en' ? 'Upload Failed' : '上传失败')}
                </h3>
                <p className="text-xs text-ink/60 mb-6 line-clamp-2">
                  {uploadResult.name}
                </p>
                {!uploadResult.success && uploadResult.error && (
                  <div className="bg-red-50 p-4 rounded-xl mb-6 text-left">
                    <p className="text-[10px] text-red-600 font-mono break-words">{uploadResult.error}</p>
                  </div>
                )}
                <button 
                  onClick={() => setUploadResult(null)}
                  className="w-full py-4 bg-ink text-white rounded-xl text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-all"
                >
                  {language === 'en' ? 'Close' : '关闭'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${
                toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="text-xs font-medium uppercase tracking-widest">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add by URL Modal */}
        <AnimatePresence>
          {isAddingByUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full"
              >
                <h3 className="text-xl font-serif mb-6 text-center">
                  {isAddingByUrl === 'photo' 
                    ? (language === 'en' ? 'Add Photo by URL' : '通过链接添加照片')
                    : (language === 'en' ? 'Add Video by URL' : '通过链接添加视频')}
                </h3>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 mb-1 block">Title</label>
                    <input 
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full p-3 bg-ink/5 rounded-lg text-sm outline-none focus:ring-1 ring-accent"
                      placeholder="Enter title..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 mb-1 block">URL</label>
                    <input 
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full p-3 bg-ink/5 rounded-lg text-sm outline-none focus:ring-1 ring-accent"
                      placeholder={isAddingByUrl === 'photo' ? "https://..." : "YouTube, Bilibili, Xinpianchang, or MP4 URL..."}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-ink/40 mb-1 block">Category / Tag</label>
                    <select 
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      className="w-full p-3 bg-ink/5 rounded-lg text-sm outline-none focus:ring-1 ring-accent"
                    >
                      <option value="">{language === 'en' ? 'Select category...' : '选择分类...'}</option>
                      {(isAddingByUrl === 'photo' ? settings.photoCategories : settings.videoCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setIsAddingByUrl(null); setUrlInput(''); setTitleInput(''); }}
                    className="flex-1 px-6 py-3 rounded-xl border border-ink/10 text-[10px] uppercase tracking-widest hover:bg-ink/5 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : '取消'}
                  </button>
                  <button 
                    onClick={handleConfirmAddByUrl}
                    className="flex-1 px-6 py-3 rounded-xl bg-ink text-white text-[10px] uppercase tracking-widest hover:bg-ink/80 transition-colors"
                  >
                    {language === 'en' ? 'Add' : '添加'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-serif mb-2">{language === 'en' ? 'Confirm Deletion' : '确认删除'}</h3>
                <p className="text-sm text-ink/60 mb-8">
                  {language === 'en' ? 'This action cannot be undone. Are you sure?' : '此操作无法撤销，确定要继续吗？'}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-6 py-3 rounded-xl border border-ink/10 text-[10px] uppercase tracking-widest hover:bg-ink/5 transition-colors"
                  >
                    {language === 'en' ? 'Cancel' : '取消'}
                  </button>
                  <button 
                    onClick={handleConfirmDelete}
                    className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white text-[10px] uppercase tracking-widest hover:bg-red-600 transition-colors"
                  >
                    {language === 'en' ? 'Delete' : '删除'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
