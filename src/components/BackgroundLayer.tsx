import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

export default function BackgroundLayer() {
  const games = useGameStore((s) => s.games);
  const selectedIndex = useGameStore((s) => s.selectedIndex);
  const resolvedAssets = useGameStore((s) => s.resolvedAssets);
  const isExeMissing = useGameStore((s) => s.isExeMissing);

  // Single Node Swap: only ONE url in state at a time
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0);

  const game = games[selectedIndex] ?? null;
  const bannerUrl = game?.banner_path ? (resolvedAssets[game.banner_path] ?? null) : null;
  const isMissing = game ? isExeMissing(game.id) : false;

  useEffect(() => {
    if (!bannerUrl) {
      setOpacity(0);
      setActiveUrl(null);
      return;
    }

    // Dip to black before swapping
    setOpacity(0.3);
    setActiveUrl(bannerUrl);
  }, [bannerUrl]);

  // Missing exe → heavy dark desaturated filter; normal → full vibrancy
  const bannerFilter = isMissing
    ? 'brightness(0.15) saturate(0.2) grayscale(0.6)'
    : 'saturate(1.15)';

  return (
    <div
      className="fixed z-0 overflow-hidden"
      style={{
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        contain: 'strict',
      }}
    >
      {/* Base — pure black */}
      <div className="absolute inset-0" style={{ background: '#000000' }} />

      {/* SINGLE NODE SWAP: Only one <img> ever exists in DOM */}
      {activeUrl && (
        <img
          src={activeUrl}
          alt=""
          className="absolute inset-0 banner-crisp"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            filter: bannerFilter,
            opacity: opacity,
            transition: 'opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.4s ease',
          }}
          draggable={false}
          onLoad={() => {
            setOpacity(1);
          }}
          onError={() => {
            setOpacity(1);
          }}
        />
      )}

      {/* Unified gradient overlay — text readability layer (bottom→top cinematic vignette) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(to top,
          rgba(0,0,0,0.92) 0%,
          rgba(0,0,0,0.6) 15%,
          transparent 40%,
          transparent 75%,
          rgba(0,0,0,0.5) 100%
        )`,
      }} />
      {/* Left edge vignette — readability for left-aligned game details */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 45%)',
      }} />
    </div>
  );
}
