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
function isSpaceShortcut(e) {
  if (!clocks[activeTab]) return false;
  if (e.code !== "Space" && e.key !== " ") return false;
  var el = e.target;
  var tag = el.tagName;
  if (tag === "SELECT" || tag === "TEXTAREA") return false;
  if (tag === "INPUT" && el.type !== "submit" && el.type !== "button") return false;
  return true;
}
document.addEventListener("keydown", function (e) {
  if (!isSpaceShortcut(e)) return;
  e.preventDefault();
  if (!e.repeat) clocks[activeTab].mark();
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
var EXPECTED_VERSION = "1.2.0";

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

// Explains why the banner did not answer, as precisely as Chrome lets us know.
function isiExplainSilence() {
  isiStopWaiting();
  var detail = isiView.injectError ? " (Chrome said: " + isiView.injectError + ")" : "";
  var generic = "The banner did not answer" + detail + ". In chrome://extensions check that Banner Hub > " +
    "Details > Site access is \"On all sites\", reload the extension and retry.";
  var isLocal = /^file:/i.test(isiView.job.url);
  if (!isLocal || !chrome.extension || !chrome.extension.isAllowedFileSchemeAccess) {
    isiSay(generic, true);
    return;
  }
  chrome.extension.isAllowedFileSchemeAccess(function (allowed) {
    isiSay(allowed ? generic
      : "Local banners need permission: in chrome://extensions open Banner Hub > Details and turn on " +
        "\"Allow access to file URLs\", then retry.", true);
  });
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
