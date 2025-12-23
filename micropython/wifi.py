"""wifi"""
import network
import utime
import config

def wifi_connect():
    """Yhdistää Pico 2 W:n Wi-Fi-verkkoon."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    print("Yhdistetään Wi-Fi:", config.SSID)
    wlan.connect(config.SSID, config.PASS)
    t0 = utime.time()
    timeout = 20
    while not wlan.isconnected():
        utime.sleep(0.5)
        print(".", end="")
        if utime.time() - t0 > timeout:
            raise RuntimeError("Wi-Fi aikakatkaistu!")
    print("\nWi-Fi OK, IP:", wlan.ifconfig()[0])