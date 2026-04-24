import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getReferrerPolicy(url?: string): "no-referrer" | "strict-origin-when-cross-origin" {
  if (!url) return "strict-origin-when-cross-origin";
  
  // Domains that block hotlinking (Anti-leech) and require no-referrer
  const antiLeechDomains = [
    'hdslb.com',      // Bilibili
    'i0.hdslb.com',
    'i1.hdslb.com',
    'i2.hdslb.com',
    'images.unsplash.com',
    'buyee.jp',
    'baidu.com'
  ];
  
  const isAntiLeech = antiLeechDomains.some(domain => url.includes(domain));
  return isAntiLeech ? "no-referrer" : "strict-origin-when-cross-origin";
}
