import React, { useState, useEffect } from 'react';
import { Photo, Video } from '@/src/types';
import { useLanguage } from '../LanguageContext';
import { auth, db, storage, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { LogOut, Plus, Trash2, Save, Image as ImageIcon, Video as VideoIcon, Settings as SettingsIcon, Layout, Type, Palette, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
    fontFamily: 'serif'
  });
  const [activeTab, setActiveTab] = useState<'content' | 'settings'>('content');
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'photo' | 'video' } | null>(null);
  const [isAddingByUrl, setIsAddingByUrl] = useState<'photo' | 'video' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
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
            setSettings(snapshot.data() as SiteSettings);
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
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = '';
      if (url.includes('v=')) {
        id = url.split('v=')[1].split('&')[0];
      } else {
        id = url.split('/').pop()?.split('?')[0] || '';
      }
      return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    }
    
    // Bilibili thumbnail logic can be complex without server-side proxy
    // For now, return empty to allow manual entry or fallback to default
    return '';
  };

  const handleAddVideo = async () => {
    try {
      await addDoc(collection(db, 'videos'), {
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800',
        videoUrl: '',
        title: 'New Video',
        category: 'Cinematic',
        description: 'New video description',
        order: videos.length,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'videos');
    }
  };

  const handleConfirmAddByUrl = async () => {
    if (!urlInput) return;
    
    try {
      if (isAddingByUrl === 'photo') {
        await addDoc(collection(db, 'photos'), {
          url: urlInput,
          title: titleInput || 'New Photo',
          category: 'Editorial',
          aspectRatio: 'portrait',
          order: photos.length,
          createdAt: new Date().toISOString()
        });
        showToast(language === 'en' ? 'Photo added' : '照片已添加');
      } else if (isAddingByUrl === 'video') {
        const thumb = getThumbnailFromUrl(urlInput) || '';
        await addDoc(collection(db, 'videos'), {
          thumbnail: thumb,
          videoUrl: urlInput,
          title: titleInput || 'New Video',
          category: 'Cinematic',
          description: 'New video description',
          order: videos.length,
          createdAt: new Date().toISOString(),
          fileSize: 0
        });
        showToast(language === 'en' ? 'Video added' : '视频已添加');
      }
      setIsAddingByUrl(null);
      setUrlInput('');
      setTitleInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, isAddingByUrl === 'photo' ? 'photos' : 'videos');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video' | 'about' | 'hero', existingId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      showToast(language === 'en' ? 'Storage not initialized' : '存储服务未初始化', 'error');
      return;
    }

    // Check file size (limit to 20MB for safety)
    if (file.size > 20 * 1024 * 1024) {
      showToast(language === 'en' ? 'File too large (max 20MB)' : '文件太大（最大 20MB）', 'error');
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
              }
            } else {
              if (type === 'photo') {
                await addDoc(collection(db, 'photos'), {
                  url: downloadURL,
                  title: file.name.split('.')[0],
                  category: 'Editorial',
                  aspectRatio: 'portrait',
                  order: photos.length,
                  createdAt: new Date().toISOString(),
                  fileSize: fileSize
                });
              } else if (type === 'video') {
                await addDoc(collection(db, 'videos'), {
                  thumbnail: downloadURL,
                  videoUrl: '',
                  title: file.name.split('.')[0],
                  category: 'Cinematic',
                  description: 'New video description',
                  order: videos.length,
                  createdAt: new Date().toISOString(),
                  fileSize: fileSize
                });
              }
            }
            setUploadProgress(null);
            showToast(language === 'en' ? 'Upload successful' : '上传成功');
          } catch (dbError) {
            console.error('Firestore post-upload error:', dbError);
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
                    onClick={() => setIsAddingByUrl('photo')}
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
                      <img src={photo.url || undefined} className="w-full h-full object-cover" />
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
                          onChange={(e) => updatePhoto(photo.id, { category: e.target.value as any })}
                          className="w-full p-2 text-[10px] uppercase tracking-widest text-ink/60 outline-none"
                        >
                          <option value="Editorial">{t.photography.categories.editorial}</option>
                          <option value="Personal">{t.photography.categories.personal}</option>
                          <option value="Commercial">{language === 'en' ? 'Commercial' : '商业'}</option>
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
                    onClick={() => setIsAddingByUrl('video')}
                    className="text-[10px] uppercase tracking-widest bg-accent text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2"
                  >
                    <Plus size={12} /> {language === 'en' ? 'Add by URL' : '通过链接添加'}
                  </button>
                  <label className="cursor-pointer text-[10px] uppercase tracking-widest bg-ink text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity flex items-center gap-2">
                    <Plus size={12} /> {language === 'en' ? 'Upload Thumbnail' : '上传封面图'}
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
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
                        <img src={video.thumbnail || undefined} className="w-full h-full object-cover" />
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
                          onChange={(e) => updateVideo(video.id, { category: e.target.value as any })}
                          className="w-full p-2 text-[10px] uppercase tracking-widest text-ink/60 outline-none"
                        >
                          <option value="Cinematic">{t.cinematography.categories.cinematic}</option>
                          <option value="Commercial">{t.cinematography.categories.commercial}</option>
                          <option value="Personal">{t.cinematography.categories.personal}</option>
                          <option value="Editorial">{t.cinematography.categories.editorial}</option>
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
          <div className="bg-white rounded-2xl border border-ink/5 p-12 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-serif">{t.admin.customization}</h2>
              <button onClick={saveSettings} className="bg-accent text-white px-8 py-3 rounded-full hover:opacity-80 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium">
                <Save size={14} /> {t.admin.save}
              </button>
            </div>

            <div className="space-y-12">
              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Type size={14} /> {t.admin.typography}
                </h3>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.heroTitle}</label>
                    <input 
                      value={settings.heroTitle}
                      onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })}
                      className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent font-serif text-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.heroSubtitle}</label>
                    <input 
                      value={settings.heroSubtitle}
                      onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })}
                      className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{language === 'en' ? 'Hero Background Image' : '首页背景图片'}</label>
                    <div className="flex flex-col gap-4 mb-2">
                      <div className="flex gap-4 items-center">
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-ink/5 border border-ink/10">
                          <img src={settings.heroImageUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer inline-block text-[10px] uppercase tracking-widest bg-ink text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity">
                              {language === 'en' ? 'Upload New Image' : '上传新图片'}
                              <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'hero')} />
                            </label>
                            {settings.heroImageUrl && (
                              <button 
                                onClick={async () => {
                                  const newSettings = { ...settings, heroImageUrl: '' };
                                  setSettings(newSettings);
                                  await setDoc(doc(db, 'settings', 'global'), newSettings);
                                }}
                                className="text-[10px] uppercase tracking-widest text-red-500 hover:underline"
                              >
                                {language === 'en' ? 'Remove Image' : '删除图片'}
                              </button>
                            )}
                            <span className="text-[10px] text-ink/40 uppercase tracking-widest">{language === 'en' ? 'OR' : '或者'}</span>
                          </div>
                          <div>
                            <p className="text-[9px] text-ink/40 uppercase tracking-widest mb-1">{language === 'en' ? 'Paste Image URL' : '粘贴图片链接'}</p>
                            <input 
                              value={settings.heroImageUrl}
                              onChange={(e) => setSettings({ ...settings, heroImageUrl: e.target.value })}
                              className="w-full p-3 bg-ink/5 rounded-lg text-[10px] outline-none focus:ring-1 ring-accent"
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-ink/40 italic">
                      {language === 'en' 
                        ? 'Recommended: 2500x1400px, WebP or JPG, < 1MB for best performance.' 
                        : '建议：2500x1400px，WebP 或 JPG 格式，体积小于 1MB 以获得最佳性能。'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.aboutTitle}</label>
                    <input 
                      value={settings.aboutTitle}
                      onChange={(e) => setSettings({ ...settings, aboutTitle: e.target.value })}
                      className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.aboutDesc}</label>
                    <textarea 
                      value={settings.aboutDesc}
                      onChange={(e) => setSettings({ ...settings, aboutDesc: e.target.value })}
                      className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm h-32"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{language === 'en' ? 'About Section Image' : '关于板块图片'}</label>
                    <div className="flex gap-6 items-start">
                      <div className="w-32 h-40 rounded-xl overflow-hidden bg-ink/5 border border-ink/10 flex-shrink-0">
                        {settings.aboutImageUrl ? (
                          <img src={settings.aboutImageUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink/20"><ImageIcon size={32} /></div>
                        )}
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer text-[9px] uppercase tracking-[0.2em] bg-ink text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity">
                            {language === 'en' ? 'Upload Image' : '上传图片'}
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'about')} />
                          </label>
                          {settings.aboutImageUrl && (
                            <button 
                              onClick={async () => {
                                const newSettings = { ...settings, aboutImageUrl: '' };
                                setSettings(newSettings);
                                await setDoc(doc(db, 'settings', 'global'), newSettings);
                              }}
                              className="text-[9px] uppercase tracking-[0.2em] border border-red-500/20 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              {language === 'en' ? 'Remove' : '删除'}
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[9px] text-ink/40 uppercase tracking-widest">{language === 'en' ? 'Image URL' : '图片链接'}</p>
                          <input 
                            value={settings.aboutImageUrl}
                            onChange={(e) => setSettings({ ...settings, aboutImageUrl: e.target.value })}
                            className="w-full p-3 bg-ink/5 rounded-lg text-[10px] outline-none focus:ring-1 ring-accent"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-[9px] text-ink/40 italic">
                      {language === 'en' 
                        ? 'Recommended: 1000x1250px (4:5 aspect ratio), grayscale style recommended.' 
                        : '建议：1000x1250px（4:5 比例），推荐使用黑白风格。'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.aboutYears}</label>
                      <input 
                        value={settings.aboutYears}
                        onChange={(e) => setSettings({ ...settings, aboutYears: e.target.value })}
                        className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.aboutProjects}</label>
                      <input 
                        value={settings.aboutProjects}
                        onChange={(e) => setSettings({ ...settings, aboutProjects: e.target.value })}
                        className="w-full p-4 bg-ink/5 rounded-xl outline-none focus:ring-1 ring-accent text-sm"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Layout size={14} /> {t.admin.layout}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['masonry', 'grid', 'editorial'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings({ ...settings, galleryLayout: mode })}
                      className={`p-6 rounded-xl border-2 transition-all text-center ${settings.galleryLayout === mode ? 'border-accent bg-accent/5' : 'border-ink/5 hover:border-ink/10'}`}
                    >
                      <span className="block text-[10px] uppercase tracking-widest font-medium mb-1">{mode}</span>
                      <span className="text-[9px] text-ink/40">{mode === 'masonry' ? 'Dynamic Heights' : mode === 'grid' ? 'Perfect Squares' : 'Story-focused'}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-ink/40 flex items-center gap-2">
                  <Palette size={14} /> {t.admin.visual}
                </h3>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.accentColor}</label>
                    <div className="flex gap-4">
                      <input 
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                        className="w-12 h-12 rounded-lg cursor-pointer"
                      />
                      <input 
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                        className="flex-1 p-3 bg-ink/5 rounded-lg outline-none font-mono text-[10px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-ink/40 mb-2">{t.admin.fontFamily}</label>
                    <select 
                      value={settings.fontFamily}
                      onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value as any })}
                      className="w-full p-3 bg-ink/5 rounded-lg outline-none text-[10px] uppercase tracking-widest"
                    >
                      <option value="serif">Classic Serif</option>
                      <option value="sans">Modern Sans</option>
                      <option value="mono">Technical Mono</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}

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
                      placeholder={isAddingByUrl === 'photo' ? "https://..." : "YouTube, Bilibili, or MP4 URL..."}
                    />
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
