// script.js handles: loading screen, navbar, dark mode, scroll top
// This file: Segment Tree simulator logic only
// All globals prefixed st_ or ST_ to avoid conflicts

document.addEventListener('DOMContentLoaded', function() {
  stInit();
});

/* ─── Constants ─── */
var ST_SPEED_MAP   = { 1: 1200, 2: 700, 3: 400, 4: 180, 5: 60 };
var ST_SPEED_LABEL = { 1: 'Slowest', 2: 'Slow', 3: 'Normal', 4: 'Fast', 5: 'Blazing' };

/* Node fill colors */
var ST_COL = {
  DEFAULT : { fill: 'rgba(100,116,139,0.25)', stroke: '#64748b',  text: '#94a3b8' },
  ACTIVE  : { fill: 'rgba(168,85,247,0.25)',  stroke: '#a855f7',  text: '#e9d5ff' },
  MATCH   : { fill: 'rgba(34,197,94,0.25)',   stroke: '#22c55e',  text: '#bbf7d0' },
  PARTIAL : { fill: 'rgba(245,158,11,0.25)',  stroke: '#f59e0b',  text: '#fde68a' },
  NONE    : { fill: 'rgba(239,68,68,0.10)',   stroke: '#ef4444',  text: '#fca5a5' },
  UPDATED : { fill: 'rgba(6,182,212,0.25)',   stroke: '#06b6d4',  text: '#a5f3fc' },
};

/* ─── State ─── */
var stState = {
  arr       : [],
  tree      : [],        // segment tree array (1-indexed)
  n         : 0,
  nodePos   : {},        // nodePos[idx] = {x, y, r}
  nodeColor : {},        // nodeColor[idx] = key of ST_COL
  steps     : [],        // animation steps
  stepIdx   : 0,
  playing   : false,
  timer     : null,
  built     : false,
};

/* ─── Build Segment Tree ─── */
function stBuild(arr) {
  var n = arr.length;
  var tree = new Array(4 * n).fill(0);
  function buildNode(node, start, end) {
    if (start === end) { tree[node] = arr[start]; return; }
    var mid = Math.floor((start + end) / 2);
    buildNode(2 * node, start, mid);
    buildNode(2 * node + 1, mid + 1, end);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }
  buildNode(1, 0, n - 1);
  return tree;
}

/* ─── Generate Query Steps ─── */
function stGenQuerySteps(tree, n, l, r) {
  var steps = [];
  function query(node, start, end, l, r) {
    if (r < start || end < l) {
      steps.push({ type: 'visit', node: node, color: 'NONE',
        msg: 'Node ' + node + ' [' + start + '..' + end + '] — no overlap with [' + l + '..' + r + ']. Return 0.' });
      return 0;
    }
    if (l <= start && end <= r) {
      steps.push({ type: 'visit', node: node, color: 'MATCH',
        msg: 'Node ' + node + ' [' + start + '..' + end + '] — fully inside [' + l + '..' + r + ']. Return ' + tree[node] + '.' });
      return tree[node];
    }
    steps.push({ type: 'visit', node: node, color: 'PARTIAL',
      msg: 'Node ' + node + ' [' + start + '..' + end + '] — partial overlap. Recurse into children.' });
    var mid = Math.floor((start + end) / 2);
    var left  = query(2 * node, start, mid, l, r);
    var right = query(2 * node + 1, mid + 1, end, l, r);
    steps.push({ type: 'return', node: node, color: 'ACTIVE',
      msg: 'Node ' + node + ': left=' + left + ' + right=' + right + ' = ' + (left + right) });
    return left + right;
  }
  var result = query(1, 0, n - 1, l, r);
  steps.push({ type: 'result', node: -1, color: null,
    msg: 'Query sum [' + l + '..' + r + '] = ' + result, result: result });
  return steps;
}

/* ─── Generate Update Steps ─── */
function stGenUpdateSteps(tree, n, idx, val, oldVal) {
  var steps = [];
  var delta = val - oldVal;
  function update(node, start, end, idx, val) {
    if (start === end) {
      tree[node] += delta;
      steps.push({ type: 'update', node: node, color: 'UPDATED',
        msg: 'Leaf node ' + node + ' [' + start + ']: value updated from ' + oldVal + ' to ' + val + '.' });
      return;
    }
    var mid = Math.floor((start + end) / 2);
    steps.push({ type: 'visit', node: node, color: 'ACTIVE',
      msg: 'Node ' + node + ' [' + start + '..' + end + ']: descending to find index ' + idx + '.' });
    if (idx <= mid) update(2 * node, start, mid, idx, val);
    else update(2 * node + 1, mid + 1, end, idx, val);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
    steps.push({ type: 'propagate', node: node, color: 'UPDATED',
      msg: 'Node ' + node + ' [' + start + '..' + end + ']: recalculated sum = ' + tree[node] + '.' });
  }
  steps.push({ type: 'start', node: -1, color: null,
    msg: 'Updating index ' + idx + ' from ' + oldVal + ' to ' + val + ' (delta=' + delta + ').' });
  update(1, 0, n - 1, idx, val);
  steps.push({ type: 'result', node: -1, color: null,
    msg: 'Update complete. arr[' + idx + '] = ' + val + '.', result: val });
  return steps;
}

/* ─── Layout Calculation ─── */
function stCalcLayout(canvas, n) {
  var depth  = Math.ceil(Math.log2(n)) + 1;
  var levels = depth;
  var W      = canvas.width;
  var H      = Math.max(300, levels * 90 + 40);
  canvas.height = H;

  var pos = {};
  var nodeR = Math.min(28, Math.floor(W / (Math.pow(2, levels - 1) * 2.2)));
  nodeR = Math.max(16, nodeR);

  function layout(node, start, end, level, xMin, xMax) {
    var x = (xMin + xMax) / 2;
    var y  = level * 80 + 50;
    pos[node] = { x: x, y: y, r: nodeR, start: start, end: end, val: stState.tree[node] };
    if (start === end) return;
    var mid = Math.floor((start + end) / 2);
    layout(2 * node, start, mid,     level + 1, xMin, (xMin + xMax) / 2);
    layout(2 * node + 1, mid + 1, end, level + 1, (xMin + xMax) / 2, xMax);
  }

  layout(1, 0, n - 1, 0, nodeR + 4, W - nodeR - 4);
  return pos;
}

/* ─── Drawing ─── */
function stDraw() {
  var canvas = document.getElementById('stCanvas');
  if (!canvas) return;
  var ctx    = canvas.getContext('2d');
  var pos    = stState.nodePos;
  var colors = stState.nodeColor;
  var tree   = stState.tree;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!stState.built) return;

  var n = stState.n;

  // Draw edges first
  function drawEdges(node, start, end) {
    if (start === end) return;
    var mid  = Math.floor((start + end) / 2);
    var from = pos[node];
    var toL  = pos[2 * node];
    var toR  = pos[2 * node + 1];
    if (!from || !toL || !toR) return;

    ctx.strokeStyle = 'rgba(100,116,139,0.35)';
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y + from.r);
    ctx.lineTo(toL.x,  toL.y  - toL.r);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(from.x, from.y + from.r);
    ctx.lineTo(toR.x,  toR.y  - toR.r);
    ctx.stroke();

    drawEdges(2 * node, start, mid);
    drawEdges(2 * node + 1, mid + 1, end);
  }

  drawEdges(1, 0, n - 1);

  // Draw nodes
  function drawNodes(node, start, end) {
    var p   = pos[node];
    if (!p) return;
    var col = ST_COL[colors[node] || 'DEFAULT'];

    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle   = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Value
    var val   = tree[node];
    var valStr = val !== undefined ? String(val) : '';
    ctx.fillStyle  = col.text;
    ctx.font       = 'bold ' + Math.min(13, p.r * 0.7) + 'px "Fira Code", monospace';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(valStr, p.x, p.y);

    // Range label below node
    ctx.fillStyle    = 'rgba(148,163,184,0.8)';
    ctx.font         = Math.min(9, p.r * 0.45) + 'px Poppins,sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('[' + start + '..' + end + ']', p.x, p.y + p.r + 3);

    if (start === end) return;
    var mid = Math.floor((start + end) / 2);
    drawNodes(2 * node, start, mid);
    drawNodes(2 * node + 1, mid + 1, end);
  }

  drawNodes(1, 0, n - 1);
}

/* ─── Reset node colors ─── */
function stResetColors() {
  Object.keys(stState.nodePos).forEach(function(k) {
    stState.nodeColor[k] = 'DEFAULT';
  });
}

/* ─── Apply a single step ─── */
function stApplyStep(step) {
  var statusEl = document.getElementById('stStatus');
  if (statusEl && step.msg) {
    statusEl.textContent = step.msg;
    statusEl.className   = 'st-status-bar ' + (step.type === 'result' ? 'done' : step.type === 'propagate' || step.type === 'update' ? 'update' : 'query');
  }

  if (step.node && step.node > 0 && step.color) {
    stState.nodeColor[step.node] = step.color;
  }

  if (step.type === 'result') {
    var panel  = document.getElementById('stResultPanel');
    var iconEl = document.getElementById('stResultIcon');
    var textEl = document.getElementById('stResultText');
    if (panel && iconEl && textEl) {
      iconEl.textContent = step.result !== undefined ? '✅' : '⚡';
      textEl.textContent = step.msg;
      panel.classList.remove('hidden');
    }
  }

  stDraw();
}

/* ─── Playback ─── */
function stGetDelay() {
  var el = document.getElementById('stSpeed');
  return ST_SPEED_MAP[el ? el.value : 3] || 400;
}

function stPlay() {
  if (stState.playing) return;
  if (stState.stepIdx >= stState.steps.length) { stState.stepIdx = 0; stResetColors(); }
  stState.playing = true;
  stUpdatePlaybackBtns();
  stPlayNext();
}

function stPlayNext() {
  if (!stState.playing) return;
  if (stState.stepIdx >= stState.steps.length) {
    stState.playing = false;
    stUpdatePlaybackBtns();
    return;
  }
  stApplyStep(stState.steps[stState.stepIdx]);
  stState.stepIdx++;
  stUpdateStepCounter();
  stState.timer = setTimeout(stPlayNext, stGetDelay());
}

function stPause() {
  stState.playing = false;
  if (stState.timer) { clearTimeout(stState.timer); stState.timer = null; }
  stUpdatePlaybackBtns();
}

function stStep() {
  if (stState.playing) stPause();
  if (stState.stepIdx >= stState.steps.length) return;
  stApplyStep(stState.steps[stState.stepIdx]);
  stState.stepIdx++;
  stUpdateStepCounter();
  stUpdatePlaybackBtns();
}

function stResetAnim() {
  stPause();
  stState.stepIdx = 0;
  stResetColors();
  var resultPanel = document.getElementById('stResultPanel');
  if (resultPanel) resultPanel.classList.add('hidden');
  var statusEl = document.getElementById('stStatus');
  if (statusEl) { statusEl.textContent = 'Animation reset. Press Play or Step.'; statusEl.className = 'st-status-bar'; }
  stUpdateStepCounter();
  stDraw();
}

function stUpdateStepCounter() {
  var numEl = document.getElementById('stStepNum');
  var totEl = document.getElementById('stStepTotal');
  if (numEl) numEl.textContent = stState.stepIdx;
  if (totEl) totEl.textContent = stState.steps.length;
}

function stUpdatePlaybackBtns() {
  var playBtn  = document.getElementById('stPlayBtn');
  var pauseBtn = document.getElementById('stPauseBtn');
  var stepBtn  = document.getElementById('stStepBtn');
  var hasSteps = stState.steps.length > 0;
  if (playBtn)  playBtn.disabled  = stState.playing || !hasSteps;
  if (pauseBtn) pauseBtn.disabled = !stState.playing;
  if (stepBtn)  stepBtn.disabled  = !hasSteps || stState.stepIdx >= stState.steps.length;
}

/* ─── Build ─── */
function stDoBuild() {
  stPause();
  var inputEl = document.getElementById('stArrayInput');
  if (!inputEl) return;

  var raw = inputEl.value.split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(v) { return !isNaN(v); });
  if (raw.length < 2 || raw.length > 16) {
    var statusEl = document.getElementById('stStatus');
    if (statusEl) { statusEl.textContent = 'Please enter between 2 and 16 numbers.'; statusEl.className = 'st-status-bar update'; }
    return;
  }

  stState.arr     = raw;
  stState.n       = raw.length;
  stState.tree    = stBuild(raw);
  stState.steps   = [];
  stState.stepIdx = 0;
  stState.built   = true;
  stState.playing = false;

  // Resize canvas
  var canvas = document.getElementById('stCanvas');
  if (!canvas) return;
  var wrap = canvas.parentElement;
  canvas.width = wrap ? wrap.clientWidth : 800;

  stState.nodePos   = stCalcLayout(canvas, stState.n);
  stState.nodeColor = {};
  Object.keys(stState.nodePos).forEach(function(k) { stState.nodeColor[k] = 'DEFAULT'; });

  var emptyEl = document.getElementById('stCanvasEmpty');
  if (emptyEl) emptyEl.classList.add('hidden');

  var resultPanel = document.getElementById('stResultPanel');
  if (resultPanel) resultPanel.classList.add('hidden');

  var statusEl = document.getElementById('stStatus');
  if (statusEl) {
    statusEl.textContent = 'Tree built from [' + raw.join(', ') + ']. Root sum = ' + stState.tree[1] + '. Now run a query or update.';
    statusEl.className = 'st-status-bar done';
  }

  // Update input bounds
  var qL = document.getElementById('stQueryL');
  var qR = document.getElementById('stQueryR');
  var ui = document.getElementById('stUpdateIdx');
  if (qL) { qL.max = raw.length - 1; }
  if (qR) { qR.max = raw.length - 1; qR.value = Math.min(parseInt(qR.value) || raw.length - 1, raw.length - 1); }
  if (ui) { ui.max = raw.length - 1; }

  stUpdateStepCounter();
  stUpdatePlaybackBtns();
  stDraw();
}

/* ─── Query ─── */
function stDoQuery() {
  if (!stState.built) { alert('Build the tree first.'); return; }
  stPause();

  var lEl = document.getElementById('stQueryL');
  var rEl = document.getElementById('stQueryR');
  var l   = parseInt(lEl ? lEl.value : 0);
  var r   = parseInt(rEl ? rEl.value : 0);
  var n   = stState.n;

  if (isNaN(l) || isNaN(r) || l < 0 || r >= n || l > r) {
    var statusEl = document.getElementById('stStatus');
    if (statusEl) { statusEl.textContent = 'Invalid range. Use 0-indexed values where L ≤ R < ' + n + '.'; statusEl.className = 'st-status-bar update'; }
    return;
  }

  stResetColors();
  var resultPanel = document.getElementById('stResultPanel');
  if (resultPanel) resultPanel.classList.add('hidden');

  stState.steps   = stGenQuerySteps(stState.tree, n, l, r);
  stState.stepIdx = 0;
  stUpdateStepCounter();
  stUpdatePlaybackBtns();

  var statusEl = document.getElementById('stStatus');
  if (statusEl) { statusEl.textContent = 'Query sum [' + l + '..' + r + '] ready. Press Play or Step to animate.'; statusEl.className = 'st-status-bar query'; }
  stDraw();
}

/* ─── Update ─── */
function stDoUpdate() {
  if (!stState.built) { alert('Build the tree first.'); return; }
  stPause();

  var idxEl = document.getElementById('stUpdateIdx');
  var valEl = document.getElementById('stUpdateVal');
  var idx   = parseInt(idxEl ? idxEl.value : 0);
  var val   = parseInt(valEl ? valEl.value : 0);
  var n     = stState.n;

  if (isNaN(idx) || isNaN(val) || idx < 0 || idx >= n) {
    var statusEl = document.getElementById('stStatus');
    if (statusEl) { statusEl.textContent = 'Invalid index. Use 0 to ' + (n - 1) + '.'; statusEl.className = 'st-status-bar update'; }
    return;
  }

  var oldVal = stState.arr[idx];
  stResetColors();
  var resultPanel = document.getElementById('stResultPanel');
  if (resultPanel) resultPanel.classList.add('hidden');

  // Clone tree for step generation (stGenUpdateSteps mutates it)
  var treeCopy = stState.tree.slice();
  stState.steps   = stGenUpdateSteps(treeCopy, n, idx, val, oldVal);
  // Defer applying to live state until animation completes
  stState.pendingUpdate = { idx: idx, val: val };

  stState.stepIdx = 0;
  stUpdateStepCounter();
  stUpdatePlaybackBtns();

  var statusEl = document.getElementById('stStatus');
  if (statusEl) { statusEl.textContent = 'Update arr[' + idx + '] = ' + val + ' ready. Press Play or Step to animate propagation.'; statusEl.className = 'st-status-bar update'; }
  stDraw();
}

/* ─── Init ─── */
function stInit() {
  var buildBtn  = document.getElementById('stBuildBtn');
  var queryBtn  = document.getElementById('stQueryBtn');
  var updateBtn = document.getElementById('stUpdateBtn');
  var playBtn   = document.getElementById('stPlayBtn');
  var pauseBtn  = document.getElementById('stPauseBtn');
  var stepBtn   = document.getElementById('stStepBtn');
  var resetBtn  = document.getElementById('stResetBtn');
  var speedSlider = document.getElementById('stSpeed');

  if (buildBtn)  buildBtn.addEventListener('click', stDoBuild);
  if (queryBtn)  queryBtn.addEventListener('click',  stDoQuery);
  if (updateBtn) updateBtn.addEventListener('click', stDoUpdate);
  if (playBtn)   playBtn.addEventListener('click',   stPlay);
  if (pauseBtn)  pauseBtn.addEventListener('click',  stPause);
  if (stepBtn)   stepBtn.addEventListener('click',   stStep);
  if (resetBtn)  resetBtn.addEventListener('click',  stResetAnim);

  if (speedSlider) {
    speedSlider.addEventListener('input', function() {
      var label = document.getElementById('stSpeedLabel');
      if (label) label.textContent = ST_SPEED_LABEL[speedSlider.value] || 'Normal';
      if (stState.playing) { stPause(); stPlay(); }
    });
  }

  // Resize canvas on window resize
  window.addEventListener('resize', function() {
    if (!stState.built) return;
    var canvas = document.getElementById('stCanvas');
    var wrap   = canvas && canvas.parentElement;
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    stState.nodePos = stCalcLayout(canvas, stState.n);
    stDraw();
  });

  // Auto-build on load with default array
  stDoBuild();
}