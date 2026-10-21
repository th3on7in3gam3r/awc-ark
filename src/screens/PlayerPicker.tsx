import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import type { ArkPlayer } from '../lib/api';
import { Avatar } from './ui';

/** "Who's playing?" — you, or one of your children (their scores and AWC Bucks go to them). */
export function PlayerPicker({
  players,
  currentId,
  bucksEnabled,
  onPick,
  onClose,
}: {
  players: ArkPlayer[];
  currentId: string | null;
  bucksEnabled: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-t-[28px] sm:rounded-[28px] bg-ark-night border border-ark-line px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="picker-title" className="m-0 font-arcade text-[13px] text-ark-gold">WHO’S PLAYING?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-ark-muted">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {players.map((p) => {
            const on = p.id === currentId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  aria-pressed={on}
                  className={`w-full min-h-16 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 text-left border ${
                    on ? 'border-ark-gold bg-ark-raised' : 'border-ark-line bg-ark-panel'
                  }`}
                >
                  <Avatar name={p.name} initials={p.initials} url={p.avatarUrl} size={44} highlight={on} />
                  <span className="flex-1">
                    <span className="block font-extrabold">{p.self ? `${p.name} (you)` : p.name}</span>
                    <span className="block text-xs text-ark-muted mt-0.5">
                      {p.isChild && bucksEnabled ? 'Earns AWC Bucks' : p.isChild ? 'Child' : 'Plays for the board'}
                    </span>
                  </span>
                  {on ? <Check className="w-5 h-5 text-ark-gold" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {players.length === 1 ? (
          <p className="m-0 text-xs leading-relaxed text-ark-muted">
            Children added under My Family in AWC Connect show up here, so they can play on your phone and earn their own AWC Bucks.
          </p>
        ) : (
          <p className="m-0 text-xs leading-relaxed text-ark-muted">Pick whoever is holding the phone, so the score and Bucks go to the right person.</p>
        )}
      </div>
    </div>
  );
}
