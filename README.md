# IoT-projekti
# 📬 Älykäs postilaatikko 

## Kuvaus
Tämä projekti on IoT-kurssin harjoitustyö, jossa suunniteltiin oma sensori ja laajennettiin se älykkääksi postilaatikon valvontajärjestelmäksi.

Järjestelmä mittaa:
- Postilaatikon avaamisen (oma induktiivinen käämianturi)
- Lämpötilan (MCP9701A, analoginen)

Mittaukset välitetään Raspberry Pi Pico 2 W -mikro-ohjaimelta backend-palvelimelle ja esitetään selainpohjaisessa frontendissä reaaliaikaisesti. Frontendistä voidaan myös ohjata laitetta (hälytyksen kuittaus ja lämpötilarajojen asetus).

---

## Järjestelmäarkkitehtuuri
### Laitteisto
- Raspberry Pi Pico 2 W
- Oma käämiin ja magneettiin perustuva avaussensori
- MCP9701A analoginen lämpötila-anturi
- LEDit
- Summeri
- Painonappi

### Ohjelmisto
- Pico: MicroPython
- Backend: Node.js (Express + WebSocket)
- Tietovarasto: JSON-tiedostot
- Frontend: React

### Arkkitehtuurin roolit
- Pico: sensorien luku ja päätöksenteko
- Backend: REST-rajapinta, WebSocket-tiedonsiirto ja datan tallennus
- Frontend: käyttöliittymä ja reaaliaikainen visualisointi

---

## Sensorit ja siirtofunktiot
### Avaussensori (oma sensori)
- Induktiivinen käämi ja liikkuva magneetti
- Kannen liike aiheuttaa käämiin jännitepiikin
- Hälytys laukeaa, kun ADC-arvo ylittää kynnysarvon

Mittausten perusteella indusoituneen jännitteen huippuarvo ei korreloi liikkeen nopeuden kanssa. Anturi soveltuu liikkeen havaitsemiseen, ei nopeuden mittaamiseen.

### Lämpötila-anturi (MCP9701A)
Anturin ominaisuudet:
- 0 °C → 0.4 V
- Herkkyys ≈ 19.53 mV / °C

**Siirtofunktio:**
```
T(°C) = (Vout − 0.4 V) / 0.01953 V/°C
```
ADC-luku muunnetaan jännitteeksi käyttäen Picon oletusreferenssiä (≈ 3.3 V).

---

## Hälytyslogiikka
1. Liike havaitaan
2. Lämpötila tarkistetaan
3. Vaste:
   - Lämpötila OK → keltainen LED + summeri
   - Lämpötila rajan ulkopuolella → punainen LED + summeri

> Lämpötila ei yksin laukaise hälytystä, koska postilaatikon avaaminen on ensisijainen tapahtuma.

---

## Käyttöohje
### 1. Laitteiston käynnistys
1. Kytke Pico 2 W virtalähteeseen
2. Tarkista `config.py`:
   - Wi-Fi SSID ja salasana
   - Picon tunniste
   - Backendin IP-osoite
3. Pico yhdistää Wi-Fiin ja aloittaa mittauksen automaattisesti

### 2. Backendin käynnistys
```
npm install
node server.js
```
Backend käynnistyy osoitteeseen: `http://localhost:4000`

### 3. Frontendin käynnistys
```
npm install
npm run dev
```
Avaa selain: `http://localhost:5173`

### 4. Frontendin käyttö
Frontendissä käyttäjä näkee:
- Nykyisen lämpötilan
- Postilaatikon hälytystilan (LEDit kuten picossa)
- Lämpötilahistorian (7 / 30 / 90 päivää)

Käyttäjä voi:
- Kuitata hälytyksen
- Asettaa lämpötilarajat

Tiedot päivittyvät reaaliaikaisesti WebSocketin kautta.

### 5. Hälytyksen kuittaus
Hälytys voidaan kuitata:
- Frontendin painikkeella
- Postilaatikon fyysisellä painonapilla

Kaikki kuittaukset synkronoituvat laitteen ja frontendin välillä.

---

## Testausraportti
### Postilaatikon avaussensorin testaus
| # | Kuvaus | Odotettu | Tulos | Mitattu arvo | Huomiot |
|---|--------|----------|-------|--------------|---------|
| 1 | Normaali avaus | > 0 V | Pass | 37 mV | – |
| 2 | Hidas avaus | > 0 V | Pass | 26 mV | – |
| 3 | Nopea avaus | > 0 V | Pass | 76 mV | – |
| 4 | Kannen raotus | > 0 V | Fail | 0 V | Kirje mahdollista lisätä ilman hälytystä |
| 5 | Laatikon tärinä | 0 V | Pass | 0 V | Ei virhehälytyksiä |
| 6 | Kansi jää auki | 0 V | Pass | 0 V | Hälytys jo avatessa |
| 7 | Normaali sulkeminen | < 0 V | Pass | −28 mV | – |

### Lämpötilarajojen testaus
| # | Kuvaus | Odotettu | Tulos | Mitattu arvo | Huomiot |
|---|--------|----------|-------|--------------|---------|
| 10 | Lämpötila rajojen sisällä | Keltainen LED | Pass | 22.79 °C | Raja-arvot välittyvät Picoon |
| 11 | Lämpötila rajojen ulkopuolella | Punainen LED | Pass | 22.83 °C | Hälytys toimii oikein |
| 12 | Minimi > maksimi | Raja-arvoja ei hyväksytä | Fail | 22.78 °C | Frontend ei validoi syötettä |

### Hälytyksen kuittaus
| # | Kuvaus | Odotettu | Tulos | Huomiot |
|---|--------|----------|-------|---------|
| 13 | Kuittaus painonapilla | Hälytys poistuu | Pass | Paikallinen kuittaus |
| 14 | Kuittaus käyttöliittymästä | Hälytys poistuu | Pass | Etäkuittaus |

### Äänimerkki
| # | Kuvaus | Odotettu | Tulos |
|---|--------|----------|-------|
| 15 | Hälytys laukeaa | Buzzer soi 3 kertaa | Pass |

---

## Lämpötilamittauksen tarkkuus
Lämpötilamittausta verrattiin huonelämpötilaan (≈ 22 °C).
- Mitattu lämpötila vastasi vertailuarvoa kohtuullisella tarkkuudella
- Mittausvirhe: ±1.5 °C
  
Mahdolliset virhelähteet:
- Raspberry Pi Picon ADC:n epätarkka referenssijännite
- Anturia ei ole erikseen kalibroitu, vaan mittaus perustuu valmistajan siirtofunktioon

Kalibroimattomuus on tietoinen rajaus, koska järjestelmän käyttötarkoitus on olosuhteiden valvonta eikä tarkka lämpötilamittaus.

---

## Reaaliaikainen tiedonsiirto
- WebSocket-päivitys frontendissä
- Viive alle 200 ms
- Soveltuu reaaliaikaiseen valvontaan

---

## Tunnetut rajoitukset
- ADC:n epätarkka referenssijännite
- Induktiivinen sensori ei ole lineaarinen
- JSON-tietovarasto ei skaalaudu
- Ei käyttäjähallintaa tai autentikointia
- Lämpötilahälytys ei toimi oikein frontissa, jos lämpötilarajat asetetaan Tmin > Tmax

---

## Mahdolliset jatkokehitysideat
- Hälytys lämpötilamuutoksesta avaamisen jälkeen
- Kosteusanturi kirjepostille
- Tietoturvan parantaminen (autentikointi, HTTPS)
- Ulkoinen jännitereferenssi ADC:lle
- Pilvipohjainen tietovarasto
- Virransäästö akkukäyttöön

---

## Yhteenveto
Projektissa toteutettiin toimiva IoT-järjestelmä, joka yhdistää:
- Itse tehdyn sensorin
- Sulautetun ohjelmiston
- Backend–frontend-arkkitehtuurin

Ratkaisu on suunniteltu käytännön valvontakäyttöön, ja sen rajoitukset, mittaustarkkuus ja kehityskohteet on dokumentoitu.
