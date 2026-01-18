/**
 * Command history manager
 * Stores command history per-mode with navigation support
 */

const MAX_HISTORY_SIZE = 100;

/**
 * History class for a single mode
 */
class ModeHistory {
  constructor() {
    this.entries = [];      // Historical entries (oldest first)
    this.position = -1;     // Current position in history (-1 = not navigating)
    this.pending = '';      // Current input saved when starting to navigate
  }

  /**
   * Add an entry to history (after successful execution)
   * @param {string} entry - The command/text to add
   */
  add(entry) {
    if (!entry || entry.trim() === '') return;
    
    // Don't add duplicates of the most recent entry
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === entry) {
      return;
    }
    
    this.entries.push(entry);
    
    // Trim to max size
    if (this.entries.length > MAX_HISTORY_SIZE) {
      this.entries.shift();
    }
    
    // Reset navigation state
    this.position = -1;
    this.pending = '';
  }

  /**
   * Start or continue navigating up (older entries)
   * @param {string} currentInput - Current input buffer content
   * @returns {string|null} The historical entry, or null if no more history
   */
  navigateUp(currentInput) {
    if (this.entries.length === 0) return null;
    
    // First time navigating - save current input
    if (this.position === -1) {
      this.pending = currentInput;
      this.position = this.entries.length; // Start past the end
    }
    
    // Move up (towards older entries)
    if (this.position > 0) {
      this.position--;
      return this.entries[this.position];
    }
    
    // Already at oldest entry
    return this.entries[0];
  }

  /**
   * Navigate down (newer entries)
   * @returns {string} The newer entry, or the pending input if at the end
   */
  navigateDown() {
    if (this.position === -1) {
      // Not navigating, nothing to do
      return null;
    }
    
    // Move down (towards newer entries)
    this.position++;
    
    if (this.position >= this.entries.length) {
      // Back to the pending input
      this.position = -1;
      const result = this.pending;
      this.pending = '';
      return result;
    }
    
    return this.entries[this.position];
  }

  /**
   * Reset navigation state (call when exiting mode or submitting)
   */
  resetNavigation() {
    this.position = -1;
    this.pending = '';
  }

  /**
   * Check if currently navigating history
   * @returns {boolean}
   */
  isNavigating() {
    return this.position !== -1;
  }
}

/**
 * History manager - manages history for all modes
 */
export class HistoryManager {
  constructor() {
    this.histories = {
      CMD: new ModeHistory(),
      LLM: new ModeHistory(),
      SHELL: new ModeHistory()
    };
  }

  /**
   * Get history for a specific mode
   * @param {string} mode - Mode name (CMD, LLM, SHELL)
   * @returns {ModeHistory}
   */
  getHistory(mode) {
    return this.histories[mode] || null;
  }

  /**
   * Add entry to history for a mode
   * @param {string} mode - Mode name
   * @param {string} entry - Command/text to add
   */
  add(mode, entry) {
    const history = this.getHistory(mode);
    if (history) {
      history.add(entry);
    }
  }

  /**
   * Navigate up in history for a mode
   * @param {string} mode - Mode name
   * @param {string} currentInput - Current input buffer
   * @returns {string|null}
   */
  navigateUp(mode, currentInput) {
    const history = this.getHistory(mode);
    if (history) {
      return history.navigateUp(currentInput);
    }
    return null;
  }

  /**
   * Navigate down in history for a mode
   * @param {string} mode - Mode name
   * @returns {string|null}
   */
  navigateDown(mode) {
    const history = this.getHistory(mode);
    if (history) {
      return history.navigateDown();
    }
    return null;
  }

  /**
   * Reset navigation for a mode
   * @param {string} mode - Mode name
   */
  resetNavigation(mode) {
    const history = this.getHistory(mode);
    if (history) {
      history.resetNavigation();
    }
  }
}
