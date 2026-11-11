// Banner Hub — timeline scrubber (runs inside the banner, in the page's own
// JavaScript world, so it can reach the banner's GSAP).
// Banner Hub injects it on demand into the banners it loads; it stays dormant
// until the Banner Hub page sends it a "scrub" message.
(function () {
  "use strict";

  if (window.top === window || window.parent !== window.top) return;
  if (window.__bannerHubScrub) return;
  var ancestors = location.ancestorOrigins;
  var HUB = ancestors && ancestors[0];
  if (!HUB || HUB.indexOf("chrome-extension://") !== 0) return;
  window.__bannerHubScrub = true;

  var gsap = null;
  var root = null;        // timeline that holds every animation of the banner
  var active = false;
  var lastPost = 0;
  var searchStart = 0;
  var reportedMissing = false;

  function post(data) {
    data.bannerHub = "scrub-state";
    window.parent.postMessage(data, HUB);
  }

  // gsap.delayedCall() timers. Like GSDevTools, they are left on GSAP's own clock.
  function isDelayedCall(a) {
    if (typeof a.targets !== "function" || a.duration()) return false;
    var targets = a.targets();
    return !!targets && typeof targets[0] === "function" && a.vars.onComplete === targets[0];
  }

  // ISI auto-scroll: runs for minutes, so it must not set the length of the bar.
  function hasScroll(a) {
    if (a.vars && a.vars.scrollTo != null) return true;
    if (typeof a.getChildren !== "function") return false;
    return a.getChildren(true, true, false).some(function (t) {
      return t.vars && t.vars.scrollTo != null;
    });
  }

  // Animations created after the scrubber started land on GSAP's global timeline.
  // Move them into ours, at the same moment they were going to play.
  function merge() {
    var global = gsap.globalTimeline;
    var now = global.time();
    global.getChildren(false, true, true).forEach(function (child) {
      if (child === root || isDelayedCall(child)) return;
      root.add(child, root.time() + (child.startTime() - child.delay() - now));
    });
  }

  // Start and end of the banner animation inside our timeline. Paused animations
  // (hover effects waiting to be used), endless loops and the ISI scroll are ignored.
  function bounds() {
    var start = Infinity;
    var end = 0;
    root.getChildren(false, true, true).forEach(function (child) {
      if (child.paused() || !child.timeScale()) return;
      var length = child.totalDuration() / Math.abs(child.timeScale());
      if (!(length > 0) || length > 3600 || hasScroll(child)) return;
      start = Math.min(start, child.startTime());
      end = Math.max(end, child.startTime() + length);
    });
    if (start === Infinity) return { start: root.time(), duration: 0 };
    return { start: start, duration: end - start };
  }

  function report(force) {
    var nowMs = Date.now();
    if (!force && nowMs - lastPost < 50) return;
    lastPost = nowMs;
    var b = bounds();
    var time = Math.min(Math.max(root.time() - b.start, 0), b.duration);
    post({
      found: true,
      time: time,
      duration: b.duration,
      paused: root.paused(),
      ended: b.duration > 0 && root.time() - b.start >= b.duration - 0.001,
      speed: root.timeScale()
    });
  }

  function tick() {
    merge();
    report(false);
  }

  function findGsap() {
    var g = window.gsap;
    if (g && g.exportRoot && g.ticker && g.globalTimeline && parseInt(g.version, 10) >= 3) {
      gsap = g;
      root = gsap.exportRoot({ id: "bannerHubRoot" });
      gsap.ticker.add(tick);
      report(true);
      return;
    }
    var waited = Date.now() - searchStart;
    if (waited > 8000 && !reportedMissing) {
      reportedMissing = true;
      post({ found: false, legacy: !!(window.TweenMax || window.TweenLite || window.TimelineLite) });
    }
    setTimeout(findGsap, waited > 8000 ? 500 : 20);
  }

  function run(data) {
    if (!root) { post({ found: false, waiting: !reportedMissing }); return; }
    var b = bounds();
    var cmd = data.cmd;

    if (cmd === "pause") {
      root.pause();
    } else if (cmd === "play") {
      if (root.time() - b.start >= b.duration - 0.001) root.time(b.start);
      root.play();
    } else if (cmd === "restart") {
      root.time(b.start);
      root.play();
    } else if (cmd === "seek") {
      var t = Math.min(Math.max(+data.time || 0, 0), b.duration);
      root.pause();
      root.time(b.start + t);
    } else if (cmd === "speed") {
      var speed = +data.speed;
      if (speed > 0) root.timeScale(speed);
    }
    report(true);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== HUB || e.source !== window.parent) return;
    var data = e.data;
    if (!data || data.bannerHub !== "scrub") return;
    if (!active) {
      active = true;
      searchStart = Date.now();
      findGsap();
    }
    run(data);
  });
})();
