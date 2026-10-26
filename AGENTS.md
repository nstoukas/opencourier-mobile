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
| `src/utilities/offerCountdowns.ts`, `src/utilities/offerClock.ts` | Offer timing: counts down to the server's `offerExpiresAt`, corrected by `serverNow`; the phone never answers for the rider at zero (spec 0002) |

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

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
