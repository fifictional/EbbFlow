// content.js 

console.log("🎯 EBBFLOW loading on", window.location.href);


// Only run on Google Docs
if (window.location.hostname.includes('docs.google.com') && 
    window.location.pathname.includes('/document/')) {
  
  initEbbFlow();
} else {
  console.log("Not a Google Docs document page");
}

function initEbbFlow() {
  try {
    console.log("Initializing EbbFlow for Google Docs");
    
    // ========== SIMPLE TYPING ANALYSER ==========
    let stats = {
      keystrokes: 0,
      backspaces: 0,
      startTime: Date.now()
    };
    
    // Listen for typing
    document.addEventListener('keydown', function(e) {
      const isInEditor = e.target.isContentEditable || 
                         e.target.closest('[contenteditable="true"]');
      if (!isInEditor) return;
      
      stats.keystrokes++;
      if (e.key === 'Backspace') stats.backspaces++;
      console.log(`Keystroke ${stats.keystrokes}, Backspaces: ${stats.backspaces}`);
    });
    
    // ========== SIMPLE FOCUS MODE ==========
    let focusModeActive = false;
    
    function toggleFocusMode() {
      focusModeActive = !focusModeActive;
      console.log("Focus mode:", focusModeActive ? "ON" : "OFF");
      
      if (focusModeActive) {
        // Hide distracting elements
        document.querySelectorAll('.docs-titlebar-buttons, .docs-menubar').forEach(el => {
          el.style.opacity = '0.3';
          el.style.pointerEvents = 'none';
        });
      } else {
        // Show elements again
        document.querySelectorAll('.docs-titlebar-buttons, .docs-menubar').forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        });
      }
      
      return focusModeActive;
    }
    
    // ========== MESSAGE HANDLER ==========
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      console.log("📩 Received message:", request.action);
      
      switch(request.action) {
        case 'ping':
          sendResponse({ status: 'ready', time: Date.now() });
          break;
          
        case 'getTypingData':
          const data = {
            totalKeystrokes: stats.keystrokes,
            totalBackspaces: stats.backspaces,
            errorRate: stats.backspaces / Math.max(stats.keystrokes, 1),
            sessionDuration: Date.now() - stats.startTime,
            wordsCompleted: Math.floor(stats.keystrokes / 5)
          };
          sendResponse(data);
          break;
          
        case 'resetSession':
          stats = { keystrokes: 0, backspaces: 0, startTime: Date.now() };
          sendResponse({ status: 'reset' });
          break;
          
        case 'toggleFocusMode':
          const isActive = toggleFocusMode();
          sendResponse({ active: isActive });
          break;

        case 'exportData':
          console.log("Processing export request...");
          const exportData = {
            metadata: {
              exportTime: new Date().toISOString(),
              url: window.location.href,
              platform: 'Google Docs',
              extensionVersion: '1.0.0'
            },
            analytics: {
              totalKeystrokes: stats.keystrokes,
              totalBackspaces: stats.backspaces,
              errorRate: stats.backspaces / Math.max(stats.keystrokes, 1),
              sessionDuration: Date.now() - stats.startTime,
              wordsEstimated: Math.floor(stats.keystrokes / 5),
              typingSpeed: stats.keystrokes / ((Date.now() - stats.startTime) / 60000) // keystrokes per minute
            },
            privacyNote: "No actual text content stored - only typing patterns"
          };
          sendResponse({ 
            status: 'exported', 
            data: exportData 
          });
          break;
          
        default:
          sendResponse({ error: 'unknown_action' });
      }
      
      return true;
    });
    
    // Add visual marker
    addVisualMarker();
    
    // Store globally for debugging
    window.EbbFlow = { stats, toggleFocusMode };
    
    console.log("EbbFlow fully initialized");
    
  } catch (error) {
    console.error("EbbFlow initialization failed:", error);
  }
}

function addVisualMarker() {
  const marker = document.createElement('div');
  marker.innerHTML = `
    <div style="
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      border: 2px solid white;
    ">
      🧠 EbbFlow Active
    </div>
  `;
  
  // Wait for body to exist
  if (document.body) {
    document.body.appendChild(marker);
  } else {
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(marker);
    });
  }
  
  console.log("Purple marker added");
}