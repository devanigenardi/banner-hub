"use strict";

/* ---------- Shared helpers ---------- */

var SIZES = ["300x600", "300x250", "160x600", "728x90", "970x250", "970x90",
             "336x280", "320x480", "320x100", "320x50", "300x50"];

document.querySelectorAll(".size-select").forEach(function (select) {
  var auto = document.createElement("option");
  auto.value = "auto";
  auto.textContent = "Auto (from URL)";
  select.appendChild(auto);
  SIZES.forEach(function (s) {
    var option = document.createElement("option");
    option.textContent = s;
    select.appendChild(option);
  });
});

function seconds(inputId, fallback) {
  var value = parseFloat(document.getElementById(inputId).value);
  return isNaN(value) ? fallback : Math.max(0, value);
}

// Empties the slot and, if there is a URL, puts a hidden iframe of the right size in it.
// Size: from the dropdown, or in "Auto" the last WxH found in the URL (e.g. .../728x90/index.html).
function buildSlot(container, url, choice, id) {
  url = url.trim();
  container.innerHTML = "";
  container.classList.remove("done");
  container.style.visibility = "hidden";
  if (!url) return null;

  var note = "";
  if (choice === "auto") {
    var found = url.match(/\d{2,4}x\d{2,4}/gi);
    if (found) {
      choice = found[found.length - 1];
    } else {
      choice = "300x600";
      note = " (size not found in URL, pick one from the dropdown)";
    }
  }
  var size = choice.toLowerCase().split("x");

  var label = document.createElement("div");
  label.className = "size-label";
  label.textContent = size[0] + "x" + size[1] + note;
  container.appendChild(label);

  var frame = document.createElement("iframe");
  frame.style.cssText = "display:block;overflow:hidden;border:0;width:" + size[0] + "px;height:" + size[1] + "px";
  frame.setAttribute("frameborder", "0");
  frame.id = id;
  frame.className = "banner_iframe";
  container.appendChild(frame);
  return { container: container, frame: frame, label: label, url: url, width: +size[0], height: +size[1] };
}

// Loads every banner and calls done() when all have finished
// (or when maxWait runs out, so a broken URL never blocks the rest).
function loadAll(jobs, maxWait, isStale, done) {
  var pending = jobs.length;
  var finished = false;
  function finish() {
    if (finished || isStale()) return;
    finished = true;
    clearTimeout(timer);
    done();
  }
  var timer = setTimeout(finish, maxWait);
  jobs.forEach(function (job) {
    job.frame.onload = function () {
      job.frame.onload = null;
      if (--pending === 0) finish();
    };
    job.frame.src = job.url;
  });
}

// The full sequence both tabs use:
// 1) Hidden first load: downloads everything into the browser cache.
// 2) Delay: extra wait for assets the banners request after their load event.
// 3) Restart all banners at the same time (now from cache), show them together
//    and call started().
function preloadAndStart(jobs, delayMs, isStale, started) {
  loadAll(jobs, 10000, isStale, function () {
    setTimeout(function () {
      if (isStale()) return;
      loadAll(jobs, 3000, isStale, function () {
        jobs.forEach(function (job) { job.container.style.visibility = "visible"; });
        started();
      });
    }, delayMs);
  });
}

/* ---------- Clock (counter + time marks) ---------- */

// duration = null means "count up until stopped" (used by Compare).
function createClock(root) {
  var timeEl = root.querySelector(".clock-time");
  var targetEl = root.querySelector(".clock-target");
  var fillEl = root.querySelector(".clock-bar-fill");
  var markBtn = root.querySelector(".mark-btn");
  var lapsEl = root.querySelector(".laps");

  var raf = null;
  var startTime = 0;
  var running = false;
  var duration = null;
  var lastMark = 0;
  var markCount = 0;

  function draw(elapsed) {
    timeEl.textContent = elapsed.toFixed(1);
    if (duration) fillEl.style.width = Math.min(100, elapsed / duration * 100) + "%";
  }

  function clearMarks() {
    if (lapsEl) lapsEl.innerHTML = "";
    lastMark = 0;
    markCount = 0;
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    if (markBtn) markBtn.disabled = true;
  }

  function reset(newDuration) {
    stop();
    duration = newDuration || null;
    root.classList.remove("done");
    targetEl.textContent = duration ? "/ " + duration + " s" : "s";
    fillEl.style.width = "0";
    clearMarks();
    draw(0);
  }

  function start(onDone) {
    startTime = performance.now();
    running = true;
    if (markBtn) markBtn.disabled = false;

    (function tick() {
      if (!running) return;
      var elapsed = (performance.now() - startTime) / 1000;
      if (duration && elapsed >= duration) {
        stop();
        draw(duration);
        root.classList.add("done");
        if (onDone) onDone();
        return;
      }
      draw(elapsed);
      raf = requestAnimationFrame(tick);
    })();
  }

  function mark() {
    if (!running || !lapsEl) return;
    var elapsed = (performance.now() - startTime) / 1000;
    var li = document.createElement("li");
    var n = document.createElement("span");
    n.className = "lap-n";
    n.textContent = "#" + (++markCount);
    var delta = document.createElement("span");
    delta.className = "lap-delta";
    delta.textContent = "+" + (elapsed - lastMark).toFixed(2);
    li.appendChild(n);
    li.appendChild(document.createTextNode(elapsed.toFixed(2) + " s"));
    li.appendChild(delta);
    lapsEl.appendChild(li);
    lastMark = elapsed;
  }

  // Time marks are optional: a clock without the buttons (Compare) just counts.
  if (markBtn) {
    markBtn.addEventListener("click", mark);
    root.querySelector(".clear-btn").addEventListener("click", clearMarks);
  }

  return { reset: reset, start: start, stop: stop, mark: mark };
}

var clocks = {
  compare: createClock(document.getElementById("compare-clock")),
  timer: createClock(document.getElementById("timer-clock"))
};

/* ---------- Tabs ---------- */

var activeTab = "compare";
var tabs = document.querySelectorAll(".tab");
tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    activeTab = tab.dataset.tab;
    tabs.forEach(function (t) {
      var active = t === tab;
      t.classList.toggle("active", active);
      document.getElementById("tab-" + t.dataset.tab).hidden = !active;
    });
  });
});

// Space marks a time on the visible tab's clock, unless you are typing in a field.
// On the Timeline tab it plays and pauses the animation instead.
function isSpaceShortcut(e) {
  if (!clocks[activeTab] && activeTab !== "timeline") return false;
  if (e.code !== "Space" && e.key !== " ") return false;
  var el = e.target;
  var tag = el.tagName;
  if (tag === "SELECT" || tag === "TEXTAREA") return false;
  if (tag === "INPUT" && el.type !== "submit" && el.type !== "button" && el.type !== "range") return false;
  return true;
}
document.addEventListener("keydown", function (e) {
  if (!isSpaceShortcut(e)) return;
  e.preventDefault();
  if (e.repeat) return;
  if (activeTab === "timeline") scrubToggle();
  else clocks[activeTab].mark();
});
// Stops Space from also "clicking" whichever button has focus.
document.addEventListener("keyup", function (e) {
  if (isSpaceShortcut(e)) e.preventDefault();
});

/* ---------- Compare ---------- */

var compareRun = 0;
var compareStatus = document.getElementById("status");

document.getElementById("compare-form").addEventListener("submit", function (e) {
  e.preventDefault();

  var myRun = ++compareRun;
  function isStale() { return myRun !== compareRun; }
  clocks.compare.reset(null);

  var jobs = [1, 2].map(function (n) {
    return buildSlot(
      document.getElementById("iframe-container-" + n),
      document.getElementById("iframe" + n).value,
      document.getElementById("size" + n).value,
      "frame_" + n
    );
  }).filter(Boolean);
  if (!jobs.length) { compareStatus.textContent = "Enter at least one banner URL."; return; }

  compareStatus.textContent = "Loading banners…";
  preloadAndStart(jobs, seconds("delay", 0) * 1000, isStale, function () {
    compareStatus.textContent = "";
    clocks.compare.start();
  });
});

document.getElementById("compare-stop").addEventListener("click", function () {
  clocks.compare.stop();
});

// The running number is distracting while comparing, so it is hidden by default.
var showClock = document.getElementById("show-clock");
function applyShowClock() {
  document.getElementById("compare-clock").classList.toggle("quiet", !showClock.checked);
  document.getElementById("compare-stop").hidden = !showClock.checked;
}
try { showClock.checked = localStorage.getItem("showCompareClock") === "1"; } catch (err) {}
applyShowClock();
showClock.addEventListener("change", function () {
  applyShowClock();
  try { localStorage.setItem("showCompareClock", showClock.checked ? "1" : "0"); } catch (err) {}
});

/* ---------- Timer ---------- */

var timerRun = 0;
var timerStatus = document.getElementById("timer-status");

document.getElementById("timer-form").addEventListener("submit", function (e) {
  e.preventDefault();

  var myRun = ++timerRun;
  function isStale() { return myRun !== timerRun; }

  var duration = Math.max(1, seconds("timer-duration", 15));
  clocks.timer.reset(duration);

  var job = buildSlot(
    document.getElementById("timer-container"),
    document.getElementById("timer-url").value,
    document.getElementById("timer-size").value,
    "frame_timer"
  );
  if (!job) { timerStatus.textContent = "Enter a banner URL first."; return; }

  timerStatus.textContent = "Loading banner…";
  preloadAndStart([job], seconds("timer-delay", 0) * 1000, isStale, function () {
    timerStatus.textContent = "Running…";
    clocks.timer.start(function () {
      job.container.classList.add("done");
      timerStatus.textContent = "";
    });
  });
});

document.getElementById("timer-stop").addEventListener("click", function () {
  timerRun++;
  clocks.timer.stop();
  timerStatus.textContent = "Stopped.";
});

/* ---------- ISI expander ---------- */

// Reaching inside a banner needs the Chrome extension: its content script
// (js/isi-content.js) runs inside the banner and adds the classes that expand the ISI.
var isExtension = typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;

// Must match "version" in manifest.json. Chrome reads this file fresh from disk on
// every page load but keeps the old manifest until the extension is reloaded, so a
// mismatch means "reload the extension".
var EXPECTED_VERSION = "1.3.0";

var isiStatus = document.getElementById("isi-status");
var isiToggle = document.getElementById("isi-toggle");
var isiZoom = document.getElementById("isi-zoom");
var isiView = {
  job: null,        // the loaded banner
  stage: null,      // wrapper around the zoomed box
  box: null,        // box around the iframe that takes the zoomed size
  wanted: false,    // what the user asked for
  expanded: false,  // what the banner confirmed
  isiWidth: null,   // ISI width inside the banner, reported by the content script
  retry: null,
  timer: null,
  injectError: ""
};

var ISI_NEEDS_EXTENSION = "Expand ISI only works when Banner Hub is opened from the Chrome extension icon " +
  "(not by double-clicking index.html). Install it in chrome://extensions > Load unpacked.";

function isiSay(text, isError) {
  isiStatus.textContent = text;
  isiStatus.classList.toggle("error", !!isError);
}

function isiLayout() {
  var view = isiView;
  if (!view.job) return;
  var frame = view.job.frame;
  var sizeText = view.job.width + "x" + view.job.height;

  if (!view.expanded) {
    view.stage.classList.remove("expanded");
    view.box.style.width = "";
    view.box.style.height = "";
    frame.style.width = view.job.width + "px";
    frame.style.height = view.job.height + "px";
    frame.style.transform = "none";
    view.job.label.textContent = sizeText;
    return;
  }

  // The iframe keeps the ISI's real width (same line breaks as in the banner),
  // gets as tall as the window allows, and is scaled up by the zoom.
  var zoom = parseFloat(isiZoom.value) || 2;
  var width = view.isiWidth || view.job.width;
  var height = Math.max(200, window.innerHeight - 40);
  view.stage.classList.add("expanded");
  view.box.style.width = Math.round(width * zoom) + "px";
  view.box.style.height = height + "px";
  frame.style.width = width + "px";
  frame.style.height = (height / zoom) + "px";
  frame.style.transform = "scale(" + zoom + ")";
  view.job.label.textContent = sizeText + " — ISI only, " + Math.round(zoom * 100) + "%";
}

function isiStopWaiting() {
  clearInterval(isiView.retry);
  clearTimeout(isiView.timer);
}

function isiSend() {
  var view = isiView;
  if (!view.job) return;
  view.job.frame.contentWindow.postMessage({
    bannerHub: "isi",
    on: view.wanted,
    selector: document.getElementById("isi-selector").value
  }, "*");
}

// Second way in, besides the manifest: push the script into the banner frame on demand.
function isiInject() {
  isiView.injectError = "";
  try {
    chrome.tabs.getCurrent(function (tab) {
      if (!tab) return;
      // Only the banner frames: Chrome refuses the whole call if the Banner Hub
      // page itself (frame 0) is included.
      chrome.webNavigation.getAllFrames({ tabId: tab.id }, function (frames) {
        var ids = (frames || []).map(function (f) { return f.frameId; }).filter(function (id) { return id !== 0; });
        if (!ids.length) return;
        chrome.scripting.executeScript(
          { target: { tabId: tab.id, frameIds: ids }, files: ["js/isi-content.js"] },
          function () {
            if (chrome.runtime.lastError) isiView.injectError = chrome.runtime.lastError.message || "";
          }
        );
      });
    });
  } catch (err) {
    isiView.injectError = String(err && err.message || err);
  }
}

// Explains why a banner did not answer, as precisely as Chrome lets us know.
function explainSilence(url, injectError, say) {
  var detail = injectError ? " (Chrome said: " + injectError + ")" : "";
  var generic = "The banner did not answer" + detail + ". In chrome://extensions check that Banner Hub > " +
    "Details > Site access is \"On all sites\", reload the extension and retry.";
  var isLocal = /^file:/i.test(url);
  if (!isLocal || !chrome.extension || !chrome.extension.isAllowedFileSchemeAccess) {
    say(generic, true);
    return;
  }
  chrome.extension.isAllowedFileSchemeAccess(function (allowed) {
    say(allowed ? generic
      : "Local banners need permission: in chrome://extensions open Banner Hub > Details and turn on " +
        "\"Allow access to file URLs\", then retry.", true);
  });
}

function isiExplainSilence() {
  isiStopWaiting();
  explainSilence(isiView.job.url, isiView.injectError, isiSay);
}

function isiRequest() {
  var view = isiView;
  isiStopWaiting();

  var running = chrome.runtime.getManifest().version;
  if (running !== EXPECTED_VERSION) {
    isiSay("Chrome is still running an older copy of the extension (" + running + ", needs " + EXPECTED_VERSION +
      "). Go to chrome://extensions, click the circular arrow on Banner Hub, then open it again from its icon.", true);
    return;
  }

  isiSay(view.wanted ? "Expanding ISI…" : "");
  isiInject();
  isiSend();
  // The banner may still be loading, so keep asking until it answers.
  view.retry = setInterval(isiSend, 700);
  view.timer = setTimeout(isiExplainSilence, 6000);
}

function isiLoad() {
  var view = isiView;
  var keepExpanded = view.expanded || view.wanted;
  isiStopWaiting();

  var job = buildSlot(
    document.getElementById("isi-container"),
    document.getElementById("isi-url").value,
    document.getElementById("isi-size").value,
    "frame_isi"
  );
  view.job = job;
  view.expanded = false;
  view.isiWidth = null;
  view.wanted = false;
  isiToggle.textContent = "Expand ISI";
  if (!job) { isiSay("Enter a banner URL first.", true); return false; }

  // The iframe is never moved once loaded (that would reload the banner);
  // only these wrappers change size.
  view.stage = document.createElement("div");
  view.stage.className = "isi-stage";
  view.box = document.createElement("div");
  view.box.className = "isi-box";
  job.container.appendChild(view.stage);
  view.stage.appendChild(view.box);
  view.box.appendChild(job.frame);
  job.container.style.visibility = "visible";
  job.frame.src = job.url;
  isiSay(isExtension ? "" : ISI_NEEDS_EXTENSION, !isExtension);

  // Reloading while expanded keeps the ISI view.
  if (keepExpanded && isExtension) {
    view.wanted = true;
    isiRequest();
  }
  return true;
}

document.getElementById("isi-form").addEventListener("submit", function (e) {
  e.preventDefault();
  isiLoad();
});

isiToggle.addEventListener("click", function () {
  if (!isExtension) { isiSay(ISI_NEEDS_EXTENSION, true); return; }
  if (!isiView.job && !isiLoad()) return;
  isiView.wanted = !isiView.expanded;
  isiRequest();
});

window.addEventListener("message", function (e) {
  var view = isiView;
  var data = e.data;
  if (!view.job || e.source !== view.job.frame.contentWindow || !data) return;

  if (data.bannerHub === "ready") {
    if (view.wanted !== view.expanded) isiSend();
    return;
  }
  if (data.bannerHub !== "isi-result") return;
  if (!!data.on !== view.wanted) return;   // answer to an older request

  isiStopWaiting();
  if (data.on && !data.found) {
    view.wanted = false;
    view.expanded = false;
    isiSay("No ISI found in this banner. Type its selector (for example #my-isi) and try again.", true);
  } else {
    var changed = view.expanded !== !!data.on;
    view.expanded = !!data.on;
    if (data.width) view.isiWidth = data.width;
    isiSay(view.expanded && data.selector ? "ISI found: " + data.selector : "");
    isiToggle.textContent = view.expanded ? "Back to banner" : "Expand ISI";
    isiLayout();
    if (changed && view.expanded) view.job.label.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  isiToggle.textContent = "Expand ISI";
  isiLayout();
});

isiZoom.addEventListener("change", isiLayout);
window.addEventListener("resize", isiLayout);

if (!isExtension) isiSay(ISI_NEEDS_EXTENSION, true);

/* ---------- Timeline (GSAP scrubber) ---------- */

// js/scrub-page.js runs inside the banner, next to its GSAP, and moves every
// animation into one timeline. This page only sends it commands (play, pause,
// seek…) and draws the state it reports back.
var scrub = {
  job: null,
  found: false,
  answered: false,   // the script inside the banner replied at least once
  dragging: false,
  paused: false,
  ended: false,
  duration: 0,
  hello: null,
  timer: null,
  injectError: "",
  tabId: null
};

var scrubStatus = document.getElementById("scrub-status");
var scrubBar = document.getElementById("scrub-bar");
var scrubPlay = document.getElementById("scrub-play");
var scrubRestart = document.getElementById("scrub-restart");
var scrubRange = document.getElementById("scrub-range");
var scrubSpeed = document.getElementById("scrub-speed");
var scrubTime = document.getElementById("scrub-time");
var scrubTotal = document.getElementById("scrub-total");

var SCRUB_NEEDS_EXTENSION = "The timeline only works when Banner Hub is opened from the Chrome extension icon " +
  "(not by double-clicking index.html). Install it in chrome://extensions > Load unpacked.";

function scrubSay(text, isError) {
  scrubStatus.textContent = text;
  scrubStatus.classList.toggle("error", !!isError);
}

function scrubEnable(on) {
  scrubBar.classList.toggle("disabled", !on);
  [scrubPlay, scrubRestart, scrubRange, scrubSpeed].forEach(function (el) { el.disabled = !on; });
}

function scrubStopWaiting() {
  clearInterval(scrub.hello);
  clearTimeout(scrub.timer);
}

function scrubSend(cmd, extra) {
  if (!scrub.job) return;
  var message = extra || {};
  message.bannerHub = "scrub";
  message.cmd = cmd;
  scrub.job.frame.contentWindow.postMessage(message, "*");
}

// Puts the script inside the banner frames, in the page's own JavaScript world
// (the only place where the banner's GSAP is visible). It does nothing there
// until it gets a message, and only the Timeline banner gets one.
function scrubInject(frameIds) {
  if (scrub.tabId === null) return;
  function run(ids) {
    if (!ids.length) return;
    chrome.scripting.executeScript(
      { target: { tabId: scrub.tabId, frameIds: ids }, files: ["js/scrub-page.js"], world: "MAIN", injectImmediately: true },
      function () {
        if (chrome.runtime.lastError) scrub.injectError = chrome.runtime.lastError.message || "";
      }
    );
  }
  try {
    if (frameIds) { run(frameIds); return; }
    chrome.webNavigation.getAllFrames({ tabId: scrub.tabId }, function (frames) {
      run((frames || []).filter(function (f) { return f.frameId !== 0 && f.parentFrameId === 0; })
        .map(function (f) { return f.frameId; }));
    });
  } catch (err) {
    scrub.injectError = String(err && err.message || err);
  }
}

if (isExtension) {
  chrome.tabs.getCurrent(function (tab) {
    if (!tab) return;
    scrub.tabId = tab.id;
    // Inject as soon as the banner starts loading, so no animation is missed.
    chrome.webNavigation.onCommitted.addListener(function (details) {
      if (details.tabId !== scrub.tabId || details.frameId === 0 || details.parentFrameId !== 0) return;
      if (scrub.job && !scrub.found) scrubInject([details.frameId]);
    });
  });
}

function scrubLoad() {
  scrubStopWaiting();
  scrub.found = false;
  scrub.answered = false;
  scrub.dragging = false;
  scrub.duration = 0;
  scrub.injectError = "";
  scrubEnable(false);
  scrubDraw({ time: 0, duration: 0, paused: false, ended: false });

  var job = buildSlot(
    document.getElementById("scrub-container"),
    document.getElementById("scrub-url").value,
    document.getElementById("scrub-size").value,
    "frame_scrub"
  );
  scrub.job = job;
  if (!job) { scrubSay("Enter a banner URL first.", true); return; }
  job.container.style.visibility = "visible";
  if (!isExtension) { job.frame.src = job.url; scrubSay(SCRUB_NEEDS_EXTENSION, true); return; }

  scrubSay("Loading banner…");
  job.frame.onload = function () { scrubInject(); };
  job.frame.src = job.url;

  overlayLayout();

  // Keep knocking until the script inside the banner answers.
  scrub.hello = setInterval(function () {
    scrubInject();
    scrubSend("hello");
  }, 150);
  scrub.timer = setTimeout(function () {
    if (scrub.answered) return;
    scrubStopWaiting();
    explainSilence(job.url, scrub.injectError, scrubSay);
  }, 8000);
}

function scrubDraw(state) {
  scrub.paused = !!state.paused;
  scrub.ended = !!state.ended;
  if (state.duration !== scrub.duration) {
    scrub.duration = state.duration;
    scrubRange.max = state.duration > 0 ? state.duration.toFixed(2) : "1";
    scrubTotal.textContent = state.duration.toFixed(2);
  }
  if (!scrub.dragging) scrubRange.value = state.time;
  scrubTime.textContent = state.time.toFixed(2);
  scrubPlay.textContent = state.paused ? "Play" : (state.ended ? "Replay" : "Pause");
}

function scrubToggle() {
  if (!scrub.found) return;
  scrubSend(scrub.paused || scrub.ended ? "play" : "pause");
}

document.getElementById("scrub-form").addEventListener("submit", function (e) {
  e.preventDefault();
  scrubLoad();
});
scrubPlay.addEventListener("click", scrubToggle);
scrubRestart.addEventListener("click", function () { scrubSend("restart"); });
scrubSpeed.addEventListener("change", function () { scrubSend("speed", { speed: parseFloat(scrubSpeed.value) }); });
scrubRange.addEventListener("input", function () {
  scrub.dragging = true;
  scrubTime.textContent = (+scrubRange.value).toFixed(2);
  scrubSend("seek", { time: +scrubRange.value });
});
scrubRange.addEventListener("change", function () { scrub.dragging = false; });

window.addEventListener("message", function (e) {
  var data = e.data;
  if (!scrub.job || e.source !== scrub.job.frame.contentWindow || !data || data.bannerHub !== "scrub-state") return;

  scrub.answered = true;
  scrubStopWaiting();

  if (!data.found) {
    if (data.waiting) { scrubSay("Looking for the banner's animation…"); return; }
    scrub.found = false;
    scrubEnable(false);
    scrubSay(data.legacy
      ? "This banner uses GSAP 2 (TweenMax). The timeline only works with GSAP 3."
      : "No GSAP 3 animation found in this banner. The timeline only works with banners animated with GSAP 3.", true);
    return;
  }

  if (!scrub.found) {
    scrub.found = true;
    scrubEnable(true);
    // A reloaded banner starts at normal speed; send it the speed that is selected.
    if (scrubSpeed.value !== "1") scrubSend("speed", { speed: parseFloat(scrubSpeed.value) });
  }
  scrubSay(data.duration > 0 ? "" : "Waiting for the animation to start…");
  scrubDraw(data);
});

if (!isExtension) scrubSay(SCRUB_NEEDS_EXTENSION, true);


/* ---------- Timeline: overlay image (pixel-perfect check) ---------- */

// A reference image (the design comp) that floats above the banner. It lives
// outside the banner slot, so reloading the banner keeps it in place.
var overlay = { img: null, url: null, x: 0, y: 0 };
var ovStage = document.getElementById("scrub-stage");
var ovFile = document.getElementById("ov-file");
var ovScale = document.getElementById("ov-scale");
var ovOpacity = document.getElementById("ov-opacity");
var ovOpacityValue = document.getElementById("ov-opacity-value");
var ovX = document.getElementById("ov-x");
var ovY = document.getElementById("ov-y");
var ovToggle = document.getElementById("ov-toggle");
var ovControls = [ovScale, ovOpacity, ovX, ovY, ovToggle,
  document.getElementById("ov-reset"), document.getElementById("ov-remove")];

function overlayScale() {
  var value = parseFloat(ovScale.value);
  return value > 0 ? Math.min(10, Math.max(0.05, value)) : 1;
}

// Top-left corner of the banner inside the stage: X = 0, Y = 0 for the image.
function overlayOrigin() {
  if (!scrub.job) return { x: 0, y: 0 };
  var frame = scrub.job.frame.getBoundingClientRect();
  var stage = ovStage.getBoundingClientRect();
  return { x: frame.left - stage.left, y: frame.top - stage.top };
}

function overlayLayout() {
  var img = overlay.img;
  if (!img) return;
  var origin = overlayOrigin();
  img.style.left = (origin.x + overlay.x) + "px";
  img.style.top = (origin.y + overlay.y) + "px";
  if (img.naturalWidth) img.style.width = (img.naturalWidth * overlayScale()) + "px";
  img.style.opacity = ovOpacity.value;
  ovOpacityValue.textContent = (+ovOpacity.value).toFixed(2);
  if (document.activeElement !== ovX) ovX.value = overlay.x;
  if (document.activeElement !== ovY) ovY.value = overlay.y;
}

function overlayMoveTo(x, y) {
  overlay.x = Math.round(x);
  overlay.y = Math.round(y);
  overlayLayout();
}

function overlayRemove() {
  if (overlay.img) overlay.img.remove();
  if (overlay.url) URL.revokeObjectURL(overlay.url);
  overlay.img = null;
  overlay.url = null;
  ovControls.forEach(function (el) { el.disabled = true; });
}

function overlaySet(file) {
  if (!file || !/^image\//.test(file.type)) return;
  overlayRemove();

  var img = document.createElement("img");
  img.className = "overlay-img";
  img.alt = "Overlay image";
  img.draggable = false;
  img.tabIndex = 0;
  overlay.img = img;
  overlay.url = URL.createObjectURL(file);
  overlay.x = 0;
  overlay.y = 0;
  ovToggle.textContent = "Hide";
  ovControls.forEach(function (el) { el.disabled = false; });

  img.addEventListener("load", function () {
    overlayLayout();
    img.focus({ preventScroll: true });
  });

  // Mouse drag.
  var grab = null;
  img.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    img.focus({ preventScroll: true });
    img.setPointerCapture(e.pointerId);
    grab = { px: e.clientX, py: e.clientY, x: overlay.x, y: overlay.y };
  });
  img.addEventListener("pointermove", function (e) {
    if (grab) overlayMoveTo(grab.x + e.clientX - grab.px, grab.y + e.clientY - grab.py);
  });
  function release() { grab = null; }
  img.addEventListener("pointerup", release);
  img.addEventListener("pointercancel", release);

  // Arrow keys: 1 px, or 10 px with Shift.
  img.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 10 : 1;
    var dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    var dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    overlayMoveTo(overlay.x + dx, overlay.y + dy);
  });

  img.src = overlay.url;
  ovStage.appendChild(img);
}

function overlayFirstImage(files) {
  return Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type); })[0];
}

document.getElementById("ov-pick").addEventListener("click", function () { ovFile.click(); });
ovFile.addEventListener("change", function () {
  overlaySet(overlayFirstImage(ovFile.files));
  ovFile.value = "";   // so picking the same file again still fires "change"
});
ovScale.addEventListener("input", overlayLayout);
ovOpacity.addEventListener("input", overlayLayout);
ovX.addEventListener("input", function () { overlayMoveTo(parseFloat(ovX.value) || 0, overlay.y); });
ovY.addEventListener("input", function () { overlayMoveTo(overlay.x, parseFloat(ovY.value) || 0); });
ovToggle.addEventListener("click", function () {
  if (!overlay.img) return;
  overlay.img.hidden = !overlay.img.hidden;
  ovToggle.textContent = overlay.img.hidden ? "Show" : "Hide";
});
document.getElementById("ov-reset").addEventListener("click", function () { overlayMoveTo(0, 0); });
document.getElementById("ov-remove").addEventListener("click", overlayRemove);
window.addEventListener("resize", overlayLayout);

// Drop an image anywhere while the Timeline tab is open. Handling it on the whole
// page also stops Chrome from navigating away to the dropped file.
var ovPanel = document.getElementById("tab-timeline");
function isFileDrag(e) {
  return activeTab === "timeline" && e.dataTransfer &&
    Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
}
document.addEventListener("dragover", function (e) {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  ovPanel.classList.add("dropping");
});
document.addEventListener("dragleave", function (e) {
  if (!e.relatedTarget) ovPanel.classList.remove("dropping");
});
document.addEventListener("drop", function (e) {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  ovPanel.classList.remove("dropping");
  overlaySet(overlayFirstImage(e.dataTransfer.files));
});

// Paste an image (for example a screenshot) while the Timeline tab is open.
document.addEventListener("paste", function (e) {
  if (activeTab !== "timeline" || !e.clipboardData) return;
  var file = overlayFirstImage(e.clipboardData.files);
  if (!file) return;
  e.preventDefault();
  overlaySet(file);
});
