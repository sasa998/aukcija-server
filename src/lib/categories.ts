export const CATEGORIES = [
  { id: 'electronics', name: 'Elektronika', icon: '💻' },
  { id: 'fashion', name: 'Moda', icon: '👗' },
  { id: 'home-living', name: 'Dom i život', icon: '🏠' },
  { id: 'art', name: 'Umetnost', icon: '🎨' },
  { id: 'collectibles', name: 'Kolekcionarstvo', icon: '🏺' },
  { id: 'books-media', name: 'Knjige i mediji', icon: '📚' },
  { id: 'vehicles', name: 'Vozila i delovi', icon: '🚗' },
  { id: 'sports', name: 'Sport i rekreacija', icon: '⚽' },
  { id: 'toys-hobbies', name: 'Igračke i hobiji', icon: '🧸' },
  { id: 'music', name: 'Muzika', icon: '🎸' },
  { id: 'luxury', name: 'Luksuz', icon: '💎' },
  { id: 'antiques', name: 'Antikviteti', icon: '🖼️' },
  { id: 'industrial', name: 'Industrija i alati', icon: '🧪' },
  { id: 'other', name: 'Ostalo', icon: '🌿' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
