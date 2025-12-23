"""
main.py
Postilaatikon valvonta + lämpötilahälytys
"""

import utime
import wifi
import hardware
import sensors
import backend
import alarm_logic as alarm
import config

# =========================================================
# ASETUKSET
# =========================================================

DEBUG = True

def debug(*args):
    if DEBUG:
        print(*args)

# =========================================================
# APU
# =========================================================

def valid_limits(mn, mx):
    try:
        mn = float(mn)
        mx = float(mx)
    except Exception:
        return False
    return -50.0 <= mn < mx <= 100.0


# =========================================================
# PÄÄOHJELMA
# =========================================================

def main():
    last_button_state = 1  # PULL_UP

    # Lämpötilarajojen oletukset
    temp_min = config.TEMP_MIN_DEFAULT
    temp_max = config.TEMP_MAX_DEFAULT
    last_good_limits = (temp_min, temp_max)

    # Init
    wifi.wifi_connect()
    hardware.init_hardware()

    debug("Defaults:", temp_min, temp_max)

    # Backend-rajat
    if getattr(config, "USE_BACKEND_LIMITS", True):
        bmin, bmax = backend.fetch_temp_limits(temp_min, temp_max)
        if valid_limits(bmin, bmax):
            temp_min, temp_max = float(bmin), float(bmax)
            last_good_limits = (temp_min, temp_max)
            debug("Backend limits:", temp_min, temp_max)
        else:
            debug("Invalid backend limits, using defaults")

    print("Postilaatikon valvonta käynnissä...")

    while True:
        temp_c = sensors.read_temp_c()
        motion = sensors.read_motion()

        # -------------------------------------------------
        # Hälytyksen laukaisu (vain liikkeestä)
        # -------------------------------------------------
        if motion and not alarm.is_active():
            temp_ok = temp_min <= temp_c <= temp_max
            debug("Decision:", temp_c, temp_min, temp_max, temp_ok)

            backend.post_measurement(temp_c, motion)
            alarm.trigger(temp_ok)

        # -------------------------------------------------
        # Backend-kuittaus (UI)
        # -------------------------------------------------
        if alarm.is_active() and backend.poll_ack():
            debug("ACK backendistä")
            alarm.clear()

        # -------------------------------------------------
        # Napin kuittaus (Pico)
        # -------------------------------------------------
        btn = hardware.button.value()
        if alarm.is_active() and last_button_state == 1 and btn == 0:
            utime.sleep_ms(30)  # debounce
            if hardware.button.value() == 0:
                debug("Kuittaus napilla")
                alarm.clear()
                backend.send_ack()
                utime.sleep(0.3)
        last_button_state = btn

        # -------------------------------------------------
        # Päivitä lämpötilarajat ~10 s välein
        # -------------------------------------------------
        if getattr(config, "USE_BACKEND_LIMITS", True):
            if utime.ticks_ms() % 10000 < 100:
                bmin, bmax = backend.fetch_temp_limits(temp_min, temp_max)
                if valid_limits(bmin, bmax):
                    temp_min, temp_max = float(bmin), float(bmax)
                    last_good_limits = (temp_min, temp_max)
                    debug("Limits updated:", temp_min, temp_max)
                else:
                    temp_min, temp_max = last_good_limits
                    debug("Invalid limits ignored")
                utime.sleep(0.1)

        utime.sleep_ms(20)


if __name__ == "__main__":
    main()

