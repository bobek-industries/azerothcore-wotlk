# AzerothCore Web Portal

Simple player portal for AzerothCore with:

- Multi-realm dashboard (base, PvP, PvE) with realm cards and status
- Register form (username + password only)
- Login
- Password reset flow (username + new password)
- User panel with realm-aware character browsing
- Character detail page (money, played time, map/location, inventory summary)
- GM/Admin panel with realm filters (account lookup, online players, moderation)

## Run with Docker Compose

From repository root:

```bash
docker compose up -d --build ac-web-portal
```

Open:

- `http://localhost:8080` (or your `DOCKER_WEB_EXTERNAL_PORT`)

## Environment variables

Configured from compose environment and `web-portal/config/portal.config.json`:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
- `AUTH_DB_NAME` (default: `acore_auth`)
- `DEFAULT_REALM_SLUG` (optional; default: first configured realm)
- `SESSION_SECRET`

Realm config keys (recommended via JSON config):

- `realms[].slug`
- `realms[].name`
- `realms[].description`
- `realms[].badge`
- `realms[].charsDb`
- `realms[].worldDb`
- `realms[].worldHost`
- `realms[].worldPort`

## Notes

- Account credentials are normalized to uppercase, matching AzerothCore account behavior.
- Registration uses AzerothCore SRP6-compatible salt+verifier creation.
- Legacy routes (`/panel`, `/characters/:guid`) are preserved as redirects to the active realm routes.
