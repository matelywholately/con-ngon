import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Favourite } from '@/lib/alerts';
import { fetchFavourites, setFavourite } from '@/lib/queries';

/**
 * The stores this person follows.
 *
 * Held in one place rather than fetched per screen so the heart on the store
 * page and the heart on a map card cannot disagree, and so tapping one
 * updates the other without a round trip.
 *
 * The toggle is optimistic. Following a shop is not a payment: the cost of
 * showing it as followed for a moment before the server agrees is nothing,
 * and the cost of a heart that takes a second to fill on a bad Cầu Giấy cell
 * is that it feels broken. On failure it rolls back.
 */
type FavouritesValue = {
  favourites: Favourite[];
  isFollowing: (restaurantId: string) => boolean;
  toggle: (restaurantId: string) => Promise<void>;
  /** Whether that store may send a notification, when followed. */
  isNotifying: (restaurantId: string) => boolean;
  setNotify: (restaurantId: string, notify: boolean) => Promise<void>;
  loading: boolean;
};

const FavouritesContext = createContext<FavouritesValue | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFavourites()
      .then((rows) => {
        if (!cancelled) setFavourites(rows);
      })
      .catch(() => {
        // A failed read is an empty shortlist, not a broken screen.
        if (!cancelled) setFavourites([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isFollowing = useCallback(
    (restaurantId: string) => favourites.some((f) => f.restaurantId === restaurantId),
    [favourites],
  );

  const isNotifying = useCallback(
    (restaurantId: string) =>
      favourites.some((f) => f.restaurantId === restaurantId && f.notify),
    [favourites],
  );

  const toggle = useCallback(
    async (restaurantId: string) => {
      const following = favourites.some((f) => f.restaurantId === restaurantId);
      const previous = favourites;
      setFavourites(
        following
          ? favourites.filter((f) => f.restaurantId !== restaurantId)
          : [...favourites, { restaurantId, notify: true }],
      );
      try {
        await setFavourite(restaurantId, !following);
      } catch {
        setFavourites(previous);
      }
    },
    [favourites],
  );

  const setNotify = useCallback(
    async (restaurantId: string, notify: boolean) => {
      const previous = favourites;
      setFavourites(
        favourites.map((f) => (f.restaurantId === restaurantId ? { ...f, notify } : f)),
      );
      try {
        await setFavourite(restaurantId, true, notify);
      } catch {
        setFavourites(previous);
      }
    },
    [favourites],
  );

  const value = useMemo(
    () => ({ favourites, isFollowing, isNotifying, toggle, setNotify, loading }),
    [favourites, isFollowing, isNotifying, toggle, setNotify, loading],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): FavouritesValue {
  const value = useContext(FavouritesContext);
  if (!value) throw new Error('useFavourites must be used inside FavouritesProvider');
  return value;
}
