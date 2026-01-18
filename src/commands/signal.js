/**
 * Signal manager for child process interrupt handling
 * 
 * Implements escalating Ctrl+C behavior during shell execution:
 * - 1st press: Forward SIGINT to child process
 * - 2nd press: Send SIGKILL to child process
 * - 3rd press: Exit parent process immediately
 */

let currentChildProcess = null;
let interruptCount = 0;
let onParentExitCallback = null;

/**
 * Register a child process for interrupt management
 * @param {ChildProcess} proc - The child process to manage
 * @param {function} onExit - Optional callback when parent exits
 */
export function registerChildProcess(proc, onExit) {
  currentChildProcess = proc;
  interruptCount = 0;
  onParentExitCallback = onExit;
}

/**
 * Unregister the child process (call when process ends)
 * Resets the interrupt counter
 */
export function unregisterChildProcess() {
  currentChildProcess = null;
  interruptCount = 0;
  onParentExitCallback = null;
}

/**
 * Handle an interrupt (Ctrl+C) during child process execution
 * Implements escalating behavior:
 * - 1st: SIGINT to child
 * - 2nd: SIGKILL to child  
 * - 3rd: Exit parent
 * @returns {boolean} True if handled (child process was running), false otherwise
 */
export function handleInterrupt() {
  if (!currentChildProcess) {
    // No child process running, caller should handle (e.g., exit REPL)
    return false;
  }
  
  interruptCount++;
  
  if (interruptCount === 1) {
    // First press: forward SIGINT to child
    try {
      currentChildProcess.kill('SIGINT');
    } catch (e) {
      // Child may have already exited
    }
  } else if (interruptCount === 2) {
    // Second press: send SIGKILL to child
    try {
      currentChildProcess.kill('SIGKILL');
    } catch (e) {
      // Child may have already exited
    }
  } else {
    // Third press: exit parent process
    if (onParentExitCallback) {
      onParentExitCallback();
    }
    process.exit(0);
  }
  
  return true;
}

/**
 * Get current interrupt count (for debugging/display)
 * @returns {number} Number of interrupts received
 */
export function getInterruptCount() {
  return interruptCount;
}

/**
 * Check if a child process is currently registered
 * @returns {boolean} True if a child process is registered
 */
export function hasChildProcess() {
  return currentChildProcess !== null;
}
