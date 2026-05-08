import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, Game, exeNameFromPath } from '../stores/gameStore';
import { pickExeFile, pickImageFile, pickDirectory } from '../utils/fileUtils';

export default function EditGameModal() {
  const isOpen = useGameStore((s) => s.isEditModalOpen);
  const editingGame = useGameStore((s) => s.editingGame);
  const closeModal = useGameStore((s) => s.closeEditModal);
  const updateGame = useGameStore((s) => s.updateGame);
  const removeGame = useGameStore((s) => s.removeGame);
  const copyAsset = useGameStore((s) => s.copyAsset);
  const deleteAsset = useGameStore((s) => s.deleteAsset);
  const getPlaytime = useGameStore((s) => s.getPlaytime);
  const setManualPlaytime = useGameStore((s) => s.setManualPlaytime);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [newIconSource, setNewIconSource] = useState<string | null>(null);
  const [newBannerSource, setNewBannerSource] = useState<string | null>(null);
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  // Emulator fields
  const [useEmulator, setUseEmulator] = useState(false);
  const [emulatorPath, setEmulatorPath] = useState('');
  const [emulatorFlags, setEmulatorFlags] = useState('');
  const [steamId, setSteamId] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');

  useEffect(() => {
    if (editingGame) {
      setName(editingGame.name);
      setDescription(editingGame.description);
      setIsCompleted(editingGame.is_completed ?? false);
      setIsFavourite(editingGame.is_favourite ?? false);
      setNewIconSource(null);
      setNewBannerSource(null);
      setShowRemoveConfirm(false);
      // Emulator state
      const hasEmu = !!(editingGame.emulator_path);
      setUseEmulator(hasEmu);
      setEmulatorPath(editingGame.emulator_path ?? '');
      setEmulatorFlags(editingGame.emulator_flags ?? '');
      setSteamId(editingGame.steam_id ?? '');
      setRootPath(editingGame.root_path ?? '');
      setSyncError(''); setSyncSuccess(''); setIsSyncing(false);
      // Pre-fill current playtime
      const currentSec = getPlaytime(editingGame.exe_path);
      const h = Math.floor(currentSec / 3600);
      const m = Math.floor((currentSec % 3600) / 60);
      setManualHours(h > 0 ? String(h) : '');
      setManualMinutes(m > 0 ? String(m) : '');
    }
  }, [editingGame, getPlaytime]);

  const handleClose = useCallback(() => { setShowRemoveConfirm(false); closeModal(); }, [closeModal]);

  const handlePickEmulator = useCallback(async () => {
    const path = await pickExeFile();
    if (path) setEmulatorPath(path);
  }, []);

  const handlePickRoot = useCallback(async () => {
    const path = await pickDirectory();
    if (path) setRootPath(path);
  }, []);

  const handleSyncAchievements = useCallback(async () => {
    if (!steamId || !rootPath) {
      setSyncError('Steam App ID and Game Root Directory are required.');
      return;
    }
    const apiKey = localStorage.getItem('steamApiKey');
    if (!apiKey) {
      setSyncError('Steam API Key not found in Profile.');
      return;
    }
    setIsSyncing(true);
    setSyncError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('inject_achievements', { steamId, apiKey, rootPath });
      setSyncSuccess('Achievements injected successfully!');
      setTimeout(() => setSyncSuccess(''), 3000);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [steamId, rootPath]);

  const handleSave = useCallback(async () => {
    if (!editingGame || !name.trim()) return;
    setIsSaving(true);
    try {
      let iconPath = editingGame.icon_path;
      let bannerPath = editingGame.banner_path;
      if (newIconSource) {
        if (editingGame.icon_path) await deleteAsset(editingGame.icon_path);
        iconPath = await copyAsset(newIconSource, name, 'icon');
      }
      if (newBannerSource) {
        if (editingGame.banner_path) await deleteAsset(editingGame.banner_path);
        bannerPath = await copyAsset(newBannerSource, name, 'banner');
      }
      const updated: Game = {
        ...editingGame,
        name: name.trim(),
        description: description.trim(),
        icon_path: iconPath,
        banner_path: bannerPath,
        is_completed: isCompleted,
        is_favourite: isFavourite,
        emulator_path: useEmulator ? emulatorPath.trim() : '',
        emulator_flags: useEmulator ? emulatorFlags.trim() : '',
        steam_id: steamId.trim(),
        root_path: rootPath.trim(),
      };
      await updateGame(updated);
      // Update manual playtime
      const hrs = parseInt(manualHours) || 0;
      const mins = parseInt(manualMinutes) || 0;
      const totalSec = hrs * 3600 + mins * 60;
      const exeName = exeNameFromPath(editingGame.exe_path);
      await setManualPlaytime(exeName, totalSec);
      handleClose();
    } catch (e) { console.error('Failed to update game:', e); } finally { setIsSaving(false); }
  }, [editingGame, name, description, isCompleted, isFavourite, useEmulator, emulatorPath, emulatorFlags, steamId, rootPath, newIconSource, newBannerSource, manualHours, manualMinutes, copyAsset, deleteAsset, updateGame, setManualPlaytime, handleClose]);

  const handleRemove = useCallback(async () => {
    if (!editingGame) return;
    await removeGame(editingGame.id);
    handleClose();
  }, [editingGame, removeGame, handleClose]);

  if (!editingGame) return null;

  const inputStyle = { background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0', caretColor: '#fff' };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center" onClick={handleClose}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: 'linear-gradient(145deg, rgba(18,18,18,0.98), rgba(8,8,8,0.99))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
            <div className="px-7 pt-6 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#e8eaf0' }}>Edit Game</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: '#8b93a8' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
            <div className="px-7 pb-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Game Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Tagline</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div className="grid grid-cols-[1fr_2.5fr] gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Steam App ID</label>
                  <input value={steamId} onChange={(e) => setSteamId(e.target.value)}
                    placeholder="e.g. 1245620" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Game Root Directory</label>
                  <div className="flex gap-2">
                    <input value={rootPath} onChange={(e) => setRootPath(e.target.value)}
                      placeholder="C:\Games\GameName" className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                    <button onClick={handlePickRoot} className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase transition-all hover:bg-white/[0.06]"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Browse</button>
                  </div>
                </div>
              </div>

              {(steamId || rootPath) && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex justify-between items-center">
                    <p className="text-xs" style={{ color: '#8b93a8' }}>Injects `steam_settings/achievements.json` to the root directory for Goldberg tracking.</p>
                    <button 
                      onClick={handleSyncAchievements} 
                      disabled={isSyncing || !steamId || !rootPath}
                      className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.9)', color: '#000' }}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Achievements'}
                    </button>
                  </div>
                  {syncError && <p className="text-[10px] mt-2 text-red-400">{syncError}</p>}
                  {syncSuccess && <p className="text-[10px] mt-2 text-green-400">{syncSuccess}</p>}
                </div>
              )}

              {/* Emulator mode toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="w-5 h-5 rounded-md flex items-center justify-center relative"
                  style={{ background: useEmulator ? 'rgba(123,97,255,0.2)' : 'rgba(15,15,15,0.9)', border: useEmulator ? '1.5px solid rgba(123,97,255,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <input type="checkbox" checked={useEmulator} onChange={(e) => setUseEmulator(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {useEmulator && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b93a8' }}>Launch through Emulator</span>
              </label>

              {/* Emulator path + flags (collapsible) */}
              <AnimatePresence>
                {useEmulator && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-4 overflow-hidden">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Emulator Path</label>
                      <div className="flex gap-2">
                        <input value={emulatorPath} onChange={(e) => setEmulatorPath(e.target.value)}
                          placeholder="C:\Emulators\sudachi.exe" className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                        <button onClick={handlePickEmulator} className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase transition-all hover:bg-white/[0.06]"
                          style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Browse</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Emulator Flags</label>
                      <input value={emulatorFlags} onChange={(e) => setEmulatorFlags(e.target.value)}
                        placeholder="-f --fullscreen --no-gui" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                      <p className="text-[10px] mt-1" style={{ color: '#555' }}>CLI arguments passed before the ROM path (e.g. -f for fullscreen)</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Change Icon</label>
                  <button onClick={async () => { const p = await pickImageFile('Select New Icon'); if (p) setNewIconSource(p); }}
                    className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.04] cursor-pointer"
                    style={{ border: newIconSource ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)', color: newIconSource ? '#fff' : '#888' }}>
                    {newIconSource ? '✓ New icon selected' : 'Browse...'}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Change Banner</label>
                  <button onClick={async () => { const p = await pickImageFile('Select New Banner'); if (p) setNewBannerSource(p); }}
                    className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.04] cursor-pointer"
                    style={{ border: newBannerSource ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)', color: newBannerSource ? '#fff' : '#888' }}>
                    {newBannerSource ? '✓ New banner selected' : 'Browse...'}
                  </button>
                </div>
              </div>
              {/* Favourite checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="w-5 h-5 rounded-md flex items-center justify-center relative"
                  style={{ background: isFavourite ? 'rgba(255,200,50,0.2)' : 'rgba(15,15,15,0.9)', border: isFavourite ? '1.5px solid rgba(255,200,50,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <input type="checkbox" checked={isFavourite} onChange={(e) => setIsFavourite(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {isFavourite && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#ffc832" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b93a8' }}>Mark as Favourite</span>
              </label>
              {/* Completed checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="w-5 h-5 rounded-md flex items-center justify-center relative"
                  style={{ background: isCompleted ? 'rgba(40,200,80,0.2)' : 'rgba(15,15,15,0.9)', border: isCompleted ? '1.5px solid rgba(40,200,80,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <input type="checkbox" checked={isCompleted} onChange={(e) => setIsCompleted(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {isCompleted && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#28c850" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b93a8' }}>Mark as Completed</span>
              </label>
              {/* Manual playtime edit */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Total Playtime</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={manualHours} onChange={(e) => setManualHours(e.target.value)} placeholder="0"
                    className="w-16 px-3 py-2 rounded-lg text-sm text-center outline-none" style={inputStyle} />
                  <span className="text-xs" style={{ color: '#666' }}>hrs</span>
                  <input type="number" min="0" max="59" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0"
                    className="w-16 px-3 py-2 rounded-lg text-sm text-center outline-none" style={inputStyle} />
                  <span className="text-xs" style={{ color: '#666' }}>mins</span>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/[0.06]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', color: '#8b93a8' }}>Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#000', opacity: isSaving ? 0.5 : 1 }}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              <div className="border-t border-white/[0.06] pt-4 mt-2">
                {showRemoveConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex-1" style={{ color: '#ff6b6b' }}>Remove from library? Playtime preserved.</span>
                    <button onClick={handleRemove} className="px-4 py-2 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(255,80,80,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.25)' }}>Confirm</button>
                    <button onClick={() => setShowRemoveConfirm(false)} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ color: '#8b93a8' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowRemoveConfirm(true)} className="text-xs font-semibold transition-colors hover:text-red-400 cursor-pointer" style={{ color: '#8b93a8' }}>Remove Game</button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
