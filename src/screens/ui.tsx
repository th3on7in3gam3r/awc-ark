import React from 'react';
import { ChevronLeft } from 'lucide-react';

export function ArkMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path d="M3 20h28l-4 8H7z" fill="#F2D98A" />
      <rect x="10" y="10" width="14" height="10" fill="#7DE3D0" />
      <rect x="14" y="5" width="6" height="5" fill="#F2D98A" />
    </svg>
  );
}

export function Avatar({ name, initials, url, size = 40, highlight = false }: { name: string; initials: string; url: string | null; size?: number; highlight?: boolean }) {
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt="" style={style} className={`rounded-full object-cover ${highlight ? 'ring-2 ring-ark-gold' : ''}`} />;
  }
  return (
    <span
      aria-hidden="true"
      title={name}
      style={{ ...style, fontSize: Math.max(11, Math.round(size / 3)) }}
      className={`rounded-full flex items-center justify-center font-extrabold shrink-0 ${
        highlight ? 'bg-ark-gold text-ark-wine' : 'bg-ark-line text-ark-cream'
      }`}
    >
      {initials}
    </span>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} aria-label={label} className="w-11 h-11 rounded-xl bg-ark-panel flex items-center justify-center shrink-0">
      <ChevronLeft className="w-5 h-5 text-ark-gold" aria-hidden="true" />
    </a>
  );
}

export function BucksCoin({ size = 52 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size / 5) }}
      className="rounded-full bg-ark-gold text-ark-wine font-arcade flex items-center justify-center shrink-0"
    >
      AWC
    </span>
  );
}
