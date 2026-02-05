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
    
    this.findGoogleDocsEditor();
    
    const findAndAttachToIframe = () => {
      const iframe = document.querySelector('.docs-texteventtarget-iframe');
      
      if (iframe && iframe.contentDocument) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        iframeDoc.addEventListener('keydown', (e) => this.onKeyDown(e), true);
        iframeDoc.addEventListener('keyup', (e) => this.onKeyUp(e), true);
        iframeDoc.addEventListener('input', (e) => this.onInput(e), true);
        
        console.log("✅ Iframe listeners attached");
      } else {
        setTimeout(findAndAttachToIframe, 500);
      }
    };
    
    document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    document.addEventListener('keyup', (e) => this.onKeyUp(e), true);
    document.addEventListener('input', (e) => this.onInput(e), true);
    
    setTimeout(findAndAttachToIframe, 1000);
    this.setupMutationObserver();
  }
  
  findGoogleDocsEditor() {
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
        console.log(`✅ Found editor: ${selector}`);
        return;
      }
    }
    
    if (!this.findAttempts) this.findAttempts = 0;
    this.findAttempts++;
    
    if (this.findAttempts < 10) {
      setTimeout(() => this.findGoogleDocsEditor(), 1000);
    }
  }
  
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.isContentEditable || 
                  node.querySelector('[contenteditable="true"]') ||
                  node.classList?.contains('kix-appview-editor')) {
                this.googleDocsEditor = node;
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
    if (!target) return false;
    
    const checks = {
      isContentEditable: target.isContentEditable,
      hasContentEditableParent: !!target.closest('[contenteditable="true"]'),
      hasDocsClass: !!target.closest('.kix-appview-editor'),
      hasIframeClass: !!target.closest('.docs-texteventtarget-iframe'),
      isActiveEditable: document.activeElement?.isContentEditable,
      hasFoundEditor: this.googleDocsEditor && this.googleDocsEditor.contains(target),
      isFromIframe: target.ownerDocument !== document
    };
    
    return Object.values(checks).some(v => v);
  }
  
  onKeyDown(event) {
    if (event.target.ownerDocument === document && !this.isInGoogleDocsEditor(event.target)) {
      return;
    }
    
    const now = Date.now();
    const key = event.key;
    
    // Skip modifier keys
    if (key.length > 1 && !['Backspace', 'Enter', ' ', 'Tab', 'Delete'].includes(key)) {
      return;
    }
    
    this.session.keyDownTimes.set(key, now);
    
    if (this.session.lastKeyDownTime) {
      const interval = now - this.session.lastKeyDownTime;
      this.session.interKeyIntervals.push(interval);
      
      if (interval > 1500) {
        this.session.pauses.push({ 
          duration: interval, 
          timestamp: now 
        });
      }
      
      if (interval < 200) {
        if (!this.session.inBurst) {
          this.session.inBurst = true;
          this.session.burstStartTime = now;
          this.session.burstCount++;
        }
      } else {
        this.session.inBurst = false;
      }
    }
    
    this.session.lastKeyDownTime = now;
    this.session.keystrokes++;
    
    if (this.session.currentWord.startTime === 0) {
      this.session.currentWord.startTime = now;
    }
    this.session.currentWord.keystrokes++;
    
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
    }
  }
  
  onInput(event) {
    if (event.target.ownerDocument === document && !this.isInGoogleDocsEditor(event.target)) {
      return;
    }
    
    if (event.inputType === 'deleteContentBackward' || 
        event.inputType === 'deleteContentForward' ||
        event.data === null) {
      this.session.backspaces++;
      this.session.currentWord.backspaces++;
      
      if (this.session.lastKeyDownTime) {
        const correctionDelay = Date.now() - this.session.lastKeyDownTime;
        this.session.corrections.push({
          delay: correctionDelay,
          timestamp: Date.now()
        });
      }
    }
    
    const target = event.target;
    const text = target.textContent || target.innerText || '';
    const lastChar = text.charAt(text.length - 1);
    
    if (lastChar === ' ' || lastChar === '\n' || /[.,!?;:]/.test(lastChar)) {
      this.finalizeWord();
    } else {
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
    }
    
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
        typingSpeed: report.totalKeystrokes / (report.sessionDuration / 60000)
      },
      metrics: {
        timing: report.timing,
        errors: report.errors,
        rhythm: report.rhythm
      },
      anonymizedPatterns: {
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