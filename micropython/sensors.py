"""Lämpötila- ja liikeanturit"""
import utime
import hardware
import config

# --- Analoginen lämpömittari (MCP9701) ---
def read_temp_c(samples=16):
    """Lukee ACD:stä arvoja ja muuttaa jännitteen (V) lämpötilaksi (°C)."""
    total = 0
    for _ in range(samples):
        total += hardware.temp_sensor.read_u16()
        utime.sleep(0.002)
    raw16 = total / samples
    voltage = (raw16 / 65535.0) * config.VREF
    temp_c = (voltage - config.V_0C) / config.SLOPE
    return temp_c

# --- liikeanturi ---
def read_motion():
    """Kun havaitsee liikkeen, palauttaa True"""
    return hardware.coil.read_u16() > config.THRESHOLD
