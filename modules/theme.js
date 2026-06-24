export function initTheme() {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;

  const icon = toggle.querySelector("i");
  
  // Theme is already initialized by inline script, just sync icon
  const isLight = document.documentElement.classList.contains("light-mode");
  if (icon) {
    if (isLight) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    } else {
      icon.classList.remove("fa-sun");
      icon.classList.add("fa-moon");
    }
  }

  toggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("light-mode");
    const currentlyLight = document.documentElement.classList.contains("light-mode");

    if (icon) {
      if (currentlyLight) {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
      } else {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
      }
    }

    localStorage.setItem("theme", currentlyLight ? "light" : "dark");
  });

  // Sync across tabs
  window.addEventListener('storage', (event) => {
    if (event.key === 'theme') {
      const isEventLight = event.newValue === 'light';
      if (isEventLight) {
        document.documentElement.classList.add('light-mode');
        if (icon) {
          icon.classList.remove("fa-moon");
          icon.classList.add("fa-sun");
        }
      } else {
        document.documentElement.classList.remove('light-mode');
        if (icon) {
          icon.classList.remove("fa-sun");
          icon.classList.add("fa-moon");
        }
      }
    }
  });
}
