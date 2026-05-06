import { motion } from 'framer-motion';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useGameStore } from '../stores/gameStore';

interface GameIconProps {
  game: import('../stores/gameStore').Game;
  index: number;
  isSelected: boolean;
  isRunning: boolean;
  onSelect: () => void;
}

export default function GameIcon({ game, index, isSelected, isRunning, onSelect }: GameIconProps) {
  const resolvedAssets = useGameStore((s) => s.resolvedAssets);
  const isExeMissing = useGameStore((s) => s.isExeMissing);
  const iconUrl = resolvedAssets[game.icon_path] ?? null;
  const isMissing = isExeMissing(game.id);

  const { ref, focused } = useFocusable({
    focusKey: `GAME_ICON_${game.id}`,
    onEnterPress: onSelect,
    onFocus: onSelect,
  });

  const showGlow = focused || isSelected;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 15, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      onClick={onSelect}
      className="relative flex-shrink-0 cursor-pointer"
    >
      <motion.div
        animate={{
          scale: showGlow ? 1.08 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`relative w-[70px] h-[70px] rounded-2xl overflow-hidden gpu-layer ${showGlow ? 'focus-glow' : ''}`}
        style={{
          boxShadow: isRunning
            ? '0 0 0 2.5px rgba(40,200,80,0.8), 0 0 15px rgba(40,200,80,0.3)'
            : showGlow
              ? undefined
              : '0 4px 15px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.25s ease',
          filter: isMissing ? 'brightness(0.4) grayscale(0.8)' : undefined,
        }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={game.name}
            width={70}
            height={70}
            decoding="async"
            loading="lazy"
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1a1a1a, #0d0d0d)' }}>
            <span className="text-lg font-bold" style={{ color: '#555' }}>
              {game.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Completed checkmark badge */}
        {game.is_completed && (
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(40,200,80,0.9)' }}>
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* Ghost overlay icon for missing exe */}
        {isMissing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-5 h-5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        )}

        {/* Running indicator dot */}
        {isRunning && (
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full"
            style={{ background: '#28c850', border: '1.5px solid rgba(0,0,0,0.3)' }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
