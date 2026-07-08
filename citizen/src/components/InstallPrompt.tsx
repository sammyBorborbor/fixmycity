import { useEffect, useState } from 'react';
import Icon from './Icon.tsx';
import Btn from './Btn.tsx';
import {
  getDeferredPrompt,
  onInstallPromptChange,
  clearDeferredPrompt,
  isStandalone,
  isIOS,
  isMobile,
  type BeforeInstallPromptEvent,
} from '../lib/installPrompt.ts';

// Session-scoped so a dismissal reappears next visit, not permanently.
const DISMISS_KEY = 'fmc-install-dismissed';

/* Dismissible "install this app" banner. Shows a one-tap Install button on
   Android/Chrome (via the captured beforeinstallprompt event) and manual
   Add-to-Home-Screen instructions on iOS. Mobile-only; renders nothing once
   installed or after the user dismisses it for the session. */
export default function InstallPrompt({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(getDeferredPrompt());
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');
  const [installed, setInstalled] = useState(isStandalone());
  const ios = isIOS();

  useEffect(() => onInstallPromptChange(e => {
    setDeferred(e);
    if (!e && isStandalone()) setInstalled(true);
  }), []);

  if (installed || dismissed || !isMobile()) return null;
  const canPrompt = Boolean(deferred);
  if (!canPrompt && !ios) return null; // no install path on this browser

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    clearDeferredPrompt();
    setDeferred(null);
    if (outcome === 'accepted') setInstalled(true);
  };

  return (
    <div className={`relative bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex items-start gap-3 ${className}`}>
      <button onClick={dismiss} aria-label="Dismiss" className="absolute top-2 right-2 text-gray-400 p-1 rounded-lg hover:bg-gray-100">
        <Icon name="X" size={16} />
      </button>

      <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 text-white"
        style={{ background: 'linear-gradient(135deg,#0B2545 0%,#1E5F8E 100%)' }}>
        <Icon name="Smartphone" size={22} />
      </span>

      <div className="min-w-0 flex-1 pr-5">
        <p className="font-bold text-navy text-sm">Install FixMyCity</p>
        {canPrompt ? (
          <>
            <p className="text-xs text-muted mt-0.5">Add the app to your phone for faster access and offline use.</p>
            <Btn size="sm" variant="gold" icon="Download" className="mt-2.5" onClick={install}>
              Install app
            </Btn>
          </>
        ) : (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Tap{' '}
            <span className="inline-flex items-center gap-0.5 font-semibold text-navy align-middle">
              <Icon name="Share" size={12} /> Share
            </span>{' '}
            then <span className="font-semibold text-navy">Add to Home Screen</span> to install.
          </p>
        )}
      </div>
    </div>
  );
}
