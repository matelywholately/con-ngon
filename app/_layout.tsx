import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import { SessionProvider } from '@/features/session';
import { FavouritesProvider } from '@/features/useFavourites';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_800ExtraBold,
  });

  useEffect(() => {
    // Hide on error too: a missing font should degrade to the system face,
    // not leave the user staring at a splash screen forever.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <FavouritesProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ground },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(eater)" />
          <Stack.Screen name="(partner)" />
          <Stack.Screen name="offer/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="store/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="reserve/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pass/[orderId]" options={{ presentation: 'card' }} />
          <Stack.Screen name="safety" options={{ presentation: 'modal' }} />
        </Stack>
      </FavouritesProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
