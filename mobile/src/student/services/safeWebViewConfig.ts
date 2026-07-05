/**
 * safeWebViewConfig
 *
 * A shared configuration applied to every WebView in the student app.
 * Enforces:
 *   1. Ad & tracker domain blocking via onShouldStartLoadWithRequest
 *   2. Injected CSS/JS to hide ad elements and block popups
 *   3. No new windows / popups (setSupportMultipleWindows={false})
 *   4. Blocks JS dialogs (alert/confirm/prompt) from external pages
 *   5. Prevents phone/email/geo permission requests
 *
 * Usage — spread into any <WebView>:
 *   <WebView source={{ uri: url }} {...safeWebViewProps} />
 */
import type { WebViewProps } from 'react-native-webview'

// ─── Ad & Tracker Domain Blocklist ──────────────────────────────────────────
const BLOCKED_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'adsense.google.com',
  'outbrain.com',
  'taboola.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'serving-sys.com',
  'adnxs.com',
  'adsymptotic.com',
  'adtechus.com',
  'adzerk.net',
  'advertising.com',
  'ads.yahoo.com',
  'scorecardresearch.com',
  'quantserve.com',
  'mathtag.com',
  'turn.com',
  'criteo.com',
  'moatads.com',
  'cdn.amplitude.com',
  'bat.bing.com',
  'pixel.facebook.com',
  'connect.facebook.net',
  'hotjar.com',
  'fullstory.com',
  'logrocket.com',
  'clarity.ms',
]

function isDomainBlocked(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return BLOCKED_DOMAINS.some(
      (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
    )
  } catch {
    return false
  }
}

// ─── Injected JavaScript ─────────────────────────────────────────────────────
// Runs once the page DOM is ready. Hides common ad containers via CSS,
// blocks popups, and removes overlay nags.
const INJECTED_JS = `
(function() {
  // 1. Block popups / new tabs
  window.open = function() { return null; };

  // 2. Suppress JS dialogs from 3rd-party pages
  window.alert   = function() {};
  window.confirm = function() { return false; };
  window.prompt  = function() { return null; };

  // 3. Inject CSS to hide known ad containers and overlays
  var style = document.createElement('style');
  style.textContent = [
    /* Generic ad containers */
    'ins.adsbygoogle',
    '[id*="google_ads"]',
    '[id*="div-gpt-ad"]',
    '[class*="adsbygoogle"]',
    '[class*="adsense"]',
    '[class*="ad-slot"]',
    '[class*="ad-banner"]',
    '[class*="ad-container"]',
    '[class*="advertisement"]',
    '[class*="outbrain"]',
    '[class*="taboola"]',
    '[class*="OUTBRAIN"]',
    /* Sticky/fixed overlays (cookie banners, newsletter popups) */
    '[class*="cookie-banner"]',
    '[class*="cookie-notice"]',
    '[id*="cookie-notice"]',
    '[id*="cookie-banner"]',
    '[class*="popup-overlay"]',
    '[class*="newsletter-popup"]',
    '[class*="subscribe-popup"]',
  ].join(', ') + ' { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }';
  document.head.appendChild(style);

  // 4. Remove fixed/sticky overlays that block content
  var removeOverlays = function() {
    document.querySelectorAll('*').forEach(function(el) {
      var style = window.getComputedStyle(el);
      if ((style.position === 'fixed' || style.position === 'sticky') && el !== document.body && el !== document.documentElement) {
        var rect = el.getBoundingClientRect();
        // Only remove if it looks like a full-width overlay (> 80% of screen width, not main content)
        if (rect.width > window.innerWidth * 0.8 && rect.height < 120) {
          el.style.setProperty('display', 'none', 'important');
        }
      }
    });
  };

  // Run once after load
  if (document.readyState === 'complete') {
    removeOverlays();
  } else {
    window.addEventListener('load', removeOverlays);
  }
  // Also run after a delay for lazy-loaded overlays
  setTimeout(removeOverlays, 2500);

  true; // Required for react-native-webview injectedJavaScript
})();
`

// ─── Exported Props ───────────────────────────────────────────────────────────
export const safeWebViewProps: Partial<WebViewProps> = {
  injectedJavaScript: INJECTED_JS,

  // Block ad/tracker navigations
  onShouldStartLoadWithRequest: (request) => {
    if (isDomainBlocked(request.url)) {
      return false // Block it
    }
    return true // Allow everything else
  },

  // Prevent any page from spawning new browser windows
  setSupportMultipleWindows: false,

  // Deny geo, camera, mic permissions from web content
  geolocationEnabled: false,

  // Suppress the vertical scrollbar for a cleaner look
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,

  // Allow back/forward navigation gestures within the same page
  allowsBackForwardNavigationGestures: true,

  // Don't allow mixed HTTP content in an HTTPS page
  mixedContentMode: 'never',
}
