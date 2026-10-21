import React, { useEffect, useState } from 'react';
import { Check, EyeOff, Loader2, X } from 'lucide-react';
import { arkApi, ArkError, type ArkPlayer } from '../lib/api';
import { Avatar } from './ui';

/** "Who's playing?" — you, or one of your children (their scores and AWC Bucks go to them). */
export function PlayerPicker({
  players,
  currentId,
  bucksEnabled,
  onPick,
  onClose,
  onPrivacyChanged,
}: {
  players: ArkPlayer[];
  currentId: string | null;
  bucksEnabled: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
  onPrivacyChanged: () => void;
}) {
  // Optimistic copy of each player's "hide my name" choice while the save is in flight.
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => Object.fromEntries(players.map((p) => [p.id, p.hideName])));
  const [saving, setSaving] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  useEffect(() => {
    setHidden(Object.fromEntries(players.map((p) => [p.id, p.hideName])));
  }, [players]);

  const toggleHidden = async (p: ArkPlayer) => {
    if (saving) return;
    const next = !hidden[p.id];
    setPrivacyError(null);
    setSaving(p.id);
    setHidden((h) => ({ ...h, [p.id]: next }));
    try {
      await arkApi.setHideName(p.id, next);
      onPrivacyChanged();
    } catch (err) {
      setHidden((h) => ({ ...h, [p.id]: !next }));
      setPrivacyError(err instanceof ArkError ? err.message : 'We couldn’t save that. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  // Everyone can hide their own name; parents also get a switch for each child.
  const showPrivacy = players.length > 0;
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
        className="w-full max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-ark-night border border-ark-line px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
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

        {showPrivacy ? (
          <section aria-labelledby="privacy-title" className="flex flex-col gap-2 pt-1">
            <h3 id="privacy-title" className="m-0 font-arcade text-[10px] leading-relaxed text-ark-teal">NAMES ON THE BOARDS</h3>
            <ul className="m-0 p-0 list-none rounded-2xl border border-ark-line bg-ark-panel overflow-hidden">
              {players.map((p) => {
                const isHidden = hidden[p.id] === true;
                const first = p.name.split(' ')[0];
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-3 border-t border-ark-line first:border-t-0">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate">{p.self ? 'You' : first}</span>
                      <span className="block text-xs text-ark-muted mt-0.5">
                        {isHidden ? `Others see “Player ${p.initials[0]}.”` : `Others see “${p.name}”`}
                      </span>
                    </span>
                    {saving === p.id ? <Loader2 className="w-4 h-4 animate-spin text-ark-muted" aria-hidden="true" /> : null}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isHidden}
                      aria-label={`Hide ${p.self ? 'your' : `${first}’s`} name on the boards`}
                      disabled={saving != null}
                      onClick={() => void toggleHidden(p)}
                      className={`relative w-[52px] h-8 rounded-full shrink-0 transition-colors disabled:opacity-60 ${isHidden ? 'bg-ark-gold' : 'bg-ark-line'}`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center transition-transform ${isHidden ? 'translate-x-5' : ''}`}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5 text-ark-gold" aria-hidden="true" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {privacyError ? (
              <p className="m-0 text-xs text-ark-gold" role="alert">{privacyError}</p>
            ) : (
              <p className="m-0 text-xs leading-relaxed text-ark-muted">
                Turn on to hide a name. Your family still sees real names; everyone else sees a first initial and no photo.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
