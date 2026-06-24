// pages/profile/profile.js

document.addEventListener('DOMContentLoaded', () => {
    // We rely on userProgress and practiceProblems being globally available from script.js
    
    // Configuration
    const ITEMS_PER_PAGE = 12;
    let currentPage = 1;
    let filteredProblems = [];

    // DOM Elements
    const grid = document.getElementById('solvedGrid');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('profilePagination');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const searchInput = document.getElementById('searchSolved');
    const difficultyFilter = document.getElementById('difficultyFilter');
    
    // Profile Header Elements
    const userNameEl = document.getElementById('userName');
    const userLevelEl = document.getElementById('userLevel');
    const userStreakEl = document.getElementById('userStreak');
    const userXPEl = document.getElementById('userXP');
    const solvedCountEl = document.getElementById('solvedCount');

    // Wait a brief moment to ensure script.js has loaded userProgress from localStorage
    setTimeout(() => {
        initProfile();
    }, 100);

    function initProfile() {
        // Populate Header Data
        if (typeof userProgress !== 'undefined') {
            userNameEl.textContent = userProgress.name || "Learner";
            userLevelEl.textContent = `Level ${userProgress.level || 1}`;
            userStreakEl.textContent = userProgress.streak || 0;
            userXPEl.textContent = userProgress.xp || 0;
            
            // Map completed IDs to actual problem objects
            const solvedIds = userProgress.completedProblems || [];
            
            if (typeof practiceProblems !== 'undefined') {
                filteredProblems = solvedIds.map(id => {
                    const prob = practiceProblems.find(p => p.id === id);
                    if (prob) {
                        return { ...prob, completedAt: "Unknown" }; // Add mock completion date for now
                    }
                    return null;
                }).filter(Boolean); // remove nulls
            }
            
            solvedCountEl.textContent = filteredProblems.length;
            
            // Initial render
            applyFilters();
        }
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const difficulty = difficultyFilter.value;

        // Reset to full list
        const solvedIds = userProgress.completedProblems || [];
        let allSolved = solvedIds.map(id => practiceProblems.find(p => p.id === id)).filter(Boolean);

        // Apply Search
        if (searchTerm) {
            allSolved = allSolved.filter(p => p.title.toLowerCase().includes(searchTerm) || (p.tags && p.tags.some(t => t.toLowerCase().includes(searchTerm))));
        }

        // Apply Difficulty Filter
        if (difficulty !== 'all') {
            allSolved = allSolved.filter(p => p.difficulty === difficulty);
        }

        filteredProblems = allSolved;
        currentPage = 1; // Reset to page 1
        
        renderGrid();
    }

    function renderGrid() {
        grid.innerHTML = '';
        
        if (filteredProblems.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            pagination.classList.add('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        // Calculate pagination
        const totalPages = Math.ceil(filteredProblems.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const currentBatch = filteredProblems.slice(startIndex, endIndex);

        // Render cards
        currentBatch.forEach(problem => {
            const card = document.createElement('div');
            card.className = 'problem-card';
            
            // Generate tags HTML
            const tagsHtml = problem.tags ? problem.tags.slice(0, 3).map(tag => `<span class="tag" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(255,255,255,0.1); border-radius: 10px; margin-right: 0.5rem;">${tag}</span>`).join('') : '';

            card.innerHTML = `
                <div class="problem-header" style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3 class="problem-title">${problem.title}</h3>
                        <span class="difficulty-badge ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
                    </div>
                    <button class="export-md-btn" title="Export as Markdown" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; transition: color 0.2s;">
                        <i class="fas fa-file-download"></i>
                    </button>
                </div>
                <div class="problem-tags" style="margin-bottom: 1rem; margin-top: 0.5rem;">
                    ${tagsHtml}
                </div>
                <div class="problem-meta">
                    <span class="category"><i class="fas fa-folder"></i> ${problem.category || 'General'}</span>
                    <span class="completion-date"><i class="fas fa-calendar-check"></i> Past</span>
                </div>
            `;
            
            // Add click listener to go to problem
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                // Ignore clicks on the export button
                if (e.target.closest('.export-md-btn')) {
                    const solution = userProgress.submittedSolutions ? userProgress.submittedSolutions[problem.id] : null;
                    if (typeof exportProblemAsMarkdown === 'function') {
                        exportProblemAsMarkdown(problem, solution);
                    } else {
                        console.error("Export utility not found.");
                    }
                    return;
                }

                if (typeof openQuizEditor === 'function') {
                    // We need to trigger the editor, maybe navigate to main page with a hash
                    window.location.href = `../../index.html?problem=${problem.id}#practice`;
                }
            });

            grid.appendChild(card);
        });

        // Update Pagination Controls
        if (totalPages > 1) {
            pagination.classList.remove('hidden');
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
        } else {
            pagination.classList.add('hidden');
        }
    }

    // Event Listeners
    searchInput.addEventListener('input', applyFilters);
    difficultyFilter.addEventListener('change', applyFilters);

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGrid();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
        }
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredProblems.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderGrid();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: 'smooth' });
        }
    });

});
