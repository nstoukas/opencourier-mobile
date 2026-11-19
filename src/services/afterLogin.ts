// Row 17 (spec 0039, AC-15): set when this run of the app has just logged a
// rider in (a login or a reset by email), so the Permissions screen shows once
// right after it, and never on a restart while logged in. Memory only: nothing
// is stored about whether the rider granted anything (value 5).
let justLoggedIn = false;

export const markJustLoggedIn = (): void => {
  justLoggedIn = true;
};

// Reads the flag and clears it, so it is used at most once per login.
export const takeJustLoggedIn = (): boolean => {
  const value = justLoggedIn;
  justLoggedIn = false;
  return value;
};
