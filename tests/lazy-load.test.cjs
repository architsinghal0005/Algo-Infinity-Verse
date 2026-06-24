const { JSDOM } = require('jsdom');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../scripts/lazy-load.js'), 'utf8');

function setupDOM(html, supportIntersectionObserver = true) {
    const dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;

    if (supportIntersectionObserver) {
        // Mock IntersectionObserver
        global.window.IntersectionObserver = class {
            constructor(callback) {
                this.callback = callback;
                this.elements = [];
            }
            observe(element) {
                this.elements.push(element);
            }
            unobserve(element) {
                this.elements = this.elements.filter(el => el !== element);
            }
            // Helper to simulate intersection
            triggerIntersect(element) {
                this.callback([{ isIntersecting: true, target: element }], this);
            }
        };
    } else {
        delete global.window.IntersectionObserver;
    }

    return dom;
}

function runTests() {
    console.log("Running Lazy Load Tests...");

    // Case 1: Intersection Observer Supported
    console.log("\n--- Case 1: Intersection Observer Supported ---");
    setupDOM(`
        <img class="lazy-image" data-src="test.png" data-srcset="test@2x.png 2x" />
        <div class="lazy-bg" data-bg="bg.jpg"></div>
    `, true);

    // Run the script
    eval(scriptContent);

    // Trigger DOMContentLoaded
    document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const lazyImages = document.querySelectorAll('.lazy-image, .lazy-bg');
    assert.strictEqual(lazyImages.length, 2, "Elements should be selected initially");

    // Get the observer instance that was created
    // We can't access it directly, but we can simulate the intersection by capturing the elements
    const observerMock = new window.IntersectionObserver();
    
    // Actually we need to capture the exact observer instance created inside the script.
    // Instead of evaluating directly, we can override the global IntersectionObserver 
    // to keep a reference to the active instance.
    // Let's modify the setup slightly for testing.
}

// Rewriting test execution to be more robust
function executeTest() {
    let activeObserver = null;
    let observerCallback = null;

    const html = `
        <img class="lazy-image" data-src="test.png" data-srcset="test@2x.png 2x" />
        <div class="lazy-bg" data-bg="bg.jpg"></div>
    `;

    // 1. Test IntersectionObserver Supported
    const dom1 = setupDOM(html, true);
    
    global.window.IntersectionObserver = class {
        constructor(callback) {
            observerCallback = callback;
            activeObserver = this;
            this.observedElements = [];
        }
        observe(el) { this.observedElements.push(el); }
        unobserve(el) { this.observedElements = this.observedElements.filter(e => e !== el); }
    };

    eval(scriptContent);
    global.document.dispatchEvent(new dom1.window.Event('DOMContentLoaded'));

    let img = global.document.querySelector('img');
    let div = global.document.querySelector('div');

    assert.strictEqual(img.src, '', "Image src should be empty initially");
    assert.strictEqual(div.style.backgroundImage, '', "Div background should be empty initially");

    // Simulate intersecting
    observerCallback([
        { isIntersecting: true, target: img },
        { isIntersecting: true, target: div }
    ], activeObserver);

    assert.ok(img.src.endsWith('test.png'), "Image src should be updated");
    assert.strictEqual(img.srcset, 'test@2x.png 2x', "Image srcset should be updated");
    assert.ok(img.classList.contains('lazy-loaded'), "Image should have lazy-loaded class (pending onload)");
    assert.ok(div.style.backgroundImage.includes('bg.jpg'), "Div background should be updated");
    assert.ok(div.classList.contains('lazy-loaded'), "Div should have lazy-loaded class");

    // For image, class is added in onload, so let's trigger it
    if (img.onload) img.onload();
    assert.ok(img.classList.contains('lazy-loaded'), "Image should have lazy-loaded class after load");
    assert.ok(!img.classList.contains('lazy-image'), "Image should not have lazy-image class");

    console.log("✅ Case 1: IntersectionObserver Support passed!");

    // 2. Test Fallback (IntersectionObserver NOT supported)
    const dom2 = setupDOM(html, false);
    
    eval(scriptContent);
    global.document.dispatchEvent(new dom2.window.Event('DOMContentLoaded'));

    img = global.document.querySelector('img');
    div = global.document.querySelector('div');

    assert.ok(img.src.endsWith('test.png'), "Image src should be updated immediately in fallback");
    assert.strictEqual(img.srcset, 'test@2x.png 2x', "Image srcset should be updated immediately in fallback");
    assert.ok(img.classList.contains('lazy-loaded'), "Image should have lazy-loaded class immediately");
    
    assert.ok(div.style.backgroundImage.includes('bg.jpg'), "Div background should be updated immediately");
    assert.ok(div.classList.contains('lazy-loaded'), "Div should have lazy-loaded class immediately");

    console.log("✅ Case 2: Fallback (No IntersectionObserver) passed!");
}

try {
    executeTest();
    console.log("\n🎉 All lazy-load tests passed successfully!");
} catch (e) {
    console.error("❌ Test failed:", e);
    process.exit(1);
}
