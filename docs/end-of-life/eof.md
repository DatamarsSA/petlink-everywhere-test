getPlansEOL, torna sia plans che deviceId


API:
- getEndOfLifeStep
- getEndOfLifePlans
- checkoutEndOfLifeNewDevice
- getEndOfLifeStep
- updateEndOfLife

TODO:
- nell'invnetoru devo chiedere che il evo dog device abbia una scadenza prima del 2027 per poter avere il boolenao endOfLife da getProducts a true


STEP 1-7 - graphql interni - updateEndOfLife
STEP 8 Redirect esterno (allo step EXTERNAL_PAGE) a shopUrl (dinamico)

Il FE può solo:
Chiamare updateEndOfLife per aggiornare lo step in cui seei
Chiamare checkoutEOLNewDevice per generare URL, è il BE che chiama daniele

DUE possibili URL Daniele:
1 Flow DEVICE-ONLY: - Esemio: https://app.kippy.io/pets/dog-123/products/device-456/eol/thank-you
- {baseUrl}/pets/{petId}/products/{productId}/eol/thank-you


2 Flow DEVICE + SUBSCRIPTION:
- {orderFeUrl}?tk={token} - Esempio: https://orders.daniele-system.com/checkout?tk=abc123

Il BE

🎯 Differenze Chiave
Campo	Flow 1 (Device-Only)	Flow 2 (Device+Sub)
Numero chiamate	1	2
subscriptionId	null	"sub-456"
shopUrl finale	callBackUrl (thank-you)	orderUrl (Chargebee)
needPayDevice	Dipende da devicePrice	Dipende da devicePrice

```typescript
// FE
// FE chiama SOLO queste API
1. getPlansEOL() → per verificare elegibilità
2. updateEndOfLife() → per aggiornare step
3. checkoutEOLNewDevice() → per generare URL esterno

// BE
// BE riceve checkoutEOLNewDevice() dal FE
1. Calcola needPayDevice da solo
2. Prende subscriptionId dal DB
3. Chiama Daniele con questi dati
4. Genera shopUrl e la torna al FE


//////////////////////// FE flow ////////////////////////
// 1. FE aggiorna step con shipping info
await updateEndOfLife({
    eolId,
    deviceId,
    input: {
        step: "SHIPPING_INFO_DEFINED_BEFORE_EXTERNAL_PAGE",
        shippingInfo: { firstName, lastName, address, ... }
    }
});

// 2. FE chiede URL esterno
const response = await checkoutEOLNewDevice({ eolId });
// response.checkoutEOLNewDevice.url = "https://app.kippy.io/.../thank-you"

// 3. FE fa redirect
window.location.href = response.checkoutEOLNewDevice.url;

//////////////////////// BE flow ////////////////////////
// 1. BE calcola da solo
const needPayDevice = devicePrice.discountPercentage != 100; // ← BE calcola
const subscriptionId = endOfLifeItem.subscriptionId; // ← prende dal DB

// 2. BE chiama Daniele
POST orderSystemUrl {
    subscriptionId: null, // ← dal DB
        needPayDevice: true/false, // ← calcolato da BE
        callBackUrl: "/thank-you"
}

// 3. BE torna URL al FE
return { url: shopUrl }; // ← thank-you page


```
