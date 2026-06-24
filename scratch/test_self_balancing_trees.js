// Verification script for Self-Balancing Trees (AVL and Red-Black)

class Node {
    constructor(val, color = 'RED') {
        this.value = val;
        this.left = null;
        this.right = null;
        this.parent = null;
        this.height = 1;
        this.color = color;
    }
}

// Deep clone tree helper (reconstructing parents)
function cloneTree(node, parent = null) {
    if (!node) return null;
    const copy = new Node(node.value, node.color);
    copy.height = node.height;
    copy.parent = parent;
    copy.left = cloneTree(node.left, copy);
    copy.right = cloneTree(node.right, copy);
    return copy;
}

// AVL Tree Implementation
class AVLTree {
    constructor() {
        this.root = null;
        this.steps = []; // Stores state snapshots
    }

    getHeight(node) {
        return node ? node.height : 0;
    }

    getBalanceFactor(node) {
        return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
    }

    updateHeight(node) {
        if (node) {
            node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
        }
    }

    recordStep(message, highlightNodes = [], rotNode = null) {
        this.steps.push({
            tree: cloneTree(this.root),
            message: message,
            highlightNodes: [...highlightNodes],
            rotNode: rotNode
        });
    }

    // Rotations (updating parent pointers too)
    rotateRight(y) {
        const x = y.left;
        if (!x) return y;
        const T2 = x.right;

        // Perform rotation
        x.right = y;
        y.left = T2;

        // Parent updates
        x.parent = y.parent;
        y.parent = x;
        if (T2) T2.parent = y;

        if (x.parent) {
            if (x.parent.left === y) x.parent.left = x;
            else x.parent.right = x;
        } else {
            this.root = x;
        }

        // Update heights
        this.updateHeight(y);
        this.updateHeight(x);

        return x;
    }

    rotateLeft(x) {
        const y = x.right;
        if (!y) return x;
        const T2 = y.left;

        // Perform rotation
        y.left = x;
        x.right = T2;

        // Parent updates
        y.parent = x.parent;
        x.parent = y;
        if (T2) T2.parent = x;

        if (y.parent) {
            if (y.parent.left === x) y.parent.left = y;
            else y.parent.right = y;
        } else {
            this.root = y;
        }

        // Update heights
        this.updateHeight(x);
        this.updateHeight(y);

        return y;
    }

    insert(val) {
        this.steps = [];
        this.root = this._insert(this.root, val, null);
        this.recordStep(`Successfully inserted ${val} and completed rebalancing.`, [val]);
        return this.steps;
    }

    _insert(node, val, parent) {
        // 1. Perform normal BST insertion
        if (!node) {
            const newNode = new Node(val);
            newNode.parent = parent;
            if (!this.root) this.root = newNode;
            this.recordStep(`BST Insert: Inserted node ${val} into the tree.`, [val]);
            return newNode;
        }

        if (val < node.value) {
            node.left = this._insert(node.left, val, node);
        } else if (val > node.value) {
            node.right = this._insert(node.right, val, node);
        } else {
            return node; // Duplicate values not allowed
        }

        // 2. Update height of current node
        this.updateHeight(node);

        // 3. Check balance factor to see if it became unbalanced
        const balance = this.getBalanceFactor(node);

        // LL Case
        if (balance > 1 && val < node.left.value) {
            this.recordStep(`Imbalance detected at node ${node.value} (Balance Factor: ${balance}). Left-Left case requires Right Rotation on ${node.value}.`, [node.value, node.left.value], node.value);
            return this.rotateRight(node);
        }

        // RR Case
        if (balance < -1 && val > node.right.value) {
            this.recordStep(`Imbalance detected at node ${node.value} (Balance Factor: ${balance}). Right-Right case requires Left Rotation on ${node.value}.`, [node.value, node.right.value], node.value);
            return this.rotateLeft(node);
        }

        // LR Case
        if (balance > 1 && val > node.left.value) {
            this.recordStep(`Imbalance detected at node ${node.value} (Balance Factor: ${balance}). Left-Right case requires Left Rotation on child ${node.left.value} first.`, [node.value, node.left.value], node.left.value);
            node.left = this.rotateLeft(node.left);
            this.recordStep(`Left rotation completed. Now perform Right Rotation on ${node.value}.`, [node.value, node.left.value], node.value);
            return this.rotateRight(node);
        }

        // RL Case
        if (balance < -1 && val < node.right.value) {
            this.recordStep(`Imbalance detected at node ${node.value} (Balance Factor: ${balance}). Right-Left case requires Right Rotation on child ${node.right.value} first.`, [node.value, node.right.value], node.right.value);
            node.right = this.rotateRight(node.right);
            this.recordStep(`Right rotation completed. Now perform Left Rotation on ${node.value}.`, [node.value, node.right.value], node.value);
            return this.rotateLeft(node);
        }

        return node;
    }
}

// Red-Black Tree Implementation
class RedBlackTree {
    constructor() {
        this.root = null;
        this.steps = [];
    }

    recordStep(message, highlightNodes = [], rotNode = null) {
        this.steps.push({
            tree: cloneTree(this.root),
            message: message,
            highlightNodes: [...highlightNodes],
            rotNode: rotNode
        });
    }

    rotateLeft(x) {
        const y = x.right;
        x.right = y.left;
        if (y.left) y.left.parent = x;
        y.parent = x.parent;
        if (!x.parent) {
            this.root = y;
        } else if (x === x.parent.left) {
            x.parent.left = y;
        } else {
            x.parent.right = y;
        }
        y.left = x;
        x.parent = y;
    }

    rotateRight(x) {
        const y = x.left;
        x.left = y.right;
        if (y.right) y.right.parent = x;
        y.parent = x.parent;
        if (!x.parent) {
            this.root = y;
        } else if (x === x.parent.right) {
            x.parent.right = y;
        } else {
            x.parent.left = y;
        }
        y.right = x;
        x.parent = y;
    }

    insert(val) {
        this.steps = [];
        const newNode = new Node(val, 'RED');
        
        if (!this.root) {
            newNode.color = 'BLACK';
            this.root = newNode;
            this.recordStep(`Tree was empty. Inserted ${val} as root (colored BLACK).`, [val]);
            return this.steps;
        }

        // Standard BST insert
        let curr = this.root;
        let parent = null;
        while (curr) {
            parent = curr;
            if (val < curr.value) {
                curr = curr.left;
            } else if (val > curr.value) {
                curr = curr.right;
            } else {
                return this.steps; // Duplicate
            }
        }

        newNode.parent = parent;
        if (val < parent.value) {
            parent.left = newNode;
        } else {
            parent.right = newNode;
        }

        this.recordStep(`BST Insert: Inserted node ${val} (colored RED) under parent ${parent.value}.`, [val]);

        // Fix RB properties
        this.fixInsert(newNode);
        
        if (this.root.color !== 'BLACK') {
            this.root.color = 'BLACK';
            this.recordStep(`Enforced property: Recolored root ${this.root.value} to BLACK.`, [this.root.value]);
        }

        this.recordStep(`Successfully completed Red-Black tree insertion and balancing for ${val}.`, [val]);
        return this.steps;
    }

    fixInsert(k) {
        while (k.parent && k.parent.color === 'RED') {
            const gp = k.parent.parent;
            if (!gp) break;

            if (k.parent === gp.left) {
                const uncle = gp.right;
                if (uncle && uncle.color === 'RED') {
                    // Case 1: Uncle is Red -> Recolor
                    this.recordStep(`Double Red violation at ${k.value}. Parent ${k.parent.value} and Uncle ${uncle.value} are RED. Recoloring parent and uncle to BLACK, grandparent ${gp.value} to RED.`, [k.value, k.parent.value, uncle.value, gp.value]);
                    k.parent.color = 'BLACK';
                    uncle.color = 'BLACK';
                    gp.color = 'RED';
                    k = gp; // Move up
                } else {
                    // Case 2: Uncle is Black (or null)
                    if (k === k.parent.right) {
                        // Triangle case -> Left rotate parent
                        this.recordStep(`Double Red violation. Parent ${k.parent.value} is RED, Uncle is BLACK (Triangle). Left Rotate on parent ${k.parent.value}.`, [k.value, k.parent.value], k.parent.value);
                        k = k.parent;
                        this.rotateLeft(k);
                    }
                    // Case 3: Line case -> Recolor and Right rotate grandparent
                    this.recordStep(`Double Red violation. Parent ${k.parent.value} is RED, Uncle is BLACK (Line). Recoloring parent ${k.parent.value} to BLACK, grandparent ${gp.value} to RED.`, [k.value, k.parent.value, gp.value]);
                    k.parent.color = 'BLACK';
                    gp.color = 'RED';
                    this.recordStep(`Performing Right Rotation on grandparent ${gp.value}.`, [gp.value], gp.value);
                    this.rotateRight(gp);
                }
            } else {
                const uncle = gp.left;
                if (uncle && uncle.color === 'RED') {
                    // Case 1: Uncle is Red -> Recolor
                    this.recordStep(`Double Red violation at ${k.value}. Parent ${k.parent.value} and Uncle ${uncle.value} are RED. Recoloring parent and uncle to BLACK, grandparent ${gp.value} to RED.`, [k.value, k.parent.value, uncle.value, gp.value]);
                    k.parent.color = 'BLACK';
                    uncle.color = 'BLACK';
                    gp.color = 'RED';
                    k = gp; // Move up
                } else {
                    // Case 2: Uncle is Black (or null)
                    if (k === k.parent.left) {
                        // Triangle case -> Right rotate parent
                        this.recordStep(`Double Red violation. Parent ${k.parent.value} is RED, Uncle is BLACK (Triangle). Right Rotate on parent ${k.parent.value}.`, [k.value, k.parent.value], k.parent.value);
                        k = k.parent;
                        this.rotateRight(k);
                    }
                    // Case 3: Line case -> Recolor and Left rotate grandparent
                    this.recordStep(`Double Red violation. Parent ${k.parent.value} is RED, Uncle is BLACK (Line). Recoloring parent ${k.parent.value} to BLACK, grandparent ${gp.value} to RED.`, [k.value, k.parent.value, gp.value]);
                    k.parent.color = 'BLACK';
                    gp.color = 'RED';
                    this.recordStep(`Performing Left Rotation on grandparent ${gp.value}.`, [gp.value], gp.value);
                    this.rotateLeft(gp);
                }
            }
        }
    }
}

// Simple test runner
function runTests() {
    console.log("=== Testing AVL Tree ===");
    const avl = new AVLTree();
    
    // Insert sequence: 10, 20, 30 (should trigger RR rotation, simple left rotate at 10)
    console.log("Inserting 10...");
    avl.insert(10);
    console.log("Inserting 20...");
    avl.insert(20);
    console.log("Inserting 30...");
    avl.insert(30);

    console.log(`AVL Root: ${avl.root.value} (Expected: 20)`);
    console.log(`AVL Left: ${avl.root.left.value} (Expected: 10)`);
    console.log(`AVL Right: ${avl.root.right.value} (Expected: 30)`);
    
    console.log("\n=== Testing Red-Black Tree ===");
    const rbt = new RedBlackTree();
    // Insert sequence: 10, 20, 30
    rbt.insert(10);
    rbt.insert(20);
    rbt.insert(30);

    console.log(`RBT Root: ${rbt.root.value} color: ${rbt.root.color} (Expected: 20 BLACK)`);
    console.log(`RBT Left: ${rbt.root.left.value} color: ${rbt.root.left.color} (Expected: 10 RED)`);
    console.log(`RBT Right: ${rbt.root.right.value} color: ${rbt.root.right.color} (Expected: 30 RED)`);
    
    // Run another test for double rotation / uncle cases
    console.log("\n=== Testing AVL Double Rotation ===");
    const avlDouble = new AVLTree();
    avlDouble.insert(30);
    avlDouble.insert(10);
    avlDouble.insert(20); // should trigger LR rotation (left rotate 10, right rotate 30)
    
    console.log(`AVL Double Root: ${avlDouble.root.value} (Expected: 20)`);
    console.log(`AVL Double Left: ${avlDouble.root.left.value} (Expected: 10)`);
    console.log(`AVL Double Right: ${avlDouble.root.right.value} (Expected: 30)`);
}

runTests();
