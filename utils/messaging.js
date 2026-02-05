// utils/messaging.js - Message handler utilities
export function createMessageHandler(actions = {}) {
  return function messageHandler(request, sender, sendResponse) {
    console.log("Message received:", request.action);
    
    switch(request.action) {
      case 'ping':
        sendResponse({ 
          status: 'ready', 
          platform: 'Google Docs',
          time: Date.now() 
        });
        break;
        
      case 'getTypingData':
        if (actions.analyzer) {
          sendResponse(actions.analyzer.getSessionReport());
        } else {
          sendResponse({ error: 'analyzer_not_ready' });
        }
        break;
        
      case 'resetSession':
        if (actions.analyzer) {
          actions.analyzer.resetSession();
          sendResponse({ status: 'reset', timestamp: Date.now() });
        } else {
          sendResponse({ error: 'analyzer_not_ready' });
        }
        break;
        
      case 'toggleFocusMode':
        if (actions.focusMode) {
          actions.focusMode.toggle();
          sendResponse({ 
            active: actions.focusMode.isActive,
            action: 'focus_mode_toggled'
          });
        } else {
          sendResponse({ error: 'focus_mode_not_available' });
        }
        break;
        
      default:
        sendResponse({ status: 'unknown_action' });
    }
    
    return true;
  };
}