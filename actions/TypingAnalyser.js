// actions/TypingAnalyser.js - MODIFIED FOR GOOGLE DOCS
export class TypingAnalyser {
  constructor() {
    this.resetSession();
    this.lastKey = '';
    this.googleDocsEditor = null;
    console.log("✅ TypingAnalyser initialized for Google Docs");
  }
  
  resetSession() {
    this.session = {
      startTime: Date.now(),
      keystrokes: 0,
      backspaces: 0,
      words: [],
      currentWord: { text: '', startTime: 0, keystrokes: 0, backspaces: 0 },
      
      keyDownTimes: new Map(),
      interKeyIntervals: [],
      holdTimes: [],
      pauses: [],
      lastKeyDownTime: null,
      
      corrections: [],
      sameCharRepeats: 0,
      lastChar: '',
      
      burstCount: 0,
      inBurst: false,
      burstStartTime: 0
    };
  }
  
  setupGoogleDocsListeners() {
    console.log("Setting up Google Docs listeners...");
    
    // Method 1: Try to find Google Docs editor
    this.findGoogleDocsEditor();
    
    // Method 2: Global listener with better detection
    document.addEventListener('keydown', (e) => this.onKeyDown(e), true); // CAPTURE phase
    document.addEventListener('keyup', (e) => this.onKeyUp(e), true);
    document.addEventListener('input', (e) => this.onInput(e), true);
    
    // Method 3: MutationObserver for dynamic content
    this.setupMutationObserver();
  }
  
  findGoogleDocsEditor() {
    // Try different Google Docs editor selectors
    const selectors = [
      '[contenteditable="true"]',
      '.kix-appview-editor',
      '.docs-texteventtarget-iframe',
      '[role="textbox"]',
      '.kix-cursor-caret'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        this.googleDocsEditor = element;
        console.log(`✅ Found Google Docs editor: ${selector}`);
        break;
      }
    }
    
    if (!this.googleDocsEditor) {
      console.log("⚠️ Google Docs editor not found immediately, will keep searching");
      // Retry after delay
      setTimeout(() => this.findGoogleDocsEditor(), 1000);
    }
  }
  
  setupMutationObserver() {
    // Watch for Google Docs editor to appear
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              if (node.isContentEditable || 
                  node.querySelector('[contenteditable="true"]') ||
                  node.classList?.contains('kix-appview-editor')) {
                this.googleDocsEditor = node;
                console.log("✅ Google Docs editor appeared via mutation");
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  isInGoogleDocsEditor(target) {
    // Multiple checks for Google Docs
    if (!target) return false;
    
    return (
      // Direct contentEditable
      target.isContentEditable ||
      // Nested in contentEditable
      target.closest('[contenteditable="true"]') ||
      // Google Docs specific classes
      target.closest('.kix-appview-editor') ||
      target.closest('.docs-texteventtarget-iframe') ||
      // Currently focused element
      document.activeElement?.isContentEditable ||
      // Our found editor
      (this.googleDocsEditor && this.googleDocsEditor.contains(target))
    );
  }
  
  onKeyDown(event) {
    if (!this.isInGoogleDocsEditor(event.target)) {
      return;
    }
    
    const now = Date.now();
    const key = event.key;
    
    // Skip modifier keys
    if (key.length > 1 && !['Backspace', 'Enter', ' ', 'Tab', 'Delete'].includes(key)) {
      return;
    }
    
    console.log(`Key down in Google Docs: ${key}`);
    
    // Store keydown time
    this.session.keyDownTimes.set(key, now);
    
    // Calculate timing
    if (this.session.lastKeyDownTime) {
      const interval = now - this.session.lastKeyDownTime;
      this.session.interKeyIntervals.push(interval);
      
      // Detect pauses (>1.5 seconds)
      if (interval > 1500) {
        this.session.pauses.push({ 
          duration: interval, 
          timestamp: now 
        });
        console.log(`⏸️ Pause detected: ${interval}ms`);
      }
      
      // Detect bursts (<200ms between keys)
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
          console.log(`⚡ Burst ended: ${burstDuration}ms, ${this.session.burstCount} keys`);
        }
      }
    }
    
    this.session.lastKeyDownTime = now;
    this.session.keystrokes++;
    
    // Track current word timing
    if (this.session.currentWord.startTime === 0) {
      this.session.currentWord.startTime = now;
    }
    this.session.currentWord.keystrokes++;
    
    // Track same character repeats (for stuck keys)
    if (key === this.lastKey && key.match(/[a-zA-Z0-9]/)) {
      this.session.sameCharRepeats++;
    }
    this.lastKey = key;
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
      
      // Log unusually long holds (potential struggling)
      if (holdTime > 1000) {
        console.log(`⏱️ Long key hold: ${key} for ${holdTime}ms`);
      }
    }
  }
  
  onInput(event) {
    if (!this.isInGoogleDocsEditor(event.target)) {
      return;
    }
    
    // Detect backspaces/deletions (error corrections)
    if (event.inputType === 'deleteContentBackward' || 
        event.inputType === 'deleteContentForward' ||
        event.data === null) { // Deletion
      this.session.backspaces++;
      this.session.currentWord.backspaces++;
      
      // Record correction timing
      if (this.session.lastKeyDownTime) {
        const correctionDelay = Date.now() - this.session.lastKeyDownTime;
        this.session.corrections.push({
          delay: correctionDelay,
          timestamp: Date.now()
        });
        console.log(`↩️ Correction: ${correctionDelay}ms delay`);
      }
    }
    
    // Word boundary detection (space, enter, punctuation)
    const target = event.target;
    const text = target.textContent || target.innerText || '';
    const lastChar = text.charAt(text.length - 1);
    
    if (lastChar === ' ' || lastChar === '\n' || /[.,!?;:]/.test(lastChar)) {
      this.finalizeWord();
    } else {
      // Update current word text
      this.session.currentWord.text = text.trim().split(/\s+/).pop() || '';
    }
    
    this.session.lastChar = lastChar;
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
      console.log(`📝 Word completed: "${word.text}" (${word.duration}ms)`);
    }
    
    // Reset for next word
    this.session.currentWord = { 
      text: '', 
      startTime: Date.now(), 
      keystrokes: 0, 
      backspaces: 0 
    };
  }
  
  getSessionReport() {
    const intervals = this.session.interKeyIntervals;
    const mean = intervals.length > 0 ? 
      intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    
    // Calculate rhythm metrics
    let rhythmConsistency = 0;
    if (intervals.length > 1) {
      let varianceSum = 0;
      for (let i = 1; i < Math.min(intervals.length, 10); i++) {
        varianceSum += Math.abs(intervals[i] - intervals[i-1]);
      }
      rhythmConsistency = 1 / (varianceSum / Math.min(intervals.length - 1, 9) + 1);
    }
    
    return {
      sessionDuration: Date.now() - this.session.startTime,
      totalKeystrokes: this.session.keystrokes,
      totalBackspaces: this.session.backspaces,
      errorRate: this.session.backspaces / Math.max(this.session.keystrokes, 1),
      wordsCompleted: this.session.words.length,
      
      timing: {
        avgHoldTime: this.session.holdTimes.length > 0 ? 
          this.session.holdTimes.reduce((a, b) => a + b.duration, 0) / this.session.holdTimes.length : 0,
        avgInterKeyInterval: mean,
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
      
      rhythm: {
        rhythmConsistency: rhythmConsistency,
        avgInterKeyInterval: mean,
        pauseFrequency: this.session.pauses.length / (this.session.keystrokes / 100),
        burstCount: this.session.burstCount,
        burstFrequency: this.session.burstCount / ((Date.now() - this.session.startTime) / 60000)
      }
    };
  }
  
  exportSessionData() {
    const report = this.getSessionReport();
    
    return {
      metadata: {
        exportTime: new Date().toISOString(),
        sessionDuration: report.sessionDuration,
        platform: 'Google Docs',
        analyserVersion: '1.0.0'
      },
      summary: {
        totalKeystrokes: report.totalKeystrokes,
        totalBackspaces: report.totalBackspaces,
        wordsCompleted: report.wordsCompleted,
        errorRate: report.errorRate,
        typingSpeed: report.totalKeystrokes / (report.sessionDuration / 60000) // keystrokes per minute
      },
      metrics: {
        timing: report.timing,
        errors: report.errors,
        rhythm: report.rhythm
      },
      anonymizedPatterns: {
        // No actual text, just patterns
        pausePatterns: this.session.pauses.map(p => ({
          duration: p.duration,
          relativeTime: p.timestamp - this.session.startTime
        })),
        wordMetrics: this.session.words.map(w => ({
          length: w.text?.length || 0,
          duration: w.duration,
          keystrokes: w.keystrokes,
          backspaces: w.backspaces,
          charactersPerSecond: w.charactersPerSecond
        }))
      }
    };
  }
  
  // Helper for debugging
  debug() {
    console.log("=== TypingAnalyser Debug ===");
    console.log("Session stats:", {
      keystrokes: this.session.keystrokes,
      backspaces: this.session.backspaces,
      words: this.session.words.length,
      duration: Date.now() - this.session.startTime
    });
    console.log("Google Docs editor found:", !!this.googleDocsEditor);
    return this.getSessionReport();
  }
}