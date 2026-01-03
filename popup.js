console.log('=== EbbFlow Popup Starting ===');

// Wait for DOM to be fully ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  
  // Get elements
  const statsElement = document.getElementById('stats');
  const resetBtn = document.getElementById('resetBtn');
  const exportBtn = document.getElementById('exportBtn');
  
  // DEBUG: Log what we found
  console.log('Elements found:', {
    stats: statsElement ? 'FOUND' : 'MISSING',
    resetBtn: resetBtn ? 'FOUND' : 'MISSING', 
    exportBtn: exportBtn ? 'FOUND' : 'MISSING'
  });
  
  // If stats element is missing, something is very wrong
  if (!statsElement) {
    console.error('CRITICAL ERROR: No #stats element found!');
    document.body.innerHTML = '<p style="color:red;padding:20px;">ERROR: Missing #stats element</p>';
    return;
  }
  
  // Set up reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      console.log('Reset button clicked');
      handleReset();
    });
  } else {
    console.error('WARNING: Reset button not found');
    // Create a fallback button
    const fallbackReset = document.createElement('button');
    fallbackReset.textContent = '🔄 Reset (Fallback)';
    fallbackReset.style.background = '#EA4335';
    fallbackReset.style.color = 'white';
    fallbackReset.addEventListener('click', handleReset);
    document.body.appendChild(fallbackReset);
  }
  
  // Set up export button
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      console.log('Export button clicked');
      handleExport();
    });
  } else {
    console.error('WARNING: Export button not found');
    // Create a fallback button
    const fallbackExport = document.createElement('button');
    fallbackExport.textContent = '📤 Export (Fallback)';
    fallbackExport.style.background = '#34A853';
    fallbackExport.style.color = 'white';
    fallbackExport.addEventListener('click', handleExport);
    document.body.appendChild(fallbackExport);
  }
  
  // Initial display
  showMessage('Loading analytics...');
  
  // Start updating stats
  updateStats();
  
  // Update every 3 seconds
  setInterval(updateStats, 3000);
  
  // ========== FUNCTION DEFINITIONS ==========
  
  function handleReset() {
    console.log('Resetting session...');
    showMessage('Resetting session...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showMessage('No active tab found');
        return;
      }
      
      const tab = tabs[0];
      console.log('Sending reset to tab:', tab.url);
      
      chrome.tabs.sendMessage(tab.id, {action: 'resetSession'}, function(response) {
        // SAFE error check
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('Reset error:', error.message);
          showMessage('Reset failed: ' + error.message);
        } else {
          console.log('Reset successful');
          showMessage('Session reset!');
          // Refresh stats after 1 second
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
      console.log('Requesting export from:', tab.url);
      
      chrome.tabs.sendMessage(tab.id, {action: 'exportData'}, function(response) {
        // SAFE error check
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('Export error:', error.message);
          alert('Export failed: ' + error.message);
          return;
        }
        
        if (response && response.data) {
          console.log('Export data received');
          
          // Create downloadable file
          const dataStr = JSON.stringify(response.data, null, 2);
          const dataBlob = new Blob([dataStr], {type: 'application/json'});
          const dataUrl = URL.createObjectURL(dataBlob);
          
          const downloadLink = document.createElement('a');
          downloadLink.href = dataUrl;
          downloadLink.download = `ebbflow-data-${Date.now()}.json`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(dataUrl);
          
          alert('✅ Data exported successfully!');
        } else {
          alert('No data available to export. Start typing first!');
        }
      });
    });
  }
  
  function updateStats() {
    console.log('Updating stats...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showMessage('No active tab');
        return;
      }
      
      const tab = tabs[0];
      const url = tab.url || '';
      
      // Skip browser pages
      if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('arc://')) {
        showMessage('Open on Overleaf or Google Docs');
        return;
      }
      
      console.log('Requesting data from:', url);
      
      chrome.tabs.sendMessage(tab.id, {action: 'getTypingData'}, function(response) {
        // SAFE error check
        const error = chrome.runtime.lastError;
        if (error) {
          console.log('Content script not ready:', error.message);
          showMessage('Start typing on a text page');
          return;
        }
        
        if (response) {
          console.log('Data received:', response.totalKeystrokes, 'keystrokes');
          displayStats(response);
        } else {
          showMessage('No data yet - start typing!');
        }
      });
    });
  }
  
  function displayStats(data) {
    console.log('Displaying stats:', data);
    
    // Ensure data exists
    if (!data) {
      showMessage('No data available');
      return;
    }
    
    const safeData = {
      sessionDuration: data.sessionDuration || 0,
      totalKeystrokes: data.totalKeystrokes || 0,
      totalBackspaces: data.totalBackspaces || 0,
      wordsCompleted: data.wordsCompleted || 0,
      errorRate: data.errorRate || 0
    };
    
    const html = `
      <div class="metric">
        <h3>📈 Session Overview</h3>
        <p><strong>Keystrokes:</strong> <span class="highlight">${safeData.totalKeystrokes}</span></p>
        <p><strong>Backspaces:</strong> <span class="highlight">${safeData.totalBackspaces}</span></p>
        <p><strong>Words:</strong> ${safeData.wordsCompleted}</p>
        <p><strong>Duration:</strong> ${formatTime(safeData.sessionDuration)}</p>
        <p><strong>Error Rate:</strong> ${(safeData.errorRate * 100).toFixed(1)}%</p>
      </div>
    `;
    
    statsElement.innerHTML = html;
  }
  
  function showMessage(message) {
    console.log('Showing message:', message);
    if (!statsElement) return;
    
    statsElement.innerHTML = `
      <div class="metric">
        <h3>🧠 EbbFlow Analytics</h3>
        <p>${message}</p>
      </div>
    `;
  }
  
  function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  
  console.log('=== Popup initialization complete ===');
});