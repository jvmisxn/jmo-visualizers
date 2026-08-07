/* JMO Shop-O-Rama — real-data-only product channel.
 *
 * Reads retro-shopping/products.json, generated from a public Fourthwall
 * collection feed. No invented products, inventory counts, or prices.
 */
(function () {
  "use strict";

  var DATA_URL = "./products.json?v=" + Math.floor(Date.now() / (5 * 60 * 1000));
  var ROTATE_MS = 18000;

  function $(id) { return document.getElementById(id); }

  var el = {
    set: document.querySelector(".set"),
    panel: $("product-panel"),
    hero: $("hero"),
    badge: $("badge"),
    name: $("product-name"),
    tag: $("product-tag"),
    features: $("features"),
    itemNo: $("item-no"),
    retail: $("retail-price"),
    price: $("price"),
    payments: $("payments"),
    stockCount: $("stock-count"),
    stockFill: $("stock-fill"),
    soldCount: $("sold-count"),
    countdown: $("countdown"),
    hostStrap: $("host-strap"),
    tickerTrack: $("ticker-track"),
    clock: $("clock"),
    canvas: $("static-canvas"),
    trackingBar: $("tracking-bar"),
    osd: $("vhs-osd")
  };

  var feed = null;
  var products = [];
  var productIndex = 0;
  var tickerX = 0;
  var tickerHalf = 0;

  function money(n) {
    return Number.isFinite(n)
      ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "--";
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function ageText(ms) {
    if (!Number.isFinite(ms)) return "UNKNOWN AGE";
    var mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
    return mins < 1 ? "UPDATED JUST NOW" : "UPDATED " + mins + " MIN AGO";
  }

  async function loadProducts() {
    try {
      var res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      feed = await res.json();
      products = Array.isArray(feed.products) ? feed.products.filter(function (p) { return p.title; }) : [];
      productIndex = Math.min(productIndex, Math.max(0, products.length - 1));
    } catch (err) {
      feed = null;
      products = [];
    }
    showProduct(productIndex);
    buildTicker();
  }

  function showUnavailable() {
    el.hero.textContent = "NO";
    el.hero.style.backgroundImage = "";
    el.badge.textContent = "LIVE FEED DOWN";
    el.name.textContent = "Product Feed Unavailable";
    el.tag.textContent = "No real shopping data is available right now.";
    el.features.innerHTML = "";
    ["No fallback catalog", "No simulated prices", "No invented inventory"].forEach(addFeature);
    el.itemNo.textContent = "SOURCE OFFLINE";
    el.retail.textContent = "--";
    el.price.textContent = "--";
    el.payments.textContent = "REAL DATA ONLY";
    el.stockCount.textContent = "--";
    el.stockFill.style.width = "0%";
    el.soldCount.textContent = "NOT SHOWN";
    el.countdown.textContent = "OFF AIR";
    el.hostStrap.textContent = "SHOP-O-RAMA REAL PRODUCT FEED";
  }

  function addFeature(text) {
    var li = document.createElement("li");
    li.textContent = text;
    el.features.appendChild(li);
  }

  function showProduct(idx) {
    if (!products.length) {
      showUnavailable();
      return;
    }

    var p = products[idx % products.length];
    if (p.image) {
      el.hero.textContent = "";
      el.hero.style.backgroundImage = "url(" + JSON.stringify(p.image).slice(1, -1) + ")";
    } else {
      el.hero.textContent = "LIVE";
      el.hero.style.backgroundImage = "";
    }
    el.badge.textContent = p.available ? "LIVE PRODUCT" : "SOLD OUT";
    el.name.textContent = p.title;
    el.tag.textContent = p.subtitle || feed.collection || "Fourthwall public product feed";

    el.features.innerHTML = "";
    addFeature((p.variants || 1) + " real variant" + (p.variants === 1 ? "" : "s") + " listed");
    addFeature("Source: " + (feed.provider || "public product feed"));
    addFeature(p.updatedAt ? "Updated at source: " + p.updatedAt.replace(" UTC", "Z") : ageText(feed.generatedAt));

    el.itemNo.textContent = "ITEM " + String(p.id || "").slice(0, 8).toUpperCase();
    el.retail.textContent = Number.isFinite(p.compareAt) ? money(p.compareAt) : money(p.price);
    el.price.textContent = money(p.price);
    el.payments.textContent = p.url ? "VIEW PRODUCT PAGE FOR CHECKOUT" : "CHECKOUT LINK UNAVAILABLE";
    el.stockCount.textContent = p.available ? "YES" : "NO";
    el.stockFill.style.width = p.available ? "100%" : "0%";
    el.soldCount.textContent = ageText(feed.generatedAt);
    el.countdown.textContent = p.available ? "LIVE" : "SOLD";
    el.countdown.classList.toggle("urgent", !p.available);
    el.hostStrap.textContent = (feed.collection || "LIVE PRODUCTS").toUpperCase() + " • " + (feed.sourceUrl || "");
  }

  function nextProduct() {
    if (!products.length) return;
    burstStatic(420, function () {
      el.panel.classList.add("swapping");
      setTimeout(function () {
        productIndex = (productIndex + 1) % products.length;
        showProduct(productIndex);
        el.panel.classList.remove("swapping");
      }, 180);
    });
  }

  function updateClock() {
    var d = new Date();
    var h = d.getHours();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    el.clock.textContent = h + ":" + pad(d.getMinutes()) + " " + ampm;
  }

  function buildTicker() {
    var items = [];
    if (feed && products.length) {
      items.push("REAL PRODUCT FEED: " + (feed.collection || "ALL PRODUCTS"));
      items.push(ageText(feed.generatedAt));
      products.slice(0, 12).forEach(function (p) {
        items.push((p.available ? "AVAILABLE" : "SOLD OUT") + ": " + p.title + " — " + money(p.price));
      });
    } else {
      items.push("LIVE PRODUCT FEED UNAVAILABLE");
      items.push("NO SIMULATED PRODUCTS OR PRICES ARE SHOWN");
    }
    el.tickerTrack.innerHTML = "";
    for (var loop = 0; loop < 2; loop++) {
      items.forEach(function (item) {
        var span = document.createElement("span");
        span.textContent = item;
        el.tickerTrack.appendChild(span);
      });
    }
    requestAnimationFrame(function () {
      tickerHalf = el.tickerTrack.scrollWidth / 2 || window.innerWidth;
    });
  }

  function animateTicker() {
    tickerX -= 1.2;
    if (Math.abs(tickerX) >= tickerHalf) tickerX = 0;
    el.tickerTrack.style.transform = "translateX(" + tickerX + "px)";
    requestAnimationFrame(animateTicker);
  }

  function burstStatic(duration, done) {
    duration = duration || 350;
    el.canvas.classList.add("active");
    el.set.classList.add("glitching");
    var ctx = el.canvas.getContext("2d");
    var end = performance.now() + duration;

    function draw() {
      el.canvas.width = window.innerWidth / 3;
      el.canvas.height = window.innerHeight / 3;
      var img = ctx.createImageData(el.canvas.width, el.canvas.height);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 185;
      }
      ctx.putImageData(img, 0, 0);
      if (performance.now() < end) {
        requestAnimationFrame(draw);
      } else {
        el.canvas.classList.remove("active");
        el.set.classList.remove("glitching");
        if (done) done();
      }
    }
    draw();
  }

  function scheduleGlitches() {
    setTimeout(function () {
      burstStatic(120 + Math.random() * 220);
      scheduleGlitches();
    }, 9000 + Math.random() * 26000);

    setTimeout(function () {
      el.trackingBar.classList.add("roll");
      setTimeout(function () { el.trackingBar.classList.remove("roll"); }, 1100);
    }, 6000 + Math.random() * 18000);

    setTimeout(function () {
      el.osd.classList.add("show");
      setTimeout(function () { el.osd.classList.remove("show"); }, 1400);
    }, 12000 + Math.random() * 34000);
  }

  window.addEventListener("resize", buildTicker);

  updateClock();
  setInterval(updateClock, 1000);
  loadProducts();
  setInterval(loadProducts, 5 * 60 * 1000);
  setInterval(nextProduct, ROTATE_MS);
  animateTicker();
  scheduleGlitches();
})();
