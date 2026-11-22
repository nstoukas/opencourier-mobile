# Changelog — co-op fork of `opencourier-mobile`

This fork adapts [Princeton-HCI/opencourier-mobile](https://github.com/Princeton-HCI/opencourier-mobile),
the courier app, for a Greek workers' cooperative delivering by moped in Volos.

Everything below sits on top of upstream `main` on the branch `feat/courier-earnings`
(159 commits, 26 July to 2 November 2026). Each entry names its commit, and the commit message
has the full reasoning and verification notes.

---
The cross family review (agy, `/crosscheck review`) that rows 79, 10 and 11 owed was given on 22 November, and its fixes, built on the branch `fix/agy-owed-reviews`, were merged in the same day. Row 11: while a split request is open, the ordinary Leave no longer shows beside the split's own (the server refused it then), since `canLeaveWait` now says no (`c5712c8`); Request split pads its bottom by the Android inset, so "Send to dispatch" no longer sits under the navigation bar (`6d63c53`); leaving a split takes the job off home at once and reads offers and both earnings queries again, as the ordinary Leave does (`45aa2ef`). Row 10: the full screen offer alert and its stored copy say "Leg 1 of 2" for one leg of a bigger order, in the offer card's place and words, and nothing for a single delivery (`6b5abab`). Row 79 needed no mobile change (tests by agy, `6c234dc`).

Scope row 83 (complaints both ways with no ratings, spec 0052, Beta) was built on the branch `feat/complaints` and merged in on 22 November. A job's Delivery details in Earnings gains "Make a complaint": the rider picks the restaurant or the customer, a category and a few lines, and may attach one photo from the gallery through Android's system Photo Picker (no storage permission, no camera; a file over 5 MB is refused before sending, and the picker's copies are deleted from the phone afterwards). A new Complaints screen in the menu (no dot, count or badge) lists the complaints the rider filed and the ones about them, with the full text, a single reply box for a complaint about them (a stored reply shows at once and says "Reply sent") and the outcome; a complaint about the rider arrives as a quiet push, shown Online or not, which opens Complaints and is cleared there, at logout and at a session end. New package `react-native-image-picker` 7.2.3 (`ebf9b26` to `737921c`, review fixes `b2872d7` to `12722d8`; tests by agy, `607e921`, `a9ad73e`). The iOS `Podfile.lock` is not updated yet.

Scope row 11 (split at pickup, spec 0047, GA) was built on the branch `feat/split-at-pickup` and merged in on 21 November. At the restaurant the job footer offers "Doesn't fit one box": a screen to pick 2 to 4 boxes and a size each (box 1 is the rider's) and send it to dispatch, online only. While dispatch answers, the card counts the wait and says when Leave comes, the ordinary wait clock steps aside and the Picked up swipe waits; past the co-op's limit Leave appears and asks first. The times are put on the phone's clock as soon as the request is sent. Dispatch's answer arrives by live connection or push and is told once, with its own notification channel and the phone's sound, as removal answers are; the card then says the size the rider keeps, or dispatch's sentence. The notices are cleared at logout and session end (`5d95891`, `28395f8`, review fixes `1766811`; tests by a Fable subagent while agy was out of quota, `eb2f262`, `cae626d`). Owes a cross family review (`/crosscheck review`) once agy is back.

Scope row 10 (multi leg orders, spec 0046, GA) was built on the branch `feat/multi-leg-orders` and merged in on 21 November. The offer card and the job card say "Leg 1 of 2" when an order goes as several deliveries, the job card at every step, so the rider knows at the door that a colleague brings the rest (`e60b6d2`, `95f453d`; tests by a Fable subagent while agy was out of quota, `cfea694`). Owes a cross family review once agy is back.

Scope row 76 (monthly statements, spec 0050, Beta) was built on the branch `feat/monthly-statements` and merged in on 21 November. Earnings gains Statements: each finished month since the rider joined, as PDF or CSV, opened in the phone's own viewer through `react-native-blob-util` 0.19.11 (the app needs a native rebuild). Pulling Earnings refreshes the months; a failed download deletes what it saved, and logout and a session end delete every statement file in the cache. Four permissions the library declares and the app does not need are removed from the merged manifest. "Changes by the co-op" words an admin's download of the rider's statement (`1e50393`, review fixes `d49654e`; tests by a Fable subagent while agy was out of quota, `bcd0f00`, `0a23edf`). The iOS `Podfile.lock` is not updated yet.

Scope row 108 (rider account upkeep, spec 0051, Beta) was built on the branch `feat/rider-account-upkeep` and merged in on 21 November. A session the co-op ended (a deactivated account, or a changed password or login email) shows a full screen card with the reason instead of a generic alert, from a refused renewal or a refused live connection. Settings gains Change password (fresh tokens, the live connection reopened, a request in flight retried with the new token) and "Changes by the co-op" (the rider's account record, never saved on the phone). The emergency contact screen, which saved nothing before, reads and saves a name and phone on the server, and only after it loaded (`5c287c8`, review fixes `0618602`; tests by a Fable subagent while agy was out of quota, `d2359bb`, `7df23ba`).

Scope row 79 (shift priority in dispatch, spec 0049, GA) was built on the branch `feat/shift-priority` and merged in on 21 November. The Shifts screen shows "Recorded on your shifts" when the server sends the rider's own Offline records of the last 7 days: the server's sentence (time, shift, cause) and "This changes nothing about your offers or pay." Why you got this says "You were on a booked shift" when the shift factor counted (`1111bb1`; tests by a Fable subagent while agy was out of quota, `f470b95`). Owes a cross family review once agy is back.

Scope row 14 (why this offer, for couriers, spec 0045, Beta) was built on the branch `feat/why-this-offer` and merged in on 21 November. A job's page in Earnings has a "Why you got this" card under the pay breakdown, worded from the server's `whyYou`: for the fairness matcher the road time (marked estimated when no route was worked out), the rider's pay per hour today or that the co-op average or equal counted, the waiting, and the co-op's weights, each line only for a factor that counted; for Nearest the distance or the road time; one sentence for Seniority and for Dispatch; a fallback for an old job; a link to How offers and pay work. Known open: when the matcher could not read the day's figures, the card says "Waited under a minute" (decision 14.5) (`4984fdd`, review fixes `c666157`; tests by a Fable subagent while agy was out of quota, `c29fbf1`, `ac89607`).

Scope row 9 (the box model, spec 0043, GA) was built on the branch `feat/box-model` and merged in on 21 November. The offer card and the job card at the restaurant say "Small order", "Medium order" or "Large order", so a rider knows what they will carry before accepting; no box gauge anywhere. A job's timeline words an admin's confirmed override as "Given to you past a full box" (`b3ea1a1`; tests by agy `b7f00f6`, which also pinned the clock in two Earnings suites that failed once the date passed 20 November). Known open: the full screen offer alert does not show the size yet (decision 9.8).

Scope row 120 (a break under a minute) was built on the branch `fix/break-under-a-minute` and merged in on 20 November. In Time worked, a break shorter than a minute used to read "Break 01:35 to 01:35", which looks like a mistake. It now reads "Break at 01:35, under a minute" (new key `time_worked_break_under_a_minute`); it is never hidden, and breaks of a minute or more read as before. Seen on the emulator. Reviewed by Fable (approve with nits); tests by agy, each important one shown to fail with its bug put back, including a 59 second break. Commits `b2d88ed` to `8fdda58`; decision 75.43. With it the suite is at **2081 passing tests**.

Scope row 75 (earnings and one merged history, spec 0042) was built on the branch `feat/earnings-history` and merged in on 20 November. Four screens become one. Earnings opens on today with a Day | Week switch and the period between arrows; tapping the period opens a month calendar (Monday first, a dot on each day with work, days after today and before the 2 month reach greyed). Under it: the figures card (money, drop offs, time worked, € per hour worked, € per hour on a job, € per paid km, the typical pickup wait), row 36's co-op card, then each shift that touched the day with its job rows (accept time, restaurant → area, km, minutes, money, a label when not delivered), "Continues from" for a shift that began the day before, and jobs in no recorded shift under their own heading. The first reachable day says "For older work, ask the co-op." Tapping a job opens its detail: the pay breakdown, the rider's own job lines, the timeline (You, Restaurant, Dispatch, System, with the day shown when it changes) and Ask for a review. History leaves the side menu, and the old day and delivery screens are gone. Every day and clock time is the co-op's (Europe/Athens), whatever the phone's time zone. A month or job already opened stays on the phone for 24 hours: with no signal it shows with "No connection. As of 11:46.", or "Could not refresh. As of …" when the server refused, at once rather than after the retries; a job never opened says it needs a connection instead of "Delivery not found" (review fix). Pull to refresh always answers the rider's pull, a delivery status message refreshes Earnings, and a screen left on today moves to the new today after midnight. How offers and pay work gains "How your earnings figures are counted". Seen on the emulator. Reviewed by Fable (changes requested: two majors, both fixed, then every accepted minor); tests by agy, each important one shown to fail with its bug put back. Commits `b46f88b` to `7f52b3d`; decisions 75.37, 75.38 and 75.43 to 75.46. With it the suite is at **2073 passing tests**.

Scope row 36 (paid and unpaid time per shift, spec 0040) was built on the branch `feat/time-worked` and merged in on 20 November. While a shift is open, the home map shows one quiet line under the status, "3 min online · €10.28 · €107.90/h", from the server's snapshot (`time-worked/current`) with the minutes added on the phone between reads; it reads again after a real fetch of the rider or their jobs, when the app or the home map comes back to the front, and every 5 minutes, and never on a cached update such as a location fix (review fix). On a break it reads "On break 24 min" until the co-op's break limit ends the shift. Earnings gains a Time worked section: the last 7 days by day, each shift with its start and end, breaks, the split into job time, paid waiting and unpaid time, its money and € per hour, the records behind it, and "Earlier" for the 7 days before; days and clock times are the co-op's (Europe/Athens), and the section stays open across re-renders (review fixes). A Co-op this week card shows this and last week's co-op totals, or only a sentence when fewer than 3 riders worked. How offers and pay work says how time worked is counted and that admins can see it. Commits `91877db` to `086d9ff`; decisions 36.43 and 36.48.

Scope row 17 (the courier app locked to the co-op instance, spec 0039) was built on the branch `feat/coop-instance-login` and merged in on 19 November. The app has one server, the co-op's, fixed by the build's `API_URL`: a fresh install opens straight on the new Login screen, and every instance screen (the intro carousel, the registry browser, the typed instance link, the organization switch) is gone with its code and strings. A phone updated from an instance build that had saved another server forgets that server's login, deliveries, waiting job steps, SOS positions and notes before anything is drawn, with no request and no alert; the same server keeps everything. Login has Forgot password: the rider gets a 6 digit code by email, types it with a new password and is logged in. After a login, a Permissions screen asks for location and notifications, once. Going Online needs precise location (decision 17.22, after the review): refused, the rider stays Offline and is told why, "Approximate" asks for Precise, and coming back to the app Online with no job and no location sets the rider Offline. Back from Login now leaves the app. Seen on the emulator; reviewed by Fable, every finding ruled; tests by agy, each important one shown to fail with its bug put back. Still to check outside the emulator: a release build without an https address (AC-4) and the keyboard on a real Android 15 phone (AC-17). With it the suite is at **1988 passing tests**; the typecheck ratchet is unchanged.

Scope row 30 (Platform Work Directive readiness, spec 0038, GA) was built on the branch `feat/platform-work-directive` and merged in on 19 November. Earnings opens with a link to "How offers and pay work": how an offer reaches you, how your pay is worked out, what a person decides and never the app, what the app records about you, ask for a review, and what changed, all with today's numbers from the server, and a line saying when they may be out of date. A rider can ask for a review from a delivered order's pay breakdown or from the page; Send says it went and by when a representative answers, and a second request on the same delivery gets the app's own sentence. The page lists the rider's requests with their due dates, "Overdue", the answer and any correction, and an open one can be withdrawn. An answer the rider has not opened is marked "New answer" on the page and on the Earnings link; that mark lives only on the phone, and Earnings asks for the list again whenever it comes back into view. An answer's push shows "Your review request has an answer" on the chat's quiet channel and opens the page (not seen on the dev instance, where push is off). A review correction shows as "Review correction" in the day and in the breakdown, in its own currency. When the server refuses a position because the rider is Offline with no job, the location watch stops quietly and the rider is loaded again. Logging out and an expired session both clear the review marks and the notice. Reviewed by Fable and by agy; the findings that held were fixed, including an SOS location test that could not fail, and agy's tests for them bite. Seen on the emulator. Decisions 30.10 and 30.11. With it the suite is at **1903 passing tests**; the typecheck ratchet is unchanged.

Scope row 116 (logging out leaves a blank screen) was built on the branch `fix/logout-blank-screen` and merged in on 18 November. Logging out from the side menu used to crash to a blank screen until the app was relaunched, because the menu read the rider's name after logout had already cleared the rider. It now greets with a plain "Hi!" for that moment, so logout lands on the intro screens and logging back in works without a relaunch. Seen on the emulator. Reviewed by Fable. With it the suite is at **1820 passing tests**.

Scope row 114 (typing a note or a report is not hidden by the keyboard) was built on the branch `fix/keyboard-padding` and merged in on 18 November. The app draws edge to edge on Android 15, so Android no longer shrinks the screen for the keyboard, and a text box that only made room for it on iPhone ended up underneath. Report Issue, Request removal, Report a product, the Welcome login form and Choose instance now make room on Android too, the same fix Chat got. Seen on the emulator for four of the five (Choose instance needs a registry). Reviewed by Fable. Decision 114.1. With it the suite is at **1817 passing tests**.

Scope row 112 (honest labels for jobs the rider did not deliver) was built on the branch `fix/honest-job-labels` and merged in on 18 November. A wait, a removal, a return trip, a cancelled or a reassigned job never says "Delivered" in its detail: it says "Paid on", and a cancelled or reassigned job's first line says so. A day or week that paid money with no drop off says "Paid for other work, no deliveries" on the summary, its day rows and the day screen, with the pay and tips line. Reviewed by Fable. Decision 112.1. With it the suite is at **1810 passing tests**.

Scope row 111 (chat between dispatch, riders and restaurants, spec 0034) was built on the branch `feat/chat` and merged in on 18 November. The side menu and a job's card open Chat, the rider's one thread with dispatch, which shows "Dispatch", "read" under the rider's own messages once dispatch opened them, and the co-op's quick replies for the road. A message dispatch writes arrives live, or by a quiet notice on its own `messages` channel when the app is away or another screen is in front, never while the rider is Offline; tapping it opens Chat. A message not sent stays, even after leaving the screen, with "Not sent, tap to retry", and one refused for an order the rider no longer holds can be sent without it. What the rider has seen is worked out on the phone; the server never learns it. Reviewed by Fable; every finding ruled and fixed with tests. Decisions 111.12, 111.13 and 111.15. With it the suite is at **1783 passing tests**; typecheck matches its baseline.

Scope row 24 (a rider asks dispatch to come off an order, spec 0035) was built on the branch `feat/removal-requests` and merged in on 10 November. Once the free hand back is over, a job shows Request removal. The rider picks a reason, seeing first whether it is Paid or Not paid, adds a note where one is needed, and sends. While dispatch decides, the job says so and offers Withdraw, and the rider keeps working the order. A refusal shows on the job with dispatch's sentence. An answer arrives over the live connection, as a notice on Home that stays until tapped and as a system notification, and logging out clears both. The earnings screens list a removal and a return trip as their own lines. The reasons are loaded fresh each time the screen opens, because each one says whether it pays. Decisions 24.22 to 24.27 and 24.50 to 24.54.

Scope row 90 (the Dispatch board, spec 0034) was built on the branch `feat/dispatch-board` and merged in on 9 November. The Online notices now tell riders that dispatch can see where they are while working, only to give out jobs, and that no history is kept.

Scope row 23 (restaurant delay pay and leaving a late order, spec 0033) was built on the branch `feat/wait-pay` and merged in on 9 November, behind `waitPayEnabled`, off by default. At the restaurant the job card shows "Waiting 6:12", counting up each second, and when the wait will start earning ("paid from 12:15"), counting from the tap while there is no signal. Leave appears once the time the server gave has come, asks first, is online only, and turns the swipe off while it is sent. Report Issue offers "Marked Ready But Not Ready" once the restaurant has marked the food ready. Earnings show a Waiting row, a delivered order's detail shows its waiting amount, and a left order's detail no longer reads as a delivery.


## Added

### Report a product at the door (row 15, spec 0032)
- At the customer's door the footer offers Report a product: wrong or missing, the item or something else, and a note. It says when it is sent.
- 1525 tests pass; put backs by hand. Reviewed by Fable. Seen on the emulator, the report stored and its note kept off the event.

### Ready signals on the job card (row 21, spec 0023): `62523f8` to `8a3bb33`
- The job card shows "Preparing, ~8 min" or "Ready" until pickup, and a notice says when the restaurant delays or marks the food ready. The time is corrected for the phone's clock.
- A live message and a push for the same change post one notice (agy's cross family review found the race).
- The shared `escapeHtml` is used by both the offer alert and the ready notice.
- Tests by a fresh Claude subagent, then agy; 1501 pass; put backs by hand. Reviewed by Fable and agy.

### Drinks and sides first on the pickup checklist (row 103, spec 0028): `ea395c7` to `ce12144`
- The items line reads "3 items · 2 drinks, 1 side". The sheet lists drinks, then sides, then the rest, with a
  small Drink or Side pill, and ticks stay with their item. An order with no marks looks as before, and the
  swipe never waits on the checklist.
- Tests by a fresh Claude subagent while agy was out of quota: 1433 pass; put back by hand. Reviewed by Fable.
  Seen on the emulator with a marked order.

### Shifts: book, drop, swap, and a banner on home (row 78, spec 0027): `e76fbc8` to `5cc4115`
- **The switch.** With the co-op's Shifts switch on, the side menu has Shifts.
- **The Shifts screen.** Your shifts, with Drop (asks first), Offer swap and Withdraw swap. The next 14 days,
  with Book, Take swap or Full, and the places left.
- **The banner.** Home's top says "ON SHIFT until 23:00" or "FREE (no shift)" and redraws itself at the next
  start or end.
- **The reminder.** The phone schedules a local reminder 30 minutes before each shift, and cancels it when the
  shift is dropped or swapped away, when Shifts go off, and at logout.
- Every time shown is the server's Athens text; the schedule is kept on the phone for a restart with no signal.
- Tests by a fresh Claude subagent while agy was out of quota: 1405 pass; put back by hand. Reviewed by Fable
  (fixes in `babd27e`). Seen on the emulator: the banner, booking (its reminder scheduled) and dropping (the
  reminder cancelled).

### Every notification shows a restaurant's name as typed (row 105): `042f347`, `6d7197f`
On Android the notification library reads a title and body as HTML, so a restaurant named `<b>Bold</b> & Co`
lost its tags (row 100 found it on the offer alert). The cancelled job notice and the auto accept notice now
escape the name through one helper (`notificationText`, Android only). Tests by a fresh Claude subagent, with a
scan that fails if a notice carrying a restaurant's name is posted unescaped; reviewed by Fable (approve with
nits); both notices seen on the emulator.

### Screen titles clear of the status bar (row 104): `20cbebf` to the Report Issue fix
22 screens wrapped their content in React Native's own SafeAreaView, which keeps clear of the system bars only
on iOS, so on Android their titles and back buttons sat under the status bar. One `ScreenSafeArea` wrapper
(react-native-safe-area-context) now pads the top on Android and keeps iOS exactly as it was. Tests by a fresh
Claude subagent (`aaa4ac8`, including a guard that no file goes back to React Native's SafeAreaView); reviewed
by Fable (approve with nits). Seen on the emulator on 12 screens.

### The offer alert shows what the card shows (row 100): `bd9f219` to `4d2e58a`
No native rebuild needed. Needs the backend's row 100.
- **Same figures, same order, same words.** The alert and the full screen offer read "1.8 km to the
  restaurant · 1.0 km to the customer", "About 6 min", then "R73 Kitchen to Volos", from the card's own
  formatter. With routing down they show the money and the place, as the card does; the quote's single km
  is never shown.
- **Readable on the lock screen.** The expanded notification shows one line per row (big text style). On
  Android notifee reads the text as HTML, so the lines are escaped: a restaurant's name can never add
  markup to a rider's lock screen.
- Tests by a fresh Claude subagent while agy was out of quota; put back by hand. Reviewed by Fable
  (changes requested, fixed in `c1522f0` and `4d2e58a`). Verified on the emulator.

### SOS: hold 3 s to call 112 and alert the co-op (row 73, spec 0022): `53772f5` to `6ec125e`
No native rebuild needed. Needs the backend's row 73.
- **The pill.** A red SOS pill sits at the top of Home whenever the rider is online or holds a job.
  A 3 s hold (a ring fills; letting go earlier does nothing) opens the dialer with 112 typed (Android
  lets no app call an emergency number itself) and the SOS screen under it.
- **The co-op is told, even with no signal.** The SOS is written to the phone first and sent from
  there: the start, then positions every 5 s (also with the dialer or another app in front, under a
  standing "SOS active" notification), then the rider's "I'm safe" or "False alarm". Each keeps its
  true time. A hold after an "I'm safe" that is still waiting for signal starts a new SOS, sent after
  the first one ends.
- **Back and restart.** Home shows a red "SOS active" banner in place of the pill; a force stop or a
  new login reopens the SOS screen and resumes sharing (asking the server again every 15 s if it
  cannot be reached at launch). Logging out asks first and keeps anything not yet sent.
- **No job during an SOS.** Accept answers "You can't take a job during an SOS. Tap I'm safe first.",
  and auto accept skips offers, so the offer simply expires.
- **Value 5.** Positions go to the SOS only, sharing stops the moment it ends, and dispatch gets no
  finer location than the rider's ordinary mode gives it.
- Tests by agy (`e5268fa`, `b3658ac`) and, while agy was out of quota, by a fresh Claude subagent
  (`6ec125e`): 1201 pass; put back by hand each round. Reviewed by Fable (changes requested, its
  major fixed in `6ba2272`). Verified live on the emulator.

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

### Offers follow the server's deadline (row 61) — `ec79791`, `9389518`, `d6e56ad`, `77cdece`
This is the courier app half of offer expiry. It was built on the branch `feat/offer-expiry`
and merged on 26 October, together with the backend and adminweb halves of the same row.
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

### Offers ring on a locked Android phone (row 58) — `013d6ed` to `690f047`
This is the courier app half of offer push. It was built on the branch `feat/android-offer-push`
and merged on 26 October, together with the backend half. Real push waits on the co-op's own
Firebase project (scope row 1); until then the app ships upstream's Firebase settings and every
part below was checked on the emulator with messages handed to the app's own handler.
- **The phone registers for push** while a rider is logged in (on every start, and when Firebase
  replaces the token) and unregisters first on logout. The token never appears in a log.
- **A new offer is a full screen alert on a locked phone**, or a heads up alert when the rider
  has not allowed full screen alerts. It loops the co-op's own ring (`offer_ring.wav`, an original
  tone made by `scripts/make-offer-ring.py`) until the rider answers or the offer ends, and counts
  down to the deadline when there is one. A re send after 2 minutes (expiry off) uses a second
  channel with a longer vibration.
- **Accept and Decline work from the lock screen** without opening the app, even with the app
  closed. Each offer is answered at most once from the phone, whether from the alert or the app
  (the answered list is shared); a 409 leaves a short "This offer has ended" notice.
- **The offer screen** (`OfferAlertActivity`) is the only screen allowed over the lock screen. It
  shows the offer card's facts from the alert itself, at once, and nothing else of the app;
  "Open the app" asks for the phone's PIN first.
- **The alert goes when the offer goes**: an `OFFER_ENDED` push or socket message cancels it, and
  Android removes it by itself 5 s after its deadline.
- **On the offers list, no second alert**: the list shows the offer and rings once. On any other
  screen of the app, a heads up alert.
- **Going Online checks the phone can ring**: the first time, it asks for notification permission
  and explains the full screen alert setting; on silent, vibrate or Do Not Disturb it warns "Your
  phone is on silent. You may miss offers." The rider decides; nothing is stored or sent, and the
  questions hold going Online up for at most 30 s.
- Row 61's 30 s reminder stays the fallback and is skipped while an offer's alert is up.
- After the review (2026-10-26): the offer screen follows the alert that reopened it, no "ended"
  while an answer is sending, the 30 s limit, Home writes the answered list, logs without the
  token, the ring player's cleanup. `361e512`, `22480f3`
- Found in the live verify: the offer screen could take an old offer notifee kept from a button
  pressed in the shade, and say it had ended over a live one. `690f047`
- Tests by agy: 295 pass in all (214 before). `b93ae41`, `902534c`, `4faab04`
- The old push code this replaces (`pushNavigation.ts`, `onMessageReceived`) is gone. `f08df5e`

On 2 November the courier app stack built from 27 October to 2 November was merged in, from
row 65 (design foundation) to row 71. The GA rows (pay and matching) among them have the entries
below; the others are recorded in the workspace's scope and walkthroughs. With them the suite is
at **1025 passing tests**.

### Job steps wait for signal (row 20, spec 0009): `8fb0240` to `5f19e36`
Built on the branch `feat/bad-signal-outbox` with the backend half (the tap time). Merge the
backend first: this half sends `tapAgeMs`, which an older backend refuses.
- **A tap is accepted at once.** Every job step goes into an outbox kept on the phone and is sent
  in order when the server can be reached: after each tap, at login, on reconnect, when the app
  comes to the front, and every 30 s while steps wait. The step shows "Waiting to send" until then,
  and survives a restart. Each step carries its age, so pay lands on the day the rider tapped.
- **A refused step says so.** A step the server refuses (the delivery was cancelled meanwhile, say)
  and the later steps of that job are never sent; Home shows a card naming the restaurant and the
  step, with "Call the co-op".
- **What was loaded stays readable.** The rider, the jobs in progress and the earnings are kept on
  the phone for 24 hours (offers never are), and removed at logout.
- **Log out waits** while this rider's steps wait to be sent, since a Delivered is part of their
  pay; it also waits when the outbox cannot be read (`d7ececa`).
- Fixed after review: the saved cache kept data from queries that had errored, no double steps
  (`3665d25`).
- Tests by agy: 709 pass after the review round, then `sendJobStep`, the refusal cards and the
  logout guard (`5a5d16c`, `058efb7`, `79b640a`); every put the bug back check repeated by hand.

### No sign up in the app (row 16, spec 0013): `21d24de` to `1aba61c`
The co-op now issues every rider's login from admin, so the app's sign up screen is gone.
- The Join screen, the unused Forgot password screen and `userService.signup` are deleted. Log in
  is the main button on the instance page.
- "Forgot password?" says to ask the co-op to set a new password; the login email stays the same.
- A password change in admin signs the phone out (the backend refuses the old session with a 401,
  and the app ends it).
- Tests by agy (`f6b8a25`, `82b9ab0`): 734 pass; every put the bug back check repeated by hand.

### Dispatch stop banner on Home (row 29, spec 0014): `8dc73be` to `e4f2446`
- "Dispatch stopped" or "Dispatch stops soon" with the backend's own sentence, under the header.
  Home reads it when it opens, every minute while it is in front (`af6d39c`), and when the app
  returns to the foreground. It is never saved to the phone, so an old answer cannot show after a
  restart.
- `'STOPPED'` is a reason an offer can end.
- Tests by agy (`b053461`): 750 pass; every put the bug back check repeated by hand.

### A cancelled job still pays, and says what to do with the food (row 32, spec 0015): `1cb5ea0` to `824ed70`
- **A loud alert, once**, on its own channel, whether the app or a push sees the cancellation
  first. Found in the live verify: Android refused the first vibration pattern and the channel had
  no sound; both fixed (`cf2fa88`).
- **A card over Home** with the pay, who cancelled and what to do with the food; after a pickup,
  "Food returned" or "Couldn't return it" with a note. It can be set aside with Later (`96eebae`).
- The earnings day list labels a cancelled job's pay.
- The backend now refuses a rider's own cancel (decision 32.14).
- Tests by agy (`7c581ab`, `6a69208`): 849 pass; every put the bug back check repeated by hand.

### Auto accept rings its own sound; a free Hand back in the first minute (row 71, spec 0020): `df6fd95` to `aef7190`
Needs a native rebuild (a new sound file and notification channel).
- **An automatic accept says so**: the app sends `automatic: true`, and one notification "Order
  accepted automatically: <restaurant>" plays a new rising sound (`res/raw/auto_accept.wav`) on its
  own channel. A tapped accept plays nothing new.
- **Hand back · 42 s** on the job while the co-op's window is open, counted down by the server's
  clock so a wrong phone clock cannot stretch or cut it. A tap asks first ("No cost to you"); on
  success the job leaves Home and its waiting steps are dropped. A refusal shows the server's own
  sentence.
- **During the window** the card shows the drop off area, not the customer's name or full address.
- A 409 or 404 on the dispatched step after an accept (a hand back landed between the two calls)
  counts as done instead of "Error accepting order" (`f36b063`).
- Tests by agy (`5332208`): 1025 pass; 10 checked by hand by putting their bug back. Reviewed by
  Fable (approve with nits, fixed in `ab04175`).

### Two swipes per job, arrival noticed by the app, one stop at a time (row 19, spec 0021): `767f4bd` to `26bf756`
No native rebuild needed. Needs the backend's row 19.
- **Arrival is noticed.** The app compares the fixes it already takes with the restaurant and the
  customer. Within the co-op's radius (and an accuracy of at most max(radius, 30 m)), it records
  the arrival, marked "detected". Nothing new about the rider's position leaves the phone. Every
  job is checked on its own, legs included. An arrival made with no signal waits in the outbox with
  its true time.
- **The free hand back is kept.** An arrival detected during the hand back window is held, kept
  across an app restart. It is sent when the window ends, with the time the rider really arrived.
- **Two swipes.** "Picked up", then "Delivered", always in the same pinned spot below the card.
  A swipe with no arrival on record records a tapped one first. "I'm here" is the manual backup.
  The Mark as delivered screen, its note chips and the Items collected screen are gone.
- **One stop at a time**, in the general shape of the big rider apps. At the restaurant the order
  code (`#k3x9qz`) and "for Maria" lead; at the door the customer's name, address, floor and
  doorbell, with 48 px call, message and navigate icons. Every note (leave at door, the customer's,
  the restaurant's, other riders') fits on one line that opens a sheet by author. Items open a
  sheet with tick boxes that never leave the phone.
- Fixed after review (`15b5ba5`): "picked up HH:MM" showed the restaurant's planned ready time; it
  now shows the rider's own swipe.
- Tests by agy (`54dd3de`, `26bf756`): 1081 pass; 15 checked by hand by putting their bug back.
  Verified on the emulator, every acceptance criterion.

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
- Offer reminders only run while the app is on screen (React Native's timers stop in the
  background). With push on (row 1), the push alert covers a closed or backgrounded app.
- With offer expiry off, a late offer push that arrives after that offer's `OFFER_ENDED` rings
  until answered (the answer gets a 409). Needs `offeredAt` on `OFFER_ENDED`; queued in the
  co-op scope.
- Real push, a token refresh and the server's 2 minute re send are unchecked on a phone until
  the co-op's Firebase project exists (row 1).
- Building for Android needs JDK 17.
