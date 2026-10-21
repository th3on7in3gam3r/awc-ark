import React from 'react';
import type { GameKey } from '../lib/games';

/** Small pixel previews for the game cards (decoration only). */
export function GameArt({ game }: { game: GameKey }) {
  const box = 'h-[92px] rounded-xl bg-[#0E0409] relative overflow-hidden';
  if (game === 'pong') {
    return (
      <div className={box} aria-hidden="true">
        <div className="absolute left-2.5 top-6 w-1.5 h-9 bg-arc-gold" />
        <div className="absolute right-2.5 top-10 w-1.5 h-9 bg-arc-teal" />
        <div className="absolute left-[42%] top-11 w-2 h-2 bg-arc-cream" />
        <div className="absolute left-1/2 top-0 bottom-0 border-l-2 border-dashed border-ark-line" />
      </div>
    );
  }
  if (game === 'breakout') {
    const colors = ['#F2D98A', '#F2D98A', '#7DE3D0', '#7DE3D0', '#E8A0B4', '#E8A0B4', '#7DE3D0', '#E8A0B4', '#F2D98A', '', '#7DE3D0', '#F2D98A'];
    return (
      <div className={`${box} p-2.5 grid grid-cols-6 gap-[3px] content-start`} aria-hidden="true">
        {colors.map((c, i) => (
          <div key={i} className="h-[9px]" style={{ background: c || 'transparent' }} />
        ))}
        <div className="absolute left-[44%] bottom-3 w-6 h-1.5 bg-arc-cream" />
      </div>
    );
  }
  if (game === 'invaders') {
    return (
      <div className={box} aria-hidden="true">
        {[18, 48, 78, 108].map((x) => (
          <div key={x} className="absolute top-3.5 w-[18px] h-3 bg-arc-teal" style={{ left: x }} />
        ))}
        <div className="absolute left-[66px] bottom-2.5 w-[22px] h-2.5 bg-arc-gold" />
        <div className="absolute left-[76px] bottom-[26px] w-0.5 h-3 bg-arc-cream" />
      </div>
    );
  }
  return (
    <div className={box} aria-hidden="true">
      <div className="absolute left-[50px] top-3 w-[30px] h-2.5 bg-[#E8A0B4]" />
      <div className="absolute left-[60px] top-[22px] w-2.5 h-2.5 bg-[#E8A0B4]" />
      <div className="absolute left-3 right-3 bottom-2.5 h-2.5 bg-arc-teal" />
      <div className="absolute left-3 bottom-5 w-[60px] h-2.5 bg-arc-gold" />
      <div className="absolute right-3 bottom-5 w-[30px] h-2.5 bg-arc-gold" />
    </div>
  );
}
