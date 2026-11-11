// Banner Hub — ISI expander (content script).
// Runs inside a banner only when that banner is loaded in an iframe of the
// Banner Hub page. Everywhere else it exits on the first lines and does nothing.
(function () {
  "use strict";

  if (window.top === window) return;
  var HUB = "chrome-extension://" + chrome.runtime.id;
  var ancestors = location.ancestorOrigins;
  if (!ancestors || ancestors[0] !== HUB) return;

  // The script can arrive twice (from the manifest and injected on demand).
  if (window.__bannerHubIsi) {
    window.parent.postMessage({ bannerHub: "ready" }, HUB);
    return;
  }
  window.__bannerHubIsi = true;

  // Tried in order when no selector is typed in the tool. First match wins.
  var CANDIDATES = [
    ".isi-container", "#isi-container", "#isi", ".isi", "#ISI", ".ISI",
    '[id^="isi" i]', '[class^="isi" i]', '[class*=" isi" i]'
  ];

  // Classes this script generates:
  //   html.bh-isi-on     -> the expanded view is active
  //   .bh-isi-target     -> the ISI element, stretched to fill the whole frame
  //   .bh-isi-ancestor   -> every wrapper around the ISI, neutralised so nothing clips it
  // Everything that is not on the path to the ISI is hidden.
  var CSS = [
    // Assemble template: the ISI height comes from this variable.
    "html.bh-isi-on { --isi-viewport-collapsed-size: 100% !important; }",
    "html.bh-isi-on, html.bh-isi-on body {",
    "  width: 100% !important; height: 100% !important; min-height: 0 !important;",
    "  margin: 0 !important; padding: 0 !important; overflow: hidden !important;",
    "  background: #fff !important;",
    "}",
    "html.bh-isi-on .bh-isi-ancestor {",
    "  display: block !important; position: static !important;",
    "  width: 100% !important; height: 100% !important;",
    "  max-width: none !important; max-height: none !important;",
    "  margin: 0 !important; padding: 0 !important; border: 0 !important;",
    "  overflow: hidden !important; opacity: 1 !important; visibility: visible !important;",
    "  transform: none !important; perspective: none !important; filter: none !important;",
    "  clip: auto !important; clip-path: none !important;",
    "}",
    "html.bh-isi-on .bh-isi-ancestor::before, html.bh-isi-on .bh-isi-ancestor::after {",
    "  display: none !important;",
    "}",
    "html.bh-isi-on body > *:not(.bh-isi-ancestor):not(.bh-isi-target),",
    "html.bh-isi-on .bh-isi-ancestor > *:not(.bh-isi-ancestor):not(.bh-isi-target) {",
    "  display: none !important;",
    "}",
    "html.bh-isi-on .bh-isi-target {",
    "  display: block !important; position: fixed !important;",
    "  top: 0 !important; left: 0 !important; right: auto !important; bottom: auto !important;",
    "  width: 100% !important; height: 100% !important;",
    "  max-width: none !important; max-height: none !important; margin: 0 !important;",
    "  opacity: 1 !important; visibility: visible !important; transform: none !important;",
    "  z-index: 2147483000 !important;",
    "}"
  ].join("\n");

  var originalWidth = null;   // ISI width inside the banner, measured before expanding
  var loadedAt = null;

  function findIsi(custom) {
    var list = custom ? [custom] : CANDIDATES;
    for (var i = 0; i < list.length; i++) {
      try {
        var el = document.querySelector(list[i]);
        if (el && el !== document.body && el !== document.documentElement) {
          return { el: el, selector: list[i] };
        }
      } catch (err) { /* invalid selector typed by the user */ }
    }
    return null;
  }

  function clearClasses() {
    document.documentElement.classList.remove("bh-isi-on");
    document.querySelectorAll(".bh-isi-target, .bh-isi-ancestor").forEach(function (el) {
      el.classList.remove("bh-isi-target", "bh-isi-ancestor");
    });
  }

  function reply(data) {
    data.bannerHub = "isi-result";
    window.parent.postMessage(data, HUB);
  }

  function apply(on, custom) {
    clearClasses();
    if (!on) { reply({ on: false, found: true }); return; }

    var hit = findIsi(custom);
    if (!hit) { reply({ on: true, found: false }); return; }

    // Measured with the banner in its normal state, so the tool can keep the
    // ISI at its real width (and its real line breaks) when it zooms in.
    if (originalWidth === null && hit.el.offsetWidth > 0) originalWidth = hit.el.offsetWidth;

    if (!document.getElementById("bh-isi-style")) {
      var style = document.createElement("style");
      style.id = "bh-isi-style";
      style.textContent = CSS;
      document.documentElement.appendChild(style);
    }

    hit.el.classList.add("bh-isi-target");
    var parent = hit.el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      parent.classList.add("bh-isi-ancestor");
      parent = parent.parentElement;
    }
    document.documentElement.classList.add("bh-isi-on");

    reply({ on: true, found: true, width: originalWidth, selector: hit.selector });
  }

  // Banners often add their stylesheets after the load event, so wait a moment
  // after load before measuring and expanding.
  function whenSettled(run) {
    function afterLoad() {
      if (loadedAt === null) loadedAt = Date.now();
      setTimeout(run, Math.max(0, 700 - (Date.now() - loadedAt)));
    }
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== HUB || e.source !== window.parent) return;
    var data = e.data;
    if (!data || data.bannerHub !== "isi") return;
    var custom = typeof data.selector === "string" ? data.selector.trim() : "";
    whenSettled(function () { apply(!!data.on, custom); });
  });

  if (document.readyState === "complete") loadedAt = Date.now();
  else window.addEventListener("load", function () { loadedAt = Date.now(); }, { once: true });

  window.parent.postMessage({ bannerHub: "ready" }, HUB);
})();
