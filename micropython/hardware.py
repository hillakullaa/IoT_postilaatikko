"""Laitteisto"""
from machine import Pin, ADC

led1 = None
led2 = None
buzzer = None
button = None
coil = None
temp_sensor = None

def init_hardware():
    """Alustaa LEDit, buzzer, nappi, anturit."""
    global led1, led2, buzzer, button, coil, temp_sensor
    led1 = Pin(14, Pin.OUT)
    led2 = Pin(15, Pin.OUT)
    buzzer = Pin(16, Pin.OUT)
    button = Pin(17, Pin.IN, Pin.PULL_UP)
    coil = ADC(Pin(26))
    temp_sensor = ADC(Pin(27))
