import { useEffect, useRef, useCallback } from 'react';

// ==============================================
// Gamepad Button Mapping
// ==============================================

interface GamepadActions {
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onA?: () => void;       // Cross / A — select
  onB?: () => void;       // Circle / B — back
  onStart?: () => void;   // Options / Start
}

// Standard Gamepad button indices
const BUTTON_A = 0;         // Cross (PS) / A (Xbox)
const BUTTON_B = 1;         // Circle (PS) / B (Xbox)
const BUTTON_START = 9;     // Options (PS) / Start (Xbox)
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

const STICK_DEADZONE = 0.5;
const REPEAT_DELAY = 250;   // ms between repeat inputs

export function useGamepad(actions: GamepadActions) {
  const lastInputTime = useRef<Record<string, number>>({});
  const frameRef = useRef<number>(0);

  const canFire = useCallback((key: string) => {
    const now = Date.now();
    const last = lastInputTime.current[key] ?? 0;
    if (now - last > REPEAT_DELAY) {
      lastInputTime.current[key] = now;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const poll = () => {
      const gamepads = navigator.getGamepads();
      if (!gamepads) {
        frameRef.current = requestAnimationFrame(poll);
        return;
      }

      for (const gp of gamepads) {
        if (!gp) continue;

        // D-Pad
        if (gp.buttons[DPAD_LEFT]?.pressed && canFire('left')) actions.onLeft?.();
        if (gp.buttons[DPAD_RIGHT]?.pressed && canFire('right')) actions.onRight?.();
        if (gp.buttons[DPAD_UP]?.pressed && canFire('up')) actions.onUp?.();
        if (gp.buttons[DPAD_DOWN]?.pressed && canFire('down')) actions.onDown?.();

        // Left analog stick
        const lx = gp.axes[0] ?? 0;
        const ly = gp.axes[1] ?? 0;
        if (lx < -STICK_DEADZONE && canFire('stickLeft')) actions.onLeft?.();
        if (lx > STICK_DEADZONE && canFire('stickRight')) actions.onRight?.();
        if (ly < -STICK_DEADZONE && canFire('stickUp')) actions.onUp?.();
        if (ly > STICK_DEADZONE && canFire('stickDown')) actions.onDown?.();

        // Buttons
        if (gp.buttons[BUTTON_A]?.pressed && canFire('a')) actions.onA?.();
        if (gp.buttons[BUTTON_B]?.pressed && canFire('b')) actions.onB?.();
        if (gp.buttons[BUTTON_START]?.pressed && canFire('start')) actions.onStart?.();
      }

      frameRef.current = requestAnimationFrame(poll);
    };

    frameRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frameRef.current);
  }, [actions, canFire]);
}
