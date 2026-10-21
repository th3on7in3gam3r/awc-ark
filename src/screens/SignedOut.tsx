import React from 'react';
import type { ArkError } from '../lib/api';
import { CONNECT_URL } from '../lib/supabase';
import { ArkMark } from './ui';

/** Not signed in (or the Ark can't load): send them to AWC Connect, which signs them in. */
export function SignedOut({ error, onRetry }: { error: ArkError | null; onRetry: () => void }) {
  const signedOut = !error || error.status === 401 || error.code === 'signed_out';
  const unlinked = error?.code === 'unlinked';
  const back = `${CONNECT_URL}/sign-in?returnTo=${encodeURIComponent('/ark/')}`;

  return (
    <main className="min-h-dvh mx-auto w-full max-w-[460px] px-6 py-12 flex flex-col items-center justify-center text-center gap-5">
      <ArkMark size={64} />
      <h1 className="m-0 font-arcade text-xl text-ark-gold">AWC ARK</h1>
      <p className="m-0 text-[15px] leading-relaxed text-ark-muted">
        {signedOut
          ? 'Retro games for the AWC family. Sign in to AWC Connect to play, climb the board, and earn AWC Bucks.'
          : unlinked
            ? error!.message
            : error!.message}
      </p>
      {signedOut || unlinked ? (
        <a href={signedOut ? back : `${CONNECT_URL}/me`} className="h-14 w-full rounded-2xl bg-ark-gold text-ark-wine font-extrabold text-[17px] flex items-center justify-center">
          {signedOut ? 'Sign in with AWC Connect' : 'Open AWC Connect'}
        </a>
      ) : (
        <button type="button" onClick={onRetry} className="h-14 w-full rounded-2xl bg-ark-gold text-ark-wine font-extrabold text-[17px]">
          Try again
        </button>
      )}
    </main>
  );
}
