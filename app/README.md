# Gold × Arcade app (Expo Go)

Expo + expo-router + TypeScript. Talks to the local Firebase emulators (project `demo-storefront`) only.

```
npm install
npx expo start --ios          # Simulator reaches the Mac at 127.0.0.1 (a real phone can't: the emulators listen on 127.0.0.1 only)
npx tsc --noEmit
```

## Routes (`app/`, each file re-exports `src/screens/<Screen>.tsx`)

| Path | Screen |
|---|---|
| `/` | S1Login (`(unauth)/index`) |
| `/onboarding` | S2Onboarding |
| `/brand` | S3BrandInputs (creator) |
| `/style` | S4StyleProgress (creator) |
| `/creators` | S5CreatorSearch (fan) |
| `/suggestions?creatorId=` | S6Suggestions |
| `/product/[itemId]` | S7Product |
| `/marketplace?mine=1` | S8Marketplace (works signed out) |
| `/checkout/[itemId]` | S9Checkout |

`(auth)/_layout` is `S0Nav` (the shell). `(unauth)` = S1, S2 (before the shell appears).

## Shared code

- `src/services/api.ts`: `api.*` for every brief §2.4 endpoint; throws `ApiError {status, code, message}`.
- `src/services/firebase.ts`: `signIn()` (anonymous), `signOut()`, `idToken()`, auth emulator on :9099.
- `src/store/session.ts`: `useSession()`, `setSession({uid, role, creatorId})`, `clearSession()`.
- `src/hooks/usePoll.ts`: `usePoll(fetcher, ms, active)`.
- `src/lib/validators.ts`: `isHex`, `isInstagramHandle`, `slug`, `base64Bytes`, limits.
- `src/theme.ts`, `src/components/ui.tsx`: design tokens and UI kit.
