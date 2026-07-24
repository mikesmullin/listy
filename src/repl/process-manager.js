/**
 * Parallel process manager
 * Tracks running/completed child processes for the parallel execution UI
 */

import { spawn } from 'child_process';

const ESC = '\x1b';

// 16 vibrant pastel colors [R, G, B]
const PALETTE = [
  [255, 153, 153], // coral
  [255, 204, 153], // peach
  [255, 255, 153], // lemon
  [153, 255, 153], // lime
  [153, 255, 229], // mint
  [153, 229, 255], // sky blue
  [153, 178, 255], // periwinkle
  [204, 153, 255], // lavender
  [255, 153, 229], // pink
  [255, 178, 102], // amber
  [102, 255, 178], // seafoam
  [102, 204, 255], // azure
  [255, 102, 178], // rose
  [178, 255, 102], // chartreuse
  [102, 255, 255], // cyan
  [255, 153, 102], // salmon
];

// djb2 hash: deterministic label → palette index
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Return ANSI 24-bit foreground color sequence for a given process label.
 * The same label always maps to the same color.
 */
export function getProcessColor(label) {
  const [r, g, b] = PALETTE[djb2(label) % PALETTE.length];
  return `${ESC}[38;2;${r};${g};${b}m`;
}

export const EXPIRY_MS = 60_000;   // process block vanishes 60s after exit
export const MAX_TAIL   = 5;       // lines of output shown per block
export const FRAME_MS   = 100;     // ~10 fps re-render

let _nextId = 0;

export class ManagedProcess {
  /**
   * @param {string} label
   * @param {{ maxTail?: number|null }} [opts]
   *   maxTail: lines to show (default MAX_TAIL). null = all lines (fills
   *   available scroll region; process-view still clips to the viewport).
   */
  constructor(label, { maxTail = MAX_TAIL } = {}) {
    this.id        = ++_nextId;
    this.label     = label;
    this.lines     = [];      // accumulated stdout+stderr lines
    this.startedAt = Date.now();
    this.exitCode  = null;    // null while running
    this.exitedAt  = null;
    this._proc     = null;
    this.maxTail   = maxTail; // null = show full output
  }

  get running()    { return this.exitCode === null; }
  get elapsedSec() { return ((this.exitedAt ?? Date.now()) - this.startedAt) / 1000; }
  get expired()    { return this.exitedAt !== null && Date.now() - this.exitedAt > EXPIRY_MS; }

  tail() {
    if (this.maxTail == null) return this.lines;
    return this.lines.slice(-this.maxTail);
  }
}

export class ProcessManager {
  constructor() {
    this.procs    = [];
    this._timer   = null;
    this._onFrame = null;
  }

  /** Start the frame loop; onFrame is called ~10× per second. */
  start(onFrame) {
    this._onFrame = onFrame;
    this._timer = setInterval(() => {
      this.procs = this.procs.filter(mp => !mp.expired);
      this._onFrame?.();
    }, FRAME_MS);
  }

  /** Stop frame loop and kill any still-running children. */
  stop() {
    clearInterval(this._timer);
    this._timer = null;
    this.killAll();
  }

  /** Kill all running children and empty the list (e.g. on Ctrl+L). */
  clear() {
    this.killAll();
    this.procs = [];
  }

  /** Send SIGTERM to every running child process. */
  killAll() {
    for (const mp of this.procs) {
      if (mp.running && mp._proc) {
        try { process.kill(-mp._proc.pid, 'SIGTERM'); } catch {}
      }
    }
  }

  hasRunning() {
    return this.procs.some(mp => mp.running);
  }

  /**
   * Spawn a shell command non-blocking; returns the ManagedProcess immediately.
   * @param {string} label   - Display label for the process block header
   * @param {string} command - Shell command to execute
   * @param {object} opts
   * @param {function} [opts.onLine] - Called with each new output line (for buffer.log)
   * @param {object}   [opts.env]    - Extra env vars to merge into process environment
   */
  dispatch(label, command, { onLine, env } = {}) {
    const mp = new ManagedProcess(label);
    this.procs.push(mp);

    const child = spawn('sh', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      detached: true,
    });
    if (child.stdin) child.stdin.end();
    mp._proc = child;

    const push = (text) => {
      for (const line of text.split('\n')) {
        if (line) {
          mp.lines.push(line);
          onLine?.(line + '\n');
        }
      }
    };

    child.stdout.on('data', d => push(d.toString()));
    child.stderr.on('data', d => push(d.toString()));
    child.on('close', code => {
      mp.exitCode = code ?? 0;
      mp.exitedAt = Date.now();
    });
    child.on('error', err => {
      mp.lines.push(`error: ${err.message}`);
      mp.exitCode = 1;
      mp.exitedAt = Date.now();
    });

    return mp;
  }

  /**
   * Add an already-completed synthetic entry (for :help, :vars, errors, etc.).
   * Entries with no content are skipped.
   * @param {string} label
   * @param {string[]} lines
   * @param {{ maxTail?: number|null }} [opts] - pass maxTail: null for full output
   *   (help listings); default still uses MAX_TAIL like live commands.
   */
  addSynthetic(label, lines, { maxTail = MAX_TAIL } = {}) {
    const filtered = lines.filter(l => l !== undefined && l !== null);
    if (filtered.length === 0) return null;
    const mp = new ManagedProcess(label, { maxTail });
    mp.lines     = filtered;
    mp.exitCode  = 0;
    mp.exitedAt  = Date.now();
    this.procs.push(mp);
    return mp;
  }
}

export const processManager = new ProcessManager();
