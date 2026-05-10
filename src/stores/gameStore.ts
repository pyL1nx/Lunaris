import { create } from 'zustand';
import { convertToAssetUrl } from '../utils/fileUtils';
import { evictFromCache } from '../utils/imageCache';

// ==============================================
// Types
// ==============================================

export interface Game {
  id: string;
  name: string;
  exe_path: string;
  icon_path: string;
  banner_path: string;
  description: string;
  is_completed: boolean;
  is_favourite: boolean;
  emulator_path: string;
  emulator_flags: string;
  last_played?: number;
  steam_id?: string;
  root_path?: string;
  owns_on_steam?: boolean;
  steam_user_id?: string;
  use_steam_icon?: boolean;
}

interface GameStoppedEvent {
  game_id: string;
  title: string;
  exe_name: string;
  session_seconds: number;
}

interface GameStartedEvent {
  game_id: string;
  title: string;
}

interface GameStore {
  // State
  games: Game[];
  _rawGames: Game[]; // unsorted source of truth
  selectedIndex: number;
  isLoading: boolean;
  isTauri: boolean;
  appDir: string | null;

  // Ghost state — tracks which exe/emulator files are missing
  missingExes: Set<string>; // game IDs with missing exe
  missingEmulators: Set<string>; // game IDs with missing emulator exe

  // Modals
  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  editingGame: Game | null;

  // Playing state
  runningGameIds: Set<string>;
  launchError: string | null;

  // Playtime (keyed by exe filename)
  playtime: Record<string, number>;

  // Resolved asset URLs (absolute path → asset:// URL)
  resolvedAssets: Record<string, string>;

  // Computed
  selectedGame: () => Game | null;
  isExeMissing: (gameId: string) => boolean;
  isEmulatorMissing: (gameId: string) => boolean;
  visibleBannerRange: () => Set<number>;

  // Actions
  init: () => Promise<void>;
  loadGames: () => Promise<void>;
  loadPlaytime: () => Promise<void>;
  checkAllExes: () => Promise<void>;
  selectByIndex: (index: number) => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  evictDistantBanners: () => void;
  sortGames: () => void;

  // CRUD
  addGame: (game: Game) => Promise<void>;
  updateGame: (game: Game) => Promise<void>;
  removeGame: (id: string) => Promise<void>;
  toggleFavourite: (gameId: string) => Promise<void>;

  // Manual playtime
  setManualPlaytime: (exeName: string, totalSeconds: number) => Promise<void>;

  // Assets
  copyAsset: (sourcePath: string, gameName: string, type: 'icon' | 'banner') => Promise<string>;
  deleteAsset: (path: string) => Promise<void>;
  resolveAsset: (absolutePath: string) => Promise<string | null>;
  resolveGameAssets: (games: Game[]) => Promise<void>;

  // Modals
  openAddModal: () => void;
  closeAddModal: () => void;
  openEditModal: (game: Game) => void;
  closeEditModal: () => void;

  // Game execution
  launchGame: (game: Game) => Promise<void>;
  isGameRunning: (gameId: string) => boolean;
  handleGameStarted: (event: GameStartedEvent) => void;
  handleGameStopped: (event: GameStoppedEvent) => Promise<void>;
  clearLaunchError: () => void;
  initEventListeners: () => Promise<() => void>;

  // Playtime helpers
  getPlaytime: (exePath: string) => number;
}

// ==============================================
// Helpers
// ==============================================

export function exeNameFromPath(exePath: string): string {
  return exePath.split(/[\\/]/).pop() ?? exePath;
}

export function formatPlaytime(totalSeconds: number): string {
  if (totalSeconds < 60) return 'New';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} mins`;
  if (minutes === 0) return `${hours} hrs`;
  return `${hours} hrs, ${minutes} mins`;
}

export function formatPlaytimeDetailed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0 && minutes === 0) return 'Not played yet';
  if (hours === 0) return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  if (minutes === 0) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  return `${hours} hr${hours !== 1 ? 's' : ''}, ${minutes} min${minutes !== 1 ? 's' : ''}`;
}

// ==============================================
// Store
// ==============================================

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  _rawGames: [],
  selectedIndex: 0,
  isLoading: true,
  isTauri: false,
  appDir: null,
  missingExes: new Set(),
  missingEmulators: new Set(),
  isAddModalOpen: false,
  isEditModalOpen: false,
  editingGame: null,
  runningGameIds: new Set(),
  launchError: null,
  playtime: {},
  resolvedAssets: {},

  selectedGame: () => {
    const { games, selectedIndex } = get();
    return games[selectedIndex] ?? null;
  },

  isExeMissing: (gameId) => get().missingExes.has(gameId),
  isEmulatorMissing: (gameId) => get().missingEmulators.has(gameId),

  visibleBannerRange: () => {
    const { selectedIndex, games } = get();
    const visible = new Set<number>();
    for (let i = selectedIndex - 1; i <= selectedIndex + 1; i++) {
      if (i >= 0 && i < games.length) visible.add(i);
    }
    return visible;
  },

  // ── Initialization ────────────────────────────

  init: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const appDir = await invoke<string>('init_app_dirs');
      set({ isTauri: true, appDir });
      await get().loadGames();
      await get().loadPlaytime();
      await get().checkAllExes();
    } catch {
      console.warn('Not running in Tauri — browser mode');
      set({ isTauri: false, isLoading: false });
    }
  },

  loadGames: async () => {
    set({ isLoading: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const rawGames = await invoke<Game[]>('load_games');
      // Ensure defaults for old games (backward compat)
      const games = rawGames.map((g) => ({
        ...g,
        is_completed: g.is_completed ?? false,
        is_favourite: g.is_favourite ?? false,
        emulator_path: g.emulator_path ?? '',
        emulator_flags: g.emulator_flags ?? '',
        steam_id: g.steam_id ?? '',
        root_path: g.root_path ?? '',
        owns_on_steam: g.owns_on_steam ?? false,
        steam_user_id: g.steam_user_id ?? '',
        use_steam_icon: g.use_steam_icon ?? false,
      }));
      await get().resolveGameAssets(games);
      const idx = Math.min(get().selectedIndex, Math.max(0, games.length - 1));
      set({ _rawGames: games, games, selectedIndex: idx, isLoading: false });
      get().sortGames();
    } catch (e) {
      console.error('Failed to load games:', e);
      set({ isLoading: false });
    }
  },

  loadPlaytime: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const playtime = await invoke<Record<string, number>>('load_playtime');
      set({ playtime });
    } catch (e) {
      console.error('Failed to load playtime:', e);
    }
  },

  // ── Ghost State (Missing Exe Detection) ────────

  checkAllExes: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { games } = get();
      const missing = new Set<string>();
      const missingEmus = new Set<string>();
      for (const game of games) {
        const exists = await invoke<boolean>('check_exe_exists', { path: game.exe_path });
        if (!exists) missing.add(game.id);
        // Also check emulator path if set
        if (game.emulator_path) {
          const emuExists = await invoke<boolean>('check_emulator_exists', { path: game.emulator_path });
          if (!emuExists) missingEmus.add(game.id);
        }
      }
      set({ missingExes: missing, missingEmulators: missingEmus });
      // Re-sort after exe check so missing games go to end
      get().sortGames();
    } catch {
      // In browser mode, skip exe checking
    }
  },

  // ── Sorting ────────────────────────────────────
  // Sort order: favourites first → normal → missing exe last
  sortGames: () => {
    const { _rawGames, missingExes, selectedIndex, games: currentGames } = get();
    // Remember currently selected game id before sort
    const currentSelectedId = currentGames[selectedIndex]?.id;

    const sorted = [..._rawGames].sort((a, b) => {
      const aMissing = missingExes.has(a.id) ? 1 : 0;
      const bMissing = missingExes.has(b.id) ? 1 : 0;
      const aFav = a.is_favourite ? 1 : 0;
      const bFav = b.is_favourite ? 1 : 0;

      // Missing games go to end
      if (aMissing !== bMissing) return aMissing - bMissing;
      // Favourites go first (within non-missing)
      if (aFav !== bFav) return bFav - aFav;
      
      // Most recently played goes first
      const aLast = a.last_played ?? 0;
      const bLast = b.last_played ?? 0;
      if (aLast !== bLast) return bLast - aLast;

      return 0; // preserve original order otherwise
    });

    // Restore selection to the same game after sort
    let newIdx = sorted.findIndex((g) => g.id === currentSelectedId);
    if (newIdx < 0) newIdx = Math.min(selectedIndex, Math.max(0, sorted.length - 1));

    set({ games: sorted, selectedIndex: newIdx });
  },

  // ── Navigation ────────────────────────────────

  selectByIndex: (index) => {
    const { games } = get();
    if (index >= 0 && index < games.length) {
      set({ selectedIndex: index });
      get().evictDistantBanners();
    }
  },

  navigateLeft: () => {
    const { selectedIndex, games } = get();
    if (games.length === 0) return;
    set({ selectedIndex: selectedIndex > 0 ? selectedIndex - 1 : games.length - 1 });
    get().evictDistantBanners();
  },

  navigateRight: () => {
    const { selectedIndex, games } = get();
    if (games.length === 0) return;
    set({ selectedIndex: selectedIndex < games.length - 1 ? selectedIndex + 1 : 0 });
    get().evictDistantBanners();
  },

  evictDistantBanners: () => {
    const { games, resolvedAssets } = get();
    const visible = get().visibleBannerRange();
    for (let i = 0; i < games.length; i++) {
      if (!visible.has(i)) {
        const bannerPath = games[i].banner_path;
        if (bannerPath && resolvedAssets[bannerPath]) {
          evictFromCache(resolvedAssets[bannerPath]);
        }
      }
    }
  },

  // ── CRUD ──────────────────────────────────────

  addGame: async (game) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_game', { game });
      await get().loadGames();
      // Select the newly added game by its id after sorting
      const newIdx = get().games.findIndex((g) => g.id === game.id);
      if (newIdx >= 0) set({ selectedIndex: newIdx });
      await get().checkAllExes();
    } catch (e) {
      console.error('Failed to add game:', e);
    }
  },

  updateGame: async (game) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const current = await invoke<Game[]>('load_games');
      const updated = current.map((g) => (g.id === game.id ? game : g));
      await invoke('write_games', { games: updated });
      await get().loadGames();
      await get().checkAllExes();
    } catch (e) {
      console.error('Failed to update game:', e);
    }
  },

  removeGame: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const current = await invoke<Game[]>('load_games');
      const updated = current.filter((g) => g.id !== id);
      await invoke('write_games', { games: updated });
      await get().loadGames();
    } catch (e) {
      console.error('Failed to remove game:', e);
    }
  },

  toggleFavourite: async (gameId) => {
    const { games } = get();
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const updated: Game = { ...game, is_favourite: !game.is_favourite };
    await get().updateGame(updated);
  },

  // ── Manual Playtime ────────────────────────────

  setManualPlaytime: async (exeName, totalSeconds) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_manual_playtime', { exeName, totalSeconds: Math.round(totalSeconds) });
      await get().loadPlaytime();
    } catch (e) {
      console.error('Failed to set manual playtime:', e);
    }
  },

  // ── Assets ────────────────────────────────────

  copyAsset: async (sourcePath, gameName, type) => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('copy_asset', { sourcePath, gameName, assetType: type });
  },

  deleteAsset: async (path) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_asset', { path });
    } catch (e) {
      console.error('Failed to delete asset:', e);
    }
  },

  resolveAsset: async (absolutePath) => {
    const cached = get().resolvedAssets[absolutePath];
    if (cached) return cached;

    const url = await convertToAssetUrl(absolutePath);
    if (url) {
      set((s) => ({ resolvedAssets: { ...s.resolvedAssets, [absolutePath]: url } }));
    }
    return url;
  },

  resolveGameAssets: async (games) => {
    const newResolved: Record<string, string> = {};

    let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
    try {
      const mod = await import('@tauri-apps/api/core');
      invoke = mod.invoke;
    } catch {}

    for (const game of games) {
      if (game.icon_path) {
        let pathToResolve = game.icon_path;
        // Optimize icon: resize to 140×140 (2× for retina at 70px display)
        if (invoke) {
          try {
            const optimized = await invoke('optimize_image', {
              sourcePath: game.icon_path, maxWidth: 140, maxHeight: 140,
            }) as string;
            if (optimized) pathToResolve = optimized;
          } catch {}
        }
        const url = await convertToAssetUrl(pathToResolve);
        if (url) newResolved[game.icon_path] = url;
      }
      if (game.banner_path) {
        let pathToResolve = game.banner_path;
        // Optimize banner: resize to 1920×1080 max
        if (invoke) {
          try {
            const optimized = await invoke('optimize_image', {
              sourcePath: game.banner_path, maxWidth: 3840, maxHeight: 2160,
            }) as string;
            if (optimized) pathToResolve = optimized;
          } catch {}
        }
        const url = await convertToAssetUrl(pathToResolve);
        if (url) newResolved[game.banner_path] = url;
      }
    }
    set((s) => ({ resolvedAssets: { ...s.resolvedAssets, ...newResolved } }));
  },

  // ── Modals ────────────────────────────────────

  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  openEditModal: (game) => set({ isEditModalOpen: true, editingGame: game }),
  closeEditModal: () => set({ isEditModalOpen: false, editingGame: null }),

  // ── Game Execution ────────────────────────────

  launchGame: async (game) => {
    // Don't launch if exe/ROM is missing
    if (get().missingExes.has(game.id)) {
      set({ launchError: game.emulator_path
        ? 'ROM/ISO file not found. The game file may have been moved or deleted.'
        : 'Executable file not found. The game may have been moved or uninstalled.'
      });
      return;
    }
    // Don't launch if emulator is missing
    if (game.emulator_path && get().missingEmulators.has(game.id)) {
      set({ launchError: 'Emulator executable not found. Please check the emulator path in game settings.' });
      return;
    }
    set({ launchError: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (game.emulator_path) {
        // Emulated game — launch through emulator
        await invoke('launch_emulator', {
          gameId: game.id,
          title: game.name,
          emulatorPath: game.emulator_path,
          romPath: game.exe_path,
          flags: game.emulator_flags || '',
        });
      } else {
        // Native game — direct launch (existing behavior)
        await invoke('launch_game', { gameId: game.id, title: game.name, exePath: game.exe_path });
      }
      // Trigger explicit GC after launch to reclaim memory
      await invoke('purge_webview_memory');
    } catch (error) {
      const msg = typeof error === 'string' ? error : (error as Error).message ?? 'Unknown error';
      set({ launchError: msg });
    }
  },

  isGameRunning: (gameId) => get().runningGameIds.has(gameId),

  handleGameStarted: (event) => {
    set((s) => {
      const newSet = new Set(s.runningGameIds);
      newSet.add(event.game_id);
      return { runningGameIds: newSet };
    });
  },

  handleGameStopped: async (event) => {
    set((s) => {
      const newSet = new Set(s.runningGameIds);
      newSet.delete(event.game_id);
      return { runningGameIds: newSet };
    });

    // Sync with backend updates (last_played and playtime)
    await get().loadGames();
    await get().loadPlaytime();
  },

  clearLaunchError: () => set({ launchError: null }),

  initEventListeners: async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const u1 = await listen<GameStartedEvent>('game-started', (e) => get().handleGameStarted(e.payload));
      const u2 = await listen<GameStoppedEvent>('game-stopped', (e) => get().handleGameStopped(e.payload));
      return () => { u1(); u2(); };
    } catch {
      return () => {};
    }
  },

  getPlaytime: (exePath) => {
    const name = exeNameFromPath(exePath);
    return get().playtime[name] ?? 0;
  },
}));
