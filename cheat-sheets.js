// ===== INITIALIZATION & STATE MANAGEMENT =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("Cheat Sheets Page Initialized");
  
  // Hide loading screen
  setTimeout(() => {
    const loader = document.getElementById("loading-screen");
    if (loader) {
      loader.classList.add("hidden");
    }
  }, 1000);

  // Initialize Dark/Light Mode Sync
  syncTheme();

  // Initialize Navbar toggle
  initNavbar();

  // Initialize Print Flow
  initPrint();

  // Scroll to Top logic
  initScrollTop();
});

// ===== DARK/LIGHT THEME SYNCHRONIZATION =====
function syncTheme() {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;
  const icon = toggle.querySelector("i");

  // Check saved preference
  const savedMode = localStorage.getItem("darkMode");
  if (savedMode === "light") {
    document.body.classList.add("light-mode");
    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
  }

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    if (icon) {
      icon.classList.toggle("fa-moon");
      icon.classList.toggle("fa-sun");
    }
    localStorage.setItem("darkMode", isLight ? "light" : "dark");
  });
}

// ===== MOBILE NAVBAR DRIVER =====
function initNavbar() {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      const icon = menuToggle.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-bars");
        icon.classList.toggle("fa-times");
      }
    });

    // Close menu when a navigation item is clicked
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        const icon = menuToggle.querySelector("i");
        if (icon) {
          icon.classList.add("fa-bars");
          icon.classList.remove("fa-times");
        }
      });
    });
  }
}

// ===== PDF EXPORT DRIVER =====
function initPrint() {
  const exportBtn = document.getElementById("exportPdfBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      window.print();
    });
  }
}

// ===== SCROLL TO TOP DRIVER =====
function initScrollTop() {
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  if (!scrollTopBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add("visible");
    } else {
      scrollTopBtn.classList.remove("visible");
    }
  });

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
