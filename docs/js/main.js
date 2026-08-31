(function () {
  "use strict";

  var THEME_KEY = "cv2-theme";

  /* ---------------------------------------------------------------- theme */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* private mode — ignore */
    }
  }

  function initTheme() {
    var stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {
      /* ignore */
    }

    var theme = stored || "dark";
    if (!stored && window.matchMedia) {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    applyTheme(theme);
  }

  function bindThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  /* ------------------------------------------------------ mobile sidebar */
  function bindSidebar() {
    var burger = document.getElementById("sidebar-toggle");
    if (!burger) return;

    function close() {
      document.body.classList.remove("sidebar-open");
    }

    burger.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });

    var mask = document.getElementById("sidebar-mask");
    if (mask) mask.addEventListener("click", close);

    document.querySelectorAll(".sidebar a").forEach(function (a) {
      a.addEventListener("click", close);
    });
  }

  /* ----------------------------------------------------------- copy code */
  var COPY_ICON = '<span aria-hidden="true">⧉</span> Копировать';
  var COPY_DONE = '<span aria-hidden="true">✓</span> Скопировано';

  function bindCopyButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".copy-btn");
      if (!btn) return;

      var block = btn.closest(".code-block");
      if (!block) return;

      var codeEl = block.querySelector("pre code");
      if (!codeEl) return;

      var text = codeEl.innerText; // source text, not highlighted markup
      copyText(text).then(function (ok) {
        if (!ok) return;
        btn.classList.add("copied");
        btn.innerHTML = COPY_DONE;
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = COPY_ICON;
        }, 1600);
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------------------------------------ typewriter */
  function bindTypewriter() {
    var el = document.querySelector("[data-typewriter]");
    if (!el) return;

    var text = el.textContent;
    el.textContent = "";

    var caret = document.createElement("span");
    caret.className = "caret";
    caret.setAttribute("aria-hidden", "true");
    el.appendChild(caret);

    var i = 0;
    var started = false;

    function tick() {
      if (!started) {
        started = true;
      }
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text.charAt(i)), caret);
        i += 1;
        setTimeout(tick, 24 + Math.random() * 48);
      }
    }

    setTimeout(tick, 360);
  }

  /* ------------------------------------------------------------ entry hook */
  function init() {
    initTheme();
    bindThemeToggle();
    bindSidebar();
    bindCopyButtons();
    bindTypewriter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();