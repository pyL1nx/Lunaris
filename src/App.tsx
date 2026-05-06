import { useEffect, useCallback } from 'react';
import { init, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useGameStore } from './stores/gameStore';
import { useGamepad } from './hooks/useGamepad';
import BackgroundLayer from './components/BackgroundLayer';
import TopBar from './components/TopBar';
import GameIconCarousel from './components/GameIconCarousel';
import GameDetails from './components/GameDetails';
import EmptyState from './components/EmptyState';
import AddGameModal from './components/AddGameModal';
import EditGameModal from './components/EditGameModal';

// Initialize spatial navigation once
init({ debug: false, visualDebug: false });

function App() {
  const initStore = useGameStore((s) => s.init);
  const initEventListeners = useGameStore((s) => s.initEventListeners);
  const games = useGameStore((s) => s.games);
  const isLoading = useGameStore((s) => s.isLoading);
  const navigateLeft = useGameStore((s) => s.navigateLeft);
  const navigateRight = useGameStore((s) => s.navigateRight);
  const selectedGame = useGameStore((s) => s.selectedGame);
  const launchGame = useGameStore((s) => s.launchGame);
  const isGameRunning = useGameStore((s) => s.isGameRunning);
  const isAddModalOpen = useGameStore((s) => s.isAddModalOpen);
  const isEditModalOpen = useGameStore((s) => s.isEditModalOpen);
  const closeAddModal = useGameStore((s) => s.closeAddModal);
  const closeEditModal = useGameStore((s) => s.closeEditModal);

  // Initialize store + event listeners
  useEffect(() => {
    initStore();
    let cleanup: (() => void) | null = null;
    initEventListeners().then((fn) => { cleanup = fn; });
    return () => { if (cleanup) cleanup(); };
  }, [initStore, initEventListeners]);

  // Set initial focus to carousel
  useEffect(() => {
    if (games.length > 0) {
      setTimeout(() => setFocus('ICON_CAROUSEL'), 100);
    }
  }, [games.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateLeft(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateRight(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const game = selectedGame();
        if (game && !isGameRunning(game.id)) launchGame(game);
      } else if (e.key === 'Escape') {
        if (isAddModalOpen) closeAddModal();
        if (isEditModalOpen) closeEditModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigateLeft, navigateRight, selectedGame, launchGame, isGameRunning, isAddModalOpen, isEditModalOpen, closeAddModal, closeEditModal]);

  // Purge memory on minimize/blur
  useEffect(() => {
    const handleBlur = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('purge_webview_memory');
      } catch (e) {}
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Gamepad
  const handleGamepadA = useCallback(() => {
    const game = selectedGame();
    if (isAddModalOpen || isEditModalOpen) return; // don't interfere with modals
    if (game && !isGameRunning(game.id)) launchGame(game);
  }, [selectedGame, launchGame, isGameRunning, isAddModalOpen, isEditModalOpen]);

  const handleGamepadB = useCallback(() => {
    if (isAddModalOpen) closeAddModal();
    if (isEditModalOpen) closeEditModal();
  }, [isAddModalOpen, isEditModalOpen, closeAddModal, closeEditModal]);

  useGamepad({
    onLeft: navigateLeft,
    onRight: navigateRight,
    onDown: () => setFocus('PLAY_BTN'),
    onUp: () => setFocus('ICON_CAROUSEL'),
    onA: handleGamepadA,
    onB: handleGamepadB,
  });

  if (isLoading) {
    return (
      <div className="relative w-full h-screen flex items-center justify-center" style={{ background: '#000000' }}>
        <div className="text-sm font-medium tracking-wider animate-pulse" style={{ color: '#4a5068' }}>
          Loading...
        </div>
      </div>
    );
  }

  const hasGames = games.length > 0;

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#000000' }}>
      <BackgroundLayer />
      <TopBar />

      <main 
        className="relative z-10 w-full h-full pt-16 flex flex-col"
        style={{ contain: 'paint layout' }}
      >
        {hasGames ? (
          <>
            <GameIconCarousel />
            <GameDetails />
          </>
        ) : (
          <EmptyState />
        )}
      </main>

      <AddGameModal />
      <EditGameModal />
    </div>
  );
}

export default App;
