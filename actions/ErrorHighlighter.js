// actions/ErrorHighlighter.js
class ErrorHighlighter {
  constructor() {
    this.name = 'error_highlighter';
    this.isActive = false;
    this.styleElement = null;
    this.observer = null;
  }

  enable() {
    if (this.isActive) return;
    
    console.log('EbbFlow: Removing error highlighting');
    
    // Create and inject CSS
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'ebbflow-error-hider';
    this.styleElement.textContent = `
      /* Hide all error indicators in Overleaf */
      .ace_error, 
      .ace-illegal-text,
      .syntax-error,
      .ace_invalid,
      .ace_deprecated,
      .ace_underline-error {
        background-color: transparent !important;
        border-bottom: none !important;
        text-decoration: none !important;
        color: inherit !important;
      }
      
      /* Also target the gutter markers */
      .ace_gutter-cell.ace_error,
      .ace_gutter-cell.ace_warning {
        background-image: none !important;
      }
    `;
    document.head.appendChild(this.styleElement);
    
    // Set up observer for dynamic content
    this.setupObserver();
    
    this.isActive = true;
    return true;
  }

  disable() {
    if (!this.isActive) return;
    
    console.log('EbbFlow: Restoring error highlighting');
    
    // Remove the style element
    if (this.styleElement && document.head.contains(this.styleElement)) {
      document.head.removeChild(this.styleElement);
    }
    
    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.isActive = false;
    return true;
  }

  setupObserver() {
    // Watch for new elements being added (Overleaf updates dynamically)
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Re-apply styles to new elements
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              if (node.classList && (
                node.classList.contains('ace_error') ||
                node.classList.contains('ace-illegal-text')
              )) {
                node.classList.remove('ace_error', 'ace-illegal-text');
              }
            }
          });
        }
      });
    });
    
    // Start observing the editor container
    const editorContainer = document.querySelector('.ace_editor') || document.body;
    if (editorContainer) {
      this.observer.observe(editorContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  toggle() {
    return this.isActive ? this.disable() : this.enable();
  }

  getStatus() {
    return {
      name: this.name,
      active: this.isActive,
      description: 'Removes distracting syntax error highlighting'
    };
  }
}

export default ErrorHighlighter;