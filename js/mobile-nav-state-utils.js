(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.ECMobileNavStateUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUPPORT_FOOTER_SCREENS = new Set(['supportScreen', 'supportChatScreen']);

  function normalizeScreenName(value) {
    return String(value || '').trim();
  }

  function shouldShowMobileBottomNav(options = {}) {
    const currentScreen = normalizeScreenName(options.currentScreen);
    const appOpen = options.appOpen === true;
    const authVisible = options.authVisible === true;

    if (SUPPORT_FOOTER_SCREENS.has(currentScreen)) return false;
    if (appOpen) return true;
    return !authVisible;
  }

  return {
    shouldShowMobileBottomNav,
  };
}));
