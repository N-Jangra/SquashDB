// SquashDB - Show Details: shared detail page for both the Discover (online, not
// yet tracked) flow and the Dashboard (already-tracked local item) flow. Renders
// thumbnail/name/metadata, a season dropdown, and a per-episode list (thumbnail,
// name, air date, runtime, TVmaze rating, watched checkbox).
//
// Ticking any episode (or changing status) for an online result saves it into
// state.items immediately, so it and its progress remain available offline from
// then on. Depends on globals from app.js: state, CATEGORIES, saveData(),
// thumbnailOrPlaceholder(), EPISODE_TRACKED_CATEGORIES.

let showDetailState = {
  mode: null,       // "online" | "local"
  category: null,
  itemId: null,     // set once the item exists locally
  show: null,       // { title, thumbnail, meta, tvmazeShowId }
  episodes: [],     // flat list across all seasons
  seasons: [],      // sorted season numbers
  activeSeason: null,
  watchedEpisodeIds: []
};

function formatRuntimeHM(minutes) {
  const total = Math.round(minutes) || 0;
  if (!total) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function showDetailIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

async function initShowDetail() {
  const params = getUrlParams();
  const source = params.get("source");
  const notice = document.getElementById("show-detail-offline-notice");

  if (source === "local") {
    const itemId = params.get("itemId");
    const item = state.items.find(i => i.id === itemId);
    if (!item) {
      window.location.href = "dashboard.html";
      return;
    }
    showDetailState.mode = "local";
    showDetailState.category = item.category;
    showDetailState.itemId = item.id;
    showDetailState.provider = item.metadataSource || (item.tvmazeShowId ? "tvmaze" : "");
    showDetailState.watchedEpisodeIds = item.watchedEpisodeIds || [];

    if (EPISODE_TRACKED_CATEGORIES.includes(item.category) && item.tvmazeShowId) {
      if (Array.isArray(item.episodesCache) && item.episodesCache.length) {
        applyEpisodesToState(item.episodesCache, item);
      }
      if (showDetailIsOnline()) {
        try {
          await fetchAndCacheEpisodes(item.tvmazeShowId, item);
        } catch (err) {
          console.warn("Could not refresh episode list", err);
        }
      } else if (notice) {
        notice.style.display = "block";
      }
    }

    const runtimeMinutes = item.episodeRuntime || item.playtime || 0;
    renderShowDetailHeader({
      title: item.title,
      thumbnail: item.thumbnail || "",
      meta: [CATEGORIES[item.category]?.label || "", runtimeMinutes ? `~${formatRuntimeHM(runtimeMinutes)}${EPISODE_TRACKED_CATEGORIES.includes(item.category) ? "/ep" : ""}` : "", item.network || ""].filter(Boolean).join(" · "),
      summary: item.summary || "",
      productionStatus: item.productionStatus || ""
    });
    renderStatusPicker(item);
    renderAddToListPicker();
    renderSeasonSection();
    renderBookProgressSection(item);
    renderRatingWidget(item);
    renderNotesField(item);
    return;
  }

  // Online, not-yet-tracked flow (from Discover)
  showDetailState.mode = "online";
  const category = params.get("category") || "series";
  const provider = params.get("provider");
  const providerId = params.get("providerId");
  const title = params.get("title") || "";
  showDetailState.category = category;
  showDetailState.provider = provider;

  if (!showDetailIsOnline()) {
    renderShowDetailHeader({ title, thumbnail: "", meta: "Offline — can't load details for a new title." });
    if (notice) notice.style.display = "block";
    return;
  }

  if (provider === "tvmaze") {
    try {
      const res = await fetch(`https://api.tvmaze.com/shows/${providerId}`);
      if (!res.ok) {
        console.warn(`TVmaze show fetch failed: ${res.status} ${res.statusText}`);
        renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load show details." });
        return;
      }
      const show = await res.json();
      const runtime = show ? Math.round(show.averageRuntime || show.runtime || 0) : 0;
      const genres = (show?.genres || []).slice(0, 3);
      const network = show?.webChannel?.name || show?.network?.name || "";
      showDetailState.show = {
        title: show?.name || title,
        thumbnail: show?.image?.original || show?.image?.medium || "",
        meta: [show?.premiered ? show.premiered.slice(0, 4) : "", genres.join(", "), runtime ? `~${formatRuntimeHM(runtime)}/ep` : "", network].filter(Boolean).join(" · "),
        summary: stripHtml(show?.summary || ""),
        tvmazeShowId: providerId,
        episodeRuntime: runtime,
        network,
        genres,
        productionStatus: show?.status || ""
      };
      renderShowDetailHeader(showDetailState.show);
      renderStatusPicker(null);
      renderAddToListPicker();
      await fetchAndCacheEpisodes(providerId, null);
      renderSeasonSection();
      renderRatingWidget(null);
      renderNotesField(null);
    } catch (err) {
      console.warn("Could not load show details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load show details." });
    }
  } else if (provider === "wikidata") {
    // Movies have no episode list — just show basic metadata and let status changes save it.
    try {
      const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${providerId}&format=json&props=claims|descriptions|labels|sitelinks&sitefilter=enwiki&languages=en&origin=*`);
      const data = res.ok ? await res.json() : null;
      const entity = data?.entities?.[providerId];
      const claims = entity?.claims || {};
      const runtimeClaim = claims.P2047?.[0]?.mainsnak?.datavalue?.value?.amount;
      const runtime = runtimeClaim ? Math.round(parseFloat(runtimeClaim.replace("+", ""))) : 0;
      const imageFile = claims.P18?.[0]?.mainsnak?.datavalue?.value;
      const thumbnail = imageFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}` : "";
      const releaseDate = claims.P577?.[0]?.mainsnak?.datavalue?.value?.time;
      const releaseYear = releaseDate ? releaseDate.slice(1, 5) : "";
      const genreIds = (claims.P136 || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, 3);
      let genres = [];
      if (genreIds.length) {
        try {
          const genreRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${genreIds.join("|")}&format=json&props=labels&languages=en&origin=*`);
          if (genreRes.ok) {
            const genreData = await genreRes.json();
            genres = genreIds.map(id => genreData.entities?.[id]?.labels?.en?.value).filter(Boolean);
          }
        } catch (err) {
          console.warn("Could not load genre labels", err);
        }
      }
      const genreLabel = genres.join(", ");
      const wikiTitle = entity?.sitelinks?.enwiki?.title;
      let summary = entity?.descriptions?.en?.value || "";
      if (wikiTitle) {
        try {
          const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`);
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            if (summaryData.extract) summary = summaryData.extract;
          }
        } catch (err) {
          console.warn("Could not load Wikipedia summary", err);
        }
      }
      showDetailState.show = {
        title: entity?.labels?.en?.value || title,
        thumbnail,
        meta: [releaseYear, genreLabel, runtime ? formatRuntimeHM(runtime) : ""].filter(Boolean).join(" · "),
        summary,
        playtime: runtime,
        genres
      };
      renderShowDetailHeader(showDetailState.show);
      renderStatusPicker(null);
      renderAddToListPicker();
      renderRatingWidget(null);
      renderNotesField(null);
    } catch (err) {
      console.warn("Could not load movie details", err);
    }
  } else if (provider === "openlibrary") {
    // Manga/Novel: Open Library has no episode-style unit, just volume/chapter
    // progress fields (see renderBookProgressSection).
    try {
      const res = await fetch(`https://openlibrary.org/works/${providerId}.json`);
      const work = res.ok ? await res.json() : null;
      const rawDescription = work?.description;
      const summary = typeof rawDescription === "string" ? rawDescription : (rawDescription?.value || "");
      const coverId = work?.covers?.find(id => id > 0);
      const thumbnail = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : "";
      const publishYear = work?.first_publish_date ? work.first_publish_date.slice(0, 4) : "";
      showDetailState.show = {
        title: work?.title || title,
        thumbnail,
        meta: [publishYear].filter(Boolean).join(" · "),
        summary
      };
      renderShowDetailHeader(showDetailState.show);
      renderStatusPicker(null);
      renderAddToListPicker();
      renderBookProgressSection(null);
      renderRatingWidget(null);
      renderNotesField(null);
    } catch (err) {
      console.warn("Could not load book details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load book details." });
    }
  } else if (provider === "rawg") {
    try {
      const rawgKey = state.preferences.metadataSources.builtinApiKeys?.rawg || "";
      const res = await fetch(`https://api.rawg.io/api/games/${providerId}?key=${encodeURIComponent(rawgKey)}`);
      const game = res.ok ? await res.json() : null;
      const genres = (game?.genres || []).map(g => g.name).slice(0, 3);
      const releaseYear = game?.released ? game.released.slice(0, 4) : "";
      showDetailState.show = {
        title: game?.name || title,
        thumbnail: game?.background_image || "",
        meta: [releaseYear, genres.join(", "), game?.metacritic ? `Metacritic ${game.metacritic}` : ""].filter(Boolean).join(" · "),
        summary: game?.description_raw || "",
        genres
      };
      renderShowDetailHeader(showDetailState.show);
      renderStatusPicker(null);
      renderAddToListPicker();
      renderRatingWidget(null);
      renderNotesField(null);
    } catch (err) {
      console.warn("Could not load game details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load game details." });
    }
  } else if (provider === "anilist") {
    try {
      const isManga = category === "manga";
      const query = `query($id:Int){Media(id:$id){title{romaji english} coverImage{large} description(asHtml:false) genres startDate{year} status episodes chapters volumes}}`;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { id: parseInt(providerId, 10) } })
      });
      const data = res.ok ? await res.json() : null;
      const media = data?.data?.Media;
      const genres = (media?.genres || []).slice(0, 3);
      const unitLabel = isManga ? (media?.chapters ? `${media.chapters} chapters` : "") : (media?.episodes ? `${media.episodes} episodes` : "");
      showDetailState.show = {
        title: media?.title?.english || media?.title?.romaji || title,
        thumbnail: media?.coverImage?.large || "",
        meta: [media?.startDate?.year, genres.join(", "), unitLabel, media?.status || ""].filter(Boolean).join(" · "),
        summary: stripHtml(media?.description || ""),
        genres
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load AniList details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else if (provider === "jikan") {
    try {
      const isManga = category === "manga";
      const res = await fetch(`https://api.jikan.moe/v4/${isManga ? "manga" : "anime"}/${providerId}`);
      const data = res.ok ? await res.json() : null;
      const entry = data?.data;
      const genres = (entry?.genres || []).map(g => g.name).slice(0, 3);
      const year = (entry?.aired?.from || entry?.published?.from || "").slice(0, 4);
      const unitLabel = isManga ? (entry?.chapters ? `${entry.chapters} chapters` : "") : (entry?.episodes ? `${entry.episodes} episodes` : "");
      showDetailState.show = {
        title: entry?.title || title,
        thumbnail: entry?.images?.jpg?.large_image_url || entry?.images?.jpg?.image_url || "",
        meta: [year, genres.join(", "), unitLabel, entry?.score ? `★ ${entry.score}` : ""].filter(Boolean).join(" · "),
        summary: entry?.synopsis || "",
        genres
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load Jikan details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else if (provider === "kitsu") {
    try {
      const isManga = category === "manga";
      const res = await fetch(`https://kitsu.io/api/edge/${isManga ? "manga" : "anime"}/${providerId}`, { headers: { Accept: "application/vnd.api+json" } });
      const data = res.ok ? await res.json() : null;
      const attrs = data?.data?.attributes;
      const unitLabel = isManga ? (attrs?.chapterCount ? `${attrs.chapterCount} chapters` : "") : (attrs?.episodeCount ? `${attrs.episodeCount} episodes` : "");
      showDetailState.show = {
        title: attrs?.canonicalTitle || attrs?.titles?.en || title,
        thumbnail: attrs?.posterImage?.large || attrs?.posterImage?.medium || "",
        meta: [attrs?.startDate ? attrs.startDate.slice(0, 4) : "", unitLabel, attrs?.averageRating ? `★ ${(attrs.averageRating / 10).toFixed(1)}` : ""].filter(Boolean).join(" · "),
        summary: attrs?.synopsis || attrs?.description || ""
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load Kitsu details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else if (provider === "googlebooks") {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${providerId}`);
      const data = res.ok ? await res.json() : null;
      const info = data?.volumeInfo;
      showDetailState.show = {
        title: info?.title || title,
        thumbnail: (info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail || "").replace("http://", "https://"),
        meta: [info?.publishedDate ? info.publishedDate.slice(0, 4) : "", info?.authors?.[0] || "", info?.pageCount ? `${info.pageCount} pages` : ""].filter(Boolean).join(" · "),
        summary: info?.description || "",
        genres: (info?.categories || []).slice(0, 3)
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load Google Books details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else if (provider === "omdb") {
    try {
      const omdbKey = state.preferences.metadataSources.builtinApiKeys?.omdb || "";
      const res = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(providerId)}&plot=full&apikey=${encodeURIComponent(omdbKey)}`);
      const data = res.ok ? await res.json() : null;
      const genres = (data?.Genre || "").split(",").map(g => g.trim()).filter(Boolean).slice(0, 3);
      showDetailState.show = {
        title: data?.Title || title,
        thumbnail: data?.Poster && data.Poster !== "N/A" ? data.Poster : "",
        meta: [data?.Year, genres.join(", "), data?.Runtime && data.Runtime !== "N/A" ? data.Runtime : "", data?.imdbRating && data.imdbRating !== "N/A" ? `IMDb ${data.imdbRating}` : ""].filter(Boolean).join(" · "),
        summary: data?.Plot && data.Plot !== "N/A" ? data.Plot : "",
        genres
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load OMDb details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else if (provider === "tmdb") {
    try {
      const tmdbKey = state.preferences.metadataSources.builtinApiKeys?.tmdb || "";
      const mediaType = EPISODE_TRACKED_CATEGORIES.includes(category) ? "tv" : "movie";
      const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${providerId}?api_key=${encodeURIComponent(tmdbKey)}`);
      const data = res.ok ? await res.json() : null;
      const genres = (data?.genres || []).map(g => g.name).slice(0, 3);
      const releaseDate = mediaType === "tv" ? data?.first_air_date : data?.release_date;
      const runtime = mediaType === "tv" ? (data?.episode_run_time?.[0] || 0) : (data?.runtime || 0);
      showDetailState.show = {
        title: (mediaType === "tv" ? data?.name : data?.title) || title,
        thumbnail: data?.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
        meta: [releaseDate ? releaseDate.slice(0, 4) : "", genres.join(", "), runtime ? formatRuntimeHM(runtime) : "", data?.vote_average ? `★ ${data.vote_average.toFixed(1)}` : ""].filter(Boolean).join(" · "),
        summary: data?.overview || "",
        genres
      };
      renderSimpleShowDetail();
    } catch (err) {
      console.warn("Could not load TMDB details", err);
      renderShowDetailHeader({ title, thumbnail: "", meta: "Failed to load details." });
    }
  } else {
    renderShowDetailHeader({ title, thumbnail: "", meta: "Missing show information." });
  }
}

async function fetchAndCacheEpisodes(tvmazeShowId, existingItem) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeShowId}/episodes`);
    if (!res.ok) {
      console.warn(`TVmaze episodes fetch failed: ${res.status} ${res.statusText}`);
      return;
    }
    const episodes = await res.json();
    applyEpisodesToState(episodes, existingItem);

    // Keep the local cache fresh so it still works next time we're offline.
    if (existingItem) {
      const itemIndex = state.items.findIndex(i => i.id === existingItem.id);
      if (itemIndex !== -1) {
        state.items[itemIndex].episodesCache = episodes;
        saveData();
      }
    } else {
      showDetailState.pendingEpisodesCache = episodes;
    }
  } catch (err) {
    console.warn("Error fetching episodes:", err);
  }
}

function applyEpisodesToState(episodes, existingItem) {
  showDetailState.episodes = episodes;
  const seasonSet = new Set(episodes.map(ep => parseInt(ep.season) || 0).filter(Boolean));
  showDetailState.seasons = Array.from(seasonSet).sort((a, b) => a - b);
  if (showDetailState.activeSeason === null || !showDetailState.seasons.includes(showDetailState.activeSeason)) {
    showDetailState.activeSeason = showDetailState.seasons[0] || null;
  }
  if (existingItem) {
    showDetailState.watchedEpisodeIds = existingItem.watchedEpisodeIds || [];
  }
}

// Shared render for providers with no episode/season feed — just header +
// status/list/rating/notes, and book-progress fields when the category calls
// for them (manga/novel from AniList/Jikan/Kitsu/Google Books).
function renderSimpleShowDetail() {
  renderShowDetailHeader(showDetailState.show);
  renderStatusPicker(null);
  renderAddToListPicker();
  if (BOOK_TRACKED_CATEGORIES.includes(showDetailState.category)) {
    renderBookProgressSection(null);
  }
  renderRatingWidget(null);
  renderNotesField(null);
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function renderShowDetailHeader(show) {
  document.getElementById("show-detail-topbar-title").textContent = show.title || "";
  document.getElementById("show-detail-meta").textContent = show.meta || "";
  document.getElementById("show-detail-thumb-wrap").innerHTML =
    thumbnailOrPlaceholder(show.thumbnail, "show-detail-thumb");

  const summaryEl = document.getElementById("show-detail-summary");
  if (summaryEl) {
    if (show.summary) {
      summaryEl.textContent = show.summary;
      summaryEl.style.display = "block";
    } else {
      summaryEl.textContent = "";
      summaryEl.style.display = "none";
    }
  }

  const badgeEl = document.getElementById("show-detail-production-badge");
  if (badgeEl) {
    if (show.productionStatus) {
      badgeEl.textContent = show.productionStatus;
      badgeEl.className = `show-detail-production-badge show-detail-production-badge-${productionStatusSlug(show.productionStatus)}`;
      badgeEl.style.display = "inline-block";
    } else {
      badgeEl.textContent = "";
      badgeEl.style.display = "none";
    }
  }

  const sourceBadgeEl = document.getElementById("show-detail-source-badge");
  if (sourceBadgeEl) {
    const key = showDetailState.provider;
    const sourceName = key ? ((typeof BUILTIN_METADATA_SOURCES !== "undefined" && BUILTIN_METADATA_SOURCES[key]?.name) || key) : "";
    if (sourceName) {
      sourceBadgeEl.textContent = sourceName;
      sourceBadgeEl.style.display = "inline-block";
    } else {
      sourceBadgeEl.textContent = "";
      sourceBadgeEl.style.display = "none";
    }
  }

  if (window.lucide) lucide.createIcons();
}

function productionStatusSlug(status) {
  const normalized = status.toLowerCase();
  if (normalized === "running") return "running";
  if (normalized === "ended") return "ended";
  if (normalized === "in development") return "development";
  return "unknown";
}

function renderAddToListPicker() {
  const group = document.getElementById("show-detail-addlist-group");
  const select = document.getElementById("show-detail-addlist");
  if (!group || !select) return;

  const enabledCategories = getEnabledOrderedCategories();
  const options = enabledCategories.includes(showDetailState.category)
    ? enabledCategories
    : [showDetailState.category, ...enabledCategories].filter(Boolean);
  select.innerHTML = `<option value="">Select a list…</option>` +
    options.map(cat => `<option value="${cat}">${CATEGORIES[cat].label}</option>`).join("");
  select.value = showDetailState.category || "";
  group.style.display = "block";

  select.onchange = () => {
    const cat = select.value;
    if (!cat || !CATEGORIES[cat]) return;
    showDetailState.category = cat;
    ensureLocalItem({ category: cat });
    renderStatusPicker(state.items.find(i => i.id === showDetailState.itemId));
    renderAddToListPicker();
    renderSeasonSection();
  };
}

function renderRatingWidget(existingItem) {
  const group = document.getElementById("show-detail-rating-group");
  const container = document.getElementById("show-detail-rating-widget");
  if (!group || !container) return;

  group.style.display = "block";
  const currentRating = existingItem?.rating || 0;
  const format = state.preferences.ratingFormat || "5-stars";

  const save = (rating) => {
    ensureLocalItem({ rating });
  };

  if (format === "5-stars") {
    container.innerHTML = `<div class="rating-container" id="show-detail-stars-picker">` +
      [1, 2, 3, 4, 5].map(i => `<i class="star${i <= currentRating ? " active" : ""}" style="fill:${i <= currentRating ? "currentColor" : "none"}" data-rating="${i}" data-lucide="star"></i>`).join("") +
      `</div>`;
    if (window.lucide) lucide.createIcons();
    container.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const val = parseInt(star.getAttribute("data-rating"), 10);
        save(val);
        renderRatingWidget(state.items.find(i => i.id === showDetailState.itemId) || { rating: val });
      });
    });
  } else {
    const maxRating = format === "100-points" ? 100 : 10;
    const step = format === "10-decimal" ? "0.1" : "1";
    const displayValue = format === "100-points" ? Math.round(currentRating * 20) : Math.round(currentRating * 2);
    container.innerHTML = `<input type="number" id="show-detail-rating-score" class="form-control" min="0" max="${maxRating}" step="${step}" value="${displayValue || ""}">`;
    const input = document.getElementById("show-detail-rating-score");
    input.addEventListener("change", () => {
      save(ratingToStoredValue(input.value));
    });
  }
}

function renderNotesField(existingItem) {
  const group = document.getElementById("show-detail-notes-group");
  const textarea = document.getElementById("show-detail-notes");
  if (!group || !textarea) return;

  group.style.display = "block";
  textarea.value = existingItem?.notes || "";
  textarea.onchange = () => {
    ensureLocalItem({ notes: textarea.value });
  };
}

function renderStatusPicker(existingItem) {
  const group = document.getElementById("show-detail-status-group");
  const select = document.getElementById("show-detail-status");
  if (!group || !select) return;

  const category = showDetailState.category;
  const config = CATEGORIES[category];
  if (!config) return;

  select.innerHTML = config.statuses.map(st => `<option value="${st}">${st}</option>`).join("");
  select.value = existingItem?.status || config.statuses[0];
  group.style.display = "block";

  renderCompletionDatePicker(existingItem, select.value);

  select.onchange = () => {
    renderCompletionDatePicker(existingItem, select.value);
    const compDateInput = document.getElementById("show-detail-compdate");
    ensureLocalItem({ status: select.value, completionDate: compDateInput ? compDateInput.value : (existingItem?.completionDate || "") });
  };
}

function renderCompletionDatePicker(existingItem, status) {
  const group = document.getElementById("show-detail-compdate-group");
  const input = document.getElementById("show-detail-compdate");
  if (!group || !input) return;

  if (status !== "Completed") {
    group.style.display = "none";
    return;
  }

  group.style.display = "block";
  if (!input.value) {
    input.value = existingItem?.completionDate || new Date().toISOString().split("T")[0];
  }

  input.onchange = () => {
    ensureLocalItem({ completionDate: input.value });
  };
}

function renderSeasonSection() {
  const section = document.getElementById("show-detail-season-section");
  const seasonSelect = document.getElementById("show-detail-season-select");
  if (!section || !seasonSelect) return;

  if (!EPISODE_TRACKED_CATEGORIES.includes(showDetailState.category) || showDetailState.seasons.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  seasonSelect.innerHTML = showDetailState.seasons.map(s => `<option value="${s}">Season ${s}</option>`).join("");
  seasonSelect.value = showDetailState.activeSeason;
  seasonSelect.onchange = () => {
    showDetailState.activeSeason = parseInt(seasonSelect.value, 10);
    renderEpisodeList();
  };

  renderEpisodeList();
}

function renderEpisodeList() {
  const list = document.getElementById("show-detail-episode-list");
  if (!list) return;

  const episodes = showDetailState.episodes.filter(ep => (parseInt(ep.season) || 0) === showDetailState.activeSeason);
  const watchedSet = new Set(showDetailState.watchedEpisodeIds);

  list.innerHTML = episodes.map(ep => {
    const summary = stripHtml(ep.summary || "");
    return `
    <div class="show-detail-episode-row" data-episode-id="${ep.id}">
      <div class="show-detail-episode-row-main">
        ${thumbnailOrPlaceholder(ep.image?.medium || ep.image?.original || "", "show-detail-episode-thumb")}
        <div class="show-detail-episode-body">
          <span class="show-detail-episode-title">${ep.number}. ${ep.name || "Untitled"}</span>
          <span class="show-detail-episode-meta">
            ${ep.airdate ? `<span><i data-lucide="calendar"></i> ${ep.airdate}</span>` : ""}
            ${ep.runtime ? `<span><i data-lucide="clock"></i> ${ep.runtime}m</span>` : ""}
            ${ep.rating?.average ? `<span><i data-lucide="star"></i> ${ep.rating.average}</span>` : ""}
          </span>
        </div>
        <input type="checkbox" class="show-detail-episode-checkbox" data-episode-id="${ep.id}" ${watchedSet.has(ep.id) ? "checked" : ""}>
      </div>
      ${summary ? `<p class="show-detail-episode-summary">${summary}</p>` : ""}
    </div>
  `;
  }).join("");

  list.querySelectorAll(".show-detail-episode-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const epId = parseInt(checkbox.dataset.episodeId, 10);
      toggleEpisodeWatched(epId, checkbox.checked);
    });
  });

  if (window.lucide) lucide.createIcons();
}

const BOOK_TRACKED_CATEGORIES = ["manga", "novel"];

function renderBookProgressSection(existingItem) {
  const section = document.getElementById("show-detail-book-progress-section");
  const chaptersRow = document.getElementById("show-detail-chapters-row");
  const minPerChapterGroup = document.getElementById("show-detail-min-per-chapter-group");
  if (!section || !chaptersRow || !minPerChapterGroup) return;

  if (!BOOK_TRACKED_CATEGORIES.includes(showDetailState.category)) {
    section.style.display = "none";
    return;
  }

  section.style.display = "flex";
  const isNovel = showDetailState.category === "novel";
  chaptersRow.style.display = isNovel ? "flex" : "none";
  minPerChapterGroup.style.display = isNovel ? "block" : "none";

  const totalVolumesInput = document.getElementById("show-detail-total-volumes");
  const volumesReadInput = document.getElementById("show-detail-volumes-read");
  const totalChaptersInput = document.getElementById("show-detail-total-chapters");
  const chaptersReadInput = document.getElementById("show-detail-chapters-read");
  const minPerChapterInput = document.getElementById("show-detail-min-per-chapter");

  totalVolumesInput.value = existingItem?.totalVolumes || "";
  volumesReadInput.value = existingItem?.volumesRead || 0;
  totalChaptersInput.value = existingItem?.totalChapters || "";
  chaptersReadInput.value = existingItem?.chaptersRead || 0;
  minPerChapterInput.value = existingItem?.minutesPerChapter || 15;

  const save = () => {
    ensureLocalItem({
      totalVolumes: parseInt(totalVolumesInput.value) || 0,
      volumesRead: parseInt(volumesReadInput.value) || 0,
      totalChapters: parseInt(totalChaptersInput.value) || 0,
      chaptersRead: parseInt(chaptersReadInput.value) || 0,
      minutesPerChapter: parseInt(minPerChapterInput.value) || 15
    });
  };

  [totalVolumesInput, volumesReadInput, totalChaptersInput, chaptersReadInput, minPerChapterInput].forEach(input => {
    input.onchange = save;
  });
}

function toggleEpisodeWatched(episodeId, watched) {
  const set = new Set(showDetailState.watchedEpisodeIds);
  const newlyWatchedIds = [];
  if (watched) {
    set.add(episodeId);
    newlyWatchedIds.push(episodeId);
    const sorted = [...showDetailState.episodes].sort((a, b) => {
      const seasonDiff = (parseInt(a.season) || 0) - (parseInt(b.season) || 0);
      return seasonDiff !== 0 ? seasonDiff : (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
    });
    const tickedIndex = sorted.findIndex(ep => ep.id === episodeId);
    if (tickedIndex !== -1) {
      sorted.slice(0, tickedIndex).forEach(ep => {
        if (!set.has(ep.id)) newlyWatchedIds.push(ep.id);
        set.add(ep.id);
      });
    }
  } else {
    set.delete(episodeId);
  }
  showDetailState.watchedEpisodeIds = Array.from(set);

  const totalEpisodes = showDetailState.episodes.length;
  const episodesDone = showDetailState.watchedEpisodeIds.length;
  const totalSeasons = showDetailState.seasons.length;

  renderEpisodeList();

  if (newlyWatchedIds.length) {
    logEpisodeWatches(newlyWatchedIds);
  }

  ensureLocalItem({
    watchedEpisodeIds: showDetailState.watchedEpisodeIds,
    episodesDone,
    totalEpisodes,
    totalSeasons
  });
}

// Appends a watch-event entry per newly-ticked episode so Statistics can build
// weekly time-series charts and detect same-day marathons. Only forward-looking
// from when this shipped — episodes ticked before this existed have no entry.
function logEpisodeWatches(episodeIds) {
  if (!Array.isArray(state.watchLog)) state.watchLog = [];
  const item = state.items.find(i => i.id === showDetailState.itemId);
  const runtime = item?.episodeRuntime || showDetailState.show?.episodeRuntime || 0;
  const itemId = showDetailState.itemId;
  const title = item?.title || showDetailState.show?.title || "";
  const now = Date.now();
  episodeIds.forEach(episodeId => {
    state.watchLog.push({ itemId, title, episodeId, runtime, watchedAt: now });
  });
}

// Creates the local tracked item on first interaction (status change or episode
// tick) for an online result, or updates the existing local item otherwise. This
// is the point where an online-only browse becomes a locally-stored, offline-
// available tracked entry.
function ensureLocalItem(extraFields) {
  if (showDetailState.mode === "local" && showDetailState.itemId) {
    const itemIndex = state.items.findIndex(i => i.id === showDetailState.itemId);
    if (itemIndex !== -1) {
      state.items[itemIndex] = { ...state.items[itemIndex], ...extraFields };
      saveData();
    }
    return;
  }

  // First time this online result is being tracked — create it now.
  const show = showDetailState.show || {};
  const category = showDetailState.category;
  const config = CATEGORIES[category];
  const newItem = {
    id: crypto.randomUUID(),
    title: show.title || "",
    category,
    status: config ? config.statuses[0] : "Backlog",
    rating: 0,
    completionDate: "",
    notes: "",
    created: Date.now(),
    thumbnail: thumbnailsEnabled() ? (show.thumbnail || "") : "",
    summary: show.summary || "",
    network: show.network || "",
    genres: show.genres || [],
    metadataSource: showDetailState.provider || "",
    productionStatus: show.productionStatus || "",
    tvmazeShowId: show.tvmazeShowId || null,
    episodeRuntime: show.episodeRuntime || "",
    playtime: show.playtime || "",
    episodesCache: showDetailState.pendingEpisodesCache || [],
    ...extraFields
  };
  state.items.push(newItem);
  saveData();

  showDetailState.mode = "local";
  showDetailState.itemId = newItem.id;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("show-detail-topbar-title")) {
    const waitForState = () => {
      if (typeof state === "undefined") {
        setTimeout(waitForState, 10);
      } else {
        initShowDetail();
      }
    };
    waitForState();
  }
});
