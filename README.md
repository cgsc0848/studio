# 0848 Studio - Website

Modern photography and cinematography portfolio with a CMS (Content Management System) powered by Firebase.

## Features
- **Dynamic Content**: Manage photos, videos, and site settings via a secure admin panel.
- **Multilingual**: Support for English and Chinese.
- **Performance Optimized**: Code splitting, lazy loading, and GPU-accelerated animations.
- **Responsive Design**: Fully functional on mobile and desktop.

## Deployment to GitHub Pages

To deploy this project to GitHub Pages, follow these steps:

### 1. Create a GitHub Secret
Go to your GitHub repository settings -> **Secrets and variables** -> **Actions** and add the following secrets (get these from your Firebase console):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_ID` (usually `(default)`)

### 2. Configure GitHub Pages
1. Go to **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **GitHub Actions**.

### 3. Automatic Deployment
Every push to the `main` branch will now automatically trigger a build and deployment to GitHub Pages via the workflow defined in `.github/workflows/deploy.yml`.

## Local Development

```bash
npm install
npm run dev
```

## Site Settings (Firestore)
The site's global settings are stored in the Firestore collection `settings` in a document named `global`. The schema follows the `SiteSettings` interface:

- `heroTitle`: Main title on the landing page.
- `heroImageUrl`: Background image for the hero section.
- `aboutImageUrl`: Image for the "About" section.
- `galleryLayout`: Default layout for the gallery (`masonry`, `grid`, or `editorial`).
- `primaryColor`: Accent color for the site.
- `fontFamily`: Primary font style (`serif`, `sans`, or `mono`).
