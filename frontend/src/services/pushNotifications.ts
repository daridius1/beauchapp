import { Platform } from 'react-native';
import { pb } from './pocketbase';

type PushStatus = 'unsupported' | 'needs-install' | 'unavailable' | 'denied' | 'disabled' | 'enabled';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_PUSH_VAPID_PUBLIC_KEY || '';

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined';

const isStandalone = () => {
  if (!isWeb()) return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || iosNavigator.standalone === true;
};

const isIOS = () => isWeb() && /iPad|iPhone|iPod/.test(navigator.userAgent);

const publicKeyBytes = (key: string) => {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const subscriptionPayload = (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
  };
};

export const pushNotificationService = {
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!isWeb() || !('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  },

  async getStatus(): Promise<PushStatus> {
    if (!isWeb() || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported';
    }
    if (isIOS() && !isStandalone()) return 'needs-install';
    if (!VAPID_PUBLIC_KEY) return 'unavailable';
    if (Notification.permission === 'denied') return 'denied';
    const registration = await this.registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? 'enabled' : 'disabled';
  },

  async enable(): Promise<PushStatus> {
    const before = await this.getStatus();
    if (before === 'unsupported' || before === 'needs-install' || before === 'unavailable' || before === 'denied') return before;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';

    const registration = await this.registerServiceWorker();
    if (!registration) return 'unsupported';
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKeyBytes(VAPID_PUBLIC_KEY),
      });
    }
    await pb.send('/api/push/subscribe', { method: 'POST', body: subscriptionPayload(subscription) });
    return 'enabled';
  },

  async disable(): Promise<void> {
    const registration = await this.registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await pb.send('/api/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  },

  setBadge(count: number) {
    if (!isWeb()) return;
    const badgingNavigator = navigator as Navigator & { setAppBadge?: (value?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count > 0) {
      void badgingNavigator.setAppBadge?.(count);
    } else {
      void badgingNavigator.clearAppBadge?.();
    }
  },
};
