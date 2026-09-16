import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export type InstallHint = 'ios' | 'manual' | null;

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [hint, setHint] = useState<InstallHint>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIosDevice());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHint(null);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canInstall = !installed;

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
      setHint(null);
      return;
    }
    setHint(ios ? 'ios' : 'manual');
  }, [deferred, ios]);

  const dismissHint = useCallback(() => setHint(null), []);

  return {
    canInstall,
    install,
    installed,
    hint,
    dismissHint,
    ios,
    hasNativePrompt: deferred !== null,
  };
}
