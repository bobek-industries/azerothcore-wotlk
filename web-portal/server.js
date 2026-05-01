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

app.get("/", async (req, res) => {
  const status = await getServerStatus();
  const flash = req.session.flash || null;
  req.session.flash = null;

  res.render("index", {
    status,
    flash,
    user: req.session.user || null
  });
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
      username: account.username
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
    const characters = await loadCharactersByAccount(req.session.user.accountId);
    return res.render("panel", {
      user: req.session.user,
      characters
    });
  } catch (error) {
    req.session.flash = {
      type: "error",
      message: `Could not load characters: ${error.code || "db_error"}`
    };
    return res.redirect("/");
  }
});

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

  app.listen(port, () => {
    console.log(`AzerothCore web portal running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start web portal:", error);
  process.exit(1);
});
