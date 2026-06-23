// ===== THEME MANAGER — loaded on every page =====
(function () {

  // ── 1. Apply saved theme IMMEDIATELY (prevents flash on load) ──
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
  }

  // ── 2. Everything else runs after the toggle is in the DOM ──
  function initTheme() {
    const toggles = document.querySelectorAll("#darkModeToggle");
    if (!toggles.length) return;

    function syncIcons() {
      const isLight = document.body.classList.contains("light-mode");
      toggles.forEach(function (toggle) {
        const icon = toggle.querySelector("i");
        if (!icon) return;
        if (isLight) {
          icon.classList.remove("fa-moon");
          icon.classList.add("fa-sun");
        } else {
          icon.classList.remove("fa-sun");
          icon.classList.add("fa-moon");
        }
      });
    }

    function syncNavbar() {
      const navbar = document.querySelector(".navbar");
      if (!navbar) return;
      const isLight = document.body.classList.contains("light-mode");
      const scrolled = window.scrollY > 100;
      navbar.style.background = isLight
        ? ("rgba(255, 255, 255, " + (scrolled ? "0.98" : "0.85") + ")")
        : ("rgba(10, 10, 26, " + (scrolled ? "0.95" : "0.85") + ")");
    }

    syncIcons();
    syncNavbar();

    toggles.forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        document.body.classList.toggle("light-mode");
        const isLight = document.body.classList.contains("light-mode");
        localStorage.setItem("theme", isLight ? "light" : "dark");
        syncIcons();
        syncNavbar();
      });
    });

    window.addEventListener("scroll", syncNavbar);
  }

  function waitForToggle() {
    if (document.querySelector("#darkModeToggle")) {
      initTheme();
    } else {
      const observer = new MutationObserver(function () {
        if (document.querySelector("#darkModeToggle")) {
          observer.disconnect();
          initTheme();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForToggle);
  } else {
    waitForToggle();
  }

})();