/**
 * scratch/test_pathfinding_arena.js
 * Headless test script to verify BFS, DFS, Dijkstra, and A* pathfinding algorithms
 * on a mock grid with walls and weighted nodes.
 */

class PathfindingEngine {
    constructor(rows = 10, cols = 10) {
        this.rows = rows;
        this.cols = cols;
        this.reset();
    }

    reset() {
        this.grid = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0)); // 0 = empty
        this.start = { r: 0, c: 0 };
        this.target = { r: this.rows - 1, c: this.cols - 1 };
        this.walls = new Set();
        this.weights = new Map(); // key 'r,c' -> weight value (e.g. 5)
    }

    getKey(r, c) {
        return `${r},${c}`;
    }

    addWall(r, c) {
        this.walls.add(this.getKey(r, c));
    }

    addWeight(r, c, w = 5) {
        this.weights.set(this.getKey(r, c), w);
    }

    getNeighbors(r, c) {
        const neighbors = [];
        const dirs = [
            [-1, 0], // Up
            [1, 0],  // Down
            [0, -1], // Left
            [0, 1]   // Right
        ];

        for (let [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                if (!this.walls.has(this.getKey(nr, nc))) {
                    neighbors.push({ r: nr, c: nc });
                }
            }
        }
        return neighbors;
    }

    getWeight(r, c) {
        const key = this.getKey(r, c);
        return this.weights.has(key) ? this.weights.get(key) : 1;
    }

    // ==========================================
    // ALGORITHMS
    // ==========================================

    // BFS (Breadth-First Search) - returns { path, visited }
    runBfs() {
        const visited = [];
        const queue = [this.start];
        const visitedSet = new Set([this.getKey(this.start.r, this.start.c)]);
        const parent = {};

        let found = false;

        while (queue.length > 0) {
            const curr = queue.shift();
            visited.push(curr);

            if (curr.r === this.target.r && curr.c === this.target.c) {
                found = true;
                break;
            }

            for (let neighbor of this.getNeighbors(curr.r, curr.c)) {
                const key = this.getKey(neighbor.r, neighbor.c);
                if (!visitedSet.has(key)) {
                    visitedSet.add(key);
                    parent[key] = curr;
                    queue.push(neighbor);
                }
            }
        }

        const path = found ? this.backtrackPath(parent) : [];
        return { path, visited };
    }

    // DFS (Depth-First Search)
    runDfs() {
        const visited = [];
        const stack = [this.start];
        const visitedSet = new Set();
        const parent = {};

        let found = false;

        while (stack.length > 0) {
            const curr = stack.pop();
            const currKey = this.getKey(curr.r, curr.c);

            if (visitedSet.has(currKey)) continue;
            visitedSet.add(currKey);
            visited.push(curr);

            if (curr.r === this.target.r && curr.c === this.target.c) {
                found = true;
                break;
            }

            for (let neighbor of this.getNeighbors(curr.r, curr.c)) {
                const key = this.getKey(neighbor.r, neighbor.c);
                if (!visitedSet.has(key)) {
                    parent[key] = curr;
                    stack.push(neighbor);
                }
            }
        }

        const path = found ? this.backtrackPath(parent) : [];
        return { path, visited };
    }

    // Dijkstra's Algorithm (Uniform Cost Search)
    runDijkstra() {
        const visited = [];
        const parent = {};
        const dist = {};
        
        // Initialize distances
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                dist[this.getKey(r, c)] = Infinity;
            }
        }
        dist[this.getKey(this.start.r, this.start.c)] = 0;

        const openSet = [{ node: this.start, d: 0 }];
        const closedSet = new Set();

        let found = false;

        while (openSet.length > 0) {
            // Sort by distance (uniform cost priority)
            openSet.sort((a, b) => a.d - b.d);
            const { node: curr } = openSet.shift();
            const currKey = this.getKey(curr.r, curr.c);

            if (closedSet.has(currKey)) continue;
            closedSet.add(currKey);
            visited.push(curr);

            if (curr.r === this.target.r && curr.c === this.target.c) {
                found = true;
                break;
            }

            for (let neighbor of this.getNeighbors(curr.r, curr.c)) {
                const neighborKey = this.getKey(neighbor.r, neighbor.c);
                if (closedSet.has(neighborKey)) continue;

                const alt = dist[currKey] + this.getWeight(neighbor.r, neighbor.c);
                if (alt < dist[neighborKey]) {
                    dist[neighborKey] = alt;
                    parent[neighborKey] = curr;
                    openSet.push({ node: neighbor, d: alt });
                }
            }
        }

        const path = found ? this.backtrackPath(parent) : [];
        return { path, visited };
    }

    // A* Heuristic Search
    runAStar() {
        const visited = [];
        const parent = {};
        const gScore = {};
        const fScore = {};

        const heuristic = (node) => {
            // Manhattan distance heuristic
            return Math.abs(node.r - this.target.r) + Math.abs(node.c - this.target.c);
        };

        // Initialize scores
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const key = this.getKey(r, c);
                gScore[key] = Infinity;
                fScore[key] = Infinity;
            }
        }

        const startKey = this.getKey(this.start.r, this.start.c);
        gScore[startKey] = 0;
        fScore[startKey] = heuristic(this.start);

        const openSet = [{ node: this.start, f: fScore[startKey], g: 0 }];
        const openSetKeys = new Set([startKey]);
        const closedSet = new Set();

        let found = false;

        while (openSet.length > 0) {
            // Priority queue sorted by f-score, using higher g-score as a tie-breaker
            openSet.sort((a, b) => {
                if (a.f === b.f) {
                    return b.g - a.g; // prefer nodes closer to the target (larger g)
                }
                return a.f - b.f;
            });
            const { node: curr, f, g } = openSet.shift();
            const currKey = this.getKey(curr.r, curr.c);
            openSetKeys.delete(currKey);

            if (closedSet.has(currKey)) continue;
            closedSet.add(currKey);
            visited.push(curr);
            
            if (visited.length <= 15) {
                console.log(`Visited #${visited.length}: (${curr.r}, ${curr.c}) with f-score = ${f}, g-score = ${g}`);
            }

            if (curr.r === this.target.r && curr.c === this.target.c) {
                found = true;
                break;
            }

            for (let neighbor of this.getNeighbors(curr.r, curr.c)) {
                const neighborKey = this.getKey(neighbor.r, neighbor.c);
                if (closedSet.has(neighborKey)) continue;

                // gScore is cost from start. Node traversal cost is its weight.
                const tentativeG = gScore[currKey] + this.getWeight(neighbor.r, neighbor.c);

                if (tentativeG < gScore[neighborKey]) {
                    parent[neighborKey] = curr;
                    gScore[neighborKey] = tentativeG;
                    fScore[neighborKey] = tentativeG + heuristic(neighbor);

                    if (!openSetKeys.has(neighborKey)) {
                        openSet.push({ node: neighbor, f: fScore[neighborKey], g: tentativeG });
                        openSetKeys.add(neighborKey);
                    }
                }
            }
        }

        const path = found ? this.backtrackPath(parent) : [];
        return { path, visited };
    }

    backtrackPath(parent) {
        const path = [];
        let curr = this.target;
        while (curr) {
            path.push(curr);
            curr = parent[this.getKey(curr.r, curr.c)];
        }
        return path.reverse();
    }

    getPathCost(path) {
        if (path.length === 0) return 0;
        let cost = 0;
        // Cost equals the sum of weights of the cells in the path (excluding start)
        for (let i = 1; i < path.length; i++) {
            cost += this.getWeight(path[i].r, path[i].c);
        }
        return cost;
    }
}

// ==========================================
// TEST SUITE
// ==========================================
function runTests() {
    console.log("=== RUNNING PATHFINDING ARENA TESTS ===");

    // Test 1: BFS and DFS on a clear 5x5 grid
    (() => {
        console.log("\n--- Test 1: Clear Grid BFS & DFS ---");
        const engine = new PathfindingEngine(5, 5);
        
        const bfs = engine.runBfs();
        const dfs = engine.runDfs();

        console.log(`BFS path length: ${bfs.path.length} (expected 9)`);
        console.log(`DFS path length: ${dfs.path.length}`);
        
        if (bfs.path.length !== 9) {
            throw new Error(`Test 1 Failed: BFS path should be length 9, got ${bfs.path.length}`);
        }
        console.log("✓ BFS and DFS ran successfully and found targets");
    })();

    // Test 2: Optimal paths with walls
    (() => {
        console.log("\n--- Test 2: Grid with Walls ---");
        const engine = new PathfindingEngine(5, 5);
        // Build a wall blocking direct diagonal path:
        // [S] [ ] [ ] [ ] [ ]
        // [W] [W] [W] [W] [ ]
        // [ ] [ ] [ ] [ ] [ ]
        // [ ] [W] [W] [W] [W]
        // [ ] [ ] [ ] [ ] [T]
        engine.addWall(1, 0);
        engine.addWall(1, 1);
        engine.addWall(1, 2);
        engine.addWall(1, 3);
        engine.addWall(3, 1);
        engine.addWall(3, 2);
        engine.addWall(3, 3);
        engine.addWall(3, 4);

        const dijkstra = engine.runDijkstra();
        const astar = engine.runAStar();

        console.log(`Dijkstra path length: ${dijkstra.path.length} (expected 17)`);
        console.log(`A* path length: ${astar.path.length} (expected 17)`);

        if (dijkstra.path.length !== 17 || astar.path.length !== 17) {
            throw new Error(`Test 2 Failed: Shortest path around walls should be 17, got Dijkstra=${dijkstra.path.length}, A*=${astar.path.length}`);
        }
        console.log("✓ Both Dijkstra's and A* successfully routed around walls");
    })();

    // Test 3: Cost-efficiency of Weighted Nodes
    (() => {
        console.log("\n--- Test 3: Dijkstra vs. BFS with Weights ---");
        const engine = new PathfindingEngine(3, 3);
        engine.target = { r: 0, c: 2 };
        // Grid:
        // [S] [W:10] [T]
        // [ ] [ ]    [ ]
        // [ ] [ ]    [ ]
        // Weighted node at (0,1) with weight 10.
        // Shortest path by node count (BFS): Start (0,0) -> (0,1) -> (0,2) (cost: 10 + 1 = 11)
        // Shortest path by cost (Dijkstra): Start (0,0) -> (1,0) -> (1,1) -> (1,2) -> (0,2) (cost: 1 + 1 + 1 + 1 = 4)
        engine.addWeight(0, 1, 10);

        const bfs = engine.runBfs();
        const dijkstra = engine.runDijkstra();

        const bfsCost = engine.getPathCost(bfs.path);
        const dijkstraCost = engine.getPathCost(dijkstra.path);

        console.log(`BFS path cost: ${bfsCost} (node count path)`);
        console.log(`Dijkstra path cost: ${dijkstraCost} (uniform cost path)`);

        if (dijkstraCost >= bfsCost) {
            throw new Error(`Test 3 Failed: Dijkstra cost (${dijkstraCost}) should be less than BFS cost (${bfsCost})`);
        }
        console.log("✓ Dijkstra successfully avoided weighted cells while BFS walked through them");
    })();

    // Test 4: Heuristic Efficiency (A* vs. Dijkstra)
    (() => {
        console.log("\n--- Test 4: A* Heuristic Efficiency (Space Visited) ---");
        // Clear 15x15 grid. A* should explore significantly fewer nodes than Dijkstra because it is guided.
        const engine = new PathfindingEngine(15, 15);
        
        const dijkstra = engine.runDijkstra();
        const astar = engine.runAStar();

        const dijkstraVisited = dijkstra.visited.length;
        const astarVisited = astar.visited.length;

        console.log(`Dijkstra Visited Nodes: ${dijkstraVisited}`);
        console.log(`A* Visited Nodes:        ${astarVisited}`);
        console.log(`Savings: ${((dijkstraVisited - astarVisited) / dijkstraVisited * 100).toFixed(1)}%`);

        if (astarVisited >= dijkstraVisited) {
            throw new Error(`Test 4 Failed: A* should visit fewer nodes than Dijkstra's on a clear grid.`);
        }
        console.log("✓ A* visited fewer nodes than Dijkstra's due to heuristic guidance!");
        console.log("All tests passed successfully!");
    })();
}

runTests();
