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
// Wait for DOM to be fully ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  
  const statsElement = document.getElementById('stats');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  const focusModeBtn = document.getElementById('focusModeBtn'); 
  
  console.log('Elements found:', {
    stats: statsElement ? 'FOUND' : 'MISSING',
    resetBtn: resetBtn ? 'FOUND' : 'MISSING', 
    exportBtn: exportBtn ? 'FOUND' : 'MISSING',
    focusModeBtn: focusModeBtn ? 'FOUND' : 'MISSING'  
  });
  
  if (!statsElement) {
    console.error('CRITICAL ERROR: No #stats element found!');
    document.body.innerHTML = '<p style="color:red;padding:20px;">ERROR: Missing #stats element</p>';
    return;
  }
  
  if (focusModeBtn) {
    focusModeBtn.addEventListener('click', function() {
      console.log('Focus mode button clicked');
      toggleFocusMode();
    });
    focusModeBtn.style.background = '#4A90E2';
    focusModeBtn.style.color = 'white';
    focusModeBtn.style.marginBottom = '10px';
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
  
  // ========== NEW FUNCTION: TOGGLE FOCUS MODE ==========
  function toggleFocusMode() {
    console.log('Toggling focus mode...');
    showMessage('Toggling focus mode...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showMessage('No active tab found');
        return;
      }
      
      const tab = tabs[0];
      console.log('Sending focus mode toggle to:', tab.url);
      
      chrome.tabs.sendMessage(tab.id, {action: 'toggleFocusMode'}, function(response) {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('Focus mode error:', error.message);
          showMessage('Focus mode failed: ' + error.message);
        } else if (response) {
          console.log('Focus mode toggled:', response.active);
          if (focusModeBtn) {
            focusModeBtn.textContent = response.active ? 
              'Focus Mode: ON' : 'Focus Mode: OFF';
          }
          showMessage(response.active ? 'Focus mode enabled!' : 'Focus mode disabled');
        }
      });
    });
  }
  
  // ========== update stats ==========
  function updateStats() {
    console.log('Updating stats...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showMessage('No active tab');
        return;
      }
      
      const tab = tabs[0];
      const url = tab.url || '';
      
      if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('arc://')) {
        showMessage('Please open Google Docs');
        return;
      }
      
      console.log('Checking page:', url);
      
      if (!url.includes('docs.google.com/document/')) {
        showMessage(`
          <div style="padding: 15px; text-align: center;">
            <h3>📝 Open Google Docs</h3>
            <p>Please open a <strong>Google Document</strong> to use EbbFlow</p>
            <p><small>Current page: ${url.substring(0, 50)}...</small></p>
          </div>
        `);
        return;
      }
      
      console.log('Requesting data from Google Docs');
      
      chrome.tabs.sendMessage(tab.id, {action: 'ping'}, function(pingResponse) {
        const pingError = chrome.runtime.lastError;
        
        if (pingError) {
          console.log('Content script not ready:', pingError.message);
          
          showMessage(`
            <div style="padding: 15px; text-align: center;">
              <h3>🔧 Setup Required</h3>
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
        
        // Content script is ready, get data
        console.log('Content script ready, requesting data');
        chrome.tabs.sendMessage(tab.id, {action: 'getTypingData'}, function(response) {
          const error = chrome.runtime.lastError;
          
          if (error) {
            console.log('Data request failed:', error.message);
            showMessage('Start typing in Google Docs to see analytics!');
            return;
          }
          
          if (response) {
            console.log('Data received:', response.totalKeystrokes, 'keystrokes');
            displayStats(response);
          } else {
            showMessage('Start typing to see analytics!');
          }
        });
      });
    });
  }
  
  function handleReset() {
    console.log('Resetting session...');
    showMessage('Resetting session...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showMessage('No active tab found');
        return;
      }
      
      const tab = tabs[0];
      
      if (!tab.url.includes('docs.google.com/document/')) {
        showMessage('Please open Google Docs to reset session');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'resetSession'}, function(response) {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('Reset error:', error.message);
          showMessage('Reset failed: ' + error.message);
        } else {
          console.log('Reset successful');
          showMessage('Session reset!');
          setTimeout(updateStats, 1000);
        }
      });
    });
  }
  
  function handleExport() {
    console.log('Exporting data...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        alert('No active tab found');
        return;
      }
      
      const tab = tabs[0];
      
      // Check Google Docs
      if (!tab.url.includes('docs.google.com/document/')) {
        alert('Please open Google Docs to export data');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'exportData'}, function(response) {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('Export error:', error.message);
          alert('Export failed: ' + error.message);
          return;
        }
        
        if (response && response.data) {
          console.log('Export data received');
          
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