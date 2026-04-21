import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a more robust uploads directory outside of public to avoid Vite/Build issues
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const firebaseAdminConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseAdminConfig.projectId,
  });
}

// Access the named database using getFirestore
const adminDb = getFirestore(admin.app(), firebaseAdminConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseAdminConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Fix: Trust proxy for express-rate-limit to work correctly behind Cloud Run/Nginx
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Allow site to be displayed in iFrames (required for AI Studio)
  }));

  // Anti-attack: Rate Limiting (Disabled temporarily for debugging accessibility)
  /*
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (Array.isArray(forwarded)) return forwarded[0];
      if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
      return req.ip || 'unknown';
    }
  });
  app.use('/api/', limiter);
  */
  app.use(express.json());
  app.use('/uploads', express.static(UPLOADS_DIR));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  });
  const upload = multer({ storage });

  // API Routes
  app.get('/api/content', async (req, res) => {
    try {
      const photosSnap = await adminDb.collection('photos').get();
      const videosSnap = await adminDb.collection('videos').get();
      
      const photos = photosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const videos = videosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      res.json({ photos, videos });
    } catch (error) {
      console.error('Error fetching content from Firestore:', error);
      res.json({ photos: [], videos: [], error: 'Database access error' });
    }
  });

  app.get('/api/bilibili-info', async (req, res) => {
    const { bvid } = req.query;
    if (!bvid || typeof bvid !== 'string') {
      return res.status(400).json({ error: 'Missing bvid parameter' });
    }

    try {
      // Use Bilibili public API
      const response = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (response.data && response.data.code === 0) {
        const { title, pic, desc } = response.data.data;
        res.json({ title, thumbnail: pic, description: desc });
      } else {
        res.status(404).json({ error: 'Video not found' });
      }
    } catch (error) {
      console.error('Bilibili API error:', error);
      res.status(500).json({ error: 'Failed to fetch Bilibili info' });
    }
  });
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ 
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
      filename: req.file.filename
    });
  });

  app.get('/api/storage-info', (req, res) => {
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      let totalSize = 0;
      const fileDetails = files.map(file => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        totalSize += stats.size;
        return {
          name: file,
          size: stats.size,
          atime: stats.atime
        };
      });

      res.json({
        totalSize,
        fileCount: files.length,
        files: fileDetails.sort((a, b) => b.atime.getTime() - a.atime.getTime()).slice(0, 50)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get storage info' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
