// EbbFlow Typing Analytics for ADHD Research
// SAFE VERSION - No sensitive data collection

console.log("🧠 EbbFlow Analytics loaded");

// Initialize ErrorHighlighter if we're on Overleaf
// if (window.location.hostname.includes('overleaf.com')) {
//   import(chrome.runtime.getURL('actions/ErrorHighlighter.js'))
//     .then(module => {
//       const ErrorHighlighter = module.default;
//       const errorHighlighter = new ErrorHighlighter();
//       errorHighlighter.enable();
//       console.log("🎯 EbbFlow: Error highlighting removed");
//     })
//     .catch(error => {
//       console.error("❌ EbbFlow: Fa
// iled to load ErrorHighlighter:", error);
//     });
// }

class TypingAnalyzer {
  constructor() {
    this.resetSession();
    this.setupListeners();
  }
  
  resetSession() {
    this.session = {
      startTime: Date.now(),
      keystrokes: 0,
      backspaces: 0,
      words: [],
      currentWord: { text: '', startTime: 0, keystrokes: 0, backspaces: 0 },
      
      // Timing metrics
      keyDownTimes: new Map(),
      interKeyIntervals: [],
      holdTimes: [],
      pauses: [],
      lastKeyDownTime: null,
      
      // Error metrics
      corrections: [],
      sameCharRepeats: 0,
      lastChar: '',
      
      // Rhythm metrics
      burstCount: 0,
      inBurst: false,
      burstStartTime: 0
    };
  }
  
  setupListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('input', (e) => this.onInput(e));
  }
  
  // ===== 1. TIMING DATA =====
  onKeyDown(event) {
    const now = Date.now();
    const key = event.key;
    
    // Skip modifier keys, shortcuts
    if (key.length > 1 && !['Backspace', 'Enter', ' ', 'Tab'].includes(key)) return;
    
    // Store keydown time for hold time calculation
    this.session.keyDownTimes.set(key, now);
    
    // Calculate inter-key interval (if there was a previous key)
    if (this.session.lastKeyDownTime) {
      const interval = now - this.session.lastKeyDownTime;
      this.session.interKeyIntervals.push(interval);
      
      // PAUSE DETECTION (>1500ms)
      if (interval > 1500) {
        this.session.pauses.push({
          duration: interval,
          position: this.session.currentWord.text.length,
          timestamp: now
        });
        console.log(`⏸️ Pause detected: ${interval}ms`);
      }
      
      // BURST DETECTION (rapid typing < 200ms)
      if (interval < 200) {
        if (!this.session.inBurst) {
          this.session.inBurst = true;
          this.session.burstStartTime = now;
          this.session.burstCount++;
        }
      } else {
        if (this.session.inBurst) {
          this.session.inBurst = false;
          const burstDuration = now - this.session.burstStartTime;
          console.log(`⚡ Burst: ${burstDuration}ms`);
        }
      }
    }
    
    this.session.lastKeyDownTime = now;
    this.session.keystrokes++;
    
    // Track current word
    if (this.session.currentWord.startTime === 0) {
      this.session.currentWord.startTime = now;
    }
    this.session.currentWord.keystrokes++;
  }
  
  onKeyUp(event) {
    const key = event.key;
    const keyDownTime = this.session.keyDownTimes.get(key);
    
    if (keyDownTime) {
      const holdTime = Date.now() - keyDownTime;
      this.session.holdTimes.push({
        key: key === ' ' ? 'Space' : key,
        duration: holdTime
      });
      this.session.keyDownTimes.delete(key);
    }
  }
  
  // ===== 2. ERROR PATTERNS =====
  onInput(event) {
    const target = event.target;
    if (!target.isContentEditable && 
        target.tagName !== 'TEXTAREA' && 
        (target.tagName !== 'INPUT' || target.type === 'password')) return;
    
    const text = target.value || target.textContent || '';
    const lastChar = text.charAt(text.length - 1);
    
    // BACKSPACE DETECTION
    if (event.inputType === 'deleteContentBackward') {
      this.session.backspaces++;
      this.session.currentWord.backspaces++;
      
      // Record correction with timing
      if (this.session.lastKeyDownTime) {
        const correctionDelay = Date.now() - this.session.lastKeyDownTime;
        this.session.corrections.push({
          delay: correctionDelay,
          position: this.session.currentWord.text.length,
          word: this.session.currentWord.text
        });
      }
    }
    
    // SAME-CHARACTER REPEATS (stuck key patterns)
    if (lastChar === this.session.lastChar && lastChar.match(/[a-zA-Z0-9]/)) {
      this.session.sameCharRepeats++;
    }
    this.session.lastChar = lastChar;
    
    // Word boundary detection
    if (lastChar === ' ' || lastChar === '\n' || event.inputType.includes('insertLineBreak')) {
      this.finalizeWord();
    } else {
      this.session.currentWord.text = text.trim().split(' ').pop() || '';
    }
  }
  
  finalizeWord() {
    if (this.session.currentWord.text.length > 0) {
      const word = {
        ...this.session.currentWord,
        endTime: Date.now(),
        duration: Date.now() - this.session.currentWord.startTime,
        charactersPerSecond: this.session.currentWord.text.length / 
                           ((Date.now() - this.session.currentWord.startTime) / 1000)
      };
      
      this.session.words.push(word);
      console.log(`📝 Word: "${word.text}" | CPS: ${word.charactersPerSecond.toFixed(2)} | Errors: ${word.backspaces}`);
    }
    
    // Reset for next word
    this.session.currentWord = { 
      text: '', 
      startTime: Date.now(), 
      keystrokes: 0, 
      backspaces: 0 
    };
  }
  
  // ===== 3. RHYTHM METRICS CALCULATION =====
  calculateRhythmMetrics() {
    const intervals = this.session.interKeyIntervals;
    if (intervals.length < 2) return null;
    
    // Coefficient of Variation (speed variance)
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / mean;
    
    // Simple autocorrelation (rhythm consistency)
    let autocorr = 0;
    for (let i = 1; i < Math.min(intervals.length, 10); i++) {
      autocorr += Math.abs(intervals[i] - intervals[i-1]);
    }
    autocorr = autocorr / Math.min(intervals.length - 1, 9);
    
    return {
      coefficientOfVariation: cv,
      rhythmConsistency: 1 / (autocorr + 1), // Higher = more consistent
      avgInterKeyInterval: mean,
      pauseFrequency: this.session.pauses.length / (this.session.keystrokes / 100),
      burstCount: this.session.burstCount,
      burstFrequency: this.session.burstCount / ((Date.now() - this.session.startTime) / 60000)
    };
  }
  
  // ===== 4. GET SUMMARY REPORT =====
  getSessionReport() {
    const rhythm = this.calculateRhythmMetrics();
    
    return {
      sessionDuration: Date.now() - this.session.startTime,
      totalKeystrokes: this.session.keystrokes,
      totalBackspaces: this.session.backspaces,
      errorRate: this.session.backspaces / Math.max(this.session.keystrokes, 1),
      wordsCompleted: this.session.words.length,
      
      timing: {
        avgHoldTime: this.session.holdTimes.length > 0 ? 
          this.session.holdTimes.reduce((a, b) => a + b.duration, 0) / this.session.holdTimes.length : 0,
        avgInterKeyInterval: rhythm?.avgInterKeyInterval || 0,
        totalPauses: this.session.pauses.length,
        avgPauseDuration: this.session.pauses.length > 0 ?
          this.session.pauses.reduce((a, b) => a + b.duration, 0) / this.session.pauses.length : 0
      },
      
      errors: {
        sameCharRepeats: this.session.sameCharRepeats,
        correctionsCount: this.session.corrections.length,
        avgCorrectionDelay: this.session.corrections.length > 0 ?
          this.session.corrections.reduce((a, b) => a + b.delay, 0) / this.session.corrections.length : 0
      },
      
      rhythm: rhythm || {
        coefficientOfVariation: 0,
        rhythmConsistency: 0,
        avgInterKeyInterval: 0,
        pauseFrequency: 0,
        burstCount: 0,
        burstFrequency: 0
      },
      
      rawData: {
        holdTimes: this.session.holdTimes.slice(-100),
        interKeyIntervals: this.session.interKeyIntervals.slice(-200),
        pauses: this.session.pauses,
        words: this.session.words
      }
    };
  }
  
  // ===== 5. EXPORT DATA =====
  exportSessionData() {
    const report = this.getSessionReport();
    
    return {
      metadata: {
        exportTime: new Date().toISOString(),
        sessionDuration: report.sessionDuration,
        url: window.location.hostname
      },
      summary: {
        totalKeystrokes: report.totalKeystrokes,
        totalBackspaces: report.totalBackspaces,
        wordsCompleted: report.wordsCompleted,
        errorRate: report.errorRate
      },
      metrics: {
        timing: report.timing,
        errors: report.errors,
        rhythm: report.rhythm
      },
      anonymizedPatterns: {
        holdTimeDistribution: report.rawData.holdTimes,
        interKeyIntervals: report.rawData.interKeyIntervals,
        pausePatterns: report.rawData.pauses.map(p => ({
          duration: p.duration,
          position: p.position
        })),
        wordMetrics: report.rawData.words.map(w => ({
          length: w.text?.length || 0,
          duration: w.duration,
          keystrokes: w.keystrokes,
          backspaces: w.backspaces,
          charactersPerSecond: w.charactersPerSecond
        }))
      }
    };
  }
}

// Initialize analyzer
const analyzer = new TypingAnalyzer();

// Add visible marker to page
const marker = document.createElement('div');
marker.innerHTML = `
  <div style="
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border: 2px solid white;
    font-size: 14px;
  ">
    🧠 EbbFlow Analytics Active
  </div>
`;
document.body.appendChild(marker);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request.action);
  
  if (request.action === 'getTypingData') {
    sendResponse(analyzer.getSessionReport());
    return true;
  }
  
  if (request.action === 'resetSession') {
    analyzer.resetSession();
    sendResponse({ status: 'reset', timestamp: Date.now() });
    return true;
  }
  
  if (request.action === 'exportData') {
    sendResponse({ 
      status: 'exported',
      data: analyzer.exportSessionData()
    });
    return true;
  }
  
  sendResponse({ status: 'unknown_action' });
  return true;
});

// Send a ready message when content script loads
chrome.runtime.sendMessage({ 
  action: 'contentScriptReady',
  url: window.location.href 
});

console.log("✅ EbbFlow Typing Analytics initialized");
console.log("📊 Tracking: Timing, Errors, Rhythm patterns");