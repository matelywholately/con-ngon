import type { HandlingClass } from './safety';

export type UserRole = 'eater' | 'partner_staff' | 'ngo' | 'admin';
export type ListingStatus = 'draft' | 'live' | 'sold_out' | 'expired' | 'withdrawn';
export type OrderStatus = 'reserved' | 'collected' | 'no_show' | 'cancelled' | 'incident';
export type PaymentMethod = 'cash' | 'vietqr' | 'momo' | 'zalopay' | 'credit';
export type RestaurantStatus = 'pending' | 'approved' | 'suspended';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  locale: 'vi' | 'en';
  credit_balance_vnd: number;
  created_at: string;
};

/**
 * What kind of place a venue is.
 *
 * Mirrors the `venue_type` enum in `0008_venue_type.sql`. It exists to test
 * the product's riskiest assumption: batch surplus comes from places that
 * cook to a forecast (trays, bakeries, buffets, canteens, hot counters), not
 * from kitchens that cook to order. Nullable, because an unclassified venue
 * is missing data rather than a default one.
 */
export type VenueType =
  | 'com_binh_dan'
  | 'bakery'
  | 'buffet'
  | 'canteen'
  | 'convenience'
  | 'restaurant'
  | 'cafe'
  | 'street_stall';

export type Restaurant = {
  id: string;
  name: string;
  address: string;
  district: string;
  phone: string | null;
  status: RestaurantStatus;
  venue_type: VenueType | null;
  pickup_instructions: string | null;
  lat: number;
  lng: number;
};

export type Listing = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  portions_total: number;
  portions_left: number;
  price_vnd: number;
  original_price_vnd: number | null;
  handling_class: HandlingClass;
  prepared_at: string;
  pickup_from: string;
  pickup_until: string;
  /** Server-computed. Clients display it; they never write it. */
  safety_deadline: string;
  status: ListingStatus;
  allergens: string[];
  is_vegetarian: boolean;
  created_at: string;
};

/**
 * Shape returned by the `nearby_listings` RPC: a listing joined to the fields
 * of its restaurant that a discover card needs, plus the computed distance.
 * Denormalised on purpose — the list is the hottest read path in the app.
 */
export type NearbyListing = Listing & {
  restaurant_name: string;
  restaurant_address: string;
  restaurant_lat: number;
  restaurant_lng: number;
  distance_m: number;
};

/**
 * Shape returned by the `nearby_stores` RPC: one row per restaurant with the
 * live offers aggregated, so the map can draw a pin without pulling every
 * listing behind it. Snake case because it comes straight off Postgres;
 * `queries.rowToStore` is what turns it into the camel-case `StoreMarker` the
 * components use.
 */
export type NearbyStoreRow = {
  id: string;
  name: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  distance_m: number;
  offer_count: number;
  portions_left: number;
  min_price_vnd: number;
  best_discount_percent: number | null;
  soonest_deadline: string;
  has_free: boolean;
};

export type Order = {
  id: string;
  listing_id: string;
  eater_id: string;
  portions: number;
  price_paid_vnd: number;
  payment_method: PaymentMethod;
  pickup_code: string;
  status: OrderStatus;
  reserved_at: string;
  collected_at: string | null;
};

export type OrderWithListing = Order & {
  listing: Pick<
    Listing,
    'title' | 'photo_url' | 'pickup_from' | 'pickup_until' | 'safety_deadline' | 'prepared_at' | 'handling_class'
  > & {
    restaurant: Pick<Restaurant, 'name' | 'address' | 'lat' | 'lng' | 'pickup_instructions'>;
  };
};

/** Row shape the partner orders board renders. */
export type PartnerOrder = Order & {
  listing_title: string;
  eater_name: string | null;
};
