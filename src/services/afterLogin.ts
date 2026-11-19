// Row 17 (spec 0039, AC-15): set when this run of the app has just logged a
// rider in (a login or a reset by email), so the Permissions screen shows once
// right after it, and never on a restart while logged in. Memory only: nothing
// is stored about whether the rider granted anything (value 5).
let justLoggedIn = false;
// The same moment, read by the Offline on return check (useOfflineWithoutLocation): right after a
// login it skips its first run, so no "Location is off" alert covers the Permissions screen before the
// rider could tap Allow, and a login on a second phone never takes the rider Offline (review of
// 2026-11-19). Coming back to the front still checks.
let skipFirstLocationCheck = false;

export const markJustLoggedIn = (): void => {
  justLoggedIn = true;
  skipFirstLocationCheck = true;
};

// Reads the flag and clears it, so it is used at most once per login.
export const takeJustLoggedIn = (): boolean => {
  const value = justLoggedIn;
  justLoggedIn = false;
  return value;
};

// Reads the second flag and clears it, as takeJustLoggedIn does for the first.
export const takeSkipFirstLocationCheck = (): boolean => {
  const value = skipFirstLocationCheck;
  skipFirstLocationCheck = false;
  return value;
};
