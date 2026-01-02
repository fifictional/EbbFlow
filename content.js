// logging only
console.log("EbbFLow: Content script loaded!");

class SimpleTracker {
  constructor() {
    this.keyLog = [];
    this.startTime = Date.now();
    this.setupListeners();
  }
  
  setupListeners() {
    //  track key presses 
    document.addEventListener('keydown', (event) => {
      this.logKey(event);
    });
    
    // Track focus 
    window.addEventListener('blur', () => {
      console.log("FlowTeX: User switched tabs/windows");
    });
  }
  
  logKey(event) {
    const logEntry = {
      key: event.key,
      timestamp: Date.now(),
      target: event.target.tagName.toLowerCase()
    };
    
    this.keyLog.push(logEntry);
    
    // Log every 10th keystroke to avoid spam
    if (this.keyLog.length % 10 === 0) {
      console.log("FlowTeX: Keystroke log:", this.keyLog.slice(-5));
    }
    
    // Simple backspace detection
    if (event.key === 'Backspace') {
      console.log("FlowTeX: Backspace detected");
    }
  }
}

// Start tracker when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.flowtexTracker = new SimpleTracker();
  });
} else {
  window.flowtexTracker = new SimpleTracker();
}