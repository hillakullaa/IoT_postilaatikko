"""
backend.py
- lämpötilarajojen haku
- sensoridatan lähetys
- ACK-komennon pollaus
- ACK:n lähetys backendille
"""

import urequests
import config

_last_cmd_ts = 0


def fetch_temp_limits(default_min, default_max):
    try:
        url = (
            f"http://{config.SERVER_IP}:{config.SERVER_PORT}"
            f"/api/devices/{config.DEVICE_ID}/temp_limits"
        )
        r = urequests.get(url)
        if r.status_code == 200:
            data = r.json()
            r.close()
            return data.get("min", default_min), data.get("max", default_max)
        r.close()
    except Exception as e:
        print("Temp limits fetch failed:", e)

    return default_min, default_max


def post_measurement(temp_c, motion):
    try:
        payload = {
            "device_id": config.DEVICE_ID,
            "temperature_c": round(temp_c, 2),
            "motionAlarm": bool(motion),
        }
        r = urequests.post(
            f"http://{config.SERVER_IP}:{config.SERVER_PORT}/api/sensor",
            json=payload,
        )
        r.close()
    except Exception as e:
        print("POST failed:", e)


def poll_ack():
    """
    Palauttaa True, jos backendistä tuli uusi ACK_ALARM
    """
    global _last_cmd_ts
    try:
        url = (
            f"http://{config.SERVER_IP}:{config.SERVER_PORT}"
            f"/api/devices/{config.DEVICE_ID}/commands"
        )
        r = urequests.get(url)
        if r.status_code != 200:
            r.close()
            return False

        data = r.json()
        r.close()

        if not data:
            return False

        ts = data.get("ts", 0)
        if ts <= _last_cmd_ts:
            return False

        _last_cmd_ts = ts
        return data.get("command") == "ACK_ALARM"

    except Exception as e:
        print("Command poll failed:", e)
        return False


def send_ack():
    """
    Lähetä ACK_ALARM backendille (Picon napista)
    """
    try:
        payload = {"command": "ACK_ALARM"}
        r = urequests.post(
            f"http://{config.SERVER_IP}:{config.SERVER_PORT}"
            f"/api/devices/{config.DEVICE_ID}/commands",
            json=payload,
        )
        r.close()
        print("ACK lähetetty backendille")
    except Exception as e:
        print("ACK send failed:", e)

