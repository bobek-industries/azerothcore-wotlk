# AzerothCore Web Portal

Simple player portal for AzerothCore with:

- Dashboard server status (worldserver, authserver, database)
- Register form (username + password only)
- Login
- User panel with characters linked to logged-in account

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
- `AUTHSERVER_HOST` (default: `ac-authserver`)
- `WORLDSERVER_HOST` (default: `ac-worldserver`)
- `SESSION_SECRET`

## Notes

- Account credentials are normalized to uppercase, matching AzerothCore account behavior.
- Registration uses AzerothCore SRP6-compatible salt+verifier creation.
- This is a minimal first version and does not include email verification or password reset.
