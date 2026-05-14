#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-ac-database}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-password}"

AUTH_DB="${AUTH_DB:-acore_auth}"
BASE_WORLD_DB="${BASE_WORLD_DB:-acore_world}"
BASE_CHAR_DB="${BASE_CHAR_DB:-acore_characters}"

PVP_WORLD_DB="${PVP_WORLD_DB:-acore_world_pvp}"
PVP_CHAR_DB="${PVP_CHAR_DB:-acore_characters_pvp}"
PVE_WORLD_DB="${PVE_WORLD_DB:-acore_world_pve}"
PVE_CHAR_DB="${PVE_CHAR_DB:-acore_characters_pve}"

REALM_EXTERNAL_ADDRESS="${REALM_EXTERNAL_ADDRESS:-wow-wotlk.bobek-industries.org}"
REALM_LOCAL_ADDRESS="${REALM_LOCAL_ADDRESS:-127.0.0.1}"
REALM_LOCAL_SUBNET_MASK="${REALM_LOCAL_SUBNET_MASK:-255.255.255.0}"

MYSQL=(mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" --default-character-set=utf8mb4)
MYSQLDUMP=(mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" --set-gtid-purged=OFF --routines --events --triggers --single-transaction)

sql() {
    "${MYSQL[@]}" -e "$1"
}

has_any_tables() {
  local db_name="$1"
    local count

  count=$("${MYSQL[@]}" -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db_name}';")
    [[ "${count}" != "0" ]]
}

clone_db_if_empty() {
    local src_db="$1"
    local dst_db="$2"

    sql "CREATE DATABASE IF NOT EXISTS ${dst_db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

  if has_any_tables "${dst_db}"; then
        echo "[realms-init] ${dst_db} already initialized, skipping clone"
        return
    fi

    echo "[realms-init] cloning ${src_db} -> ${dst_db}"
    "${MYSQLDUMP[@]}" "${src_db}" | "${MYSQL[@]}" "${dst_db}"
}

  seed_tutorial_flags() {
    local char_db="$1"

    echo "[realms-init] seeding tutorial flags in ${char_db}"
    sql "
  INSERT INTO ${char_db}.account_tutorial
    (accountId, tut0, tut1, tut2, tut3, tut4, tut5, tut6, tut7)
  SELECT
    a.id,
    4294967295,
    4294967295,
    4294967295,
    4294967295,
    4294967295,
    4294967295,
    4294967295,
    4294967295
  FROM ${AUTH_DB}.account a
  ON DUPLICATE KEY UPDATE
    tut0 = VALUES(tut0),
    tut1 = VALUES(tut1),
    tut2 = VALUES(tut2),
    tut3 = VALUES(tut3),
    tut4 = VALUES(tut4),
    tut5 = VALUES(tut5),
    tut6 = VALUES(tut6),
    tut7 = VALUES(tut7);
  "
  }

echo "[realms-init] ensuring realm databases exist"
clone_db_if_empty "${BASE_WORLD_DB}" "${PVP_WORLD_DB}"
clone_db_if_empty "${BASE_CHAR_DB}" "${PVP_CHAR_DB}"
clone_db_if_empty "${BASE_WORLD_DB}" "${PVE_WORLD_DB}"
clone_db_if_empty "${BASE_CHAR_DB}" "${PVE_CHAR_DB}"
seed_tutorial_flags "${PVP_CHAR_DB}"
seed_tutorial_flags "${PVE_CHAR_DB}"

echo "[realms-init] upserting realmlist entries"
sql "
INSERT INTO ${AUTH_DB}.realmlist
  (id, name, address, localAddress, localSubnetMask, port, icon, flag, timezone, allowedSecurityLevel, population, gamebuild)
VALUES
  (2, 'Instant 80 PvP', '${REALM_EXTERNAL_ADDRESS}', '${REALM_LOCAL_ADDRESS}', '${REALM_LOCAL_SUBNET_MASK}', 8086, 0, 0, 1, 0, 0, 12340),
  (3, 'Instant 80 PvE', '${REALM_EXTERNAL_ADDRESS}', '${REALM_LOCAL_ADDRESS}', '${REALM_LOCAL_SUBNET_MASK}', 8087, 0, 0, 1, 0, 0, 12340)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  address = VALUES(address),
  localAddress = VALUES(localAddress),
  localSubnetMask = VALUES(localSubnetMask),
  port = VALUES(port),
  icon = VALUES(icon),
  flag = VALUES(flag),
  timezone = VALUES(timezone),
  allowedSecurityLevel = VALUES(allowedSecurityLevel),
  population = VALUES(population),
  gamebuild = VALUES(gamebuild);
"

echo "[realms-init] complete"
