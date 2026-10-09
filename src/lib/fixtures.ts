/**
 * Development fixtures.
 *
 * These let every screen render in a realistic working state before the
 * Supabase project exists, so the UI can be reviewed on its own. Times are
 * generated relative to "now" so the countdowns actually tick and the
 * urgency states are all reachable while you look at the list.
 *
 * Locations are real streets in Cầu Giấy — the district proposed for the
 * pilot, where students, offices and cheap eateries overlap.
 */
import type { NearbyListing, OrderWithListing, PartnerOrder } from './types';

const minutesFromNow = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

export const DEMO_RESTAURANT_ID = 'r1000000-0000-4000-8000-000000000001';
export const DEMO_USER_ID = 'u1000000-0000-4000-8000-000000000001';

/** Roughly the middle of Cầu Giấy, used as the fallback map centre. */
export const HANOI_FALLBACK = { lat: 21.0313, lng: 105.7902 };

export const fixtureListings: NearbyListing[] = [
  {
    id: 'l1000000-0000-4000-8000-000000000001',
    restaurant_id: DEMO_RESTAURANT_ID,
    title: 'Bún chả nướng than',
    description: 'Chả nướng, bún, rau sống và nước chấm. Đủ cho một người ăn no.',
    photo_url: null,
    portions_total: 8,
    portions_left: 6,
    price_vnd: 25000,
    original_price_vnd: 60000,
    handling_class: 'hot',
    prepared_at: minutesAgo(45),
    pickup_from: minutesAgo(15),
    pickup_until: minutesFromNow(70),
    safety_deadline: minutesFromNow(135),
    status: 'live',
    allergens: ['đậu phộng', 'nước mắm'],
    is_vegetarian: false,
    created_at: minutesAgo(20),
    restaurant_name: 'Quán Bún Chả Hàng Quạt',
    restaurant_address: '12 Trần Thái Tông, Cầu Giấy',
    restaurant_lat: 21.0305,
    restaurant_lng: 105.7887,
    distance_m: 420,
  },
  {
    id: 'l1000000-0000-4000-8000-000000000002',
    restaurant_id: 'r1000000-0000-4000-8000-000000000002',
    title: 'Cơm rang dưa bò',
    description: 'Cơm rang với dưa chua và thịt bò. Còn nóng.',
    photo_url: null,
    portions_total: 5,
    portions_left: 2,
    price_vnd: 20000,
    original_price_vnd: 45000,
    handling_class: 'hot',
    prepared_at: minutesAgo(140),
    pickup_from: minutesAgo(60),
    pickup_until: minutesFromNow(22),
    safety_deadline: minutesFromNow(40),
    status: 'live',
    allergens: [],
    is_vegetarian: false,
    created_at: minutesAgo(55),
    restaurant_name: 'Cơm Bình Dân Dịch Vọng',
    restaurant_address: '87 Dịch Vọng Hậu, Cầu Giấy',
    restaurant_lat: 21.0361,
    restaurant_lng: 105.7823,
    distance_m: 890,
  },
  {
    id: 'l1000000-0000-4000-8000-000000000003',
    restaurant_id: 'r1000000-0000-4000-8000-000000000003',
    title: 'Bánh mì thập cẩm',
    description: 'Bánh mì kẹp pate, chả, rau. Nướng lại là ngon như mới.',
    photo_url: null,
    portions_total: 12,
    portions_left: 9,
    price_vnd: 10000,
    original_price_vnd: 25000,
    handling_class: 'ambient',
    prepared_at: minutesAgo(200),
    pickup_from: minutesAgo(120),
    pickup_until: minutesFromNow(240),
    safety_deadline: minutesFromNow(460),
    status: 'live',
    allergens: ['gluten', 'trứng'],
    is_vegetarian: false,
    created_at: minutesAgo(100),
    restaurant_name: 'Bánh Mì 25 Nguyễn Phong Sắc',
    restaurant_address: '25 Nguyễn Phong Sắc, Cầu Giấy',
    restaurant_lat: 21.0398,
    restaurant_lng: 105.7901,
    distance_m: 1150,
  },
  {
    id: 'l1000000-0000-4000-8000-000000000004',
    restaurant_id: 'r1000000-0000-4000-8000-000000000004',
    title: 'Đậu phụ sốt cà chua + cơm',
    description: 'Suất chay đầy đủ: đậu phụ sốt cà, rau luộc, cơm trắng.',
    photo_url: null,
    portions_total: 6,
    portions_left: 6,
    price_vnd: 0,
    original_price_vnd: 35000,
    handling_class: 'hot',
    prepared_at: minutesAgo(30),
    pickup_from: minutesAgo(5),
    pickup_until: minutesFromNow(95),
    safety_deadline: minutesFromNow(150),
    status: 'live',
    allergens: ['đậu nành'],
    is_vegetarian: true,
    created_at: minutesAgo(12),
    restaurant_name: 'Quán Chay An Lạc',
    restaurant_address: '4 Trần Quốc Hoàn, Cầu Giấy',
    restaurant_lat: 21.0421,
    restaurant_lng: 105.7935,
    distance_m: 1380,
  },
  {
    id: 'l1000000-0000-4000-8000-000000000005',
    restaurant_id: 'r1000000-0000-4000-8000-000000000005',
    title: 'Sữa chua nếp cẩm',
    description: 'Sữa chua tự làm với nếp cẩm. Bảo quản lạnh liên tục.',
    photo_url: null,
    portions_total: 10,
    portions_left: 4,
    price_vnd: 8000,
    original_price_vnd: 20000,
    handling_class: 'chilled',
    prepared_at: minutesAgo(300),
    pickup_from: minutesAgo(180),
    pickup_until: minutesFromNow(180),
    safety_deadline: minutesFromNow(1020),
    status: 'live',
    allergens: ['sữa'],
    is_vegetarian: true,
    created_at: minutesAgo(150),
    restaurant_name: 'Sữa Chua Cô Hoa',
    restaurant_address: '31 Nguyễn Khánh Toàn, Cầu Giấy',
    restaurant_lat: 21.0349,
    restaurant_lng: 105.8004,
    distance_m: 1490,
  },
];

export const fixtureOrders: OrderWithListing[] = [
  {
    id: 'o1000000-0000-4000-8000-000000000001',
    listing_id: fixtureListings[0]!.id,
    eater_id: 'u1000000-0000-4000-8000-000000000001',
    portions: 1,
    price_paid_vnd: 25000,
    payment_method: 'cash',
    pickup_code: '0421',
    status: 'reserved',
    reserved_at: minutesAgo(8),
    collected_at: null,
    credit_used_vnd: 0,
    reservation_request_id: null,
    listing: {
      title: fixtureListings[0]!.title,
      photo_url: null,
      pickup_from: fixtureListings[0]!.pickup_from,
      pickup_until: fixtureListings[0]!.pickup_until,
      safety_deadline: fixtureListings[0]!.safety_deadline,
      prepared_at: fixtureListings[0]!.prepared_at,
      handling_class: 'hot',
      restaurant: {
        id: fixtureListings[0]!.restaurant_id,
        name: fixtureListings[0]!.restaurant_name,
        address: fixtureListings[0]!.restaurant_address,
        lat: fixtureListings[0]!.restaurant_lat,
        lng: fixtureListings[0]!.restaurant_lng,
        pickup_instructions: 'Vào cửa bên trái, hỏi quầy thu ngân.',
      },
    },
  },
];

export const fixturePartnerOrders: PartnerOrder[] = [
  {
    id: 'o1000000-0000-4000-8000-000000000001',
    listing_id: fixtureListings[0]!.id,
    eater_id: 'u1000000-0000-4000-8000-000000000001',
    portions: 1,
    price_paid_vnd: 25000,
    payment_method: 'cash',
    pickup_code: '0421',
    status: 'reserved',
    reserved_at: minutesAgo(8),
    collected_at: null,
    credit_used_vnd: 0,
    reservation_request_id: null,
    listing_title: fixtureListings[0]!.title,
    eater_name: 'Minh',
  },
  {
    id: 'o1000000-0000-4000-8000-000000000002',
    listing_id: fixtureListings[0]!.id,
    eater_id: 'u1000000-0000-4000-8000-000000000002',
    portions: 2,
    price_paid_vnd: 50000,
    payment_method: 'vietqr',
    pickup_code: '7318',
    status: 'reserved',
    reserved_at: minutesAgo(3),
    collected_at: null,
    credit_used_vnd: 0,
    reservation_request_id: null,
    listing_title: fixtureListings[0]!.title,
    eater_name: 'Hương',
  },
];

/** Listings the demo restaurant currently has live, for the partner home. */
export const fixturePartnerListings: NearbyListing[] = fixtureListings.filter(
  (l) => l.restaurant_id === DEMO_RESTAURANT_ID,
);
