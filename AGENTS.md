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
| `src/utilities/config.ts` | Reads `API_URL` from `.env` via `@env`: `apiUrl` and `socketUrl` are the app's one server (spec 0039); nothing lets a rider change it |
| `src/services/upgradeGate.ts` | The first start after an instance build: another server's saved `BASE_URL` clears that server's login, outbox and per rider notes before anything is drawn (spec 0039, AC-3) |
| `src/services/offerPush/`, `android/.../OfferAlertActivity.kt`, `OfferAlertModule.kt` | Offer pushes on Android: token registration, the ringing full screen alert (its own activity, the only screen over the lock screen), answers sent from the alert, the Online checks for silent mode and permissions (spec 0003) |
| `src/utilities/offerCountdowns.ts`, `src/utilities/offerClock.ts` | Offer timing: counts down to the server's `offerExpiresAt`, corrected by `serverNow`; the phone never answers for the rider at zero (spec 0002) |
| `src/services/jobStepOutbox.ts`, `src/hooks/useJobStepOutbox.ts`, `src/utilities/jobSteps.ts` | Job steps go through an outbox in AsyncStorage, online or not, and are sent oldest first with `tapAgeMs`; the screen shows the later of the server's status and the waiting steps' (`inProgressOrdersAsShown`), never edits the cache (spec 0009) |
| `src/services/queryPersistence.ts` | The user, in progress deliveries and earnings are saved for 24 h (`PersistQueryClientProvider` in `App.tsx`); offers never; cleared at logout and session end (spec 0009) |

## Commands

Yarn 4 via Corepack (never 3.6.4). Android needs JDK 17 and the `adb reverse` wiring;
the workspace rulebook has the setup, and `../devup.sh mobile` automates it.
The Google Maps key is read from `MAPS_API_KEY` in `android/local.properties` (untracked) or the
environment, never from `AndroidManifest.xml`; without it a debug build warns and the map will not work, and a release build stops (scope row 1).

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
- No sign up in the app: the co-op issues every rider's login from admin (spec 0013); a rider resets a forgotten password by an emailed code (spec 0039). An
  admin's password change makes the backend answer 401 to the old session, which ends it through the refused renewal path.
- One server per build (spec 0039): no source file outside `upgradeGate.ts` may read or write `BASE_URL` or `SOCKET_BASE_URL`, or
  import a deleted instance screen (`coopInstanceGuard.test.ts` fails). A new AsyncStorage key that holds per rider data must be
  cleared by `clearRiderDataOnPhone` and, if an older build could have written it, by the gate's `OTHER_SERVER_KEYS`.
- Location means precise (decision 17.22): ask with `requestAndroidLocation` (fine and coarse together); "Approximate" alone is
  its own answer, never "blocked". Every Android permission request goes through `askWithBlockedDetection`: no dialog within
  1.5 s counts as "don't ask again", because React Native otherwise answers only when the app next comes to the front.
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
  at the bottom, `HomeTopSlot` (status, connection dot, banners) on top; History is gone, Earnings is the one history (spec 0042). Routes come only
  from the backend's `deliveries/:id/route`, asked by the SERVER status (not the outbox's); no routing server is ever called
  from the app (`routingSourceGuard.test.ts` fails on `project-osrm`). The rider marker is the phone's own newest fix
  (`ownPosition.ts`, memory only, cleared at logout), never the `user` cache, which each refetch resets to the server copy.
- Every main action of a job (and Go online) is a `ButtonSwipe`, which only moves its knob back when `isSwiped` changes: give each one a `key` that
  changes after its action runs (status plus an attempt counter), or a refused step leaves the knob at the end.
- The Jest map mock is a `forwardRef` with `fitToCoordinates` and `animateToRegion` as `jest.fn()` and fires `onMapReady` on
  mount. On the emulator, the Google Maps SDK can time out reaching Google after a restart and draw nothing at all (no
  streets, no markers): that is the network, not the screen (decision 69.16).

- An offer is answered with two held buttons, not a swipe (row 135, replacing spec 0018 AC-9 and 0019 AC-5): `OfferAnswers`
  draws Decline (`DECLINE_HOLD_MS`, 1 s) and Accept (`ACCEPT_HOLD_MS`, 0.2 s) as `HoldButton`s for the single, pair and add on
  offer; on Home it sits in `HomeCard`'s `footer`, and the cells get `answersBelow` so they leave it out. Any other action that
  must not fire on a brush reuses `HoldButton`: a timer decides, the fill only shows progress, and a screen reader's
  `activate` fires at once (it cannot hold). `SosHoldButton` still has its own copy of the same logic.
- React Native Testing Library skips anything hidden from screen readers (`importantForAccessibility="no-hide-descendants"`,
  like the status word under Home's badge frame): query it with `includeHiddenElements: true` (row 134).
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
- The job card shows one stop at a time (`InProgressCell`); the swipe and its notices are `JobFooter` in `HomeCard`'s
  `footer` slot, outside its ScrollView. The small actions sit behind the ⋯ `JobActionsButton` beside the address (row 138),
  listed by `useJobActions`; anything there that changes with time must redraw the button itself (`useWaitClock`), or it
  appears only on the next refetch (the bug row 138's tests found). Notes stay one line (`JobNotesLine`), items open a sheet (`JobItemsLine`, ticks
  never sent). Never show `pickupReadyAt` as the pickup time: it is the restaurant's planned ready time from the quote; the
  card reads the rider's own swipe from `pickupTimes`.

- The SOS store (`src/services/sosStore.ts`, spec 0022) keeps a list per rider, oldest first: at most the newest is shared,
  the others are ended and only wait to be sent. `sosSender` sends each one whole (start, points, end) before the next start,
  because the server answers a new start with the rider's still active SOS. Screens read the newest. Every age sent is capped
  at 7 days. While the newest is shared the phone sends no accept and auto accept skips offers (decision 73.10).

- notifee reads an Android notification's body and big text as HTML: a '\n' shows as a space (use `<br>`), and any
  text from outside the app (a restaurant's name) must be HTML escaped or its tags are swallowed (row 100, `offerAlert.ts`).
  iOS shows the body as plain text, so escape on Android only. The offer alert's lines come from the card's own
  `offerTripLines` through `offerAlertLineList`; never word an offer twice.

- The waiting card at the pickup (spec 0033) only compares the clock to `leaveFrom` and `paidFrom`, which the server sends with each job and `getInProgressOrders` moves onto the phone's clock. The rule lives in the backend, so never work these times out on the phone. Leave is online only, like the hand back. While the arrival waits in the outbox the clock counts from the tap, and Leave stays hidden.

- Removal requests (spec 0035): the reasons query uses `gcTime: 0`, because each reason says whether it pays and this app otherwise keeps answers 24 h. Logout clears removal notifications by the id prefix `removal-`, read from `getDisplayedNotifications`, because they outlive the app.

- The app targets SDK 35, so on Android 15 it draws edge to edge and `adjustResize` no longer makes room for the keyboard: a `KeyboardAvoidingView` needs `behavior="padding"` on Android as well as iOS (Chat has it, and since row 114 so does every screen where a rider types; AddNote is still iOS only, but nothing opens it until notes come back with row 82). FlatList's `scrollToEnd` stops short while rows are unmeasured: Chat scrolls to the content height less the list height, from `onContentSizeChange` and `onLayout`.

- Chat (spec 0034): unsent messages live in the module store `services/chat/chatOutgoing.ts`, so leaving the screen keeps them; logout and `endExpiredSession` clear it, the chat notice and the seen mark. What the rider has seen is worked out on the phone only.

- Earnings (spec 0042) shows only the server's figures; every day and clock time is the co-op's (`coopDate`, `coopClock`,
  Europe/Athens), never the phone's zone, and the reach comes from the server's `reachFrom`. A saved query whose answer
  changes shape needs a new key name (`earningsDelivery` became `earningsDeliveryDetail`), or a copy restored from the phone
  crashes the screen. Tell no connection from a 404 with `detailFailureOf` (`hooks/useEarnings.ts`).
- Anything kept per rider on the phone is cleared in two places, `logout()` in `services/Services.ts` and `endExpiredSession` in `services/session.ts`; the review marks and notice (spec 0038) were first added to only one. Drawer screens stay mounted, so a screen that must refresh each time it is shown listens to `navigation.addListener('focus', …)` rather than refetching on mount (Earnings, spec 0038).

- Logout ends with `queryClient.resetQueries()`, which empties the `user` query while the drawer and the main stack are still drawn, for a moment before `router.tsx` swaps to the login screens. Anything on screen then must cope with no user: read it with `user?.` or a check first, never `user!` (that threw in the side menu and left a blank screen, row 116).

- The order's box size (spec 0043) is worded only by `boxSizeLine` (`src/utilities/boxSize.ts`): "Medium order" on the offer card
  and on the job card at the restaurant, nothing for an unknown size. No box gauge or fill anywhere (operator decision); the
  full screen offer alert does not show the size yet (decision 9.8).

- "Why you got this" (spec 0045) is worded only by `whyYouLines` (`src/components/WhyYouSection/WhyYouSection.tsx`) from the
  server's `whyYou`: a FAIRNESS factor gets a line only when its weight was sent (above 0), and a strategy the app does not know
  says it cannot be shown yet, never "No reason was recorded" (that is for a null reason only). Never show a score, a rank or
  a count of riders compared.

- Shift Offline records (spec 0049) come worded by the server in the schedule's optional `offlineRecords`; the Shifts screen
  shows them as sent and words nothing itself, and shows nothing when the field is missing (an older server).

- A session the co-op ended (spec 0051) is said on the full screen `SessionEndedNotice`, driven by the error code
  (`ACCOUNT_DEACTIVATED`, `CREDENTIALS_CHANGED`) from a refused renewal or a refused socket, never by message text.
  `saveSession` bumps a counter the socket provider watches, so new tokens reopen the live connection; a credential change
  runs inside `whileChangingCredentials`, so a request refused meanwhile retries with the new token.

- Monthly statements (spec 0050) download through the native `react-native-blob-util` (a change to it needs a native rebuild,
  JDK 17) into the cache and open in the phone's viewer; statement files are deleted on a failed download and in both clear
  places above. The permissions the library declares and the app does not need are removed with `tools:node="remove"` in
  `AndroidManifest.xml` (a test reads it); keep `WAKE_LOCK`, which Firebase messaging needs. `jest.setup.js` mocks the module.

- "Leg 1 of 2" (spec 0046) is worded only by `legLine` (`src/utilities/legs.ts`), on the offer card and the job card at every step;
  nothing for a single delivery. Push data carries the labels as strings ('' for a single delivery): convert with `Number()`
  if a card is ever built from push data.
- Split at pickup (spec 0047): the rules the footer follows are `src/utilities/splitRequest.ts`; the answer (live message or push)
  goes through `receiveSplitDecision` (`src/services/splitNotice/`), which reads the jobs again and posts once per answer on its own
  channel (`split-decided`), cleared in both clear places. A sent request's times go on the phone's clock at once
  (`splitTimesOnPhone`); while a request is open the split line is the only clock on the card.

- The rider's Earnings timeline labels a line `earnings_event_<type>` and falls back to "Update": a new event type the backend
  writes with the rider's id needs that label in both languages (row 146). `src/types/event-messages.ts` and
  `src/localization/server/*` are word for word copies of the backend's; the parity test counts the codes.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
