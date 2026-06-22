# Pull Request: Interactive DSA Algorithm Visualizer (Adventure V3)

## 🎯 Description
Resolves issue #454 (Choose Your DSA Adventure).

This PR introduces a premium, highly interactive "Algorithm Explorer" to teach data structures and algorithms through live execution, addressing the core problem of teaching algorithm tradeoffs visually rather than through static text.

## ✨ Key Features
1. **Split-Pane Architecture**:
   - **Command Center**: Narrative scenario, algorithmic choices, and live theoretical metrics (Time/Space complexity).
   - **Execution Arena**: A live CSS-grid environment where algorithms actually execute physically on the DOM.
   - **Live Inspector**: A dedicated panel showing the exact state of the algorithm's memory structure (Stack vs Queue).
2. **Interactive Controls**: Play, Pause, Step Forward, and Stop functionality with a dynamic execution speed slider.
3. **Cyber-Physical UI**: Advanced CSS aesthetics including glassmorphism, neon box-shadows, and pulsing animations to provide a premium IDE feel.
4. **Action Logger**: A highly readable, capped terminal log explaining every operation the algorithm takes.

## 🛠️ Changes Made
- **[NEW]** `pages/learning/dsa-adventure/dsa-adventure.html`: The 3-panel layout structure.
- **[NEW]** `pages/learning/dsa-adventure/dsa-adventure.css`: The ultra-premium sci-fi aesthetic.
- **[NEW]** `pages/learning/dsa-adventure/dsa-adventure.js`: The Javascript engine handling the maze generation, BFS/DFS traversal loops, pausing/stepping mechanics, and UI DOM manipulation.
- **[MODIFIED]** `partials/navbar.html`: Added the link to the new feature under the "Learn" dropdown.
- **[MODIFIED]** `script.js`: Added null-checks to global DOM operations (`#loading-screen`, `#xpBar`) so the main site scripts don't crash on pages missing those elements.

## 🧪 Verification
- Tested locally: Both BFS and DFS paths execute without freezing the browser thanks to asynchronous `sleep` mechanisms.
- Pausing, Stepping, and Speed control mechanisms verified.
- Memory structure (Stack/Queue) UI verified to update perfectly in sync with the algorithm state.

## 📸 Screenshots
*(Please attach screenshots of the 3-panel UI and live execution here)*
