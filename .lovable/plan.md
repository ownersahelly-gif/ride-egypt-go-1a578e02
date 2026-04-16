
The root cause: on iOS the body/#root are locked with `position: fixed; overflow: hidden` and the Dashboard uses a fixed-height column layout. With Capacitor Keyboard `resize: 'ionic'`, the WebView shrinks correctly, but the Pickup/Dropoff inputs sit inside a non-scrollable card near the middle of the screen, and when focused the browser cannot scroll them into view (the page can't scroll). So the keyboard simply covers them.

Fix plan (small, focused):

1. **Make the Dashboard search content scrollable on mobile**
   - In `src/pages/Dashboard.tsx`, ensure the search step's content area is a real scrollable region (`flex-1 min-h-0 overflow-y-auto` with `WebkitOverflowScrolling: 'touch'`) and add bottom padding equal to keyboard space so inputs can scroll above the keyboard.

2. **Auto-scroll focused input into view**
   - In `src/components/PlacesAutocomplete.tsx`, on input `focus` call `el.scrollIntoView({ block: 'center', behavior: 'smooth' })` after a short delay (waits for keyboard animation). This works for every screen using the component (Dashboard, BookRide, RequestRoute, PartnerDashboard, DriverDashboard, CarpoolPost, AdminPanel) — single change benefits all.

3. **Track keyboard height as a CSS variable on iOS**
   - Add a small effect in `src/App.tsx` that listens to Capacitor Keyboard `keyboardWillShow` / `keyboardWillHide` events and sets `--kb-inset` on `document.documentElement`. Fallback to `visualViewport` for web.
   - Use this variable in the Dashboard scroll container as `paddingBottom: calc(var(--kb-inset, 0px) + 1rem)` so the input can actually scroll above the keyboard.

4. **Hide the BottomNav while keyboard is open (iOS)**
   - In `src/components/BottomNav.tsx`, when `--kb-inset > 0` translate the nav off-screen (or `display:none`) so it doesn't sit above the keyboard and steal space.

No changes to `capacitor.config.ts` (keep `resize: 'ionic'`). No new native plugins needed beyond the already-installed `@capacitor/keyboard`.

After approval I will: edit `src/App.tsx`, `src/components/PlacesAutocomplete.tsx`, `src/components/BottomNav.tsx`, `src/pages/Dashboard.tsx`, then ask you to run `npm run build && npx cap sync ios` and Clean Build in Xcode.
