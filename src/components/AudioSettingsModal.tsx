import React, { useRef, useState } from 'react';
import {
  Check,
  Disc,
  FileAudio,
  Film,
  Music,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BackgroundMusicConfig, CanvaPage } from '../types/site';

interface AudioSettingsModalProps {
  isOpen: boolean;
  pages: CanvaPage[];
  currentTrack?: string;
  currentConfig?: BackgroundMusicConfig;
  onClose: () => void;
  onSaveAudioConfig: (trackUrl: string, config: BackgroundMusicConfig) => void;
}

const DEFAULT_CHIME = '/_assets/audio/64d550272432c09e29bb481d61f6e831.m4a';

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  pages,
  currentTrack,
  currentConfig,
  onClose,
  onSaveAudioConfig,
}) => {
  const [enabled, setEnabled] = useState<boolean>(currentConfig?.enabled ?? true);
  const [trackUrl, setTrackUrl] = useState<string>(
    currentConfig?.url || currentTrack || DEFAULT_CHIME
  );
  const [trackTitle, setTrackTitle] = useState<string>(
    currentConfig?.title || 'Happy Birthday Theme Song'
  );
  const [volume, setVolume] = useState<number>(currentConfig?.volume ?? 0.7);
  const [loop, setLoop] = useState<boolean>(currentConfig?.loop ?? true);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Find any video elements across pages that the user might want to extract/use as audio
  const videoElements: Array<{ pageName: string; pageIdx: number; elementId: string; src: string }> = [];
  pages.forEach((p, pIdx) => {
    p.subpages.forEach((sp) => {
      sp.elements.forEach((el) => {
        if (el.type === 'video' && el.media?.src) {
          videoElements.push({
            pageName: p.name,
            pageIdx: pIdx + 1,
            elementId: el.id,
            src: el.media.src,
          });
        }
      });
    });
  });

  const togglePreview = () => {
    if (isPlayingPreview) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      setIsPlayingPreview(false);
      return;
    }

    if (!trackUrl) return;
    if (!previewAudioRef.current || previewAudioRef.current.src !== trackUrl) {
      previewAudioRef.current = new Audio(trackUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
      previewAudioRef.current.onerror = () => setIsPlayingPreview(false);
    }
    previewAudioRef.current.volume = volume;
    previewAudioRef.current.loop = loop;
    previewAudioRef.current.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTrackUrl(reader.result);
        setTrackTitle(file.name.replace(/\.[^/.]+$/, ''));
        setEnabled(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const finalConfig: BackgroundMusicConfig = {
      enabled,
      url: trackUrl,
      title: trackTitle,
      volume,
      loop,
      autoplay: true,
    };
    onSaveAudioConfig(trackUrl, finalConfig);
    onClose();
  };

  const handleSelectPreset = (url: string, title: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    }
    setTrackUrl(url);
    setTrackTitle(title);
    setEnabled(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Background Song &amp; Audio</h2>
              <p className="text-[11px] text-zinc-400">
                Configure background music, upload an audio track, or link video audio.
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div>
              <span className="text-xs font-semibold text-zinc-100 block">
                Enable Background Music
              </span>
              <span className="text-[11px] text-zinc-400">
                Plays throughout scenes and birthday celebration
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                enabled ? 'bg-amber-400 justify-end' : 'bg-zinc-800 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-zinc-950 shadow-md" />
            </button>
          </div>

          {/* Quick Audio Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Audio Source Options
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset(DEFAULT_CHIME, 'Original Canva Birthday Audio')}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                  trackUrl === DEFAULT_CHIME
                    ? 'bg-amber-400/15 border-amber-400/60 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-medium block">Original Birthday Chime &amp; Track</span>
                    <span className="text-[10px] text-zinc-500">Canva site default audio theme</span>
                  </div>
                </div>
                {trackUrl === DEFAULT_CHIME && <Check className="w-4 h-4 text-amber-400" />}
              </button>

              {videoElements.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectPreset(v.src, `Video Song from Page ${v.pageIdx}`)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                    trackUrl === v.src
                      ? 'bg-amber-400/15 border-amber-400/60 text-amber-300'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-medium block">
                        Video Audio (Page {v.pageIdx}: {v.pageName})
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-xs block">
                        Use video audio as the background song
                      </span>
                    </div>
                  </div>
                  {trackUrl === v.src && <Check className="w-4 h-4 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL or Upload */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Audio File URL or Web Stream
              </label>
              <input
                type="text"
                value={trackUrl}
                onChange={(e) => {
                  setTrackUrl(e.target.value);
                  setEnabled(true);
                }}
                placeholder="https://... audio URL (.mp3, .m4a, .wav)"
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/mp4"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Upload Audio File (.mp3, .m4a)
              </button>
              {trackTitle && (
                <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                  {trackTitle}
                </span>
              )}
            </div>
          </div>

          {/* Volume and Controls */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                Playback Volume
              </span>
              <span className="font-mono-num text-amber-300">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const nextVol = Number(e.target.value) / 100;
                setVolume(nextVol);
                if (previewAudioRef.current) {
                  previewAudioRef.current.volume = nextVol;
                }
              }}
              className="w-full accent-amber-400"
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                  className="rounded border-zinc-700 accent-amber-400 cursor-pointer"
                />
                <span>Loop Audio Continuously</span>
              </label>

              <button
                type="button"
                onClick={togglePreview}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                {isPlayingPreview ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    Stop Preview
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    Test Play
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold shadow transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Save Audio Settings
          </button>
        </div>
      </div>
    </div>
  );
};
