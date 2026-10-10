import { getAccessToken, nativeStorage, scanQRCode } from 'zmp-sdk/apis';

export const zaloToken = () => getAccessToken();
export const scanPickup = async () => (await scanQRCode()).content;
// The SDK uses Zalo Native Storage on devices. Never store login tokens here.
const previewValues = new Map<string, string>();
const preview = import.meta.env.VITE_DEMO_MODE === 'true';
export const pendingStorage = {
  get: (key: string) => preview ? previewValues.get(key) ?? null : nativeStorage.getItem(key),
  set: (key: string, value: string) => { if (preview) previewValues.set(key, value); else nativeStorage.setItem(key, value); },
  remove: (key: string) => { if (preview) previewValues.delete(key); else nativeStorage.removeItem(key); },
};
