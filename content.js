
console.log("🔥🔥🔥 EBBFLOW CONTENT SCRIPT LOADED! 🔥🔥🔥");
console.log("Testing at:", new Date().toLocaleTimeString());
console.log("On URL:", window.location.href);

// Add visible marker to page
const marker = document.createElement('div');
marker.innerHTML = `
  <div style="
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border: 2px solid white;
  ">
    🧠 EbbFlow ACTIVE
  </div>
`;
document.body.appendChild(marker);

// Track typing
let keystrokes = 0;
// document.addEventListener('keydown', (e) => {
//   keystrokes++;
//   console.log(`⌨️ Key #${keystrokes}: "${e.key}"`);
// });

console.log("✅ EbbFlow ready! Try typing...");