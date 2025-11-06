
-------------------------APP FLOW (Live Tracking)--------------------------------------

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
   )

4. App unsubscribe da onGpsMessagePosition
   └─> Ritorna alle posizioni normali (ogni ~4 minuti)


-------------------------APP FLOW (Energy Saving Zone)--------------------------------------

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

--------------------------------APP FLOW (Geofence)-------------------------------

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
---------------------------------------------------------------
Core Point: Tutti e tre partono con User → App → Core → Sentinel. La differenza è COSA Sentinel fa dopo.
---------------------------------------------------------------

Per il Test	Codice	Output
Live Tracking	User → sendCommand() → Device cambia velocità	✅ Posizioni ogni 5 sec
Energy Saving Zone	User → sendSetting(ACTIVATE) → Sentinel monitora → Device entra zona	✅ Push: "Pet in ESZ"
Geofence	User → sendSetting(ACTIVATE) → Sentinel monitora → Device esce zona	✅ Push: "Pet left" + Auto LIVE_TRACKING


# App Flows Documentation

<!-- region Live Tracking -->
## Live Tracking

1. User action: "Attiva tracciamento real-time per 15 minuti"
   - App chiama: `sendCommand({ commandType: "LIVE_TRACKING", id: deviceId, duration: 900 })`

2. App si sottoscrive a: `onGpsMessagePosition(deviceId)`
   - Riceve posizioni in tempo reale ogni ~5 secondi

3. User action: "Disattiva tracciamento"
   - App chiama: `sendCommand({ commandType: "LIVE_TRACKING", id: deviceId, duration: 0 })`

4. App unsubscribe da `onGpsMessagePosition`
   - Ritorna alle posizioni normali (ogni ~4 minuti)
<!-- endregion -->

<!-- region Energy Saving Zone -->
## Energy Saving Zone

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
<!-- endregion -->

<!-- region Geofence -->
## Geofence

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
<!-- endregion -->