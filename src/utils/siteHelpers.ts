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

export async function syncSiteDataToServer(data: SiteData): Promise<boolean> {
  try {
    const res = await fetch('/api/site-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteData: data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchServerSiteData(): Promise<SiteData | null> {
  try {
    const res = await fetch('/api/site-data', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (isValidSiteData(data)) {
        return data;
      }
    }
  } catch {
    // Offline or server not responding
  }
  return null;
}

export function countUserEdits(data: any): number {
  if (!isValidSiteData(data)) return 0;
  let score = 0;

  if (
    data.backgroundMusic?.enabled ||
    (data.backgroundMusic?.url && data.backgroundMusic.url.length > 0)
  ) {
    score += 50;
  }
  if (
    data.audioTrack &&
    !data.audioTrack.includes('64d550272432c09e29bb481d61f6e831')
  ) {
    score += 50;
  }
  if (data.title && data.title !== 'Happy Birthday Zizou!!') {
    score += 20;
  }
  if (data.pages.length !== 26) {
    score += Math.abs(data.pages.length - 26) * 30;
  }

  // Count modified text, elements, embeds
  for (const p of data.pages) {
    if (p.subpages && p.subpages.length > 1) {
      score += (p.subpages.length - 1) * 15;
    }
    for (const sp of p.subpages || []) {
      for (const el of sp.elements || []) {
        if (el.embed) score += 40;
        if ((el as any).customMedia || (el as any).userAdded) score += 30;
        if (el.type === 'text' && el.textStyle?.text) {
          const t = el.textStyle.text.trim();
          if (t.length > 0 && !t.includes('Lorem ipsum')) {
            score += 0.5;
          }
        }
      }
    }
  }

  if (data.lastSavedAt && data.lastSavedAt > 1000) {
    score += 1;
  }

  return Math.round(score);
}

export interface SavedVersionInfo {
  id: string;
  source: string;
  title: string;
  timestamp: number;
  dateFormatted: string;
  pageCount: number;
  userEditsScore: number;
  data: SiteData;
}

export async function getAllSavedVersions(): Promise<SavedVersionInfo[]> {
  const map = new Map<string, SavedVersionInfo>();

  const addCandidate = (
    data: any,
    source: string,
    title?: string,
    forcedTime?: number
  ) => {
    if (!isValidSiteData(data)) return;
    const timestamp = forcedTime || data.lastSavedAt || 0;
    const score = countUserEdits(data);
    const key = `${data.pages.length}_${data.pages[0]?.id}_${data.title}_${score}_${data.audioTrack || ''}`;

    const dateFormatted =
      timestamp > 0
        ? new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : 'Previous save';

    const info: SavedVersionInfo = {
      id: generateId('ver'),
      source,
      title:
        title ||
        (score > 0
          ? `Saved Edits (${score} modifications)`
          : 'Original Canva Site'),
      timestamp,
      dateFormatted,
      pageCount: data.pages.length,
      userEditsScore: score,
      data,
    };

    if (!map.has(key) || map.get(key)!.timestamp < timestamp) {
      map.set(key, info);
    }
  };

  // 1. Scan snapshots_store in IndexedDB (ALL historical snapshots)
  try {
    const db = await openDB();
    const snapTx = db.transaction(SNAPSHOTS_STORE, 'readonly');
    const req = snapTx.objectStore(SNAPSHOTS_STORE).getAll();
    const snaps = await new Promise<SaveSnapshot[]>((res) => {
      req.onsuccess = () => res((req.result as SaveSnapshot[]) || []);
      req.onerror = () => res([]);
    });
    for (const snap of snaps) {
      if (isValidSiteData(snap.data)) {
        addCandidate(
          snap.data,
          `Backup snapshot: ${snap.title}`,
          snap.title,
          snap.timestamp
        );
      }
    }
  } catch {
    // Continue
  }

  // 2. Scan site_store in IndexedDB
  try {
    const db = await openDB();
    const siteTx = db.transaction(STORE_NAME, 'readonly');
    const store = siteTx.objectStore(STORE_NAME);
    const knownKeys = [PRIMARY_KEY, ...LEGACY_KEYS];
    for (const k of knownKeys) {
      try {
        const itemReq = store.get(k);
        const item = await new Promise<any>((res) => {
          itemReq.onsuccess = () => res(itemReq.result);
          itemReq.onerror = () => res(null);
        });
        if (isValidSiteData(item)) {
          addCandidate(item, `IndexedDB (${k})`, `Storage (${k})`);
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Continue
  }

  // 3. Scan ALL localStorage keys
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith('zizou_') ||
          k.startsWith('saved_') ||
          k.includes('site') ||
          k.includes('canva') ||
          k.includes('snap')
        ) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (isValidSiteData(parsed)) {
                addCandidate(parsed, `localStorage (${k})`, `Local save (${k})`);
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  } catch {
    // Continue
  }

  // 4. Also check server site data
  try {
    const srv = await fetchServerSiteData();
    if (srv && isValidSiteData(srv)) {
      addCandidate(
        srv,
        'server:/api/site-data',
        'Server Project Data',
        srv.lastSavedAt || 0
      );
    }
  } catch {
    // Continue
  }

  const list = Array.from(map.values());
  // Sort: highest user edits score first, then newest timestamp
  list.sort((a, b) => {
    if (b.userEditsScore !== a.userEditsScore) {
      return b.userEditsScore - a.userEditsScore;
    }
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return list;
}

export async function loadSavedSiteData(): Promise<SiteData | null> {
  const versions = await getAllSavedVersions();

  // If any candidate has actual user edits (score > 0), load that candidate immediately!
  const edited = versions.filter((v) => v.userEditsScore > 0);
  if (edited.length > 0) {
    return edited[0].data;
  }

  // If no edited versions exist anywhere, fall back to the newest available version
  if (versions.length > 0) {
    return versions[0].data;
  }

  return null;
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

    // 3. Auto-snapshot every 5 minutes or on explicit request
    const now = Date.now();
    if (createSnapshot || now - lastSnapshotTime > 300_000) {
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

  // 4. Always sync to server so published builds on disk have the exact user edits
  syncSiteDataToServer(stamped).catch(() => {});
}

export function saveSiteDataSync(data: SiteData): void {
  try {
    const stamped = { ...data, lastSavedAt: Date.now() };
    const serialized = JSON.stringify(stamped);
    localStorage.setItem(LS_PRIMARY_KEY, serialized);
    localStorage.setItem(PRIMARY_KEY, serialized);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ siteData: stamped })], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/site-data', blob);
    }
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
