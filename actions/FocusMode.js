export class FocusMode {
  constructor() {
    this.active = false;
    this.originalStyles = new Map();
  }
  
  toggle() {
    this.active = !this.active;
    console.log(`Focus mode: ${this.active ? 'ON' : 'OFF'}`);
    
    const selectors = [
      '.docs-titlebar-buttons',
      '.docs-menubar', 
      '.docs-toolbar',
      '.kix-appview-toolbar',
      '.docs-gm'
    ];
    
    if (this.active) {
      // Enable focus mode
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          this.originalStyles.set(el, {
            opacity: el.style.opacity,
            pointerEvents: el.style.pointerEvents,
            filter: el.style.filter
          });
          
          el.style.opacity = '0.2';
          el.style.pointerEvents = 'none';
          el.style.filter = 'blur(1px)';
          el.style.transition = 'all 0.3s ease';
        });
      });
    } else {
      // Disable focus mode
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const original = this.originalStyles.get(el);
          if (original) {
            el.style.opacity = original.opacity;
            el.style.pointerEvents = original.pointerEvents;
            el.style.filter = original.filter;
          } else {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.filter = 'none';
          }
        });
      });
      this.originalStyles.clear();
    }
    
    return this.active;
  }
  
  isActive() {
    return this.active;
  }
}