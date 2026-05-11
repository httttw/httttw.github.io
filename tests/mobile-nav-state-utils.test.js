const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldShowMobileBottomNav,
} = require('../js/mobile-nav-state-utils.js');

test('shows bottom nav for authenticated root-level front screens', () => {
  assert.equal(
    shouldShowMobileBottomNav({
      currentScreen: 'deposit',
      appOpen: true,
      authVisible: false,
    }),
    true,
  );
});

test('hides bottom nav for support footer screens', () => {
  assert.equal(
    shouldShowMobileBottomNav({
      currentScreen: 'supportScreen',
      appOpen: true,
      authVisible: false,
    }),
    false,
  );
  assert.equal(
    shouldShowMobileBottomNav({
      currentScreen: 'supportChatScreen',
      appOpen: true,
      authVisible: false,
    }),
    false,
  );
});

test('hides bottom nav on auth view when app is not open', () => {
  assert.equal(
    shouldShowMobileBottomNav({
      currentScreen: 'homeScreen',
      appOpen: false,
      authVisible: true,
    }),
    false,
  );
});
