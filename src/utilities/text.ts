// Built once at module load rather than on every call — this function runs on every keystroke.
// Each repeated group starts with a REQUIRED separator ([.-]), so there is only one way to
// split any given address. That is what keeps a failing match linear-time: the old pattern
// made the separator optional ([\.-]?), which let the engine try exponentially many splits of
// the same run of characters before reporting failure, and crashed Hermes on the login screen.
const EMAIL_PATTERN = /^\w+(?:[.-]\w+)*@\w+(?:[.-]\w+)*\.\w{2,}$/;

export const validateEmail = (email: string): boolean => {
  // `.test` already returns a boolean, so the old `!== false` comparison did nothing.
  return EMAIL_PATTERN.test(email);
};
