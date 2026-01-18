/**
 * Buffer manager for in-memory shell execution history
 * Stores command/output "rounds" in memory and syncs to buffer.log
 */

import { createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BUFFER_FILE = join(PROJECT_ROOT, 'buffer.log');

/**
 * A "round" represents one shell execution cycle:
 * - The command sent
 * - The stdout/stderr received
 */
class Round {
  constructor() {
    this.command = '';     // The command that was executed
    this.output = [];      // Array of output strings (stdout/stderr chunks)
    this.lineCount = 0;    // Number of terminal lines this round occupies
  }

  /**
   * Add output to this round
   * @param {string} text - Output text
   */
  addOutput(text) {
    this.output.push(text);
  }

  /**
   * Increment the line count for this round
   * Called each time a line is printed to the terminal
   * @param {number} count - Number of lines to add (default 1)
   */
  addLines(count = 1) {
    this.lineCount += count;
  }

  /**
   * Get the number of terminal lines this round occupies
   * @returns {number}
   */
  getLineCount() {
    return this.lineCount;
  }

  /**
   * Get the full output as a single string
   * @returns {string}
   */
  getOutput() {
    return this.output.join('');
  }

  /**
   * Render this round as it would appear in the log
   * @returns {string}
   */
  render() {
    let result = '';
    if (this.command) {
      result += this.command + '\n';
    }
    result += this.getOutput();
    return result;
  }
}

/**
 * Buffer manager class
 * Maintains in-memory history of execution rounds
 */
class BufferManager {
  constructor() {
    this.rounds = [];          // Array of Round objects
    this.currentRound = null;  // Active round during command execution
    this.bufferStream = null;  // File stream for buffer.log
    this.blankedLineCount = 0; // Cumulative count of lines blanked by undo operations
  }

  /**
   * Initialize the buffer manager
   * Creates/truncates buffer.log and opens write stream
   */
  async init() {
    try {
      await writeFile(BUFFER_FILE, '', 'utf8');
      this.bufferStream = createWriteStream(BUFFER_FILE, { flags: 'a' });
      this.rounds = [];
      this.currentRound = null;
      this.blankedLineCount = 0;
    } catch (err) {
      console.error('Error initializing buffer.log:', err.message);
    }
  }

  /**
   * Start a new round (called before executing a command)
   * @param {string} command - The command being executed (display format)
   */
  startRound(command) {
    // Reset blanked line count when new output starts
    this.blankedLineCount = 0;
    this.currentRound = new Round();
    this.currentRound.command = command;
    this.rounds.push(this.currentRound);
    // Note: We don't write to buffer.log here.
    // The command + output will be synced in endRound().
    // This ensures $_BUFFER doesn't include the current round's input during LLM execution.
  }

  /**
   * Add output to the current round
   * Tracks in memory only - buffer.log is synced in endRound()
   * @param {string} text - Output text
   */
  addOutput(text) {
    if (this.currentRound) {
      this.currentRound.addOutput(text);
    }
    // Note: We don't write to buffer.log here.
    // The complete round (command + output) will be synced in endRound().
  }

  /**
   * End the current round
   * Syncs the complete round (command + output) to buffer.log
   */
  endRound() {
    if (this.currentRound) {
      // Write the complete round to buffer.log
      if (this.bufferStream) {
        const content = this.currentRound.render();
        this.bufferStream.write(content);
        // Add trailing newline if needed, plus extra newline for visual break
        if (!content.endsWith('\n')) {
          this.bufferStream.write('\n');
        }
        this.bufferStream.write('\n'); // Extra newline between rounds
      }
    }
    this.currentRound = null;
  }

  /**
   * Add lines to the current round's line count
   * @param {number} count - Number of lines to add
   */
  addLinesToCurrentRound(count = 1) {
    if (this.currentRound) {
      this.currentRound.addLines(count);
    }
  }

  /**
   * Get the line count of the last round (for erasing)
   * @returns {number} Line count of the last round, or 0 if no rounds
   */
  getLastRoundLineCount() {
    if (this.rounds.length === 0) {
      return 0;
    }
    return this.rounds[this.rounds.length - 1].getLineCount();
  }

  /**
   * Undo the last round - removes it from memory and rewrites buffer.log
   * Also tracks cumulative blanked lines for proper screen erasure
   * @returns {{round: Round, linesToErase: number}|null} The removed round and total lines to erase, or null if no rounds exist
   */
  async undoLastRound() {
    if (this.rounds.length === 0) {
      return null;
    }

    const removed = this.rounds.pop();
    // Add this round's lines to the cumulative blanked count
    // +1 accounts for the visual break newline added after each round
    this.blankedLineCount += removed.getLineCount() + 1;
    await this._syncToFile();
    // Return both the round and the total lines to erase (cumulative)
    return { round: removed, linesToErase: this.blankedLineCount };
  }

  /**
   * Clear all rounds and buffer.log
   */
  async clear() {
    this.rounds = [];
    this.currentRound = null;
    this.blankedLineCount = 0;
    await this._syncToFile();
  }

  /**
   * Get the path to buffer.log
   * @returns {string}
   */
  getBufferPath() {
    return BUFFER_FILE;
  }

  /**
   * Get all rounds
   * @returns {Round[]}
   */
  getRounds() {
    return this.rounds;
  }

  /**
   * Get the number of rounds
   * @returns {number}
   */
  getRoundCount() {
    return this.rounds.length;
  }

  /**
   * Sync in-memory rounds to buffer.log file
   * Rewrites the entire file from memory
   * @private
   */
  async _syncToFile() {
    try {
      // Close existing stream
      if (this.bufferStream) {
        this.bufferStream.end();
      }

      // Rebuild file content from rounds
      let content = '';
      for (const round of this.rounds) {
        content += round.render();
        if (!content.endsWith('\n')) {
          content += '\n';
        }
        // Add extra newline between rounds (visual break)
        content += '\n';
      }

      // Write file
      await writeFile(BUFFER_FILE, content, 'utf8');

      // Reopen stream for future writes
      this.bufferStream = createWriteStream(BUFFER_FILE, { flags: 'a' });
    } catch (err) {
      console.error('Error syncing buffer.log:', err.message);
    }
  }

  /**
   * Close the buffer stream
   */
  close() {
    if (this.bufferStream) {
      this.bufferStream.end();
      this.bufferStream = null;
    }
  }
}

// Singleton instance
export const bufferManager = new BufferManager();

// Convenience exports for backwards compatibility and ease of use
export function getBufferPath() {
  return bufferManager.getBufferPath();
}

export async function initBuffer() {
  return bufferManager.init();
}

export function appendToBuffer(text) {
  bufferManager.addOutput(text);
}

export async function clearBuffer() {
  return bufferManager.clear();
}

export function closeBuffer() {
  bufferManager.close();
}

export function startRound(command) {
  bufferManager.startRound(command);
}

export function endRound() {
  bufferManager.endRound();
}

export async function undoLastRound() {
  return bufferManager.undoLastRound();
}

export function getRoundCount() {
  return bufferManager.getRoundCount();
}
export function addLinesToCurrentRound(count = 1) {
  bufferManager.addLinesToCurrentRound(count);
}

export function getLastRoundLineCount() {
  return bufferManager.getLastRoundLineCount();
}