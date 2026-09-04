import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { HANOI_FALLBACK } from '@/lib/fixtures';
import type { Coords } from '@/lib/queries';

export type LocationState = {
  coords: Coords;
  granted: boolean;
  loading: boolean;
  request: () => Promise<void>;
};

/**
 * Falls back to the centre of Cầu Giấy rather than showing an empty screen.
 * A user who declines the permission still gets a usable list — they just see
 * distances from the district centre instead of from where they stand.
 */
export function useLocation(): LocationState {
  const [coords, setCoords] = useState<Coords>(HANOI_FALLBACK);
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  const request = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGranted(false);
      setLoading(false);
      return;
    }
    setGranted(true);
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(async ({ status }) => {
        if (cancelled) return;
        if (status === 'granted') {
          setGranted(true);
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, granted, loading, request };
}
