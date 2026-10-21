import { useEffect, useState } from 'react';
import { isGameKey, type GameKey } from './games';

export type Route =
  | { name: 'home' }
  | { name: 'play'; game: GameKey }
  | { name: 'board'; game: GameKey };

/** "#/play/tetris" → { name: 'play', game: 'tetris' }. Anything else → home. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if ((parts[0] === 'play' || parts[0] === 'board') && isGameKey(parts[1])) {
    return { name: parts[0], game: parts[1] } as Route;
  }
  if (parts[0] === 'board') return { name: 'board', game: 'tetris' };
  return { name: 'home' };
}

export function go(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
