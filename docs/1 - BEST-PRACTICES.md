# Best practices — a personal app that also ships to the public

You're building for one user (you) but distributing to many. The guiding principle:
**build for yourself, but design and secure it as if strangers depend on it** — because
once it's in a store, they might. These are the practices that matter for exactly this case.

## 1. Privacy & data
- **Local-first stays the default.** Everything on-device (localForage) with JSON export as backup. Anything that leaves the device must be explicit, disclosed, and opt-in — never silent.
- **Bring-your-own-key for AI.** The user's provider key is *their* secret. Store it only on their device, forward it without logging, and never persist it server-side. See D1 in [ROADMAP-V2.md](ROADMAP-V2.md).
- **Per-user isolation.** If accounts/sync arrive, one user must never be able to read another's data. Managed auth + row-level security (Supabase) handles this for you.
- **A privacy policy is required by both stores**, even for a local app. Keep it truthful and specific about the AI calls.

## 2. Secrets & security
- **No secret ever ships in the client.** `VITE_*` vars are baked into public JS. Keys live server-side (managed) or on-device (BYO), never in the bundle or git.
- **`.gitignore` already blocks** `.env`, `*.keystore`, `key.properties`. Keep it that way.
- **The Android keystore is your permanent identity.** Create it once, back it up in two places, never commit it. Losing it means you can't update your own published app.
- **Lock the proxy down** before public launch: restrict CORS to your origin, add a rate limit, and consider a lightweight shared-secret so it can't be used as a free relay.
- Run a **security pass before each release** (the `/security-review` skill) — especially any change that touches keys, the proxy, auth, or storage.

## 3. Versioning & releases
- **Semantic versioning** (`MAJOR.MINOR.PATCH`) in `package.json`, mirrored to Android `versionName`, with an always-incrementing integer `versionCode`. iOS uses `CFBundleShortVersionString` + `CFBundleVersion`.
- **Tag every release** in git (`v1.0.0`) and keep a short `CHANGELOG.md`. Tags are what CI builds from.
- **One change-set = one branch = one reviewed commit range.** Don't pile unrelated fixes into one commit.

## 4. Releasing & updates
- **PWA/web updates are instant** (the service worker auto-updates). **Native store updates always wait on review** — hours to a day+. Plan features so urgent fixes can ride the web layer.
- **Automate builds with CI** (GitHub Actions) so a tagged release produces the web build + Android AAB reproducibly, not from your laptop by hand.
- `fastlane` can push builds to Play/App Store, but store *review* is out of your control — never promise users an exact update time.

## 5. Quality without a big test suite
- This app has no automated tests yet; **verify by running it** (`npm run dev`, and install the APK) after meaningful changes. The `/verify` and `/run` skills do this methodically.
- Keep the AI **optional and fail-soft**: every AI action already degrades to an error message and the app keeps working. Preserve that.
- Consider adding lightweight **Prettier + ESLint** for consistency once the structure settles (not urgent for a solo codebase).

## 6. Cost control
- **BYO-key pushes AI cost to the user** — the right default for a public app you don't want to subsidize.
- If you ever offer managed keys, add hard **rate limits and a monthly cap** per user, or a single abusive caller can run up your bill.

## 7. Reach & polish (cheap wins)
- The app is named **Ambitions** (Spanish for "time") — plan for **i18n** early (English + Spanish) rather than retrofitting; it roughly doubles your audience.
- **Accessibility basics**: sufficient contrast, tap targets ≥ 44px, labels on icon-only buttons. Easy now, painful later.
- Real **app icons + a splash screen** before any store listing — it's the first thing reviewers and users judge.

## 8. Maintainability
- Keep [../CLAUDE.md](../CLAUDE.md) current — it's what any AI agent (me included) reads first.
- Keep architecture decisions in `docs/` (like this folder) so the "why" survives.
