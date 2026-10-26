# Changelog — co-op fork of `opencourier-mobile`

This fork adapts [Princeton-HCI/opencourier-mobile](https://github.com/Princeton-HCI/opencourier-mobile),
the courier app, for a Greek workers' cooperative delivering by moped in Volos.

Everything below sits on top of upstream `main` on the branch `feat/courier-earnings`
(31 commits, 26 July – 26 October 2026). Each entry names its commit, and the commit message
has the full reasoning and verification notes.

---

## Added

### Real earnings, down to each delivery — `2da05fd`
- The Earnings screen used to show hard-coded test data. It now reads the backend's
  courier earnings endpoints.
- A courier can tap a day to see its deliveries, then tap a delivery for its breakdown:
  address, pickup business, piece-rate pay, tips, drop-off time, and a selectable delivery
  id to quote when asking about pay.
- **Pay and tips are always shown separately**, so a good week for tips can't hide a bad
  rate.
- The currency comes from the API, not a hard-coded `'USD'`. The device timezone is sent
  with every request, so day boundaries match the courier's own day.
- The "All" tab is labelled "Last 12 months", because the API caps requests at 366 days.
- Day rows were redesigned as cards showing Today, Yesterday or the weekday, plus the date,
  the delivery count and the amount.
- Drawer navigation types were made composite, which also fixed 17 existing type errors.

### Images
- `hasImageUri` and a `RemoteImage` component render an equal-sized placeholder when an
  instance has no logo. This silences the "source.uri should not be an empty string"
  warning that covered the bottom of every dev screen. `74b0300`

### Live connection to the instance, with a dot on Home (row 57) — `e5bfb09`, `d87b245`, `aab453e`
- The app joined the default Socket.IO namespace, which has no login and is never sent an
  offer. It now joins `/couriers`, so offers and status changes reach the phone live.
- One `LiveConnection` (`src/services/liveConnection.ts`) owns the socket. It reconnects
  after a drop or when the app comes back to the foreground, closes on logout and when the
  rider is Offline with no job, and refetches offers and jobs on every connect and on
  `DELIVERY_STATUS_UPDATED`.
- A dot under the Home header says "Connected", "Connecting…", "No connection, retrying" or
  "Not connected". When the server refuses the login it says "Not connected, reopen the app
  to retry" instead of claiming it is retrying.
- Tests by agy: 48 at first, then the refused state and the connection life cycle.
  `316e807`, `917c1a8`

### Offers follow the server's deadline (row 61, not merged yet) — `ec79791`, `9389518`, `d6e56ad`, `77cdece`
This is the courier app half of offer expiry. It lives on the branch `feat/offer-expiry` and
merges with the backend and adminweb halves of the same row.
- Each offer's countdown runs to the deadline the server set (`offerExpiresAt`), moved onto
  the phone's clock with the `serverNow` sent alongside the list, so a phone clock that is
  wrong does not move it (`src/utilities/offerClock.ts`). The phone reads its own clock on
  both sides of the request and uses the midpoint.
- At zero the phone sends nothing for the rider. It fetches the list once, 4 s after the
  deadline, and the server decides what happened. An offer already that late the first time
  the phone sees it gets the same single check at once.
- A rider on auto accept has each offer accepted as soon as it arrives, once per offer. The
  fixed auto accept timer is gone.
- With expiry off there is no countdown bar. The offer reads "Waiting X min" ("Waiting less
  than 1 min" at first) and alerts the rider again every 30 s, with a longer vibration after
  2 min, through a notification on its own `offer_reminders` channel. The reminder leaves
  the tray when its offer goes.
- When the server ends an offer (socket `OFFER_ENDED`), the offer leaves the screen at once
  and the list is fetched again. Accepting or declining an offer that has already ended gets
  a 409 with the code `OFFER_HAS_ENDED`: the offer is dropped, the rider sees "This offer has
  ended", and nothing is retried.
- An Offline rider's screen holds no offers, and going Offline empties the cached list, so
  going Online again shows only what a fresh fetch returns.
- Logging out sets the rider Offline first, waiting at most 3 s; if that call fails, logout
  carries on. So the next login starts Offline.
- After the review (both reviews on 2026-10-26): the midpoint clock, the words under a
  minute, the late offer check, the 3 s logout timeout, ended offers leaving the cache,
  reminders leaving the tray, Offline emptying the list. `8804870` to `6cf001e`
- Tests by agy: 214 pass in all. The builder removed 11 row 60 tests that asserted the old
  timer (an answer sent at zero); agy wrote the row 60 rules that still hold back in.
  `85d29dc`, `d2ca36d`, `c37067a`

## Fixed

- **One countdown per offer, and accept or decline sent at most once (row 60).** Every
  fetch of the offer list started a new 60 second timer for each offer without stopping
  the old one, so the countdown restarted and stale timers could decline (or accept) the
  same offer twice. `OfferCountdowns` (`src/utilities/offerCountdowns.ts`) keeps one timer
  per offer, started the first time the app sees it, and lets only the first accept or
  decline through. A failed send lets the rider retry by hand without restarting the timer.
  The progress bars animate once per row, and the list is keyed by delivery id. `e4e43de`
- **An answered offer never comes back from an older fetch (row 60).** A failed send on
  one offer used to redraw an already answered one from the last fetch. `4d89a43`
  Tests by agy for both: `78b29aa`, `5079361`
- **The login screen crashed while typing an email address** ("Maximum regex stack depth
  reached"). The email regex could backtrack exponentially (ReDoS). The new pattern accepts
  the same addresses but rejects bad input in linear time. `93ff337`
- **A hand-typed instance link now configures the client.** The client previously kept its
  old base URL unless the registry returned details. The websocket URL is now derived from
  the link when the registry doesn't publish one. `3ce5ed0`
- **Missing React keys** in `HomeTabs` and `UserStatusSelector`. Also removed a misplaced
  key that did nothing. `7884c58`
- **`TabItem` and `StatusItem` were redeclared on every render**, which forced remounts.
  They are now at module scope, and the `useMemo` calls were deleted rather than given
  fixed dependency arrays. Keeping them would have frozen the selector colours. `b94a82b`

## Changed — toolchain

- **Moved to Yarn 4.** The pinned `yarn@3.6.4` crashed `react-native start`. `d98d9a3`
- `.env` is now ignored. It holds Auth0 credentials and was one `git add -A` away from
  being committed. `d98d9a3`
- **`yarn test` works.** `transformIgnorePatterns` now covers `@react-navigation`, and the
  never-passing `App-test.tsx` placeholder is removed. `f0aa803`
- **Installed `@types/jest`**, so test files are actually typechecked. Typecheck errors
  went from 222 to 83, and 7 real type errors in a test were fixed. `1ab7754`
- **A typecheck ratchet (row 6).** The navigators have typed param lists and the
  mechanical type errors are fixed, from 76 down to 15, with no change to what the app does.
  `corepack yarn typecheck:baseline` runs `tsc`, fails when the count rises above
  `typecheck-baseline.json`, and lowers the file when it drops. A tsc configuration error
  fails the check instead of being counted as one type error. Two unused test data files
  (`testData.ts`, `DemoClient.ts`) were deleted. `eb869da`, `b65f2c1`
- **The whole app renders under Jest (row 6).** `jest.setup.js` mocks the native modules
  once, and two smoke tests render the real `App` logged out (it reaches Landing) and logged
  in (it reaches Home and opens the live connection). Adds the dev dependency
  `@testing-library/react-native` 12.9.0. `7847b38`; tests by agy `33206bb`, `05cf40a`

## Housekeeping

- Ignored pipeline artifacts (`.aiflow/`, `plan.md`). `2c0fef6`
- `AGENTS.md`, context for AI coding tools that points at the co-op workspace rulebook, and a
  `CLAUDE.md` that imports it.

---

## Known open items

- 15 typecheck errors remain, each waiting on a behaviour decision (listed in the row 6
  walkthrough in the co-op workspace). The ratchet keeps the count from growing.
- Home crashes if it renders without a signed in user (`Home.tsx` reads
  `user!.deliverySetting`, from upstream). Queued in the co-op scope, row 66.
- A wrong phone clock (row 61) is covered by unit tests only; the emulator's clock could not
  be changed without root, which drops the `adb reverse` tunnels.
- Offer reminders only run while the app is running. Alerts with the app closed are push,
  co-op scope row 58.
- Building for Android needs JDK 17.
