import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, Link2, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimationConfig, CanvasElement } from '../types/site';

interface CanvasElementRendererProps {
  element: CanvasElement;
  isEditor: boolean;
  isSelected?: boolean;
  showHotspots?: boolean;
  soundMuted?: boolean;
  isNestedInGroup?: boolean;
  animationsEnabled?: boolean;
  animReplayKey?: number;
  onSelect?: (e: React.MouseEvent, element: CanvasElement) => void;
  onStartDrag?: (e: React.MouseEvent, element: CanvasElement) => void;
  onStartResize?: (e: React.MouseEvent, element: CanvasElement, handle: string) => void;
  onStartRotate?: (e: React.MouseEvent, element: CanvasElement) => void;
  onInlineTextChange?: (elementId: string, newText: string) => void;
  onDoubleClickSpecial?: (element: CanvasElement) => boolean;
  onNavigateLink?: (link: string) => void;
}

const RESIZE_HANDLES = [
  { id: 'nw', className: '-top-1.5 -left-1.5 cursor-nwse-resize' },
  { id: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { id: 'ne', className: '-top-1.5 -right-1.5 cursor-nesw-resize' },
  { id: 'e', className: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
  { id: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  { id: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { id: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
  { id: 'w', className: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
];

function getAnimationVariants(
  anim: AnimationConfig | null | undefined,
  targetOpacity: number
) {
  if (!anim || !anim.type || anim.type === 'none') {
    return {
      initial: { opacity: targetOpacity },
      animate: { opacity: targetOpacity },
      transition: { duration: 0 },
    };
  }

  const duration = anim.duration ?? 0.6;
  const delay = anim.delay ?? 0;

  switch (anim.type) {
    case 'pop':
      return {
        initial: { scale: 0.2, opacity: 0 },
        animate: { scale: 1, opacity: targetOpacity },
        transition: {
          type: 'spring' as const,
          stiffness: 280,
          damping: 20,
          delay,
        },
      };

    case 'rise':
      return {
        initial: { y: 35, opacity: 0 },
        animate: { y: 0, opacity: targetOpacity },
        transition: {
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        },
      };

    case 'pan': {
      let xOffset = 0;
      let yOffset = 0;
      if (anim.direction === 'left') xOffset = -55;
      else if (anim.direction === 'right') xOffset = 55;
      else if (anim.direction === 'down') yOffset = -45;
      else yOffset = 45;

      return {
        initial: { x: xOffset, y: yOffset, opacity: 0 },
        animate: { x: 0, y: 0, opacity: targetOpacity },
        transition: {
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        },
      };
    }

    case 'scrapbook':
      return {
        initial: { scale: 0.8, rotate: -6, opacity: 0 },
        animate: { scale: 1, rotate: 0, opacity: targetOpacity },
        transition: {
          type: 'spring' as const,
          stiffness: 230,
          damping: 18,
          delay: delay || 0.05,
        },
      };

    case 'breathe':
      return {
        initial: { opacity: 0 },
        animate: {
          opacity: targetOpacity,
          scale: [1, 1.04, 1],
        },
        transition: {
          scale: {
            repeat: Infinity,
            duration: 3.2,
            ease: 'easeInOut' as const,
          },
          opacity: { duration: 0.45, delay },
        },
      };

    case 'typewriter':
      return {
        initial: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
        animate: { opacity: targetOpacity, clipPath: 'inset(0 0% 0 0)' },
        transition: {
          duration: Math.max(0.7, duration),
          delay,
          ease: 'easeInOut' as const,
        },
      };

    case 'fade':
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: targetOpacity },
        transition: {
          duration: duration || 0.55,
          delay,
          ease: 'easeOut' as const,
        },
      };
  }
}

export const CanvasElementRenderer: React.FC<CanvasElementRendererProps> = ({
  element,
  isEditor,
  isSelected = false,
  showHotspots = true,
  soundMuted = false,
  isNestedInGroup = false,
  animationsEnabled,
  animReplayKey = 0,
  onSelect,
  onStartDrag,
  onStartResize,
  onStartRotate,
  onInlineTextChange,
  onDoubleClickSpecial,
  onNavigateLink,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isSelected) {
      setIsEditingText(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isEditingText && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditingText]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || element.type !== 'video' || !element.media) return;
    const rawVol = element.media.volume ?? 0;
    const shouldMute = isEditor || soundMuted || rawVol <= 0;
    vid.muted = shouldMute;
    vid.volume = shouldMute ? 0 : Math.min(1, Math.max(0, rawVol));

    let cleanupPointerListener: (() => void) | null = null;
    if (!isEditor) {
      const p = vid.play();
      if (p !== undefined) {
        p.catch(() => {
          const handleFirstClick = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          };
          window.addEventListener('pointerdown', handleFirstClick, { once: true });
          cleanupPointerListener = () => {
            window.removeEventListener('pointerdown', handleFirstClick);
          };
        });
      }
    }

    return () => {
      cleanupPointerListener?.();
      if (vid) {
        vid.pause();
      }
    };
  }, [element, isEditor, soundMuted]);

  const isInvisibleHotspot = element.opacity <= 0.03 && Boolean(element.link);
  const effectiveOpacity =
    isEditor && isInvisibleHotspot && showHotspots ? 1 : element.opacity;

  const flipScaleX = element.media?.flipX ? -1 : 1;
  const flipScaleY = element.media?.flipY ? -1 : 1;

  const transformParts: string[] = [];
  if (element.rotation) {
    transformParts.push(`rotate(${element.rotation}deg)`);
  }
  if (flipScaleX !== 1 || flipScaleY !== 1) {
    transformParts.push(`scale(${flipScaleX}, ${flipScaleY})`);
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isEditor) {
      if (!isNestedInGroup && onSelect) {
        e.stopPropagation();
        onSelect(e, element);
      }
      return;
    }
    if (element.link && onNavigateLink) {
      e.stopPropagation();
      onNavigateLink(element.link);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditor || isNestedInGroup || isEditingText) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(e, element);
    onStartDrag?.(e, element);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isEditor || isNestedInGroup) return;
    e.stopPropagation();
    if (onDoubleClickSpecial && onDoubleClickSpecial(element)) {
      return;
    }
    if (element.type === 'text' || element.type === 'button') {
      setIsEditingText(true);
    }
  };

  const renderContent = () => {
    switch (element.type) {
      case 'image': {
        const media = element.media;
        if (!media || !media.src || imgFailed) {
          return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/70 border border-zinc-700/60 text-zinc-400 rounded select-none p-2 text-center">
              <ImageOff className="w-5 h-5 mb-1 opacity-70" />
              <span className="text-[11px] leading-tight truncate max-w-full">Image Slot</span>
            </div>
          );
        }

        const crop = media.crop;
        const maskStyle: React.CSSProperties = media.maskSrc
          ? {
              maskImage: `url('${media.maskSrc}')`,
              WebkitMaskImage: `url('${media.maskSrc}')`,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
            }
          : {};

        return (
          <div
            className="w-full h-full overflow-hidden relative select-none"
            style={{
              borderRadius: media.borderRadius ? `${media.borderRadius}px` : undefined,
            }}
          >
            {crop ? (
              <img
                src={media.src}
                alt="Canva visual element"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setImgFailed(true)}
                className="max-w-none absolute pointer-events-none select-none"
                style={{
                  left: `${crop.x}px`,
                  top: `${crop.y}px`,
                  width: `${crop.width}px`,
                  height: `${crop.height}px`,
                  ...maskStyle,
                }}
              />
            ) : (
              <img
                src={media.src}
                alt="Canva visual element"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover pointer-events-none select-none"
                style={maskStyle}
              />
            )}
          </div>
        );
      }

      case 'video': {
        const media = element.media;
        if (!media || !media.src || imgFailed) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/60 text-zinc-400 text-xs">
              Media clip
            </div>
          );
        }

        if (element.opacity <= 0.02 && (media.volume ?? 0) > 0 && isEditor && showHotspots) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-emerald-500/20 border border-dashed border-emerald-400 rounded text-emerald-200 text-[11px] px-2 font-medium truncate select-none shadow-sm gap-1">
              <span>🎵</span>
              <span>Audio Cue ({Math.round((media.volume ?? 0) * 100)}%)</span>
            </div>
          );
        }

        const crop = media.crop;
        if (media.isGif) {
          return (
            <div
              className="w-full h-full overflow-hidden relative select-none"
              style={{
                borderRadius: media.borderRadius ? `${media.borderRadius}px` : undefined,
              }}
            >
              {crop ? (
                <img
                  src={media.src}
                  alt="Animated sticker"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setImgFailed(true)}
                  className="max-w-none absolute pointer-events-none select-none"
                  style={{
                    left: `${crop.x}px`,
                    top: `${crop.y}px`,
                    width: `${crop.width}px`,
                    height: `${crop.height}px`,
                  }}
                />
              ) : (
                <img
                  src={media.src}
                  alt="Animated sticker"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover pointer-events-none select-none"
                />
              )}
            </div>
          );
        }

        const rawVol = media.volume ?? 0;
        const shouldMute = isEditor || soundMuted || rawVol <= 0;

        return (
          <div
            className="w-full h-full overflow-hidden relative select-none"
            style={{
              borderRadius: media.borderRadius ? `${media.borderRadius}px` : undefined,
            }}
          >
            <video
              ref={videoRef}
              src={media.src}
              autoPlay={!isEditor}
              loop={Boolean(media.loop)}
              muted={shouldMute}
              playsInline
              preload="auto"
              onTimeUpdate={(e) => {
                if (media.trimEndSec && e.currentTarget.currentTime >= media.trimEndSec) {
                  if (media.loop) {
                    e.currentTarget.currentTime = 0;
                  } else {
                    e.currentTarget.pause();
                  }
                }
              }}
              className={
                crop
                  ? 'max-w-none absolute pointer-events-none select-none'
                  : 'w-full h-full object-cover pointer-events-none select-none'
              }
              style={
                crop
                  ? {
                      left: `${crop.x}px`,
                      top: `${crop.y}px`,
                      width: `${crop.width}px`,
                      height: `${crop.height}px`,
                    }
                  : undefined
              }
            />
          </div>
        );
      }

      case 'text': {
        const ts = element.textStyle;
        if (!ts) return null;

        const textCss: React.CSSProperties = {
          fontFamily: `'${ts.fontFamily}', sans-serif`,
          fontSize: `${ts.fontSize}px`,
          color: ts.color,
          textAlign: (ts.align as React.CSSProperties['textAlign']) || 'left',
          fontWeight: ts.bold ? 700 : 400,
          fontStyle: ts.italic ? 'italic' : 'normal',
          textDecoration: ts.underline ? 'underline' : 'none',
          letterSpacing: ts.letterSpacing || '0em',
          lineHeight: ts.lineHeight || '1.28',
          textShadow: ts.textShadow || undefined,
        };

        if (isEditingText && isEditor) {
          return (
            <textarea
              ref={textareaRef}
              value={ts.text}
              onChange={(e) => onInlineTextChange?.(element.id, e.target.value)}
              onBlur={() => setIsEditingText(false)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setIsEditingText(false);
                }
              }}
              className="w-full h-full bg-zinc-950/60 outline-none ring-2 ring-amber-400 rounded p-0.5 resize-none overflow-auto"
              style={textCss}
            />
          );
        }

        return (
          <div
            className="w-full h-full whitespace-pre-wrap break-words select-none"
            style={textCss}
          >
            {ts.text}
          </div>
        );
      }

      case 'button': {
        const bs = element.buttonStyle;
        if (!bs) return null;

        const btnCss: React.CSSProperties = {
          backgroundColor: bs.backgroundColor,
          borderRadius: `${bs.borderRadius}px`,
          fontFamily: `'${bs.fontFamily}', sans-serif`,
          fontSize: `${bs.fontSize}px`,
          color: bs.color,
          fontWeight: bs.bold ? 700 : 500,
          fontStyle: bs.italic ? 'italic' : 'normal',
          textDecoration: bs.underline ? 'underline' : 'none',
          letterSpacing: bs.letterSpacing || '0em',
        };

        if (isEditingText && isEditor) {
          return (
            <div
              className="w-full h-full flex items-center justify-center px-2"
              style={btnCss}
            >
              <input
                type="text"
                autoFocus
                value={bs.text}
                onChange={(e) => onInlineTextChange?.(element.id, e.target.value)}
                onBlur={() => setIsEditingText(false)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsEditingText(false);
                  }
                }}
                className="w-full bg-transparent text-center outline-none"
                style={{ color: bs.color }}
              />
            </div>
          );
        }

        return (
          <div
            className={`w-full h-full flex items-center justify-center text-center px-2 select-none transition-transform duration-150 ${
              !isEditor && element.link ? 'hover:scale-[1.03] active:scale-[0.98]' : ''
            }`}
            style={btnCss}
          >
            <span className="truncate">{bs.text}</span>
          </div>
        );
      }

      case 'shape': {
        const sh = element.shape;
        if (!sh || !sh.paths.length) return null;

        if (isInvisibleHotspot) {
          if (isEditor && showHotspots) {
            return (
              <div className="w-full h-full rounded border-2 border-dashed border-amber-400/85 bg-amber-400/15 flex items-center justify-center p-1 select-none">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 bg-zinc-950/85 px-1.5 py-0.5 rounded truncate max-w-full">
                  <Link2 className="w-3 h-3 shrink-0" />
                  {element.link}
                </span>
              </div>
            );
          }
          return <div className="w-full h-full" />;
        }

        if (sh.isRect) {
          const p0 = sh.paths[0];
          return (
            <div
              className="w-full h-full"
              style={{
                backgroundColor: p0.fill,
                borderRadius: p0.cornerRadius ? `${p0.cornerRadius}px` : undefined,
                border:
                  p0.stroke && p0.strokeWidth
                    ? `${p0.strokeWidth}px solid ${p0.stroke}`
                    : undefined,
              }}
            />
          );
        }

        return (
          <svg
            viewBox={sh.viewBox}
            preserveAspectRatio="none"
            className="w-full h-full block overflow-visible pointer-events-none"
          >
            {sh.paths.map((p, idx) => (
              <path
                key={idx}
                d={p.d}
                fill={p.fill}
                stroke={p.stroke || undefined}
                strokeWidth={p.strokeWidth || undefined}
              />
            ))}
          </svg>
        );
      }

      case 'group': {
        const grp = element.group;
        if (!grp) return null;
        const sx = element.width / (grp.internalWidth || element.width || 1);
        const sy = element.height / (grp.internalHeight || element.height || 1);

        return (
          <div className="w-full h-full relative pointer-events-none select-none">
            <div
              style={{
                width: `${grp.internalWidth}px`,
                height: `${grp.internalHeight}px`,
                transform: `scale(${sx}, ${sy})`,
                transformOrigin: '0 0',
              }}
              className="relative"
            >
              {grp.children.map((child) => (
                <CanvasElementRenderer
                  key={child.id}
                  element={child}
                  isEditor={isEditor}
                  soundMuted={soundMuted}
                  showHotspots={false}
                  isNestedInGroup={true}
                  animationsEnabled={false}
                  onNavigateLink={onNavigateLink}
                />
              ))}
            </div>
          </div>
        );
      }

      case 'embed': {
        const emb = element.embed;
        if (!emb || !emb.embedUrl) {
          return (
            <div className="w-full h-full bg-zinc-900 border border-zinc-700 rounded-xl flex items-center justify-center text-xs text-zinc-400">
              Media Embed
            </div>
          );
        }

        return (
          <div className="w-full h-full rounded-xl overflow-hidden bg-black/40 relative">
            <iframe
              src={emb.embedUrl}
              title={`Embedded ${emb.provider}`}
              className={`w-full h-full border-0 ${isEditor ? 'pointer-events-none' : 'pointer-events-auto'}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            {isEditor && (
              <div className="absolute inset-0 bg-transparent cursor-move" />
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const hasInteractiveLink = !isEditor && Boolean(element.link);
  const isAnimActive =
    (animationsEnabled ?? !isEditor) &&
    !isNestedInGroup &&
    !isSelected &&
    Boolean(element.animation && element.animation.type && element.animation.type !== 'none');

  const animVariants = isAnimActive
    ? getAnimationVariants(element.animation, effectiveOpacity)
    : null;

  return (
    <div
      data-element-id={element.id}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'absolute',
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        opacity: isAnimActive ? 1 : effectiveOpacity,
        transform: transformParts.length ? transformParts.join(' ') : undefined,
        transformOrigin: 'center center',
        filter: element.dropShadow || undefined,
      }}
      className={`${
        hasInteractiveLink
          ? 'cursor-pointer'
          : isEditor && !isNestedInGroup
          ? isEditingText
            ? 'cursor-text'
            : 'cursor-move'
          : ''
      } ${
        isEditor && !isNestedInGroup && !isSelected
          ? 'hover:ring-1 hover:ring-amber-400/60'
          : ''
      } ${
        isEditor && isSelected && !isNestedInGroup
          ? 'ring-2 ring-amber-400 z-30'
          : ''
      }`}
    >
      {isAnimActive && animVariants ? (
        <motion.div
          key={animReplayKey}
          initial={animVariants.initial}
          animate={animVariants.animate}
          transition={animVariants.transition}
          whileHover={hasInteractiveLink ? { scale: 1.025 } : undefined}
          whileTap={hasInteractiveLink ? { scale: 0.975 } : undefined}
          className="w-full h-full"
        >
          {renderContent()}
        </motion.div>
      ) : hasInteractiveLink ? (
        <motion.div
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.975 }}
          className="w-full h-full"
        >
          {renderContent()}
        </motion.div>
      ) : (
        renderContent()
      )}

      {isEditor && !isNestedInGroup && showHotspots && element.link && !isInvisibleHotspot && (
        <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-zinc-950/90 border border-amber-400/50 text-[10px] font-medium text-amber-300 whitespace-nowrap pointer-events-none flex items-center gap-1 shadow-sm">
          <Link2 className="w-2.5 h-2.5" />
          <span>{element.link}</span>
        </div>
      )}

      {isEditor && isSelected && !isNestedInGroup && !isEditingText && (
        <>
          <button
            type="button"
            title="Drag to rotate"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartRotate?.(e, element);
            }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-amber-400 pointer-events-none" />

          {RESIZE_HANDLES.map((h) => (
            <div
              key={h.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartResize?.(e, element, h.id);
              }}
              className={`absolute w-3 h-3 rounded-sm bg-white border-2 border-amber-500 shadow-sm ${h.className}`}
            />
          ))}
        </>
      )}
    </div>
  );
};
