# Changelog — co-op fork of `opencourier-mobile`

This fork adapts [Princeton-HCI/opencourier-mobile](https://github.com/Princeton-HCI/opencourier-mobile),
the courier app, for a Greek workers' cooperative delivering by moped in Volos.

Everything below sits on top of upstream `main` on the branch `feat/courier-earnings`
(10 commits, 26 July – 31 July 2026). Each entry names its commit, and the commit message
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

## Fixed

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

## Housekeeping

- Ignored pipeline artifacts (`.aiflow/`, `plan.md`). `2c0fef6`

---

## Known open items

- About 83 typecheck errors predate this fork (`MainNavigation`, `useHomeOrders`,
  `testData`, …).
- There is no whole-app smoke test yet; one needs native module mocks.
- Building for Android needs JDK 17.
