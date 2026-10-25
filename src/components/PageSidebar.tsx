import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { CanvaPage } from '../types/site';
import { countPageLinks } from '../utils/siteHelpers';

interface PageSidebarProps {
  pages: CanvaPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onRenamePage: (index: number, newName: string) => void;
  onDuplicatePage: (index: number) => void;
  onMovePage: (index: number, direction: -1 | 1) => void;
  onDeletePage: (index: number) => void;
  onAddPage: () => void;
}

export const PageSidebar: React.FC<PageSidebarProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  onRenamePage,
  onDuplicatePage,
  onMovePage,
  onDeletePage,
  onAddPage,
}) => {
  const [query, setQuery] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');

  const filtered = pages
    .map((p, idx) => ({ page: p, idx }))
    .filter(({ page }) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        page.name.toLowerCase().includes(q) ||
        page.anchor.toLowerCase().includes(q) ||
        String(page.index + 1).includes(q)
      );
    });

  return (
    <aside className="w-68 shrink-0 border-r border-zinc-800 bg-zinc-900/80 flex flex-col h-full select-none">
      <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Pages ({pages.length})
          </span>
          <button
            type="button"
            onClick={onAddPage}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Page
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter pages or #page-slug..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-amber-400/70"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map(({ page, idx }) => {
          const isActive = idx === activePageIndex;
          const linkCount = countPageLinks(page);
          const bgPreview = page.subpages[0]?.backgroundColor || '#1a0b2e';

          return (
            <div
              key={page.id}
              onClick={() => onSelectPage(idx)}
              className={`group rounded-lg p-2.5 transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-zinc-800/95 border-amber-400/60 text-white'
                  : 'bg-transparent border-transparent hover:bg-zinc-800/50 text-zinc-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  style={{ backgroundColor: bgPreview }}
                  className="w-6 h-6 rounded border border-white/15 shrink-0 flex items-center justify-center text-[10px] font-mono-num font-semibold text-white/90 shadow-inner mt-0.5"
                >
                  {idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  {editingIdx === idx ? (
                    <input
                      type="text"
                      autoFocus
                      value={draftName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => {
                        if (draftName.trim()) {
                          onRenamePage(idx, draftName.trim());
                        }
                        setEditingIdx(null);
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          if (draftName.trim()) {
                            onRenamePage(idx, draftName.trim());
                          }
                          setEditingIdx(null);
                        } else if (e.key === 'Escape') {
                          setEditingIdx(null);
                        }
                      }}
                      className="w-full px-1.5 py-0.5 rounded bg-zinc-950 border border-amber-400 text-xs text-white outline-none"
                    />
                  ) : (
                    <div className="text-xs font-medium leading-snug truncate">
                      {page.name}
                    </div>
                  )}

                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono-num truncate">
                    <span>{page.anchor}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {page.subpages.length}{' '}
                      {page.subpages.length === 1 ? 'sec' : 'secs'}
                    </span>
                    {linkCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{linkCount} links</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isActive && editingIdx !== idx && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 pt-2 border-t border-zinc-700/60 flex items-center justify-between gap-1"
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Rename page"
                      onClick={() => {
                        setDraftName(page.name);
                        setEditingIdx(idx);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Duplicate page"
                      onClick={() => onDuplicatePage(idx)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move page up"
                      disabled={idx === 0}
                      onClick={() => onMovePage(idx, -1)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move page down"
                      disabled={idx === pages.length - 1}
                      onClick={() => onMovePage(idx, 1)}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {pages.length > 1 && (
                    <button
                      type="button"
                      title="Delete page"
                      onClick={() => onDeletePage(idx)}
                      className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
