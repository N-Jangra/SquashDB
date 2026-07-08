// SquashDB - Online metadata lookup (TVmaze, Wikidata, Open Library)
// Fetches and applies metadata (thumbnails, seasons/episodes, runtime, etc.) for tracked items.
// Depends on globals from app.js: state, CATEGORIES, thumbnailsEnabled(), applySeriesMetadata(),
// renderSeasonEpisodeFields() (season fields are generic form logic, kept in app.js).

let fetchedMetadataDraft = null;
let metadataSearchState = {
  kind: null,
  items: []
};

async function fetchAndApplyMetadataFromTitle() {
  const category = document.getElementById("entry-category")?.value;
  const title = document.getElementById("entry-title")?.value.trim();
  if (!title || !category || state.preferences.metadataMode !== "online") return;
  if (!["series", "kdrama", "cdrama", "anime", "movie", "game", "manga", "novel"].includes(category)) return;

  const normalized = encodeURIComponent(title);

  try {
    if (category === "series" || category === "kdrama" || category === "cdrama" || category === "anime") {
      const searchRes = await fetch(`https://api.tvmaze.com/search/shows?q=${normalized}`);
      if (!searchRes.ok) return;
      const searchJson = await searchRes.json();
      const items = Array.isArray(searchJson) ? searchJson.slice(0, 8).map(entry => ({
        id: entry.show?.id,
        title: entry.show?.name || title,
        subtitle: [entry.show?.premiered || "", entry.show?.language || ""].filter(Boolean).join(" · "),
        thumbnail: entry.show?.image?.medium || entry.show?.image?.original || "",
        kind: category
      })).filter(item => item.id) : [];
      if (items.length > 1) {
        showMetadataResults(category, items, title);
        return;
      }
      if (!items[0]) return;
      await applySelectedSeriesMetadata(items[0].id, items[0].title);
      return;
    }

    if (category === "movie") {
      const searchRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${normalized}&language=en&type=item&limit=8&format=json&origin=*`);
      if (!searchRes.ok) return;
      const data = await searchRes.json();
      const items = Array.isArray(data.search) ? data.search.map(entry => ({
        id: entry.id,
        title: entry.label || title,
        subtitle: entry.description || "Movie",
        thumbnail: "",
        kind: "movie"
      })) : [];
      if (items.length > 1) {
        showMetadataResults("movie", items, title);
        return;
      }
      if (!items[0]) return;
      await applySelectedMovieMetadata(items[0].id, items[0].title);
      return;
    }

    if (category === "game") {
      const searchRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${normalized}&language=en&type=item&limit=8&format=json&origin=*`);
      if (!searchRes.ok) return;
      const data = await searchRes.json();
      const items = Array.isArray(data.search) ? data.search.map(entry => ({
        id: entry.id,
        title: entry.label || title,
        subtitle: entry.description || "Game",
        thumbnail: "",
        kind: "game"
      })) : [];
      if (items.length > 1) {
        showMetadataResults("game", items, title);
        return;
      }
      if (!items[0]) return;
      await applySelectedGameMetadata(items[0].id, items[0].title);
      return;
    }

    if (category === "manga") {
      const searchRes = await fetch(`https://openlibrary.org/search.json?title=${normalized}`);
      if (!searchRes.ok) return;
      const data = await searchRes.json();
      const items = Array.isArray(data.docs) ? data.docs.slice(0, 8).map(doc => ({
        key: doc.key,
        title: doc.title || title,
        subtitle: [doc.author_name?.[0], doc.first_publish_year ? `First published ${doc.first_publish_year}` : "", doc.edition_count ? `${doc.edition_count} volumes` : ""].filter(Boolean).join(" · "),
        thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
        editionCount: doc.edition_count || 0,
        kind: category
      })).filter(item => item.key) : [];
      if (items.length > 1) {
        showMetadataResults(category, items, title);
        return;
      }
      if (!items[0]) return;
      applyMetadataPreview({
        title: items[0].title,
        meta: items[0].subtitle,
        image: thumbnailsEnabled() ? items[0].thumbnail : ""
      });
      fetchedMetadataDraft = {
        thumbnail: thumbnailsEnabled() ? items[0].thumbnail : ""
      };
      const totalVolumesInput = document.getElementById("field-total-volumes");
      if (totalVolumesInput && !totalVolumesInput.value && items[0].editionCount) {
        totalVolumesInput.value = items[0].editionCount;
      }
      return;
    }

    if (category === "novel") {
      const searchRes = await fetch(`https://openlibrary.org/search.json?title=${normalized}`);
      if (!searchRes.ok) return;
      const data = await searchRes.json();
      const items = Array.isArray(data.docs) ? data.docs.slice(0, 8).map(doc => ({
        key: doc.key,
        title: doc.title || title,
        subtitle: [doc.author_name?.[0], doc.first_publish_year ? `First published ${doc.first_publish_year}` : "", doc.edition_count ? `${doc.edition_count} volumes` : ""].filter(Boolean).join(" · "),
        thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
        editionCount: doc.edition_count || 0,
        kind: category
      })).filter(item => item.key) : [];
      if (items.length > 1) {
        showMetadataResults(category, items, title);
        return;
      }
      if (!items[0]) return;
      applyMetadataPreview({
        title: items[0].title,
        meta: items[0].subtitle,
        image: thumbnailsEnabled() ? items[0].thumbnail : ""
      });
      fetchedMetadataDraft = {
        thumbnail: thumbnailsEnabled() ? items[0].thumbnail : ""
      };
      const totalVolumesInput = document.getElementById("field-total-volumes");
      if (totalVolumesInput && !totalVolumesInput.value && items[0].editionCount) {
        totalVolumesInput.value = items[0].editionCount;
      }
      return;
    }
  } catch (err) {
    console.warn("Metadata lookup failed", err);
  }
}

function applyMetadataPreview({ title, meta, image }) {
  const preview = document.getElementById("metadata-preview");
  const thumb = document.getElementById("metadata-preview-thumb");
  const titleEl = document.getElementById("metadata-preview-title");
  const metaEl = document.getElementById("metadata-preview-meta");
  if (!preview || !thumb || !titleEl || !metaEl) return;

  titleEl.textContent = title || "";
  metaEl.textContent = meta || "";

  if (image && thumbnailsEnabled()) {
    thumb.src = image;
    thumb.alt = title || "Metadata thumbnail";
    thumb.style.display = "block";
  } else {
    thumb.removeAttribute("src");
    thumb.alt = "";
    thumb.style.display = "none";
  }

  preview.style.display = "flex";
}

function showMetadataResults(kind, items, queryTitle) {
  metadataSearchState = { kind, items };
  const box = document.getElementById("metadata-results");
  const list = document.getElementById("metadata-results-list");
  const preview = document.getElementById("metadata-preview");
  const titleEl = document.getElementById("metadata-preview-title");
  const metaEl = document.getElementById("metadata-preview-meta");
  const thumb = document.getElementById("metadata-preview-thumb");
  if (!box || !list) return;

  if (preview) preview.style.display = "none";
  if (titleEl) titleEl.textContent = queryTitle || "";
  if (metaEl) {
    const label = kind === "series" ? "TV Series" : kind === "kdrama" ? "K-Drama" : kind === "cdrama" ? "C-Drama" : kind === "movie" ? "Movie" : kind === "game" ? "Game" : kind === "anime" ? "Anime" : kind === "manga" ? "Manga" : kind === "novel" ? "Novel" : "Metadata";
    metaEl.textContent = items.length ? `${items.length} ${label} matches found` : "";
  }
  if (thumb) {
    thumb.removeAttribute("src");
    thumb.style.display = "none";
  }

  list.innerHTML = "";
  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "metadata-result-item";
    btn.dataset.metadataIndex = String(index);
    btn.innerHTML = `
      ${item.thumbnail ? `<img src="${item.thumbnail}" alt="" class="metadata-result-thumb">` : `<span class="metadata-result-thumb metadata-result-thumb-placeholder"></span>`}
      <span class="metadata-result-copy">
        <span class="metadata-result-title">${item.title}</span>
        <span class="metadata-result-subtitle">${item.subtitle || ""}</span>
      </span>
    `;
    list.appendChild(btn);
  });

  box.style.display = "block";
}

function hideMetadataResults() {
  const box = document.getElementById("metadata-results");
  const list = document.getElementById("metadata-results-list");
  if (box) box.style.display = "none";
  if (list) list.innerHTML = "";
  metadataSearchState = { kind: null, items: [] };
}

async function selectMetadataResult(index) {
  const kind = metadataSearchState.kind;
  const result = metadataSearchState.items[index];
  if (!result) return;
  const selectedThumbnail = result.thumbnail || "";
  hideMetadataResults();
  const category = document.getElementById("entry-category")?.value;
  const titleInput = document.getElementById("entry-title");
  if (titleInput && result.title) {
    titleInput.value = result.title;
  }
  if (kind === "movie") {
    await applySelectedMovieMetadata(result.id, result.title, selectedThumbnail);
  } else if (kind === "series" || kind === "kdrama" || kind === "cdrama" || kind === "anime") {
    await applySelectedSeriesMetadata(result.id, result.title, selectedThumbnail);
  } else if (kind === "game") {
    await applySelectedGameMetadata(result.id, result.title);
  } else if (category === "manga" || category === "novel") {
    applyMetadataPreview({ title: result.title, meta: result.subtitle || "", image: thumbnailsEnabled() ? selectedThumbnail : "" });
    fetchedMetadataDraft = { thumbnail: thumbnailsEnabled() ? selectedThumbnail : "" };
    const totalVolumesInput = document.getElementById("field-total-volumes");
    if (totalVolumesInput && !totalVolumesInput.value && result.editionCount) {
      totalVolumesInput.value = result.editionCount;
    }
  }
}

async function applySelectedSeriesMetadata(showId, title, fallbackThumbnail = "") {
  const showRes = await fetch(`https://api.tvmaze.com/shows/${showId}?embed=episodes`);
  if (!showRes.ok) return;
  const data = await showRes.json();
  const seasons = new Map();
  (data._embedded?.episodes || []).forEach(ep => {
    const seasonNum = parseInt(ep.season) || 0;
    if (!seasonNum) return;
    const current = seasons.get(seasonNum) || { total: 0 };
    current.total += 1;
    seasons.set(seasonNum, current);
  });
  const sortedSeasons = Array.from(seasons.entries()).sort((a, b) => a[0] - b[0]);
  const totalSeasons = sortedSeasons.length;
  const totalEpisodes = sortedSeasons.reduce((sum, [, season]) => sum + season.total, 0);
  const thumbnail = data.image?.medium || data.image?.original || fallbackThumbnail || "";
  applyMetadataPreview({
    title: data.name || title,
    meta: `${totalSeasons} seasons, ${totalEpisodes} episodes`,
    image: thumbnailsEnabled() ? thumbnail : ""
  });
  fetchedMetadataDraft = { thumbnail: thumbnailsEnabled() ? (data.image?.original || data.image?.medium || fallbackThumbnail || "") : "" };
  applySeriesMetadata({ totalSeasons, totalEpisodes, seasons: sortedSeasons.map(([, season]) => season.total) });
}

async function applySelectedMovieMetadata(entityId, title, fallbackThumbnail = "") {
  const entityRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=claims|descriptions|labels&languages=en&origin=*`);
  if (!entityRes.ok) return;
  const data = await entityRes.json();
  const entity = data.entities?.[entityId];
  if (!entity) return;

  const claims = entity.claims || {};
  const runtimeClaim = claims.P2047?.[0]?.mainsnak?.datavalue?.value?.amount;
  const runtime = runtimeClaim ? Math.round(parseFloat(runtimeClaim.replace("+", ""))) : 0;
  const imageFile = claims.P18?.[0]?.mainsnak?.datavalue?.value;
  const thumbnail = imageFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}` : fallbackThumbnail || "";
  const description = entity.descriptions?.en?.value || "Movie metadata found";

  applyMetadataPreview({
    title: entity.labels?.en?.value || title,
    meta: runtime ? `${runtime} min` : description,
    image: thumbnailsEnabled() ? thumbnail : ""
  });
  fetchedMetadataDraft = { thumbnail: thumbnailsEnabled() ? thumbnail : "" };

  const playtimeInput = document.getElementById("field-playtime");
  const playtimeHoursInput = document.getElementById("field-playtime-hours");
  const playtimeMinutesInput = document.getElementById("field-playtime-minutes");
  if (playtimeInput && !playtimeInput.value && runtime) {
    playtimeInput.value = runtime;
    if (playtimeHoursInput) playtimeHoursInput.value = Math.floor(runtime / 60);
    if (playtimeMinutesInput) playtimeMinutesInput.value = runtime % 60;
  }
  const statusSelect = document.getElementById("field-status");
  if (statusSelect && statusSelect.value === "Watchlist") statusSelect.value = "In Progress";
}

async function applySelectedGameMetadata(entityId, title) {
  const entityRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=claims|descriptions|labels&languages=en&origin=*`);
  if (!entityRes.ok) return;
  const data = await entityRes.json();
  const entity = data.entities?.[entityId];
  if (!entity) return;

  const claims = entity.claims || {};
  const imageFile = claims.P18?.[0]?.mainsnak?.datavalue?.value;
  const thumbnail = imageFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}` : "";
  const description = entity.descriptions?.en?.value || "Game metadata found";
  const releaseTime = claims.P577?.[0]?.mainsnak?.datavalue?.value?.time || "";
  const releaseYear = releaseTime ? String(releaseTime).replace(/^\+/, "").slice(0, 4) : "";

  applyMetadataPreview({
    title: entity.labels?.en?.value || title,
    meta: [description, releaseYear ? `Released ${releaseYear}` : ""].filter(Boolean).join(" · "),
    image: thumbnailsEnabled() ? thumbnail : ""
  });
  fetchedMetadataDraft = { thumbnail: thumbnailsEnabled() ? thumbnail : "" };
}

function clearMetadataPreview() {
  const preview = document.getElementById("metadata-preview");
  const thumb = document.getElementById("metadata-preview-thumb");
  const titleEl = document.getElementById("metadata-preview-title");
  const metaEl = document.getElementById("metadata-preview-meta");
  if (preview) preview.style.display = "none";
  if (thumb) {
    thumb.removeAttribute("src");
    thumb.alt = "";
    thumb.style.display = "none";
  }
  if (titleEl) titleEl.textContent = "";
  if (metaEl) metaEl.textContent = "";
}
