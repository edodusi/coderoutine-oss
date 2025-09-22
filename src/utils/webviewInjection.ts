/**
 * WebView JavaScript injection utilities for article cleanup and modal blocking
 */

export const getWebViewInjectionScript = (): string => {
  return `
    (function() {
      const body = document.body;
      const head = document.head || document.getElementsByTagName('head')[0];

      // Block all user clicks by intercepting them in JavaScript
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (target && target.href) {
          e.preventDefault();
          e.stopPropagation();
          // Use postMessage to communicate with React Native
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'EXTERNAL_LINK_CLICK',
            url: target.href
          }));
          return false;
        }
      }, true);

      // Critical path: viewport and basic setup
      if (head) {
        let viewport = head.querySelector('meta[name="viewport"]');
        if (!viewport) {
          viewport = document.createElement('meta');
          viewport.name = 'viewport';
          head.appendChild(viewport);
        }
        viewport.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
      }

      // Fast medium detection
      const isMedium = location.href.includes('medium.com') ||
        !!document.querySelector('meta[property="og:site_name"][content="Medium"]');

      // Enhanced selector with modal and alert removal
      const selectors = '.mobile-footer-ufi,.cookie-consent,.cookieBanner,.subscribe-banner,.ad-container,.adsbygoogle,.subscription-widget-wrap,.newsletter-signup,.popup,.modal,.overlay,.paywall,.paywall-overlay,.post-footer,#discussion,.related-posts,.article-actions,.share-buttons,.social-share,.cookie-banner,.gdpr-consent,.consent-banner,.subscribe-footer,.cookieBanner-fZ6hup,.newsletter-popup,.subscription-popup,.ad-banner,.ad-slot,.ad-placeholder,.ad-space,.ad-area,.ad-break,.ad-module,.ad-component,.ad-wrapper,.ad-section,.sponsor-message,.sponsor-note,.sponsor-info,.sponsor-box,.sponsor-ad,.sponsor-link,.sponsored-link,.sponsored-ad,.sponsored-box,.sponsored-info,.sponsored-note,.modal__overlay,.main-menu,[role="dialog"],[role="banner"],[role="alert"],[role="alertdialog"],[aria-live],[aria-live="polite"],[aria-live="assertive"],[id*="cookie"],[class*="cookie"],[id*="consent"],[class*="consent"],[id*="gdpr"],[class*="gdpr"],[class*="subscribeDialog"],[class*="background-"],[class*="overlay"],[class*="cookieBanner"],[class*="modal"],[id*="subscribe"],[id*="popup"],[id*="modal"],[class*="alert"],[class*="notification"],[class*="toast"],[id*="alert"],[id*="notification"]' +
        (isMedium ? ',.ajx,.pw-susi-modal,.speechify-ignore .mv,.pw-multi-vote-icon,.pw-multi-vote-count,.xg.o.abu.abv.hv.abw.abx.aby.abz.aca.acb.acc.acd.ace.acf.co.bq.acg.ach.aci.ok.acj.ack,[class*="xg o abu abv"],[data-testid="close-button"]' : '');

      // Block all modal creation functions
      if (isMedium) {
        // Medium-specific modal blocking
        window.addEventListener('scroll', (e) => {
          e.stopPropagation();
        }, true);
        
        // Override common modal functions
        if (window.showModal) window.showModal = () => {};
        if (window.openModal) window.openModal = () => {};
        
        // Brute force Medium toast removal
        const blockMediumBanners = () => {
          // Remove ALL fixed/absolute positioned elements that might be toasts
          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            // Check if it's positioned like a toast/banner
            if ((style.position === 'fixed' || style.position === 'absolute') &&
                style.display !== 'none' && style.visibility !== 'hidden') {
              
              // Remove if it looks suspicious (small, positioned, visible)
              if (rect.width > 200 && rect.height > 40 && rect.height < 200) {
                el.style.cssText = 'display: none !important;';
                if (el.parentNode) {
                  el.parentNode.removeChild(el);
                }
              }
            }
          });
        };
        
        // Run immediately and frequently
        blockMediumBanners();
        setInterval(blockMediumBanners, 100);
        
        // Also run after a delay in case elements load later
        setTimeout(blockMediumBanners, 1000);
        setTimeout(blockMediumBanners, 2000);
        setTimeout(blockMediumBanners, 3000);
      }

      // Global modal prevention CSS
      const preventModalCSS = document.createElement('style');
      preventModalCSS.textContent = 
        '[role="dialog"], [role="alertdialog"], ' +
        '.modal, .popup, .overlay, .backdrop, ' +
        '[class*="modal"], [class*="popup"], [class*="overlay"], ' +
        '[id*="modal"], [id*="popup"], [id*="overlay"], ' +
        'div[style*="position: fixed"][style*="z-index"], ' +
        'div[style*="position: absolute"][style*="z-index"] { ' +
          'display: none !important; ' +
          'visibility: hidden !important; ' +
          'opacity: 0 !important; ' +
          'pointer-events: none !important; ' +
        '} ' +
        (isMedium ? 
          '.pw-multi-vote-icon, .pw-multi-vote-count, ' +
          '.xg.o.abu.abv.hv.abw.abx.aby.abz.aca.acb.acc.acd.ace.acf.co.bq.acg.ach.aci.ok.acj.ack, ' +
          '[class*="xg o abu abv"], [data-testid="close-button"], ' +
          'div[role="alert"]:contains("Privacy Policy"), ' +
          'div[role="alert"]:contains("cookie policy") ' +
          '{ display: none !important; visibility: hidden !important; opacity: 0 !important; } ' +
          '.paragraph-image { margin-top: 0 !important; } '
        : '') +
        'body { overflow-x: hidden !important; } ' +
        'html { scroll-behavior: auto !important; }';
      head.appendChild(preventModalCSS);

      // Function to aggressively remove alerts and modals
      const removeAlertsAndModals = () => {
        // Multiple passes to catch different types of alerts and modals
        const unwantedSelectors = [
          '[role="alert"]',
          '[role="alertdialog"]',
          '[role="dialog"]',
          '[aria-live]',
          '[aria-live="polite"]',
          '[aria-live="assertive"]',
          '.alert',
          '.notification',
          '.toast',
          '.banner',
          '.notice',
          '.modal',
          '.popup',
          '.overlay',
          '.backdrop',
          '#alert',
          '#notification',
          '#modal',
          '#popup',
          '[class*="alert"]',
          '[class*="notification"]',
          '[class*="toast"]',
          '[class*="modal"]',
          '[class*="popup"]',
          '[class*="overlay"]',
          '[id*="alert"]',
          '[id*="notification"]',
          '[id*="modal"]',
          '[id*="popup"]',
          '[data-testid*="modal"]',
          '[data-testid*="popup"]'
        ];

        // Add Medium-specific selectors
        if (isMedium) {
          unwantedSelectors.push(
            '.pw-multi-vote-icon',
            '.pw-multi-vote-count',
            '[class*="pw-"][class*="modal"]',
            'div[style*="z-index: 1000"]',
            'div[style*="z-index: 9999"]',
            '.u-fixed',
            '.u-positionAbsolute',
            '[data-testid*="toast"]',
            '[data-testid*="notification"]',
            '[class*="toast"]',
            '[class*="snackbar"]',
            '.followButton',
            '.clap',
            '.highlight'
          );
        }
        
        unwantedSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            if (element.parentNode) {
              element.parentNode.removeChild(element);
            }
          });
        });

        // Remove any elements with modal-like positioning and high z-index
        const suspiciousElements = document.querySelectorAll('div, section');
        suspiciousElements.forEach(el => {
          const style = window.getComputedStyle(el);
          const zIndex = parseInt(style.zIndex);
          if ((style.position === 'fixed' || style.position === 'absolute') && 
              zIndex > 100 && el.offsetHeight > 50 && el.offsetWidth > 50) {
            const rect = el.getBoundingClientRect();
            // If element covers significant portion of screen, likely a modal
            if (rect.width > window.innerWidth * 0.3 && rect.height > window.innerHeight * 0.3) {
              el.style.display = 'none';
              if (el.parentNode) el.parentNode.removeChild(el);
            }
          }
        });
      };

      // Initial removal of all unwanted elements including alerts
      const elementsToRemove = document.querySelectorAll(selectors + ',script');
      let i = elementsToRemove.length;
      while (i--) {
        const el = elementsToRemove[i];
        el.parentNode && el.parentNode.removeChild(el);
      }

      // Extra aggressive alert and modal removal
      removeAlertsAndModals();
      
      // Medium content extraction (if needed)
      if (isMedium) {
        const articles = document.querySelectorAll('article');
        if (articles.length) {
          const content = Array.from(articles).map(a => a.outerHTML).join('');
          body.innerHTML = content;
        }
      }

      // Apply styles immediately
      body.style.paddingTop = '0px';

      // Block scroll-triggered events that might show modals
      let scrollTimeout;
      const originalAddEventListener = Element.prototype.addEventListener;
      Element.prototype.addEventListener = function(type, listener, options) {
        if (type === 'scroll' && isMedium) {
          // Wrap scroll listeners to prevent modal triggers
          const wrappedListener = function(e) {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
              // Remove any modals that appeared after scroll
              removeAlertsAndModals();
            }, 100);
            return listener.call(this, e);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };

      // Set up mutation observer to catch dynamically added alerts
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if the added node itself is an alert or modal
              if (node.getAttribute && (
                node.getAttribute('role') === 'alert' ||
                node.getAttribute('role') === 'alertdialog' ||
                node.getAttribute('role') === 'dialog' ||
                node.getAttribute('aria-live') ||
                node.className.includes('alert') ||
                node.className.includes('notification') ||
                node.className.includes('toast') ||
                node.className.includes('modal') ||
                node.className.includes('popup') ||
                node.className.includes('overlay')
              )) {
                node.style.display = 'none';
                node.parentNode && node.parentNode.removeChild(node);
                return;
              }

              // Check for high z-index elements (likely modals)
              if (node.style && node.style.zIndex && parseInt(node.style.zIndex) > 100) {
                const style = window.getComputedStyle(node);
                if (style.position === 'fixed' || style.position === 'absolute') {
                  node.style.display = 'none';
                  node.parentNode && node.parentNode.removeChild(node);
                  return;
                }
              }
              
              // Check for alert/modal elements within the added node
              if (node.querySelectorAll) {
                const nestedUnwanted = node.querySelectorAll('[role="alert"],[role="alertdialog"],[role="dialog"],[aria-live],.alert,.notification,.toast,.modal,.popup,.overlay');
                nestedUnwanted.forEach(element => {
                  if (element.parentNode) {
                    element.style.display = 'none';
                    element.parentNode.removeChild(element);
                  }
                });
              }
            }
          });
        });
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Non-critical cleanup in next frame
      requestAnimationFrame(() => {
        // Clean up any remaining unwanted elements that might have been added dynamically
        const remaining = document.querySelectorAll('.advertisement,.promo,.subscription');
        remaining.forEach(el => el.remove && el.remove());
        
        // Final alert and modal sweep
        removeAlertsAndModals();
      });
      
      // Additional cleanup after a short delay
      setTimeout(() => {
        removeAlertsAndModals();
      }, 1000);

      // Continuous modal monitoring for Medium (every 2 seconds)
      if (isMedium) {
        setInterval(() => {
          removeAlertsAndModals();
        }, 2000);
      }
    })();
  `;
};