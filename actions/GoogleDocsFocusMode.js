// actions/GoogleDocsFocusMode.js
export class GoogleDocsFocusMode {
  constructor() {
    this.isActive = false;
    this.originalStyles = new Map();
    this.styleElement = null;
  }

  enable() {
    if (this.isActive) return;
    
    console.log("🔧 Enabling Google Docs Focus Mode");
    
    // Hide distracting elements
    this.hideDistractingElements();
    
    // Apply focus styles
    this.applyFocusStyles();
    
    // Add toggle button to page
    this.addToggleButton();
    
    this.isActive = true;
    return true;
  }

  disable() {
    if (!this.isActive) return;
    
    console.log("🔧 Disabling Google Docs Focus Mode");
    
    this.restoreElements();
    this.removeFocusStyles();
    this.removeToggleButton();
    
    this.isActive = false;
    this.originalStyles.clear();
    return true;
  }

  toggle() {
    return this.isActive ? this.disable() : this.enable();
  }

  hideDistractingElements() {
    const elementsToHide = [
      '.docs-titlebar-buttons',
      '.docs-menubar',
      '.kix-appview-sidebar',
      '.docs-activity-sidebar',
      '.docs-comments-chip',
      '.docs-presence-container',
      '.docs-material-header',
    ];
    
    elementsToHide.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        this.originalStyles.set(el, el.style.display);
        el.style.display = 'none';
      });
    });
    
    const editor = document.querySelector('.kix-appview-editor');
    if (editor) {
      this.originalStyles.set(editor, {
        maxWidth: editor.style.maxWidth,
        padding: editor.style.padding
      });
      editor.style.maxWidth = '100%';
      editor.style.padding = '40px';
    }
  }

  applyFocusStyles() {
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'ebbflow-focus-styles';
    this.styleElement.textContent = `
      .kix-cursor-caret {
        background-color: rgba(66, 133, 244, 0.1) !important;
      }
      ::-webkit-scrollbar { width: 8px !important; }
      .kix-paragraphrenderer { line-height: 1.6 !important; }
    `;
    document.head.appendChild(this.styleElement);
  }

  addToggleButton() {
    this.toggleButton = document.createElement('button');
    this.toggleButton.innerHTML = '🧠 Focus OFF';
    this.toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 10px 20px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    this.toggleButton.onclick = () => {
      this.toggle();
      this.toggleButton.textContent = this.isActive ? 
        '🧠 Focus ON' : '🧠 Focus OFF';
    };
    document.body.appendChild(this.toggleButton);
  }

  restoreElements() {
    this.originalStyles.forEach((originalStyle, element) => {
      if (element && element.style) {
        if (typeof originalStyle === 'string') {
          element.style.display = originalStyle;
        } else if (originalStyle && typeof originalStyle === 'object') {
          Object.keys(originalStyle).forEach(prop => {
            element.style[prop] = originalStyle[prop];
          });
        }
      }
    });
  }

  removeFocusStyles() {
    if (this.styleElement) {
      this.styleElement.remove();
    }
  }

  removeToggleButton() {
    if (this.toggleButton && this.toggleButton.parentNode) {
      this.toggleButton.parentNode.removeChild(this.toggleButton);
    }
  }

  getStatus() {
    return {
      name: 'google_docs_focus_mode',
      active: this.isActive,
      description: 'Hides distracting UI elements in Google Docs'
    };
  }
}