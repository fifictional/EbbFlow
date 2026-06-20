console.log('=== EbbFlow Popup Starting ===');
// ------------------------
function showMessage(message) {
  console.log('showMessage (temp):', message);
  const statsElement = document.getElementById('stats');
  if (statsElement) {
    statsElement.innerHTML = `
      <div class="metric">
        <h3>EbbFlow</h3>
        <p>${message}</p>
      </div>
    `;
  }
}
// ------------------------
function withActiveTab(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs || tabs.length === 0) {
      showMessage('No active tab');
      return;
    }
    callback(tabs[0]);
  });
}
// ------------------------
// Wait for DOM to be fully ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  
  const statsElement = document.getElementById('stats');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  console.log('Elements found:', {
    stats: statsElement ? 'FOUND' : 'MISSING',
    resetBtn: resetBtn ? 'FOUND' : 'MISSING', 
    exportBtn: exportBtn ? 'FOUND' : 'MISSING',  
  });
  
  if (!statsElement) {
    console.error('CRITICAL ERROR: No #stats element found!');
    document.body.innerHTML = '<p style="color:red;padding:20px;">ERROR: Missing #stats element</p>';
    return;
  }
  
  
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      console.log('Reset button clicked');
      handleReset();
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      console.log('Export button clicked');
      handleExport();
    });
  }
  

  showMessage('Loading EbbFlow...');
  updateStats();
  setInterval(updateStats, 3000);
  

  // ========== update stats ==========
  function updateStats() {
    withActiveTab((tab) => {
      const url = tab.url || '';
      
      if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('arc://')) {
        showMessage('Please open Google Docs');
        return;
      }
      
      if (!url.includes('docs.google.com/document/')) {
        showMessage(`
          <div style="padding: 15px; text-align: center;">
            <h3> Open Google Docs</h3>
            <p>Please open a <strong>Google Document</strong> to use EbbFlow</p>
            <p><small>Current page: ${url.substring(0, 50)}...</small></p>
          </div>
        `);
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'ping'}, (pingResponse) => {
        if (chrome.runtime.lastError) {
          showMessage(`
            <div style="padding: 15px; text-align: center;">
              <h3> Setup Required</h3>
              <p>EbbFlow needs a quick setup on Google Docs:</p>
              <ol style="text-align: left; margin: 15px;">
                <li>Make sure you're in a Google <strong>document</strong></li>
                <li><strong>Refresh this page</strong> (F5 or Ctrl+R)</li>
                <li>Click the EbbFlow icon again</li>
              </ol>
              <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px;">
                Refresh Google Docs
              </button>
            </div>
          `);
          return;
        }
        
        chrome.tabs.sendMessage(tab.id, {action: 'getTypingData'}, (response) => {
          if (chrome.runtime.lastError) {
            showMessage('Start typing in Google Docs to see analytics!');
            return;
          }
          
          if (response) {
            displayStats(response);
          } else {
            showMessage('Start typing to see analytics!');
          }
        });
      });
    });
  }
  
  function handleReset() {
    withActiveTab((tab) => {
      if (!tab.url.includes('docs.google.com/document/')) {
        showMessage('Please open Google Docs to reset session');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'resetSession'}, () => {
        if (chrome.runtime.lastError) {
          showMessage('Reset failed: ' + chrome.runtime.lastError.message);
        } else {
          showMessage('Session reset!');
          setTimeout(updateStats, 1000);
        }
      });
    });
  }
  
  
  function handleExport() {
    withActiveTab((tab) => {
      if (!tab.url.includes('docs.google.com/document/')) {
        alert('Please open Google Docs to export data');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'exportData'}, (response) => {
        if (chrome.runtime.lastError) {
          alert('Export failed: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.data) {
          const dataStr = JSON.stringify(response.data, null, 2);
          const dataBlob = new Blob([dataStr], {type: 'application/json'});
          const dataUrl = URL.createObjectURL(dataBlob);
          
          const downloadLink = document.createElement('a');
          downloadLink.href = dataUrl;
          downloadLink.download = `ebbflow-gdocs-${Date.now()}.json`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(dataUrl);
          
          alert('Google Docs data exported!');
        } else {
          alert('No data available. Start typing in Google Docs first!');
        }
      });
    });
  }
  
  console.log('=== Popup initialization complete ===');
});