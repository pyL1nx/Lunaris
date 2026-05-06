import { useEffect, useRef, useCallback } from 'react';

/**
 * useParallax — GPU-accelerated background parallax
 *
 * Returns a ref callback to attach to the parallax container.
 * Directly mutates `style.transform` via rAF for zero React re-renders.
 *
 * Responds to:
 * - Mouse position (relative to viewport center)
 * - Gamepad right analog stick
 *
 * Movement is capped at ±MAX_OFFSET pixels and smoothed with lerp.
 */

const MAX_OFFSET = 5;       // Maximum parallax shift in pixels
const LERP_FACTOR = 0.08;   // Smoothing factor (lower = smoother, higher = snappier)
const GAMEPAD_POLL_MS = 16;  // ~60fps gamepad polling

interface ParallaxState {
  // Target position (from input)
  targetX: number;
  targetY: number;
  // Current interpolated position
  currentX: number;
  currentY: number;
}

export function useParallax(baseScale: number = 1.05) {
  const stateRef = useRef<ParallaxState>({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
  });

  const nodeRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);
  const gamepadTimerRef = useRef<number>(0);

  // The ref callback that consumers attach to their DOM element
  const setRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    // ── Mouse tracking ─────────────────────────────
    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Normalize mouse offset to [-1, 1] range
      const normalizedX = (e.clientX - centerX) / centerX;
      const normalizedY = (e.clientY - centerY) / centerY;

      // Map to pixel offset (inverted for parallax — move opposite to cursor)
      stateRef.current.targetX = normalizedX * MAX_OFFSET;
      stateRef.current.targetY = normalizedY * MAX_OFFSET;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // ── Gamepad right stick tracking ───────────────
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;

      for (const gp of gamepads) {
        if (!gp) continue;
        // Right stick: axes[2] = X, axes[3] = Y
        const rx = gp.axes[2] ?? 0;
        const ry = gp.axes[3] ?? 0;
        const deadzone = 0.15;

        if (Math.abs(rx) > deadzone || Math.abs(ry) > deadzone) {
          stateRef.current.targetX = rx * MAX_OFFSET;
          stateRef.current.targetY = ry * MAX_OFFSET;
        }
      }
    };

    gamepadTimerRef.current = window.setInterval(pollGamepad, GAMEPAD_POLL_MS);

    // ── Animation loop (lerp + direct DOM mutation) ─
    const animate = () => {
      const s = stateRef.current;

      // Lerp current toward target
      s.currentX += (s.targetX - s.currentX) * LERP_FACTOR;
      s.currentY += (s.targetY - s.currentY) * LERP_FACTOR;

      // Snap to target if close enough (avoid sub-pixel jitter)
      if (Math.abs(s.targetX - s.currentX) < 0.01) s.currentX = s.targetX;
      if (Math.abs(s.targetY - s.currentY) < 0.01) s.currentY = s.targetY;

      // Apply directly to DOM — no React re-render
      if (nodeRef.current) {
        nodeRef.current.style.transform =
          `translate3d(${-s.currentX}px, ${-s.currentY}px, 0) scale(${baseScale})`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    // ── Cleanup ────────────────────────────────────
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
      clearInterval(gamepadTimerRef.current);
    };
  }, [baseScale]);

  return setRef;
}
