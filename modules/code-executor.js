// modules/code-executor.js

const workerScript = `
self.onmessage = function(e) {
    const { code } = e.data;
    const logs = [];
    
    function formatValue(value) {
        if (typeof value === "object" && value !== null) {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return "[Object]";
            }
        }
        return String(value);
    }

    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    };

    console.log = (...args) => {
        logs.push(args.map(formatValue).join(" "));
    };
    console.warn = (...args) => {
        logs.push("⚠️ " + args.map(formatValue).join(" "));
    };
    console.error = (...args) => {
        logs.push("❌ " + args.map(formatValue).join(" "));
    };

    try {
        const execute = new Function(code);
        const result = execute();
        
        if (result !== undefined) {
            logs.push(formatValue(result));
        }
        
        self.postMessage({ success: true, logs });
    } catch (error) {
        self.postMessage({ success: false, error: error.name + ": " + error.message, logs });
    } finally {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    }
};
`;

/**
 * Safely executes arbitrary JavaScript code within an isolated Web Worker,
 * preventing infinite loops from blocking the main UI thread.
 * 
 * @param {string} code The JavaScript code to execute.
 * @param {number} timeoutMs Maximum allowed execution time in milliseconds.
 * @returns {Promise<string[]>} Resolves with an array of console log strings if successful.
 */
export function executeSandboxedCode(code, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        
        const timeoutId = setTimeout(() => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(new Error("Timeout / Infinite Loop Detected: Execution exceeded " + timeoutMs + "ms"));
        }, timeoutMs);

        worker.onmessage = (e) => {
            clearTimeout(timeoutId);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            
            const { success, error, logs } = e.data;
            if (success) {
                resolve(logs);
            } else {
                // Reject with the captured error, but also include logs printed before the error
                reject(new Error(error + (logs.length > 0 ? "\\nPartial Output: " + logs.join("\\n") : "")));
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timeoutId);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(new Error(err.message || "Unknown Worker Error"));
        };

        worker.postMessage({ code });
    });
}
