import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useGameStore, formatPlaytimeDetailed, formatPlaytime } from '../stores/gameStore';

interface SteamAchievement {
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
}

function formatLastPlayed(timestamp: number): string {
  const d = new Date(timestamp);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} - ${month} - ${year} ( ${hours}:${minutes} )`;
}

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
  const isEmulatorMissing = useGameStore((s) => s.isEmulatorMissing);

  const game = games[selectedIndex] ?? null;
  const isRunning = game ? runningGameIds.has(game.id) : false;
  const isMissing = game ? isExeMissing(game.id) : false;
  const isMissingEmu = game ? isEmulatorMissing(game.id) : false;

  const { ref: detailsRef, focusKey } = useFocusable({
    focusKey: 'GAME_DETAILS',
    trackChildren: true,
  });

  const { ref: playRef, focused: playFocused } = useFocusable({
    focusKey: 'PLAY_BTN',
    onEnterPress: () => game && !isRunning && !isMissing && !isMissingEmu && launchGame(game),
  });

  const { ref: optionsRef, focused: optionsFocused } = useFocusable({
    focusKey: 'OPTIONS_BTN',
    onEnterPress: () => game && openEditModal(game),
  });

  const [achievements, setAchievements] = useState<SteamAchievement[]>([]);
  const [unlockedAchs, setUnlockedAchs] = useState<Set<string>>(new Set());

  // Fetch achievements
  useEffect(() => {
    if (!game || !game.steam_id) {
      setAchievements([]);
      setUnlockedAchs(new Set());
      return;
    }
    const apiKey = localStorage.getItem('steamApiKey');
    if (!apiKey) return;

    let active = true;
    const fetchAchs = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Fetch schema
        const res = await invoke<SteamAchievement[]>('fetch_steam_achievements', { 
          steamId: game.steam_id, 
          apiKey 
        });
        if (!active) return;
        setAchievements(res);
        
        // Fetch unlocked status from Goldberg
        const unl = await invoke<string[]>('get_unlocked_achievements', { 
          steamId: game.steam_id 
        });
        if (active) setUnlockedAchs(new Set(unl));

        // Start watcher
        await invoke('start_achievement_watcher', { steamId: game.steam_id });
      } catch (e) {
        console.error(e);
      }
    };
    fetchAchs();

    // Listen for real-time unlocks
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string[]>('achievements-refreshed', (event) => {
        if (active) {
          setUnlockedAchs(new Set(event.payload));
        }
      }).then((u) => { unlisten = u; });
    });

    return () => { 
      active = false; 
      if (unlisten) unlisten();
    };
  }, [game?.steam_id]);

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
            {/* Game title + favourite + completed badge */}
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-4xl font-black tracking-tight leading-tight"
                style={{ color: '#ffffff', textShadow: '0 2px 30px rgba(0,0,0,0.7)' }}
              >
                {game.name}
              </h1>
              {game.is_favourite && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,200,50,0.15)', border: '1px solid rgba(255,200,50,0.3)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#ffc832" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                  </svg>
                  <span className="text-[11px] font-bold" style={{ color: '#ffc832' }}>Favourite</span>
                </div>
              )}
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

            {/* Playtime & Last Played */}
            <div className="flex items-center gap-3 mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <p className="text-sm">
                {playtime > 0
                  ? `Time Played: ${formatPlaytimeDetailed(playtime)}`
                  : 'Not played yet'
                }
              </p>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <p className="text-sm">
                Last Played: {game.last_played ? formatLastPlayed(game.last_played) : 'Never'}
              </p>
            </div>

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
                  <span className="text-sm font-bold" style={{ color: '#ff6b6b' }}>
                    {game.emulator_path ? 'ROM Missing' : 'Missing File'}
                  </span>
                </div>
              ) : isMissingEmu ? (
                <div className="flex items-center gap-2 px-10 py-3 rounded-full"
                  style={{ background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.25)' }}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-sm font-bold" style={{ color: '#7b61ff' }}>Emulator Missing</span>
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

      {/* Achievements Showcase (PS5 Style) */}
      <AnimatePresence>
        {game?.steam_id && achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="fixed bottom-[40px] right-[40px] z-20"
            style={{ width: '450px' }}
          >
            {/* The glass rectangle */}
            <div 
              className="relative w-full h-[320px] rounded-2xl flex items-center p-5 backdrop-blur-2xl border"
              style={{ 
                background: 'rgba(15,15,15,0.7)', 
                borderColor: 'rgba(255,255,255,0.1)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)'
              }}
            >
              <h3 className="absolute top-4 left-6 text-[10px] font-black uppercase tracking-[0.25em] text-white/30 z-10">
                Achievements
              </h3>
              {/* Circle on the left */}
              <div 
                className="w-[110px] h-[110px] rounded-full flex flex-col items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '3px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 0 20px rgba(255,255,255,0.1), inset 0 0 20px rgba(0,0,0,0.5)'
                }}
              >
                {/* Subtle glow behind circle */}
                <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
                
                <span className="text-4xl font-black text-white leading-none z-10" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                  {unlockedAchs.size}
                </span>
                <span className="text-xs font-bold text-white/50 border-t border-white/20 mt-1.5 pt-1 w-14 text-center z-10 uppercase tracking-tighter">
                  {achievements.length}
                </span>
              </div>

              {/* Right side - scrolling list */}
              <div className="ml-6 flex-1 h-full overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-2.5 py-1">
                  {achievements.map((ach) => {
                    const isUnlocked = unlockedAchs.has(ach.name);
                    return (
                      <div key={ach.name} className={`flex gap-3.5 items-center p-2.5 rounded-xl transition-all duration-300 ${isUnlocked ? 'bg-white/[0.05] border border-white/[0.08] shadow-lg' : 'bg-white/[0.02] border border-transparent'}`}>
                        <div className="relative flex-shrink-0">
                          <img 
                            src={isUnlocked ? ach.icon : ach.icongray} 
                            alt="" 
                            className={`w-12 h-12 rounded-lg shadow-md object-cover transition-all duration-500 ${!isUnlocked && 'opacity-40 grayscale blur-[0.5px]'}`} 
                          />
                          {isUnlocked && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center bg-[#28c850] shadow-md border border-black/20"
                            >
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                            </motion.div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13.5px] font-bold text-white truncate leading-tight" style={{ color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                            {ach.displayName}
                          </h4>
                          {ach.description && (
                            <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5 leading-snug">
                              {ach.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Custom scrollbar styles */}
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 4px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </FocusContext.Provider>
  );
}
