// OneSignal's web push service worker, imported from their CDN as their
// integration requires. The page SDK is already loaded from the same CDN at
// runtime (react-onesignal injects OneSignalSDK.page.js), so adopting
// OneSignal for web push means trusting cdn.onesignal.com either way — this
// file does not widen the set of parties trusted, though it does give that
// code a persistent, fetch-intercepting context at the origin root.
//
// Self-hosting a copy was considered and rejected: it pins a snapshot of a
// worker whose service ships breaking changes, and a stale worker fails as
// silently dropped notifications. Revisit if OneSignal publishes SRI digests
// or immutable versioned worker URLs.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
