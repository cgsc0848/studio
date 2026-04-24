export type Category = string;

export interface Photo {
  id: string;
  url: string;
  title: string;
  category: Category;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  isPinned?: boolean;
  orderWeight?: number;
  createdAt?: string;
}

export interface Video {
  id: string;
  thumbnail: string;
  videoUrl: string;
  title: string;
  category: Category;
  description: string;
  isPinned?: boolean;
  orderWeight?: number;
  createdAt?: string;
}
