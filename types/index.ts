export type CategoryType =
  | 'venue'
  | 'makeup'
  | 'mehndi'
  | 'decorator'
  | 'band'
  | 'dj'
  | 'catering'
  | 'photo-video';

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  isPopular?: boolean;
}

export interface Vendor {
  _id?: string;
  id: string;
  name: string;
  category: CategoryType;
  city: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  image: string;
  images?: string[];
  description: string;
  features: string[];
  packages: Package[];
  isFeatured?: boolean;
}

export interface Category {
  _id?: string;
  id: CategoryType;
  name: string;
  icon: string;
  description: string;
  vendorCount: number;
  image: string;
}

export interface CartItem {
  vendor: Vendor;
  package: Package;
  quantity: number;
}

export interface Enquiry {
  _id?: string;
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  name: string;
  phone: string;
  email?: string;
  eventDate: string;
  guestCount: string;
  eventType: string;
  message?: string;
  createdAt: string;
  status: 'new' | 'contacted' | 'closed';
}

export interface Consultation {
  _id?: string;
  id: string;
  name: string;
  phone: string;
  email: string;
  weddingDate: string;
  days: number;
  guestCount: number;
  foodPreference: string;
  services: string[];
  venueType: string;
  preferredTime?: string;
  message?: string;
  cartItems?: CartItem[];
  totalBudget?: number;
  createdAt: string;
  status: 'new' | 'contacted' | 'closed';
}

export interface FilterParams {
  search?: string;
  city?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: 'rating' | 'price-asc' | 'price-desc' | 'reviews';
}
