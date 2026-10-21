import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { arkApi, ArkError, type ArkMe, type ArkPlayer } from './lib/api';
import { useRoute } from './lib/route';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Leaderboard } from './screens/Leaderboard';
import { SignedOut } from './screens/SignedOut';
import { PlayerPicker } from './screens/PlayerPicker';

const PLAYER_KEY = 'awc.ark.player';

function readSavedPlayer(): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const route = useRoute();
  const [me, setMe] = useState<ArkMe | null>(null);
  const [error, setError] = useState<ArkError | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string | null>(readSavedPlayer);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await arkApi.me();
      setMe(data);
      setError(null);
      setPlayerId((current) => {
        if (current && data.players.some((p) => p.id === current)) return current;
        return data.players.find((p) => p.self)?.id || data.players[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof ArkError ? err : new ArkError('The Ark is not available right now.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!isSupabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void load();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const choosePlayer = (id: string) => {
    setPlayerId(id);
    setPickerOpen(false);
    try {
      localStorage.setItem(PLAYER_KEY, id);
    } catch {
      /* private mode */
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-ark-gold" aria-label="Loading the Ark" />
      </main>
    );
  }

  if (!me || error) {
    return <SignedOut error={error} onRetry={() => { setLoading(true); void load(); }} />;
  }

  const player: ArkPlayer | null = me.players.find((p) => p.id === playerId) || me.players[0] || null;

  /** After a game: refresh bests and Bucks quietly. */
  const refresh = () => void load();

  return (
    <>
      {route.name === 'home' && (
        <Home me={me} player={player} onPickPlayer={() => setPickerOpen(true)} />
      )}
      {route.name === 'play' && player && (
        <Play key={route.game} game={route.game} player={player} settings={me.settings} onPickPlayer={() => setPickerOpen(true)} onScoreSaved={refresh} />
      )}
      {route.name === 'board' && <Leaderboard game={route.game} />}
      {pickerOpen && (
        <PlayerPicker players={me.players} currentId={player?.id || null} bucksEnabled={me.settings.bucksEnabled} onPick={choosePlayer} onClose={() => setPickerOpen(false)} onPrivacyChanged={refresh} />
      )}
    </>
  );
}
