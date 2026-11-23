import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { arkRefreshUrl, fetchArkUpdate } from '../lib/buildUpdate';

declare const __ARK_BUILD_VERSION__: string;

const CHECK_INTERVAL_MS = 60_000;

export function useArkUpdate(): string | null {
  const [update, setUpdate] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV || update) return;
    const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    let pending: AbortController | null = null;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const latest = await fetchArkUpdate(__ARK_BUILD_VERSION__, base, controller.signal);
        if (latest && !controller.signal.aborted) setUpdate(latest);
      } catch {
        // A connection failure or an older cached response must not lock the Ark.
      } finally {
        window.clearTimeout(timeout);
        pending = null;
      }
    };
    const onReturn = () => void check();
    const interval = window.setInterval(onReturn, CHECK_INTERVAL_MS);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReturn);
    window.addEventListener('pageshow', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    void check();
    return () => {
      pending?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReturn);
      window.removeEventListener('pageshow', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [update]);
  return update;
}

export function ArkUpdateRequired({ version }: { version: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  function refresh() {
    const target = arkRefreshUrl(window.location.href, version);
    // If this URL already contains the build id, use a full reload instead of
    // navigating to the same document.
    if (target === window.location.href) window.location.reload();
    else window.location.replace(target);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="ark-update-title"
      aria-describedby="ark-update-message"
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[24px] border border-ark-line bg-ark-night p-6 text-ark-cream shadow-2xl backdrop:bg-black/65"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-ark-panel text-ark-gold">
        <RefreshCw aria-hidden="true" size={22} />
      </div>
      <h1 id="ark-update-title" className="m-0 text-2xl font-extrabold">An Ark update is ready</h1>
      <p id="ark-update-message" className="mb-5 mt-2 text-sm leading-relaxed text-ark-muted">
        Refresh to continue with the latest fixes and features.
      </p>
      <button type="button" autoFocus onClick={refresh} className="min-h-12 w-full rounded-xl bg-ark-gold px-4 font-extrabold text-ark-wine">
        Refresh Ark
      </button>
    </dialog>
  );
}
