import React, { useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronsDown,
  ChevronsUp,
  Copy,
  ExternalLink,
  FileText,
  Film,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  MousePointerClick,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Type,
  Underline,
  Ungroup,
  Upload,
} from 'lucide-react';
import { CanvaPage, CanvasElement, SelectedElementRef } from '../types/site';
import { getScrollingLetterInfo, parseEmbedInput } from '../utils/siteHelpers';

interface InspectorPanelProps {
  pages: CanvaPage[];
  activePage: CanvaPage;
  selectedRef: SelectedElementRef | null;
  availableFonts: string[];
  onSelectElement: (ref: SelectedElementRef | null) => void;
  onUpdateElement: (
    subpageIndex: number,
    elementId: string,
    updater: (el: CanvasElement) => CanvasElement
  ) => void;
  onLayerMove: (
    subpageIndex: number,
    elementId: string,
    action: 'front' | 'forward' | 'backward' | 'back'
  ) => void;
  onDuplicateElement: (subpageIndex: number, elementId: string) => void;
  onDeleteElement: (subpageIndex: number, elementId: string) => void;
  onUngroupElement: (subpageIndex: number, elementId: string) => void;
  onUpdateSubpageBg: (subpageIndex: number, color: string) => void;
  onAddSubpage: () => void;
  onDeleteSubpage: (subpageIndex: number) => void;
  onOpenLetterComposer: () => void;
  onJumpToLink: (link: string) => void;
}

const EXTRA_STUDIO_FONTS = ['Plus Jakarta Sans', 'DM Sans', 'Georgia', 'Courier New'];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  pages,
  activePage,
  selectedRef,
  availableFonts,
  onSelectElement,
  onUpdateElement,
  onLayerMove,
  onDuplicateElement,
  onDeleteElement,
  onUngroupElement,
  onUpdateSubpageBg,
  onAddSubpage,
  onDeleteSubpage,
  onOpenLetterComposer,
  onJumpToLink,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'layers' | 'section'>('inspector');
  const [activeSubpageForLayers, setActiveSubpageForLayers] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentSubpageIdx =
    selectedRef !== null
      ? Math.min(selectedRef.subpageIndex, activePage.subpages.length - 1)
      : Math.min(activeSubpageForLayers, activePage.subpages.length - 1);

  const selectedElement =
    selectedRef !== null
      ? activePage.subpages[selectedRef.subpageIndex]?.elements.find(
          (e) => e.id === selectedRef.elementId
        ) || null
      : null;

  const allFonts = Array.from(new Set([...availableFonts, ...EXTRA_STUDIO_FONTS]));
  const letterInfo = getScrollingLetterInfo(activePage);
  const isSelectedLetterSlice =
    selectedRef !== null &&
    letterInfo.sliceRefs.some(
      (r) =>
        r.subpageIndex === selectedRef.subpageIndex &&
        r.elementId === selectedRef.elementId
    );

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRef || !selectedElement) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdateElement(selectedRef.subpageIndex, selectedElement.id, (prev) => ({
        ...prev,
        type: 'image',
        media: {
          src: dataUrl,
          maskSrc: null,
          crop: null,
          flipX: prev.media?.flipX ?? false,
          flipY: prev.media?.flipY ?? false,
          borderRadius: prev.media?.borderRadius ?? 0,
        },
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getElementSummaryLabel = (el: CanvasElement): string => {
    if (el.type === 'text' && el.textStyle) {
      return el.textStyle.text.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Empty Text';
    }
    if (el.type === 'button' && el.buttonStyle) {
      return el.buttonStyle.text.trim() || 'Button';
    }
    if (el.type === 'shape' && el.opacity <= 0.03 && el.link) {
      return `Hotspot (${el.link})`;
    }
    if (el.type === 'embed' && el.embed) {
      return `${el.embed.provider}`;
    }
    if (el.type === 'group' && el.group) {
      return `Group (${el.group.children.length} items)`;
    }
    if (el.type === 'video') {
      return el.media?.isGif ? 'Animated Sticker' : 'Video / Audio Clip';
    }
    return el.type.charAt(0).toUpperCase() + el.type.slice(1);
  };

  const renderElementIcon = (el: CanvasElement) => {
    if (el.type === 'text') return <Type className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    if (el.type === 'button')
      return <MousePointerClick className="w-3.5 h-3.5 text-emerald-300 shrink-0" />;
    if (el.type === 'image')
      return <ImageIcon className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    if (el.type === 'video')
      return <Film className="w-3.5 h-3.5 text-purple-300 shrink-0" />;
    if (el.type === 'group')
      return <FolderOpen className="w-3.5 h-3.5 text-orange-300 shrink-0" />;
    if (el.type === 'embed')
      return <ExternalLink className="w-3.5 h-3.5 text-pink-300 shrink-0" />;
    return <Square className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/80 flex flex-col h-full select-none">
      <div className="p-3 border-b border-zinc-800">
        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Properties
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Layers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('section')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'section'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sections
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'inspector' && (
          <>
            {!selectedElement || !selectedRef ? (
              <div className="py-10 text-center space-y-3">
                <Layers className="w-7 h-7 text-zinc-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">No element selected</p>
                  <p className="text-xs text-zinc-500 leading-relaxed px-2">
                    Click any text, image, sticker, button, or dashed hotspot on the stage to edit its properties, or switch to Layers to pick overlapping items.
                  </p>
                </div>

                {letterInfo.hasScrollingLetter && (
                  <button
                    type="button"
                    onClick={onOpenLetterComposer}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 text-zinc-950 text-xs font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Edit Full Birthday Letter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderElementIcon(selectedElement)}
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {getElementSummaryLabel(selectedElement)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title="Duplicate (Ctrl+D)"
                      onClick={() =>
                        onDuplicateElement(selectedRef.subpageIndex, selectedElement.id)
                      }
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete (Backspace)"
                      onClick={() =>
                        onDeleteElement(selectedRef.subpageIndex, selectedElement.id)
                      }
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isSelectedLetterSlice && (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-amber-400/40 space-y-2">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Part of the multi-section birthday scroll letter. Use the unified editor so all 6 scroll sections stay aligned.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenLetterComposer}
                      className="w-full py-1.5 px-3 rounded-md bg-amber-400 text-zinc-950 text-xs font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
                    >
                      Open Unified Letter Editor
                    </button>
                  </div>
                )}

                <div className="space-y-2 pb-4 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-amber-400" />
                      Click Link Target
                    </label>
                    {selectedElement.link && (
                      <button
                        type="button"
                        onClick={() => onJumpToLink(selectedElement.link!)}
                        className="text-[11px] font-medium text-amber-400 hover:underline cursor-pointer"
                      >
                        Go to target →
                      </button>
                    )}
                  </div>

                  <select
                    value={
                      !selectedElement.link
                        ? ''
                        : pages.some((p) => p.anchor === selectedElement.link)
                        ? selectedElement.link
                        : '__custom__'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') return;
                      onUpdateElement(
                        selectedRef.subpageIndex,
                        selectedElement.id,
                        (prev) => ({
                          ...prev,
                          link: val || null,
                        })
                      );
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400"
                  >
                    <option value="">No link (static element)</option>
                    {pages.map((p, idx) => (
                      <option key={p.id} value={p.anchor}>
                        Page {idx + 1}: {p.name} ({p.anchor})
                      </option>
                    ))}
                    <option value="__custom__">Custom URL / Anchor...</option>
                  </select>

                  <input
                    type="text"
                    value={selectedElement.link || ''}
                    onChange={(e) =>
                      onUpdateElement(
                        selectedRef.subpageIndex,
                        selectedElement.id,
                        (prev) => ({
                          ...prev,
                          link: e.target.value.trim() || null,
                        })
                      )
                    }
                    placeholder="e.g. #page-8 or https://..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-400"
                  />
                </div>

                {(selectedElement.type === 'text' ||
                  selectedElement.type === 'button') && (
                  <div className="space-y-3 pb-4 border-b border-zinc-800">
                    <label className="block text-xs font-semibold text-zinc-200">
                      Text Content
                    </label>
                    <textarea
                      rows={selectedElement.type === 'button' ? 2 : 5}
                      value={
                        selectedElement.type === 'text'
                          ? selectedElement.textStyle?.text || ''
                          : selectedElement.buttonStyle?.text || ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateElement(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          (prev) => {
                            if (prev.type === 'text' && prev.textStyle) {
                              return {
                                ...prev,
                                textStyle: { ...prev.textStyle, text: val },
                              };
                            }
                            if (prev.type === 'button' && prev.buttonStyle) {
                              return {
                                ...prev,
                                buttonStyle: { ...prev.buttonStyle, text: val },
                              };
                            }
                            return prev;
                          }
                        );
                      }}
                      className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-amber-400 resize-y"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <span className="block text-[11px] text-zinc-400 mb-1">Font</span>
                        <select
                          value={
                            (selectedElement.type === 'text'
                              ? selectedElement.textStyle?.fontFamily
                              : selectedElement.buttonStyle?.fontFamily) || 'Canva Sans'
                          }
                          onChange={(e) => {
                            const f = e.target.value;
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) => {
                                if (prev.type === 'text' && prev.textStyle) {
                                  return {
                                    ...prev,
                                    textStyle: { ...prev.textStyle, fontFamily: f },
                                  };
                                }
                                if (prev.type === 'button' && prev.buttonStyle) {
                                  return {
                                    ...prev,
                                    buttonStyle: { ...prev.buttonStyle, fontFamily: f },
                                  };
                                }
                                return prev;
                              }
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400"
                        >
                          {allFonts.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="block text-[11px] text-zinc-400 mb-1">
                          Size (px)
                        </span>
                        <input
                          type="number"
                          min={6}
                          max={300}
                          step={1}
                          value={Math.round(
                            (selectedElement.type === 'text'
                              ? selectedElement.textStyle?.fontSize
                              : selectedElement.buttonStyle?.fontSize) || 18
                          )}
                          onChange={(e) => {
                            const sz = Math.max(6, Number(e.target.value) || 16);
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) => {
                                if (prev.type === 'text' && prev.textStyle) {
                                  return {
                                    ...prev,
                                    textStyle: { ...prev.textStyle, fontSize: sz },
                                  };
                                }
                                if (prev.type === 'button' && prev.buttonStyle) {
                                  return {
                                    ...prev,
                                    buttonStyle: { ...prev.buttonStyle, fontSize: sz },
                                  };
                                }
                                return prev;
                              }
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={
                            (selectedElement.type === 'text'
                              ? selectedElement.textStyle?.color
                              : selectedElement.buttonStyle?.color) || '#ffffff'
                          }
                          onChange={(e) => {
                            const col = e.target.value;
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) => {
                                if (prev.type === 'text' && prev.textStyle) {
                                  return {
                                    ...prev,
                                    textStyle: { ...prev.textStyle, color: col },
                                  };
                                }
                                if (prev.type === 'button' && prev.buttonStyle) {
                                  return {
                                    ...prev,
                                    buttonStyle: { ...prev.buttonStyle, color: col },
                                  };
                                }
                                return prev;
                              }
                            );
                          }}
                          className="w-7 h-7 rounded bg-transparent border border-zinc-700 cursor-pointer"
                        />
                        <span className="text-[11px] font-mono-num text-zinc-400">
                          {(selectedElement.type === 'text'
                            ? selectedElement.textStyle?.color
                            : selectedElement.buttonStyle?.color) || '#ffffff'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {(['bold', 'italic', 'underline'] as const).map((prop) => {
                          const styleObj =
                            selectedElement.type === 'text'
                              ? selectedElement.textStyle
                              : selectedElement.buttonStyle;
                          const isActive = Boolean(styleObj?.[prop]);
                          const Icon =
                            prop === 'bold'
                              ? Bold
                              : prop === 'italic'
                              ? Italic
                              : Underline;
                          return (
                            <button
                              key={prop}
                              type="button"
                              onClick={() =>
                                onUpdateElement(
                                  selectedRef.subpageIndex,
                                  selectedElement.id,
                                  (prev) => {
                                    if (prev.type === 'text' && prev.textStyle) {
                                      return {
                                        ...prev,
                                        textStyle: {
                                          ...prev.textStyle,
                                          [prop]: !prev.textStyle[prop],
                                        },
                                      };
                                    }
                                    if (prev.type === 'button' && prev.buttonStyle) {
                                      return {
                                        ...prev,
                                        buttonStyle: {
                                          ...prev.buttonStyle,
                                          [prop]: !prev.buttonStyle[prop],
                                        },
                                      };
                                    }
                                    return prev;
                                  }
                                )
                              }
                              className={`p-1.5 rounded border cursor-pointer ${
                                isActive
                                  ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedElement.type === 'text' && selectedElement.textStyle && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-zinc-400">Alignment</span>
                        <div className="flex items-center gap-1">
                          {(['left', 'center', 'right'] as const).map((al) => {
                            const Icon =
                              al === 'left'
                                ? AlignLeft
                                : al === 'center'
                                ? AlignCenter
                                : AlignRight;
                            const active = selectedElement.textStyle?.align === al;
                            return (
                              <button
                                key={al}
                                type="button"
                                onClick={() =>
                                  onUpdateElement(
                                    selectedRef.subpageIndex,
                                    selectedElement.id,
                                    (prev) =>
                                      prev.textStyle
                                        ? {
                                            ...prev,
                                            textStyle: { ...prev.textStyle, align: al },
                                          }
                                        : prev
                                  )
                                }
                                className={`p-1.5 rounded border cursor-pointer ${
                                  active
                                    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedElement.type === 'button' && selectedElement.buttonStyle && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Button Fill
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={selectedElement.buttonStyle.backgroundColor}
                              onChange={(e) =>
                                onUpdateElement(
                                  selectedRef.subpageIndex,
                                  selectedElement.id,
                                  (prev) =>
                                    prev.buttonStyle
                                      ? {
                                          ...prev,
                                          buttonStyle: {
                                            ...prev.buttonStyle,
                                            backgroundColor: e.target.value,
                                          },
                                        }
                                      : prev
                                )
                              }
                              className="w-7 h-7 rounded bg-transparent border border-zinc-700 cursor-pointer"
                            />
                            <span className="text-[11px] font-mono-num text-zinc-400">
                              {selectedElement.buttonStyle.backgroundColor}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Corner Radius
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={Math.round(selectedElement.buttonStyle.borderRadius)}
                            onChange={(e) =>
                              onUpdateElement(
                                selectedRef.subpageIndex,
                                selectedElement.id,
                                (prev) =>
                                  prev.buttonStyle
                                    ? {
                                        ...prev,
                                        buttonStyle: {
                                          ...prev.buttonStyle,
                                          borderRadius: Math.max(
                                            0,
                                            Number(e.target.value) || 0
                                          ),
                                        },
                                      }
                                    : prev
                              )
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedElement.type === 'group' && selectedElement.group && (
                  <div className="space-y-3 pb-4 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">
                        Grouped Elements ({selectedElement.group.children.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUngroupElement(selectedRef.subpageIndex, selectedElement.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/40 hover:bg-amber-400/25 text-xs font-medium cursor-pointer"
                      >
                        <Ungroup className="w-3.5 h-3.5" />
                        Ungroup
                      </button>
                    </div>

                    {selectedElement.group.children.some((c) => c.type === 'text') && (
                      <div className="space-y-2">
                        <span className="text-[11px] text-zinc-400 block">
                          Quick-edit text inside group:
                        </span>
                        {selectedElement.group.children.map((child, cIdx) => {
                          if (child.type !== 'text' || !child.textStyle) return null;
                          return (
                            <textarea
                              key={child.id}
                              rows={2}
                              value={child.textStyle.text}
                              onChange={(e) => {
                                const nextTxt = e.target.value;
                                onUpdateElement(
                                  selectedRef.subpageIndex,
                                  selectedElement.id,
                                  (prev) => {
                                    if (!prev.group) return prev;
                                    const updatedChildren = prev.group.children.map(
                                      (ch, idx) =>
                                        idx === cIdx && ch.textStyle
                                          ? {
                                              ...ch,
                                              textStyle: {
                                                ...ch.textStyle,
                                                text: nextTxt,
                                              },
                                            }
                                          : ch
                                    );
                                    return {
                                      ...prev,
                                      group: {
                                        ...prev.group,
                                        children: updatedChildren,
                                      },
                                    };
                                  }
                                );
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400 resize-y"
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {(selectedElement.type === 'image' ||
                  selectedElement.type === 'video') &&
                  selectedElement.media && (
                    <div className="space-y-3 pb-4 border-b border-zinc-800">
                      <span className="block text-xs font-semibold text-zinc-200">
                        Media Source
                      </span>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Replace with Uploaded Image / GIF
                      </button>

                      <div>
                        <span className="block text-[11px] text-zinc-400 mb-1">
                          Image / Video URL
                        </span>
                        <input
                          type="text"
                          value={selectedElement.media.src}
                          onChange={(e) =>
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) =>
                                prev.media
                                  ? {
                                      ...prev,
                                      media: {
                                        ...prev.media,
                                        src: e.target.value,
                                        crop: null,
                                        maskSrc: null,
                                      },
                                    }
                                  : prev
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-300 outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) =>
                                prev.media
                                  ? {
                                      ...prev,
                                      media: {
                                        ...prev.media,
                                        flipX: !prev.media.flipX,
                                      },
                                    }
                                  : prev
                            )
                          }
                          className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedElement.media.flipX
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <FlipHorizontal className="w-3.5 h-3.5" />
                          Flip H
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) =>
                                prev.media
                                  ? {
                                      ...prev,
                                      media: {
                                        ...prev.media,
                                        flipY: !prev.media.flipY,
                                      },
                                    }
                                  : prev
                            )
                          }
                          className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedElement.media.flipY
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <FlipVertical className="w-3.5 h-3.5" />
                          Flip V
                        </button>
                      </div>

                      {selectedElement.type === 'video' &&
                        !selectedElement.media.isGif && (
                          <div className="space-y-3 pt-1 border-t border-zinc-800/80">
                            <div>
                              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Playback Audio Volume</span>
                                <span className="font-mono-num text-amber-300 font-semibold">
                                  {Math.round((selectedElement.media.volume ?? 0) * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(
                                  (selectedElement.media.volume ?? 0) * 100
                                )}
                                onChange={(e) => {
                                  const vol = Number(e.target.value) / 100;
                                  onUpdateElement(
                                    selectedRef.subpageIndex,
                                    selectedElement.id,
                                    (prev) =>
                                      prev.media
                                        ? {
                                            ...prev,
                                            media: { ...prev.media, volume: vol },
                                          }
                                        : prev
                                  );
                                }}
                                className="w-full accent-amber-400"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-zinc-400">Loop Playback</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateElement(
                                    selectedRef.subpageIndex,
                                    selectedElement.id,
                                    (prev) =>
                                      prev.media
                                        ? {
                                            ...prev,
                                            media: {
                                              ...prev.media,
                                              loop: !prev.media.loop,
                                            },
                                          }
                                        : prev
                                  );
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                  selectedElement.media.loop
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                              >
                                {selectedElement.media.loop ? 'Looping' : 'Once'}
                              </button>
                            </div>

                            {selectedElement.media.src && (
                              <div className="text-[10px] text-zinc-500 truncate" title={selectedElement.media.src}>
                                Track: {selectedElement.media.src.split('/').pop()}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                {selectedElement.type === 'shape' &&
                  selectedElement.shape &&
                  selectedElement.shape.paths.length > 0 && (
                    <div className="space-y-3 pb-4 border-b border-zinc-800">
                      <span className="block text-xs font-semibold text-zinc-200">
                        Shape Appearance
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Fill Color
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={selectedElement.shape.paths[0].fill || '#cccccc'}
                              onChange={(e) => {
                                const col = e.target.value;
                                onUpdateElement(
                                  selectedRef.subpageIndex,
                                  selectedElement.id,
                                  (prev) => {
                                    if (!prev.shape) return prev;
                                    const updatedPaths = prev.shape.paths.map((p, i) =>
                                      i === 0 ? { ...p, fill: col } : p
                                    );
                                    return {
                                      ...prev,
                                      shape: { ...prev.shape, paths: updatedPaths },
                                    };
                                  }
                                );
                              }}
                              className="w-7 h-7 rounded bg-transparent border border-zinc-700 cursor-pointer"
                            />
                            <span className="text-[11px] font-mono-num text-zinc-400">
                              {selectedElement.shape.paths[0].fill}
                            </span>
                          </div>
                        </div>

                        {selectedElement.shape.isRect && (
                          <div>
                            <span className="block text-[11px] text-zinc-400 mb-1">
                              Corner Radius
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={200}
                              value={Math.round(
                                selectedElement.shape.paths[0].cornerRadius || 0
                              )}
                              onChange={(e) => {
                                const r = Math.max(0, Number(e.target.value) || 0);
                                onUpdateElement(
                                  selectedRef.subpageIndex,
                                  selectedElement.id,
                                  (prev) => {
                                    if (!prev.shape) return prev;
                                    const updatedPaths = prev.shape.paths.map((p, i) =>
                                      i === 0 ? { ...p, cornerRadius: r } : p
                                    );
                                    return {
                                      ...prev,
                                      shape: { ...prev.shape, paths: updatedPaths },
                                    };
                                  }
                                );
                              }}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {selectedElement.type === 'embed' && selectedElement.embed && (
                  <div className="space-y-2 pb-4 border-b border-zinc-800">
                    <label className="block text-xs font-semibold text-zinc-200">
                      Spotify or YouTube Link
                    </label>
                    <input
                      type="text"
                      value={selectedElement.embed.originalUrl}
                      onChange={(e) => {
                        const parsed = parseEmbedInput(e.target.value);
                        onUpdateElement(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          (prev) => ({
                            ...prev,
                            embed: parsed,
                          })
                        );
                      }}
                      placeholder="Paste Spotify playlist/track or YouTube URL..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <span className="block text-xs font-semibold text-zinc-200">
                    Layout &amp; Layer Order
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['X', 'x'],
                        ['Y', 'y'],
                        ['Width', 'width'],
                        ['Height', 'height'],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key}>
                        <span className="block text-[11px] text-zinc-400 mb-1">
                          {label}
                        </span>
                        <input
                          type="number"
                          value={Math.round(selectedElement[key])}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            onUpdateElement(
                              selectedRef.subpageIndex,
                              selectedElement.id,
                              (prev) => ({
                                ...prev,
                                [key]:
                                  key === 'width' || key === 'height'
                                    ? Math.max(10, val)
                                    : val,
                              })
                            );
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1">
                        Rotation (°)
                      </span>
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        value={Math.round(selectedElement.rotation)}
                        onChange={(e) =>
                          onUpdateElement(
                            selectedRef.subpageIndex,
                            selectedElement.id,
                            (prev) => ({
                              ...prev,
                              rotation: Number(e.target.value) || 0,
                            })
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1">
                        Opacity (%)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selectedElement.opacity * 100)}
                        onChange={(e) => {
                          const pct = Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0)
                          );
                          onUpdateElement(
                            selectedRef.subpageIndex,
                            selectedElement.id,
                            (prev) => ({
                              ...prev,
                              opacity: pct / 100,
                            })
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono-num text-zinc-200 outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      type="button"
                      title="Bring to Front"
                      onClick={() =>
                        onLayerMove(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          'front'
                        )
                      }
                      className="py-1.5 rounded-md bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Bring Forward"
                      onClick={() =>
                        onLayerMove(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          'forward'
                        )
                      }
                      className="py-1.5 rounded-md bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Send Backward"
                      onClick={() =>
                        onLayerMove(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          'backward'
                        )
                      }
                      className="py-1.5 rounded-md bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Send to Back"
                      onClick={() =>
                        onLayerMove(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          'back'
                        )
                      }
                      className="py-1.5 rounded-md bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center cursor-pointer"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Animation &amp; Motion
                    </span>
                    {selectedElement.animation && selectedElement.animation.type !== 'none' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30 capitalize">
                        {selectedElement.animation.type}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1">
                      Entrance Effect
                    </span>
                    <select
                      value={selectedElement.animation?.type || 'none'}
                      onChange={(e) => {
                        const newType = e.target.value as any;
                        onUpdateElement(
                          selectedRef.subpageIndex,
                          selectedElement.id,
                          (prev) => ({
                            ...prev,
                            animation: {
                              type: newType,
                              direction: prev.animation?.direction || 'up',
                              duration: prev.animation?.duration ?? 0.6,
                              delay: prev.animation?.delay ?? 0,
                              loop: newType === 'breathe',
                            },
                          })
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400"
                    >
                      <option value="none">None (Static)</option>
                      <option value="pop">Pop (Bouncy Spring Zoom)</option>
                      <option value="rise">Rise (Upward Float)</option>
                      <option value="pan">Pan (Directional Slide)</option>
                      <option value="scrapbook">Scrapbook (Tilted Drop)</option>
                      <option value="fade">Fade (Smooth Dissolve)</option>
                      <option value="breathe">Breathe (Continuous Pulse)</option>
                      <option value="typewriter">Typewriter (Text Reveal)</option>
                    </select>
                  </div>

                  {selectedElement.animation && selectedElement.animation.type !== 'none' && (
                    <>
                      {(selectedElement.animation.type === 'pan' ||
                        selectedElement.animation.type === 'rise') && (
                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Direction
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {(['up', 'down', 'left', 'right'] as const).map((dir) => (
                              <button
                                key={dir}
                                type="button"
                                onClick={() =>
                                  onUpdateElement(
                                    selectedRef.subpageIndex,
                                    selectedElement.id,
                                    (prev) => ({
                                      ...prev,
                                      animation: prev.animation
                                        ? { ...prev.animation, direction: dir }
                                        : { type: 'rise', direction: dir },
                                    })
                                  )
                                }
                                className={`py-1 text-[11px] font-medium rounded border capitalize cursor-pointer ${
                                  selectedElement.animation?.direction === dir
                                    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {dir}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Duration ({selectedElement.animation.duration ?? 0.6}s)
                          </span>
                          <input
                            type="range"
                            min={0.2}
                            max={2.5}
                            step={0.1}
                            value={selectedElement.animation.duration ?? 0.6}
                            onChange={(e) => {
                              const d = Number(e.target.value);
                              onUpdateElement(
                                selectedRef.subpageIndex,
                                selectedElement.id,
                                (prev) => ({
                                  ...prev,
                                  animation: prev.animation
                                    ? { ...prev.animation, duration: d }
                                    : { type: 'fade', duration: d },
                                })
                              );
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>

                        <div>
                          <span className="block text-[11px] text-zinc-400 mb-1">
                            Delay ({selectedElement.animation.delay ?? 0}s)
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={2}
                            step={0.05}
                            value={selectedElement.animation.delay ?? 0}
                            onChange={(e) => {
                              const dl = Number(e.target.value);
                              onUpdateElement(
                                selectedRef.subpageIndex,
                                selectedElement.id,
                                (prev) => ({
                                  ...prev,
                                  animation: prev.animation
                                    ? { ...prev.animation, delay: dl }
                                    : { type: 'fade', delay: dl },
                                })
                              );
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'layers' && (
          <div className="space-y-3">
            {activePage.subpages.length > 1 && (
              <div>
                <span className="block text-[11px] text-zinc-400 mb-1">
                  Viewing Section
                </span>
                <select
                  value={currentSubpageIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setActiveSubpageForLayers(idx);
                    onSelectElement(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none"
                >
                  {activePage.subpages.map((sp, i) => (
                    <option key={sp.id} value={i}>
                      Section {i + 1} ({sp.elements.length} layers)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-[11px] text-zinc-500">
              Top-most elements appear first. Click any layer to select it even when covered by a hotspot.
            </p>

            <div className="space-y-1">
              {[...(activePage.subpages[currentSubpageIdx]?.elements || [])]
                .reverse()
                .map((el) => {
                  const isSel =
                    selectedRef?.subpageIndex === currentSubpageIdx &&
                    selectedRef?.elementId === el.id;
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => {
                        onSelectElement({
                          subpageIndex: currentSubpageIdx,
                          elementId: el.id,
                        });
                        setActiveTab('inspector');
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs border transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-zinc-800 border-amber-400/60 text-white'
                          : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderElementIcon(el)}
                        <span className="truncate">{getElementSummaryLabel(el)}</span>
                      </div>
                      {el.link && (
                        <span className="text-[10px] font-mono-num text-amber-400 shrink-0">
                          {el.link}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === 'section' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">
                Page Sections ({activePage.subpages.length})
              </span>
              <button
                type="button"
                onClick={onAddSubpage}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Section
              </button>
            </div>

            <div className="space-y-2.5">
              {activePage.subpages.map((sp, sIdx) => (
                <div
                  key={sp.id}
                  className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-200">
                      Section {sIdx + 1} · {sp.elements.length} items
                    </span>
                    {activePage.subpages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSubpage(sIdx)}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-300 cursor-pointer"
                        title="Delete section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Background Color</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={sp.backgroundColor || '#1a0b2e'}
                        onChange={(e) => onUpdateSubpageBg(sIdx, e.target.value)}
                        className="w-6 h-6 rounded bg-transparent border border-zinc-700 cursor-pointer"
                      />
                      <span className="text-[11px] font-mono-num text-zinc-400">
                        {sp.backgroundColor || '#1a0b2e'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
