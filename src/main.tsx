import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CONNECT_URL } from './lib/supabase';
import { installSoundUnlock } from './services/sound';
import './index.css';

/**
 * Members sign in on AWC Connect, and that sign-in is only visible at Connect's own
 * address. So the Ark always runs at awc-connect.vercel.app/ark — opening
 * awc-ark.vercel.app directly forwards there (local dev is left alone).
 */
function shouldForwardToConnect(): boolean {
  try {
    const connect = new URL(CONNECT_URL);
    const { hostname, host } = window.location;
    if (host === connect.host) return false;
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '[::1]') return false;
    return true;
  } catch {
    return false;
  }
}

if (shouldForwardToConnect()) {
  window.location.replace(`${CONNECT_URL}/ark/${window.location.hash || ''}`);
} else {
  installSoundUnlock();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
