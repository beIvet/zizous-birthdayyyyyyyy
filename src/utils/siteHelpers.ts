import { CanvaPage, CanvasElement, EmbedConfig, SiteData } from '../types/site';

const DB_NAME = 'zizou_canva_studio_db';
const STORE_NAME = 'site_store';
const DATA_KEY = 'saved_site_v2_anim';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSavedSiteData(): Promise<SiteData | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(DATA_KEY);
      req.onsuccess = () => resolve((req.result as SiteData) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? (JSON.parse(raw) as SiteData) : null;
    } catch {
      return null;
    }
  }
}

export async function saveSiteData(data: SiteData): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, DATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export async function clearSavedSiteData(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(DATA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  try {
    localStorage.removeItem(DATA_KEY);
  } catch {
    // Ignore
  }
}

export function generateId(prefix = 'el'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveLinkToPageIndex(link: string | null | undefined, pages: CanvaPage[]): number | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith('#page-')) return null;
  const targetSlug = trimmed.replace('#page-', '');
  const exactIdx = pages.findIndex((p) => p.slug === targetSlug || p.anchor === trimmed);
  if (exactIdx !== -1) return exactIdx;

  // Fallback for numeric page index if referenced
  const asNum = Number(targetSlug);
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < pages.length) {
    return asNum;
  }
  return null;
}

export function parseEmbedInput(url: string): EmbedConfig {
  const clean = url.trim();
  if (clean.includes('open.spotify.com/playlist/')) {
    const m = clean.match(/playlist\/([a-zA-Z0-9]+)/);
    const pid = m ? m[1] : '';
    return {
      provider: 'spotify-playlist',
      embedUrl: `https://open.spotify.com/embed/playlist/{pid}?utm_source=generator`,
      originalUrl: clean,
    };
  }
  if (clean.includes('open.spotify.com/track/')) {
    const m = clean.match(/track\/([a-zA-Z0-9]+)/);
    const tid = m ? m[1] : '';
    return {
      provider: 'spotify-track',
      embedUrl: `https://open.spotify.com/embed/track/{tid}?utm_source=generator`,
      originalUrl: clean,
    };
  }
  if (clean.includes('youtu.be/') || clean.includes('youtube.com/')) {
    const m = clean.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/);
    const vid = m ? m[1] : '';
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${vid}?rel=0`,
      originalUrl: clean,
    };
  }
  return {
    provider: 'iframe',
    embedUrl: clean,
    originalUrl: clean,
  };
}

/**
 * Converts a Canva group element into individual top-level CanvasElements
 * preserving exact scaled position, dimensions, font sizes, and rotation.
 */
export function ungroupElement(groupEl: CanvasElement): CanvasElement[] {
  if (groupEl.type !== 'group' || !groupEl.group) return [groupEl];
  const scaleX = groupEl.width / (groupEl.group.internalWidth || groupEl.width || 1);
  const scaleY = groupEl.height / (groupEl.group.internalHeight || groupEl.height || 1);
  const uniformScale = (scaleX + scaleY) / 2;

  return groupEl.group.children.map((child) => {
    const cloned: CanvasElement = JSON.parse(JSON.stringify(child));
    cloned.id = generateId('ungrouped');
    cloned.x = Math.round((groupEl.x + child.x * scaleX) * 100) / 100;
    cloned.y = Math.round((groupEl.y + child.y * scaleY) * 100) / 100;
    cloned.width = Math.round(child.width * scaleX * 100) / 100;
    cloned.height = Math.round(child.height * scaleY * 100) / 100;
    cloned.rotation = Math.round(((groupEl.rotation || 0) + (child.rotation || 0)) * 100) / 100;
    cloned.opacity = Math.round(groupEl.opacity * child.opacity * 1000) / 1000;
    if (!cloned.link && groupEl.link) {
      cloned.link = groupEl.link;
    }
    if (cloned.textStyle) {
      cloned.textStyle.fontSize = Math.round(cloned.textStyle.fontSize * uniformScale * 100) / 100;
    }
    if (cloned.buttonStyle) {
      cloned.buttonStyle.fontSize = Math.round(cloned.buttonStyle.fontSize * uniformScale * 100) / 100;
    }
    if (cloned.media?.crop) {
      cloned.media.crop = {
        x: Math.round(cloned.media.crop.x * scaleX * 100) / 100,
        y: Math.round(cloned.media.crop.y * scaleY * 100) / 100,
        width: Math.round(cloned.media.crop.width * scaleX * 100) / 100,
        height: Math.round(cloned.media.crop.height * scaleY * 100) / 100,
      };
    }
    return cloned;
  });
}

/**
 * Checks whether a page contains the multi-subpage scrolling birthday letter (Page #page-7)
 * and extracts the longest/complete version of the letter text.
 */
export function getScrollingLetterInfo(page: CanvaPage): {
  hasScrollingLetter: boolean;
  fullText: string;
  sliceRefs: Array<{ subpageIndex: number; elementId: string; y: number }>;
} {
  const sliceRefs: Array<{ subpageIndex: number; elementId: string; y: number; text: string }> = [];

  page.subpages.forEach((sp, sIdx) => {
    sp.elements.forEach((el) => {
      if (el.type === 'text' && el.textStyle && el.height >= 1800 && el.textStyle.text.length >= 400) {
        sliceRefs.push({
          subpageIndex: sIdx,
          elementId: el.id,
          y: el.y,
          text: el.textStyle.text,
        });
      }
    });
  });

  if (sliceRefs.length < 2) {
    return { hasScrollingLetter: false, fullText: '', sliceRefs: [] };
  }

  // Pick the longest slice (Subpage 6 holds the entire 3,040-char birthday letter)
  const longest = sliceRefs.reduce((best, cur) => (cur.text.length > best.text.length ? cur : best), sliceRefs[0]);

  return {
    hasScrollingLetter: true,
    fullText: longest.text,
    sliceRefs: sliceRefs.map(({ subpageIndex, elementId, y }) => ({ subpageIndex, elementId, y })),
  };
}

export function countPageLinks(page: CanvaPage): number {
  let count = 0;
  const walk = (elems: CanvasElement[]) => {
    for (const el of elems) {
      if (el.link) count++;
      if (el.type === 'group' && el.group) walk(el.group.children);
    }
  };
  for (const sp of page.subpages) {
    walk(sp.elements);
  }
  return count;
}

export function mergeAnimationsIfMissing(saved: SiteData, fresh: SiteData): SiteData {
  const animMap = new Map<string, NonNullable<CanvasElement['animation']>>();

  const collect = (elems: CanvasElement[]) => {
    for (const el of elems) {
      if (el.animation) animMap.set(el.id, el.animation);
      if (el.group?.children) collect(el.group.children);
    }
  };

  fresh.pages.forEach((p) => p.subpages.forEach((sp) => collect(sp.elements)));

  const apply = (elems: CanvasElement[]) => {
    for (const el of elems) {
      if (!el.animation && animMap.has(el.id)) {
        el.animation = animMap.get(el.id);
      }
      if (el.group?.children) apply(el.group.children);
    }
  };

  saved.pages.forEach((p) => p.subpages.forEach((sp) => apply(sp.elements)));
  return saved;
}
