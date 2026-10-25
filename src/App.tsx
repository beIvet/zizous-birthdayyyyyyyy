import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  History,
  List,
  Loader2,
  Music,
  Pencil,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Undo2,
  Redo2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import rawCanvaData from './data/canvaSiteData.json';
import {
  BackgroundMusicConfig,
  CanvaPage,
  CanvasElement,
  SaveSnapshot,
  SelectedElementRef,
  SiteData,
} from './types/site';
import {
  clearSavedSiteData,
  createManualSnapshot,
  deleteSnapshot,
  generateId,
  getSavedSnapshots,
  getScrollingLetterInfo,
  loadSavedSiteData,
  mergeAnimationsIfMissing,
  parseEmbedInput,
  resolveLinkToPageIndex,
  saveSiteData,
  saveSiteDataSync,
  ungroupElement,
} from './utils/siteHelpers';
import { PageStage } from './components/PageStage';
import { PageSidebar } from './components/PageSidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { LetterComposerModal } from './components/LetterComposerModal';
import { BackupsModal } from './components/BackupsModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';

const INITIAL_SITE_DATA = rawCanvaData as unknown as SiteData;
const MAX_HISTORY = 35;

export function App() {
  const [siteData, setSiteData] = useState<SiteData>(() =>
    JSON.parse(JSON.stringify(INITIAL_SITE_DATA))
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const [mode, setMode] = useState<'preview' | 'editor'>('preview');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [navHistory, setNavHistory] = useState<number[]>([]);

  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [controlsMinimized, setControlsMinimized] = useState<boolean>(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState<boolean>(false);
  const [externalLinkNotice, setExternalLinkNotice] = useState<string | null>(null);

  const [selectedRef, setSelectedRef] = useState<SelectedElementRef | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [letterModalOpen, setLetterModalOpen] = useState<boolean>(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false);
  const [newEmbedUrl, setNewEmbedUrl] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(true);
  const [animReplayKey, setAnimReplayKey] = useState<number>(0);
  const [candleBlowing, setCandleBlowing] = useState<boolean>(false);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedFormatted, setLastSavedFormatted] = useState<string>('just now');
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [musicModalOpen, setMusicModalOpen] = useState<boolean>(false);
  const [snapshots, setSnapshots] = useState<SaveSnapshot[]>([]);

  const pastRef = useRef<SiteData[]>([]);
  const futureRef = useRef<SiteData[]>([]);
  const latestCommittedRef = useRef<SiteData>(siteData);
  const [, forceHistoryTick] = useState(0);

  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const addImageInputRef = useRef<HTMLInputElement | null>(null);
  const clickSfxRef = useRef<HTMLAudioElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await getSavedSnapshots();
      setSnapshots(list);
    } catch {
      // Ignore
    }
  }, []);

  const performSave = useCallback(
    async (dataToSave: SiteData, createSnapshot = false, snapTitle?: string) => {
      setSaveStatus('saving');
      try {
        await saveSiteData(dataToSave, createSnapshot, snapTitle);
        setSaveStatus('saved');
        setLastSavedFormatted(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        if (createSnapshot) {
          refreshSnapshots();
        }
      } catch {
        setSaveStatus('unsaved');
      }
    },
    [refreshSnapshots]
  );

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    let mounted = true;
    loadSavedSiteData().then((saved) => {
      if (!mounted) return;
      if (saved && Array.isArray(saved.pages) && saved.pages.length > 0) {
        const merged = mergeAnimationsIfMissing(saved, INITIAL_SITE_DATA);
        setSiteData(merged);
        latestCommittedRef.current = merged;
      }
      setIsLoaded(true);
      refreshSnapshots();
    });
    return () => {
      mounted = false;
    };
  }, [refreshSnapshots]);

  useEffect(() => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      performSave(siteData);
    }, 280);
    return () => clearTimeout(timer);
  }, [siteData, isLoaded, performSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestCommittedRef.current) {
        saveSiteDataSync(latestCommittedRef.current);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && latestCommittedRef.current) {
        saveSiteDataSync(latestCommittedRef.current);
        saveSiteData(latestCommittedRef.current).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performSave(latestCommittedRef.current, true, 'User saved (Ctrl+S)');
        showToast('✓ All changes saved securely to storage!');
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [performSave, showToast]);

  useEffect(() => {
    const bgConfig = siteData.backgroundMusic;
    const audioUrl = bgConfig?.url || siteData.audioTrack;
    const isEnabled = bgConfig ? bgConfig.enabled : Boolean(siteData.audioTrack);

    if (!audioUrl || !isEnabled || soundMuted) {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
      }
      return;
    }

    if (!bgAudioRef.current || bgAudioRef.current.src !== audioUrl) {
      bgAudioRef.current = new Audio(audioUrl);
      bgAudioRef.current.loop = bgConfig?.loop !== false;
    }
    bgAudioRef.current.volume = soundMuted
      ? 0
      : Math.max(0, Math.min(1, bgConfig?.volume ?? 0.7));

    if (bgConfig?.autoplay !== false) {
      bgAudioRef.current.play().catch(() => {});
    }
  }, [siteData.backgroundMusic, siteData.audioTrack, soundMuted]);

  const applyCommittedUpdate = useCallback(
    (updater: (prev: SiteData) => SiteData) => {
      setSiteData((prev) => {
        const next = updater(prev);
        pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
        futureRef.current = [];
        latestCommittedRef.current = next;
        forceHistoryTick((n) => n + 1);
        performSave(next, false);
        return next;
      });
    },
    [performSave]
  );

  const commitTransientDragResize = useCallback(() => {
    setSiteData((current) => {
      if (latestCommittedRef.current !== current) {
        pastRef.current = [
          ...pastRef.current.slice(-(MAX_HISTORY - 1)),
          latestCommittedRef.current,
        ];
        futureRef.current = [];
        latestCommittedRef.current = current;
        forceHistoryTick((n) => n + 1);
        performSave(current, false);
      }
      return current;
    });
  }, [performSave]);

  const handleUndo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    setSiteData((current) => {
      futureRef.current = [current, ...futureRef.current];
      latestCommittedRef.current = previous;
      return previous;
    });
    setSelectedRef(null);
    forceHistoryTick((n) => n + 1);
  }, []);

  const handleRedo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    setSiteData((current) => {
      pastRef.current = [...pastRef.current, current];
      latestCommittedRef.current = next;
      return next;
    });
    setSelectedRef(null);
    forceHistoryTick((n) => n + 1);
  }, []);

  const safePageIdx = Math.min(activePageIndex, siteData.pages.length - 1);
  const activePage: CanvaPage = siteData.pages[safePageIdx];
  const letterInfo = getScrollingLetterInfo(activePage);

  const playCandleBlowOrClickAudio = useCallback(
    (fromPageSlug: string, toPageSlug: string) => {
      if (fromPageSlug === '6' && toPageSlug === '7') {
        setCandleBlowing(true);
        setTimeout(() => setCandleBlowing(false), 900);
      }
      if (soundMuted || !siteData.audioTrack) return;
      if (fromPageSlug === '6' && toPageSlug === '7') {
        if (!clickSfxRef.current) {
          clickSfxRef.current = new Audio(siteData.audioTrack);
        }
        clickSfxRef.current.currentTime = 0;
        clickSfxRef.current.volume = 0.85;
        clickSfxRef.current.play().catch(() => {});
      }
    },
    [soundMuted, siteData.audioTrack]
  );

  const handleNavigateLink = useCallback(
    (link: string) => {
      const targetIdx = resolveLinkToPageIndex(link, siteData.pages);
      if (targetIdx !== null) {
        const targetPage = siteData.pages[targetIdx];
        playCandleBlowOrClickAudio(activePage.slug, targetPage.slug);
        setNavHistory((prev) => [...prev.slice(-25), safePageIdx]);
        setActivePageIndex(targetIdx);
        setSelectedRef(null);
        return;
      }
      if (link.startsWith('http://') || link.startsWith('https://')) {
        setExternalLinkNotice(link);
      }
    },
    [siteData.pages, activePage.slug, safePageIdx, playCandleBlowOrClickAudio]
  );

  const handleNavigateBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setActivePageIndex(Math.min(last, siteData.pages.length - 1));
      return prev.slice(0, -1);
    });
  }, [siteData.pages.length]);

  const handleUpdateElementTransient = useCallback(
    (
      subpageIndex: number,
      elementId: string,
      updater: (el: CanvasElement) => CanvasElement
    ) => {
      setSiteData((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            return {
              ...sp,
              elements: sp.elements.map((el) => (el.id === elementId ? updater(el) : el)),
            };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
    },
    [safePageIdx]
  );

  const handleUpdateElementCommitted = useCallback(
    (
      subpageIndex: number,
      elementId: string,
      updater: (el: CanvasElement) => CanvasElement
    ) => {
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            return {
              ...sp,
              elements: sp.elements.map((el) => (el.id === elementId ? updater(el) : el)),
            };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
    },
    [applyCommittedUpdate, safePageIdx]
  );

  const handleLayerMove = useCallback(
    (
      subpageIndex: number,
      elementId: string,
      action: 'front' | 'forward' | 'backward' | 'back'
    ) => {
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            const arr = [...sp.elements];
            const idx = arr.findIndex((e) => e.id === elementId);
            if (idx === -1) return sp;
            const [item] = arr.splice(idx, 1);
            if (action === 'front') arr.push(item);
            else if (action === 'back') arr.unshift(item);
            else if (action === 'forward') arr.splice(Math.min(arr.length, idx + 1), 0, item);
            else if (action === 'backward') arr.splice(Math.max(0, idx - 1), 0, item);
            return { ...sp, elements: arr };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
    },
    [applyCommittedUpdate, safePageIdx]
  );

  const handleDuplicateElement = useCallback(
    (subpageIndex: number, elementId: string) => {
      let newId = '';
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            const orig = sp.elements.find((e) => e.id === elementId);
            if (!orig) return sp;
            const clone: CanvasElement = JSON.parse(JSON.stringify(orig));
            clone.id = generateId('copy');
            clone.x = Math.round((clone.x + 24) * 10) / 10;
            clone.y = Math.round((clone.y + 24) * 10) / 10;
            newId = clone.id;
            return { ...sp, elements: [...sp.elements, clone] };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
      if (newId) {
        setSelectedRef({ subpageIndex, elementId: newId });
        showToast('Element duplicated');
      }
    },
    [applyCommittedUpdate, safePageIdx, showToast]
  );

  const handleDeleteElement = useCallback(
    (subpageIndex: number, elementId: string) => {
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            return {
              ...sp,
              elements: sp.elements.filter((e) => e.id !== elementId),
            };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
      setSelectedRef(null);
    },
    [applyCommittedUpdate, safePageIdx]
  );

  const handleUngroupElement = useCallback(
    (subpageIndex: number, elementId: string) => {
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) => {
            if (sIdx !== subpageIndex) return sp;
            const idx = sp.elements.findIndex((e) => e.id === elementId);
            if (idx === -1) return sp;
            const ungrouped = ungroupElement(sp.elements[idx]);
            const nextElems = [...sp.elements];
            nextElems.splice(idx, 1, ...ungrouped);
            return { ...sp, elements: nextElems };
          });
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
      setSelectedRef(null);
      showToast('Group split into individual elements');
    },
    [applyCommittedUpdate, safePageIdx, showToast]
  );

  const targetSubpageIndex = selectedRef?.subpageIndex ?? 0;

  const addElementToActiveSubpage = useCallback(
    (newEl: CanvasElement) => {
      const spIdx = Math.min(targetSubpageIndex, activePage.subpages.length - 1);
      applyCommittedUpdate((prev) => {
        const pages = prev.pages.map((p, pIdx) => {
          if (pIdx !== safePageIdx) return p;
          const subpages = p.subpages.map((sp, sIdx) =>
            sIdx === spIdx ? { ...sp, elements: [...sp.elements, newEl] } : sp
          );
          return { ...p, subpages };
        });
        return { ...prev, pages };
      });
      setSelectedRef({ subpageIndex: spIdx, elementId: newEl.id });
    },
    [targetSubpageIndex, activePage.subpages.length, applyCommittedUpdate, safePageIdx]
  );

  const handleAddText = () => {
    addElementToActiveSubpage({
      id: generateId('txt'),
      type: 'text',
      x: 480,
      y: 320,
      width: 400,
      height: 72,
      rotation: 0,
      opacity: 1,
      link: null,
      textStyle: {
        text: 'Double-click to edit text',
        fontFamily: 'Canva Sans',
        fontSize: 32,
        color: '#fffef9',
        align: 'center',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: '0em',
        lineHeight: '1.28',
      },
    });
  };

  const handleAddButton = () => {
    const nextAnchor =
      siteData.pages[Math.min(safePageIdx + 1, siteData.pages.length - 1)]?.anchor ||
      '#page-0';
    addElementToActiveSubpage({
      id: generateId('btn'),
      type: 'button',
      x: 573,
      y: 420,
      width: 220,
      height: 46,
      rotation: 0,
      opacity: 1,
      link: nextAnchor,
      buttonStyle: {
        text: 'Click Here',
        fontFamily: 'Canva Sans',
        fontSize: 16,
        color: '#ffffff',
        align: 'center',
        bold: true,
        italic: false,
        underline: false,
        letterSpacing: '0em',
        lineHeight: '1.2',
        backgroundColor: '#608550',
        borderRadius: 12,
      },
    });
  };

  const handleAddHotspot = () => {
    const nextAnchor =
      siteData.pages[Math.min(safePageIdx + 1, siteData.pages.length - 1)]?.anchor ||
      '#page-0';
    setShowHotspots(true);
    addElementToActiveSubpage({
      id: generateId('hotspot'),
      type: 'shape',
      x: 540,
      y: 300,
      width: 260,
      height: 120,
      rotation: 0,
      opacity: 0,
      link: nextAnchor,
      shape: {
        viewBox: '0 0 64 64',
        isRect: true,
        paths: [{ d: 'M0 0H64V64H0z', fill: '#c8d1d9', cornerRadius: 8 }],
      },
    });
    showToast('Added clickable hotspot — choose target page on the right');
  };

  const handleAddUploadedImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addElementToActiveSubpage({
        id: generateId('img'),
        type: 'image',
        x: 490,
        y: 220,
        width: 360,
        height: 300,
        rotation: 0,
        opacity: 1,
        link: null,
        media: {
          src: dataUrl,
          maskSrc: null,
          crop: null,
          flipX: false,
          flipY: false,
          borderRadius: 8,
        },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmAddEmbed = () => {
    if (!newEmbedUrl.trim()) return;
    const parsed = parseEmbedInput(newEmbedUrl);
    addElementToActiveSubpage({
      id: generateId('embed'),
      type: 'embed',
      x: 440,
      y: 230,
      width: 480,
      height: 270,
      rotation: 0,
      opacity: 1,
      link: null,
      embed: parsed,
    });
    setNewEmbedUrl('');
    setEmbedModalOpen(false);
  };

  const handleSaveUnifiedLetter = (updatedFullText: string) => {
    applyCommittedUpdate((prev) => {
      const pages = prev.pages.map((p, pIdx) => {
        if (pIdx !== safePageIdx) return p;
        const info = getScrollingLetterInfo(p);
        const subpages = p.subpages.map((sp, sIdx) => {
          const match = info.sliceRefs.find((r) => r.subpageIndex === sIdx);
          if (!match) return sp;
          return {
            ...sp,
            elements: sp.elements.map((el) =>
              el.id === match.elementId && el.textStyle
                ? {
                    ...el,
                    height: Math.max(el.height, 4800),
                    textStyle: { ...el.textStyle, text: updatedFullText },
                  }
                : el
            ),
          };
        });
        return { ...p, subpages };
      });
      return { ...prev, pages };
    });
    showToast('Birthday letter synced across all scroll sections');
  };

  const handleRenamePage = (idx: number, newName: string) => {
    applyCommittedUpdate((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) => (i === idx ? { ...p, name: newName } : p)),
    }));
  };

  const handleDuplicatePage = (idx: number) => {
    applyCommittedUpdate((prev) => {
      const orig = prev.pages[idx];
      const slug = `custom-${Math.random().toString(36).slice(2, 6)}`;
      const cloned: CanvaPage = JSON.parse(JSON.stringify(orig));
      cloned.id = generateId('page');
      cloned.slug = slug;
      cloned.anchor = `#page-${slug}`;
      cloned.name = `${orig.name} (Copy)`;
      cloned.subpages = cloned.subpages.map((sp) => ({
        ...sp,
        id: generateId('sp'),
        elements: sp.elements.map((el) => ({ ...el, id: generateId('el') })),
      }));
      const nextPages = [...prev.pages];
      nextPages.splice(idx + 1, 0, cloned);
      return {
        ...prev,
        pages: nextPages.map((p, i) => ({ ...p, index: i })),
      };
    });
    setActivePageIndex(idx + 1);
    showToast('Page duplicated');
  };

  const handleMovePage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= siteData.pages.length) return;
    applyCommittedUpdate((prev) => {
      const nextPages = [...prev.pages];
      const [item] = nextPages.splice(idx, 1);
      nextPages.splice(target, 0, item);
      return {
        ...prev,
        pages: nextPages.map((p, i) => ({ ...p, index: i })),
      };
    });
    setActivePageIndex(target);
  };

  const handleDeletePage = (idx: number) => {
    if (siteData.pages.length <= 1) return;
    applyCommittedUpdate((prev) => {
      const nextPages = prev.pages
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, index: i }));
      return { ...prev, pages: nextPages };
    });
    setActivePageIndex((prev) => Math.max(0, Math.min(prev, siteData.pages.length - 2)));
    setSelectedRef(null);
  };

  const handleAddPage = () => {
    const slug = `new-${Math.random().toString(36).slice(2, 6)}`;
    const newIdx = siteData.pages.length;
    applyCommittedUpdate((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id: generateId('page'),
          index: newIdx,
          slug,
          anchor: `#page-${slug}`,
          name: `New Page ${newIdx + 1}`,
          subpages: [
            {
              id: generateId('sp'),
              width: 1366,
              height: 768,
              backgroundColor: '#300551',
              elements: [
                {
                  id: generateId('txt'),
                  type: 'text',
                  x: 433,
                  y: 330,
                  width: 500,
                  height: 80,
                  rotation: 0,
                  opacity: 1,
                  link: null,
                  textStyle: {
                    text: 'New Scene Title',
                    fontFamily: 'Gladiola',
                    fontSize: 64,
                    color: '#d7cea1',
                    align: 'center',
                    bold: false,
                    italic: false,
                    underline: false,
                    letterSpacing: '0em',
                    lineHeight: '1.2',
                  },
                },
              ],
            },
          ],
        },
      ],
    }));
    setActivePageIndex(newIdx);
    setSelectedRef(null);
  };

  const handleUpdateSubpageBg = (spIdx: number, color: string) => {
    applyCommittedUpdate((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === safePageIdx
          ? {
              ...p,
              subpages: p.subpages.map((sp, s) =>
                s === spIdx ? { ...sp, backgroundColor: color } : sp
              ),
            }
          : p
      ),
    }));
  };

  const handleAddSubpage = () => {
    applyCommittedUpdate((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === safePageIdx
          ? {
              ...p,
              subpages: [
                ...p.subpages,
                {
                  id: generateId('sp'),
                  width: 1366,
                  height: 768,
                  backgroundColor: p.subpages[p.subpages.length - 1]?.backgroundColor || '#300551',
                  elements: [],
                },
              ],
            }
          : p
      ),
    }));
    showToast('Added new 1366×768 section below');
  };

  const handleDeleteSubpage = (spIdx: number) => {
    applyCommittedUpdate((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === safePageIdx && p.subpages.length > 1
          ? {
              ...p,
              subpages: p.subpages.filter((_, s) => s !== spIdx),
            }
          : p
      ),
    }));
    setSelectedRef(null);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(siteData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'happy-birthday-zizou-site.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported site backup JSON');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as SiteData;
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          applyCommittedUpdate(() => parsed);
          setActivePageIndex(0);
          setSelectedRef(null);
          showToast('Imported site backup');
        }
      } catch {
        showToast('Invalid JSON backup file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveAudioConfig = useCallback(
    (trackUrl: string, config: BackgroundMusicConfig) => {
      applyCommittedUpdate((prev) => ({
        ...prev,
        audioTrack: trackUrl,
        backgroundMusic: config,
      }));
      performSave(
        {
          ...siteData,
          audioTrack: trackUrl,
          backgroundMusic: config,
        },
        true,
        'Updated Background Music & Audio'
      );
      showToast('✓ Background music settings saved securely!');
    },
    [applyCommittedUpdate, performSave, siteData, showToast]
  );

  const handleCreateSnapshot = useCallback(
    async (title: string) => {
      await createManualSnapshot(latestCommittedRef.current, title);
      await refreshSnapshots();
      showToast(`✓ Checkpoint "${title}" saved!`);
    },
    [refreshSnapshots, showToast]
  );

  const handleRestoreSnapshot = useCallback(
    (snapshot: SaveSnapshot) => {
      applyCommittedUpdate(() => snapshot.data);
      performSave(snapshot.data, true, `Restored: ${snapshot.title}`);
      showToast(`✓ Restored version "${snapshot.title}"!`);
    },
    [applyCommittedUpdate, performSave, showToast]
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string) => {
      await deleteSnapshot(snapshotId);
      await refreshSnapshots();
      showToast('Checkpoint removed');
    },
    [refreshSnapshots, showToast]
  );

  const handleConfirmReset = async () => {
    await clearSavedSiteData();
    const fresh: SiteData = JSON.parse(JSON.stringify(INITIAL_SITE_DATA));
    pastRef.current = [];
    futureRef.current = [];
    latestCommittedRef.current = fresh;
    setSiteData(fresh);
    setSelectedRef(null);
    setResetConfirmOpen(false);
    showToast('Restored original Canva copy');
  };

  useEffect(() => {
    if (mode !== 'editor') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (inInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedRef) {
        e.preventDefault();
        handleDuplicateElement(selectedRef.subpageIndex, selectedRef.elementId);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef) {
        e.preventDefault();
        handleDeleteElement(selectedRef.subpageIndex, selectedRef.elementId);
        return;
      }
      if (
        selectedRef &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        handleUpdateElementCommitted(
          selectedRef.subpageIndex,
          selectedRef.elementId,
          (prev) => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy,
          })
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mode,
    selectedRef,
    handleUndo,
    handleRedo,
    handleDuplicateElement,
    handleDeleteElement,
    handleUpdateElementCommitted,
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100">
      <input
        ref={addImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleAddUploadedImage}
        className="hidden"
      />
      <input
        ref={importJsonInputRef}
        type="file"
        accept="application/json"
        onChange={handleImportJson}
        className="hidden"
      />

      {mode === 'editor' ? (
        <>
          <header className="flex items-center justify-between gap-8 px-6 py-3 bg-zinc-950 border-b border-zinc-800 shrink-0">
            <a
              href="#studio"
              onClick={(e) => {
                e.preventDefault();
                setActivePageIndex(0);
              }}
              className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
            >
              Zizou Birthday Studio
            </a>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
              <button
                type="button"
                onClick={handleAddText}
                className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Text
              </button>
              <button
                type="button"
                onClick={handleAddButton}
                className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Button
              </button>
              <button
                type="button"
                onClick={() => addImageInputRef.current?.click()}
                className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Image
              </button>
              <button
                type="button"
                onClick={handleAddHotspot}
                className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Hotspot
              </button>
              <button
                type="button"
                onClick={() => setEmbedModalOpen(true)}
                className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Add Embed
              </button>
              {letterInfo.hasScrollingLetter && (
                <button
                  type="button"
                  onClick={() => setLetterModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Birthday Letter
                </button>
              )}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-amber-400/40 text-amber-300 text-xs font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  Saving...
                </span>
              ) : (
                <span
                  title={`All edits safely stored locally. Last saved at ${lastSavedFormatted}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-emerald-400 text-xs font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Saved
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  performSave(latestCommittedRef.current, true, 'User saved');
                  showToast('✓ All changes saved securely to storage!');
                }}
                title="Save changes now (Ctrl+S / Cmd+S)"
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                Save Now
              </button>

              <button
                type="button"
                onClick={() => {
                  refreshSnapshots();
                  setHistoryModalOpen(true);
                }}
                title="View all automatic checkpoints & version history"
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                Backups ({snapshots.length})
              </button>

              <button
                type="button"
                onClick={() => setMusicModalOpen(true)}
                title="Configure Background Song & Audio Track"
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Music className="w-3.5 h-3.5 text-amber-400" />
                Background Song
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRef(null);
                  setMode('preview');
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ml-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Preview Live Site
              </button>
            </div>
          </header>

          <div className="flex items-center justify-between gap-4 px-5 py-2 bg-zinc-900/90 border-b border-zinc-800 text-xs shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={pastRef.current.length === 0}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                disabled={futureRef.current.length === 0}
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
                Redo
              </button>

              <span className="text-zinc-700 px-1" aria-hidden="true">
                |
              </span>

              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
                {(
                  [
                    ['Fit', 'fit'],
                    ['50%', 0.5],
                    ['75%', 0.75],
                    ['100%', 1],
                  ] as const
                ).map(([label, val]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setZoom(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      zoom === val
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowHotspots((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showHotspots
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {showHotspots ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                Hotspots
              </button>

              <button
                type="button"
                onClick={() => setAnimReplayKey((k) => k + 1)}
                title="Replay Canva page and element entrance animations"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 text-zinc-300 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Replay Animation
              </button>

              <button
                type="button"
                onClick={() => setAnimationsEnabled((a) => !a)}
                title="Toggle animations on/off"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  animationsEnabled
                    ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Motion: {animationsEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center gap-3 text-zinc-400 shrink-0">
              <span className="hidden lg:inline">
                Editing: <strong className="text-zinc-200">{activePage.name}</strong> ·{' '}
                <span className="font-mono-num">{activePage.anchor}</span>
              </span>

              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => importJsonInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-300 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Original
              </button>
            </div>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <PageSidebar
              pages={siteData.pages}
              activePageIndex={safePageIdx}
              onSelectPage={(idx) => {
                setActivePageIndex(idx);
                setSelectedRef(null);
              }}
              onRenamePage={handleRenamePage}
              onDuplicatePage={handleDuplicatePage}
              onMovePage={handleMovePage}
              onDeletePage={handleDeletePage}
              onAddPage={handleAddPage}
            />

            <main className="flex-1 min-w-0 h-full relative">
              <PageStage
                page={activePage}
                isEditor={true}
                zoom={zoom}
                selectedRef={selectedRef}
                showHotspots={showHotspots}
                soundMuted={true}
                animationsEnabled={animationsEnabled}
                animReplayKey={animReplayKey}
                onSelectElement={setSelectedRef}
                onUpdateElementTransient={handleUpdateElementTransient}
                onCommitHistory={commitTransientDragResize}
                onOpenLetterComposer={() => setLetterModalOpen(true)}
                onNavigateLink={handleNavigateLink}
              />
            </main>

            <InspectorPanel
              pages={siteData.pages}
              activePage={activePage}
              selectedRef={selectedRef}
              availableFonts={siteData.fonts}
              onSelectElement={setSelectedRef}
              onUpdateElement={handleUpdateElementCommitted}
              onLayerMove={handleLayerMove}
              onDuplicateElement={handleDuplicateElement}
              onDeleteElement={handleDeleteElement}
              onUngroupElement={handleUngroupElement}
              onUpdateSubpageBg={handleUpdateSubpageBg}
              onAddSubpage={handleAddSubpage}
              onDeleteSubpage={handleDeleteSubpage}
              onOpenLetterComposer={() => setLetterModalOpen(true)}
              onJumpToLink={(lnk) => {
                const idx = resolveLinkToPageIndex(lnk, siteData.pages);
                if (idx !== null) {
                  setActivePageIndex(idx);
                  setSelectedRef(null);
                } else {
                  showToast(`External link: ${lnk}`);
                }
              }}
            />
          </div>
        </>
      ) : (
        <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
          <PageStage
            page={activePage}
            isEditor={false}
            zoom="fit"
            selectedRef={null}
            showHotspots={false}
            soundMuted={soundMuted}
            animationsEnabled={animationsEnabled}
            animReplayKey={animReplayKey}
            onSelectElement={() => {}}
            onUpdateElementTransient={() => {}}
            onCommitHistory={() => {}}
            onOpenLetterComposer={() => {}}
            onNavigateLink={handleNavigateLink}
          />

          {controlsMinimized ? (
            <button
              type="button"
              onClick={() => setControlsMinimized(false)}
              title="Show Studio Controls"
              className="fixed bottom-4 right-4 z-40 px-3 py-1.5 rounded-lg bg-zinc-950/75 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-white/15 backdrop-blur-md text-xs font-medium shadow-lg transition-colors cursor-pointer"
            >
              Studio Controls
            </button>
          ) : (
            <div className="fixed top-3 right-3 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/80 border border-white/15 backdrop-blur-md shadow-xl">
              {navHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  title="Previous visited page"
                  className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-medium text-zinc-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={() => setPreviewDrawerOpen((v) => !v)}
                className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-medium text-zinc-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <List className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Page {safePageIdx + 1}/{siteData.pages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAnimReplayKey((k) => k + 1)}
                title="Replay page entrance animations"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={() => setSoundMuted((m) => !m)}
                title={soundMuted ? 'Unmute site audio' : 'Mute site audio'}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-200 cursor-pointer"
              >
                {soundMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMusicModalOpen(true)}
                title="Background Song & Audio Settings"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Music className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  refreshSnapshots();
                  setHistoryModalOpen(true);
                }}
                title="Version History & Backups"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  performSave(latestCommittedRef.current, true, 'User saved in preview');
                  showToast('✓ All changes saved securely!');
                }}
                title="Save Now (Ctrl+S / Cmd+S)"
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setMode('editor')}
                className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                Edit Site
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewDrawerOpen(false);
                  setControlsMinimized(true);
                }}
                title="Hide controls for fullscreen viewing"
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {previewDrawerOpen && (
            <div className="fixed top-14 right-3 z-40 w-72 max-h-[75vh] overflow-y-auto rounded-xl bg-zinc-950/95 border border-zinc-800 backdrop-blur-md shadow-2xl p-2 space-y-1">
              <div className="px-2 py-1.5 flex items-center justify-between border-b border-zinc-800 mb-1">
                <span className="text-xs font-semibold text-zinc-200">
                  Jump to Scene
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewDrawerOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {siteData.pages.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setNavHistory((prev) => [...prev.slice(-25), safePageIdx]);
                    setActivePageIndex(idx);
                    setPreviewDrawerOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    idx === safePageIdx
                      ? 'bg-amber-400/20 text-amber-300 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-800/80'
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {p.name}
                  </span>
                  <span className="text-[11px] font-mono-num text-zinc-500 shrink-0">
                    {p.anchor}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {letterModalOpen && letterInfo.hasScrollingLetter && (
        <LetterComposerModal
          initialText={letterInfo.fullText}
          sectionCount={letterInfo.sliceRefs.length}
          onSave={handleSaveUnifiedLetter}
          onClose={() => setLetterModalOpen(false)}
        />
      )}

      {embedModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEmbedModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                Add Spotify or YouTube Embed
              </h2>
              <button
                type="button"
                onClick={() => setEmbedModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste a Spotify playlist, Spotify song, or YouTube video link and it will be converted into an interactive player on the current page.
            </p>
            <input
              type="text"
              autoFocus
              value={newEmbedUrl}
              onChange={(e) => setNewEmbedUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAddEmbed();
              }}
              placeholder="https://open.spotify.com/playlist/... or https://youtu.be/..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 outline-none focus:border-amber-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmbedModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddEmbed}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300 cursor-pointer"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setResetConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-white">
              Restore Original Canva Site?
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This discards local edits and restores all 26 pages, artwork, and text back to the exact original copy from Canva. You can Export JSON first if you want a backup.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-400 cursor-pointer"
              >
                Reset to Original
              </button>
            </div>
          </div>
        </div>
      )}

      {externalLinkNotice && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExternalLinkNotice(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-white">External Link</h2>
            <p className="text-xs font-mono-num text-zinc-300 break-all bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              {externalLinkNotice}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExternalLinkNotice(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
              <a
                href={externalLinkNotice}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setExternalLinkNotice(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300"
              >
                Open Link
              </a>
            </div>
          </div>
        </div>
      )}

      {candleBlowing && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/45 backdrop-blur-[2px] transition-all">
          <div className="text-center px-7 py-5 rounded-2xl bg-zinc-950/95 border border-amber-400/60 shadow-2xl animate-pulse">
            <span className="text-4xl block mb-2">🎂 💨 ✨</span>
            <p className="text-amber-300 font-bold text-sm tracking-wide">
              Blowing out the candles... Make a wish!
            </p>
          </div>
        </div>
      )}

      <BackupsModal
        isOpen={historyModalOpen}
        snapshots={snapshots}
        onClose={() => setHistoryModalOpen(false)}
        onCreateSnapshot={handleCreateSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      <AudioSettingsModal
        isOpen={musicModalOpen}
        pages={siteData.pages}
        currentTrack={siteData.audioTrack}
        currentConfig={siteData.backgroundMusic}
        onClose={() => setMusicModalOpen(false)}
        onSaveAudioConfig={handleSaveAudioConfig}
      />

      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-zinc-900 border border-amber-400/50 text-xs font-medium text-zinc-100 shadow-2xl pointer-events-none">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default App;
