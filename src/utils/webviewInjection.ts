/**
 * WebView JavaScript injection utilities for article cleanup and modal blocking
 */

export const getWebViewInjectionScript = (): string => {
  return `
    (function() {
      const body = document.body;
      const head = document.head || document.getElementsByTagName('head')[0];

      // Fast medium detection
      const isMedium = location.href.includes('medium.com') ||
        !!document.querySelector('meta[property="og:site_name"][content="Medium"]');

      // Centralized selector configuration
      const SELECTORS = {
        base: [
          '.mobile-footer-ufi', '.cookie-consent', '.cookieBanner', '.subscribe-banner',
          '.ad-container', '.adsbygoogle', '.subscription-widget-wrap', '.newsletter-signup',
          '.popup', '.modal', '.overlay', '.paywall', '.paywall-overlay', '.post-footer',
          '#discussion', '.related-posts', '.article-actions', '.share-buttons', '.social-share',
          '.cookie-banner', '.gdpr-consent', '.consent-banner', '.subscribe-footer',
          '.cookieBanner-fZ6hup', '.newsletter-popup', '.subscription-popup',
          '.ad-banner', '.ad-slot', '.ad-placeholder', '.ad-space', '.ad-area',
          '.ad-break', '.ad-module', '.ad-component', '.ad-wrapper', '.ad-section',
          '.sponsor-message', '.sponsor-note', '.sponsor-info', '.sponsor-box',
          '.sponsor-ad', '.sponsor-link', '.sponsored-link', '.sponsored-ad',
          '.sponsored-box', '.sponsored-info', '.sponsored-note', '.modal__overlay',
          '.main-menu', '[role="dialog"]', '[role="banner"]', '[role="alert"]',
          '[role="alertdialog"]', '[aria-live]', '[aria-live="polite"]', '[aria-live="assertive"]',
          '[id*="cookie"]', '[class*="cookie"]', '[id*="consent"]', '[class*="consent"]',
          '[id*="gdpr"]', '[class*="gdpr"]', '[class*="subscribeDialog"]',
          '[class*="background-"]', '[class*="overlay"]', '[class*="cookieBanner"]',
          '[class*="modal"]', '[id*="subscribe"]', '[id*="popup"]', '[id*="modal"]',
          '[class*="alert"]', '[class*="notification"]', '[class*="toast"]',
          '[id*="alert"]', '[id*="notification"]', '.alert', '.notification',
          '.toast', '.banner', '.notice', '.backdrop', '#alert', '#notification',
          '#modal', '#popup', '[data-testid*="modal"]', '[data-testid*="popup"]'
        ],
        medium: [
          '.ajx', '.pw-susi-modal', '.speechify-ignore .mv', '.pw-multi-vote-icon',
          '.pw-multi-vote-count', '.xg.o.abu.abv.hv.abw.abx.aby.abz.aca.acb.acc.acd.ace.acf.co.bq.acg.ach.aci.ok.acj.ack',
          '[class*="xg o abu abv"]', '[data-testid="close-button"]', '[class*="pw-"][class*="modal"]',
          'div[style*="z-index: 1000"]', 'div[style*="z-index: 9999"]', '.u-fixed',
          '.u-positionAbsolute', '[data-testid*="toast"]', '[data-testid*="notification"]',
          '[class*="toast"]', '[class*="snackbar"]', '.followButton', '.clap', '.highlight'
        ]
      };

      // Get all selectors as a combined string
      const getAllSelectors = () => {
        return [...SELECTORS.base, ...(isMedium ? SELECTORS.medium : [])].join(',');
      };

      // Unified function to check if element is modal-like
      const isModalLikeElement = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const zIndex = parseInt(style.zIndex) || 0;

        // Check positioning and z-index
        const isPositioned = style.position === 'fixed' || style.position === 'absolute';
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
        const hasHighZIndex = zIndex > 100;
        
        if (!isPositioned || !isVisible) return false;

        // Different criteria for different cases
        if (isMedium) {
          // Medium: smaller toast-like elements
          return rect.width > 200 && rect.height > 40 && rect.height < 200;
        } else {
          // General: larger modal-like elements
          return hasHighZIndex && el.offsetHeight > 50 && el.offsetWidth > 50 &&
                 rect.width > window.innerWidth * 0.3 && rect.height > window.innerHeight * 0.3;
        }
      };

      // Unified element removal function
      const removeUnwantedElements = (includeScripts = false) => {
        // Remove by selectors
        const selectorString = getAllSelectors() + (includeScripts ? ',script' : '');
        const elements = document.querySelectorAll(selectorString);
        elements.forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });

        // Remove modal-like positioned elements
        const suspiciousElements = document.querySelectorAll('div, section');
        suspiciousElements.forEach(el => {
          if (isModalLikeElement(el)) {
            el.style.display = 'none';
            if (el.parentNode) el.parentNode.removeChild(el);
          }
        });

        // Remove overflow hidden from body to prevent scroll lock
        if (body.style.overflow === 'hidden') {
          body.style.overflow = 'auto';
        }
      };

      // Block all user clicks by intercepting them
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (target && target.href) {
          e.preventDefault();
          e.stopPropagation();
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'EXTERNAL_LINK_CLICK',
            url: target.href
          }));
          return false;
        }
      }, true);

      // Setup viewport
      if (head) {
        let viewport = head.querySelector('meta[name="viewport"]');
        if (!viewport) {
          viewport = document.createElement('meta');
          viewport.name = 'viewport';
          head.appendChild(viewport);
        }
        viewport.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
      }

      // Medium-specific setup
      if (isMedium) {
        // Block scroll events that trigger modals
        window.addEventListener('scroll', (e) => {
          e.stopPropagation();
        }, true);

        // Override modal functions
        if (window.showModal) window.showModal = () => {};
        if (window.openModal) window.openModal = () => {};
      }

      // Global modal prevention CSS
      const preventModalCSS = document.createElement('style');
      const baseCSSSelectors = [
        '[role="dialog"]', '[role="alertdialog"]', '.modal', '.popup', '.overlay', '.backdrop',
        '[class*="modal"]', '[class*="popup"]', '[class*="overlay"]',
        '[id*="modal"]', '[id*="popup"]', '[id*="overlay"]',
        'div[style*="position: fixed"][style*="z-index"]',
        'div[style*="position: absolute"][style*="z-index"]'
      ];
      
      const mediumCSSSelectors = [
        '.pw-multi-vote-icon', '.pw-multi-vote-count',
        '.xg.o.abu.abv.hv.abw.abx.aby.abz.aca.acb.acc.acd.ace.acf.co.bq.acg.ach.aci.ok.acj.ack',
        '[class*="xg o abu abv"]', '[data-testid="close-button"]',
        'div[role="alert"]:contains("Privacy Policy")',
        'div[role="alert"]:contains("cookie policy")'
      ];

      const hideCSS = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
      
      preventModalCSS.textContent = 
        baseCSSSelectors.join(', ') + ' { ' + hideCSS + ' } ' +
        (isMedium ? mediumCSSSelectors.join(', ') + ' { ' + hideCSS + ' } .paragraph-image { margin-top: 0 !important; } ' : '') +
        'body { overflow-x: hidden !important; } html { scroll-behavior: auto !important; }';
      
      head.appendChild(preventModalCSS);

      // Initial cleanup
      removeUnwantedElements(true);

      // Medium content extraction
      if (isMedium) {
        const articles = document.querySelectorAll('article');
        if (articles.length) {
          const content = Array.from(articles).map(a => a.outerHTML).join('');
          body.innerHTML = content;
        }
      }

      // Apply basic styles
      body.style.paddingTop = '0px';

      // Enhanced scroll listener wrapper for Medium
      if (isMedium) {
        let scrollTimeout;
        const originalAddEventListener = Element.prototype.addEventListener;
        Element.prototype.addEventListener = function(type, listener, options) {
          if (type === 'scroll') {
            const wrappedListener = function(e) {
              clearTimeout(scrollTimeout);
              scrollTimeout = setTimeout(removeUnwantedElements, 100);
              return listener.call(this, e);
            };
            return originalAddEventListener.call(this, type, wrappedListener, options);
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
      }

      // Mutation observer for dynamically added content
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if the node itself should be removed
              if (node.getAttribute) {
                const role = node.getAttribute('role');
                const className = node.className || '';
                
                if (role === 'alert' || role === 'alertdialog' || role === 'dialog' ||
                    node.getAttribute('aria-live') ||
                    ['alert', 'notification', 'toast', 'modal', 'popup', 'overlay'].some(cls => 
                      className.includes(cls))) {
                  node.style.display = 'none';
                  if (node.parentNode) node.parentNode.removeChild(node);
                  return;
                }
              }

              // Check for modal-like positioning
              if (isModalLikeElement(node)) {
                node.style.display = 'none';
                if (node.parentNode) node.parentNode.removeChild(node);
                return;
              }

              // Check nested unwanted elements
              if (node.querySelectorAll) {
                const nestedUnwanted = node.querySelectorAll(getAllSelectors());
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

      // Consolidated cleanup scheduling
      const scheduleCleanup = () => {
        // Immediate cleanup
        requestAnimationFrame(() => {
          const remaining = document.querySelectorAll('.advertisement,.promo,.subscription');
          remaining.forEach(el => el.remove && el.remove());
          removeUnwantedElements();
        });

        // Delayed cleanup
        setTimeout(removeUnwantedElements, 1000);

        // Continuous monitoring for Medium
        if (isMedium) {
          // More frequent cleanup for Medium due to aggressive modal injection
          setInterval(removeUnwantedElements, 500);
        }
      };

      // Start cleanup schedule
      scheduleCleanup();
    })();
  `;
};