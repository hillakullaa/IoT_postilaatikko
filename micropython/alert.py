"""Summerin hälytys"""
import utime
import hardware

def alert():
    """Hälyttää buzzerillä."""
    for _ in range(3):
        hardware.buzzer.value(1)
        utime.sleep(0.5)
        hardware.buzzer.value(0)
        utime.sleep(0.5)
