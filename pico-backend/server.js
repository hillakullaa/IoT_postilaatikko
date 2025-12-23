// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const cors = require("cors");
const { WebSocketServer } = require("ws");

/* =========================================================
    ASETUKSET & TIEDOSTOT
   ========================================================= */

const app = express();
const port = 4000;

app.use(express.json());
app.use(cors({ origin: true }));

const DB_FILE = path.join(__dirname, "data.json");
const LIMITS_FILE = path.join(__dirname, "limits.json");
const COMMANDS_FILE = path.join(__dirname, "commands.json");

/* =========================================================
    APUFUNKTIOT (JSON-tallennus)
   ========================================================= */

function loadJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const txt = fs.readFileSync(file, "utf8");
    if (!txt.trim()) return null;
    return JSON.parse(txt);
  } catch (e) {
    console.error(`[WARN] Failed to parse ${file}:`, e.message);
    return null;
  }
}

function saveJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

// locale-tolerant float parser (tukee pilkkua)
function parseNum(v) {
  if (v === null || v === undefined) return NaN;
  return Number.parseFloat(String(v).trim().replace(",", "."));
}

/* =========================================================
    SENSORIDATA API
   ========================================================= */

/**
 * Tallennus: POST /api/sensor
 * Body: { device_id, temperature_c, motionAlarm, ... }
 */
app.post("/api/sensor", (req, res) => {
  const stored = loadJson(DB_FILE) || [];
  const item = { ...req.body, timestamp: new Date().toISOString() };

  stored.push(item);
  saveJson(DB_FILE, stored);

  // WebSocket broadcast frontille
  broadcast({ kind: "measurement", ...item });

  res.json({ status: "ok" });
});

/**
 * Haku: GET /api/sensor?days=7&device_id=pico2w-1556a5
 * - days: viimeiset N päivää (optional)
 * - device_id: suodata laitekohtaisesti (optional)
 */
app.get("/api/sensor", (req, res) => {
  const data = loadJson(DB_FILE) || [];
  const { days, device_id } = req.query;

  let out = data;

  // device-suodatus (optionaalinen; frontti voi tehdä tämän myös itse)
  if (device_id) {
    out = out.filter((d) => d.device_id === device_id);
  }

  // päiväsuodatus (ISO timestamp -> Date)
  if (days) {
    const n = parseInt(days, 10);
    if (Number.isFinite(n) && n > 0) {
      const cutoff = Date.now() - n * 24 * 60 * 60 * 1000;
      out = out.filter((d) => {
        const t = Date.parse(d.timestamp);
        return Number.isFinite(t) && t >= cutoff;
      });
    }
  }

  res.set("Cache-Control", "no-store");
  res.json(out);
});

/* =========================================================
    LÄMPÖTILARAJAT API
   ========================================================= */

/**
 * Haku: GET /api/devices/:id/temp_limits
 * Vastaa limits.json[id] tai oletus {min:2, max:25}
 */
app.get("/api/devices/:id/temp_limits", (req, res) => {
  const limits = loadJson(LIMITS_FILE) || {};
  const id = req.params.id;
  const cur = limits[id] ?? { min: 2, max: 25, ts: Date.now() };
  res.set("Cache-Control", "no-store");
  res.json(cur);
});

/**
 * Tallennus: POST /api/devices/:id/temp_limits
 * Body: { min, max } (floatit; sallii pilkun desimaalina)
 */
app.post("/api/devices/:id/temp_limits", (req, res) => {
  const limits = loadJson(LIMITS_FILE) || {};
  const id = req.params.id;

  let { min, max } = req.body || {};
  min = parseNum(min);
  max = parseNum(max);

  // Validointi
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max)) {
    return res
      .status(400)
      .json({
        error: "invalid_limits",
        hint: "min < max ja numeeriset arvot.",
      });
  }
  // (Tarvittaessa säädä sallittu alue)
  if (min < -50 || max > 100) {
    return res
      .status(400)
      .json({ error: "out_of_range", hint: "Sallitut rajat ~ -50…100 °C." });
  }

  // Tallenna
  const rec = { min, max, ts: Date.now() };
  limits[id] = rec;
  saveJson(LIMITS_FILE, limits);

  // WS-broadcast UI:lle (valinnainen, front voi kuunnella kind="limits_updated")
  broadcast({ kind: "limits_updated", device_id: id, ...rec });

  // 204 No Content riittää
  res.status(204).end();
});

/* =========================================================
    KOMENNOT (ACK)
   ========================================================= */

app.post("/api/devices/:id/commands", (req, res) => {
  const cmds = loadJson(COMMANDS_FILE) || {};
  const id = req.params.id;
  const command = (req.body && req.body.command) || null;
  cmds[id] = { command, ts: Date.now() };
  saveJson(COMMANDS_FILE, cmds);

  // Broadcast frontille (UI voi resetoida hälytystilan)
  broadcast({ kind: "alarm_ack", device_id: id });

  res.json({ status: "queued" });
});

app.get("/api/devices/:id/commands", (req, res) => {
  const cmds = loadJson(COMMANDS_FILE) || {};
  const id = req.params.id;
  res.set("Cache-Control", "no-store");
  res.json(cmds[id] ?? null);
});

/* =========================================================
    HTTP + WEBSOCKET
   ========================================================= */

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((c) => {
    if (c.readyState === c.OPEN) c.send(payload);
  });
}

server.listen(port, () =>
  console.log(`Backend running on http://localhost:${port}`)
);
