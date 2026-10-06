import { canReserve, pickupDeadline } from '../../src/lib/reservations.ts';
import type { NearbyListing } from '../../src/lib/types';

export type MealFilter = 'all' | 'vegetarian' | 'budget' | 'soon';
export type MealSort = 'nearby' | 'deadline' | 'price';
export const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();

/** Filter actual listing fields; never infer dietary information from a dish name. */
export function mealCatalog(listings: NearbyListing[], now: Date, query = '', filter: MealFilter = 'all', sort: MealSort = 'nearby') {
  const words = searchText(query).split(/\s+/).filter(Boolean);
  return listings.filter(value => {
    if (!canReserve(value, now)) return false;
    if (filter === 'vegetarian' && !value.is_vegetarian) return false;
    if (filter === 'budget' && value.price_vnd > 25_000) return false;
    if (filter === 'soon' && pickupDeadline(value).getTime() - now.getTime() > 30 * 60_000) return false;
    const haystack = searchText(`${value.title} ${value.restaurant_name} ${value.restaurant_address}`);
    return words.every(word => haystack.includes(word));
  }).sort((a, b) => {
    if (sort === 'price') return a.price_vnd - b.price_vnd || a.distance_m - b.distance_m;
    if (sort === 'deadline') return pickupDeadline(a).getTime() - pickupDeadline(b).getTime() || a.distance_m - b.distance_m;
    return a.distance_m - b.distance_m;
  });
}
