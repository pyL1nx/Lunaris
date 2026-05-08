import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useGameStore } from '../stores/gameStore';
import GameIcon from './GameIcon';

export default function GameIconCarousel() {
  const games = useGameStore((s) => s.games);
  const selectedIndex = useGameStore((s) => s.selectedIndex);
  const selectByIndex = useGameStore((s) => s.selectByIndex);
  const runningGameIds = useGameStore((s) => s.runningGameIds);
  const openAddModal = useGameStore((s) => s.openAddModal);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { ref: containerRef, focusKey } = useFocusable({
    focusKey: 'ICON_CAROUSEL',
    trackChildren: true,
    isFocusBoundary: false,
  });

  // Auto-scroll to keep selected icon visible
  useEffect(() => {
    if (!scrollRef.current || games.length === 0) return;
    const iconSize = 70;
    const gap = 12;
    const offset = selectedIndex * (iconSize + gap);
    const containerWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({
      left: Math.max(0, offset - containerWidth / 2 + iconSize / 2),
      behavior: 'smooth',
    });
  }, [selectedIndex, games.length]);



  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={containerRef} className="relative px-8 mt-1">
        {/* Icon row */}
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', padding: '14px 14px 54px 34px' }}
        >
          {games.map((game, index) => (
            <GameIcon
              key={game.id}
              game={game}
              index={index}
              isSelected={selectedIndex === index}
              isRunning={runningGameIds.has(game.id)}
              onSelect={() => selectByIndex(index)}
            />
          ))}

          {/* Add game "+" icon */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: games.length * 0.05 + 0.1 }}
            onClick={openAddModal}
            className="flex-shrink-0 w-[70px] h-[70px] rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-white/[0.06]"
            style={{
              border: '2px dashed rgba(255,255,255,0.12)',
              color: '#4a5068',
            }}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.button>
        </div>
      </div>
    </FocusContext.Provider>
  );
}
