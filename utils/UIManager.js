// Manages all UI interactions and visual effects
export class UIManager {
  constructor() {
    this.currentMessages = new Set();
  }
  
  executeAction(action) {
    console.log(`UI Manager executing: ${action}`);
    
    switch(action) {
      case 'simplify_ui':
        this.simplifyUI();
        break;
      case 'encourage':
        this.showEncouragement();
        break;
      case 'suggest_break':
        this.suggestBreak();
        break;
      case 'focus_mode':
        this.enableFocusMode(); 
        break;
      case 'do_nothing':
        break;
    }
  }
  
  simplifyUI() {
    const elements = document.querySelectorAll(
      '.docs-titlebar-buttons, .docs-menubar, .docs-toolbar, .kix-appview-toolbar'
    );
    
    elements.forEach(el => {
      el.style.opacity = '0.3';
      el.style.pointerEvents = 'none';
      el.style.transition = 'opacity 0.3s ease';
    });
    
    // Restore after 20 seconds
    setTimeout(() => {
      elements.forEach(el => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });
    }, 20000);
  }
  
  showEncouragement() {
    const messages = [
      "Keep going! You're making progress.",
      "Great rhythm! Maintain that flow.",
      "Your writing is improving.",
      "One word at a time. You've got this!",
      "Focus on the next sentence."
    ];
    
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    this.showFloatingMessage(randomMsg, 3000, '#4F46E5');
  }
  
  suggestBreak() {
    this.showFloatingMessage(
      "Consider taking a 30-second stretch break. Your back will thank you!",
      4000,
      '#10B981'
    );
  }

    enableFocusMode() {
    console.log("UIManager: Calling GoogleDocsFocusMode...");
    if (window.EbbFlow && window.EbbFlow.focusMode) {
      window.EbbFlow.focusMode.toggle();
      console.log("GoogleDocsFocusMode.toggle() called");
    } else {
      console.error("GoogleDocsFocusMode not found in window.EbbFlow");
    }
  }

  
  showFloatingMessage(text, duration, color = '#4F46E5') {
    const id = `ebbflow-msg-${Date.now()}`;
    
    // Remove any existing messages
    this.currentMessages.forEach(msgId => {
      const oldMsg = document.getElementById(msgId);
      if (oldMsg) oldMsg.remove();
    });
    this.currentMessages.clear();
    
    const msg = document.createElement('div');
    msg.id = id;
    msg.textContent = text;
    msg.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: ${color};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: floatIn 0.3s ease-out;
      max-width: 300px;
      line-height: 1.4;
    `;
    
    // Add animation
    if (!document.querySelector('#ebbflow-animations')) {
      const style = document.createElement('style');
      style.id = 'ebbflow-animations';
      style.textContent = `
        @keyframes floatIn {
          from { transform: translateY(-10px) translateX(10px); opacity: 0; }
          to { transform: translateY(0) translateX(0); opacity: 1; }
        }
        @keyframes floatOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(msg);
    this.currentMessages.add(id);
    
    // Auto-remove
    setTimeout(() => {
      msg.style.animation = 'floatOut 0.3s ease-out';
      setTimeout(() => msg.remove(), 300);
      this.currentMessages.delete(id);
    }, duration);
  }
  
  addVisualMarker() {
    const marker = document.createElement('div');
    marker.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 11px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        user-select: none;
      " title="EbbFlow Active - Click for info">
        ✨ EbbFlow
      </div>
    `;
    
    marker.onclick = () => {
      this.showFloatingMessage(
        'EbbFlow is monitoring your writing flow and suggesting improvements.',
        5000,
        '#667eea'
      );
    };
    
    if (document.body) {
      document.body.appendChild(marker);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(marker);
      });
    }
  }
}