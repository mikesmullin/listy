import { readdir } from 'fs/promises';
import { openSync, readSync, closeSync } from 'fs';
import { join } from 'path';

// List MIDI devices
async function listMidiDevices() {
  try {
    const entries = await readdir('/dev/snd');
    return entries
      .filter(name => name.startsWith('midiC'))
      .map(name => join('/dev/snd', name));
  } catch (err) {
    return [];
  }
}

// Wheel metrics tracker
class WheelMetrics {
  constructor() {
    this.events = [];
    this.lastDirection = null;
    this.directionChanges = 0;
    this.cwCount = 0;
    this.ccwCount = 0;
    this.lastEventTime = Date.now();
    this.maxEventFreq = 0;
    this.eventFreqWindow = [];
  }

  addEvent(direction) {
    const now = Date.now();
    const timeSinceLastEvent = now - this.lastEventTime;
    
    this.events.push({ direction, time: now, delta: timeSinceLastEvent });
    
    // Track direction changes
    if (this.lastDirection && this.lastDirection !== direction) {
      this.directionChanges++;
    }
    
    // Count direction
    if (direction === 'CW') this.cwCount++;
    else this.ccwCount++;
    
    // Track event frequency (events per second)
    this.eventFreqWindow.push(timeSinceLastEvent);
    if (this.eventFreqWindow.length > 20) this.eventFreqWindow.shift();
    
    this.lastDirection = direction;
    this.lastEventTime = now;
  }

  getSpeed() {
    if (this.eventFreqWindow.length === 0) return 0;
    const avgDelta = this.eventFreqWindow.reduce((a, b) => a + b, 0) / this.eventFreqWindow.length;
    return avgDelta > 0 ? 1000 / avgDelta : 0; // events per second
  }

  getStats() {
    const total = this.events.length;
    const speed = this.getSpeed();
    const avgDelta = this.events.length > 1
      ? this.events.slice(-10).reduce((sum, e) => sum + e.delta, 0) / 10
      : 0;
    
    return {
      total,
      cw: this.cwCount,
      ccw: this.ccwCount,
      directionChanges: this.directionChanges,
      currentSpeed: speed.toFixed(1),
      avgDelta: avgDelta.toFixed(0),
      ratio: ((this.cwCount / total) * 100).toFixed(1)
    };
  }
}

// Parse MIDI CC
function parseJogWheel(status, controller, value) {
  if ((status & 0xF0) !== 0xB0) return null;
  if (controller !== 0x0A) return null;
  
  const direction = value === 0x01 ? 'CW' : 'CCW';
  return direction;
}

// Main test
async function readMidiTest(devicePath, duration) {
  return new Promise((resolve) => {
    let fd;
    try {
      fd = openSync(devicePath, 'r');
      const buffer = Buffer.alloc(3);
      const metrics = new WheelMetrics();
      const startTime = Date.now();
      let lastStatsPrint = startTime;
      
      const readLoop = setInterval(() => {
        try {
          const bytesRead = readSync(fd, buffer, 0, 3);
          
          if (bytesRead === 3) {
            const status = buffer[0];
            const controller = buffer[1];
            const value = buffer[2];
            
            const direction = parseJogWheel(status, controller, value);
            if (direction) {
              metrics.addEvent(direction);
              const stats = metrics.getStats();
              
              // Print live updates every event (verbose)
              process.stdout.write(`\r[${stats.total}] ${direction} | Speed: ${stats.currentSpeed} ev/s | Δt: ${stats.avgDelta}ms | CW/CCW: ${stats.cw}/${stats.ccw} | Changes: ${stats.directionChanges}`);
            }
          }
        } catch (err) {
          // ignore
        }
        
        const elapsed = Date.now() - startTime;
        
        // Print stats every 1 second
        if (elapsed - lastStatsPrint > 1000) {
          lastStatsPrint = elapsed;
          const stats = metrics.getStats();
          console.log(`\n[${(elapsed / 1000).toFixed(1)}s] Speed: ${stats.currentSpeed} ev/s | Avg Δt: ${stats.avgDelta}ms | Total: ${stats.total} (${stats.cw}CW/${stats.ccw}CCW) | Dir changes: ${stats.directionChanges}`);
        }
        
        if (elapsed >= duration) {
          clearInterval(readLoop);
          closeSync(fd);
          
          const stats = metrics.getStats();
          console.log('\n\n=== FINAL STATS ===');
          console.log(`Total events: ${stats.total}`);
          console.log(`CW: ${stats.cw} | CCW: ${stats.ccw}`);
          console.log(`CW ratio: ${stats.ratio}%`);
          console.log(`Direction changes: ${stats.directionChanges}`);
          console.log(`Avg event interval: ${stats.avgDelta}ms`);
          console.log(`Estimated avg speed: ${stats.currentSpeed} events/sec`);
          
          resolve();
        }
      }, 10);
      
    } catch (err) {
      console.error('Error:', err.message);
      resolve();
    }
  });
}

// Main
async function main() {
  console.log('=== Hercules Starlight Jog Wheel Test ===\n');
  
  const devices = await listMidiDevices();
  if (devices.length === 0) {
    console.log('ERROR: No MIDI devices found');
    return;
  }
  
  const devicePath = devices.find(d => d.includes('midiC4')) || devices[devices.length - 1];
  console.log(`Device: ${devicePath}`);
  console.log(`Capturing for 10 seconds...\n`);
  
  await readMidiTest(devicePath, 10000);
}

main().catch(console.error);
