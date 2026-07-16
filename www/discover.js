// SquashDB - Discover: category-first online search. Pick a tracking category
// (same enabled-categories chip row as Dashboard), see its top-rated
// suggestions immediately, then search scoped to just that category across
// every enabled metadata source for it, merged into one result list.
// Results here are ephemeral until the user opens one and marks progress/status
// on the detail page — only then does it get saved into state.items so it can
// still be ticked/tracked offline afterwards.
// Depends on globals from app.js/metadata.js: state, saveData(), CATEGORIES,
// getOrderedCategories(), builtinSourceEnabled(), thumbnailOrPlaceholder().

let discoverResults = [];
let discoverCategory = null;
let discoverRequestId = 0;

function saveDiscoverSessionState(category, query) {
  try {
    sessionStorage.setItem("squashdb_discover_state", JSON.stringify({ category, query }));
  } catch (e) { /* sessionStorage unavailable — non-fatal */ }
}

function loadDiscoverSessionState() {
  try {
    return JSON.parse(sessionStorage.getItem("squashdb_discover_state") || "null") || {};
  } catch (e) {
    return {};
  }
}

function discoverIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// Best-effort category detection from a TVmaze show's language/genres, since
// TVmaze itself has no first-class "anime"/"kdrama"/"cdrama" field.
function detectTvmazeCategory(show) {
  const genres = (show.genres || []).map(g => g.toLowerCase());
  const language = (show.language || "").toLowerCase();
  const country = (show.network?.country?.code || show.webChannel?.country?.code || "").toUpperCase();

  if (genres.includes("anime") || (language === "japanese" && show.type === "Animation")) {
    return "anime";
  }
  if (language === "korean" || country === "KR") return "kdrama";
  if (language === "mandarin" || language === "chinese" || country === "CN" || country === "TW") return "cdrama";
  return "series";
}

const OPEN_LIBRARY_SUBJECT = { manga: "manga", novel: "fiction" };
const EPISODE_CATEGORIES_DISCOVER = ["series", "kdrama", "cdrama", "anime"];
const BOOK_CATEGORIES_DISCOVER = ["manga", "novel"];

function rawgKey() { return state.preferences.metadataSources.builtinApiKeys?.rawg || ""; }
function omdbKey() { return state.preferences.metadataSources.builtinApiKeys?.omdb || ""; }
function tmdbKey() { return state.preferences.metadataSources.builtinApiKeys?.tmdb || ""; }
function rawgAvailable() { return builtinSourceEnabled("rawg") && Boolean(rawgKey()); }
function omdbAvailable() { return builtinSourceEnabled("omdb") && Boolean(omdbKey()); }
function tmdbAvailable() { return builtinSourceEnabled("tmdb") && Boolean(tmdbKey()); }

// Each category maps to a list of {key, suggest, search} providers. `key` must
// match a BUILTIN_METADATA_SOURCES id (metadata.js) so enable/disable + API
// key state stay in one place. `suggest()` returns top-rated picks with no
// query; `search(query)` scopes to typed text. Both return normalized
// {source, category, id, title, subtitle, thumbnail, rating} objects.
function getDiscoverProviders(category) {
  const providers = [];

  if (EPISODE_CATEGORIES_DISCOVER.includes(category)) {
    if (builtinSourceEnabled("tvmaze")) {
      providers.push({
        key: "tvmaze",
        suggest: () => fetchTvmazeTopRated(category),
        search: (q) => searchTvmaze(q, category)
      });
    }
    if (builtinSourceEnabled("anilist")) {
      providers.push({
        key: "anilist",
        suggest: () => fetchAnilistTopRated("ANIME"),
        search: (q) => searchAnilist(q, "ANIME", category)
      });
    }
    if (category === "anime") {
      if (builtinSourceEnabled("jikan")) {
        providers.push({ key: "jikan", suggest: () => fetchJikanTopRated("anime"), search: (q) => searchJikan(q, "anime") });
      }
      if (builtinSourceEnabled("kitsu")) {
        providers.push({ key: "kitsu", suggest: () => fetchKitsuTopRated("anime"), search: (q) => searchKitsu(q, "anime") });
      }
    }
    if (omdbAvailable()) {
      providers.push({ key: "omdb", suggest: () => Promise.resolve([]), search: (q) => searchOmdb(q, category, "series") });
    }
    if (tmdbAvailable()) {
      providers.push({ key: "tmdb", suggest: () => fetchTmdbTopRated("tv", category), search: (q) => searchTmdb(q, "tv", category) });
    }
  }

  if (category === "movie") {
    if (builtinSourceEnabled("wikidata")) {
      providers.push({ key: "wikidata", suggest: fetchWikidataPopularMovies, search: searchWikidataMovies });
    }
    if (omdbAvailable()) {
      providers.push({ key: "omdb", suggest: () => Promise.resolve([]), search: (q) => searchOmdb(q, "movie", "movie") });
    }
    if (tmdbAvailable()) {
      providers.push({ key: "tmdb", suggest: () => fetchTmdbTopRated("movie", "movie"), search: (q) => searchTmdb(q, "movie", "movie") });
    }
  }

  if (BOOK_CATEGORIES_DISCOVER.includes(category)) {
    if (builtinSourceEnabled("openlibrary")) {
      providers.push({
        key: "openlibrary",
        suggest: () => fetchOpenLibraryTopRated(category),
        search: (q) => searchOpenLibrary(q, category)
      });
    }
    if (builtinSourceEnabled("googlebooks")) {
      providers.push({ key: "googlebooks", suggest: () => Promise.resolve([]), search: (q) => searchGoogleBooks(q, category) });
    }
    if (category === "manga") {
      if (builtinSourceEnabled("anilist")) {
        providers.push({ key: "anilist", suggest: () => fetchAnilistTopRated("MANGA"), search: (q) => searchAnilist(q, "MANGA", "manga") });
      }
      if (builtinSourceEnabled("jikan")) {
        providers.push({ key: "jikan", suggest: () => fetchJikanTopRated("manga"), search: (q) => searchJikan(q, "manga") });
      }
      if (builtinSourceEnabled("kitsu")) {
        providers.push({ key: "kitsu", suggest: () => fetchKitsuTopRated("manga"), search: (q) => searchKitsu(q, "manga") });
      }
    }
  }

  if (category === "game") {
    if (rawgAvailable()) {
      providers.push({ key: "rawg", suggest: fetchRawgTopRated, search: searchRawg });
    }
    if (builtinSourceEnabled("wikidata")) {
      providers.push({ key: "wikidata", suggest: () => Promise.resolve([]), search: searchWikidataGames });
    }
  }

  return providers;
}

function updateDiscoverOnlineNotice() {
  const notice = document.getElementById("discover-offline-notice");
  const searchInput = document.getElementById("discover-search-input");
  if (!notice) return;
  const online = discoverIsOnline();
  notice.style.display = online ? "none" : "block";
  if (searchInput) searchInput.disabled = !online;
}

function renderDiscoverCategoryChips() {
  const chipsEl = document.getElementById("discover-category-chips");
  if (!chipsEl) return;

  const enabledCategories = getEnabledOrderedCategories();
  if (enabledCategories.length === 0) {
    chipsEl.style.display = "none";
    chipsEl.innerHTML = "";
    setDiscoverCategory(null);
    return;
  }

  const savedState = loadDiscoverSessionState();
  const preferredCategory = discoverCategory || savedState.category;
  const nextCategory = (preferredCategory && enabledCategories.includes(preferredCategory))
    ? preferredCategory
    : enabledCategories[0];

  chipsEl.style.display = "flex";
  chipsEl.innerHTML = enabledCategories.map(cat => `
    <div class="chip${nextCategory === cat ? " active" : ""}" data-category="${cat}" style="--theme-color:${CATEGORIES[cat].color}">
      <i data-lucide="${CATEGORIES[cat].icon}"></i> ${CATEGORIES[cat].label}
    </div>
  `).join("");

  chipsEl.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => setDiscoverCategory(chip.dataset.category));
  });

  if (window.lucide) lucide.createIcons();

  const preservedQuery = (preferredCategory === nextCategory) ? (savedState.query || "") : "";
  setDiscoverCategory(nextCategory, preservedQuery);
}

function setDiscoverCategory(category, preservedQuery = "") {
  discoverCategory = category;
  saveDiscoverSessionState(category, preservedQuery);
  document.querySelectorAll("#discover-category-chips .chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.category === category);
  });

  const searchInput = document.getElementById("discover-search-input");
  const gameNotice = document.getElementById("discover-game-unavailable");
  const noCategoryNotice = document.getElementById("discover-no-category");

  if (!category) {
    if (searchInput) searchInput.style.display = "none";
    if (noCategoryNotice) noCategoryNotice.style.display = "flex";
    if (gameNotice) gameNotice.style.display = "none";
    clearDiscoverResults();
    return;
  }
  if (noCategoryNotice) noCategoryNotice.style.display = "none";

  const providers = getDiscoverProviders(category);
  if (providers.length === 0) {
    if (searchInput) searchInput.style.display = "none";
    if (gameNotice) gameNotice.style.display = "flex";
    clearDiscoverResults();
    return;
  }
  if (gameNotice) gameNotice.style.display = "none";
  if (searchInput) {
    searchInput.style.display = "block";
    searchInput.value = preservedQuery;
    searchInput.placeholder = `Search ${CATEGORIES[category].label.toLowerCase()}...`;
  }

  if (preservedQuery) {
    runDiscoverSearch(preservedQuery);
  } else {
    loadDiscoverSuggestions(category);
  }
}

function clearDiscoverResults() {
  discoverResults = [];
  const resultsEl = document.getElementById("discover-results");
  const emptyEl = document.getElementById("discover-empty");
  if (resultsEl) resultsEl.innerHTML = "";
  if (emptyEl) emptyEl.style.display = "none";
}

// Dedupe merged multi-source results by normalized title — different sources
// use different id schemes, so title is the only cheap common key.
function dedupeResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = (r.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Top-rated suggestions shown before the user types anything, merged across
// every enabled source for the category. None of these providers expose a
// real "trending" feed for free, so each uses the closest available proxy
// (own rating field, popularity score, or sitelink count for Wikidata).
async function loadDiscoverSuggestions(category) {
  if (!discoverIsOnline()) return;
  const resultsEl = document.getElementById("discover-results");
  const emptyEl = document.getElementById("discover-empty");
  if (!resultsEl || !emptyEl) return;

  const requestId = ++discoverRequestId;

  resultsEl.innerHTML = "";
  emptyEl.style.display = "flex";
  emptyEl.querySelector("h3").textContent = "Loading top picks…";
  emptyEl.querySelector("p").textContent = "";

  const providers = getDiscoverProviders(category);
  const perProvider = await Promise.all(providers.map(p =>
    p.suggest().catch(err => { console.warn(`${p.key} suggestions failed`, err); return []; })
  ));

  if (requestId !== discoverRequestId) return; // a newer category/search superseded this one
  discoverResults = dedupeResults(perProvider.flat()).slice(0, 15);
  renderDiscoverResults();
}

async function runDiscoverSearch(query) {
  if (!discoverCategory) return;
  const providers = getDiscoverProviders(discoverCategory);
  if (providers.length === 0) return;

  const trimmed = query.trim();
  if (!trimmed) {
    loadDiscoverSuggestions(discoverCategory);
    return;
  }
  if (!discoverIsOnline()) return;

  const requestId = ++discoverRequestId;
  const perProvider = await Promise.all(providers.map(p =>
    p.search(trimmed).catch(err => { console.warn(`${p.key} search failed`, err); return []; })
  ));

  if (requestId !== discoverRequestId) return; // a newer category/search superseded this one
  discoverResults = dedupeResults(perProvider.flat());
  renderDiscoverResults();
}

// ---- TVmaze ----
function tvmazeShowToResult(show, category) {
  return {
    source: "tvmaze",
    category,
    id: show.id,
    title: show.name,
    subtitle: [show.premiered ? show.premiered.slice(0, 4) : "", show.type || ""].filter(Boolean).join(" · "),
    thumbnail: show.image?.medium || show.image?.original || "",
    rating: show.rating?.average || null
  };
}

async function fetchTvmazeTopRated(category) {
  const res = await fetch("https://api.tvmaze.com/shows?page=1");
  if (!res.ok) return [];
  const shows = await res.json();
  return (Array.isArray(shows) ? shows : [])
    .filter(show => show.rating?.average && detectTvmazeCategory(show) === category)
    .sort((a, b) => b.rating.average - a.rating.average)
    .slice(0, 15)
    .map(show => tvmazeShowToResult(show, category));
}

async function searchTvmaze(query, category) {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json) ? json : [])
    .map(entry => entry.show)
    .filter(show => show && detectTvmazeCategory(show) === category)
    .map(show => tvmazeShowToResult(show, category));
}

// ---- Wikidata (movies + games) ----
// wbsearchentities never returns images, so results start thumbnail-less and
// get backfilled in one batched wbgetentities call (P18) afterward.
async function attachWikidataThumbnails(results) {
  const ids = results.map(r => r.id).filter(Boolean);
  if (ids.length === 0) return results;
  try {
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&format=json&props=claims&origin=*`);
    if (!res.ok) return results;
    const data = await res.json();
    return results.map(r => {
      const imageFile = data.entities?.[r.id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      return imageFile ? { ...r, thumbnail: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}` } : r;
    });
  } catch (err) {
    console.warn("Could not load Wikidata thumbnails", err);
    return results;
  }
}

async function fetchWikidataPopularMovies() {
  const query = `SELECT ?film ?filmLabel WHERE { ?film wdt:P31 wd:Q11424; wikibase:sitelinks ?sitelinks. FILTER(?sitelinks > 50) SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?sitelinks) LIMIT 15`;
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: "application/sparql-results+json" }
  });
  if (!res.ok) return [];
  const data = await res.json();
  const bindings = data?.results?.bindings || [];
  const results = bindings
    .map(b => {
      const uri = b.film?.value || "";
      const id = uri.split("/").pop();
      const label = b.filmLabel?.value || "";
      if (!id || !label || /^Q\d+$/.test(label)) return null;
      return { source: "wikidata", category: "movie", id, title: label, subtitle: "Movie", thumbnail: "", rating: null };
    })
    .filter(Boolean);
  return attachWikidataThumbnails(results);
}

async function searchWikidataMovies(query) {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=item&limit=15&format=json&origin=*`);
  if (!res.ok) return [];
  const json = await res.json();
  const results = (Array.isArray(json.search) ? json.search : []).map(entry => ({
    source: "wikidata", category: "movie", id: entry.id, title: entry.label || query,
    subtitle: entry.description || "Movie", thumbnail: "", rating: null
  }));
  return attachWikidataThumbnails(results);
}

async function searchWikidataGames(query) {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=item&limit=15&format=json&origin=*`);
  if (!res.ok) return [];
  const json = await res.json();
  const results = (Array.isArray(json.search) ? json.search : []).map(entry => ({
    source: "wikidata", category: "game", id: entry.id, title: entry.label || query,
    subtitle: entry.description || "Game", thumbnail: "", rating: null
  }));
  return attachWikidataThumbnails(results);
}

// ---- Open Library (manga + novel) ----
function openLibraryWorkToResult(doc, category) {
  const key = (doc.key || "").replace("/works/", "");
  if (!key) return null;
  return {
    source: "openlibrary",
    category,
    id: key,
    title: doc.title || "",
    subtitle: [doc.authors?.[0]?.name, doc.first_publish_year ? `First published ${doc.first_publish_year}` : ""].filter(Boolean).join(" · "),
    thumbnail: doc.cover_id ? `https://covers.openlibrary.org/b/id/${doc.cover_id}-M.jpg` : "",
    rating: null
  };
}

async function fetchOpenLibraryTopRated(category) {
  const subject = OPEN_LIBRARY_SUBJECT[category];
  const res = await fetch(`https://openlibrary.org/subjects/${subject}.json?limit=15&sort=rating`);
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data.works) ? data.works : []).map(w => openLibraryWorkToResult(w, category)).filter(Boolean);
}

async function searchOpenLibrary(query, category) {
  const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&fields=key,title,author_name,first_publish_year,cover_i&limit=15`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.docs) ? json.docs : []).slice(0, 15).map(doc => {
    const key = (doc.key || "").replace("/works/", "");
    if (!key) return null;
    return {
      source: "openlibrary", category, id: key, title: doc.title || query,
      subtitle: [doc.author_name?.[0], doc.first_publish_year ? `First published ${doc.first_publish_year}` : ""].filter(Boolean).join(" · "),
      thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
      rating: null
    };
  }).filter(Boolean);
}

// ---- Google Books (novel + manga) ----
async function searchGoogleBooks(query, category) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.items) ? json.items : []).map(item => {
    const info = item.volumeInfo || {};
    return {
      source: "googlebooks",
      category,
      id: item.id,
      title: info.title || query,
      subtitle: [info.authors?.[0], info.publishedDate ? info.publishedDate.slice(0, 4) : ""].filter(Boolean).join(" · "),
      thumbnail: (info.imageLinks?.thumbnail || "").replace("http://", "https://"),
      rating: info.averageRating || null
    };
  });
}

// ---- RAWG (games) ----
function rawgGameToResult(entry) {
  return {
    source: "rawg",
    category: "game",
    id: entry.id,
    title: entry.name || "",
    subtitle: [entry.released ? entry.released.slice(0, 4) : "", entry.rating ? `★ ${entry.rating}` : ""].filter(Boolean).join(" · "),
    thumbnail: entry.background_image || "",
    rating: entry.rating || null
  };
}

async function fetchRawgTopRated() {
  const res = await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey())}&ordering=-rating&page_size=15`);
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data.results) ? data.results : []).map(rawgGameToResult);
}

async function searchRawg(query) {
  const res = await fetch(`https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey())}&search=${encodeURIComponent(query)}&page_size=15`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.results) ? json.results : []).map(rawgGameToResult);
}

// ---- AniList (anime + manga; also used as a supplemental source for
// series/kdrama/cdrama since it covers a lot of Asian drama/animation too) ----
async function anilistQuery(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) return null;
  return res.json();
}

function anilistMediaToResult(media, category) {
  return {
    source: "anilist",
    category,
    id: media.id,
    title: media.title?.english || media.title?.romaji || "",
    subtitle: [media.startDate?.year, media.averageScore ? `★ ${(media.averageScore / 10).toFixed(1)}` : ""].filter(Boolean).join(" · "),
    thumbnail: media.coverImage?.large || media.coverImage?.medium || "",
    rating: media.averageScore ? media.averageScore / 10 : null
  };
}

async function fetchAnilistTopRated(type) {
  const query = `query($type:MediaType){Page(perPage:15){media(type:$type,sort:SCORE_DESC){id title{romaji english} coverImage{large medium} averageScore startDate{year}}}}`;
  const data = await anilistQuery(query, { type });
  const media = data?.data?.Page?.media || [];
  return media.map(m => anilistMediaToResult(m, type === "ANIME" ? "anime" : "manga"));
}

async function searchAnilist(searchTerm, type, category) {
  const query = `query($s:String,$type:MediaType){Page(perPage:15){media(search:$s,type:$type){id title{romaji english} coverImage{large medium} averageScore startDate{year}}}}`;
  const data = await anilistQuery(query, { s: searchTerm, type });
  const media = data?.data?.Page?.media || [];
  return media.map(m => anilistMediaToResult(m, category));
}

// ---- Jikan (MyAnimeList wrapper; anime + manga) ----
function jikanEntryToResult(entry, category) {
  return {
    source: "jikan",
    category,
    id: entry.mal_id,
    title: entry.title || "",
    subtitle: [(entry.aired?.from || entry.published?.from || "").slice(0, 4), entry.score ? `★ ${entry.score}` : ""].filter(Boolean).join(" · "),
    thumbnail: entry.images?.jpg?.image_url || "",
    rating: entry.score || null
  };
}

async function fetchJikanTopRated(kind) {
  const res = await fetch(`https://api.jikan.moe/v4/top/${kind}?limit=15`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.data) ? json.data : []).map(e => jikanEntryToResult(e, kind === "anime" ? "anime" : "manga"));
}

async function searchJikan(query, kind) {
  const res = await fetch(`https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(query)}&limit=15`);
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.data) ? json.data : []).map(e => jikanEntryToResult(e, kind === "anime" ? "anime" : "manga"));
}

// ---- Kitsu (anime + manga) ----
function kitsuEntryToResult(entry, category) {
  const attrs = entry.attributes || {};
  const posterImage = attrs.posterImage || {};
  return {
    source: "kitsu",
    category,
    id: entry.id,
    title: attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp || "",
    subtitle: [attrs.startDate ? attrs.startDate.slice(0, 4) : "", attrs.averageRating ? `★ ${(attrs.averageRating / 10).toFixed(1)}` : ""].filter(Boolean).join(" · "),
    thumbnail: posterImage.small || posterImage.medium || "",
    rating: attrs.averageRating ? attrs.averageRating / 10 : null
  };
}

async function fetchKitsuTopRated(kind) {
  const res = await fetch(`https://kitsu.io/api/edge/${kind}?sort=-averageRating&page[limit]=15`, { headers: { Accept: "application/vnd.api+json" } });
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.data) ? json.data : []).map(e => kitsuEntryToResult(e, kind === "anime" ? "anime" : "manga"));
}

async function searchKitsu(query, kind) {
  const res = await fetch(`https://kitsu.io/api/edge/${kind}?filter[text]=${encodeURIComponent(query)}&page[limit]=15`, { headers: { Accept: "application/vnd.api+json" } });
  if (!res.ok) return [];
  const json = await res.json();
  return (Array.isArray(json.data) ? json.data : []).map(e => kitsuEntryToResult(e, kind === "anime" ? "anime" : "manga"));
}

// ---- OMDb (movies + series; search-only, no keyless "top rated" endpoint) ----
async function searchOmdb(query, category, omdbType) {
  const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&type=${omdbType}&apikey=${encodeURIComponent(omdbKey())}`);
  if (!res.ok) return [];
  const json = await res.json();
  if (json.Response === "False" || !Array.isArray(json.Search)) return [];
  return json.Search.map(entry => ({
    source: "omdb",
    category,
    id: entry.imdbID,
    title: entry.Title || query,
    subtitle: entry.Year || "",
    thumbnail: entry.Poster && entry.Poster !== "N/A" ? entry.Poster : "",
    rating: null
  }));
}

// ---- TMDB (movies + series; richest data, needs a free API key) ----
async function tmdbFetch(path) {
  const res = await fetch(`https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(tmdbKey())}`);
  if (!res.ok) return null;
  return res.json();
}

function tmdbEntryToResult(entry, mediaType, category) {
  const title = mediaType === "tv" ? entry.name : entry.title;
  const date = mediaType === "tv" ? entry.first_air_date : entry.release_date;
  return {
    source: "tmdb",
    category,
    id: entry.id,
    title: title || "",
    subtitle: [date ? date.slice(0, 4) : "", entry.vote_average ? `★ ${entry.vote_average.toFixed(1)}` : ""].filter(Boolean).join(" · "),
    thumbnail: entry.poster_path ? `https://image.tmdb.org/t/p/w342${entry.poster_path}` : "",
    rating: entry.vote_average || null
  };
}

async function fetchTmdbTopRated(mediaType, category) {
  const data = await tmdbFetch(`/${mediaType}/top_rated`);
  const results = data?.results || [];
  return results.slice(0, 15).map(e => tmdbEntryToResult(e, mediaType, category));
}

async function searchTmdb(query, mediaType, category) {
  const data = await tmdbFetch(`/search/${mediaType}?query=${encodeURIComponent(query)}`);
  const results = data?.results || [];
  return results.slice(0, 15).map(e => tmdbEntryToResult(e, mediaType, category));
}

function renderDiscoverResults() {
  const resultsEl = document.getElementById("discover-results");
  const emptyEl = document.getElementById("discover-empty");
  if (!resultsEl || !emptyEl) return;

  if (discoverResults.length === 0) {
    resultsEl.innerHTML = "";
    emptyEl.style.display = "flex";
    emptyEl.querySelector("h3").textContent = "No Results";
    emptyEl.querySelector("p").textContent = "Try a different title or check your spelling.";
    return;
  }

  emptyEl.style.display = "none";
  resultsEl.innerHTML = discoverResults.map((r, index) => `
    <button type="button" class="discover-result-card" data-index="${index}">
      ${thumbnailOrPlaceholder(r.thumbnail, "discover-result-thumb")}
      <div class="discover-result-body">
        <span class="discover-result-title">${r.title}</span>
        <span class="discover-result-subtitle">${r.subtitle || ""}</span>
        ${r.rating ? `<span class="discover-result-rating"><i data-lucide="star"></i> ${r.rating}</span>` : ""}
      </div>
    </button>
  `).join("");

  resultsEl.querySelectorAll(".discover-result-card").forEach(card => {
    card.addEventListener("click", () => {
      const result = discoverResults[parseInt(card.dataset.index, 10)];
      if (!result) return;
      const params = new URLSearchParams({
        source: "online",
        provider: result.source,
        providerId: result.id,
        category: result.category,
        title: result.title
      });
      window.location.href = `show-detail.html?${params.toString()}`;
    });
  });

  if (window.lucide) lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", () => {
  updateDiscoverOnlineNotice();
  window.addEventListener("online", updateDiscoverOnlineNotice);
  window.addEventListener("offline", updateDiscoverOnlineNotice);

  renderDiscoverCategoryChips();

  const searchInput = document.getElementById("discover-search-input");
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener("input", (e) => {
      saveDiscoverSessionState(discoverCategory, e.target.value);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runDiscoverSearch(e.target.value), 400);
    });
  }

  if (window.lucide) lucide.createIcons();
});
