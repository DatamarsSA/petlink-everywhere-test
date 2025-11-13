/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │ STEP 1: USER SETUP (Una sola volta)                        │
 * └─────────────────────────────────────────────────────────────┘
 *
 * User: "Voglio creare una zona sicura a casa"
 *   ↓
 * App chiama: sendSetting({
 *   operationType: "CREATE",
 *   settingType: "ENERGY_SAVING_ZONE",
 *   createObject: {
 *     name: "Casa",
 *     position: {lat: 44.5024, lng: 11.3463},
 *     radius: 100,
 *     ssid: "MioWiFi",
 *     bssid: "AA:BB:CC:DD:EE:FF"
 *   }
 * })
 *   ↓
 * Backend salva la zona in DB
 *   ↓
 * ✅ Zona creata (ma NON ancora attiva!)
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ STEP 2: USER ACTIVATION (Quando vuole)                     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * User: "Attiva risparmio energetico per il mio device"
 *   ↓
 * App chiama: sendSetting({
 *   operationType: "ACTIVATE",
 *   settingType: "ENERGY_SAVING_ZONE",
 *   deviceId: "device123"
 * })
 *   ↓
 * Backend invia comando al device:
 *   └─ "Attiva ESZ con WiFi SSID='MioWiFi' BSSID='AA:BB:CC:DD:EE:FF'"
 *   ↓
 * Device riceve il comando e memorizza il WiFi
 *   ↓
 * Device inizia a scansionare il WiFi ogni heartbeat
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ STEP 3: DEVICE DETECTS WIFI (Automatico)                   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Device scansiona WiFi:
 *   ├─ Trova: "MioWiFi" con BSSID "AA:BB:CC:DD:EE:FF"
 *   ├─ Confronta: "Corrisponde alla mia zona ESZ!"
 *   ├─ Imposta: collar_detached = 1
 *   ├─ Spegne GPS (lat=0, lon=0)
 *   ├─ Riduce heartbeat: ogni 30-60 sec (invece di 5-10)
 *   └─ Invia Packet 0x01 con collar_detached=1
 *     ↓
 * Sentinel riceve il pacchetto:
 *   ├─ Legge: collar_detached = 1
 *   ├─ Controlla: è cambiato da 0→1?
 *   ├─ SÌ → Invia notifica ENERGY_SAVING_ZONE_IN a SQS
 *   └─ Aggiorna DB: operating_status = HOME_WIFI
 *     ↓
 * App riceve notifica via GraphQL subscription:
 *   └─ "Il tuo pet è entrato nella zona sicura! Modalità risparmio attiva."
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ STEP 4: DEVICE LEAVES ZONE (Automatico)                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Device scansiona WiFi:
 *   ├─ NON trova "MioWiFi"
 *   ├─ Imposta: collar_detached = 0
 *   ├─ Riaccende GPS
 *   ├─ Aumenta heartbeat: ogni 5-10 sec (normale)
 *   └─ Invia Packet 0x01 con collar_detached=0
 *     ↓
 * Sentinel riceve il pacchetto:
 *   ├─ Legge: collar_detached = 0
 *   ├─ Controlla: è cambiato da 1→0?
 *   ├─ SÌ → Invia notifica ENERGY_SAVING_ZONE_OUT a SQS
 *   └─ Aggiorna DB: operating_status = DEFAULT
 *     ↓
 * App riceve notifica via GraphQL subscription:
 *   └─ "Il tuo pet è uscito dalla zona sicura! Tracciamento attivato."
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ STEP 5: USER DEACTIVATION (Quando vuole)                   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * User: "Disattiva risparmio energetico"
 *   ↓
 * App chiama: sendSetting({
 *   operationType: "DEACTIVATE",
 *   settingType: "ENERGY_SAVING_ZONE",
 *   deviceId: "device123"
 * })
 *   ↓
 * Backend invia comando al device:
 *   └─ "Disattiva ESZ"
 *   ↓
 * Device dimentica il WiFi e torna a normale:
 *   ├─ Riaccende GPS (sempre)
 *   ├─ Aumenta heartbeat: ogni 5-10 sec
 *   └─ Invia Packet 0x01 con collar_detached=0
 */
