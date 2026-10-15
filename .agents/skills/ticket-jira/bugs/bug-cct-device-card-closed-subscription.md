# Bug: CCT device card shows "Closed" although device has an active subscription

- **Jira**: PRTSUP-1046 — "[PROD]-[KIPPY]: SUBSCRIPTION ISSUE" (created 2026-10-13, priority Highest)
- **User/device**: Gianni Aragone (giannia70@alice.it), user `361ce5f8-c139-4121-8900-5e805d976a4b`, device `AJRK7H6` / productId `11f0b516-49ac-4359-9153-33bda8e3f065`, pet `17d25376-9eb9-4e1b-a7d6-f29e15a9d8b4`, KIPPY EVO, Italy.
- **Incident window**: reported 2026-10-13; subscription events 2026-06-17/18; device offline since ~2026-10-05.

## Observed behaviour
Support reports the device status shows **"Closed"** and the system "recognizes only" the closed/refunded subscription `KPY-HP-54873`, although `KPY-HP-145724` (2Y) is active and associated to the device.

## MongoDB / prod state (from `DatamarsCctCoreProd-getDevice` + `getSubscriptions` Lambda logs, Oct 11–14)
- `petlinkGps.subscriptionId` = `2baf1e68-50ba-4ea2-bcfe-de9000a884db` → `KPY-HP-145724`, **status active**, termEnd 2028-06-17. `hasSubscriptionActive: true`. Link is **correct**.
- `lastPurchasedSubscription` (latest by `createdAt`) = `ed69ccd6-...` → `KPY-HP-54873`, status **closed**, refunded (credit note `CN-DS-225455`, cctUser `migration`, 2026-06-18).
- `KPY-HP-54873` has **two** Mongo docs: `625bbe9f` (term 2025→2026) and `ed69ccd6` (renewal term 2026→2027, created 2026-06-17T22:03 — 3 min AFTER the new sub, then refunded).

## Timeline
1. 2025-06-17: `KPY-HP-54873` 1Y created.
2. 2026-06-17 22:00: user buys `KPY-HP-145724` (2Y, invoice DS320132 €99.99) → `linkToDevice` sets `petlinkGps.subscriptionId = 2baf1e68`.
3. 2026-06-17 22:03: old sub auto-renews too (invoice DS319949 €69.99); `handlerNewSubscription` creates a NEW doc `ed69ccd6` (old doc `625bbe9f` likely already `closed` → `$ne: closed` filter misses it → duplicate doc).
4. 2026-06-18: renewal refunded by `migration` user → both `KPY-HP-54873` docs → `closed`.
5. `subscriptionId` later re-linked to `2baf1e68` (subscription_activated/started events) → backend state correct today.

## Root cause (display bug — NEW env, CCT frontend)
`petlink-everywhere-cct/src/hooks/useGetCurrentDeviceSubscription.ts`: picks `subscriptions[0]` (list sorted `creationDate DESC` by `DatamarsCctCoreProd-getSubscriptions`) and only falls back to a non-cancelled sub when `items[0].status === 'cancelled'`. **`closed` is not handled** → `CardDeviceSubscription` selects `ed69ccd6` (closed, created 22:03 > 22:00) and renders the "Closed" badge (`subscription_status_closed`) even though the device is linked to the active `2baf1e68`.

Same "latest created" pick in `cct-core getDevice` → `lastPurchasedSubscription*` shows the refunded doc.

## Why the customer can't use the device (uncertain)
- Backend/app gating uses `petlinkGps.subscriptionId` + `currentTermEnd` → active until 2028; no Mongo-side block found.
- `lastConnectionDate: 2026-10-05`, `simStatus: live`; no Sentinel log lines for `AJRK7H6` in the last ~1.5 days → device is simply not connecting (likely HW/SIM/connectivity issue, unverified — Sentinel queries timed out repeatedly).

## Code involved
- `all-repo/new-env/petlink-everywhere-cct/src/hooks/useGetCurrentDeviceSubscription.ts` — fallback only on `cancelled`, missing `closed`.
- `all-repo/new-env/petlink-everywhere-cct/src/components/common/CardDeviceSubscription.tsx` — renders selected sub status.
- `all-repo/new-env/petlink-everywhere-cct-core/src/lambda_functions/graphql/query/getSubscriptions/handler.ts` — `creationDate DESC`.
- `all-repo/new-env/petlink-everywhere-core/.../subscriptionsWebhookConsumer/utils.ts` (`handlerNewSubscription`, `linkToDevice`), `subscriptionActivatedHandler.ts`.
- Prod code inspected: `petlink-everywhere-cct` @ `9bcc1e4` (develop); hook logic unchanged since 2026-03-10 (`bbbe8a3`).

## Proposed fix
In `useGetCurrentDeviceSubscription`, extend the fallback trigger from `cancelled` to `[cancelled, closed]` (or: prefer the sub whose `id === device.subscriptionId`). Optionally also de-duplicate by `chargebeeSubscriptionId` keeping the newest doc.

## Remaining uncertainty
- Exact screenshot content (blob attachments unavailable) — "Closed" may be the card badge or the subscriptions list.
- Why `ed69ccd6` was created as a second doc instead of extending `625bbe9f` (needs June logs, out of Loki retention).
- Real user-side device offline cause (Sentinel unreachable via logs).
