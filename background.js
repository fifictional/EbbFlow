// background.js -  handles storage for now
console.log("FlowTeX: Background script loaded");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'KEYLOG_UPDATE') {
    // Store in chrome.storage
    chrome.storage.local.get(['keystrokeCount', 'backspaceCount'], (result) => {
      const newKeystrokes = (result.keystrokeCount || 0) + message.keystrokes;
      const newBackspaces = (result.backspaceCount || 0) + message.backspaces;
      
      chrome.storage.local.set({
        keystrokeCount: newKeystrokes,
        backspaceCount: newBackspaces
      });
    });
  }
  
  sendResponse({received: true});
});