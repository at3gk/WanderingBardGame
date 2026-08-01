# Mobile-friendly research — what iPhone/iPad/Android actually require, and what is buildout vs a separate effort

Research notes, 2026-07-31. Question: how does a browser-first Three.js game
on GitHub Pages become genuinely friendly to iPhones, iPads and Android —
and which parts of that are ordinary web buildout versus a separate track
(app stores) that needs a human decision first? Constraints in force: no
accounts, no payments, no analytics, no paid services without human action;
<5 MB bundle; saves live in localStorage; audience is households with kids
5-9, so iPads are probably the number-one real device. Every claim below
carries its source; where a primary source was unreachable, that is said
instead of papered over.

## Honest summary of what the evidence supports

Almost everything that makes this game feel native on a family iPad is
plain web work, and one piece of it is urgent rather than cosmetic: **the
saves**. Safari's Intelligent Tracking Prevention deletes *all* of a
site's script-writable storage — localStorage included — "after seven days
of Safari use without user interaction on the site" (WebKit, first-party).
An active player's taps reset that timer, but a family that drifts away
for a few weeks comes back to a wiped songbook, silently, with no account
to recover from. The same first-party source says home-screen web apps are
deliberately exempt ("We do not expect the first-party in such a web
application to have its website data deleted"), and on iOS 17+ an
installed web app gets the full browser-class storage quota. So on iOS,
*Add to Home Screen is the save system's protection*, which turns the
web-manifest-and-icons work from a nicety into the highest-value mobile
task on the board. A service worker is not required for any of this
(Chromium dropped the requirement; iOS never had it) but an offline cache
is cheap at this bundle size and makes the game work in the back of a car.

The rest of the web-side findings: iOS Safari mutes the Web Audio API on
the ringer/silent switch (a WebKit-tracked behavior, with a newer
AudioSession API as the partial remedy), suspends it as "interrupted" on
phone calls, throttles requestAnimationFrame to 30 fps in Low Power Mode,
and caps rAF at 60 Hz even on 120 Hz ProMotion screens — so the frame loop
must be honest about variable timestep, which it already largely is.
Notched iPhones need `viewport-fit=cover` plus `env(safe-area-inset-*)`,
which index.html does not yet have. Touch-target floors are well
specified (WCAG 2.2: 24 px minimum at AA; Apple: 44×44 pt), and iOS
cannot lock orientation from a web page, so both orientations must simply
work. On Android the question is thermal and GPU spread, where the honest
finding is that only secondary practitioner guidance exists — and it puts
comfortable mobile scene budgets well below this game's ~730k triangles,
which the untested quality tiers were built to address and no phone has
ever validated.

The store question has a clean answer: **a store presence is a separate
track, and nothing on it is needed for the iPad-family audience.** Both
store paths require paid developer accounts (Apple $99/year, Google $25
once) — paid services CLAUDE.md forbids without a human — and Apple's own
review guideline 4.2 warns that an app which is "a repackaged website...
doesn't belong on the App Store," which is a real rejection risk for a
thin wrapper. Home-screen install delivers the app-like experience for
free. The split, concretely: manifest, icons, safe areas, persist(),
save export, audio-session handling, service worker — buildout, sized
below. Capacitor/TWA/store listings — separate track, blocked on human.

## Findings

### 1. Installability, and the save-eviction question (the critical one)

- Chromium install criteria: a manifest with `name`/`short_name`, icons
  (192 px and 512 px), `start_url`, `display`, served over HTTPS — and a
  service worker is explicitly **not** required for installability
  anymore ("While not a requirement for a PWA to be installable..."). MDN:
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
  (fetched).
- iOS: Add to Home Screen works with **no manifest at all** and ignores
  installability criteria; a manifest still customizes the result
  (standalone display, name, icons). Since iOS 16.4, install works from
  the share menu in Chrome/Edge/Firefox on iOS too, not just Safari.
  Same MDN page. Practical note from code reading: index.html's only icon
  is an inline SVG favicon — iOS wants a PNG `apple-touch-icon`, so today
  an installed Wandering Bard gets a page-screenshot icon.
- **The eviction rule, first-party**: WebKit's ITP "deletes all of a
  website's script-writable storage after seven days of Safari use
  without user interaction on the site." Interaction (taps) resets the
  timer. Home-screen web apps keep "their own counter of days of use...
  We do not expect the first-party in such a web application to have its
  website data deleted," and WebKit asks for deletions there to be
  reported as bugs. WebKit blog (2020, still the governing statement):
  https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
  (fetched).
- MDN's storage-eviction guide corroborates and updates: Safari evicts
  script-created data from origins with "no user interaction (clicks/
  taps) for 7 days" when tracking prevention is on (it is on by
  default); all of an origin's data is deleted together, so localStorage
  and IndexedDB share the same fate; and on iOS 17+ / macOS 14+ a site
  "saved as web apps on Home Screen" gets the browser-class quota (~60%
  of disk) instead of the embedded-view class (~15%).
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
  (fetched).
- `navigator.storage.persist()` requests exemption from storage-pressure
  clearing; browsers "may or may not honor the request" — Safari and most
  Chromium browsers decide silently from the user's interaction history,
  no prompt. MDN: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
  and the quotas guide above (both fetched). It is worth calling; it is
  not a guarantee, and nothing in the reached sources says it overrides
  the 7-day ITP rule for a non-installed Safari tab.
- iOS 16.4 also gave home-screen web apps Web Push, Badging, Screen Wake
  Lock, and Screen Orientation. WebKit blog:
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  (fetched). Push is banned here anyway (retention research, rejected
  list); Wake Lock is genuinely useful for a busk that asks for taps only
  every beat or two.

What this means for a game whose progress is localStorage with no
accounts: an engaged family is safe; a lapsed family on iPad Safari is
not. The mitigations, in order of strength: (a) make home-screen install
attractive and well-iconed, because installed = exempt per WebKit;
(b) call `persist()` once audio is unlocked; (c) give saves a no-account
escape hatch — an export/import string or file ("press this keepsake into
the songbook") — which is the only backstop that survives a cleared
browser, and fits the no-accounts constraint because it is paper, not
login.

### 2. iOS Safari runtime behavior: audio, frame rate, notch

- **Silent switch**: the Web Audio API is muted when the iOS ringer
  switch is set to silent — media elements are not. Tracked first-party
  as WebKit bug 237322 ("webaudio api is muted when the iOS ringer is
  muted"): https://bugs.webkit.org/show_bug.cgi?id=237322. The remedy is
  the Audio Session API — `navigator.audioSession.type = "playback"` —
  whose default "auto" type a WebKit engineer describes as initially
  ambient (i.e. mute-switch-affected). The API is Safari-led,
  explicitly "not Baseline"/experimental. MDN:
  https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API
  (fetched; its compat table was not in the reachable excerpt, so no
  Safari version number is claimed here). One line of feature-detected
  code; for a music game aimed at children whose iPads live on silent,
  this may be the single most player-visible audio fix available.
- **Interruption**: on calls, dialogs, or leaving the page, Safari moves
  the AudioContext to a non-standard `"interrupted"` state; apps should
  watch `statechange`/visibility and call `resume()` on return, and
  there are reports of contexts sticking in `interrupted` until a fresh
  user gesture. Spec-issue thread (WebKit engineers participating):
  https://github.com/WebAudio/web-audio-api/issues/2585 and MDN
  BaseAudioContext.state:
  https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state.
  The game already re-syncs its clock on visibility (App.ts) and
  excuses unplayable beats (performance.ts `wasUnplayable`), so the
  remaining work is only the audio-side resume.
- **Low Power Mode**: WebKit throttles requestAnimationFrame to 30 fps in
  Low Power Mode — first-party tracker, RESOLVED FIXED, shipped 2017:
  https://bugs.webkit.org/show_bug.cgi?id=168837. A kid's hand-me-down
  iPad is in Low Power Mode a lot. Consequence: beat judgement must stay
  fair at 30 fps (the 240 ms good window is ~7 frames at 30 fps — fine),
  and nothing should assume 60 ticks of rAF per second.
- **ProMotion**: rAF is capped at 60 Hz by default even on 120 Hz
  devices; 120 Hz exists only behind flags (secondary sources:
  https://motion.dev/magazine/when-browsers-throttle-requestanimationframe,
  https://birchtree.me/blog/how-to-enable-120hz-mode-in-safari-mac-iphone-and-ipad/).
  So 60 fps is the ceiling to design for on iOS; no work needed.
- **Notch / safe areas**: `viewport-fit=cover` in the viewport meta lays
  the page out edge-to-edge, and `env(safe-area-inset-*)` (ideally inside
  `max()`) keeps controls out of the sensor housing and home-indicator
  strip. WebKit first-party:
  https://webkit.org/blog/7929/designing-websites-for-iphone-x/
  (fetched). index.html currently has neither; in Safari's normal view
  this mostly costs letterboxing colour, but in an installed standalone
  app (the recommended state, per finding 1) the HUD would sit under the
  notch on iPhones. iPads have no notch but do have the home indicator.

### 3. Android spread, and what ~730k triangles means on a mid-range GPU

- The honest sourcing note first: no primary vendor source reached gives
  a triangle budget for mobile WebGL. What exists is practitioner
  guidance, consistent among itself: total scene budgets "under 500,000
  triangles for broad device compatibility," draw calls under ~50 on
  mobile, pixel ratio capped at 2, and — the important part — **thermal
  throttling**: sustained rendering degrades after 5-10 minutes on
  mid-range phones, so a first-minute 60 fps is not a verdict. Secondary:
  https://www.intelligentgraphicandcode.com/development/threejs-interfaces/performance,
  https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/.
  Treat the numbers as folklore with a consistent direction, not specs.
- This game's scene is ~730k triangles at 100 fps on the desktop GPU
  (STATE.md:186, measured live). That is above the folklore mobile
  budget even before thermals, which is exactly what the quality tiers
  exist for — `detectQuality()` (src/three/App.ts:71) drops foliage
  density to 0.45 and view distance to 180 m on 'low'. **No tier has
  ever run on a phone** (STATE.md already tracks this as
  blocked-on-human), and this research cannot substitute for that test.
- Two blind spots found in `detectQuality()` by reading it against the
  platform facts: (a) `navigator.deviceMemory` is a Chromium-only API,
  so every iPad reports undefined → defaults to 4 → every iPad lands on
  'medium' regardless of age — an iPad Air 2 and an M4 iPad Pro get the
  same tier; (b) the 'low' tier still enables shadow maps (1024 px PCF
  soft), and shadow maps are the classic first thing practitioner
  guidance disables on weak mobile GPUs. Neither is a bug today; both
  are levers the real-device test will probably want.
- Sustained-load framing for a walk that lasts 10-20 minutes: the
  thermal ceiling matters more than the first-minute fps. A
  double-resolution option — a "cool" mode the *human playtest* can flip
  (lower pixelRatio, shadows off) — is worth more than cleverer boot
  detection, because boot detection cannot see temperature.

### 4. Touch ergonomics for kids on tablets

- WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA: pointer targets at
  least **24×24 CSS px**, with spacing/inline/essential exceptions; the
  stricter SC 2.5.5 (Enhanced, AAA) is 44×44. W3C:
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  (fetched).
- Apple, first-party: "Create controls that measure at least 44 points x
  44 points so they can be accurately tapped with a finger."
  https://developer.apple.com/design/tips/ (fetched; the HIG
  accessibility page itself is JS-rendered and was not reachable as
  text — the design-tips page is Apple's own wording of the same rule).
  For children 5-9, 44 pt is the floor, not the target; bigger is
  simply kinder, and this game's main "target" is the whole screen
  (tap-anywhere beats), which is the best possible answer. The audit
  matters for the HUD: songbook, instrument picker, campfire buttons.
- Orientation: `screen.orientation.lock()` generally requires fullscreen
  and is "Limited availability" — not usable on iOS Safari. MDN:
  https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock
  (fetched). Installed home-screen apps can declare a manifest
  `orientation` on Android; iOS respects it only loosely. Conclusion for
  a road game: prefer landscape in art direction if desired, but both
  orientations must *work*, because on iPad Safari the game cannot
  refuse one. Kids hold iPads every way there is.
- Multi-touch/palm: `touch-action: none`, `user-select: none`, and
  callout suppression are already in index.html (the 2D-era work
  holds). The remaining kindness is already in the code: `pickBeat`
  charges nothing for stray taps, so a second thumb or a resting palm
  costs a player nothing. No new work identified beyond the HUD size
  audit.

### 5. The store question — why it is a separate track

- **Apple**: App Review guideline 4.2 (Minimum Functionality): "Your app
  should include features, content, and UI that elevate it beyond a
  repackaged website. If your app is not particularly useful, unique, or
  'app-like,' it doesn't belong on the App Store." Guideline 2.5.6
  requires WebKit for web content. First-party:
  https://developer.apple.com/app-store/review/guidelines/ (fetched). A
  Capacitor/WKWebView wrapper of this game is precisely the case 4.2
  warns about; acceptance would ride on added native value. Cost:
  Apple Developer Program **$99/year**, plus a Mac with Xcode to build.
- **Google**: the paved path is a Trusted Web Activity — the PWA runs in
  full-screen Chrome inside a Play-store app, verified via Digital Asset
  Links, generated by Bubblewrap. First-party:
  https://developer.chrome.com/docs/android/trusted-web-activity
  (fetched). A TWA *requires* the PWA install criteria (manifest +
  service worker + offline), so the buildout below is also the entire
  technical prerequisite for the cheapest store path. Cost: Play Console
  **$25 one-time** (fee figures corroborated only by secondary
  round-ups, e.g. https://splitmetrics.com/blog/google-play-apple-app-store-fees/;
  the first-party fee pages were not fetched).
- Both fees are paid services; CLAUDE.md forbids those without a human,
  and both accounts require a human identity anyway. PWABuilder's iOS
  packaging docs were unreachable (SPA shell only:
  https://docs.pwabuilder.com) — its claims are therefore not cited.
- The deciding fact: the target household does not need a store. An
  installed home-screen web app on an iPad is full-screen, iconed,
  storage-protected (finding 1), and free. The store buys
  discoverability and nothing this audience is missing.

### 6. What can be tested from this machine, honestly

- Chrome DevTools device mode is "a first-order approximation of how
  your page looks and feels on a mobile device" — it does not run code
  on mobile hardware, does not model mobile CPU/GPU, and Google's own
  recommendation for real answers is remote debugging on a physical
  device. First-party: https://developer.chrome.com/docs/devtools/device-mode
  (fetched). Good for: layout, safe-area rendering, touch-event
  plumbing, tier-forcing via UA/viewport. Useless for: fps, thermals.
- Playwright's WebKit is built from WebKit main "often before these
  updates are incorporated into Apple Safari," carries Playwright
  patches, and "doesn't work with the branded version of Safari";
  feature behavior varies by host OS. First-party:
  https://playwright.dev/docs/browsers (fetched). So Playwright WebKit
  on Windows validates *WebKit-family* rendering and JS behavior — the
  best engine coverage available here — but is not an iOS Safari
  verdict, and it cannot reproduce iOS audio-session, mute-switch, Low
  Power Mode, or GPU behavior at all.
- Verifiable from this machine, this run: manifest correctness
  (Lighthouse/DevTools), install flow on desktop Chrome, safe-area CSS
  under emulated notches, tier selection logic per spoofed
  capabilities, offline behavior of a service worker. Genuinely needs
  the human's iPad: every performance tier, thermal fade over a
  20-minute walk, silent-switch and interruption audio behavior,
  A2HS icon and standalone chrome, and whether 'medium' (the tier every
  iPad gets) actually holds frame rate.

## Recommendations, ranked

### Part of the buildout (web work, no permission needed)

1. **Web app manifest + real icons + standalone display.** 192/512 PNG
   icons (procedural — render the existing favicon mark to PNG at build
   time), `apple-touch-icon` link, `name`, `start_url` with the Pages
   base path, `display: standalone`, background/theme colours. This is
   simultaneously: the Android install path, the iOS icon fix, and —
   because installed apps are exempt from the 7-day eviction — the save
   system's armour on iPad. Size: one run.
2. **Safe-area handling.** `viewport-fit=cover` in the meta tag;
   `env(safe-area-inset-*)` via `max()` padding on the HUD layer only
   (the canvas should go edge-to-edge). Matters most in the standalone
   mode recommendation 1 creates. Size: small; same run as 1 or folded
   into any HUD run.
3. **Save protection beyond install.** Call
   `navigator.storage.persist()` once after first interaction (silent,
   no prompt on Safari/Chrome), and build the save-keepsake
   export/import — a copyable string or tiny file holding the songbook
   state. The only backstop that survives eviction, clearing, or a new
   device, with no account. Size: persist() is three lines; the
   keepsake is one run including UI.
4. **Service worker with precache.** The whole build is ~815 kB — one
   precache manifest away from full offline play (kids in cars; also a
   TWA prerequisite if the store track ever opens). Vite has
   well-trodden plugins; keep it to precache-plus-update, nothing
   clever. Size: one run, including the update-on-reload behavior.
5. **Audio session + interruption handling.** Feature-detect
   `navigator.audioSession` and set `type = "playback"` (mute-switch
   fix); on `visibilitychange`/`statechange`, nudge a non-running
   AudioContext with `resume()` tied to the next user gesture.
   Size: small; one run with tests for the state machine around it.
6. **Quality-tier hardening for the devices that will actually arrive.**
   Accept that every iPad reads as 'medium' (deviceMemory is
   Chromium-only); give 'low' a no-shadows variant; add a visible,
   human-friendly quality toggle at the campfire or title card so the
   playtest iPad can flip tiers without dev tools. Do **not** add
   mid-session auto-degradation — App.ts's stance against silent
   quality shifts is right, and boot detection cannot see temperature
   anyway; a hand toggle is the honest tool. Size: one run.
7. **HUD touch-target audit.** Everything tappable ≥44 pt equivalent
   (~59 CSS px at typical iPad scale is not required — 44 CSS px is the
   practical floor per the HIG's pt-to-px mapping at 1x), spacing per
   WCAG 2.5.8, both orientations laid out. Size: one run, mostly
   hudLayout.ts, which is already pure and testable.

### Separate track (store/native — needs a human first)

- **Google Play via TWA** is the cheap, honest path *if ever wanted*:
  $25 once, Bubblewrap around the already-required PWA, no code fork.
- **Apple App Store** is the expensive, risky path: $99/year, a Mac,
  Capacitor or similar, and a genuine guideline-4.2 rejection risk for
  a wrapper without added native value.
- Neither is needed for the iPad-household audience once
  recommendations 1-3 land; the store buys discoverability only. The
  right sequencing: finish the buildout list (it is also the TWA
  prerequisite), then let the human decide whether discoverability is
  worth accounts and fees.

## Blocked on human

- Real-iPad playtest of the three quality tiers (STATE.md already
  tracks this): fps on 'medium', thermal behavior over a full walk,
  Low Power Mode feel at 30 fps.
- Real-device audio check: silent-switch behavior with and without
  audioSession `playback`; interruption recovery after a call/Siri.
- A2HS walkthrough on the family iPad once the manifest lands (icon,
  standalone chrome, saves surviving a week untouched).
- Any store presence: creating Apple/Google developer accounts is a
  paid service and an identity decision — human-only, and only worth
  raising after v1.0.

## Source access notes

Reached directly (fetched): WebKit blog on ITP's 7-day storage cap and
the home-screen exemption; MDN on installability, storage quotas and
eviction, StorageManager.persist, Audio Session API (compat table not in
the reachable excerpt — no Safari version numbers are claimed), screen
orientation lock; WebKit bug trackers 168837 (Low Power Mode 30 fps rAF,
RESOLVED FIXED) and 237322 (Web Audio muted by ringer switch); WebKit's
iPhone X safe-area post; W3C's WCAG 2.2 target-size Understanding doc;
Apple's design-tips page (44 pt rule, Apple's own words) and App Review
guidelines (4.2, 2.5.6, 4.7); Chrome's TWA overview and DevTools
device-mode limitations; Playwright's browsers doc. Reached only as
search summaries (secondary, flagged as such in-text): mobile triangle/
thermal budgets, ProMotion rAF capping, store fee figures. Not reached:
Apple's HIG accessibility page itself (JS-rendered; the design-tips page
substitutes with equivalent first-party wording), PWABuilder's iOS docs
(SPA shell only — no PWABuilder claims are cited), and first-party fee
pages for the developer programs (fees cited from consistent secondary
round-ups). Nothing in this file is quoted from a source that was not
reached.
