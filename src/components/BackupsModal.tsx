import React, { useState } from 'react';
import {
  Clock,
  Download,
  History,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SaveSnapshot } from '../types/site';

interface BackupsModalProps {
  isOpen: boolean;
  snapshots: SaveSnapshot[];
  onClose: () => void;
  onCreateSnapshot: (title: string) => Promise<void>;
  onRestoreSnapshot: (snapshot: SaveSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const BackupsModal: React.FC<BackupsModalProps> = ({
  isOpen,
  snapshots,
  onClose,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onExportJson,
  onImportJson,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await onCreateSnapshot(newTitle.trim());
      setNewTitle('');
    } finally {
      setIsCreating(false);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Version History &amp; Backups
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Auto-Save Active
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Your edits are saved automatically. You can restore any checkpoint anytime.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create Manual Checkpoint */}
        <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Name a manual checkpoint (e.g. 'Before changing music')..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400 placeholder:text-zinc-600"
          />
          <button
            type="button"
            disabled={!newTitle.trim() || isCreating}
            onClick={handleCreate}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Checkpoint
          </button>
        </div>

        {/* Snapshots List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
              <p>No snapshots yet. Auto-saves will appear here as you edit.</p>
            </div>
          ) : (
            snapshots.map((snap) => {
              const isConfirming = restoringId === snap.id;
              return (
                <div
                  key={snap.id}
                  className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-zinc-200 truncate">
                          {snap.title}
                        </h4>
                        <span className="text-[10px] text-amber-400/90 font-mono-num px-1.5 py-0.5 rounded bg-amber-400/10">
                          {formatRelativeTime(snap.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                        <span>{snap.dateFormatted}</span>
                        <span>·</span>
                        <span>{snap.pageCount} pages</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isConfirming ? (
                      <div className="flex items-center gap-1 bg-red-950/60 border border-red-500/40 p-1 rounded-lg">
                        <span className="text-[10px] text-red-300 font-medium px-1">
                          Restore this version?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreSnapshot(snap);
                            setRestoringId(null);
                            onClose();
                          }}
                          className="px-2 py-0.5 rounded bg-red-500 hover:bg-red-400 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoringId(null)}
                          className="px-1.5 py-0.5 text-zinc-400 hover:text-white text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setRestoringId(snap.id)}
                          className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          Restore
                        </button>
                        <button
                          type="button"
                          title="Delete snapshot"
                          onClick={() => onDeleteSnapshot(snap.id)}
                          className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportJson}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Export Backup (.json)
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              Import Backup
              <input
                type="file"
                accept="application/json"
                onChange={onImportJson}
                className="hidden"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
