import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { CanvaPage, CanvasElement, SelectedElementRef } from '../types/site';
import { getScrollingLetterInfo } from '../utils/siteHelpers';
import { CanvasElementRenderer } from './CanvasElementRenderer';

interface PageStageProps {
  page: CanvaPage;
  isEditor: boolean;
  zoom: number | 'fit';
  selectedRef: SelectedElementRef | null;
  showHotspots: boolean;
  soundMuted: boolean;
  animationsEnabled?: boolean;
  animReplayKey?: number;
  onSelectElement: (ref: SelectedElementRef | null) => void;
  onUpdateElementTransient: (
    subpageIndex: number,
    elementId: string,
    updater: (el: CanvasElement) => CanvasElement
  ) => void;
  onCommitHistory: () => void;
  onOpenLetterComposer: () => void;
  onNavigateLink: (link: string) => void;
}

interface InteractionState {
  mode: 'drag' | 'resize' | 'rotate';
  subpageIndex: number;
  elementId: string;
  handle?: string;
  startClientX: number;
  startClientY: number;
  initialEl: CanvasElement;
  centerX?: number;
  centerY?: number;
  hasMoved: boolean;
}

export const PageStage: React.FC<PageStageProps> = ({
  page,
  isEditor,
  zoom,
  selectedRef,
  showHotspots,
  soundMuted,
  animationsEnabled = true,
  animReplayKey = 0,
  onSelectElement,
  onUpdateElementTransient,
  onCommitHistory,
  onOpenLetterComposer,
  onNavigateLink,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);
  const [snapGuideY, setSnapGuideY] = useState<number | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateSize = () => {
      setContainerWidth(node.clientWidth);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(node);
    return () => ro.disconnect();
  }, [isEditor]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [page.id]);

  const baseWidth = page.subpages[0]?.width || 1366;
  const effectiveScale = (() => {
    if (!isEditor) {
      return Math.max(0.24, containerWidth / baseWidth);
    }
    if (zoom === 'fit') {
      const padded = Math.max(320, containerWidth - 64);
      return Math.min(1, Math.max(0.28, padded / baseWidth));
    }
    return zoom;
  })();

  const letterInfo = getScrollingLetterInfo(page);

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = interactionRef.current;
      if (!state) return;

      const dx = (e.clientX - state.startClientX) / effectiveScale;
      const dy = (e.clientY - state.startClientY) / effectiveScale;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        state.hasMoved = true;
      }

      const init = state.initialEl;

      if (state.mode === 'drag') {
        let nextX = Math.round((init.x + dx) * 10) / 10;
        let nextY = Math.round((init.y + dy) * 10) / 10;

        const elemMidX = nextX + init.width / 2;
        const elemMidY = nextY + init.height / 2;
        if (Math.abs(elemMidX - 683) < 6) {
          nextX = Math.round((683 - init.width / 2) * 10) / 10;
          setSnapGuideX(683);
        } else {
          setSnapGuideX(null);
        }

        if (Math.abs(elemMidY - 384) < 6) {
          nextY = Math.round((384 - init.height / 2) * 10) / 10;
          setSnapGuideY(384);
        } else {
          setSnapGuideY(null);
        }

        onUpdateElementTransient(state.subpageIndex, state.elementId, (prev) => ({
          ...prev,
          x: nextX,
          y: nextY,
        }));
      } else if (state.mode === 'resize' && state.handle) {
        const h = state.handle;
        let newX = init.x;
        let newY = init.y;
        let newW = init.width;
        let newH = init.height;

        if (h.includes('e')) newW = Math.max(16, init.width + dx);
        if (h.includes('s')) newH = Math.max(16, init.height + dy);
        if (h.includes('w')) {
          const deltaW = Math.min(init.width - 16, dx);
          newX = init.x + deltaW;
          newW = init.width - deltaW;
        }
        if (h.includes('n')) {
          const deltaH = Math.min(init.height - 16, dy);
          newY = init.y + deltaH;
          newH = init.height - deltaH;
        }

        const scaleRatioW = newW / (init.width || 1);
        const scaleRatioH = newH / (init.height || 1);

        onUpdateElementTransient(state.subpageIndex, state.elementId, (prev) => {
          const updated: CanvasElement = {
            ...prev,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
            width: Math.round(newW * 10) / 10,
            height: Math.round(newH * 10) / 10,
          };
          if (init.media?.crop && updated.media) {
            updated.media = {
              ...updated.media,
              crop: {
                x: Math.round(init.media.crop.x * scaleRatioW * 10) / 10,
                y: Math.round(init.media.crop.y * scaleRatioH * 10) / 10,
                width: Math.round(init.media.crop.width * scaleRatioW * 10) / 10,
                height: Math.round(init.media.crop.height * scaleRatioH * 10) / 10,
              },
            };
          }
          return updated;
        });
      } else if (
        state.mode === 'rotate' &&
        state.centerX !== undefined &&
        state.centerY !== undefined
      ) {
        const angleRad = Math.atan2(e.clientY - state.centerY, e.clientX - state.centerX);
        let deg = Math.round(((angleRad * 180) / Math.PI + 90) * 10) / 10;
        if (deg > 180) deg -= 360;
        for (const snapAngle of [0, 90, -90, 180, -180]) {
          if (Math.abs(deg - snapAngle) < 3) {
            deg = snapAngle;
            break;
          }
        }
        onUpdateElementTransient(state.subpageIndex, state.elementId, (prev) => ({
          ...prev,
          rotation: deg,
        }));
      }
    },
    [effectiveScale, onUpdateElementTransient]
  );

  const handleGlobalMouseUp = useCallback(() => {
    const state = interactionRef.current;
    if (!state) return;
    const moved = state.hasMoved;
    interactionRef.current = null;
    setSnapGuideX(null);
    setSnapGuideY(null);
    if (moved) {
      onCommitHistory();
    }
  }, [onCommitHistory]);

  useEffect(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (isEditor) {
          onSelectElement(null);
        }
      }}
      className={`w-full h-full overflow-y-auto overflow-x-hidden ${
        isEditor ? 'bg-zinc-950 py-8 px-4' : 'bg-black'
      }`}
    >
      {isEditor && letterInfo.hasScrollingLetter && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-3xl mx-auto mb-5 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-zinc-300 truncate">
              This page spans a continuous birthday letter across 6 scroll sections. Edit it in one unified view instead of aligning 6 slices manually.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLetterComposer}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-zinc-950 text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Edit Full Letter
          </button>
        </div>
      )}

      <motion.div
        key={`${page.id}-${animReplayKey ?? 0}`}
        initial={animationsEnabled && !isEditor ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="mx-auto flex flex-col items-center"
        style={{
          width: `${baseWidth * effectiveScale}px`,
          gap: isEditor ? '24px' : '0px',
        }}
      >
        {page.subpages.map((sp, spIdx) => {
          const scaledHeight = sp.height * effectiveScale;
          return (
            <div key={sp.id} className="relative flex flex-col items-start">
              {isEditor && page.subpages.length > 1 && (
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-zinc-400 select-none">
                  <span>Section {spIdx + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    {Math.round(sp.width)} × {Math.round(sp.height)}
                  </span>
                </div>
              )}

              <div
                style={{
                  width: `${sp.width * effectiveScale}px`,
                  height: `${scaledHeight}px`,
                }}
                className={`relative overflow-hidden ${
                  isEditor ? 'rounded-lg ring-1 ring-white/15 shadow-2xl' : ''
                }`}
              >
                <div
                  data-subpage-stage={spIdx}
                  style={{
                    width: `${sp.width}px`,
                    height: `${sp.height}px`,
                    backgroundColor: sp.backgroundColor || '#1a0b2e',
                    transform: `scale(${effectiveScale})`,
                    transformOrigin: '0 0',
                  }}
                  className="relative overflow-hidden"
                >
                  {sp.elements.map((el) => {
                    const isSelected =
                      Boolean(isEditor) &&
                      selectedRef?.subpageIndex === spIdx &&
                      selectedRef?.elementId === el.id;

                    return (
                      <CanvasElementRenderer
                        key={el.id}
                        element={el}
                        isEditor={isEditor}
                        isSelected={isSelected}
                        showHotspots={showHotspots}
                        soundMuted={soundMuted}
                        animationsEnabled={animationsEnabled}
                        animReplayKey={animReplayKey}
                        onSelect={(_, clickedEl) => {
                          onSelectElement({ subpageIndex: spIdx, elementId: clickedEl.id });
                        }}
                        onStartDrag={(mouseEvt, draggedEl) => {
                          interactionRef.current = {
                            mode: 'drag',
                            subpageIndex: spIdx,
                            elementId: draggedEl.id,
                            startClientX: mouseEvt.clientX,
                            startClientY: mouseEvt.clientY,
                            initialEl: JSON.parse(JSON.stringify(draggedEl)),
                            hasMoved: false,
                          };
                        }}
                        onStartResize={(mouseEvt, resizedEl, handle) => {
                          interactionRef.current = {
                            mode: 'resize',
                            subpageIndex: spIdx,
                            elementId: resizedEl.id,
                            handle,
                            startClientX: mouseEvt.clientX,
                            startClientY: mouseEvt.clientY,
                            initialEl: JSON.parse(JSON.stringify(resizedEl)),
                            hasMoved: false,
                          };
                        }}
                        onStartRotate={(mouseEvt, rotatedEl) => {
                          const targetNode = (
                            mouseEvt.currentTarget as HTMLElement
                          ).parentElement;
                          const rect = targetNode?.getBoundingClientRect();
                          const cx = rect ? rect.left + rect.width / 2 : mouseEvt.clientX;
                          const cy = rect ? rect.top + rect.height / 2 : mouseEvt.clientY;
                          interactionRef.current = {
                            mode: 'rotate',
                            subpageIndex: spIdx,
                            elementId: rotatedEl.id,
                            startClientX: mouseEvt.clientX,
                            startClientY: mouseEvt.clientY,
                            initialEl: JSON.parse(JSON.stringify(rotatedEl)),
                            centerX: cx,
                            centerY: cy,
                            hasMoved: false,
                          };
                        }}
                        onInlineTextChange={(elId, newText) => {
                          onUpdateElementTransient(spIdx, elId, (prev) => {
                            if (prev.type === 'text' && prev.textStyle) {
                              return {
                                ...prev,
                                textStyle: { ...prev.textStyle, text: newText },
                              };
                            }
                            if (prev.type === 'button' && prev.buttonStyle) {
                              return {
                                ...prev,
                                buttonStyle: { ...prev.buttonStyle, text: newText },
                              };
                            }
                            return prev;
                          });
                          onCommitHistory();
                        }}
                        onDoubleClickSpecial={(dblEl) => {
                          const isLetterSlice = letterInfo.sliceRefs.some(
                            (r) => r.subpageIndex === spIdx && r.elementId === dblEl.id
                          );
                          if (isLetterSlice) {
                            onOpenLetterComposer();
                            return true;
                          }
                          return false;
                        }}
                        onNavigateLink={onNavigateLink}
                      />
                    );
                  })}

                  {isEditor && selectedRef?.subpageIndex === spIdx && snapGuideX !== null && (
                    <div
                      style={{ left: `${snapGuideX}px` }}
                      className="absolute top-0 bottom-0 w-px bg-amber-400/90 pointer-events-none z-40"
                    />
                  )}
                  {isEditor && selectedRef?.subpageIndex === spIdx && snapGuideY !== null && (
                    <div
                      style={{ top: `${snapGuideY}px` }}
                      className="absolute left-0 right-0 h-px bg-amber-400/90 pointer-events-none z-40"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};
