export function initNavbar() {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  let overlay = document.querySelector(".nav-overlay");
  if (!overlay && menuToggle && navLinks) {
    overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);
  }

  const toggleMenu = (open) => {
    const isOpen = open !== undefined ? open : !navLinks.classList.contains("active");
    navLinks.classList.toggle("active", isOpen);
    menuToggle.setAttribute("aria-expanded", isOpen);
    overlay.classList.toggle("active", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";

    const icon = menuToggle.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-bars", !isOpen);
      icon.classList.toggle("fa-times", isOpen);
    }
  };

  const closeMenu = () => {
    if (!navLinks.classList.contains("active")) return;
    toggleMenu(false);
  };

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    overlay.addEventListener("click", closeMenu);

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
  }

  initDropdowns();
}

function initDropdowns() {
  const dropdownToggles = document.querySelectorAll(".dropdown-toggle");
  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

  dropdownToggles.forEach((toggle) => {
    const parent = toggle.closest(".has-dropdown");
    const menu = parent?.querySelector(".dropdown-menu");

    if (!parent || !menu) return;

    if (isMobile()) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = parent.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen);
      });
    } else {
      let hoverTimeout;

      const showMenu = () => {
        clearTimeout(hoverTimeout);
        parent.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      };

      const hideMenu = () => {
        hoverTimeout = setTimeout(() => {
          parent.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }, 250);
      };

      parent.addEventListener("mouseenter", showMenu);
      parent.addEventListener("mouseleave", hideMenu);

      toggle.addEventListener("focus", showMenu);
      menu.addEventListener("focusin", showMenu);
      parent.addEventListener("focusout", hideMenu);

      toggle.addEventListener("click", (e) => {
        if (isMobile()) {
          e.preventDefault();
          const isOpen = parent.classList.toggle("open");
          toggle.setAttribute("aria-expanded", isOpen);
        }
      });
    }

    menu.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        if (isMobile()) {
          parent.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      document.querySelectorAll(".has-dropdown.open").forEach((el) => {
        el.classList.remove("open");
      });
      dropdownToggles.forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
      });
    }
  });
}