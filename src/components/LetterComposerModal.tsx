import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

interface LetterComposerModalProps {
  initialText: string;
  sectionCount: number;
  onSave: (updatedFullText: string) => void;
  onClose: () => void;
}

export const LetterComposerModal: React.FC<LetterComposerModalProps> = ({
  initialText,
  sectionCount,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState(initialText);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              Unified Birthday Letter Editor
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Changes sync automatically across all {sectionCount} continuous parchment scroll sections
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close letter editor"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Write naturally — blank lines preserve spacing around your stickers</span>
            <span className="font-mono-num">{draft.length} chars</span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={true}
            className="w-full flex-1 min-h-[380px] rounded-xl bg-amber-50/95 text-stone-800 p-5 text-[15px] leading-relaxed outline-none ring-1 ring-amber-900/20 focus:ring-2 focus:ring-amber-400 resize-none overflow-y-auto"
            style={{ fontFamily: "'Canva Sans', 'DM Sans', sans-serif" }}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Sync Letter Across Sections
          </button>
        </div>
      </div>
    </div>
  );
};
