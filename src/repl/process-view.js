/**
 * Process block renderer
 * Draws the parallel process list into the scroll region, frame by frame.
 */

import { getProcessColor } from './process-manager.js';
import { moveTo, clearLine } from './statusbar.js';

const ESC    = '\x1b';
const RESET  = `${ESC}[0m`;
const BOLD   = `${ESC}[1m`;
const DIM    = `${ESC}[2m`;
const GREEN  = `${ESC}[38;2;100;220;100m`;
const RED    = `${ESC}[38;2;255;110;110m`;
const YELLOW = `${ESC}[38;2;255;220;80m`;

const STRIP_ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const stripAnsi  = s => s.replace(STRIP_ANSI, '');

function fmtElapsed(sec) {
  const s = Math.floor(sec);
  if (s < 60)  return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

function statusBadge(mp) {
  if (mp.running)       return `${YELLOW}RUNNING ${fmtElapsed(mp.elapsedSec)}${RESET}`;
  if (mp.exitCode === 0) return `${GREEN}DONE ✓  ${fmtElapsed(mp.elapsedSec)} ago${RESET}`;
  return `${RED}FAIL ✗[${mp.exitCode}] ${fmtElapsed(mp.elapsedSec)} ago${RESET}`;
}

function renderHeader(mp, cols) {
  const color    = getProcessColor(mp.label);
  const badge    = statusBadge(mp);
  const labelLen = mp.label.length;
  const badgeLen = stripAnsi(badge).length;
  // layout: ┄ <label> <dashes> <badge> ┄
  // widths:  2 + 1 + labelLen + 1 + dashLen + 1 + badgeLen + 1 + 1 = cols
  const dashLen  = Math.max(1, cols - 4 - labelLen - badgeLen - 2);
  const dashes   = '─'.repeat(dashLen);
  return `${DIM}┄${RESET} ${BOLD}${color}${mp.label}${RESET} ${DIM}${dashes}${RESET} ${badge} ${DIM}┄${RESET}`;
}

/**
 * Render all process blocks into the scroll region.
 * Clears the entire region and redraws from top each call.
 *
 * @param {ManagedProcess[]} procs
 * @param {number} scrollTop    - First row (1-indexed)
 * @param {number} scrollBottom - Last row (1-indexed)
 * @param {number} cols         - Terminal columns
 * @returns {string} ANSI escape string; caller writes it to stdout
 */
export function renderProcessView(procs, scrollTop, scrollBottom, cols) {
  if (scrollBottom < scrollTop) return '';

  let out = '';
  let row = scrollTop;

  for (const mp of procs) {
    if (row > scrollBottom) break;

    // Header
    out += moveTo(row, 1) + clearLine() + renderHeader(mp, cols);
    row++;

    // Output lines (tail)
    const tail    = mp.tail();
    const isEmpty = tail.length === 0;
    const lines   = isEmpty ? ['(no output)'] : tail;

    for (const line of lines) {
      if (row > scrollBottom) break;
      const truncated = line.length > cols - 4
        ? line.slice(0, cols - 7) + '...'
        : line;
      const content = isEmpty
        ? `  ${DIM}│ ${truncated}${RESET}`
        : `  ${DIM}│${RESET} ${truncated}`;
      out += moveTo(row, 1) + clearLine() + content;
      row++;
    }

    // Blank separator between blocks
    if (row <= scrollBottom) {
      out += moveTo(row, 1) + clearLine();
      row++;
    }
  }

  // Clear unused rows
  while (row <= scrollBottom) {
    out += moveTo(row, 1) + clearLine();
    row++;
  }

  return out;
}
