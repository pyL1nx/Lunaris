import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export default function TopBar() {
  const [time, setTime] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const games = useGameStore((s) => s.games);
  const selectByIndex = useGameStore((s) => s.selectByIndex);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check fullscreen state
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const check = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        setIsFullscreen(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setIsFullscreen(await win.isMaximized());
        });
      } catch {}
    };
    check();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error('Minimize failed:', e);
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (await win.isMaximized()) {
        await win.unmaximize();
        setIsFullscreen(false);
      } else {
        await win.maximize();
        setIsFullscreen(true);
      }
    } catch (e) {
      console.error('Fullscreen toggle failed:', e);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch {
      // Fallback: actually close
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch {}
    }
  }, []);

  // Search: find all matching games and navigate to first
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setActiveResultIdx(0);
      return;
    }
    const q = query.toLowerCase();
    const matches = games
      .map((g, i) => (g.name.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i >= 0);
    setSearchResults(matches);
    setActiveResultIdx(0);
    if (matches.length > 0) {
      selectByIndex(matches[0]);
    }
  }, [games, selectByIndex]);

  // Keyboard navigation within search results
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      toggleSearch();
      return;
    }
    if (e.key === 'Enter' && searchResults.length > 1) {
      // Cycle to next result
      const next = (activeResultIdx + 1) % searchResults.length;
      setActiveResultIdx(next);
      selectByIndex(searchResults[next]);
      return;
    }
  }, [searchResults, activeResultIdx, selectByIndex]);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
        setSearchResults([]);
        setActiveResultIdx(0);
      }
      return !prev;
    });
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-8"
      data-tauri-drag-region
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-8 pointer-events-none" data-tauri-drag-region>
        <span className="text-lg font-bold tracking-wide" style={{ color: '#e8eaf0' }}>Games</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Search bar / icon */}
        <AnimatePresence mode="wait">
          {searchOpen ? (
            <motion.div
              key="search-bar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col relative"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
                <input
                  ref={inputRef}
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search games..."
                  className="bg-transparent text-sm outline-none flex-1"
                  style={{ color: '#e8eaf0', caretColor: '#fff' }}
                />
                {searchResults.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#aaa' }}>
                    {activeResultIdx + 1}/{searchResults.length}
                  </span>
                )}
                <button onClick={toggleSearch} className="flex-shrink-0 cursor-pointer" style={{ color: '#888' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
              {/* No results indicator */}
              {searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 text-center text-[11px] py-1 rounded-lg"
                  style={{ background: 'rgba(255,80,80,0.1)', color: '#ff6b6b' }}>
                  No games found
                </div>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="search-icon"
              onClick={toggleSearch}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 cursor-pointer"
              style={{ color: '#888' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Profile */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #333, #555)' }}>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" />
          </svg>
        </div>

        {/* Clock */}
        <span className="text-sm font-medium tracking-wider min-w-[50px] text-right" style={{ color: '#888' }}>
          {time}
        </span>

        {/* Separator */}
        <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Minimize */}
        <button onClick={handleMinimize} className="w-8 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/10 cursor-pointer">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Fullscreen toggle */}
        <button onClick={handleToggleFullscreen} className="w-8 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/10 cursor-pointer">
          {isFullscreen ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5">
              <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5">
              <rect x="5" y="5" width="14" height="14" rx="1" />
            </svg>
          )}
        </button>

        {/* Close (to tray) */}
        <button onClick={handleClose} className="w-8 h-7 flex items-center justify-center rounded transition-colors hover:bg-red-500/80 cursor-pointer">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
    </motion.header>
  );
}
