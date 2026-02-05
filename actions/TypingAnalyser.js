// actions/TypingAnalyser.js 
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
    console.log("📡 Setting up Google Docs listeners...");
    
    // Method 1: Find the editor
    this.findGoogleDocsEditor();
    
    // Method 2: Find and listen to the hidden iframe
    const findAndAttachToIframe = () => {
      const iframe = document.querySelector('.docs-texteventtarget-iframe');
      
      if (iframe && iframe.contentDocument) {
        console.log("✅ Found Google Docs input iframe!");
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Listen to iframe's document
        iframeDoc.addEventListener('keydown', (e) => {
          console.log("🌍 IFRAME KEYDOWN:", e.key);
          this.onKeyDown(e);
        }, true);
        
        iframeDoc.addEventListener('keyup', (e) => this.onKeyUp(e), true);
        iframeDoc.addEventListener('input', (e) => this.onInput(e), true);
        
        console.log("✅ Listeners attached to iframe document");
      } else {
        console.log("⚠️ Iframe not ready, retrying...");
        setTimeout(findAndAttachToIframe, 500);
      }
    };
    
    // Also listen to main document (for fallback)
    document.addEventListener('keydown', (e) => {
      console.log("🌍 MAIN DOC KEYDOWN:", e.key);
      this.onKeyDown(e);
    }, true);
    
    document.addEventListener('keyup', (e) => this.onKeyUp(e), true);
    document.addEventListener('input', (e) => this.onInput(e), true);
    
    console.log("✅ Main document listeners attached");
    
    // Try to attach to iframe
    setTimeout(findAndAttachToIframe, 1000);
    
    // Method 3: MutationObserver
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
    
    console.log("🔍 Searching for Google Docs editor...");
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        this.googleDocsEditor = element;
        console.log(`✅ Found Google Docs editor: ${selector}`);
        console.log("Editor element:", element);
        return;
      }
    }
    
    console.log("⚠️ Google Docs editor not found immediately, will keep searching");
    console.log("Available contentEditable elements:", 
      Array.from(document.querySelectorAll('[contenteditable]')).map(el => ({
        tag: el.tagName,
        class: el.className,
        editable: el.contentEditable
      }))
    );
    
    // Retry after delay
    if (!this.findAttempts) this.findAttempts = 0;
    this.findAttempts++;
    
    if (this.findAttempts < 10) {
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
    console.log("🔍 Checking if in editor...");
    console.log("  Target:", target?.tagName, target?.className);
    
    if (!target) {
      console.log("  ❌ No target");
      return false;
    }
    
    const checks = {
      isContentEditable: target.isContentEditable,
      hasContentEditableParent: !!target.closest('[contenteditable="true"]'),
      hasDocsClass: !!target.closest('.kix-appview-editor'),
      hasIframeClass: !!target.closest('.docs-texteventtarget-iframe'),
      isActiveEditable: document.activeElement?.isContentEditable,
      hasFoundEditor: this.googleDocsEditor && this.googleDocsEditor.contains(target),
      // For iframe events, always accept
      isFromIframe: target.ownerDocument !== document
    };
    
    console.log("  Checks:", checks);
    
    const result = Object.values(checks).some(v => v);
    console.log(result ? "  ✅ IN EDITOR" : "  ❌ NOT IN EDITOR");
    
    return result;
  }
  
  onKeyDown(event) {
    console.log("🎯 onKeyDown CALLED with key:", event.key);
    
    // For iframe events, always accept them
    if (event.target.ownerDocument !== document) {
      console.log("  ✅ Event from iframe - accepting");
    } else if (!this.isInGoogleDocsEditor(event.target)) {
      console.log("  ⏭️ Skipping - not in editor");
      return;
    }
    
    console.log("  ✅ Processing keystroke");
    
    const now = Date.now();
    const key = event.key;
    
    // Skip modifier keys
    if (key.length > 1 && !['Backspace', 'Enter', ' ', 'Tab', 'Delete'].includes(key)) {
      console.log("  ⏭️ Skipping - modifier key");
      return;
    }
    
    console.log(`  ⌨️ COUNTING KEY: ${key}`);
    
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
        console.log(`  ⏸️ Pause detected: ${interval}ms`);
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
          console.log(`  ⚡ Burst ended: ${burstDuration}ms, ${this.session.burstCount} keys`);
        }
      }
    }
    
    this.session.lastKeyDownTime = now;
    this.session.keystrokes++;
    
    console.log(`  📊 TOTAL KEYSTROKES NOW: ${this.session.keystrokes}`);
    
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
    // For iframe events, always accept
    if (event.target.ownerDocument === document && !this.isInGoogleDocsEditor(event.target)) {
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