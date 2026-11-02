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
- Dispatch stops (spec 0014) reach the app only by polling `dispatch-state` (`useDispatchState`): every minute while Home
  is in front and the app is active, and on returning to the foreground. No TanStack focus manager is wired to AppState
  here, so `refetchInterval` alone keeps running in the background; scope it by hand.
- Contact from the job (row 72): every call, text and dispatch button on the in progress card hides once `isJobOver`
  (`src/utilities/jobContact.ts`) is true for the *shown* status, so a drop off still waiting for signal counts; each
  button also needs its number. The customer's number is sent only while the rider holds the delivery (row 33). Calls
  and texts open the phone's own apps and are never recorded (value 5).
- notifee refuses a vibration pattern that has a 0 or an odd number of values, and Android fixes a channel's sound when
  the channel is first made, so a new sound needs a new channel id. `jest.setup.js` mocks notifee, so a test must check
  the pattern itself: row 32's alert never fired on a real phone while every test passed.
- A cancelled job (spec 0015) shows a full screen card from `GET deliveries/cancelled-jobs` until the food outcome is
  recorded (after pickup) or OK is tapped (before); Later sets it aside for the session behind a banner on Home.
- Floor and doorbell (spec 0016) come in the courier DTO only while the rider holds the delivery, like the phone. The
  pin move (`useMoveDropoffPin`) reads one fresh location only after the rider confirms, refuses an accuracy over 50 m or
  with no figure (0, negative), is online only, and is shown once per delivery (`dropoffPointCorrectedAt`). It needs the
  location permission, which the emulator can lose: `adb shell pm grant com.opendeli android.permission.ACCESS_FINE_LOCATION`.

- Home is a full screen map (spec 0018): `RouteMap` behind, `HomeCard` (one of Offline, Online, Last call, an offer, a job)
  at the bottom, `HomeTopSlot` (status, connection dot, banners) on top; History is a side menu screen. Routes come only
  from the backend's `deliveries/:id/route`, asked by the SERVER status (not the outbox's); no routing server is ever called
  from the app (`routingSourceGuard.test.ts` fails on `project-osrm`). The rider marker is the phone's own newest fix
  (`ownPosition.ts`, memory only, cleared at logout), never the `user` cache, which each refetch resets to the server copy.
- Every main action is a `ButtonSwipe`, which only moves its knob back when `isSwiped` changes: give each one a `key` that
  changes after its action runs (status plus an attempt counter), or a refused step leaves the knob at the end.
- The Jest map mock is a `forwardRef` with `fitToCoordinates` and `animateToRegion` as `jest.fn()` and fires `onMapReady` on
  mount. On the emulator, the Google Maps SDK can time out reaching Google after a restart and draw nothing at all (no
  streets, no markers): that is the network, not the screen (decision 69.16).

- The offer card (spec 0019) shows only the total, the km to the restaurant and to the customer, the minutes, the
  restaurant and the drop off area, from the offer's `offerTrip` and `dropoffArea` (the backend works them out; null parts
  are left out). Never add the customer's name, items, a full address or €/km to it. `ButtonSwipe` takes a `height`; its
  knob, travel and half way follow from it, and the default 48 px swipe is unchanged.

- Auto accept and the hand back (spec 0020): only the app's auto accept loop sends `{ automatic: true }` with an accept; a
  tap never does, and only an automatic accept posts the `auto-accepted` notice (its own channel and `auto_accept.wav`;
  a new sound needs a new channel id). After an accept, a 409 `CANT_UPDATE_DELIVERY_STATUS` or a 404 on the dispatched step
  counts as done. The Hand back button counts down from `handBackUntilOnPhone` (the server's end, corrected by the job
  list's `serverNow`); during the window, before the restaurant, the card shows only the drop off area
  (`hidesCustomerDetails`, `dropoffAreaOf`, a copy of the backend rule that must stay the same).

- Arrival detection and the two swipes (spec 0021): `useArrivalDetection` runs in the `ArrivalDetector` leaf in
  `router.tsx` over every held job, from the in-memory `latestFix` (accuracy and the phone's `Date.now()`, never GPS
  time). A fix counts within the co-op's `arrivalRadiusMetres` (from `config/contact`; none or 0 = off) at an accuracy of at
  most max(radius, 30 m), at most 60 s old and taken after the job began heading to that stop. During the free hand back
  window a pickup arrival is held in `heldArrivals` (AsyncStorage) and released at `handBackUntilOnPhone` + 3 s, never
  while `isHandBackInFlight`. Steps only through `useOrder` (`imHere`, `pickedUp`, `delivered`): each swipe records a
  missing arrival first, so the server's PICKED_UP shortcut is never used; `detected` is sent only on the arrived routes.
- The job card shows one stop at a time (`InProgressCell`); the swipe and small actions are `JobFooter` in `HomeCard`'s
  `footer` slot, outside its ScrollView. Notes stay one line (`JobNotesLine`), items open a sheet (`JobItemsLine`, ticks
  never sent). Never show `pickupReadyAt` as the pickup time: it is the restaurant's planned ready time from the quote; the
  card reads the rider's own swipe from `pickupTimes`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
