import { Platform } from 'react-native';
import { pb, POCKETBASE_URL } from './pocketbase';

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
    if (!VAPID_PUBLIC_KEY) return 'unavailable';
    if (isIOS() && !isStandalone()) return 'needs-install';
    if (Notification.permission === 'denied') return 'denied';
    const registration = await this.registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription || !pb.authStore.isValid) return 'disabled';
    const status = await pb.send('/api/push/subscription-status', {
      method: 'GET',
      query: { endpoint: subscription.endpoint },
    });
    return status.active ? 'enabled' : 'disabled';
  },

  async enable(): Promise<PushStatus> {
    if (!isWeb() || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported';
    }
    if (!VAPID_PUBLIC_KEY) return 'unavailable';
    if (isIOS() && !isStandalone()) return 'needs-install';
    if (Notification.permission === 'denied') return 'denied';

    // La solicitud debe seguir directamente al toque del botón, especialmente en iOS.
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
    try {
      await pb.send('/api/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
    } catch (err) {
      console.warn('No se pudo dar de baja la suscripción remota:', err);
    }
    await subscription.unsubscribe();
  },

  async releaseOnLogout(token: string): Promise<void> {
    if (!isWeb() || !('serviceWorker' in navigator)) return;
    const registration = await this.registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    // Aunque la baja remota falle, invalidar la suscripción del navegador evita que
    // este dispositivo siga mostrando avisos de la cuenta que acaba de salir.
    await subscription.unsubscribe();
    if (!token) return;
    try {
      await fetch(`${POCKETBASE_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Authorization': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    } catch (err) {
      console.warn('No se pudo dar de baja la suscripción remota:', err);
    }
  },

  async reconcileForCurrentUser(): Promise<void> {
    if (!isWeb() || !('serviceWorker' in navigator) || !pb.authStore.isValid) return;
    const registration = await this.registerServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const status = await pb.send('/api/push/subscription-status', {
      method: 'GET',
      query: { endpoint: subscription.endpoint },
    });
    // Una instalación anterior puede haber dejado una suscripción asociada a otra
    // cuenta. Se desactiva localmente antes de mostrar sus avisos a la sesión nueva.
    if (!status.active) await subscription.unsubscribe();
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
