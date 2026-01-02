// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Update stats from storage
  chrome.storage.local.get(['keystrokeCount', 'backspaceCount'], function(result) {
    document.getElementById('stats').textContent = 
      `Keystrokes: ${result.keystrokeCount || 0} | Backspaces: ${result.backspaceCount || 0}`;
  });
  
  // Clear data button
  document.getElementById('clearData').addEventListener('click', function() {
    chrome.storage.local.clear(function() {
      alert('Data cleared!');
      location.reload();
    });
  });
  
  // Export data button
  document.getElementById('exportData').addEventListener('click', function() {
    chrome.storage.local.get(null, function(data) {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flowtex-data.json';
      a.click();
      
      URL.revokeObjectURL(url);
    });
  });
});