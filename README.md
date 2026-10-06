# Ambitions

A local-first weekly time-planner and monthly reflection tool. Web + installable PWA + Android/iOS via Capacitor. All data lives on-device; the JSON export is the backup. AI features call Claude through a serverless proxy and only work online.

## Prerequisites
- Node 18+
- Android Studio (for Android builds)
- A Mac with Xcode + Apple Developer account (only for iOS, later)

## Develop (web)
```bash
npm install
cp .env.example .env     # adjust VITE_AI_PROXY_URL if needed
npm run dev
```

## Icons
Add these PNGs under `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
(Optional: `npm i -D @capacitor/assets` then `npx @capacitor/assets generate` to produce app + PWA icons from one source image.)

## AI proxy (required before ANY distribution)
The Anthropic key must never ship inside the app.
1. Deploy `api/ai.js` as a serverless function (Vercel `/api`, or adapt to a Cloudflare Worker).
2. Set `ANTHROPIC_API_KEY` in the host's environment.
3. Point `VITE_AI_PROXY_URL` at that endpoint (default `/api/ai` if web + proxy deploy together).
4. Lock the proxy's CORS to your app origin, and consider a shared-secret header / rate limit so it can't be abused.

## Android (APK on your own phone — free, no Mac)
```bash
npm run build
npx cap add android      # first time only (uses capacitor.config.json)
npx cap sync
npx cap open android     # opens Android Studio
```
In Android Studio: plug in your phone (USB debugging on) and press Run to install directly, or Build > Build APK(s) for a debug `.apk`.

## Signed release + sharing (sideload)
1. Create a keystore ONCE and back it up safely (lose it = you can't update your own app):
   ```bash
   keytool -genkey -v -keystore ambitions.keystore -alias ambitions -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure signing in `android/app/build.gradle` (release `signingConfig`).
3. Build a signed APK (`assembleRelease`) to sideload, or an AAB for Play (`bundleRelease`).

## Google Play
- One-time ~$25 developer registration.
- Upload the **AAB** (not APK). Provide listing, screenshots, content rating, **data-safety form** ("no data leaves the device" — true here), and a **privacy policy URL** (required even for local apps).

## Apple App Store (later)
- Needs a Mac + Xcode + Apple Developer Program (~$99/year).
  ```bash
  npm i @capacitor/ios
  npx cap add ios
  npx cap open ios      # archive + upload via Xcode / TestFlight
  ```

## Permanent decisions (set these early)
- **App ID** (`capacitor.config.json` → `appId`): hard to change after publishing.
- **Android keystore**: your app's permanent signing identity — guard and back it up.
- **AI proxy**: keep the key server-side from day one so dev and prod are identical.
- **Privacy policy**: trivial here (everything's local) but required by both stores.

## Data & privacy
Default is fully local (IndexedDB via localForage) + your JSON exports. Nothing is sent anywhere except AI calls, and only when online. Any future cross-user analytics would require data to leave the device — make it explicit, disclosed, and opt-in; never a silent default.

## Stack
Vite · React · Tailwind · recharts · lucide-react · localForage · vite-plugin-pwa · Capacitor.
