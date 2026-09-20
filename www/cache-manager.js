// SquashDB temporary cache management.
// User data lives in localStorage/backup files and is never touched here.

const SQUASHDB_METADATA_CACHE = "squashdb-metadata-v1";
const SQUASHDB_IMAGE_CACHE = "squashdb-images-v1";
const SQUASHDB_FONT_CACHE = "squashdb-fonts-v1";
const SQUASHDB_CACHE_TIMESTAMPS_KEY = "squashdb_metadata_cache_timestamps";
const SQUASHDB_METADATA_CACHE_TTL = 6 * 60 * 60 * 1000;
const SQUASHDB_IMAGE_CACHE_MAX_ENTRIES = 250;

const nativeFetch = window.fetch.bind(window);
const metadataHosts = [
  "api.tvmaze.com", "wikidata.org", "openlibrary.org", "covers.openlibrary.org",
  "api.jikan.moe", "kitsu.io", "graphql.anilist.co", "api.rawg.io",
  "googleapis.com", "omdbapi.com", "themoviedb.org", "mangadex.org",
  "shikimori.one", "freetogame.com", "wikipedia.org"
];

function cacheUrlString(input) {
  return typeof input === "string" ? input : input?.url || String(input || "");
}

function isMetadataUrl(input) {
  try {
    const url = new URL(cacheUrlString(input));
    return metadataHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function isSensitiveUrl(input) {
  try {
    const params = new URL(cacheUrlString(input)).searchParams;
    return ["key", "api_key", "apikey", "apiKey"].some(key => params.has(key));
  } catch {
    return true;
  }
}

function isImageUrl(input) {
  try {
    const url = new URL(cacheUrlString(input));
    return /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url.pathname)
      || /image|thumbnail|cover/i.test(url.pathname);
  } catch {
    return false;
  }
}

function readCacheTimestamps() {
  try {
    return JSON.parse(localStorage.getItem(SQUASHDB_CACHE_TIMESTAMPS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCacheTimestamps(timestamps) {
  try {
    localStorage.setItem(SQUASHDB_CACHE_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch {
    // Cache management must never break the app when storage is unavailable.
  }
}

function cacheTimestampKey(url) {
  return url.slice(0, 500);
}

async function squashdbCachedFetch(input, init = {}) {
  const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = cacheUrlString(input);
  const imageRequest = method === "GET" && isImageUrl(url);
  const metadataRequest = method === "GET" && isMetadataUrl(url) && !imageRequest;
  if ((!metadataRequest && !imageRequest) || isSensitiveUrl(url) || !window.caches) {
    return nativeFetch(input, init);
  }

  const cache = await caches.open(imageRequest ? SQUASHDB_IMAGE_CACHE : SQUASHDB_METADATA_CACHE);
  const request = new Request(url, { method: "GET" });
  const timestamps = readCacheTimestamps();
  const timestampKey = cacheTimestampKey(url);
  const cached = await cache.match(request);
  const cachedAt = Number(timestamps[timestampKey] || 0);

  if (cached && (imageRequest || (cachedAt && Date.now() - cachedAt < SQUASHDB_METADATA_CACHE_TTL))) {
    return cached;
  }

  let response = null;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await nativeFetch(input, init);
      if (response.ok || response.status < 500) break;
    } catch (err) {
      lastError = err;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if (response?.ok && response.type !== "opaque") {
    await cache.put(request, response.clone());
    if (!imageRequest) timestamps[timestampKey] = Date.now();
    writeCacheTimestamps(timestamps);
  }
  if (response?.ok || (response && response.status < 500)) return response;
  if (cached) return cached;
  throw lastError || new Error("Network request failed");
}

// Covers metadata fetches in all current feature files without changing the
// network behavior of local assets, fonts, or user-configured non-metadata URLs.
window.fetch = (input, init) => squashdbCachedFetch(input, init);

async function clearSquashDbMetadataCache() {
  if (window.caches) await caches.delete(SQUASHDB_METADATA_CACHE);
  localStorage.removeItem(SQUASHDB_CACHE_TIMESTAMPS_KEY);
}

async function clearSquashDbImageCache() {
  if (window.caches) await caches.delete(SQUASHDB_IMAGE_CACHE);
  if (window.caches) await caches.delete(SQUASHDB_FONT_CACHE);

  const nativeCache = window.Capacitor?.Plugins?.CacheManager;
  if (nativeCache?.clearWebViewCache) {
    await nativeCache.clearWebViewCache();
  }
}

async function trimSquashDbImageCache(maxEntries = SQUASHDB_IMAGE_CACHE_MAX_ENTRIES) {
  if (!window.caches) return;
  if (Number(maxEntries) === 0) return;
  const cache = await caches.open(SQUASHDB_IMAGE_CACHE);
  const requests = await cache.keys();
  for (const request of requests.slice(0, Math.max(0, requests.length - maxEntries))) {
    await cache.delete(request);
  }
}

async function squashdbCacheDetails() {
  const stats = await squashdbCacheStats();
  return { ...stats, maxImageEntries: SQUASHDB_IMAGE_CACHE_MAX_ENTRIES };
}

async function clearSquashDbTemporaryCaches() {
  await clearSquashDbMetadataCache();
  await clearSquashDbImageCache();
}

async function squashdbCacheStats() {
  const result = { metadataEntries: 0, imageEntries: 0, metadataBytes: 0, imageBytes: 0 };
  if (!window.caches) return result;

  const metadata = await caches.open(SQUASHDB_METADATA_CACHE);
  const images = await caches.open(SQUASHDB_IMAGE_CACHE);
  const measure = async cache => {
    let bytes = 0;
    const keys = await cache.keys();
    for (const key of keys) {
      const response = await cache.match(key);
      const headerSize = Number(response?.headers.get("content-length") || 0);
      bytes += headerSize || (response ? (await response.clone().arrayBuffer()).byteLength : 0);
    }
    return { entries: keys.length, bytes };
  };
  const [metadataStats, imageStats] = await Promise.all([measure(metadata), measure(images)]);
  result.metadataEntries = metadataStats.entries;
  result.metadataBytes = metadataStats.bytes;
  result.imageEntries = imageStats.entries;
  result.imageBytes = imageStats.bytes;
  return result;
}

window.SquashDBCache = {
  clearMetadata: clearSquashDbMetadataCache,
  clearImages: clearSquashDbImageCache,
  clearTemporary: clearSquashDbTemporaryCaches,
  stats: squashdbCacheStats,
  details: squashdbCacheDetails,
  trimImages: trimSquashDbImageCache
};
