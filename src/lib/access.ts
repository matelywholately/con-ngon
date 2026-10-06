/** Membership enables the workspace; database RLS remains authoritative. */
export function canAccessRestaurant(user: { restaurantId: string | null } | null): boolean {
  return Boolean(user?.restaurantId);
}

export function signInDestination(value: unknown): '/' | '/restaurant' {
  return value === 'restaurant' ? '/restaurant' : '/';
}
