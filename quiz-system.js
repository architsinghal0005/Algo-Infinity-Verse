/**
 * quiz-system.js
 * Solves Issue #102: Implements a centralized, scalable MVC-style Quiz Architecture.
 * - Separates Data, State, and UI Logic.
 * - Resolves state duplication and scaling issues.
 */

// ==========================================
// 1. DATA LAYER (The Model)
// ==========================================
const QuizData = {
    categories: [
        {
            id: 'arrays',
            title: 'Arrays & Hashing',
            icon: 'fa-layer-group',
            desc: 'Test your knowledge on static arrays, dynamic arrays, and hash maps.',
            questions: [
                {
                    q: "What is the average time complexity for searching an element in a Hash Map?",
                    options: ["O(N)", "O(log N)", "O(1)", "O(N log N)"],
                    correct: 2, // Index of correct option
                    explanation: "Hash maps use hashing to compute an index, providing O(1) average lookup time."
                },
                {
                    q: "Which operation is generally slowest in a standard contiguous Array?",
                    options: ["Accessing by index", "Inserting at the end", "Inserting at the beginning", "Updating an element"],
                    correct: 2,
                    explanation: "Inserting at the beginning requires shifting all existing elements, taking O(N) time."
                }
            ]
        },
        {
            id: 'dp',
            title: 'Dynamic Programming',
            icon: 'fa-brain',
            desc: 'Evaluate your understanding of memoization and tabulation.',
            questions: [
                {
                    q: "What are the two required properties for a problem to be solved with Dynamic Programming?",
                    options: ["Recursion and Trees", "Overlapping Subproblems and Optimal Substructure", "Greedy Choice and Sorting", "Divide and Conquer"],
                    correct: 1,
                    explanation: "DP requires Overlapping Subproblems (to cache) and Optimal Substructure (to build solutions)."
                },
                {
                    q: "Which DP approach generally avoids recursion stack overflow?",
                    options: ["Memoization (Top-Down)", "Tabulation (Bottom-Up)", "Backtracking", "Divide and Conquer"],
                    correct: 1,
                    explanation: "Tabulation iteratively builds an array from the base cases up, requiring no call stack."
                }
            ]
        }
    ]
};

// ==========================================
// 2. STATE MANAGEMENT (Centralized State)
// ==========================================
class QuizState {
    constructor() {
        this.reset();
    }

    reset() {
        this.activeCategoryId = null;
        this.questions = [];
        this.currentIndex = 0;
        this.score = 0;
        this.hasAnsweredCurrent = false;
    }

    startQuiz(categoryId) {
        this.reset();
        this.activeCategoryId = categoryId;
        const category = QuizData.categories.find(c => c.id === categoryId);
        this.questions = category ? category.questions : [];
    }

    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    getProgress() {
        return {
            current: this.currentIndex + 1,
            total: this.questions.length,
            percentage: ((this.currentIndex) / this.questions.length) * 100
        };
    }

    submitAnswer(selectedIndex) {
        this.hasAnsweredCurrent = true;
        const isCorrect = selectedIndex === this.getCurrentQuestion().correct;
        if (isCorrect) this.score++;
        return isCorrect;
    }

    nextQuestion() {
        this.currentIndex++;
        this.hasAnsweredCurrent = false;
        return this.currentIndex < this.questions.length; // returns true if more questions exist
    }

    getFinalScore() {
        return {
            score: this.score,
            total: this.questions.length,
            percentage: Math.round((this.score / this.questions.length) * 100)
        };
    }
}

// ==========================================
// 3. UI CONTROLLER (Presentation Layer)
// ==========================================
class QuizUI {
    constructor(controller) {
        this.controller = controller; // Reference to main orchestrator
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        this.views = {
            categories: document.getElementById('view-categories'),
            quiz: document.getElementById('view-active-quiz'),
            results: document.getElementById('view-results')
        };
        
        // Category View Elements
        this.categoryGrid = document.getElementById('categoryGrid');
        
        // Active Quiz Elements
        this.quizTopicLabel = document.getElementById('quizTopicLabel');
        this.quizProgressLabel = document.getElementById('quizProgressLabel');
        this.quizProgressBar = document.getElementById('quizProgressBar');
        this.questionText = document.getElementById('questionText');
        this.optionsGrid = document.getElementById('optionsGrid');
        this.feedbackMsg = document.getElementById('feedbackMsg');
        this.btnNextQuestion = document.getElementById('btnNextQuestion');
        this.btnExitQuiz = document.getElementById('btnExitQuiz');

        // Results View Elements
        this.finalScoreDisplay = document.getElementById('finalScoreDisplay');
        this.resultsMessage = document.getElementById('resultsMessage');
        this.btnRestartQuiz = document.getElementById('btnRestartQuiz');
        this.btnReturnHome = document.getElementById('btnReturnHome');
    }

    bindEvents() {
        this.btnNextQuestion.addEventListener('click', () => this.controller.handleNextQuestion());
        this.btnExitQuiz.addEventListener('click', () => this.controller.handleExit());
        this.btnRestartQuiz.addEventListener('click', () => this.controller.handleRestart());
        this.btnReturnHome.addEventListener('click', () => this.controller.handleExit());
    }

    switchView(viewName) {
        Object.values(this.views).forEach(v => v.classList.replace('active', 'hidden'));
        this.views[viewName].classList.replace('hidden', 'active');
    }

    renderCategories(categories) {
        this.categoryGrid.innerHTML = '';
        categories.forEach(cat => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'cat-card';
            card.setAttribute('aria-label', `Start ${cat.title} module`);
            card.innerHTML = `
                <i class="fas ${cat.icon} cat-icon"></i>
                <h4 class="cat-title">${cat.title}</h4>
                <p class="cat-desc">${cat.desc}</p>
            `;
            card.addEventListener('click', () => this.controller.handleStartQuiz(cat.id));
            this.categoryGrid.appendChild(card);
        });
    }

    renderQuestion(questionData, progressData, categoryTitle) {
        // Update Headers
        this.quizTopicLabel.textContent = categoryTitle;
        this.quizProgressLabel.textContent = `Question ${progressData.current} of ${progressData.total}`;
        this.quizProgressBar.style.width = `${progressData.percentage}%`;
        
        // Reset state
        this.btnNextQuestion.disabled = true;
        this.feedbackMsg.textContent = '';
        this.feedbackMsg.className = 'feedback-msg';
        
        // Render Question & Options
        this.questionText.textContent = questionData.q;
        this.optionsGrid.innerHTML = '';
        
        questionData.options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.addEventListener('click', () => this.controller.handleAnswer(index, btn));
            this.optionsGrid.appendChild(btn);
        });
    }

    showAnswerFeedback(selectedIndex, correctIndex, explanation, isCorrect, clickedBtn) {
        const allBtns = this.optionsGrid.querySelectorAll('.option-btn');
        allBtns.forEach(btn => btn.disabled = true); // Lock all options

        if (isCorrect) {
            clickedBtn.classList.add('correct');
            clickedBtn.innerHTML += ' <i class="fas fa-check-circle"></i>';
            this.feedbackMsg.textContent = "Correct! " + explanation;
            this.feedbackMsg.className = 'feedback-msg success';
        } else {
            clickedBtn.classList.add('wrong');
            clickedBtn.innerHTML += ' <i class="fas fa-times-circle"></i>';
            allBtns[correctIndex].classList.add('correct'); // Reveal correct
            
            this.feedbackMsg.textContent = "Incorrect. " + explanation;
            this.feedbackMsg.className = 'feedback-msg error';
        }

        this.btnNextQuestion.disabled = false; // Enable next button
    }

    renderResults(scoreData) {
        this.quizProgressBar.style.width = '100%'; // max out progress
        this.finalScoreDisplay.textContent = `${scoreData.percentage}%`;
        
        if (scoreData.percentage >= 80) {
            this.resultsMessage.textContent = "Outstanding! You have a solid grasp of this module.";
            this.finalScoreDisplay.style.color = 'var(--quiz-success)';
        } else if (scoreData.percentage >= 50) {
            this.resultsMessage.textContent = "Good job. A little more review and you'll master this.";
            this.finalScoreDisplay.style.color = 'var(--quiz-secondary)';
        } else {
            this.resultsMessage.textContent = "Keep practicing! Review the learning materials and try again.";
            this.finalScoreDisplay.style.color = 'var(--quiz-danger)';
        }
    }
}

// ==========================================
// 4. MAIN ORCHESTRATOR (The Controller)
// ==========================================
class QuizController {
    constructor() {
        this.state = new QuizState();
        this.ui = new QuizUI(this);
        this.init();
    }

    init() {
        this.ui.renderCategories(QuizData.categories);
        this.ui.switchView('categories');
    }

    handleStartQuiz(categoryId) {
        this.state.startQuiz(categoryId);
        const categoryTitle = QuizData.categories.find(c => c.id === categoryId).title;
        this.ui.switchView('quiz');
        this.ui.renderQuestion(this.state.getCurrentQuestion(), this.state.getProgress(), categoryTitle);
    }

    handleAnswer(selectedIndex, btnElement) {
        if (this.state.hasAnsweredCurrent) return;

        const isCorrect = this.state.submitAnswer(selectedIndex);
        const currentQ = this.state.getCurrentQuestion();
        
        this.ui.showAnswerFeedback(selectedIndex, currentQ.correct, currentQ.explanation, isCorrect, btnElement);
    }

    handleNextQuestion() {
        const hasMore = this.state.nextQuestion();
        if (hasMore) {
            const categoryTitle = QuizData.categories.find(c => c.id === this.state.activeCategoryId).title;
            this.ui.renderQuestion(this.state.getCurrentQuestion(), this.state.getProgress(), categoryTitle);
        } else {
            this.handleFinishQuiz();
        }
    }

    handleFinishQuiz() {
        this.ui.renderResults(this.state.getFinalScore());
        this.ui.switchView('results');
    }

    handleRestart() {
        this.handleStartQuiz(this.state.activeCategoryId); // Restart current
    }

    handleExit() {
        this.state.reset();
        this.ui.switchView('categories');
        window.scrollTo(0, 0);
    }
}

// Bootstrap Application
document.addEventListener("DOMContentLoaded", () => {
    new QuizController();
});
