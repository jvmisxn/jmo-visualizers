/* JMO Shop-O-Rama — fake retro home-shopping channel.
   Fully self-contained: no network, no external data. */

(function () {
  "use strict";

  // ---------- Catalog ----------

  var PRODUCTS = [
    {
      emoji: "🍳",
      name: "MiracleChef 3000",
      tag: "It slices! It dices! It never quits!",
      features: ["Non-stick QuantumCoat™ surface", "Cooks a turkey in 11 minutes*", "Dishwasher safe (top rack only)"],
      retail: 149.99, price: 39.99, badge: "AS SEEN ON TV"
    },
    {
      emoji: "💎",
      name: "Cubic Zirconia Dream Ring",
      tag: "Sparkle like a millionaire. Pay like a realist.",
      features: ["4-carat look, 0-carat guilt", "Genuine gold-tone band", "Free velvet-ish pouch included"],
      retail: 299.99, price: 24.99, badge: "FINAL HOUR"
    },
    {
      emoji: "🏋️",
      name: "AbBlaster Supreme",
      tag: "Six-pack abs in just 6 minutes a day!",
      features: ["Patented WobbleTension™ core tech", "Folds flat under any bed", "Includes VHS workout tape"],
      retail: 199.99, price: 49.99, badge: "TV EXCLUSIVE"
    },
    {
      emoji: "🧴",
      name: "HairBack Pro Formula X",
      tag: "The follicle miracle they don't want you to know about!",
      features: ["Spray-on confidence in seconds", "Now with 40% more Formula", "Results may vary. Wildly."],
      retail: 89.99, price: 19.99, badge: "DOCTOR* APPROVED"
    },
    {
      emoji: "📼",
      name: "MegaHits '87 Box Set",
      tag: "All the hits. None of the filler. 12 cassettes!",
      features: ["Over 9 hours of pure gold", "Chrome-plated storage caddy", "Not available in any store"],
      retail: 119.99, price: 29.99, badge: "COLLECTOR'S ITEM"
    },
    {
      emoji: "🔪",
      name: "Samurai Steel Knife Set",
      tag: "Cuts through a shoe. Then a tomato. Paper thin!",
      features: ["Forged* in space-age steel", "Lifetime edge guarantee", "Free paring knife — just pay shipping"],
      retail: 249.99, price: 59.99, badge: "BUY 1 GET 1"
    },
    {
      emoji: "🛏️",
      name: "Snuggle Cocoon Deluxe",
      tag: "The blanket... with sleeves!",
      features: ["One size fits most humans", "Machine washable plush fleece", "Now in Electric Teal"],
      retail: 69.99, price: 16.99, badge: "VIEWER FAVORITE"
    },
    {
      emoji: "📻",
      name: "PocketTune AM/FM Wonder",
      tag: "Radio so small, it fits in your pocket!",
      features: ["Genuine imitation leather case", "Runs on one 9-volt battery", "Telescoping antenna of the future"],
      retail: 59.99, price: 14.99, badge: "LAST CHANCE"
    },
    {
      emoji: "🐟",
      name: "Singing Bass Classic",
      tag: "He sings! He flops! He judges your guests!",
      features: ["3 toe-tapping motion hits", "Wall-mountable oak-look plaque", "Motion activated — always watching"],
      retail: 79.99, price: 21.99, badge: "HOLIDAY HIT"
    },
    {
      emoji: "🧹",
      name: "TurboVac Cyclone 9",
      tag: "It picks up a bowling ball!** (**do not vacuum bowling balls)",
      features: ["HyperSuction™ dual chamber", "27-foot tangle-free cord", "Free attachment kit — a $49 value!"],
      retail: 189.99, price: 44.99, badge: "TODAY ONLY"
    }
  ];

  var HOSTS = [
    "RANDY VELVETEEN • YOUR LATE-NIGHT DEALS HOST",
    "DIANE SPARKLES • GEMSTONE SPECIALIST",
    "CHUCK BARGAIN • 22 YEARS OF SAVINGS",
    "TAMMY FAYE PRICE • QUEEN OF THE FLASH SALE"
  ];

  var TICKER_ITEMS = [
    "★ OPERATORS ARE STANDING BY ★",
    "NO C.O.D. ORDERS PLEASE",
    "ALLOW 6-8 WEEKS FOR DELIVERY",
    "CALL 1-800-555-0199",
    "SUPPLIES WON'T LAST!",
    "ASK ABOUT OUR EZ-PAY PLAN",
    "*RESULTS NOT TYPICAL",
    "TELL 'EM SHOP-O-RAMA SENT YA",
    "NEXT UP: THE MIDNIGHT MEGA DEAL",
    "SHIPPING & HANDLING NOT INCLUDED"
  ];

  var OFFER_SECONDS = 90;      // countdown per product
  var PRICE_DROP_AT = 30;      // seconds left when the price drops even lower

  // ---------- DOM ----------

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

  // ---------- Helpers ----------

  function money(n) { return "$" + n.toFixed(2); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function fmtInt(n) { return n.toLocaleString("en-US"); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // ---------- State ----------

  var productIndex = randInt(0, PRODUCTS.length - 1);
  var secondsLeft = OFFER_SECONDS;
  var priceDropped = false;
  var stock = 0;
  var stockMax = 0;
  var sold = randInt(800, 2400);
  var currentPrice = 0;

  // ---------- Product rotation ----------

  function showProduct(idx) {
    var p = PRODUCTS[idx];
    el.hero.textContent = p.emoji;
    el.badge.textContent = p.badge;
    el.name.textContent = p.name;
    el.tag.textContent = p.tag;

    el.features.innerHTML = "";
    for (var i = 0; i < p.features.length; i++) {
      var li = document.createElement("li");
      li.textContent = p.features[i];
      el.features.appendChild(li);
    }

    el.itemNo.textContent = "ITEM #" + String.fromCharCode(65 + (idx % 26)) + "-" + (1000 + idx * 37);
    el.retail.textContent = money(p.retail);
    currentPrice = p.price;
    el.price.textContent = money(currentPrice);
    updatePayments();

    stockMax = randInt(180, 420);
    stock = randInt(Math.floor(stockMax * 0.4), stockMax);
    updateStock();

    secondsLeft = OFFER_SECONDS;
    priceDropped = false;
    el.countdown.classList.remove("urgent");
  }

  function updatePayments() {
    var payments = randInt(3, 5);
    el.payments.textContent = "or " + payments + " EZ payments of " + money(currentPrice / payments + 0.01);
  }

  function nextProduct() {
    burstStatic(650, function () {
      el.panel.classList.add("swapping");
      setTimeout(function () {
        productIndex = (productIndex + 1) % PRODUCTS.length;
        showProduct(productIndex);
        el.panel.classList.remove("swapping");
        el.hostStrap.textContent = HOSTS[randInt(0, HOSTS.length - 1)];
      }, 260);
    });
  }

  function updateStock() {
    el.stockCount.textContent = fmtInt(stock);
    var pct = Math.max(4, Math.round((stock / stockMax) * 100));
    el.stockFill.style.width = pct + "%";
  }

  function dropPrice() {
    priceDropped = true;
    currentPrice = Math.max(4.99, Math.round((currentPrice * rand(0.55, 0.75) - 0.01) * 100) / 100);
    // keep the retro ".99" ending
    currentPrice = Math.floor(currentPrice) + 0.99;
    el.price.textContent = money(currentPrice);
    updatePayments();
    el.price.classList.remove("dropping");
    void el.price.offsetWidth; // restart animation
    el.price.classList.add("dropping");
    burstStatic(280);
  }

  // ---------- Per-second tick ----------

  function tick() {
    secondsLeft--;

    if (secondsLeft <= 0) {
      el.countdown.textContent = "00:00";
      nextProduct();
      return;
    }

    el.countdown.textContent = pad(Math.floor(secondsLeft / 60)) + ":" + pad(secondsLeft % 60);
    el.countdown.classList.toggle("urgent", secondsLeft <= 15);

    if (!priceDropped && secondsLeft <= PRICE_DROP_AT) dropPrice();

    // sales trickle in
    if (Math.random() < 0.55) {
      var burst = randInt(1, 7);
      sold += burst;
      stock = Math.max(3, stock - burst);
      el.soldCount.textContent = fmtInt(sold);
      updateStock();
    }
  }

  // ---------- Clock ----------

  function updateClock() {
    var d = new Date();
    var h = d.getHours();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    el.clock.textContent = h + ":" + pad(d.getMinutes()) + " " + ampm;
  }

  // ---------- Ticker ----------

  var tickerX = 0;
  var tickerHalf = 0;

  function buildTicker() {
    var frag = document.createDocumentFragment();
    // two copies for a seamless loop
    for (var copy = 0; copy < 2; copy++) {
      for (var i = 0; i < TICKER_ITEMS.length; i++) {
        var span = document.createElement("span");
        span.textContent = TICKER_ITEMS[i];
        frag.appendChild(span);
      }
    }
    el.tickerTrack.appendChild(frag);
    tickerHalf = el.tickerTrack.scrollWidth / 2;
    tickerX = 0;
  }

  var lastFrame = null;

  function animateTicker(ts) {
    if (lastFrame !== null) {
      var dt = Math.min((ts - lastFrame) / 1000, 0.1);
      tickerX -= dt * (window.innerWidth * 0.075); // ~7.5% of screen width per second
      if (tickerHalf > 0 && -tickerX >= tickerHalf) tickerX += tickerHalf;
      el.tickerTrack.style.transform = "translateX(" + tickerX + "px)";
    }
    lastFrame = ts;
    requestAnimationFrame(animateTicker);
  }

  // ---------- VHS static bursts ----------

  var ctx = el.canvas.getContext("2d");
  var staticTimer = null;

  function sizeCanvas() {
    // low-res noise buffer scaled up for chunky VHS grain
    el.canvas.width = 320;
    el.canvas.height = 180;
  }

  function drawNoiseFrame() {
    var w = el.canvas.width;
    var h = el.canvas.height;
    var img = ctx.createImageData(w, h);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // occasional colored tear line
    if (Math.random() < 0.5) {
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,60,140,0.5)" : "rgba(40,220,255,0.5)";
      ctx.fillRect(0, (Math.random() * h) | 0, w, 1 + ((Math.random() * 3) | 0));
    }
  }

  function burstStatic(durationMs, midCallback) {
    if (staticTimer) return; // one burst at a time
    el.canvas.style.opacity = "0.9";
    el.set.classList.add("glitching");
    staticTimer = setInterval(drawNoiseFrame, 40);
    if (midCallback) setTimeout(midCallback, durationMs * 0.4);
    setTimeout(function () {
      clearInterval(staticTimer);
      staticTimer = null;
      el.canvas.style.opacity = "0";
      el.set.classList.remove("glitching");
    }, durationMs);
  }

  function scheduleRandomGlitches() {
    setTimeout(function () {
      // skip if a product swap is imminent to avoid overlapping bursts
      if (secondsLeft > 4) burstStatic(randInt(120, 450));
      scheduleRandomGlitches();
    }, randInt(9000, 26000));
  }

  function scheduleTrackingRolls() {
    setTimeout(function () {
      el.trackingBar.classList.remove("rolling");
      void el.trackingBar.offsetWidth;
      el.trackingBar.classList.add("rolling");
      scheduleTrackingRolls();
    }, randInt(14000, 40000));
  }

  function scheduleOsdBlips() {
    setTimeout(function () {
      el.osd.classList.add("visible");
      setTimeout(function () { el.osd.classList.remove("visible"); }, randInt(2000, 4500));
      scheduleOsdBlips();
    }, randInt(20000, 55000));
  }

  // ---------- Boot ----------

  sizeCanvas();
  buildTicker();
  showProduct(productIndex);
  el.soldCount.textContent = fmtInt(sold);
  updateClock();

  setInterval(tick, 1000);
  setInterval(updateClock, 5000);
  requestAnimationFrame(animateTicker);
  scheduleRandomGlitches();
  scheduleTrackingRolls();
  scheduleOsdBlips();

  window.addEventListener("resize", function () {
    tickerHalf = el.tickerTrack.scrollWidth / 2;
  });
})();
