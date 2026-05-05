const crypto = require("crypto");
const net = require("net");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);

const dbConfig = {
  host: process.env.DB_HOST || "ac-database",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password"
};

const verificationTokenTtlHours = Number(process.env.MAIL_VERIFY_TTL_HOURS || 24);
const passwordResetTokenTtlMinutes = Number(process.env.MAIL_RESET_TTL_MINUTES || 30);

const authDbName = process.env.AUTH_DB_NAME || "acore_auth";
const charactersDbName = process.env.CHARS_DB_NAME || "acore_characters";
const worldDbName = process.env.WORLD_DB_NAME || "acore_world";

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null)
    return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized))
    return true;
  if (["0", "false", "no", "off"].includes(normalized))
    return false;
  return fallback;
}

function loadPortalConfig() {
  const configPath = process.env.WEB_PORTAL_CONFIG;
  if (!configPath)
    return {};

  try {
    if (!fs.existsSync(configPath))
      return {};

    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load WEB_PORTAL_CONFIG:", error.message);
    return {};
  }
}

const portalConfig = loadPortalConfig();
const configMail = portalConfig.mail || {};

const mailConfig = {
  enabled: parseBoolean(process.env.MAIL_ENABLED, parseBoolean(configMail.enabled, false)),
  host: process.env.MAIL_HOST || configMail.host || "",
  port: Number(process.env.MAIL_PORT || configMail.port || 465),
  secure: parseBoolean(process.env.MAIL_SECURE, parseBoolean(configMail.secure, true)),
  user: process.env.MAIL_USER || configMail.user || "",
  pass: process.env.MAIL_PASS || configMail.pass || "",
  from: process.env.MAIL_FROM || configMail.from || ""
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let mailTransport = null;
if (mailConfig.enabled) {
  if (!mailConfig.host || !mailConfig.user || !mailConfig.pass || !mailConfig.from) {
    console.warn("Mail is enabled but configuration is incomplete. SMTP is disabled.");
  } else {
    mailTransport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
}

const N = BigInt(
  "0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
);
const G = 7n;

const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11]);
const HORDE_RACES    = new Set([2, 5, 6, 8, 10]);

function getCharacterFaction(raceId) {
  if (ALLIANCE_RACES.has(raceId)) return "alliance";
  if (HORDE_RACES.has(raceId))    return "horde";
  return "neutral";
}

const TELEPORT_LOCATIONS = [
  { id: "dalaran",      name: "Dalaran",        faction: "neutral",  mapId: 571, zoneId: 4395, x:  5804.15, y:   624.77, z:  647.77, o: 1.64 },
  { id: "shattrath",    name: "Shattrath",       faction: "neutral",  mapId: 530, zoneId: 3703, x: -1841.27, y:  5279.18, z:  -12.42, o: 3.14 },
  { id: "stormwind",    name: "Stormwind",       faction: "alliance", mapId: 0,   zoneId: 1519, x: -8833.38, y:   625.77, z:   94.14, o: 5.27 },
  { id: "ironforge",    name: "Ironforge",       faction: "alliance", mapId: 0,   zoneId: 1537, x: -4948.45, y:  -905.43, z:  501.65, o: 0.30 },
  { id: "darnassus",    name: "Darnassus",       faction: "alliance", mapId: 1,   zoneId: 1657, x:  9945.26, y:  2618.51, z: 1316.22, o: 0.00 },
  { id: "exodar",       name: "The Exodar",      faction: "alliance", mapId: 530, zoneId: 3557, x: -3961.64, y:-13931.20, z:  100.62, o: 2.08 },
  { id: "orgrimmar",    name: "Orgrimmar",       faction: "horde",    mapId: 1,   zoneId: 1637, x:  1676.35, y: -4331.08, z:   61.64, o: 3.14 },
  { id: "undercity",    name: "Undercity",       faction: "horde",    mapId: 0,   zoneId: 1497, x:  1632.28, y:   240.44, z:  -62.08, o: 0.13 },
  { id: "thunderbluff", name: "Thunder Bluff",   faction: "horde",    mapId: 1,   zoneId: 1638, x: -1282.73, y:   141.54, z:  131.33, o: 3.75 },
  { id: "silvermoon",   name: "Silvermoon City", faction: "horde",    mapId: 530, zoneId: 3487, x:  9487.68, y: -7279.75, z:   14.72, o: 0.00 }
];

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

function passwordValidation(password) {
  if (!password)
    return "Password is required.";

  if (password.length > 16)
    return "Password can have at most 16 characters.";

  return null;
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function emailValidation(email, required = false) {
  if (!email) {
    if (required)
      return "Email is required.";
    return null;
  }

  if (!emailRegex.test(email))
    return "Please provide a valid email address.";

  if (email.length > 255)
    return "Email is too long.";

  return null;
}

async function sendPortalMail(to, subject, text, html) {
  if (!mailTransport)
    return false;

  if (!to)
    return false;

  try {
    await mailTransport.sendMail({
      from: mailConfig.from,
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (error) {
    console.error(`Email send failed (${subject}):`, error.message);
    return false;
  }
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getPortalBaseUrl(req) {
  const configured = (process.env.PORTAL_BASE_URL || "").trim();
  if (configured)
    return configured.replace(/\/+$/, "");

  const host = req.get("host");
  const protocol = req.protocol || "http";
  return `${protocol}://${host}`;
}

async function createOrRefreshEmailVerification(accountId, email, pendingSalt, pendingVerifier) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + verificationTokenTtlHours * 60 * 60 * 1000);

  await authPool.query(
    `INSERT INTO portal_email_verification (
      account_id, email, token_hash, expires_at, pending_salt, pending_verifier, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      token_hash = VALUES(token_hash),
      expires_at = VALUES(expires_at),
      pending_salt = VALUES(pending_salt),
      pending_verifier = VALUES(pending_verifier),
      verified_at = NULL`,
    [accountId, email, tokenHash, expiresAt, pendingSalt, pendingVerifier]
  );

  return token;
}

async function getPendingEmailVerification(accountId) {
  const [rows] = await authPool.query(
    `SELECT email, expires_at, pending_salt, pending_verifier
     FROM portal_email_verification
     WHERE account_id = ?
       AND verified_at IS NULL
     LIMIT 1`,
    [accountId]
  );

  return rows[0] || null;
}

async function createOrRefreshPasswordReset(accountId, email) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + passwordResetTokenTtlMinutes * 60 * 1000);

  await authPool.query(
    `INSERT INTO portal_password_reset (
      account_id, email, token_hash, expires_at, used_at
    ) VALUES (?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      token_hash = VALUES(token_hash),
      expires_at = VALUES(expires_at),
      used_at = NULL`,
    [accountId, email, tokenHash, expiresAt]
  );

  return token;
}

async function getPasswordResetByToken(token) {
  const tokenHash = hashVerificationToken(token);
  const [rows] = await authPool.query(
    `SELECT
       pr.account_id,
       pr.email,
       pr.expires_at,
       pr.used_at,
       a.username
     FROM portal_password_reset pr
     JOIN account a ON a.id = pr.account_id
     WHERE pr.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  return rows[0] || null;
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

async function getOnlineStats() {
  try {
    const [rows] = await charsPool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN race IN (2, 5, 6, 8, 10) THEN 1 ELSE 0 END) AS horde,
         SUM(CASE WHEN race IN (1, 3, 4, 7, 11) THEN 1 ELSE 0 END) AS alliance
       FROM characters
       WHERE online = 1`
    );

    const total    = Number(rows[0]?.total    || 0);
    const horde    = Number(rows[0]?.horde    || 0);
    const alliance = Number(rows[0]?.alliance || 0);

    return {
      total,
      horde,
      alliance,
      hordePercent:    total > 0 ? Math.round(horde    / total * 100) : 0,
      alliancePercent: total > 0 ? Math.round(alliance / total * 100) : 0
    };
  } catch (_error) {
    return { total: 0, horde: 0, alliance: 0, hordePercent: 0, alliancePercent: 0 };
  }
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
    faction: getCharacterFaction(character.race),
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
  const [status, onlineStats] = await Promise.all([
    getServerStatus(),
    getOnlineStats()
  ]);
  const flash = consumeFlash(req);

  res.render("index", {
    status,
    onlineStats,
    flash,
    user: req.session.user || null
  });
});

app.post("/reset-password", async (req, res) => {
  const username = upperLatin(req.body.username);
  const email = normalizeEmail(req.body.email);

  const emailError = emailValidation(email, true);
  if (emailError) {
    req.session.flash = { type: "error", message: emailError };
    return res.redirect("/");
  }

  if (!username) {
    req.session.flash = { type: "error", message: "Username is required." };
    return res.redirect("/");
  }

  if (username.length > 16) {
    req.session.flash = {
      type: "error",
      message: "Username can have at most 16 characters."
    };
    return res.redirect("/");
  }

  try {
    const [rows] = await authPool.query(
      "SELECT id, username, email FROM account WHERE username = ? LIMIT 1",
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
    const accountEmail = normalizeEmail(account.email);
    if (!accountEmail || accountEmail !== email) {
      req.session.flash = {
        type: "error",
        message: "Email does not match the account record."
      };
      return res.redirect("/");
    }

    const token = await createOrRefreshPasswordReset(account.id, accountEmail);
    const resetUrl = `${getPortalBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;

    const mailSent = await sendPortalMail(
      accountEmail,
      "AzerothCore password reset link",
      `Hello ${account.username}, open this link to set a new password: ${resetUrl}`,
      `<p>Hello <strong>${account.username}</strong>,</p><p>Open this link to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    );

    if (!mailSent) {
      req.session.flash = {
        type: "error",
        message: "Password reset failed: could not send reset email."
      };
      return res.redirect("/");
    }

    req.session.flash = {
      type: "success",
      message: "Password reset link sent. Open your email to continue."
    };
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Password reset failed: ${error.code || "db_error"}`
    };
  }

  return res.redirect("/");
});

app.get("/reset-password", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    req.session.flash = {
      type: "error",
      message: "Password reset token is missing."
    };
    return res.redirect("/");
  }

  try {
    const resetData = await getPasswordResetByToken(token);
    if (!resetData) {
      req.session.flash = {
        type: "error",
        message: "Invalid password reset token."
      };
      return res.redirect("/");
    }

    if (resetData.used_at) {
      req.session.flash = {
        type: "error",
        message: "This password reset link was already used."
      };
      return res.redirect("/");
    }

    if (new Date(resetData.expires_at).getTime() < Date.now()) {
      req.session.flash = {
        type: "error",
        message: "Password reset link expired. Please request a new one."
      };
      return res.redirect("/");
    }

    return res.render("reset-password", {
      flash: consumeFlash(req),
      token,
      username: resetData.username
    });
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Password reset page failed: ${error.code || "db_error"}`
    };
    return res.redirect("/");
  }
});

app.post("/reset-password/confirm", async (req, res) => {
  const token = (req.body.token || "").toString().trim();
  const password = upperLatin(req.body.password);
  const passwordConfirm = upperLatin(req.body.passwordConfirm);

  if (!token) {
    req.session.flash = {
      type: "error",
      message: "Password reset token is missing."
    };
    return res.redirect("/");
  }

  const passwordError = passwordValidation(password);
  if (passwordError) {
    req.session.flash = { type: "error", message: passwordError };
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
  }

  if (password !== passwordConfirm) {
    req.session.flash = { type: "error", message: "Passwords do not match." };
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
  }

  try {
    const resetData = await getPasswordResetByToken(token);
    if (!resetData) {
      req.session.flash = {
        type: "error",
        message: "Invalid password reset token."
      };
      return res.redirect("/");
    }

    if (resetData.used_at) {
      req.session.flash = {
        type: "error",
        message: "This password reset link was already used."
      };
      return res.redirect("/");
    }

    if (new Date(resetData.expires_at).getTime() < Date.now()) {
      req.session.flash = {
        type: "error",
        message: "Password reset link expired. Please request a new one."
      };
      return res.redirect("/");
    }

    const salt = crypto.randomBytes(32);
    const verifier = calculateVerifier(resetData.username, password, salt);

    await authPool.query(
      "UPDATE account SET salt = ?, verifier = ? WHERE id = ?",
      [salt, verifier, resetData.account_id]
    );

    await authPool.query(
      "UPDATE portal_password_reset SET used_at = NOW() WHERE account_id = ?",
      [resetData.account_id]
    );

    await sendPortalMail(
      resetData.email,
      "AzerothCore account password changed",
      `Hello ${resetData.username}, your portal password was changed successfully.`,
      `<p>Hello <strong>${resetData.username}</strong>,</p><p>Your portal password was changed successfully.</p>`
    );

    req.session.flash = {
      type: "success",
      message: "Password has been reset. You can log in with the new password."
    };
    return res.redirect("/");
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Password reset failed: ${error.code || "db_error"}`
    };
    return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
  }
});

app.post("/register", async (req, res) => {
  const { username, password } = normalizeCredentials(
    req.body.username,
    req.body.password
  );
  const email = normalizeEmail(req.body.email);

  const emailError = emailValidation(email, true);
  if (emailError) {
    req.session.flash = { type: "error", message: emailError };
    return res.redirect("/");
  }

  const validationError = credentialsValidation(username, password);
  if (validationError) {
    req.session.flash = { type: "error", message: validationError };
    return res.redirect("/");
  }

  let createdAccountId = null;

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

    const [existingEmail] = await authPool.query(
      "SELECT id FROM account WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingEmail.length > 0) {
      req.session.flash = {
        type: "error",
        message: "This email address is already used by another account."
      };
      return res.redirect("/");
    }

    const salt = crypto.randomBytes(32);
    const verifier = calculateVerifier(username, password, salt);
    const blockedSalt = crypto.randomBytes(32);
    const blockedVerifier = crypto.randomBytes(32);

    const [insertResult] = await authPool.query(
      `INSERT INTO account (
        username, salt, verifier, expansion, email, reg_mail
      ) VALUES (?, ?, ?, 2, ?, ?)`,
      [username, blockedSalt, blockedVerifier, email, email]
    );

    const accountId = Number(insertResult.insertId);
    createdAccountId = accountId;
    const token = await createOrRefreshEmailVerification(accountId, email, salt, verifier);
    const verifyUrl = `${getPortalBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;

    const mailSent = await sendPortalMail(
      email,
      "Verify your AzerothCore portal account",
      `Hello ${username}, verify your email by opening this link: ${verifyUrl}`,
      `<p>Hello <strong>${username}</strong>,</p><p>Please verify your account email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    );

    if (!mailSent) {
      await authPool.query(
        "DELETE FROM portal_email_verification WHERE account_id = ?",
        [accountId]
      );
      await authPool.query(
        "DELETE FROM account WHERE id = ?",
        [accountId]
      );

      req.session.flash = {
        type: "error",
        message: "Registration failed: could not send verification email."
      };
      return res.redirect("/");
    }

    req.session.flash = {
      type: "success",
      message: "Account created. Please verify your email before logging in."
    };
  } catch (error) {
    if (createdAccountId) {
      try {
        await authPool.query(
          "DELETE FROM portal_email_verification WHERE account_id = ?",
          [createdAccountId]
        );
        await authPool.query(
          "DELETE FROM account WHERE id = ?",
          [createdAccountId]
        );
      } catch (cleanupError) {
        console.error("Registration cleanup failed:", cleanupError.message);
      }
    }

    if (error.code === "ER_DUP_ENTRY") {
      req.session.flash = {
        type: "error",
        message: "Registration failed: username or email already exists."
      };
      return res.redirect("/");
    }

    req.session.flash = {
      type: "error",
      message: `Registration failed: ${error.code || "db_error"}`
    };
  }

  return res.redirect("/");
});

app.get("/verify-email", async (req, res) => {
  const token = (req.query.token || "").toString().trim();
  if (!token) {
    req.session.flash = {
      type: "error",
      message: "Verification token is missing."
    };
    return res.redirect("/");
  }

  try {
    const tokenHash = hashVerificationToken(token);
    const [rows] = await authPool.query(
      `SELECT account_id, email, expires_at, verified_at, pending_salt, pending_verifier
       FROM portal_email_verification
       WHERE token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      req.session.flash = {
        type: "error",
        message: "Invalid verification token."
      };
      return res.redirect("/");
    }

    const verification = rows[0];
    if (verification.verified_at) {
      req.session.flash = {
        type: "success",
        message: "Email is already verified. You can log in."
      };
      return res.redirect("/");
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      req.session.flash = {
        type: "error",
        message: "Verification token expired. Please log in again to receive a new link."
      };
      return res.redirect("/");
    }

    await authPool.query(
      "UPDATE account SET salt = ?, verifier = ? WHERE id = ?",
      [verification.pending_salt, verification.pending_verifier, verification.account_id]
    );

    await authPool.query(
      "UPDATE portal_email_verification SET verified_at = NOW() WHERE account_id = ?",
      [verification.account_id]
    );

    req.session.flash = {
      type: "success",
      message: "Email verified successfully. You can log in now."
    };
    return res.redirect("/");
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Email verification failed: ${error.code || "db_error"}`
    };
    return res.redirect("/");
  }
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
      "SELECT id, username, salt, verifier, email FROM account WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      req.session.flash = { type: "error", message: "Invalid login." };
      return res.redirect("/");
    }

    const account = rows[0];
    const pendingVerification = await getPendingEmailVerification(account.id);
    if (pendingVerification) {
      const isExpired = new Date(pendingVerification.expires_at).getTime() < Date.now();

      if (isExpired) {
        const recipient = normalizeEmail(account.email || pendingVerification.email);
        if (!recipient) {
          req.session.flash = {
            type: "error",
            message: "Email verification pending, but no email is set on this account."
          };
          return res.redirect("/");
        }

        const token = await createOrRefreshEmailVerification(
          account.id,
          recipient,
          pendingVerification.pending_salt,
          pendingVerification.pending_verifier
        );
        const verifyUrl = `${getPortalBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;
        const mailSent = await sendPortalMail(
          recipient,
          "Verify your AzerothCore portal account",
          `Hello ${account.username}, verify your email by opening this link: ${verifyUrl}`,
          `<p>Hello <strong>${account.username}</strong>,</p><p>Your previous verification link expired. Please use this new link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
        );

        req.session.flash = {
          type: "error",
          message: mailSent
            ? "Verification link expired. A new verification email has been sent."
            : "Verification link expired, but sending a new email failed. Please contact support."
        };
        return res.redirect("/");
      }

      req.session.flash = {
        type: "error",
        message: "Please verify your email before logging in."
      };
      return res.redirect("/");
    }

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
      isAdmin,
      teleportLocations: TELEPORT_LOCATIONS
    });
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Character load failed: ${error.code || "db_error"}`
    };
    return res.redirect("/panel");
  }
});

app.post("/characters/:guid/teleport", requireLogin, async (req, res) => {
  const guid = Number(req.params.guid);
  if (!Number.isInteger(guid) || guid <= 0) {
    req.session.flash = { type: "error", message: "Invalid character id." };
    return res.redirect("/panel");
  }

  const locationId = (req.body.location || "").trim();
  const location = TELEPORT_LOCATIONS.find((l) => l.id === locationId);
  if (!location) {
    req.session.flash = { type: "error", message: "Unknown teleport location." };
    return res.redirect(`/characters/${guid}`);
  }

  try {
    const [charRows] = await charsPool.query(
      "SELECT guid, account, name, online FROM characters WHERE guid = ? AND deleteDate IS NULL LIMIT 1",
      [guid]
    );

    if (charRows.length === 0) {
      req.session.flash = { type: "error", message: "Character not found." };
      return res.redirect("/panel");
    }

    const char = charRows[0];
    const isAdmin = req.session.user.gmlevel >= 3;

    if (!isAdmin && char.account !== req.session.user.accountId) {
      req.session.flash = { type: "error", message: "You do not have access to this character." };
      return res.redirect("/panel");
    }

    const charFaction = getCharacterFaction(char.race);
    if (location.faction !== "neutral" && location.faction !== charFaction) {
      req.session.flash = { type: "error", message: "That city is not available for your character's faction." };
      return res.redirect(`/characters/${guid}`);
    }

    if (char.online) {
      req.session.flash = { type: "error", message: "Character must be offline to teleport." };
      return res.redirect(`/characters/${guid}`);
    }

    await charsPool.query(
      `UPDATE characters
       SET map = ?, zone = ?, position_x = ?, position_y = ?, position_z = ?, orientation = ?,
           trans_x = 0, trans_y = 0, trans_z = 0, trans_o = 0, transguid = 0
       WHERE guid = ? AND online = 0`,
      [location.mapId, location.zoneId, location.x, location.y, location.z, location.o, guid]
    );

    if (isAdmin && char.account !== req.session.user.accountId) {
      await writeAudit(
        req.session.user.accountId,
        req.session.user.username,
        "teleport",
        char.account,
        char.name,
        `location=${location.id} map=${location.mapId}`
      );
    }

    req.session.flash = {
      type: "success",
      message: `${char.name} will appear in ${location.name} on next login.`
    };
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Teleport failed: ${error.code || "db_error"}`
    };
  }

  return res.redirect(`/characters/${guid}`);
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

async function createEmailVerificationTable() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS portal_email_verification (
      id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      account_id  INT UNSIGNED    NOT NULL,
      email       VARCHAR(255)    NOT NULL,
      token_hash  CHAR(64)        NOT NULL,
      created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at  DATETIME        NOT NULL,
      verified_at DATETIME        DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_account_id (account_id),
      UNIQUE KEY uq_token_hash (token_hash),
      KEY idx_expires (expires_at),
      KEY idx_verified (verified_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [saltColRows] = await authPool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'portal_email_verification'
       AND COLUMN_NAME = 'pending_salt'
     LIMIT 1`,
    [authDbName]
  );

  if (saltColRows.length === 0) {
    await authPool.query(
      "ALTER TABLE portal_email_verification ADD COLUMN pending_salt BINARY(32) NOT NULL AFTER expires_at"
    );
  }

  const [verifierColRows] = await authPool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'portal_email_verification'
       AND COLUMN_NAME = 'pending_verifier'
     LIMIT 1`,
    [authDbName]
  );

  if (verifierColRows.length === 0) {
    await authPool.query(
      "ALTER TABLE portal_email_verification ADD COLUMN pending_verifier BINARY(32) NOT NULL AFTER pending_salt"
    );
  }
}

async function createPasswordResetTable() {
  await authPool.query(`
    CREATE TABLE IF NOT EXISTS portal_password_reset (
      id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
      account_id  INT UNSIGNED    NOT NULL,
      email       VARCHAR(255)    NOT NULL,
      token_hash  CHAR(64)        NOT NULL,
      created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at  DATETIME        NOT NULL,
      used_at     DATETIME        DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_account_id (account_id),
      UNIQUE KEY uq_token_hash (token_hash),
      KEY idx_expires (expires_at),
      KEY idx_used (used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureUniqueAccountEmailConstraint() {
  const [indexRows] = await authPool.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'account'
       AND INDEX_NAME = 'uq_account_email'
     LIMIT 1`,
    [authDbName]
  );

  if (indexRows.length > 0)
    return;

  const [duplicateRows] = await authPool.query(
    `SELECT LOWER(email) AS normalized_email, COUNT(*) AS total
     FROM account
     WHERE COALESCE(TRIM(email), '') <> ''
     GROUP BY LOWER(email)
     HAVING total > 1
     LIMIT 1`
  );

  if (duplicateRows.length > 0) {
    console.warn("Skipping unique email index: duplicate account emails already exist.");
    return;
  }

  await authPool.query(
    "ALTER TABLE account ADD UNIQUE KEY uq_account_email (email)"
  );
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
  await createEmailVerificationTable();
  await createPasswordResetTable();
  await ensureUniqueAccountEmailConstraint();

  if (mailTransport) {
    try {
      await mailTransport.verify();
      console.log(`SMTP connected to ${mailConfig.host}:${mailConfig.port}`);
    } catch (error) {
      console.error("SMTP verification failed:", error.message);
    }
  }

  app.listen(port, () => {
    console.log(`AzerothCore web portal running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start web portal:", error);
  process.exit(1);
});
