/* PWA install-prompt plumbing.
   Chrome fires `beforeinstallprompt` once the app meets install criteria — often
   BEFORE any React component has mounted. We capture it at module load (this file
   is imported for its side effect in main.tsx) and stash it, so a late-mounting
   banner can still offer a one-tap install. iOS/Safari never fires this event;
   the banner falls back to manual "Add to Home Screen" instructions there. */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();
const notify = () => listeners.forEach(fn => fn(deferred));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();            // suppress Chrome's default mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;              // once installed the event never fires again
    notify();
  });
}

export function getDeferredPrompt() {
  return deferred;
}

export function clearDeferredPrompt() {
  deferred = null;
  notify();
}

/* Subscribe to changes; returns an unsubscribe fn. */
export function onInstallPromptChange(fn: (e: BeforeInstallPromptEvent | null) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* True when the app is already running as an installed PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mm || iosStandalone);
}

/* True on iOS/iPadOS, where install is manual (Share -> Add to Home Screen). */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iphone = /iphone|ipad|ipod/i.test(ua);
  const ipadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iphone || ipadOS;
}

/* True on phones/tablets. Desktop Chrome also fires beforeinstallprompt, so we
   gate the banner on this to keep it mobile-only. */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const uaMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
  return Boolean(coarse) || uaMobile;
}
