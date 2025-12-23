"""Konfiguraatioarvot
Wi‑Fi-yhteys, backend,  MCP9701-lämpöanturi,
käämin kynnysarvo ja lämpötilan oletusrajat.
"""
# --- Wi-Fi ---
SSID = "" # lisää wifi
PASS = "" # lisää salasana

# --- Backend ---
DEVICE_ID = "" # lisää
SERVER_IP = "" # lisää
SERVER_PORT = 4000 # vaihda tarvittaessa

# --- Sensoriparametrit ---
THRESHOLD = 3000
VREF = 3.3
V_0C = 0.4
SLOPE = 0.01953

# --- Lämpötilarajat ---
TEMP_MIN_DEFAULT = 2
TEMP_MAX_DEFAULT = 25
