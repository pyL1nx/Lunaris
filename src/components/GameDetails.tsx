import { motion, AnimatePresence } from 'framer-motion';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useGameStore, formatPlaytimeDetailed, formatPlaytime } from '../stores/gameStore';

export default function GameDetails() {
  const games = useGameStore((s) => s.games);
  const selectedIndex = useGameStore((s) => s.selectedIndex);
  const launchGame = useGameStore((s) => s.launchGame);
  const openEditModal = useGameStore((s) => s.openEditModal);
  const launchError = useGameStore((s) => s.launchError);
  const clearLaunchError = useGameStore((s) => s.clearLaunchError);
  const getPlaytime = useGameStore((s) => s.getPlaytime);
  const runningGameIds = useGameStore((s) => s.runningGameIds);
  const isExeMissing = useGameStore((s) => s.isExeMissing);

  const game = games[selectedIndex] ?? null;
  const isRunning = game ? runningGameIds.has(game.id) : false;
  const isMissing = game ? isExeMissing(game.id) : false;

  const { ref: detailsRef, focusKey } = useFocusable({
    focusKey: 'GAME_DETAILS',
    trackChildren: true,
  });

  const { ref: playRef, focused: playFocused } = useFocusable({
    focusKey: 'PLAY_BTN',
    onEnterPress: () => game && !isRunning && !isMissing && launchGame(game),
  });

  const { ref: optionsRef, focused: optionsFocused } = useFocusable({
    focusKey: 'OPTIONS_BTN',
    onEnterPress: () => game && openEditModal(game),
  });

  if (!game) return null;

  const playtime = getPlaytime(game.exe_path);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={detailsRef} className="fixed bottom-0 left-0 z-20 px-10 pb-10 max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Game title + completed badge */}
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-4xl font-black tracking-tight leading-tight"
                style={{ color: '#ffffff', textShadow: '0 2px 30px rgba(0,0,0,0.7)' }}
              >
                {game.name}
              </h1>
              {game.is_completed && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(40,200,80,0.15)', border: '1px solid rgba(40,200,80,0.3)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#28c850" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[11px] font-bold" style={{ color: '#28c850' }}>Completed</span>
                </div>
              )}
            </div>

            {/* Description / tagline */}
            {game.description && (
              <p className="text-base font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {game.description}
              </p>
            )}

            {/* Playtime */}
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {playtime > 0
                ? `Time Played: ${formatPlaytimeDetailed(playtime)}`
                : 'Not played yet'
              }
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {/* PLAY / NOW PLAYING / MISSING */}
              {isRunning ? (
                <div className="flex items-center gap-3 px-10 py-3 rounded-full"
                  style={{ background: 'rgba(40,200,80,0.12)', border: '1px solid rgba(40,200,80,0.25)' }}>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: '#28c850' }}
                  />
                  <span className="text-sm font-bold" style={{ color: '#28c850' }}>Now Playing</span>
                </div>
              ) : isMissing ? (
                <div className="flex items-center gap-2 px-10 py-3 rounded-full"
                  style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm font-bold" style={{ color: '#ff6b6b' }}>Missing File</span>
                </div>
              ) : (
                <button
                  ref={playRef}
                  onClick={() => launchGame(game)}
                  className={`px-12 py-3 rounded-full text-base font-bold tracking-wide transition-all duration-200 cursor-pointer ${playFocused ? 'focus-glow-play' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#000000' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}
                >
                  Play
                </button>
              )}

              {/* Options "..." */}
              <button
                ref={optionsRef}
                onClick={() => openEditModal(game)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${optionsFocused ? 'focus-glow' : ''}`}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#e8eaf0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>

              {/* Playtime badge (compact) */}
              {playtime > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: '#888' }}>{formatPlaytime(playtime)}</span>
                </div>
              )}
            </div>

            {/* Launch error */}
            <AnimatePresence>
              {launchError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 px-4 py-2 rounded-xl text-xs cursor-pointer"
                  style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.2)', color: '#ff6b6b' }}
                  onClick={clearLaunchError}
                >
                  ⚠ {launchError}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </FocusContext.Provider>
  );
}
