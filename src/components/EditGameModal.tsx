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
  const [useEmulator, setUseEmulator] = useState(false);
  const [emulatorPath, setEmulatorPath] = useState('');
  const [emulatorFlags, setEmulatorFlags] = useState('');
  const [steamId, setSteamId] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [ownsOnSteam, setOwnsOnSteam] = useState(false);
  const [steamUserId, setSteamUserId] = useState('');
  const [useSteamIcon, setUseSteamIcon] = useState(false);

  useEffect(() => {
    if (editingGame) {
      setName(editingGame.name);
      setDescription(editingGame.description);
      setIsCompleted(editingGame.is_completed ?? false);
      setIsFavourite(editingGame.is_favourite ?? false);
      setNewIconSource(null);
      setNewBannerSource(null);
      setShowRemoveConfirm(false);
      const hasEmu = !!(editingGame.emulator_path);
      setUseEmulator(hasEmu);
      setEmulatorPath(editingGame.emulator_path ?? '');
      setEmulatorFlags(editingGame.emulator_flags ?? '');
      setSteamId(editingGame.steam_id ?? '');
      setRootPath(editingGame.root_path ?? '');
      setOwnsOnSteam(editingGame.owns_on_steam ?? false);
      setSteamUserId(editingGame.steam_user_id ?? '');
      setUseSteamIcon(editingGame.use_steam_icon ?? false);
      setSyncError(''); setSyncSuccess(''); setIsSyncing(false);
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
    if (!steamId || !rootPath) { setSyncError('Steam App ID and Root Directory required.'); return; }
    const apiKey = localStorage.getItem('steamApiKey');
    if (!apiKey) { setSyncError('Steam API Key not found in Profile.'); return; }
    setIsSyncing(true); setSyncError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('inject_achievements', { steamId, apiKey, rootPath });
      setSyncSuccess('Synced!'); setTimeout(() => setSyncSuccess(''), 3000);
    } catch (e) { setSyncError(String(e)); } finally { setIsSyncing(false); }
  }, [steamId, rootPath]);

  const handleSave = useCallback(async () => {
    if (!editingGame || !name.trim()) return;
    setIsSaving(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let iconPath = editingGame.icon_path;
      let bannerPath = editingGame.banner_path;
      if (useSteamIcon && steamId.trim()) {
        try {
          if (editingGame.icon_path) await deleteAsset(editingGame.icon_path);
          iconPath = await invoke<string>('fetch_steam_game_icon', { steamId: steamId.trim(), gameName: name.trim() });
        } catch (e) { console.error('Failed to fetch Steam icon:', e); }
      } else if (newIconSource) {
        if (editingGame.icon_path) await deleteAsset(editingGame.icon_path);
        iconPath = await copyAsset(newIconSource, name, 'icon');
      }
      if (newBannerSource) {
        if (editingGame.banner_path) await deleteAsset(editingGame.banner_path);
        bannerPath = await copyAsset(newBannerSource, name, 'banner');
      }
      const updated: Game = {
        ...editingGame, name: name.trim(), description: description.trim(),
        icon_path: iconPath, banner_path: bannerPath,
        is_completed: isCompleted, is_favourite: isFavourite,
        emulator_path: useEmulator ? emulatorPath.trim() : '',
        emulator_flags: useEmulator ? emulatorFlags.trim() : '',
        steam_id: steamId.trim(), root_path: rootPath.trim(),
        owns_on_steam: ownsOnSteam, steam_user_id: steamUserId.trim(),
        use_steam_icon: useSteamIcon,
      };
      await updateGame(updated);
      const hrs = parseInt(manualHours) || 0;
      const mins = parseInt(manualMinutes) || 0;
      const totalSec = hrs * 3600 + mins * 60;
      await setManualPlaytime(exeNameFromPath(editingGame.exe_path), totalSec);
      handleClose();
    } catch (e) { console.error('Failed to update game:', e); } finally { setIsSaving(false); }
  }, [editingGame, name, description, isCompleted, isFavourite, useEmulator, emulatorPath, emulatorFlags, steamId, rootPath, ownsOnSteam, steamUserId, useSteamIcon, newIconSource, newBannerSource, manualHours, manualMinutes, copyAsset, deleteAsset, updateGame, setManualPlaytime, handleClose]);

  const handleRemove = useCallback(async () => {
    if (!editingGame) return;
    await removeGame(editingGame.id);
    handleClose();
  }, [editingGame, removeGame, handleClose]);

  if (!editingGame) return null;

  const inp = { background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0', caretColor: '#fff' };
  const sectionDivider = <div className="border-t border-white/[0.04] my-1" />;
  const sectionLabel = (text: string) => <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>{text}</h3>;

  const checkbox = (checked: boolean, onChange: (v: boolean) => void, label: string, color: string, icon?: React.ReactNode) => (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="w-5 h-5 rounded-md flex items-center justify-center relative transition-all"
        style={{ background: checked ? `${color}20` : 'rgba(15,15,15,0.9)', border: `1.5px solid ${checked ? `${color}80` : 'rgba(255,255,255,0.1)'}` }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
        {checked && (icon || <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>)}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider transition-colors" style={{ color: checked ? color : '#8b93a8' }}>{label}</span>
    </label>
  );

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

            {/* Header */}
            <div className="px-7 pt-6 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#e8eaf0' }}>Edit Game</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: '#8b93a8' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>

            <div className="px-7 pb-7 space-y-4">
              {/* ─── GENERAL ─── */}
              {sectionLabel('General')}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game Name"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inp} />
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tagline..."
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inp} />

              {/* Status toggles - inline row */}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {checkbox(isFavourite, setIsFavourite, 'Favourite', '#ffc832',
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="#ffc832" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>
                )}
                {checkbox(isCompleted, setIsCompleted, 'Completed', '#28c850')}
              </div>

              {sectionDivider}

              {/* ─── ASSETS ─── */}
              {sectionLabel('Assets')}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#666' }}>Icon</span>
                  {steamId && (
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <div className="w-4 h-4 rounded flex items-center justify-center relative"
                        style={{ background: useSteamIcon ? 'rgba(27,159,255,0.2)' : 'rgba(15,15,15,0.9)', border: useSteamIcon ? '1.5px solid rgba(27,159,255,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                        <input type="checkbox" checked={useSteamIcon} onChange={(e) => { setUseSteamIcon(e.target.checked); if (e.target.checked) setNewIconSource(null); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                        {useSteamIcon && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#1b9fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span className="text-[10px] font-semibold" style={{ color: useSteamIcon ? '#1b9fff' : '#666' }}>Steam Icon</span>
                    </label>
                  )}
                  {useSteamIcon && steamId ? (
                    <div className="w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ border: '1px solid rgba(27,159,255,0.2)', background: 'rgba(27,159,255,0.05)', color: '#1b9fff' }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#1b9fff" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                      Auto from Steam
                    </div>
                  ) : (
                    <button onClick={async () => { const p = await pickImageFile('Select New Icon'); if (p) setNewIconSource(p); }}
                      className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.04] cursor-pointer"
                      style={{ border: newIconSource ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)', color: newIconSource ? '#fff' : '#888' }}>
                      {newIconSource ? '✓ Selected' : 'Browse...'}
                    </button>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#666' }}>Banner</span>
                  <button onClick={async () => { const p = await pickImageFile('Select New Banner'); if (p) setNewBannerSource(p); }}
                    className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.04] cursor-pointer mt-auto"
                    style={{ border: newBannerSource ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)', color: newBannerSource ? '#fff' : '#888', marginTop: steamId ? '28px' : '0' }}>
                    {newBannerSource ? '✓ Selected' : 'Browse...'}
                  </button>
                </div>
              </div>

              {sectionDivider}

              {/* ─── STEAM ─── */}
              {sectionLabel('Steam Integration')}
              <div className="grid grid-cols-[1fr_2.5fr] gap-3">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#666' }}>App ID</span>
                  <input value={steamId} onChange={(e) => setSteamId(e.target.value)} placeholder="814380"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inp} />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#666' }}>Root Directory</span>
                  <div className="flex gap-2">
                    <input value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder="C:\Games\..."
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inp} />
                    <button onClick={handlePickRoot} className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-white/[0.06]"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>...</button>
                  </div>
                </div>
              </div>

              {/* Goldberg sync - compact inline */}
              {(steamId && rootPath) && (
                <div className="flex items-center gap-3">
                  <button onClick={handleSyncAchievements} disabled={isSyncing}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {isSyncing ? '...' : 'Sync Goldberg'}
                  </button>
                  {syncError && <span className="text-[10px] text-red-400 flex-1 truncate">{syncError}</span>}
                  {syncSuccess && <span className="text-[10px] text-green-400">{syncSuccess}</span>}
                  {!syncError && !syncSuccess && <span className="text-[10px]" style={{ color: '#444' }}>Inject achievements.json for Goldberg</span>}
                </div>
              )}

              {/* Steam ownership & user ID */}
              {steamId && (
                <div className="space-y-3">
                  {checkbox(ownsOnSteam, setOwnsOnSteam, 'I Own This on Steam', '#1b9fff')}
                  <AnimatePresence>
                    {ownsOnSteam && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="pl-8">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#666' }}>Steam User ID</span>
                          <input value={steamUserId} onChange={(e) => setSteamUserId(e.target.value)}
                            placeholder={localStorage.getItem('steamUserId') ? `Global: ${localStorage.getItem('steamUserId')}` : '76561198...'}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inp} />
                          <p className="text-[9px] mt-1" style={{ color: '#444' }}>Leave blank → uses global Profile ID</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {sectionDivider}

              {/* ─── EMULATOR ─── */}
              {sectionLabel('Emulator')}
              {checkbox(useEmulator, setUseEmulator, 'Launch through Emulator', '#7b61ff')}
              <AnimatePresence>
                {useEmulator && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-3 overflow-hidden">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#666' }}>Emulator Path</span>
                      <div className="flex gap-2">
                        <input value={emulatorPath} onChange={(e) => setEmulatorPath(e.target.value)} placeholder="C:\Emulators\sudachi.exe"
                          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inp} />
                        <button onClick={handlePickEmulator} className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-white/[0.06]"
                          style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>...</button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#666' }}>Flags</span>
                      <input value={emulatorFlags} onChange={(e) => setEmulatorFlags(e.target.value)} placeholder="-f --fullscreen"
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inp} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {sectionDivider}

              {/* ─── PLAYTIME ─── */}
              {sectionLabel('Playtime')}
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={manualHours} onChange={(e) => setManualHours(e.target.value)} placeholder="0"
                  className="w-14 px-2 py-2 rounded-lg text-sm text-center outline-none" style={inp} />
                <span className="text-[10px] font-bold" style={{ color: '#555' }}>hrs</span>
                <input type="number" min="0" max="59" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0"
                  className="w-14 px-2 py-2 rounded-lg text-sm text-center outline-none" style={inp} />
                <span className="text-[10px] font-bold" style={{ color: '#555' }}>mins</span>
              </div>

              {/* ─── ACTIONS ─── */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/[0.06]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', color: '#8b93a8' }}>Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#000', opacity: isSaving ? 0.5 : 1 }}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {/* Remove game */}
              <div className="border-t border-white/[0.04] pt-3">
                {showRemoveConfirm ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex-1" style={{ color: '#ff6b6b' }}>Remove from library?</span>
                    <button onClick={handleRemove} className="px-4 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'rgba(255,80,80,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.25)' }}>Confirm</button>
                    <button onClick={() => setShowRemoveConfirm(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ color: '#8b93a8' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowRemoveConfirm(true)} className="text-xs font-semibold transition-colors hover:text-red-400 cursor-pointer" style={{ color: '#666' }}>Remove Game</button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
