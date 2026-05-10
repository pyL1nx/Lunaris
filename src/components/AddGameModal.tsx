import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, exeNameFromPath } from '../stores/gameStore';
import { pickExeFile, pickImageFile, pickRomFile, pickDirectory } from '../utils/fileUtils';

export default function AddGameModal() {
  const isOpen = useGameStore((s) => s.isAddModalOpen);
  const closeModal = useGameStore((s) => s.closeAddModal);
  const addGame = useGameStore((s) => s.addGame);
  const copyAsset = useGameStore((s) => s.copyAsset);
  const setManualPlaytime = useGameStore((s) => s.setManualPlaytime);
  const isTauri = useGameStore((s) => s.isTauri);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exePath, setExePath] = useState('');
  const [iconSource, setIconSource] = useState<string | null>(null);
  const [bannerSource, setBannerSource] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [useEmulator, setUseEmulator] = useState(false);
  const [emulatorPath, setEmulatorPath] = useState('');
  const [emulatorFlags, setEmulatorFlags] = useState('');
  const [steamId, setSteamId] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [ownsOnSteam, setOwnsOnSteam] = useState(false);
  const [steamUserId, setSteamUserId] = useState('');
  const [useSteamIcon, setUseSteamIcon] = useState(false);

  const resetForm = useCallback(() => {
    setName(''); setDescription(''); setExePath('');
    setIconSource(null); setBannerSource(null);
    setIsCompleted(false); setManualHours(''); setManualMinutes('');
    setUseEmulator(false); setEmulatorPath(''); setEmulatorFlags('');
    setSteamId(''); setRootPath('');
    setOwnsOnSteam(false); setSteamUserId(''); setUseSteamIcon(false);
    setErrors({}); setIsSaving(false); setIsSyncing(false);
  }, []);

  const handleClose = useCallback(() => { resetForm(); closeModal(); }, [resetForm, closeModal]);

  const handlePickExe = useCallback(async () => {
    const path = useEmulator ? await pickRomFile() : await pickExeFile();
    if (path) {
      setExePath(path);
      setErrors((p) => ({ ...p, exePath: '' }));
      if (!name) {
        const fn = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
        setName(fn.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
  }, [name, useEmulator]);

  const handlePickEmulator = useCallback(async () => {
    const path = await pickExeFile();
    if (path) { setEmulatorPath(path); setErrors((p) => ({ ...p, emulatorPath: '' })); }
  }, []);

  const handlePickRoot = useCallback(async () => {
    const path = await pickDirectory();
    if (path) setRootPath(path);
  }, []);

  const handleSyncAchievements = useCallback(async () => {
    if (!steamId || !rootPath) {
      setErrors((p) => ({ ...p, sync: 'Steam App ID and Game Root Directory are required to sync achievements.' }));
      return;
    }
    const apiKey = localStorage.getItem('steamApiKey');
    if (!apiKey) {
      setErrors((p) => ({ ...p, sync: 'Steam API Key not found. Please set it in your Profile.' }));
      return;
    }
    setIsSyncing(true);
    setErrors((p) => ({ ...p, sync: '' }));
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('inject_achievements', { steamId, apiKey, rootPath });
      setErrors((p) => ({ ...p, syncSuccess: 'Achievements injected successfully!' }));
      setTimeout(() => setErrors((p) => ({ ...p, syncSuccess: '' })), 3000);
    } catch (e) {
      setErrors((p) => ({ ...p, sync: String(e) }));
    } finally {
      setIsSyncing(false);
    }
  }, [steamId, rootPath]);

  const handleSubmit = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Required';
    if (!exePath.trim()) newErrors.exePath = 'Required';
    if (useEmulator && !emulatorPath.trim()) newErrors.emulatorPath = 'Required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSaving(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const id = await invoke<string>('generate_game_id');
      let iconPath = '';
      let bannerPath = '';
      if (useSteamIcon && steamId.trim()) {
        // Fetch icon from Steam
        try {
          iconPath = await invoke<string>('fetch_steam_game_icon', { steamId: steamId.trim(), gameName: name.trim() });
        } catch (e) {
          console.error('Failed to fetch Steam icon:', e);
        }
      } else if (iconSource) {
        iconPath = await copyAsset(iconSource, name, 'icon');
      }
      if (bannerSource) bannerPath = await copyAsset(bannerSource, name, 'banner');
      await addGame({
        id, name: name.trim(), exe_path: exePath.trim(),
        icon_path: iconPath, banner_path: bannerPath,
        description: description.trim(), is_completed: isCompleted,
        is_favourite: false,
        emulator_path: useEmulator ? emulatorPath.trim() : '',
        emulator_flags: useEmulator ? emulatorFlags.trim() : '',
        steam_id: steamId.trim(),
        root_path: rootPath.trim(),
        owns_on_steam: ownsOnSteam,
        steam_user_id: steamUserId.trim(),
        use_steam_icon: useSteamIcon,
      });
      const hrs = parseInt(manualHours) || 0;
      const mins = parseInt(manualMinutes) || 0;
      const totalSec = hrs * 3600 + mins * 60;
      if (totalSec > 0) await setManualPlaytime(exeNameFromPath(exePath.trim()), totalSec);
      handleClose();
    } catch (e) { setErrors({ submit: String(e) }); } finally { setIsSaving(false); }
  }, [name, description, exePath, iconSource, bannerSource, isCompleted, useEmulator, emulatorPath, emulatorFlags, steamId, rootPath, ownsOnSteam, steamUserId, manualHours, manualMinutes, addGame, copyAsset, setManualPlaytime, handleClose]);

  const fName = (p: string | null) => p?.split(/[\\/]/).pop() ?? '';
  const inputStyle = { background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0', caretColor: '#fff' };
  const errorBorder = '1px solid rgba(255,80,80,0.5)';

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
              <h2 className="text-lg font-bold" style={{ color: '#e8eaf0' }}>Add Game</h2>
              <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: '#8b93a8' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
            {!isTauri && <div className="mx-7 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,180,50,0.1)', border: '1px solid rgba(255,180,50,0.2)', color: '#ffb432' }}>⚠ Browser mode — file dialogs require the Tauri desktop app.</div>}
            <div className="px-7 pb-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Game Name *</label>
                <input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
                  placeholder="Enter game name..." className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ ...inputStyle, border: errors.name ? errorBorder : inputStyle.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Tagline</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Be Greater. Be Yourself." className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
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
                  {errors.sync && <p className="text-[10px] mt-2 text-red-400">{errors.sync}</p>}
                  {errors.syncSuccess && <p className="text-[10px] mt-2 text-green-400">{errors.syncSuccess}</p>}
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
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Emulator Path *</label>
                      <div className="flex gap-2">
                        <input value={emulatorPath} onChange={(e) => { setEmulatorPath(e.target.value); setErrors((p) => ({ ...p, emulatorPath: '' })); }}
                          placeholder="C:\Emulators\sudachi.exe" className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                          style={{ ...inputStyle, border: errors.emulatorPath ? errorBorder : inputStyle.border }} />
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>
                  {useEmulator ? 'ROM / ISO Path *' : 'Executable *'}
                </label>
                <div className="flex gap-2">
                  <input value={exePath} onChange={(e) => { setExePath(e.target.value); setErrors((p) => ({ ...p, exePath: '' })); }}
                    placeholder={useEmulator ? 'C:\\Games\\MyGame.nsp' : 'C:\\Games\\game.exe'} className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ ...inputStyle, border: errors.exePath ? errorBorder : inputStyle.border }} />
                  <button onClick={handlePickExe} className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase transition-all hover:bg-white/[0.06]"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Browse</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Icon</label>
                  {steamId ? (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className="w-4 h-4 rounded flex items-center justify-center relative"
                          style={{ background: useSteamIcon ? 'rgba(27,159,255,0.2)' : 'rgba(15,15,15,0.9)', border: useSteamIcon ? '1.5px solid rgba(27,159,255,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                          <input type="checkbox" checked={useSteamIcon} onChange={(e) => { setUseSteamIcon(e.target.checked); if (e.target.checked) setIconSource(null); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                          {useSteamIcon && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="#1b9fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: '#8b93a8' }}>Use Steam Icon</span>
                      </label>
                      {useSteamIcon ? (
                        <div className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
                          style={{ border: '2px solid rgba(27,159,255,0.2)', background: 'rgba(27,159,255,0.05)' }}>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#1b9fff" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#1b9fff" stroke="none" /></svg>
                          <span className="text-[10px]" style={{ color: '#1b9fff' }}>Steam Icon</span>
                        </div>
                      ) : (
                        <button onClick={async () => { const p = await pickImageFile('Select Icon'); if (p) setIconSource(p); }}
                          className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/[0.04] cursor-pointer"
                          style={{ border: iconSource ? '2px solid rgba(255,255,255,0.2)' : '2px dashed rgba(255,255,255,0.1)' }}>
                          {iconSource ? <><span className="text-lg">✓</span><span className="text-[11px] px-2 truncate w-full text-center" style={{ color: '#8b93a8' }}>{fName(iconSource)}</span></> : <span className="text-[11px]" style={{ color: '#4a5068' }}>Select</span>}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={async () => { const p = await pickImageFile('Select Icon'); if (p) setIconSource(p); }}
                      className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/[0.04] cursor-pointer"
                      style={{ border: iconSource ? '2px solid rgba(255,255,255,0.2)' : '2px dashed rgba(255,255,255,0.1)' }}>
                      {iconSource ? <><span className="text-lg">✓</span><span className="text-[11px] px-2 truncate w-full text-center" style={{ color: '#8b93a8' }}>{fName(iconSource)}</span></> : <span className="text-[11px]" style={{ color: '#4a5068' }}>Select</span>}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Banner</label>
                  <button onClick={async () => { const p = await pickImageFile('Select Banner'); if (p) setBannerSource(p); }}
                    className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/[0.04] cursor-pointer"
                    style={{ border: bannerSource ? '2px solid rgba(255,255,255,0.2)' : '2px dashed rgba(255,255,255,0.1)' }}>
                    {bannerSource ? <><span className="text-lg">✓</span><span className="text-[11px] px-2 truncate w-full text-center" style={{ color: '#8b93a8' }}>{fName(bannerSource)}</span></> : <span className="text-[11px]" style={{ color: '#4a5068' }}>Select</span>}
                  </button>
                </div>
              </div>
              {/* Completed checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="w-5 h-5 rounded-md flex items-center justify-center relative"
                  style={{ background: isCompleted ? 'rgba(40,200,80,0.2)' : 'rgba(15,15,15,0.9)', border: isCompleted ? '1.5px solid rgba(40,200,80,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <input type="checkbox" checked={isCompleted} onChange={(e) => setIsCompleted(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {isCompleted && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#28c850" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b93a8' }}>Mark as Completed</span>
              </label>

              {/* Own on Steam toggle */}
              {steamId && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center relative"
                      style={{ background: ownsOnSteam ? 'rgba(27,159,255,0.2)' : 'rgba(15,15,15,0.9)', border: ownsOnSteam ? '1.5px solid rgba(27,159,255,0.5)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                      <input type="checkbox" checked={ownsOnSteam} onChange={(e) => setOwnsOnSteam(e.target.checked)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {ownsOnSteam && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#1b9fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b93a8' }}>I Own This Game on Steam</span>
                  </label>
                  <AnimatePresence>
                    {ownsOnSteam && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Steam User ID (64-bit)</label>
                          <input value={steamUserId} onChange={(e) => setSteamUserId(e.target.value)}
                            placeholder={localStorage.getItem('steamUserId') ? `Global: ${localStorage.getItem('steamUserId')}` : '76561198012345678'}
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                          <p className="text-[10px] mt-1" style={{ color: '#555' }}>Leave blank to use your global Steam User ID from Profile settings.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              {/* Manual playtime */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Previous Playtime</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={manualHours} onChange={(e) => setManualHours(e.target.value)} placeholder="0"
                    className="w-16 px-3 py-2 rounded-lg text-sm text-center outline-none" style={inputStyle} />
                  <span className="text-xs" style={{ color: '#666' }}>hrs</span>
                  <input type="number" min="0" max="59" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0"
                    className="w-16 px-3 py-2 rounded-lg text-sm text-center outline-none" style={inputStyle} />
                  <span className="text-xs" style={{ color: '#666' }}>mins</span>
                </div>
              </div>
              {errors.submit && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff6b6b' }}>{errors.submit}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/[0.06]"
                  style={{ border: '1px solid rgba(255,255,255,0.06)', color: '#8b93a8' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#000', opacity: isSaving ? 0.5 : 1 }}>
                  {isSaving ? 'Saving...' : 'Add Game'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
