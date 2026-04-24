export type Category = string;

export interface Photo {
  id: string;
  url: string;
  storagePath?: string;
  title: string;
  category: Category;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  createdAt?: string;
}

export interface Video {
  id: string;
  thumbnail: string;
  thumbnailPath?: string;
  videoUrl: string;
  videoPath?: string;
  title: string;
  category: Category;
  description: string;
  createdAt?: string;
}
