import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* =========================================================
    KONFIGURAATIO
   ========================================================= */

const API = "http://localhost:4000"; // vaihda tarvittaessa esim. http://192.168.1.102:4000
const WS_URL = "ws://localhost:4000";
const DEVICE_ID = "pico2w-1556a5";

/* =========================================================
    UI-KOMPONENTIT
   ========================================================= */

function StatusLed({ tempAlarm, motionAlarm }) {
  let color = "#555";
  let label = "Ei hälytystä";

  if (tempAlarm) {
    color = "#e53e3e";
    label = "Lämpötilahälytys";
  } else if (motionAlarm) {
    color = "#ecc94b";
    label = "Postilaatikko avattu";
  }

  return (
    <div style={{ textAlign: "center", margin: "16px 0" }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          margin: "0 auto 6px",
          backgroundColor: color,
          boxShadow: `0 0 14px ${color}`,
          border: "1px solid #222",
        }}
      />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

/* =========================================================
    PÄÄKOMPONENTTI
   ========================================================= */

export default function App() {
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [alarm, setAlarm] = useState({ tempAlarm: false, motionAlarm: false });
  const [days, setDays] = useState(7);

  // lämpötilarajat
  const [tempLimits, setTempLimits] = useState({ min: 2, max: 25 });

  /* ---------------------------------------------------------
      Mittaushistorian haku (7 / 30 / 90 pv)
     --------------------------------------------------------- */
  useEffect(() => {
    fetch(`${API}/api/sensor?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = data.filter((d) => d.device_id === DEVICE_ID);
        setHistory(filtered);
        if (filtered.length) {
          setLatest(filtered[filtered.length - 1]);
        }
      })
      .catch(console.error);
  }, [days]);

  /* ---------------------------------------------------------
      Lämpötilarajojen haku backendiltä
     --------------------------------------------------------- */
  useEffect(() => {
    fetch(`${API}/api/devices/${DEVICE_ID}/temp_limits`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setTempLimits({ min: data.min, max: data.max }))
      .catch(console.error);
  }, []);

  /* ---------------------------------------------------------
      WebSocket – reaaliaikaiset päivitykset
     --------------------------------------------------------- */
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      // suodata laitteen mukaan
      if (msg.device_id && msg.device_id !== DEVICE_ID) return;

      if (msg.kind === "measurement") {
        setLatest(msg);
        setHistory((h) => [...h, msg]);

        const tempAlarm =
          typeof msg.temperature_c === "number" &&
          (msg.temperature_c < tempLimits.min ||
            msg.temperature_c > tempLimits.max);

        setAlarm({
          tempAlarm,
          motionAlarm: !!msg.motionAlarm,
        });
      }

      if (msg.kind === "alarm_ack") {
        setAlarm({ tempAlarm: false, motionAlarm: false });
      }

      // Jos otat käyttöön backendin WS-broadcastin "limits_updated":
      // if (msg.kind === "limits_updated" && msg.device_id === DEVICE_ID) {
      //   setTempLimits({ min: msg.min, max: msg.max });
      // }
    };

    return () => ws.close();
  }, [tempLimits]);

  /* ---------------------------------------------------------
      Hälytyksen kuittaus (UI)
     --------------------------------------------------------- */
  function acknowledgeAlarm() {
    fetch(`${API}/api/devices/${DEVICE_ID}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "ACK_ALARM" }),
    }).catch(console.error);

    setAlarm({ tempAlarm: false, motionAlarm: false });
  }

  /* ---------------------------------------------------------
      Päivitä lämpötilarajat (ilmoitus poistettu)
     --------------------------------------------------------- */
  async function updateTempLimits() {
    // varmista numerot
    const payload = {
      min: Number(tempLimits.min),
      max: Number(tempLimits.max),
    };
    if (
      !Number.isFinite(payload.min) ||
      !Number.isFinite(payload.max) ||
      !(payload.min < payload.max)
    ) {
      // hiljainen epäonnistuminen – ei näytetä ilmoitusta
      return;
    }

    try {
      const resp = await fetch(`${API}/api/devices/${DEVICE_ID}/temp_limits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) return;

      // hae takaisin ja päivitä UI
      const r = await fetch(`${API}/api/devices/${DEVICE_ID}/temp_limits`, {
        cache: "no-store",
      });
      const data = await r.json();
      setTempLimits({ min: data.min, max: data.max });
    } catch (err) {
      // ei ilmoitusta – logaa konsoliin kehittäjälle
      console.error("Rajojen päivitys epäonnistui:", err);
    }
  }

  /* =========================================================
      DATA KUVAJAAN
     ========================================================= */

  const chartData = history.map((d) => ({
    t: new Date(d.timestamp).toLocaleTimeString(),
    temperature: d.temperature_c,
  }));

  /* =========================================================
      RENDER
     ========================================================= */

  return (
    <div
      style={{ maxWidth: 960, margin: "24px auto", fontFamily: "system-ui" }}
    >
      <h2>📬 Postilaatikon valvonta</h2>

      <StatusLed tempAlarm={alarm.tempAlarm} motionAlarm={alarm.motionAlarm} />

      <p>
        <strong>Lämpötila:</strong>{" "}
        {typeof latest?.temperature_c === "number"
          ? `${latest.temperature_c.toFixed(1)} °C`
          : "–"}
      </p>

      <button onClick={acknowledgeAlarm}>Kuittaa hälytys</button>

      {/* --- Aikajakson valinta --- */}
      <h3 style={{ marginTop: 24 }}>Lämpötilahistoria</h3>
      <label>
        Näytä:
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          style={{ marginLeft: 8 }}
        >
          <option value={7}>Viikko</option>
          <option value={30}>Kuukausi</option>
          <option value={90}>3 kk</option>
        </select>
      </label>

      {/* --- Kuvaaja --- */}
      <div style={{ height: 300, marginTop: 12, border: "1px solid #eee" }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="t" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#2b6cb0"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* --- Lämpötilarajojen asetus --- */}
      <h3 style={{ marginTop: 24 }}>Aseta lämpötilarajat</h3>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Min:
          <input
            type="number"
            step="0.1"
            value={tempLimits.min}
            onChange={(e) =>
              setTempLimits({
                ...tempLimits,
                min: parseFloat(e.target.value),
              })
            }
          />
        </label>
        <span>—</span>
        <label>
          Max:
          <input
            type="number"
            step="0.1"
            value={tempLimits.max}
            onChange={(e) =>
              setTempLimits({
                ...tempLimits,
                max: parseFloat(e.target.value),
              })
            }
          />
        </label>
        <button onClick={updateTempLimits}>Päivitä rajat</button>
      </div>
    </div>
  );
}
