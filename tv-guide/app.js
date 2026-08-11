/*
 * JMO TV Guide — retro Prevue-style scrolling program grid.
 * Reads tv-guide/guide.csv (channel,title,start,end,description) and renders
 * a looping vertical-scroll grid sized for a 1920x1080 OBS browser source.
 *
 * Parser functions are exported for node-based checks:
 *   node -e 'const g=require("./app.js"); console.log(g.parseGuide(...))'
 */
(function (root) {
  "use strict";

  var DAY_MINUTES = 24 * 60;

  /* ---------------- CSV parsing ---------------- */

  // Character-level CSV parser: quoted fields (incl. embedded commas/newlines,
  // doubled quotes), CRLF, blank lines, and full-line # comments.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var fieldStarted = false;
    var atLineStart = true;
    var i = 0;

    function endField() {
      row.push(field);
      field = "";
      fieldStarted = false;
    }

    function endRow() {
      endField();
      var blank = row.length === 1 && row[0].trim() === "";
      if (!blank) rows.push(row);
      row = [];
      atLineStart = true;
    }

    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (atLineStart && !fieldStarted && row.length === 0 && ch === "#") {
        while (i < text.length && text[i] !== "\n") i += 1;
        i += 1; // skip the newline too
        field = "";
        continue;
      }
      atLineStart = false;
      if (ch === '"' && field.trim() === "") {
        inQuotes = true;
        fieldStarted = true;
        field = "";
        i += 1;
        continue;
      }
      if (ch === ",") {
        endField();
        i += 1;
        continue;
      }
      if (ch === "\r") {
        i += 1;
        continue;
      }
      if (ch === "\n") {
        endRow();
        i += 1;
        continue;
      }
      field += ch;
      fieldStarted = true;
      i += 1;
    }
    if (field !== "" || row.length > 0) endRow();
    return rows;
  }

  // "HH:MM" (24h). Hours up to 47 or a "+N" day-offset suffix roll into the
  // next day, e.g. "25:30" === "01:30+1". Returns minutes or null.
  function parseTime(value) {
    if (typeof value !== "string") return null;
    var match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*\+(\d+))?$/);
    if (!match) return null;
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    var days = match[3] ? parseInt(match[3], 10) : 0;
    if (hours > 47 || minutes > 59 || days > 6) return null;
    return hours * 60 + minutes + days * DAY_MINUTES;
  }

  // Returns { channels: [{ id, programs: [{title, start, end, description}] }] }
  // start/end are minutes from midnight; end may exceed start by up to a day
  // (end <= start means the program wraps past midnight). Bad rows are
  // skipped with a console.warn.
  function parseGuide(text) {
    var rows = parseCSV(text);
    if (rows.length === 0) return { channels: [] };

    var columns = { channel: 0, title: 1, start: 2, end: 3, description: 4 };
    var first = rows[0].map(function (cell) {
      return cell.trim().toLowerCase();
    });
    var body = rows;
    if (first.indexOf("channel") !== -1 && first.indexOf("title") !== -1) {
      ["channel", "title", "start", "end", "description"].forEach(function (name) {
        var idx = first.indexOf(name);
        if (idx !== -1) columns[name] = idx;
      });
      body = rows.slice(1);
    }

    var order = [];
    var byChannel = {};
    body.forEach(function (cells, index) {
      var channel = (cells[columns.channel] || "").trim();
      var title = (cells[columns.title] || "").trim();
      var start = parseTime(cells[columns.start] || "");
      var end = parseTime(cells[columns.end] || "");
      if (!channel || !title || start === null || end === null) {
        console.warn("tv-guide: skipping row " + (index + 1) + ":", cells.join(","));
        return;
      }
      start = start % DAY_MINUTES;
      end = end % DAY_MINUTES;
      if (end <= start) end += DAY_MINUTES; // wraps past midnight
      if (!byChannel[channel]) {
        byChannel[channel] = [];
        order.push(channel);
      }
      byChannel[channel].push({
        title: title,
        start: start,
        end: end,
        description: (cells[columns.description] || "").trim(),
      });
    });

    return {
      channels: order.map(function (id) {
        return {
          id: id,
          programs: byChannel[id].sort(function (a, b) {
            return a.start - b.start;
          }),
        };
      }),
    };
  }

  // Overlap of a daily-repeating program with the absolute window
  // [windowStart, windowEnd) (minutes from today's midnight; may exceed 1440).
  // Returns { start, end, cutLeft, cutRight } clipped to the window, or null.
  function programWindow(program, windowStart, windowEnd) {
    for (var day = -1; day <= 1; day += 1) {
      var start = program.start + day * DAY_MINUTES;
      var end = program.end + day * DAY_MINUTES;
      if (end <= windowStart || start >= windowEnd) continue;
      return {
        start: Math.max(start, windowStart),
        end: Math.min(end, windowEnd),
        cutLeft: start < windowStart,
        cutRight: end > windowEnd,
      };
    }
    return null;
  }

  var guideLib = {
    parseCSV: parseCSV,
    parseTime: parseTime,
    parseGuide: parseGuide,
    programWindow: programWindow,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = guideLib;
  }
  root.JMOGuide = guideLib;

  if (typeof document === "undefined") return; // node check/test mode

  /* ---------------- Browser app ---------------- */

  var params = new URLSearchParams(root.location ? root.location.search : "");
  var WINDOW_MINUTES = clampInt(params.get("window"), 60, 240, 90);
  var SCROLL_PX_PER_SEC = clampInt(params.get("speed"), 5, 200, 34);
  var CSV_REFRESH_MS = clampInt(params.get("refresh"), 10, 3600, 60) * 1000;
  var SLOT_MINUTES = 30;
  var DATA_URL = params.get("csv") || "./guide.csv";

  var state = {
    guide: { channels: [] },
    windowStart: null, // minutes from midnight, floored to slot
    promoIndex: 0,
    guideText: null,
  };

  function clampInt(raw, min, max, fallback) {
    var value = parseInt(raw || "", 10);
    if (isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function slotLabel(totalMinutes) {
    var minutes = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    var suffix = hours >= 12 ? "PM" : "AM";
    var display = hours % 12;
    if (display === 0) display = 12;
    return display + ":" + pad(mins) + " " + suffix;
  }

  function nowMinutes() {
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  }

  function currentWindowStart() {
    return Math.floor(nowMinutes() / SLOT_MINUTES) * SLOT_MINUTES;
  }

  function channelParts(id) {
    var match = id.match(/^(\d+)\s+(.+)$/);
    if (match) return { num: match[1], name: match[2] };
    return { num: "", name: id };
  }

  var GAP_TITLES = {
    "ABC": "ABC Programming",
    "CBS": "CBS Programming",
    "NBC": "NBC Programming",
    "FOX": "FOX Programming",
    "CW": "The CW Programming",
    "CNN": "CNN Programming",
    "CNBC": "CNBC Programming",
    "ESPN": "SportsCenter",
    "FOOD": "Food Network Programming",
    "HIST": "History Programming",
    "HGTV": "HGTV Programming",
    "DISC": "Discovery Programming",
    "HBO": "HBO Movie Presentation",
    "PBS": "PBS Programming",
  };

  function gapTitle(channel) {
    var parts = channelParts(channel.id);
    return GAP_TITLES[parts.name] || (parts.name ? parts.name + " Programming" : "Regular Programming");
  }

  /* ---- clock / date ---- */

  var DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  function updateClock() {
    var now = new Date();
    var hours = now.getHours() % 12;
    if (hours === 0) hours = 12;
    var suffix = now.getHours() >= 12 ? "PM" : "AM";
    document.getElementById("clock-time").textContent =
      hours + ":" + pad(now.getMinutes()) + " " + suffix;
    document.getElementById("clock-date").textContent =
      DAYS[now.getDay()] + " " + MONTHS[now.getMonth()] + " " + now.getDate();
  }

  /* ---- promo banner ---- */

  function airingNow(guide) {
    var now = nowMinutes();
    var airing = [];
    guide.channels.forEach(function (channel) {
      channel.programs.forEach(function (program) {
        var hit = programWindow(program, now, now + 0.001);
        if (hit) airing.push({ channel: channel.id, program: program });
      });
    });
    return airing;
  }

  function updatePromo() {
    var airing = airingNow(state.guide);
    var slot = document.getElementById("promo-body");
    var label = document.getElementById("promo-label");
    if (airing.length === 0) {
      label.textContent = "JMO TV";
      slot.innerHTML = '<div class="promo-title">24/7 ALWAYS ON</div>' +
        '<div class="promo-desc">Program listings load from guide.csv</div>';
      return;
    }
    state.promoIndex = (state.promoIndex + 1) % airing.length;
    var pick = airing[state.promoIndex];
    var parts = channelParts(pick.channel);
    label.textContent = "NOW SHOWING · CH " + (parts.num || "–") + " " + parts.name;
    slot.innerHTML =
      '<div class="promo-title">' + escapeHTML(pick.program.title) + "</div>" +
      '<div class="promo-desc">' + escapeHTML(pick.program.description || "") + "</div>" +
      '<div class="promo-time">' + slotLabel(pick.program.start) + " – " + slotLabel(pick.program.end) + "</div>";
  }

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  /* ---- grid ---- */

  function buildTimebar(windowStart) {
    var bar = document.getElementById("timebar-slots");
    bar.innerHTML = "";
    var slots = Math.round(WINDOW_MINUTES / SLOT_MINUTES);
    for (var i = 0; i < slots; i += 1) {
      var cell = document.createElement("div");
      cell.className = "timebar-slot";
      cell.textContent = slotLabel(windowStart + i * SLOT_MINUTES);
      bar.appendChild(cell);
    }
  }

  function buildRow(channel, windowStart, windowEnd) {
    var row = document.createElement("div");
    row.className = "grid-row";

    var parts = channelParts(channel.id);
    var cell = document.createElement("div");
    cell.className = "channel-cell";
    cell.innerHTML =
      '<div class="channel-num">' + escapeHTML(parts.num || "–") + "</div>" +
      '<div class="channel-name">' + escapeHTML(parts.name) + "</div>";
    row.appendChild(cell);

    var lane = document.createElement("div");
    lane.className = "program-lane";

    var clipped = [];
    channel.programs.forEach(function (program) {
      var hit = programWindow(program, windowStart, windowEnd);
      if (hit) clipped.push({ program: program, hit: hit });
    });
    clipped.sort(function (a, b) {
      return a.hit.start - b.hit.start;
    });

    var cursor = windowStart;
    clipped.forEach(function (entry) {
      if (entry.hit.start < cursor) return; // overlapping rows: first wins
      if (entry.hit.start > cursor) {
        lane.appendChild(fillerBlock(channel, cursor, entry.hit.start, windowStart));
      }
      lane.appendChild(programBlock(entry, windowStart));
      cursor = entry.hit.end;
    });
    if (cursor < windowEnd) {
      lane.appendChild(fillerBlock(channel, cursor, windowEnd, windowStart));
    }

    row.appendChild(lane);
    return row;
  }

  function blockGeometry(block, start, end, windowStart) {
    block.style.left = (((start - windowStart) / WINDOW_MINUTES) * 100).toFixed(3) + "%";
    block.style.width = (((end - start) / WINDOW_MINUTES) * 100).toFixed(3) + "%";
  }

  function programBlock(entry, windowStart) {
    var block = document.createElement("div");
    block.className = "program-block";
    blockGeometry(block, entry.hit.start, entry.hit.end, windowStart);
    var title = entry.program.title;
    if (entry.hit.cutLeft) title = "◀ " + title;
    if (entry.hit.cutRight) title = title + " ▶";
    block.innerHTML = '<span class="program-title">' + escapeHTML(title) + "</span>";
    block.title = entry.program.description || entry.program.title;
    return block;
  }

  function fillerBlock(channel, start, end, windowStart) {
    var block = document.createElement("div");
    block.className = "program-block filler";
    blockGeometry(block, start, end, windowStart);
    var title = gapTitle(channel);
    block.innerHTML = '<span class="program-title">' + escapeHTML(title) + "</span>";
    block.title = title;
    return block;
  }

  function renderGrid() {
    var windowStart = currentWindowStart();
    state.windowStart = windowStart;
    buildTimebar(windowStart);

    var strip = document.getElementById("grid-strip");
    strip.innerHTML = "";
    var pane = document.createElement("div");
    pane.className = "grid-pane";
    state.guide.channels.forEach(function (channel) {
      pane.appendChild(buildRow(channel, windowStart, windowStart + WINDOW_MINUTES));
    });
    strip.appendChild(pane);

    // Duplicate the pane so the vertical scroll can loop seamlessly: append
    // cloned copies until the duplicates cover at least one viewport, so the
    // frame shown at offset === paneHeight is pixel-identical to offset 0.
    // Only needed (and only looped) when the rows overflow the viewport.
    // Heights come from getBoundingClientRect() (sub-pixel) — offsetHeight
    // rounds to integers, which made every wrap jump by a fraction of a px.
    var viewport = document.getElementById("grid-viewport");
    var paneHeight = pane.getBoundingClientRect().height;
    var viewportHeight = viewport.getBoundingClientRect().height;
    if (paneHeight > viewportHeight && paneHeight > 0) {
      var extra = 0;
      while (extra < viewportHeight) {
        strip.appendChild(pane.cloneNode(true));
        extra += paneHeight;
      }
      strip.dataset.loop = "1";
      scroll.loop = true;
      scroll.paneHeight = paneHeight;
      // Keep the current position across rebuilds (60s CSV refresh,
      // half-hour window roll) instead of snapping back to the top; the
      // modulo re-bases the offset if the row count / pane height changed.
      scroll.offset = scroll.offset % paneHeight;
    } else {
      strip.dataset.loop = "0";
      scroll.loop = false;
      scroll.paneHeight = 0;
      scroll.offset = 0;
    }
    applyScroll(strip);
  }

  /* ---- continuous scroll ---- */

  var scroll = { offset: 0, last: null, loop: false, paneHeight: 0 };

  function applyScroll(strip) {
    // translate3d keeps the strip on the compositor (smoother in OBS
    // browser sources than repositioning via layout).
    strip.style.transform = "translate3d(0," + (-scroll.offset).toFixed(2) + "px,0)";
  }

  function scrollFrame(timestamp) {
    var strip = document.getElementById("grid-strip");
    if (scroll.last === null) scroll.last = timestamp;
    var delta = (timestamp - scroll.last) / 1000;
    scroll.last = timestamp;

    if (scroll.loop && scroll.paneHeight > 0) {
      scroll.offset = (scroll.offset + delta * SCROLL_PX_PER_SEC) % scroll.paneHeight;
    } else {
      scroll.offset = 0;
    }
    applyScroll(strip);
    root.requestAnimationFrame(scrollFrame);
  }

  /* ---- data loading ---- */

  function loadGuide() {
    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("guide.csv " + response.status);
        return response.text();
      })
      .then(function (text) {
        if (text === state.guideText) return;
        var guide = parseGuide(text);
        if (guide.channels.length === 0) {
          console.warn("tv-guide: guide.csv parsed to 0 channels; keeping previous grid");
          return;
        }
        state.guideText = text;
        state.guide = guide;
        renderGrid();
        updatePromo();
      })
      .catch(function (error) {
        console.warn("tv-guide: failed to load guide.csv:", error);
      });
  }

  function tick() {
    // Re-render when the half-hour boundary rolls over.
    if (state.windowStart !== null && currentWindowStart() !== state.windowStart) {
      renderGrid();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(tick, 5000);
    setInterval(updatePromo, 8000);
    loadGuide();
    setInterval(loadGuide, CSV_REFRESH_MS);
    root.requestAnimationFrame(scrollFrame);
  });
})(typeof window !== "undefined" ? window : globalThis);
