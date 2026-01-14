/// background.js - Updated for Google Docs
console.log("🧠 EbbFlow: Background script loaded");

// Optional: Store analytics data if you want cross-session persistence
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received:", message.action || message.type);
  
  if (message.type === 'KEYLOG_UPDATE') {
    // Store in chrome.storage (optional)
    chrome.storage.local.get(['keystrokeCount', 'backspaceCount'], (result) => {
      const newKeystrokes = (result.keystrokeCount || 0) + (message.keystrokes || 0);
      const newBackspaces = (result.backspaceCount || 0) + (message.backspaces || 0);
      
      chrome.storage.local.set({
        keystrokeCount: newKeystrokes,
        backspaceCount: newBackspaces,
        lastUpdated: new Date().toISOString()
      });
    });
  }
  
  // Also handle content script ready message
  if (message.action === 'contentScriptReady') {
    console.log("Content script ready on:", message.url);
  }
  
  sendResponse({received: true});
  return true;
});

// Optional: Show welcome notification on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("EbbFlow installed for Google Docs support");
  
  // You could show a notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/favicon_io/favicon-16x16.png',
    title: '🧠 EbbFlow Installed',
    message: 'Open Google Docs to start using the ADHD writing assistant!'
  });
});