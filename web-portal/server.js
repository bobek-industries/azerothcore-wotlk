const crypto = require("crypto");
const net = require("net");
const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);

const dbConfig = {
  host: process.env.DB_HOST || "ac-database",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password"
};

const authDbName = process.env.AUTH_DB_NAME || "acore_auth";
const charactersDbName = process.env.CHARS_DB_NAME || "acore_characters";
const worldDbName = process.env.WORLD_DB_NAME || "acore_world";

const N = BigInt(
  "0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
);
const G = 7n;

const raceById = {
  1: "Human",
  2: "Orc",
  3: "Dwarf",
  4: "Night Elf",
  5: "Undead",
  6: "Tauren",
  7: "Gnome",
  8: "Troll",
  10: "Blood Elf",
  11: "Draenei"
};

const classById = {
  1: "Warrior",
  2: "Paladin",
  3: "Hunter",
  4: "Rogue",
  5: "Priest",
  6: "Death Knight",
  7: "Shaman",
  8: "Mage",
  9: "Warlock",
  11: "Druid"
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    name: "ac_portal_session",
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12,
      sameSite: "lax"
    }
  })
);

let authPool;
let charsPool;
let worldPool;

function upperLatin(value) {
  return (value || "").trim().toUpperCase();
}

function sha1Buffer(parts) {
  const hash = crypto.createHash("sha1");
  for (const part of parts)
    hash.update(part);
  return hash.digest();
}

function littleEndianBytesToBigInt(buffer) {
  let value = 0n;
  for (let i = 0; i < buffer.length; i += 1)
    value += BigInt(buffer[i]) << (8n * BigInt(i));
  return value;
}

function bigIntToLittleEndian(value, length) {
  const out = Buffer.alloc(length);
  let remaining = value;

  for (let i = 0; i < length; i += 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return out;
}

function modPow(base, exponent, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exponent;

  while (e > 0n) {
    if ((e & 1n) === 1n)
      result = (result * b) % mod;

    b = (b * b) % mod;
    e >>= 1n;
  }

  return result;
}

function calculateVerifier(usernameUpper, passwordUpper, saltBuffer) {
  const accountHash = sha1Buffer([usernameUpper, ":", passwordUpper]);
  const xHash = sha1Buffer([saltBuffer, accountHash]);
  const x = littleEndianBytesToBigInt(xHash);
  const verifier = modPow(G, x, N);
  return bigIntToLittleEndian(verifier, 32);
}

function normalizeCredentials(usernameRaw, passwordRaw) {
  const username = upperLatin(usernameRaw);
  const password = upperLatin(passwordRaw);

  return { username, password };
}

function credentialsValidation(username, password) {
  if (!username || !password)
    return "Username and password are required.";

  if (username.length > 16)
    return "Username can have at most 16 characters.";

  if (password.length > 16)
    return "Password can have at most 16 characters.";

  return null;
}

function parseAccountInput(rawInput) {
  const value = (rawInput || "").trim();

  if (!value)
    return null;

  if (/^\d+$/.test(value))
    return { by: "id", value: Number(value) };

  return { by: "username", value: upperLatin(value) };
}

function consumeFlash(req) {
  const flash = req.session.flash || null;
  req.session.flash = null;
  return flash;
}

function formatMoney(copper) {
  const value = Number(copper || 0);
  const gold = Math.floor(value / 10000);
  const silver = Math.floor((value % 10000) / 100);
  const bronze = value % 100;
  return `${gold}g ${silver}s ${bronze}c`;
}

function formatSeconds(totalSeconds) {
  const value = Number(totalSeconds || 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (days > 0)
    return `${days}d ${hours}h ${minutes}m`;

  if (hours > 0)
    return `${hours}h ${minutes}m`;

  return `${minutes}m`;
}

function statusFromError(error) {
  return {
    online: false,
    detail: error.code || "offline"
  };
}

function checkTcp(name, host, checkPort, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    let resolved = false;

    const finish = (online, detail) => {
      if (resolved)
        return;

      resolved = true;
      socket.destroy();
      resolve({ name, online, detail });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, "online"));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (error) => finish(false, error.code || "offline"));

    socket.connect(checkPort, host);
  });
}

async function getServerStatus() {
  const [world, auth] = await Promise.all([
    checkTcp("Worldserver", process.env.WORLDSERVER_HOST || "ac-worldserver", 8085),
    checkTcp("Authserver", process.env.AUTHSERVER_HOST || "ac-authserver", 3724)
  ]);

  let database;
  try {
    const conn = await authPool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    database = { name: "Database", online: true, detail: "online" };
  } catch (error) {
    database = { name: "Database", ...statusFromError(error) };
  }

  return [world, auth, database];
}

async function loadCharactersByAccount(accountId) {
  const [rows] = await charsPool.query(
    `SELECT guid, name, race, class, level, online
     FROM characters
     WHERE account = ? AND deleteDate IS NULL
     ORDER BY level DESC, name ASC`,
    [accountId]
  );

  return rows.map((row) => ({
    guid: row.guid,
    name: row.name,
    level: row.level,
    online: row.online === 1,
    race: raceById[row.race] || `Race ${row.race}`,
    class: classById[row.class] || `Class ${row.class}`
  }));
}

async function getAccountGmLevel(accountId) {
  const [rows] = await authPool.query(
    `SELECT COALESCE(MAX(gmlevel), 0) AS gmlevel
     FROM account_access
     WHERE id = ?`,
    [accountId]
  );

  return Number(rows[0]?.gmlevel || 0);
}

async function findAccountByInput(accountInput) {
  if (!accountInput)
    return null;

  if (accountInput.by === "id") {
    const [rows] = await authPool.query(
      "SELECT id, username, locked FROM account WHERE id = ? LIMIT 1",
      [accountInput.value]
    );
    return rows[0] || null;
  }

  const [rows] = await authPool.query(
    "SELECT id, username, locked FROM account WHERE username = ? LIMIT 1",
    [accountInput.value]
  );
  return rows[0] || null;
}

async function requireLogin(req, res, next) {
  if (!req.session.user)
    return res.redirect("/");

  if (typeof req.session.user.gmlevel !== "number") {
    try {
      req.session.user.gmlevel = await getAccountGmLevel(req.session.user.accountId);
    } catch (error) {
      req.session.flash = {
        type: "error",
        message: `Session refresh failed: ${error.code || "db_error"}`
      };
      return res.redirect("/");
    }
  }

  return next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.user)
    return res.redirect("/");

  try {
    const gmlevel = await getAccountGmLevel(req.session.user.accountId);
    req.session.user.gmlevel = gmlevel;

    if (gmlevel < 3) {
      req.session.flash = {
        type: "error",
        message: "Admin panel is available only for administrator accounts."
      };
      return res.redirect("/panel");
    }

    return next();
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Admin authorization failed: ${error.code || "db_error"}`
    };
    return res.redirect("/panel");
  }
}

async function loadCharacterDetail(guid) {
  const [rows] = await charsPool.query(
    `SELECT
       guid,
       account,
       name,
       race,
       class,
       level,
       gender,
       online,
       money,
       totaltime,
       map,
       zone,
       position_x,
       position_y,
       position_z,
       creation_date
     FROM characters
     WHERE guid = ? AND deleteDate IS NULL
     LIMIT 1`,
    [guid]
  );

  if (rows.length === 0)
    return null;

  const character = rows[0];
  let mapName = `Map ${character.map}`;

  try {
    const [mapRows] = await worldPool.query(
      `SELECT MapName_Lang_enUS AS mapName
       FROM map_dbc
       WHERE ID = ?
       LIMIT 1`,
      [character.map]
    );

    if (mapRows.length > 0 && mapRows[0].mapName)
      mapName = mapRows[0].mapName;
  } catch (_error) {
    mapName = `Map ${character.map}`;
  }

  const [summaryRows] = await charsPool.query(
    `SELECT
       COUNT(*) AS inventorySlotsUsed,
       SUM(CASE WHEN ci.bag = 0 AND ci.slot BETWEEN 0 AND 18 THEN 1 ELSE 0 END) AS equippedSlots,
       COUNT(DISTINCT ii.itemEntry) AS uniqueItemEntries,
       COALESCE(SUM(ii.count), 0) AS totalItemCount
     FROM character_inventory ci
     JOIN item_instance ii ON ii.guid = ci.item
     WHERE ci.guid = ?`,
    [guid]
  );

  const [itemsRows] = await charsPool.query(
    `SELECT
       ii.itemEntry,
       COALESCE(it.name, CONCAT('Item ', ii.itemEntry)) AS itemName,
       SUM(ii.count) AS totalCount
     FROM character_inventory ci
     JOIN item_instance ii ON ii.guid = ci.item
     LEFT JOIN ${worldDbName}.item_template it ON it.entry = ii.itemEntry
     WHERE ci.guid = ?
     GROUP BY ii.itemEntry, itemName
     ORDER BY totalCount DESC, ii.itemEntry ASC
     LIMIT 20`,
    [guid]
  );

  return {
    guid: character.guid,
    accountId: character.account,
    name: character.name,
    level: character.level,
    race: raceById[character.race] || `Race ${character.race}`,
    class: classById[character.class] || `Class ${character.class}`,
    gender: Number(character.gender) === 0 ? "Male" : "Female",
    online: character.online === 1,
    money: formatMoney(character.money),
    played: formatSeconds(character.totaltime),
    mapId: character.map,
    mapName,
    zoneId: character.zone,
    position: {
      x: Number(character.position_x || 0).toFixed(2),
      y: Number(character.position_y || 0).toFixed(2),
      z: Number(character.position_z || 0).toFixed(2)
    },
    createdAt: character.creation_date,
    inventorySummary: {
      inventorySlotsUsed: Number(summaryRows[0]?.inventorySlotsUsed || 0),
      equippedSlots: Number(summaryRows[0]?.equippedSlots || 0),
      uniqueItemEntries: Number(summaryRows[0]?.uniqueItemEntries || 0),
      totalItemCount: Number(summaryRows[0]?.totalItemCount || 0)
    },
    topItems: itemsRows.map((item) => ({
      itemEntry: item.itemEntry,
      name: item.itemName,
      count: Number(item.totalCount || 0)
    }))
  };
}

app.get("/", async (req, res) => {
  const status = await getServerStatus();
  const flash = consumeFlash(req);

  res.render("index", {
    status,
    flash,
    user: req.session.user || null
  });
});

app.post("/reset-password", async (req, res) => {
  const { username, password } = normalizeCredentials(
    req.body.username,
    req.body.password
  );

  const validationError = credentialsValidation(username, password);
  if (validationError) {
    req.session.flash = { type: "error", message: validationError };
    return res.redirect("/");
  }

  try {
    const [rows] = await authPool.query(
      "SELECT id, username FROM account WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      req.session.flash = {
        type: "error",
        message: "Account not found."
      };
      return res.redirect("/");
    }

    const account = rows[0];
    const salt = crypto.randomBytes(32);
    const verifier = calculateVerifier(account.username, password, salt);

    await authPool.query(
      "UPDATE account SET salt = ?, verifier = ? WHERE id = ?",
      [salt, verifier, account.id]
    );

    req.session.flash = {
      type: "success",
      message: "Password has been reset. You can log in with the new password."
    };
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Password reset failed: ${error.code || "db_error"}`
    };
  }

  return res.redirect("/");
});

app.post("/register", async (req, res) => {
  const { username, password } = normalizeCredentials(
    req.body.username,
    req.body.password
  );

  const validationError = credentialsValidation(username, password);
  if (validationError) {
    req.session.flash = { type: "error", message: validationError };
    return res.redirect("/");
  }

  try {
    const [existing] = await authPool.query(
      "SELECT id FROM account WHERE username = ? LIMIT 1",
      [username]
    );

    if (existing.length > 0) {
      req.session.flash = {
        type: "error",
        message: "This username already exists."
      };
      return res.redirect("/");
    }

    const salt = crypto.randomBytes(32);
    const verifier = calculateVerifier(username, password, salt);

    await authPool.query(
      `INSERT INTO account (
        username, salt, verifier, expansion, email, reg_mail
      ) VALUES (?, ?, ?, 2, '', '')`,
      [username, salt, verifier]
    );

    req.session.flash = {
      type: "success",
      message: "Account created. You can log in now."
    };
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Registration failed: ${error.code || "db_error"}`
    };
  }

  return res.redirect("/");
});

app.post("/login", async (req, res) => {
  const { username, password } = normalizeCredentials(
    req.body.username,
    req.body.password
  );

  const validationError = credentialsValidation(username, password);
  if (validationError) {
    req.session.flash = { type: "error", message: validationError };
    return res.redirect("/");
  }

  try {
    const [rows] = await authPool.query(
      "SELECT id, username, salt, verifier FROM account WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      req.session.flash = { type: "error", message: "Invalid login." };
      return res.redirect("/");
    }

    const account = rows[0];
    const expectedVerifier = calculateVerifier(
      account.username,
      password,
      Buffer.from(account.salt)
    );

    if (!expectedVerifier.equals(Buffer.from(account.verifier))) {
      req.session.flash = { type: "error", message: "Invalid login." };
      return res.redirect("/");
    }

    req.session.user = {
      accountId: account.id,
      username: account.username,
      gmlevel: await getAccountGmLevel(account.id)
    };

    return res.redirect("/panel");
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Login failed: ${error.code || "db_error"}`
    };
    return res.redirect("/");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/panel", async (req, res) => {
  if (!req.session.user)
    return res.redirect("/");

  try {
    req.session.user.gmlevel = await getAccountGmLevel(req.session.user.accountId);
    const characters = await loadCharactersByAccount(req.session.user.accountId);
    return res.render("panel", {
      user: req.session.user,
      characters,
      flash: consumeFlash(req)
    });
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Could not load characters: ${error.code || "db_error"}`
    };
    return res.redirect("/");
  }
});

app.get("/characters/:guid", requireLogin, async (req, res) => {
  const guid = Number(req.params.guid);
  if (!Number.isInteger(guid) || guid <= 0) {
    req.session.flash = { type: "error", message: "Invalid character id." };
    return res.redirect("/panel");
  }

  try {
    const character = await loadCharacterDetail(guid);
    if (!character) {
      req.session.flash = { type: "error", message: "Character not found." };
      return res.redirect("/panel");
    }

    const isAdmin = req.session.user.gmlevel >= 3;
    if (!isAdmin && character.accountId !== req.session.user.accountId) {
      req.session.flash = {
        type: "error",
        message: "You do not have access to this character."
      };
      return res.redirect("/panel");
    }

    return res.render("character", {
      user: req.session.user,
      character,
      flash: consumeFlash(req),
      isAdmin
    });
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Character load failed: ${error.code || "db_error"}`
    };
    return res.redirect("/panel");
  }
});

app.get("/admin", requireAdmin, async (req, res) => {
  const rawQuery = (req.query.q || "").toString().trim();
  const accountInput = parseAccountInput(rawQuery);

  let lookedUpAccounts = [];
  if (accountInput) {
    if (accountInput.by === "id") {
      const [rows] = await authPool.query(
        `SELECT
           a.id,
           a.username,
           a.locked,
           a.online,
           a.joindate,
           a.last_login,
           COALESCE(MAX(aa.gmlevel), 0) AS gmlevel,
           MAX(CASE WHEN ab.active = 1 THEN 1 ELSE 0 END) AS activeBan
         FROM account a
         LEFT JOIN account_access aa ON aa.id = a.id
         LEFT JOIN account_banned ab ON ab.id = a.id
         WHERE a.id = ?
         GROUP BY a.id, a.username, a.locked, a.online, a.joindate, a.last_login
         LIMIT 25`,
        [accountInput.value]
      );
      lookedUpAccounts = rows;
    } else {
      const [rows] = await authPool.query(
        `SELECT
           a.id,
           a.username,
           a.locked,
           a.online,
           a.joindate,
           a.last_login,
           COALESCE(MAX(aa.gmlevel), 0) AS gmlevel,
           MAX(CASE WHEN ab.active = 1 THEN 1 ELSE 0 END) AS activeBan
         FROM account a
         LEFT JOIN account_access aa ON aa.id = a.id
         LEFT JOIN account_banned ab ON ab.id = a.id
         WHERE a.username LIKE ?
         GROUP BY a.id, a.username, a.locked, a.online, a.joindate, a.last_login
         ORDER BY a.id DESC
         LIMIT 25`,
        [`%${accountInput.value}%`]
      );
      lookedUpAccounts = rows;
    }
  }

  const [onlinePlayers] = await charsPool.query(
    `SELECT
       c.guid,
       c.name,
       c.level,
       c.race,
       c.class,
       c.account,
       c.map,
       c.zone,
       a.username AS accountName
     FROM characters c
     JOIN ${authDbName}.account a ON a.id = c.account
     WHERE c.online = 1
     ORDER BY c.level DESC, c.name ASC
     LIMIT 50`
  );

  const [auditRows] = await authPool.query(
    `SELECT id, ts, actor_user, action, target_user, details
     FROM portal_audit_log
     ORDER BY ts DESC
     LIMIT 50`
  );

  return res.render("admin", {
    user: req.session.user,
    flash: consumeFlash(req),
    searchQuery: rawQuery,
    lookedUpAccounts,
    auditLogs: auditRows,
    onlinePlayers: onlinePlayers.map((player) => ({
      guid: player.guid,
      name: player.name,
      level: player.level,
      race: raceById[player.race] || `Race ${player.race}`,
      class: classById[player.class] || `Class ${player.class}`,
      account: player.account,
      accountName: player.accountName,
      map: player.map,
      zone: player.zone
    }))
  });
});

app.post("/admin/set-gm-level", requireAdmin, async (req, res) => {
  const account = await findAccountByInput(parseAccountInput(req.body.account));
  const gmlevel = Number(req.body.gmlevel);
  const realmId = Number(req.body.realmId ?? -1);

  if (!account) {
    req.session.flash = { type: "error", message: "Account not found." };
    return res.redirect("/admin");
  }

  if (!Number.isInteger(gmlevel) || gmlevel < 0 || gmlevel > 3) {
    req.session.flash = { type: "error", message: "GM level must be between 0 and 3." };
    return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
  }

  if (!Number.isInteger(realmId)) {
    req.session.flash = { type: "error", message: "Realm id must be an integer." };
    return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
  }

  await authPool.query(
    `INSERT INTO account_access (id, gmlevel, RealmID, comment)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE gmlevel = VALUES(gmlevel), comment = VALUES(comment)`,
    [account.id, gmlevel, realmId, `Set via portal by ${req.session.user.username}`]
  );

  await writeAudit(
    req.session.user.accountId,
    req.session.user.username,
    "set-gm-level",
    account.id,
    account.username,
    `gmlevel=${gmlevel} realmId=${realmId}`
  );

  req.session.flash = {
    type: "success",
    message: `GM level for ${account.username} set to ${gmlevel} (realm ${realmId}).`
  };
  return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
});

app.post("/admin/ban", requireAdmin, async (req, res) => {
  const account = await findAccountByInput(parseAccountInput(req.body.account));
  const minutes = Number(req.body.minutes);
  const reason = (req.body.reason || "Portal moderation").toString().trim() || "Portal moderation";

  if (!account) {
    req.session.flash = { type: "error", message: "Account not found." };
    return res.redirect("/admin");
  }

  if (!Number.isInteger(minutes) || minutes < 1) {
    req.session.flash = { type: "error", message: "Ban minutes must be 1 or higher." };
    return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const unbanAt = now + (minutes * 60);

  await authPool.query(
    `INSERT INTO account_banned (id, bandate, unbandate, bannedby, banreason, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [account.id, now, unbanAt, req.session.user.username, reason]
  );

  await writeAudit(
    req.session.user.accountId,
    req.session.user.username,
    "ban",
    account.id,
    account.username,
    `minutes=${minutes} reason=${reason}`
  );

  req.session.flash = {
    type: "success",
    message: `${account.username} banned for ${minutes} minutes.`
  };
  return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
});

app.post("/admin/unban", requireAdmin, async (req, res) => {
  const account = await findAccountByInput(parseAccountInput(req.body.account));
  if (!account) {
    req.session.flash = { type: "error", message: "Account not found." };
    return res.redirect("/admin");
  }

  await authPool.query(
    "UPDATE account_banned SET active = 0 WHERE id = ? AND active = 1",
    [account.id]
  );

  await writeAudit(
    req.session.user.accountId,
    req.session.user.username,
    "unban",
    account.id,
    account.username,
    null
  );

  req.session.flash = {
    type: "success",
    message: `All active bans removed for ${account.username}.`
  };
  return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
});

app.post("/admin/toggle-lock", requireAdmin, async (req, res) => {
  const account = await findAccountByInput(parseAccountInput(req.body.account));
  const lockState = req.body.locked === "1" ? 1 : 0;

  if (!account) {
    req.session.flash = { type: "error", message: "Account not found." };
    return res.redirect("/admin");
  }

  await authPool.query(
    "UPDATE account SET locked = ? WHERE id = ?",
    [lockState, account.id]
  );

  await writeAudit(
    req.session.user.accountId,
    req.session.user.username,
    lockState ? "lock" : "unlock",
    account.id,
    account.username,
    null
  );

  req.session.flash = {
    type: "success",
    message: `${account.username} is now ${lockState ? "locked" : "unlocked"}.`
  };
  return res.redirect(`/admin?q=${encodeURIComponent(account.username)}`);
});

async function createAuditTable() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS portal_audit_log (
      id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      ts         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_id   INT UNSIGNED    NOT NULL,
      actor_user VARCHAR(32)     NOT NULL,
      action     VARCHAR(64)     NOT NULL,
      target_id  INT UNSIGNED    DEFAULT NULL,
      target_user VARCHAR(32)    DEFAULT NULL,
      details    TEXT            DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_ts (ts),
      KEY idx_actor (actor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function writeAudit(actorId, actorUser, action, targetId, targetUser, details) {
  try {
    await authPool.query(
      `INSERT INTO portal_audit_log (actor_id, actor_user, action, target_id, target_user, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId, actorUser, action, targetId || null, targetUser || null, details || null]
    );
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function start() {
  authPool = mysql.createPool({
    ...dbConfig,
    database: authDbName,
    waitForConnections: true,
    connectionLimit: 8,
    namedPlaceholders: false
  });

  charsPool = mysql.createPool({
    ...dbConfig,
    database: charactersDbName,
    waitForConnections: true,
    connectionLimit: 8,
    namedPlaceholders: false
  });

  worldPool = mysql.createPool({
    ...dbConfig,
    database: worldDbName,
    waitForConnections: true,
    connectionLimit: 6,
    namedPlaceholders: false
  });

  await createAuditTable();

  app.listen(port, () => {
    console.log(`AzerothCore web portal running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start web portal:", error);
  process.exit(1);
});
