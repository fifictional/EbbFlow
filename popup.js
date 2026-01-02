document.addEventListener('DOMContentLoaded', function() {
  const statsElement = document.getElementById('stats');
  const resetBtn = document.getElementById('resetBtn');
  
  function updateStats() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getTypingData'}, function(response) {
        if (response) {
          displayStats(response);
        }
      });
    });
  }
  
  function displayStats(data) {
    const html = `
      <div class="metric">
        <h3>📈 Session Overview</h3>
        <p>Duration: ${(data.sessionDuration / 60000).toFixed(1)} min</p>
        <p>Keystrokes: ${data.totalKeystrokes}</p>
        <p>Words: ${data.wordsCompleted}</p>
      </div>
      
      <div class="metric">
        <h3>⏱️ Timing</h3>
        <p>Avg Key Hold: ${data.timing.avgHoldTime.toFixed(0)}ms</p>
        <p>Typing Speed: ${(60000 / data.timing.avgInterKeyInterval).toFixed(1)} CPM</p>
        <p>Pauses: ${data.timing.totalPauses}</p>
      </div>
      
      <div class="metric">
        <h3>🎯 Errors</h3>
        <p>Backspaces: ${data.totalBackspaces}</p>
        <p>Error Rate: ${(data.errorRate * 100).toFixed(1)}%</p>
        <p>Stuck Keys: ${data.errors.sameCharRepeats}</p>
      </div>
      
      <div class="metric">
        <h3>🎵 Rhythm</h3>
        <p>Consistency: ${(data.rhythm?.rhythmConsistency * 100 || 0).toFixed(1)}%</p>
        <p>Bursts/min: ${(data.rhythm?.burstFrequency || 0).toFixed(1)}</p>
        <p>Speed CV: ${(data.rhythm?.coefficientOfVariation || 0).toFixed(2)}</p>
      </div>
    `;
    
    statsElement.innerHTML = html;
  }
  
  // Update every 2 seconds
  updateStats();
  setInterval(updateStats, 2000);
  
  // Reset button
  resetBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'resetSession'}, function() {
        updateStats();
      });
    });
  });
});