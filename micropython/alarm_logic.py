"""
Hälytyksen tila ja vasteet (LED + buzzer)
"""

import hardware
import alert

_alarm_active = False


def is_active():
    return _alarm_active


def trigger(temp_ok):
    """
    Aktivoi hälytyksen.
    temp_ok = True  -> keltainen LED
    temp_ok = False -> punainen LED
    """
    global _alarm_active
    _alarm_active = True

    if temp_ok:
        hardware.led1.value(1)   # keltainen
        hardware.led2.value(0)
    else:
        hardware.led2.value(1)   # punainen
        hardware.led1.value(0)

    alert.alert()  # summeri


def clear():
    """
    Kuitataan hälytys (sammutetaan kaikki vasteet)
    """
    global _alarm_active
    _alarm_active = False
    hardware.led1.value(0)
    hardware.led2.value(0)
    hardware.buzzer.value(0)

