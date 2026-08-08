const STOP_MS = Number(new URLSearchParams(location.search).get("speed") === "fast" ? 7000 : 15500);
const LIVE_ENABLED = new URLSearchParams(location.search).get("live") !== "0";

const REGIONS = [
  {
    name: "Seattle / Pacific Northwest",
    short: "Seattle",
    mode: "LOCAL DESK",
    lat: 47.6062,
    lon: -122.3321,
    zoom: 6,
    query: '(Seattle OR "Pacific Northwest" OR Washington OR Oregon)',
  },
  {
    name: "North America",
    short: "North America",
    mode: "AMERICAS",
    lat: 39.6,
    lon: -98.5,
    zoom: 4,
    query: '("United States" OR Canada OR Mexico)',
  },
  {
    name: "Western Europe",
    short: "Europe",
    mode: "EUROPE DESK",
    lat: 50.1,
    lon: 4.4,
    zoom: 5,
    query: '(Europe OR France OR Germany OR Britain OR Spain OR Italy)',
  },
  {
    name: "Eastern Europe",
    short: "Eastern Europe",
    mode: "CONFLICT WATCH",
    lat: 49.0,
    lon: 31.0,
    zoom: 5,
    query: '(Ukraine OR Russia OR Poland OR Belarus OR Moldova)',
  },
  {
    name: "Middle East",
    short: "Middle East",
    mode: "REGIONAL WATCH",
    lat: 31.4,
    lon: 38.6,
    zoom: 5,
    query: '("Middle East" OR Israel OR Gaza OR Iran OR Syria OR Lebanon OR Yemen)',
  },
  {
    name: "South Asia",
    short: "South Asia",
    mode: "ASIA DESK",
    lat: 22.6,
    lon: 78.9,
    zoom: 5,
    query: '(India OR Pakistan OR Bangladesh OR Sri Lanka)',
  },
  {
    name: "East Asia",
    short: "East Asia",
    mode: "PACIFIC DESK",
    lat: 35.7,
    lon: 122.8,
    zoom: 5,
    query: '(China OR Japan OR Korea OR Taiwan)',
  },
  {
    name: "Southeast Asia",
    short: "Southeast Asia",
    mode: "PACIFIC DESK",
    lat: 9.8,
    lon: 106.8,
    zoom: 5,
    query: '("Southeast Asia" OR Indonesia OR Philippines OR Vietnam OR Thailand)',
  },
  {
    name: "Africa",
    short: "Africa",
    mode: "AFRICA DESK",
    lat: 1.2,
    lon: 20.8,
    zoom: 4,
    query: '(Africa OR Nigeria OR Kenya OR Ethiopia OR Sudan OR "South Africa")',
  },
  {
    name: "South America",
    short: "South America",
    mode: "AMERICAS",
    lat: -15.8,
    lon: -60.2,
    zoom: 4,
    query: '("South America" OR Brazil OR Argentina OR Chile OR Colombia OR Peru)',
  },
  {
    name: "Australia / Oceania",
    short: "Oceania",
    mode: "OCEANIA",
    lat: -25.3,
    lon: 134.5,
    zoom: 4,
    query: '(Australia OR "New Zealand" OR Pacific)',
  },
];

const FALLBACK_STORIES = {
  "Seattle / Pacific Northwest": [
    fallback("Seattle arts groups prepare weekend showcases across the city", "LOCAL CULTURE", "JMO Curated", "culture"),
    fallback("Regional transit and waterfront work shape downtown travel patterns", "CIVIC", "JMO Curated", "infrastructure"),
    fallback("Pacific Northwest crews monitor wildfire and smoke conditions", "WEATHER IMPACT", "JMO Curated", "climate"),
  ],
  "North America": [
    fallback("North American leaders face pressure on trade, energy, and border policy", "POLITICS", "JMO Curated", "politics"),
    fallback("Markets watch inflation, jobs data, and central bank guidance", "ECONOMY", "JMO Curated", "markets"),
    fallback("Severe weather risks keep emergency managers on alert", "CLIMATE", "JMO Curated", "climate"),
  ],
  "Western Europe": [
    fallback("European capitals weigh security spending and economic growth", "POLICY", "JMO Curated", "politics"),
    fallback("Rail, port, and energy systems remain central to regional headlines", "INFRASTRUCTURE", "JMO Curated", "infrastructure"),
  ],
  "Eastern Europe": [
    fallback("Eastern Europe remains on alert as the war in Ukraine shapes regional security", "CONFLICT", "JMO Curated", "conflict", true),
    fallback("Aid, energy, and defense talks dominate the regional agenda", "DIPLOMACY", "JMO Curated", "diplomacy"),
  ],
  "Middle East": [
    fallback("Diplomats push for de-escalation as regional conflict fears remain high", "CONFLICT", "JMO Curated", "conflict", true),
    fallback("Humanitarian agencies warn of pressure on food, fuel, and medical systems", "HUMANITARIAN", "JMO Curated", "humanitarian", true),
  ],
  "South Asia": [
    fallback("South Asian cities face heat, flooding, and infrastructure stress", "CLIMATE", "JMO Curated", "climate"),
    fallback("Tech, trade, and election stories drive the regional news mix", "REGIONAL", "JMO Curated", "technology"),
  ],
  "East Asia": [
    fallback("East Asian markets track chips, exports, and security signals", "MARKETS", "JMO Curated", "markets"),
    fallback("Taiwan Strait and Korean Peninsula tensions remain closely watched", "SECURITY", "JMO Curated", "conflict", true),
  ],
  "Southeast Asia": [
    fallback("Southeast Asian economies balance tourism, tech investment, and climate risk", "REGIONAL", "JMO Curated", "markets"),
    fallback("Maritime disputes and storm systems shape the regional watch", "SECURITY", "JMO Curated", "conflict"),
  ],
  "Africa": [
    fallback("African Union and regional blocs respond to security and election pressures", "POLITICS", "JMO Curated", "politics"),
    fallback("Food security, energy access, and climate shocks drive humanitarian coverage", "HUMANITARIAN", "JMO Curated", "humanitarian"),
  ],
  "South America": [
    fallback("South American governments balance commodity markets and climate pressure", "ECONOMY", "JMO Curated", "markets"),
    fallback("Amazon conservation, flooding, and drought remain regional storylines", "CLIMATE", "JMO Curated", "climate"),
  ],
  "Australia / Oceania": [
    fallback("Oceania watches Pacific security, climate resilience, and island diplomacy", "PACIFIC", "JMO Curated", "diplomacy"),
    fallback("Australian cities track housing, energy, and extreme weather risk", "REGIONAL", "JMO Curated", "climate"),
  ],
};

const BIG_TOPIC_TERMS = [
  "war",
  "invasion",
  "missile",
  "airstrike",
  "attack",
  "ceasefire",
  "earthquake",
  "tsunami",
  "wildfire",
  "hurricane",
  "mass shooting",
  "coup",
  "emergency",
  "evacuation",
  "famine",
  "outbreak",
];

const TOPIC_RULES = [
  ["conflict", /war|invasion|missile|airstrike|attack|ceasefire|military|troops|border|security/i],
  ["climate", /climate|storm|wildfire|hurricane|heat|flood|drought|earthquake|tsunami|weather/i],
  ["markets", /market|stocks|inflation|rates|economy|trade|tariff|oil|gas|jobs|bank/i],
  ["politics", /election|president|prime minister|congress|parliament|government|policy|vote/i],
  ["technology", /tech|chip|ai|software|cyber|space|satellite|data/i],
  ["health", /health|hospital|disease|outbreak|vaccine|doctor|medical/i],
  ["culture", /film|music|art|festival|sports|museum|restaurant|culture/i],
];

const els = {
  clock: document.querySelector("#clock"),
  clockDate: document.querySelector("#clock-date"),
  mode: document.querySelector("#mode"),
  region: document.querySelector("#region"),
  storyCount: document.querySelector("#story-count"),
  topicStack: document.querySelector("#topic-stack"),
  signalStatus: document.querySelector("#signal-status"),
  sourceLine: document.querySelector("#source-line"),
  breaking: document.querySelector("#breaking"),
  breakingTopic: document.querySelector("#breaking-topic"),
  kicker: document.querySelector("#kicker"),
  headline: document.querySelector("#headline"),
  meta: document.querySelector("#meta"),
  storyLink: document.querySelector("#story-link"),
  ticker: document.querySelector("#ticker-text"),
};

const state = {
  activeIndex: 0,
  storyIndex: 0,
  loadedLive: false,
  storiesByRegion: new Map(REGIONS.map((region) => [region.name, FALLBACK_STORIES[region.name] || []])),
};

const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  tap: false,
  worldCopyJump: true,
}).setView([20, 0], 2);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 8,
  minZoom: 2,
  opacity: 0.98,
}).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 8,
  minZoom: 2,
  opacity: 0.72,
}).addTo(map);

const route = L.polyline(REGIONS.map((region) => [region.lat, region.lon]), {
  className: "route-line",
  interactive: false,
}).addTo(map);

const markers = REGIONS.map((region) => {
  const marker = L.marker([region.lat, region.lon], {
    interactive: false,
    icon: L.divIcon({
      className: "",
      html: `<div class="news-marker"></div><div class="news-label">${escapeHtml(region.short)}</div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    }),
  }).addTo(map);
  return marker;
});

start();

function start() {
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(advance, STOP_MS);
  renderRegion(0);

  if (LIVE_ENABLED) {
    loadLiveStories();
  } else {
    els.signalStatus.textContent = "CURATED";
    els.sourceLine.textContent = "Live fetch disabled";
  }
}

async function loadLiveStories() {
  els.signalStatus.textContent = "SYNCING";
  let liveCount = 0;
  let syncedRegions = 0;

  for (const region of REGIONS) {
    try {
      const stories = await fetchRegionStories(region);
      if (stories.length > 0) {
        state.storiesByRegion.set(region.name, mergeStories(stories, FALLBACK_STORIES[region.name] || []));
        liveCount += stories.length;
        syncedRegions += 1;
        state.loadedLive = true;
        els.signalStatus.textContent = "LIVE";
        els.sourceLine.textContent = `GDELT sync: ${syncedRegions}/${REGIONS.length} regions`;
        renderRegion(state.activeIndex);
      }
    } catch (error) {
      console.warn(`News sync failed for ${region.name}`, error);
    }

    // GDELT asks high-traffic clients to avoid request bursts. Keep this source
    // gentle so OBS can run it for hours without turning the feed into errors.
    await sleep(5600);
  }

  els.signalStatus.textContent = state.loadedLive ? "LIVE" : "CURATED";
  els.sourceLine.textContent = state.loadedLive
    ? `GDELT sync complete: ${liveCount} articles`
    : "Live sync unavailable, airing fallback";
}

async function fetchRegionStories(region) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `${region.query} sourcelang:english`);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "8");
  url.searchParams.set("sort", "HybridRel");
  url.searchParams.set("timespan", "48h");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(`GDELT ${response.status}`);
  const data = await response.json();
  const articles = Array.isArray(data.articles) ? data.articles : [];
  return articles
    .map((article) => normalizeArticle(article, region))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeArticle(article, region) {
  const title = cleanTitle(article.title);
  if (!title || title.length < 12) return null;
  const topic = detectTopic(title);
  return {
    title,
    kicker: topicLabel(topic),
    source: article.domain || article.sourceCountry || "GDELT",
    url: article.url || "#",
    time: formatSeenDate(article.seendate),
    topic,
    major: isMajor(title),
    region: region.name,
  };
}

function fallback(title, kicker, source, topic, major = false) {
  return {
    title,
    kicker,
    source,
    url: "#",
    time: "Curated scan",
    topic,
    major,
  };
}

function mergeStories(liveStories, fallbackStories) {
  const seen = new Set();
  return [...liveStories, ...fallbackStories].filter((story) => {
    const key = story.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function advance() {
  state.activeIndex = (state.activeIndex + 1) % REGIONS.length;
  state.storyIndex = 0;
  renderRegion(state.activeIndex);
}

function renderRegion(index) {
  const region = REGIONS[index];
  const stories = state.storiesByRegion.get(region.name) || [];
  const story = stories[state.storyIndex % Math.max(stories.length, 1)] || fallback("Story data unavailable", "NEWSROOM", "JMO", "regional");
  const majorStory = stories.find((item) => item.major);

  map.flyTo([region.lat, region.lon], region.zoom, {
    animate: true,
    duration: 2.8,
    easeLinearity: 0.22,
  });

  markers.forEach((marker, markerIndex) => {
    const markerRegion = REGIONS[markerIndex];
    const markerStories = state.storiesByRegion.get(markerRegion.name) || [];
    const markerMajor = markerStories.some((item) => item.major);
    marker.setIcon(L.divIcon({
      className: "",
      html: `<div class="news-marker${markerMajor ? " major" : ""}"></div><div class="news-label${markerMajor ? " major" : ""}">${escapeHtml(markerRegion.short)}</div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    }));
  });

  route.setStyle({
    color: majorStory ? "#f14646" : "#62d8ff",
    opacity: majorStory ? 0.82 : 0.6,
  });

  els.mode.textContent = region.mode;
  els.region.textContent = region.name;
  els.storyCount.textContent = `${stories.length || 1} stories in rotation`;
  els.kicker.textContent = `${story.kicker} / ${region.short}`;
  els.headline.textContent = story.title;
  els.meta.textContent = `${story.source} - ${story.time}`;
  els.storyLink.href = story.url || "#";
  els.storyLink.toggleAttribute("hidden", !story.url || story.url === "#");

  if (majorStory) {
    els.breaking.hidden = false;
    els.breakingTopic.textContent = majorStory.kicker;
  } else {
    els.breaking.hidden = true;
  }

  renderTopicStack(stories);
  renderTicker();

  window.clearTimeout(renderRegion.storyTimer);
  renderRegion.storyTimer = window.setTimeout(() => {
    state.storyIndex = (state.storyIndex + 1) % Math.max(stories.length, 1);
    renderStoryOnly(region, stories);
  }, Math.floor(STOP_MS * 0.48));
}

function renderStoryOnly(region, stories) {
  if (REGIONS[state.activeIndex] !== region || stories.length < 2) return;
  const story = stories[state.storyIndex];
  els.kicker.textContent = `${story.kicker} / ${region.short}`;
  els.headline.textContent = story.title;
  els.meta.textContent = `${story.source} - ${story.time}`;
  els.storyLink.href = story.url || "#";
  els.storyLink.toggleAttribute("hidden", !story.url || story.url === "#");
}

function renderTopicStack(stories) {
  els.topicStack.innerHTML = "";
  stories.slice(0, 5).forEach((story) => {
    const row = document.createElement("div");
    row.className = `topic-chip${story.major ? " major" : ""}`;
    row.innerHTML = `<strong>${escapeHtml(story.kicker)}</strong><span>${escapeHtml(story.title)}</span>`;
    els.topicStack.append(row);
  });
}

function renderTicker() {
  const headlines = REGIONS.flatMap((region) => {
    const stories = state.storiesByRegion.get(region.name) || [];
    return stories.slice(0, 2).map((story) => `${region.short}: ${story.title}`);
  });
  els.ticker.textContent = `DATA: ${state.loadedLive ? "GDELT LIVE HEADLINES" : "CURATED FALLBACK"}  //  ${headlines.join("  //  ")}`;
}

function tickClock() {
  const now = new Date();
  els.clock.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(now) + " PT";
  els.clockDate.textContent = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);
}

function detectTopic(text) {
  const match = TOPIC_RULES.find(([, rule]) => rule.test(text));
  return match ? match[0] : "regional";
}

function topicLabel(topic) {
  return {
    conflict: "CONFLICT",
    climate: "CLIMATE",
    markets: "MARKETS",
    politics: "POLITICS",
    technology: "TECH",
    health: "HEALTH",
    culture: "CULTURE",
    regional: "REGIONAL",
  }[topic] || "REGIONAL";
}

function isMajor(text) {
  const lower = text.toLowerCase();
  return BIG_TOPIC_TERMS.some((term) => lower.includes(term));
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+[^-]{2,36}$/g, "")
    .trim();
}

function formatSeenDate(value) {
  if (!value) return "Recent";
  const text = String(value);
  const normalized = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(8, 10)}:${text.slice(10, 12)}:00Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
