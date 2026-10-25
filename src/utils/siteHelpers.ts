import { CanvaPage, CanvasElement, EmbedConfig, SaveSnapshot, SiteData } from '../types/site';

const DB_NAME = 'zizou_canva_studio_db';
const STORE_NAME = 'site_store';
const SNAPSHOTS_STORE = 'snapshots_store';
const PRIMARY_KEY = 'zizou_master_save';
const LEGACY_KEYS = ['saved_site_v2_anim', 'saved_site_v1', 'saved_site'];
const LS_PRIMARY_KEY = 'zizou_master_save_ls';

let lastSnapshotTime = 0;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isValidSiteData(obj: any): obj is SiteData {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.pages) &&
    obj.pages.length > 0 &&
    Boolean(obj.pages[0]?.subpages)
  );
}

export async function loadSavedSiteData(): Promise<SiteData | null> {
  const candidates: Array<{ data: SiteData; source: string; timestamp: number }> = [];

  // 1. Check IndexedDB across all known primary and legacy keys
  try {
    const db = await openDB();
    const allKeys = [PRIMARY_KEY, ...LEGACY_KEYS];
    for (const key of allKeys) {
      try {
        const item = await new Promise<SiteData | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(key);
          req.onsuccess = () => resolve((req.result as SiteData) ?? null);
          req.onerror = () => resolve(null);
        });
        if (isValidSiteData(item)) {
          candidates.push({
            data: item,
            source: `indexedDB:${key}`,
            timestamp: item.lastSavedAt || 1,
          });
        }
      } catch {
        // Continue checking other keys
      }
    }

    // Also check if any snapshots exist if direct keys were empty
    if (candidates.length === 0) {
      try {
        const snapshots = await new Promise<SaveSnapshot[]>((resolve) => {
          const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
          const req = tx.objectStore(SNAPSHOTS_STORE).getAll();
          req.onsuccess = () => resolve((req.result as SaveSnapshot[]) || []);
          req.onerror = () => resolve([]);
        });
        if (snapshots.length > 0) {
          snapshots.sort((a, b) => b.timestamp - a.timestamp);
          const newest = snapshots[0];
          if (isValidSiteData(newest.data)) {
            candidates.push({
              data: newest.data,
              source: `snapshot:${newest.id}`,
              timestamp: newest.timestamp,
            });
          }
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // IndexedDB failed, fallback to localStorage
  }

  // 2. Check localStorage across all primary and legacy keys
  const lsKeys = [LS_PRIMARY_KEY, PRIMARY_KEY, ...LEGACY_KEYS];
  for (const k of lsKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidSiteData(parsed)) {
          candidates.push({
            data: parsed,
            source: `localStorage:${k}`,
            timestamp: parsed.lastSavedAt || 0,
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Pick the most recent and most complete candidate
  candidates.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const best = candidates[0].data;

  // Immediately mirror back to ALL stores to ensure everything stays in sync
  saveSiteData(best, false).catch(() => {});

  return best;
}

export async function saveSiteData(
  data: SiteData,
  createSnapshot = false,
  snapshotTitle?: string
): Promise<void> {
  const stamped: SiteData = {
    ...data,
    lastSavedAt: Date.now(),
  };

  // 1. Synchronously mirror to localStorage first for instant durability
  try {
    const serialized = JSON.stringify(stamped);
    localStorage.setItem(LS_PRIMARY_KEY, serialized);
    localStorage.setItem(PRIMARY_KEY, serialized);
    localStorage.setItem('saved_site_v2_anim', serialized);
  } catch {
    // If quota exceeded, store light metadata in localStorage
    try {
      localStorage.setItem(
        'zizou_last_saved_meta',
        JSON.stringify({ lastSavedAt: stamped.lastSavedAt, pageCount: stamped.pages.length })
      );
    } catch {
      // Ignore
    }
  }

  // 2. Save into IndexedDB primary key and legacy keys
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(stamped, PRIMARY_KEY);
      store.put(stamped, 'saved_site_v2_anim');
      store.put(stamped, 'saved_site_v1');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 3. Auto-snapshot every 60 seconds or on explicit request
    const now = Date.now();
    if (createSnapshot || now - lastSnapshotTime > 60_000) {
      lastSnapshotTime = now;
      const snap: SaveSnapshot = {
        id: generateId('snap'),
        timestamp: now,
        dateFormatted: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        title:
          snapshotTitle ||
          (createSnapshot ? 'Manual checkpoint' : 'Auto-save checkpoint'),
        pageCount: stamped.pages.length,
        data: JSON.parse(JSON.stringify(stamped)),
      };

      try {
        const snapTx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        const snapStore = snapTx.objectStore(SNAPSHOTS_STORE);
        snapStore.put(snap);

        // Prune older snapshots if more than 20
        const allReq = snapStore.getAll();
        allReq.onsuccess = () => {
          const snaps = (allReq.result as SaveSnapshot[]) || [];
          if (snaps.length > 20) {
            snaps.sort((a, b) => b.timestamp - a.timestamp);
            const toDelete = snaps.slice(20);
            const pruneTx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
            const pruneStore = pruneTx.objectStore(SNAPSHOTS_STORE);
            toDelete.forEach((s) => pruneStore.delete(s.id));
          }
        };
      } catch {
        // Ignore snapshot errors
      }
    }
  } catch {
    // Handled by localStorage fallback
  }
}

export function saveSiteDataSync(data: SiteData): void {
  try {
    const stamped = { ...data, lastSavedAt: Date.now() };
    const serialized = JSON.stringify(stamped);
    localStorage.setItem(LS_PRIMARY_KEY, serialized);
    localStorage.setItem(PRIMARY_KEY, serialized);
  } catch {
    // Ignore
  }
}

export async function getSavedSnapshots(): Promise<SaveSnapshot[]> {
  try {
    const db = await openDB();
    return await new Promise<SaveSnapshot[]>((resolve) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readonly');
      const req = tx.objectStore(SNAPSHOTS_STORE).getAll();
      req.onsuccess = () => {
        const snaps = (req.result as SaveSnapshot[]) || [];
        snaps.sort((a, b) => b.timestamp - a.timestamp);
        resolve(snaps);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function createManualSnapshot(
  data: SiteData,
  title: string
): Promise<SaveSnapshot> {
  const now = Date.now();
  const snap: SaveSnapshot = {
    id: generateId('snap'),
    timestamp: now,
    dateFormatted: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    title: title.trim() || 'Manual checkpoint',
    pageCount: data.pages.length,
    data: JSON.parse(JSON.stringify(data)),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
      tx.objectStore(SNAPSHOTS_STORE).put(snap);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  return snap;
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite');
      tx.objectStore(SNAPSHOTS_STORE).delete(snapshotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function clearSavedSiteData(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, SNAPSHOTS_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(SNAPSHOTS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  try {
    localStorage.removeItem(LS_PRIMARY_KEY);
    localStorage.removeItem(PRIMARY_KEY);
    localStorage.removeItem('saved_site_v2_anim');
    localStorage.removeItem('saved_site_v1');
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
