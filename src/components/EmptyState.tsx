import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

export default function EmptyState() {
  const openAddModal = useGameStore((s) => s.openAddModal);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          style={{ color: '#555' }}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M10 8l6 4-6 4V8z" />
        </svg>
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="text-center"
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: '#aaa' }}>
          No games added yet
        </h2>
        <p className="text-sm" style={{ color: '#666' }}>
          Click the button below to add your first game
        </p>
      </motion.div>

      {/* Add button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={openAddModal}
        className="px-8 py-3 rounded-full text-sm font-bold tracking-wide cursor-pointer transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.9)',
          color: '#000',
        }}
      >
        + Add Game
      </motion.button>
    </div>
  );
}
