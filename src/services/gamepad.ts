import { useEffect, useState, useRef } from 'react';
import { GamepadState } from '../types';

export function getCleanGamepadState(pad: Gamepad | null): GamepadState | null {
  if (!pad) return null;

  const buttons = pad.buttons;
  const isDown = (idx: number) => Boolean(buttons[idx] && (buttons[idx].pressed || buttons[idx].value > 0.5));

  const axes: [number, number, number, number] = [
    pad.axes[0] ?? 0,
    pad.axes[1] ?? 0,
    pad.axes[2] ?? 0,
    pad.axes[3] ?? 0,
  ];

  // D-pad handling: either separate buttons (12: up, 13: down, 14: left, 15: right) or axes
  const up = isDown(12) || axes[1] < -0.4;
  const down = isDown(13) || axes[1] > 0.4;
  const left = isDown(14) || axes[0] < -0.4;
  const right = isDown(15) || axes[0] > 0.4;

  return {
    connected: pad.connected,
    id: pad.id,
    index: pad.index,
    axes,
    buttons: {
      a: isDown(0),      // Cross / A
      b: isDown(1),      // Circle / B
      x: isDown(2),      // Square / X
      y: isDown(3),      // Triangle / Y
      lb: isDown(4),     // L1
      rb: isDown(5),     // R1
      up,
      down,
      left,
      right,
      start: isDown(9),  // Start / Options
      select: isDown(8), // Select / Share
    },
  };
}

export function useGamepad() {
  const [controllers, setControllers] = useState<(GamepadState | null)[]>([null, null]);
  const [hasAnyController, setHasAnyController] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastSigRef = useRef('');

  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      setHasAnyController(true);
    };

    const handleDisconnected = (e: GamepadEvent) => {
      const remaining = navigator.getGamepads().filter(Boolean);
      setHasAnyController(remaining.length > 0);
    };

    window.addEventListener('gamepadconnected', handleConnected);
    window.addEventListener('gamepaddisconnected', handleDisconnected);

    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad1 = pads[0] ? getCleanGamepadState(pads[0]) : null;
      const pad2 = pads[1] ? getCleanGamepadState(pads[1]) : null;

      const anyConnected = Boolean(pad1?.connected || pad2?.connected);
      // Only re-render when something actually changed (no controller = no updates).
      const sig = JSON.stringify([pad1, pad2]);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setHasAnyController(anyConnected);
        setControllers([pad1, pad2]);
      }
      animFrameRef.current = requestAnimationFrame(poll);
    };

    animFrameRef.current = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnected);
      window.removeEventListener('gamepaddisconnected', handleDisconnected);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return {
    controllers,
    player1: controllers[0],
    player2: controllers[1],
    hasAnyController,
  };
}
