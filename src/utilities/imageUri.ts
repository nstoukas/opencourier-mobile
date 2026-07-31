// `uri is string` is a TypeScript "type predicate": when this returns true, the compiler
// knows the value is a real string, so callers don't need a cast.
export const hasImageUri = (uri?: string | null): uri is string =>
  typeof uri === 'string' && uri.trim().length > 0;
