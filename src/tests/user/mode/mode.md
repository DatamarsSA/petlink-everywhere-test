
Io posso avere:
- N energy-saving-zone (se attiva dai settings si attiva da sola quando ci entra dentro)
- 1 solo geofance (devo abilitare manualemnte quando ci entra)

## sendCommand() & sendSetting()
```shell
sendCommand = Comandi TEMPORANEI e IMMEDIATI
├─ LIVE_TRACKING: "Accendi tracciamento per 15 minuti"
├─ SOUND: "Fai suonare il device"
├─ FLASHLIGHT: "Accendi la torcia"
└─ Durata: secondi/minuti
sendCommand(LIVE_TRACKING, 900) = "Voglio vedere dove sta PER I PROSSIMI 15 MIN"

sendSetting = Configurazioni PERMANENTI
├─ ENERGY_SAVING_ZONE: "Configura zone di casa"
├─ GEOFENCE: "Disegna confini"
├─ UPDATE_FREQUENCY: "Cambia frequenza posizioni"
└─ Durata: finché non disattivi
sendSetting(ACTIVATE, ENERGY_SAVING_ZONE) = "Voglio che stia sempre in risparmio energetico quando è a casa"
```


## WiFi SSID/BSSID e BLE Beacon
```shell
--------------------- WiFi SSID/BSSID ----------------------
Usa il router che hai già a casa 

SSID = "MioWiFi"  (il nome della rete WiFi che vedi)
BSSID = "AA:BB:CC:DD:EE:FF"  (l'indirizzo MAC del router)

Quando crei una zona ESZ, dici al device:
"Se vedi il WiFi con SSID 'MioWiFi' e BSSID 'AA:BB:CC:DD:EE:FF',
allora sei a casa, attiva risparmio energetico"

Device fa:
├─ Scansione WiFi: "Vedo 'MioWiFi' con BSSID 'AA:BB:CC:DD:EE:FF'"
├─ Confronta: "Corrisponde alla mia zona ESZ!"
├─ Imposta: collar_detached = 1 (sono a casa)
└─ Invia heartbeat al Sentinel

--------------------- BLE Beacon ---------------------

È come un piccolo trasmettitore Bluetooth che metti a casa
che dice: "Ciao, sono il beacon di casa!"

Device fa:
├─ Scansione BLE: "Trovo beacon con ID 'ABC123'"
├─ Confronta: "Corrisponde al beacon della mia zona ESZ!"
├─ Imposta: collar_detached = 1 (sono a casa)
└─ Invia heartbeat al Sentinel

```

<!-- region LIVE TRACKING -->

1. User action: "Attiva tracciamento real-time per 15 minuti"
   - App chiama: `sendCommand({ commandType: "LIVE_TRACKING", id: deviceId, duration: 900 })`
2. App si sottoscrive a: `onGpsMessagePosition(deviceId)`
   - Riceve posizioni in tempo reale ogni ~5 secondi
3. User action: "Disattiva tracciamento"
   - App chiama: `sendCommand({ commandType: "LIVE_TRACKING", id: deviceId, duration: 0 })`
4. App unsubscribe da `onGpsMessagePosition`
   - Ritorna alle posizioni normali (ogni ~4 minuti)


1. User action: "Attiva tracciamento real-time per 15 minuti"
   └─> App chiama: sendCommand(
   {
   commandType: "LIVE_TRACKING",
   id: deviceId,
   duration: 900  // secondi
   }
   )

2. App si sottoscrive a: onGpsMessagePosition(deviceId)
   └─> Riceve posizioni in tempo reale ogni ~5 secondi

3. User action: "Disattiva tracciamento"
   └─> App chiama: sendCommand(
   {
   commandType: "LIVE_TRACKING",
   id: deviceId,
   duration: 0  // 0 = disattiva
   }
   )_

4. App unsubscribe da onGpsMessagePosition
   └─> Ritorna alle posizioni normali (ogni ~4 minuti)

<!-- endregion -->

<!-- region ENERGY SAVING AREA -->
Creo una zona safe legata al mio wifi (+ quelli attorno) per determinare che quando entra li dentro di mettersi in rispsrmio energetico
non riceve comandi (torcia/suono ecc) semplicemente mi notifica se esce da quella zona:
USE-CASE: situazione tipico in cui sta nell'80% del tempo, lo lascio sempre in ESA on e quando lo porto a fare bisogni al max mi arriva una notifica, 
e appena rientriamo a casa si rimette subito in rispramio energetico.
```markdown
Device entra/esce da ESZ
    ↓
Sentinel calcola: in_energy_saving_zone = true/false
    ↓
send_status_message() → SQS gps_messages queue
    ↓
gpsMessagesConsumer riceve il STATUS message
    ↓
publishOnGpsMessageStatus() → GraphQL subscription
    ↓
📡 SOCKET WebSocket (in-app only)
```

Riassunto
**Setup Iniziale:**
User crea zona sicura → `sendSetting(CREATE, ENERGY_SAVING_ZONE, ...)`
**Attivazione:**
User attiva → `sendSetting(ACTIVATE, ENERGY_SAVING_ZONE, deviceId)`
**Ricezione Notifiche:**
App ascolta `onGpsMessageStatus(deviceId)` → stato energySavingMode
**Disattivazione:**
`sendSetting(DEACTIVATE, ENERGY_SAVING_ZONE, deviceId)`
**Gestione:**
Update/Delete zone tramite `sendSetting(UPDATE/DELETE, ...)`

SETUP INIZIALE:
1. User: "Voglio creare una zona sicura a casa mia"
   └─> App chiama: sendSetting(
   {
   operationType: "CREATE",
   settingType: "ENERGY_SAVING_ZONE",
   createObject: {
   name: "Casa",
   position: {lat: 44.5024, lng: 11.3463},
   radius: 100,
   ssid: "MioWiFi",
   bssid: "AA:BB:CC:DD:EE:FF",
   icon: "home"
   }
   }
   )
   └─> Zona salvata in DB

ATTIVAZIONE:
2. User: "Attiva modalità risparmio energetico per il dispositivo"
   └─> App chiama: sendSetting(
   {
   operationType: "ACTIVATE",
   settingType: "ENERGY_SAVING_ZONE",
   deviceId: deviceId
   }
   )
   └─> Device entra in "energy saving mode"

RICEZIONE NOTIFICHE:
3. App ascolta: onGpsMessageStatus(deviceId)
   ├─> energySavingMode: "ON"
   ├─> inEnergySavingZone: true/false
   └─> Riceve notifiche quando entra/esce dalla zona

DISATTIVAZIONE:
4. User: "Disattiva modalità risparmio energetico"
   └─> App chiama: sendSetting(
   {
   operationType: "DEACTIVATE",
   settingType: "ENERGY_SAVING_ZONE",
   deviceId: deviceId
   }
   )

GESTIONE:
5. User: "Modifica la zona di casa"
   └─> App chiama: sendSetting(
   {
   operationType: "UPDATE",
   settingType: "ENERGY_SAVING_ZONE",
   updateObject: {
   id: zoneId,
   name: "Casa nuova",
   position: {lat: 44.5030, lng: 11.3470},
   ...
   }
   }
   )

6. User: "Elimina la zona"
   └─> App chiama: sendSetting(
   {
   operationType: "DELETE",
   settingType: "ENERGY_SAVING_ZONE",
   id: zoneId
   }
   )
<!-- endregion -->

<!-- region GEOFANCE -->
```markdown
Device esce da geofence
    ↓
Sentinel calcola: petlink_outside_geofence = true
    ↓
geofence_manager.rs (riga 185-198):
  send_notification_message() → SQS notifications queue
    ↓
notificationsConsumer riceve il messaggio
    ↓
sendGeofencePush() → Firebase Cloud Messaging
    ↓
📲 NOTIFICA PUSH su app (anche se app è chiusa!)
```
Creo una zona safe tramite a 6coordinate,
USE-CASE: ho un giardino molto grande, che supera il raggio del mio wifi, voglio lasciarlo giocare ma voglio mi venga notificato 
(e scatti il live-tracking) se per caso esce dal cancello

Riassunto
**Creazione:**
User disegna area (6 punti) → `createGeofence({ name, position: [...] })`
**Attivazione:**
`sendSetting(ACTIVATE, GEOFENCE, deviceId, coordinates)`
**Monitoraggio:**
App ascolta `onGpsMessageStatus(deviceId)` → Se esce, auto-attiva LIVE_TRACKING
**Disattivazione:**
`sendSetting(DEACTIVATE, GEOFENCE, deviceId)`
**Modifica:**
`updateGeofence()` o `deleteGeofence()`

CREAZIONE:
1. User: "Disegna un'area (6 punti) dove il pet non deve uscire"
   └─> App chiama: createGeofence(
   {
   name: "Giardino",
   position: [
   {lat: 44.5, lng: 11.3},
   {lat: 44.5, lng: 11.35},
   {lat: 44.55, lng: 11.35},
   {lat: 44.55, lng: 11.3},
   {lat: 44.505, lng: 11.32},
   {lat: 44.495, lng: 11.32}
   ]
   }
   )

ATTIVAZIONE:
2. User: "Attiva alerta per questo geofence"
   └─> App chiama: sendSetting(
   {
   operationType: "ACTIVATE",
   settingType: "GEOFENCE",
   deviceId: deviceId,
   geofence: [6 coordinate come sopra]
   }
   )
   └─> Device inizia a monitorare il confine

MONITORAGGIO:
3. App ascolta: onGpsMessageStatus(deviceId)
   ├─> geofence: "ON"
   ├─> inGeofence: true/false
   └─> Se esce → Backend auto-attiva LIVE_TRACKING (!)

4. App ascolta: push notifications
   ├─> "Il tuo pet è uscito dal giardino! Attivando tracciamento..."
   └─> Riceve la posizione real-time

DISATTIVAZIONE:
5. User: "Disattiva geofence"
   └─> App chiama: sendSetting(
   {
   operationType: "DEACTIVATE",
   settingType: "GEOFENCE",
   deviceId: deviceId
   }
   )

MODIFICA:
6. User: "Ridisegna il confine"
   └─> App chiama: updateGeofence(
   {
   id: geofenceId,
   name: "Giardino grande",
   position: [6 nuove coordinate]
   }
   )

7. User: "Elimina il geofence"
   └─> App chiama: deleteGeofence(geofenceId)


<!-- endregion -->




DEVICE NORMALE (NO ESZ)
- Heartbeat: ✅ Ogni 5-10 secondi 
- GPS: ✅ SEMPRE ACCESO
  └─ Invia posizione (lat,lon,acuracy) ogni 30-60sec

DEVICE IN ESZ (A CASA)
- Heartbeat:  Ogni 30-60 secondi (RIDOTTO)
- GPS: ❌ SPENTO
  └─ Invia posizione (lat,lon,acuracy) ogni 30-60sec (ma ricavata via WiFi/BLE Scan)
  
DEVICE IN ESZ (FUORI DA CASA)
- Wifi di casa non più rilevato
- GPS: ✅ RIACCESO
  └─ Invia posizione (lat,lon,acuracy) ogni 30-60sec di nuovo, ma presa via GPS?


ESZ quando rileva il suo WIFI:
1- Disattiva GPS (e si rifà alla posizione tramite il suo WiFi/BLE scan)
2- Riduce frequenza heartbeat:
  - normale: ogni 5-10secondi
  - ESZ: ogni 30-60secondi
  Messaggio HB
     │ HEARTBEAT (Packet 0x01)                                    
     ├─ Contiene: batteria, stato, flag WiFi, ecc              
     ├─ Scopo: "Ciao, sono vivo!"                               
     └─ Invia a Sentinel: SEMPRE
  
3- Riduce frequenza aggiornamento posizioni
  - normale: ogni 30-60secondi
  - ESZ: ogni 4-5minuti
  - LIVE_TRACKING: ogni 5secondi
  Messaggio Position                     
    ├─ Contiene: latitude, longitude, accuracy                
    ├─ Scopo: "Ecco dove sono"                                
    └─ Invia a Sentinel: SOLO se posizione è nuova


```shell
🔄 Il Device Invia SEMPRE lo Stesso Formato (Packet 0x01)
Non invia pacchetti diversi. Invia sempre Packet 0x01 con la stessa struttura, ma:

✅ Alcuni campi si aggiornano frequentemente (battery, temperature)
✅ Alcuni campi si aggiornano raramente (posizione GPS)
✅ Alcuni campi sono condizionali (GPS solo se acceso)
┌─────────────────────────────────────────────────────────────┐
│              PACKET 0x01 (Sempre lo stesso)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ SEMPRE PRESENTE (aggiornato ogni heartbeat):               │
│  ├─ device_id, imei, iccid, fw_version                     │
│  ├─ battery ← AGGIORNATO OGNI 5-10 SEC                     │
│  ├─ temperature, speed                                      │
│  ├─ csq (signal quality), ber                               │
│  ├─ curr_status, notifications                             │
│  └─ spare_c5 ← CONTIENE collar_detached flag!              │
│                                                             │
│ CONDIZIONALMENTE (se disponibile):                         │
│  ├─ latitude, longitude ← AGGIORNATO OGNI 30-60 SEC (GPS)  │
│  ├─ altitude                                                │
│  └─ last_gps_time                                           │
│                                                             │
│ OPZIONALMENTE (se info_flag lo indica):                    │
│  ├─ gsm_cells[] ← SCANSIONATI OGNI HEARTBEAT               │
│  │  └─ CID, LAC, MCC, MNC, signal strength                 │
│  └─ wifi_cells[] ← SCANSIONATI OGNI HEARTBEAT              │
│     └─ MAC address (BSSID), SSID, signal strength (RSSI)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```


```shell
Sentinel riceve Packet 0x01
  │
  ├─ STEP 1: Estrae dati
  │  └─ lat, lon, battery, collar_detached, gsm_cells[], wifi_cells[]
  │
  ├─ STEP 2: Sceglie quale posizione usare (GPS o API)
  │  ├─ Se lat != 0 && lon != 0
  │  │  └─ Usa GPS direttamente ✅
  │  │
  │  ├─ Se lat == 0 && wifi_cells[] non vuoto
  │  │  └─ Chiama API UnwiredLabs con WiFi ✅
  │  │
  │  └─ Se lat == 0 && gsm_cells[] non vuoto
  │     └─ Chiama API UnwiredLabs con GSM ✅
  │
  ├─ STEP 3: Controlla se è cambiato collar_detached
  │  ├─ Se 0→1 (entra in ESZ)
  │  │  └─ Invia notifica ENERGY_SAVING_ZONE_IN a SQS ✅
  │  │
  │  └─ Se 1→0 (esce da ESZ)
  │     └─ Invia notifica ENERGY_SAVING_ZONE_OUT a SQS ✅
  │
  ├─ STEP 4: Controlla se è violato il geofence
  │  ├─ Se esce dal geofence
  │  │  ├─ Invia notifica GEOFENCE_OUT a SQS ✅
  │  │  └─ Auto-attiva LIVE_TRACKING ✅
  │  │
  │  └─ Se entra nel geofence
  │     └─ Invia notifica GEOFENCE_ACTIVE a SQS ✅
  │
  ├─ STEP 5: Controlla se è cambiata la batteria
  │  └─ Invia status message a SQS: gps_status ✅
  │
  └─ STEP 6: Invia posizione a SQS: gps_messages ✅
```
