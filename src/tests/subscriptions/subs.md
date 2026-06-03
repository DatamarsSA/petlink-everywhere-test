
## PREMESSE
*note prepaid/paidexternally/trial o altre sub diverse, lo sono, perchè legate al planprofile del device, non serve premock mio di stuazioni particolari
~~- Buy device~~ aggiri semplciemetne aggiungendo all'inventory un device con quei plan profile (che quindi dovrebbero tornare n tipi di sub disponibili)

CHARGE -> pay once (es pet protection),
ADDON -> renew, bind to sub (es device protection)

ADDON lives with sub:
- if cancel SUB- cancel ADDON
- if cancel ADDON -> not cancel SUB
If schedule change for sub, change also addonId (new Id)


## [] DEFAULT
-BUY
~~- buy normal sub -> return 200~~
~~- if KIPPY, I have to can buy DEVICE protection~~
~~- If KIPPY & IT, I have to can buy both PET & DEVICE protection~~


~~-CHANGE (monthly than yearly)~~
~~- bought 2 years -> return 200~~
~~- after 1 purchase -> bought 1 year -> return 200 -> & assert add 1 schedule change~~
~~- after first schedule change -> try to change one more time -> should fail (only 1 schedule change at time is allowed)~~
- I could be able to change toghether at sub also the addon

-AUTOMATIC_RENEW
- buy sub
- at nextBillingDate on CB -> if card with money -> normal renew (1more invoice with status payment_succeeded)
- at nextBillingDate on CB -> if card without money -> DUNNING, chargebee retries renew until max 28gg -> if you still no have money after 28gg -> cancel sub (1more invoice with status payment_due)
NOTE: if dunning for 25 days, and I recharged and pay at 25day, we move nextBillingDate after 25days
~~NOTE: other payment method: paypal, google pay e apple pay?~~  are not testable

-STOP renewal
- buy sub
- stop sub (and addon) -> no automatic renew at the end (features available until the end)

-CANCEL
- buy sub
- ask refund -> cancel sub -> sub stoppata (features not more available)
*se STOP renewal -> pay penale delta till 4 month //se faccio 1month, e stop renew, deve comunque pagare in totale per almeno 4 mesi (quindi pagherà delta tra dove è arrivato e fine 4mesi)
*se CANCEL -> no pay penale


## [] TRIAL (Esselunga or Trial 1 month)
legate a planProfile, 1 device -> legato a quel planProfile
- When user enter in app -> insert card and select plan for renewal at the end of the trial -> and sub should be available
  - if profile 1 month -> you can choose any plan for the expiration of the trial
  - if profile esselunga (1 year) -> you can choose only 1 year for the expiration of the trial


## [] PAID_EXTERNALLY (Axa, Europass)
legate a planProfile, 1 device -> legato a quel planProfile
- When user enter in app -> sub should be available
  - if EUROPASS -> 52 weeks available -> after 52week, user cct add freePeriod of other 52 weeks 
    - in fase di registrazione 54, e in fase di rinnovo sempre 52
  - if AXA -> 12 years available -> after 12year, user cct add freePeriod of other 52 weeks
- There is not automatic renewal, user pay insurance, insurance call us and cct add another sub on cct (not paying flow)


## [] PREPAID
- user buy device on external store (shopify or other)
- after purchase user opne ours hostedpage to buy sub
- when user enter on app should can see active sub for that device
//Con VLADIMIR eravamo rimasti qua


## [x] NOT_PAYING 
- Assign free period for device with no subscription -> sub should create on our db
- Assign free period for device with subscription in CB -> should add days to existing active sub


## [x] COUPON
Se ho un coupon quello deve scontare la sub
- User buy a subscription with a coupon already assigned (before, by cct user)
~~- User buy a subscription with a coupon to assign during purchase flow~~ (mai passato coupon lato frontend)



PAID_EXTERNALLY (Axa, Europass) & TRIAL (Esselunga or Trial 1 month)
Entrambi basta associare un serialNUmber a 1 planProfile lato be ed è fatto



