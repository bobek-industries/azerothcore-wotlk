# AzerothCore Web Portal

Simple player portal for AzerothCore with:

- Dashboard server status (worldserver, authserver, database)
- Register form (username + password only)
- Login
- Password reset flow (username + new password)
- User panel with characters linked to logged-in account
- Character detail page (money, played time, map/location, inventory summary)
- GM/Admin panel (account lookup, online players, moderation actions)

## Run with Docker Compose

From repository root:

```bash
docker compose up -d --build ac-web-portal
```

Open:

- `http://localhost:8080` (or your `DOCKER_WEB_EXTERNAL_PORT`)

## Environment variables

Configured from `docker-compose.override.yml`:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
- `AUTH_DB_NAME` (default: `acore_auth`)
- `CHARS_DB_NAME` (default: `acore_characters`)
- `WORLD_DB_NAME` (default: `acore_world`)
- `AUTHSERVER_HOST` (default: `ac-authserver`)
- `WORLDSERVER_HOST` (default: `ac-worldserver`)
- `SESSION_SECRET`

## Notes

- Account credentials are normalized to uppercase, matching AzerothCore account behavior.
- Registration uses AzerothCore SRP6-compatible salt+verifier creation.
- Password reset in this first version is intentionally simple and does not use email verification tokens.
