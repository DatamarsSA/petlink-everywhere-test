# GEOFENCE - Documentazione Completa

## Cosa Fa

Geofence è una **modalità permanente** che crea una zona geografica (poligono con 6 coordinate) e rileva quando il device entra/esce da questa zona. 

**Comportamento critico**: Quando il device **ESCE dal geofence**, Sentinel **AUTO-ATTIVA Live Tracking** per tracciare il pet in tempo reale.

## Differenze Chiave vs ESZ e Live Tracking

| Aspetto | ESZ | Geofence | Live Tracking |
|---------|-----|----------|---------------|
| **Tipo** | Permanente | Permanente | Temporaneo |
| **Attivazione** | User crea zona WiFi | User crea poligono GPS | User preme "Traccia" |
| **Durata** | Finché attivo | Finché attivo | 15 minuti (default) |
| **Frequenza** | 30-60 sec (ridotta) | 30 sec (normale) | 5 sec (alta) |
| **GPS** | Spento | Acceso | Acceso |
| **Batteria** | Risparmiata | Normale | Consumata velocemente |
| **Trigger** | WiFi rilevato | Esce da poligono | User manual |
| **Auto-Tracking** | No | **SÌ (auto-LT)** | No |

## Flusso Completo

### STEP 1: USER SETUP (Una sola volta)

```
User: "Voglio proteggere il mio pet con una zona sicura"
  ↓
App chiama: createGeofence({
  geofence: {
    name: "Casa",
    position: [
      {lat: 44.5, lng: 11.3},      // Marker 1
      {lat: 44.5, lng: 11.35},     // Marker 2
      {lat: 44.55, lng: 11.35},    // Marker 3
      {lat: 44.55, lng: 11.3},     // Marker 4
      {lat: 44.505, lng: 11.32},   // Marker 5
      {lat: 44.495, lng: 11.32}    // Marker 6
    ]
  }
})
  ↓
Backend salva il geofence in DB (6 coordinate)
  ↓
✅ Geofence creato (ma NON ancora attivo!)
```

### STEP 2: USER ACTIVATION

```
User: "Attiva protezione geofence per il mio device"
  ↓
App chiama: sendSetting({
  operationType: "ACTIVATE",
  settingType: "GEOFENCE",
  deviceId: "device123",
  geofence: [ ...coordinates... ] // NOTA: Backend richiede coordinate esplicite
})
  ↓
Backend invia comando a SQS (commandsConsumer)
  ↓
commandsConsumer riceve il comando
  ├─ Legge: serial_number, iccid, geofence_coordinates
  ├─ Crea payload: { command: GEOFENCE, coordinates: [6 markers] }
  └─ Invia REST call a Sentinel: POST /send_packet
    ↓
Sentinel riceve il comando via REST
  ├─ Controlla: device è connesso?
  ├─ Controlla: device è pronto per nuovo comando?
  ├─ Prepara Packet 0x01 (PacketGeofenceResponse)
  │  ├─ operating_status = OPERATING_STATUS_GEOFENCE_ON
  │  ├─ coordinates = [6 markers]
  │  └─ upd_freq = 30 (secondi, normale)
  └─ Invia il pacchetto al device via socket TCP
    ↓
Device riceve il pacchetto
  ├─ Legge: coordinates = [6 markers]
  ├─ Memorizza le 6 coordinate del poligono
  ├─ Attiva geofence detection
  ├─ Ogni heartbeat: calcola se è dentro/fuori il poligono
  │  └─ Usa algoritmo point-in-polygon (ray casting)
  └─ Invia Packet 0x01 con flag:
     ├─ Se dentro: notifications bit 0x0020 = 1 (inside_geofence)
     └─ Se fuori: notifications bit 0x0040 = 1 (outside_geofence)
```

### STEP 3: DEVICE INSIDE GEOFENCE (Normale)

```
Device è dentro il poligono
  ↓
Ogni heartbeat (30 sec):
  ├─ Device calcola: sono dentro il poligono?
  ├─ Usa algoritmo point-in-polygon
  ├─ Risultato: SÌ, sono dentro
  ├─ Imposta: notifications bit 0x0020 = 1
  └─ Invia Packet 0x01
    ↓
Sentinel riceve il pacchetto
  ├─ Legge: inside_geofence = true
  ├─ Invia notifica: GEOFENCE_ACTIVE a SQS
  └─ Aggiorna DB: device_operating_status = GEOFENCE_ON
    ↓
App riceve notifica
  └─ "Pet is safe at home"
```

### STEP 4: DEVICE EXITS GEOFENCE (Critico!)

```
Device è dentro il poligono
  ↓
Device si muove FUORI dal poligono
  ↓
Ogni heartbeat (30 sec):
  ├─ Device calcola: sono dentro il poligono?
  ├─ Usa algoritmo point-in-polygon
  ├─ Risultato: NO, sono fuori!
  ├─ Imposta: notifications bit 0x0040 = 1
  └─ Invia Packet 0x01
    ↓
Sentinel riceve il pacchetto
  ├─ Legge: outside_geofence = true
  ├─ Invia notifica: GEOFENCE_OUT a SQS
  ├─ Imposta: geofence_triggered_lt = true
  ├─ AUTO-ATTIVA Live Tracking
  │  ├─ Prepara Packet 0x01 (FAST_TRACKING)
  │  ├─ upd_freq = 5 (secondi)
  │  └─ Invia comando al device
  └─ Aggiorna DB: operating_status = FAST_TRACKING
    ↓
Device riceve comando Live Tracking
  ├─ Legge: operating_status = FAST_TRACKING
  ├─ Imposta: heartbeat frequency = 5 secondi
  └─ Inizia tracciamento ad alta frequenza
    ↓
App riceve notifiche
  ├─ GEOFENCE_OUT notification
  ├─ Live Tracking attivato automaticamente
  └─ Posizioni ogni 5 secondi
```

### STEP 5: DEVICE RE-ENTERS GEOFENCE (Ritorno)

```
Device è fuori dal poligono (in Live Tracking)
  ↓
Device si muove DENTRO il poligono
  ↓
Ogni heartbeat (5 sec):
  ├─ Device calcola: sono dentro il poligono?
  ├─ Risultato: SÌ, sono dentro!
  ├─ Imposta: notifications bit 0x0020 = 1
  └─ Invia Packet 0x01
    ↓
Sentinel riceve il pacchetto
  ├─ Legge: inside_geofence = true
  ├─ Invia notifica: GEOFENCE_ACTIVE a SQS
  ├─ Disattiva Live Tracking (timeout scaduto o manuale)
  └─ Aggiorna DB: operating_status = GEOFENCE_ON
    ↓
App riceve notifiche
  ├─ GEOFENCE_ACTIVE notification
  ├─ Live Tracking disattivato
  └─ "Pet is back home"
```

### STEP 6: USER DEACTIVATION

```
User: "Disattiva protezione geofence"
  ↓
App chiama: sendSetting({
  operationType: "DEACTIVATE",
  settingType: "GEOFENCE",
  deviceId: "device123"
})
  ↓
Backend invia comando a SQS
  ↓
Sentinel riceve il comando
  ├─ Legge: geofence_coordinates = [0,0,0,0,0,0] (tutti uguali = deactivate)
  ├─ Prepara Packet 0x01 (PacketGeofenceResponse)
  │  └─ operating_status = OPERATING_STATUS_DEFAULT
  └─ Invia il pacchetto al device
    ↓
Device riceve il pacchetto
  ├─ Legge: operating_status = DEFAULT
  ├─ Disattiva geofence detection
  └─ Torna a normale
    ↓
Sentinel aggiorna DB
  └─ operating_status = DEFAULT
    ↓
App riceve notifica
  └─ Geofence disattivato
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User as User (App)
    participant Core as Core API
    participant DB as MongoDB
    participant SQS as SQS Queue
    participant Sentinel as Sentinel Rust
    participant Device as GPS Device
    participant AppSync as AppSync

    Note over User,Device: STEP 1: Create Geofence
    User->>Core: createGeofence(geofence)
    Core->>DB: Store geofence (6 markers)
    Core->>User: Geofence created ✅

    Note over User,Device: STEP 2: Activate Geofence
    User->>Core: sendSetting(ACTIVATE, GEOFENCE, deviceId, coordinates)
    Core->>DB: Update device: operating_status = ACTIVATING_GEOFENCE
    Core->>SQS: Queue settings message
    SQS->>Sentinel: settingsConsumer trigger
    Sentinel->>Device: Send Packet 0x01 (coordinates + GEOFENCE_ON)

    Note over User,Device: STEP 3: Device Inside Geofence
    Device->>Device: Calculate: inside polygon?
    Device->>Device: Result: YES (inside)
    Device->>Device: Set notifications bit 0x0020 = 1
    Device->>Sentinel: Send Packet 0x01 (inside_geofence=true)
    Sentinel->>DB: Update: device_operating_status = GEOFENCE_ON
    Sentinel->>SQS: Queue notification: GEOFENCE_ACTIVE
    SQS->>AppSync: Publish notification
    AppSync->>User: "Pet is safe at home" 🏠

    Note over User,Device: STEP 4: Device Exits Geofence (CRITICAL!)
    Device->>Device: Calculate: inside polygon?
    Device->>Device: Result: NO (outside!)
    Device->>Device: Set notifications bit 0x0040 = 1
    Device->>Sentinel: Send Packet 0x01 (outside_geofence=true)
    
    Sentinel->>Sentinel: Detect: outside_geofence transition
    Sentinel->>DB: Update: operating_status = FAST_TRACKING
    Sentinel->>DB: Set: geofence_triggered_lt = true
    Sentinel->>SQS: Queue notification: GEOFENCE_OUT
    Sentinel->>SQS: Queue command: LIVE_TRACKING (auto-activate)
    
    SQS->>AppSync: Publish GEOFENCE_OUT notification
    AppSync->>User: "Pet left home!" 🚨
    
    SQS->>Sentinel: commandsConsumer trigger
    Sentinel->>Device: Send Packet 0x01 (FAST_TRACKING, upd_freq=5)

    Note over User,Device: STEP 5: Device in Live Tracking (Auto-activated)
    Device->>Device: Set heartbeat frequency = 5 seconds
    Device->>Sentinel: Send Packet 0x01 (every 5 sec)
    Sentinel->>SQS: Queue gpsMessage (every 5 sec)
    SQS->>Core: gpsMessagesConsumer trigger
    Core->>DB: Update lastKnownPosition
    Core->>AppSync: publishOnGpsMessagePosition
    AppSync->>User: WebSocket position update (every 5 sec)
    User->>User: Update map in real-time 🗺️

    Note over User,Device: STEP 6: Device Re-enters Geofence
    Device->>Device: Calculate: inside polygon?
    Device->>Device: Result: YES (inside!)
    Device->>Device: Set notifications bit 0x0020 = 1
    Device->>Sentinel: Send Packet 0x01 (inside_geofence=true)
    
    Sentinel->>DB: Update: operating_status = GEOFENCE_ON
    Sentinel->>SQS: Queue notification: GEOFENCE_ACTIVE
    SQS->>AppSync: Publish notification
    AppSync->>User: "Pet is back home" ✅

    Note over User,Device: STEP 7: Deactivate Geofence
    User->>Core: sendSetting(DEACTIVATE, GEOFENCE, deviceId)
    Core->>SQS: Queue settings message
    SQS->>Sentinel: Send Packet 0x01 (coordinates=[0,0,0,0,0,0])
    Sentinel->>Device: Deactivate geofence
    Device->>Device: Reset to normal mode
    Sentinel->>DB: Update: operating_status = DEFAULT
```