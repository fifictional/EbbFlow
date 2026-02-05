const DEBUG = false;

if (DEBUG) console.log("EBBFLOW loading on", window.location.href);

if (window.location.hostname.includes('docs.google.com') && 
    window.location.pathname.includes('/document/')) {
  if (DEBUG) console.log("Google Docs detected, initialising...");
  initEbbFlow().catch(err => {
    if (DEBUG) console.error("ERROR:", err);
  });
}

async function initEbbFlow() {
  try {
    // ========== DYNAMIC IMPORTS ==========
    const analyserUrl = chrome.runtime.getURL('utils/TypingAnalyser.js');
    const rlAgentUrl = chrome.runtime.getURL('agents/ContextualBanditAgent.js');
    const uiManagerUrl = chrome.runtime.getURL('utils/UIManager.js');
    const focusModeUrl = chrome.runtime.getURL('actions/GoogleDocsFocusMode.js');
    
    const [analyserModule, rlAgentModule, uiManagerModule, focusModeModule] = await Promise.all([
      import(analyserUrl),
      import(rlAgentUrl),
      import(uiManagerUrl),
      import(focusModeUrl)
    ]);
    
    const { TypingAnalyser } = analyserModule;
    const { ContextualBanditAgent } = rlAgentModule;
    const { UIManager } = uiManagerModule;
    const { GoogleDocsFocusMode } = focusModeModule;
    
    // ========== INITIALISE COMPONENTS ==========
    const analyser = new TypingAnalyser();
    const uiManager = new UIManager();
    const focusMode = new GoogleDocsFocusMode();
    
    
    // Start analyser
    setTimeout(() => {
      analyser.setupGoogleDocsListeners();
    }, 2000);
    
    async function setupRL() {
      const rlAgent = new ContextualBanditAgent();
      
      const saved = await chrome.storage.local.get(['banditModels']);
      if (saved.banditModels) {
        rlAgent.load(saved.banditModels);
      }
      
      let prevMetrics = null;
      let prevAction = null;  

      // make sure global timers object exists
      window.EbbFlow = window.EbbFlow || {};
      window.EbbFlow.timers = window.EbbFlow.timers || {};
      
      const rlInterval = setInterval(async () => {
        const report = analyser.getSessionReport();
        
        const metrics = {
          rhythmConsistency: report.rhythm.rhythmConsistency,
          pauseFrequency: report.rhythm.pauseFrequency,
          correctionsCount: report.errors.correctionsCount,
          avgInterKeyInterval: report.rhythm.avgInterKeyInterval
        };
        
        if (prevMetrics && prevAction) {
          const reward = rlAgent.calculateReward(prevMetrics, metrics, prevAction);
          rlAgent.learn(reward);
          if (DEBUG) console.log(`Reward: ${reward.toFixed(2)} for ${prevAction}`);
        }
        
        const action = rlAgent.chooseAction(metrics);
        if (DEBUG) console.log(`Bandit chose: ${action}`);
        
        uiManager.executeAction(action);
        
        prevMetrics = { ...metrics };
        prevAction = action;  
        
      }, 10000);

      // store interval so it can be cleared later
      window.EbbFlow.timers.rlInterval = rlInterval;

      const autosaveId = setInterval(() => {
        const saved = rlAgent.save();
        chrome.storage.local.set({ banditModels: saved });
        if (DEBUG) console.log("Bandit data auto-saved");
      }, 600000);

      window.EbbFlow.timers.autosave = autosaveId;
      
      return { rlAgent, rlInterval, autosaveId };
    }
        
    // ========== START ==========
    const { rlAgent, rlInterval } = await setupRL();
    
    // Store in global object (merge with existing)
    window.EbbFlow = Object.assign(window.EbbFlow || {}, {
      analyser,
      rlAgent,
      uiManager,
      focusMode,
      rlInterval,
      isRLRunning: true
    });
    
    // ========== MESSAGE HANDLER ==========
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const actions = {
        'ping': () => ({ status: 'ready', time: Date.now() }),
        'getTypingData': () => analyser.getSessionReport(),
        'resetSession': () => analyser.resetSession(),
        'toggleFocusMode': () => focusMode.toggle(),
        'getRLState': () => ({
          contextsLearned: Object.keys(rlAgent.models).length,
          baseline: rlAgent.baseline,
          decisions: rlAgent.history.length,
          stats: rlAgent.getStats()
        }),
        'stopRL': () => {
          // clear stored timers
          if (window.EbbFlow?.timers?.rlInterval) {
            clearInterval(window.EbbFlow.timers.rlInterval);
            window.EbbFlow.timers.rlInterval = null;
          }
          if (window.EbbFlow?.timers?.autosave) {
            clearInterval(window.EbbFlow.timers.autosave);
            window.EbbFlow.timers.autosave = null;
          }
          window.EbbFlow.isRLRunning = false;
          return { status: 'rl_stopped' };
        }
      };
      
      if (actions[request.action]) {
        sendResponse(actions[request.action]());
      } else {
        sendResponse({ error: 'unknown_action' });
      }
      
      return true;
    });
    
    // ========== CLEANUP ==========
    window.addEventListener('beforeunload', () => {
      if (window.EbbFlow?.rlAgent) {
        const saved = window.EbbFlow.rlAgent.save();
        chrome.storage.local.set({ banditModels: saved });
      }
      if (window.EbbFlow?.timers?.rlInterval) {
        clearInterval(window.EbbFlow.timers.rlInterval);
      }
      if (window.EbbFlow?.timers?.autosave) {
        clearInterval(window.EbbFlow.timers.autosave);
      }
    });

    // Add visual marker
    uiManager.addVisualMarker();

    if (DEBUG) console.log("EbbFlow initialized successfully");

      } catch (error) {
        if (DEBUG) console.error("EbbFlow initialization failed:", error);
      }
    }