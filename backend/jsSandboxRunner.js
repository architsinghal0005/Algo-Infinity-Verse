import vm from "vm";

function truncate(str, max) {
  const s = String(str ?? "");
  if (!Number.isFinite(max) || max <= 0) return "";
  return s.length > max ? s.slice(0, max) + "\n[truncated]" : s;
}

function normalizeTestCase(t) {
  if (t == null || typeof t !== "object") {
    return {
      input: "",
      expectedOutput: "",
      name: undefined,
      show: true,
    };
  }

  if ("input" in t) {
    return {
      name: t.name ?? undefined,
      input: t.input,
      expectedOutput: t.expectedOutput ?? t.expected ?? "",
      isHidden: Boolean(t.isHidden),
    };
  }

  if ("stdin" in t) {
    return {
      name: t.name ?? undefined,
      input: t.stdin,
      expectedOutput: t.expected ?? "",
      isHidden: Boolean(t.isHidden),
    };
  }

  return {
    name: t.name ?? undefined,
    input: t.value ?? "",
    expectedOutput: t.expectedOutput ?? t.expected ?? "",
    isHidden: Boolean(t.isHidden),
  };
}

async function runWithPiston({ language, sourceCode, tests, timeoutMs, maxOutputChars, showMySteps }) {
  const versionMap = { python: "3.10.0", cpp: "10.2.0" };
  const langIdMap = { python: "python", cpp: "c++" };
  const langId = langIdMap[language] || language;
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const start = Date.now();
    
    const stdinStr = typeof t.input === "string" ? t.input : JSON.stringify(t.input);
    const expected = t.expectedOutput;
    
    let actualOutput = null;
    let passed = false;
    let runtimeError = null;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    try {
      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: langId,
          version: versionMap[language] || "*",
          files: [{ content: sourceCode }],
          stdin: stdinStr || "",
          compile_timeout: timeoutMs,
          run_timeout: timeoutMs,
        })
      });
      
      const data = await response.json();
      
      if (data.compile && data.compile.code !== 0) {
        runtimeError = { message: "Compilation Error:\n" + data.compile.stderr };
      } else if (data.run) {
        stdout = data.run.stdout || "";
        stderr = data.run.stderr || "";
        
        if (data.run.signal === "SIGKILL") {
          timedOut = true;
          runtimeError = { message: "Execution timed out" };
        } else if (data.run.code !== 0) {
          runtimeError = { message: stderr || `Process exited with code ${data.run.code}` };
        } else {
          actualOutput = stdout.trim();
          if (typeof expected === "string") {
            passed = actualOutput === String(expected).trim();
          } else {
            try {
              const parsedActual = JSON.parse(actualOutput);
              passed = JSON.stringify(parsedActual) === JSON.stringify(expected);
            } catch {
              passed = actualOutput === String(expected).trim();
            }
          }
        }
      } else {
         runtimeError = { message: data.message || "Unknown error" };
      }
    } catch (e) {
      runtimeError = { message: e.message };
    }
    
    results.push({
      testName: t.name ?? `test_${i + 1}`,
      input: t.input,
      expectedOutput: expected,
      actualOutput: timedOut ? null : actualOutput,
      passed,
      durationMs: Date.now() - start,
      timedOut,
      runtimeError,
      transcript: showMySteps ? {
        stdout: truncate(stdout, maxOutputChars),
        stderr: truncate(stderr, maxOutputChars),
      } : undefined,
    });
  }
  
  return {
    ok: true,
    results,
    runtimeMeta: { timeoutMs, maxOutputChars, showMySteps }
  };
}

export async function runUserCode({
  language,
  sourceCode,
  tests,
  timeoutMs = 1000,
  maxOutputChars = 20000,
  showMySteps = false,
}) {
  const normalizedTests = Array.isArray(tests) ? tests.map(normalizeTestCase) : [];

  // Route Python/C++ to Piston
  if (language === "python" || language === "cpp") {
    return await runWithPiston({
      language,
      sourceCode,
      tests: normalizedTests,
      timeoutMs,
      maxOutputChars,
      showMySteps,
    });
  }

  if (language && language !== "javascript") {
    return {
      ok: false,
      error: `Unsupported language for MVP sandbox: ${language}`,
    };
  }

  // --- SECURE JAVASCRIPT EXECUTION (Sandboxed VM) ---
  const results = [];

  for (let i = 0; i < normalizedTests.length; i++) {
    const t = normalizedTests[i];
    const start = Date.now();
    
    let stdoutBuf = "";
    let stderrBuf = "";

    // 1. Create a secure mock console
    const mockConsole = {
      log: (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\n";
        if (stdoutBuf.length + msg.length <= maxOutputChars) stdoutBuf += msg;
      },
      error: (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\n";
        if (stderrBuf.length + msg.length <= maxOutputChars) stderrBuf += msg;
      },
      warn: (...args) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" ") + "\n";
        if (stdoutBuf.length + msg.length <= maxOutputChars) stdoutBuf += msg;
      }
    };

    // 2. Initialize pristine, prototype-less sandbox
    // EXPLICITLY MISSING: setTimeout, setInterval, process, require
    const sandboxEnv = Object.create(null);
    sandboxEnv.console = mockConsole;
    sandboxEnv.Math = Math;
    sandboxEnv.String = String;
    sandboxEnv.Number = Number;
    sandboxEnv.Array = Array;
    sandboxEnv.Object = Object;
    sandboxEnv.Boolean = Boolean;
    sandboxEnv.Date = Date;
    sandboxEnv.RegExp = RegExp;
    sandboxEnv.Error = Error;
    sandboxEnv.TypeError = TypeError;
    sandboxEnv.RangeError = RangeError;
    sandboxEnv.Map = Map;
    sandboxEnv.Set = Set;
    sandboxEnv.JSON = JSON;
    sandboxEnv.isNaN = isNaN;
    sandboxEnv.isFinite = isFinite;
    sandboxEnv.parseInt = parseInt;
    sandboxEnv.parseFloat = parseFloat;
    
    // Support for module.exports and globalThis formats
    sandboxEnv.module = { exports: {} };
    sandboxEnv.globalThis = sandboxEnv;
    
    // Inject test input
    sandboxEnv.__TEST_INPUT__ = t.input;

    const context = vm.createContext(sandboxEnv);

    let actualOutput = null;
    let runtimeError = null;
    let timedOut = false;

    try {
      const executionWrapper = `
        ${sourceCode}

        let __solve = null;
        if (typeof solve === 'function') __solve = solve;
        else if (typeof globalThis !== 'undefined' && typeof globalThis.solve === 'function') __solve = globalThis.solve;
        else if (typeof module !== 'undefined' && module.exports && typeof module.exports.solve === 'function') {
          __solve = module.exports.solve;
        }

        if (!__solve) {
          throw new Error('No solve function found. Expected a function named solve(input).');
        }

        // Return the evaluated result
        __solve(__TEST_INPUT__);
      `;

      const script = new vm.Script(executionWrapper);
      
      // Execute securely with strict timeouts
      actualOutput = script.runInContext(context, {
        timeout: timeoutMs,
        microtaskMode: 'afterEvaluate'
      });

    } catch (err) {
      const msg = err?.message || String(err);
      if (/timed out/i.test(msg)) {
        timedOut = true;
      }
      runtimeError = {
        message: msg,
        stack: err?.stack || null,
      };
    }

    const expected = t.expectedOutput;
    let passed = false;

    if (!timedOut && !runtimeError) {
      if (typeof expected === "string") {
        passed = String(actualOutput) === String(expected);
      } else {
        try {
          passed = JSON.stringify(actualOutput) === JSON.stringify(expected);
        } catch {
          passed = actualOutput === expected;
        }
      }
    }

    results.push({
      testName: t.name ?? `test_${i + 1}`,
      input: t.input,
      expectedOutput: expected,
      actualOutput: timedOut ? null : actualOutput,
      passed,
      durationMs: Date.now() - start,
      timedOut,
      runtimeError,
      transcript: showMySteps ? {
        stdout: truncate(stdoutBuf, maxOutputChars),
        stderr: truncate(stderrBuf, maxOutputChars),
      } : undefined,
    });
  }

  return {
    ok: true,
    results,
    runtimeMeta: {
      timeoutMs,
      maxOutputChars,
      showMySteps,
    },
  };
}
