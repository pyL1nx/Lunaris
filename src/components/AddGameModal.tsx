import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, exeNameFromPath } from '../stores/gameStore';
import { pickExeFile, pickImageFile } from '../utils/fileUtils';

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

  const resetForm = useCallback(() => {
    setName(''); setDescription(''); setExePath('');
    setIconSource(null); setBannerSource(null);
    setIsCompleted(false); setManualHours(''); setManualMinutes('');
    setErrors({}); setIsSaving(false);
  }, []);

  const handleClose = useCallback(() => { resetForm(); closeModal(); }, [resetForm, closeModal]);

  const handlePickExe = useCallback(async () => {
    const path = await pickExeFile();
    if (path) {
      setExePath(path);
      setErrors((p) => ({ ...p, exePath: '' }));
      if (!name) {
        const fn = path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
        setName(fn.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
  }, [name]);

  const handleSubmit = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Required';
    if (!exePath.trim()) newErrors.exePath = 'Required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setIsSaving(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const id = await invoke<string>('generate_game_id');
      let iconPath = '';
      let bannerPath = '';
      if (iconSource) iconPath = await copyAsset(iconSource, name, 'icon');
      if (bannerSource) bannerPath = await copyAsset(bannerSource, name, 'banner');
      await addGame({ id, name: name.trim(), exe_path: exePath.trim(), icon_path: iconPath, banner_path: bannerPath, description: description.trim(), is_completed: isCompleted });
      const hrs = parseInt(manualHours) || 0;
      const mins = parseInt(manualMinutes) || 0;
      const totalSec = hrs * 3600 + mins * 60;
      if (totalSec > 0) await setManualPlaytime(exeNameFromPath(exePath.trim()), totalSec);
      handleClose();
    } catch (e) { setErrors({ submit: String(e) }); } finally { setIsSaving(false); }
  }, [name, description, exePath, iconSource, bannerSource, isCompleted, manualHours, manualMinutes, addGame, copyAsset, setManualPlaytime, handleClose]);

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
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Executable *</label>
                <div className="flex gap-2">
                  <input value={exePath} onChange={(e) => { setExePath(e.target.value); setErrors((p) => ({ ...p, exePath: '' })); }}
                    placeholder="C:\Games\game.exe" className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ ...inputStyle, border: errors.exePath ? errorBorder : inputStyle.border }} />
                  <button onClick={handlePickExe} className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase transition-all hover:bg-white/[0.06]"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>Browse</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8b93a8' }}>Icon</label>
                  <button onClick={async () => { const p = await pickImageFile('Select Icon'); if (p) setIconSource(p); }}
                    className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/[0.04] cursor-pointer"
                    style={{ border: iconSource ? '2px solid rgba(255,255,255,0.2)' : '2px dashed rgba(255,255,255,0.1)' }}>
                    {iconSource ? <><span className="text-lg">✓</span><span className="text-[11px] px-2 truncate w-full text-center" style={{ color: '#8b93a8' }}>{fName(iconSource)}</span></> : <span className="text-[11px]" style={{ color: '#4a5068' }}>Select</span>}
                  </button>
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
