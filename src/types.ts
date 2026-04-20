export type Category = 'Editorial' | 'Cinematic' | 'Personal' | 'Commercial' | 'All';

export interface Photo {
  id: string;
  url: string;
  title: string;
  category: Category;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  createdAt?: string;
}

export interface Video {
  id: string;
  thumbnail: string;
  videoUrl: string;
  title: string;
  category: Category;
  description: string;
  createdAt?: string;
}
