window.addEventListener("load", () => {
  const loader = document.getElementById("loading-screen");

  if (loader) {
    loader.style.display = "none";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("Personalized Learning Path JS Loaded");

  const generateBtn = document.getElementById("generateBtn");
  const goalSelect = document.getElementById("goalSelect");
  const roadmapContainer = document.getElementById("roadmapContainer");
  const progressText = document.getElementById("progressText");

  console.log({
    generateBtn,
    goalSelect,
    roadmapContainer,
    progressText
  });

  if (!generateBtn || !goalSelect || !roadmapContainer || !progressText) {
    console.error("Required elements not found");
    return;
  }

  const paths = {
    beginner: [
      "Programming Fundamentals",
      "Arrays & Strings",
      "Linked Lists",
      "Stacks & Queues",
      "Trees",
      "Graphs",
      "Dynamic Programming",
      "System Design Basics"
    ],
    placement: [
      "Aptitude",
      "OOP",
      "DBMS",
      "Operating Systems",
      "Computer Networks",
      "DSA Practice",
      "Mock Interviews"
    ],
    faang: [
      "Advanced DSA",
      "Graphs",
      "Dynamic Programming",
      "System Design",
      "Behavioral Interviews",
      "Mock Coding Rounds"
    ]
  };

  generateBtn.addEventListener("click", () => {
    console.log("Generate clicked");

    const goal = goalSelect.value;

    if (!goal || !paths[goal]) {
      alert("Please select a learning goal.");
      return;
    }

    roadmapContainer.innerHTML = "";

    paths[goal].forEach((topic) => {
      const card = document.createElement("div");
      card.className = "tip-card";

      card.innerHTML = `
        <label class="topic-item">
          <input type="checkbox" class="topic-checkbox">
          ${topic}
        </label>
      `;

      roadmapContainer.appendChild(card);
    });

    updateProgress();

    document.querySelectorAll(".topic-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", updateProgress);
    });
  });

  function updateProgress() {
    const checkboxes = document.querySelectorAll(".topic-checkbox");
    const completed = document.querySelectorAll(
      ".topic-checkbox:checked"
    ).length;

    const total = checkboxes.length;
    const percentage =
      total === 0 ? 0 : Math.round((completed / total) * 100);

    progressText.textContent =
      `${percentage}% Completed (${completed}/${total})`;
  }
});
