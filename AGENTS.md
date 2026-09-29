# opencourier-mobile

## Overview

The courier app: React Native 0.74, React Navigation, TanStack Query, Firebase messaging,
react-native-maps. It uses the backend's `courier` API.

**Read the workspace rulebook first: [`../AGENTS.md`](../AGENTS.md).** This repo sits inside the co-op workspace, and that file binds it: co-op values, locked decisions, domain language, boundaries, and the `aiflow.sh` pipeline every change goes through. Tools that stop at this repo's git root will not find it on their own. This file only adds what is specific to this component.

## Key files

| File | Owns |
|---|---|
| `src/screens/`, `src/navigation/` | Screens and routing |
| `src/services/`, `src/hooks/` | API calls and data hooks |
| `src/utilities/config.ts` | Reads `API_URL` from `.env` via `@env` |

## Commands

Yarn 4 via Corepack (never 3.6.4). Android needs JDK 17 and the `adb reverse` wiring;
the workspace rulebook has the setup, and `../devup.sh mobile` automates it.

## Conventions

- Tests are `*.test.ts(x)` beside the code. Prefer hooks, services and pure utilities:
  rendering the whole App needs native mocks that don't exist yet.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
