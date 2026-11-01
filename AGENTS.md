# opencourier-mobile

## Overview

The courier app: React Native 0.74, React Navigation, TanStack Query, Firebase messaging,
react-native-maps. It uses the backend's `courier` API.

**Read the workspace rulebook first: [`../AGENTS.md`](../AGENTS.md).** This repo sits inside the co-op workspace, and that file binds it: co-op values, locked decisions, domain language, boundaries, and the skill workflow every change goes through ("How work gets done here"). Tools that stop at this repo's git root will not find it on their own. This file only adds what is specific to this component.

## Key files

| File | Owns |
|---|---|
| `src/screens/`, `src/navigation/` | Screens and routing |
| `src/services/`, `src/hooks/` | API calls and data hooks |
| `src/utilities/config.ts` | Reads `API_URL` from `.env` via `@env` |
| `src/services/offerPush/`, `android/.../OfferAlertActivity.kt`, `OfferAlertModule.kt` | Offer pushes on Android: token registration, the ringing full screen alert (its own activity, the only screen over the lock screen), answers sent from the alert, the Online checks for silent mode and permissions (spec 0003) |
| `src/utilities/offerCountdowns.ts`, `src/utilities/offerClock.ts` | Offer timing: counts down to the server's `offerExpiresAt`, corrected by `serverNow`; the phone never answers for the rider at zero (spec 0002) |
| `src/services/jobStepOutbox.ts`, `src/hooks/useJobStepOutbox.ts`, `src/utilities/jobSteps.ts` | Job steps go through an outbox in AsyncStorage, online or not, and are sent oldest first with `tapAgeMs`; the screen shows the later of the server's status and the waiting steps' (`inProgressOrdersAsShown`), never edits the cache (spec 0009) |
| `src/services/queryPersistence.ts` | The user, in progress deliveries and earnings are saved for 24 h (`PersistQueryClientProvider` in `App.tsx`); offers never; cleared at logout and session end (spec 0009) |

## Commands

Yarn 4 via Corepack (never 3.6.4). Android needs JDK 17 and the `adb reverse` wiring;
the workspace rulebook has the setup, and `../devup.sh mobile` automates it.

**Typecheck gate: `corepack yarn typecheck:baseline`.** It runs `tsc --noEmit`, fails when
the error count is above `typecheck-baseline.json`, and lowers the file when the count drops
(commit the lowered file). Use it instead of counting errors by hand against a stash.

## Conventions

- Tests are `*.test.ts(x)` beside the code. `jest.setup.js` mocks every native module
  once, so a screen or the whole `App` can render under Jest (see `src/App.smoke.test.tsx`);
  use fake timers when rendering `App`, or React Query's timers keep Jest from exiting.
- notifee hands a shade button press (Accept or Decline) to the next `getInitialNotification()`,
  long after that offer was answered. Only trust an offer whose alert is still on display
  (decision 58.29).
- Push is off on dev and the app still ships upstream's Firebase project, so no real FCM message
  reaches the emulator. To check push handling live, feed messages with the backend's keys to the
  app's own `onRemoteMessage` (decision 58.27).
- Cutting the app off from the backend on the emulator: `adb reverse --remove tcp:3000` (switching wifi off does nothing, the app reaches the backend through adb); `adb reverse tcp:3000 tcp:3000` restores. An already open connection survives the removal, so wait for "No connection" before tapping (spec 0009).
- A React Query refetch that fails keeps the data but sets `status: 'error'`: anything that filters on `status === 'success'` drops data that is still there (row 20 review).
- No sign up in the app: the co-op issues every rider's login from admin and resets passwords there (spec 0013). An
  admin's password change makes the backend answer 401 to the old session, which ends it through the refused renewal path.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
