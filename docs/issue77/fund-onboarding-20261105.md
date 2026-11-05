# Issue #77 — rahaston lisäyspolku, 5.11.2026

**Tila: PARTIAL / NO-GO julkaisuun.** Yksi manuaalisen NAV:n käyttäjäpolku on toteutettu ja testattu. Tämä ei sulje koko Issue #77:ää eikä hyväksy PR-pinoa julkaistavaksi.

## Tarkastettu pino järjestyksessä

| PR | Tarkastettu HEAD | Havainto |
|---|---|---|
| #86 | `2305643403fbc4c3bcd0a28724e5187fd5aec794` | Instrumentti-/lähdereitityksen puhdas ydin. Ei yksin valmis käyttöliittymä. Nykyiseen Alphaan ristiriidat `package.json` ja `.github/workflows/quality.yml`. |
| #87 | `66dd78017b33c072fee927aa52671d918010ca0e` | Gateway, NAV-sopimus ja vain lukeva esikatselu; ei automaattista portfolioon hyväksyntää. |
| #88 | `572f18d6b17250cde445a17dfeceee4e49b390bb` | Maksuttomien lähteiden kyvykkyysrajat, ei kattavuuslupausta. |
| #89 | `a6a012e087d8909b11a4bf21ee080028be2f96f0` | ISIN-ehdokkaat ja ECB-valuuttaviite; ei itsenäinen rahaston identiteetin varmennus. |
| #90 | `c68e52a84ea1a99391774b66421f6e187453577d` | Kokeellinen julkinen NAV. Yli 7 päivän havainto katosi `null`-tulokseksi. Käyttöoikeuksia ei ole tässä työssä vahvistettu. |

GitHubin HTML-sivut olivat luettavissa HTTP 200:lla ja kaikki viisi näkyivät Draft-tilassa. Git-viitteet tarkistettiin erikseen. GitHubin CI-tilaa ei ole tässä raportissa vahvistettu vihreäksi.

Kehityshaara: `fix/issue77-fund-onboarding-e2e`, pohjana #90. Nykyisen Alphan `e92064a0db5c0a01f2048bb80d900436e2f96c99` kaksi erillistä muutosta (`f0b7fdb`, `e92064a`) kopioitiin cherry-pickillä tähän kehityshaaraan; ristiriidoissa säilytettiin molempien testikomennot. Tuotanto-/Alpha-haaraa tai PR:iä ei yhdistetty eikä muutettu. Tämä ei itsessään korjaa alkuperäisen PR #86:n GitHub-mergeability-tilaa: pinon jatkokäsittely on vielä tehtävä ennen hyväksyntää.

## Toteutettu käyttäjäpolku

Salkku → **+ Lisää rahasto** → koko nimi ja mahdollinen osuuslaji → palveluntarjoaja ja tilin oma nimi → nykyinen kokonaismäärä ja keskihankintahinta → manuaalinen NAV, valuutta, täysi arvostuspäivä ja lähdekuvaus → erillinen vahvistus → tallennus.

- Ei tickeriä, ISIN-arvausta eikä yhtiökohtaista listaa. Nimi jää `unverified`-identiteetiksi. `sourceBinding:null`.
- `instrument`, omistuksen määrä/kustannus/tili ja `quoteObservation` ovat erillisiä tietoja yhteensopivan paikallisen tietueen sisällä. Ei laajaa historiatietojen migraatiota.
- Ennen vahvistusta ei tallenneta. Tallennusvirheessä olemassa oleva portfolio ja täytetty lomake säilyvät.
- Kentän muutos poistaa vahvistuksen. Samanniminen rahasto samalla tilillä estetään konservatiivisesti; eri tilit sallitaan.
- Manuaalinen NAV näkyy **KÄSIN**, arvot **≈**. Puuttuva FX estää tarkan kokonaisarvon. Automaattinen päivitys ei korvaa tämän polun manuaalista NAV:ia.
- Samaa tietuetta voi muokata; keskihinnan muutos ei muuta määrää tai NAV:ia.
- JSON-vienti ja todellinen tiedostopalautus säilyttävät tiedot. Manuaalisen havainnon ristiriitainen valuutta, hinta tai päivä estää palautuksen.
- Uusi moduuli sisältyy offline-kuoreen ja staattisen paketin sallittuihin tiedostoihin.

Tämä polku **ei vielä tarjoa yleistä rahastojen nimihakua, ulkoisesti varmennettua ISIN-valintaa tai uuden automaattisen lähdesidonnan hyväksymistä**. Nykyisen Alphan vanha automaattinen ISIN-varalähde säilytettiin; sen tarkistenumeroon ja valuuttaan perustuva tunnistus ei yksin todista nimeä tai osuuslajia. Älä laajenna sitä yleiseksi varmennetuksi instrumenttipalveluksi.

## NAV-juurisyy ja korjaus

#90:n `getNav` palautti yli viikon vanhasta NAV:sta `null`, jolloin kutsuja ei erottanut vanhentunutta hintaa puuttuvasta instrumentista. Uusi `getNavResult` palauttaa erillisen tilan ja havainnon. Gateway käyttää sitä; vanha nullable-rajapinta säilyy yhteensopivuuden vuoksi ja käyttää samaa ikälaskentaa.

Tilat: `candidate`, `stale_nav`, `no_binding`, `not_found`, `invalid_identity`, `upstream_failed`; manuaalisessa polussa `manual_nav`. Syötteen uusin päivä, instrumentin päivä, noutoaika ja `sourceFeedStale` erotetaan. Epäonnistunut nouto ei muuta aiempaa havaintoa tuoreeksi. #90:n feature flag ja `requiresManualReview:true` säilyvät.

Alphan erilliseen selaimen varalähteeseen lisättiin vastaava diagnostiikka ja käyttäjälle näkyvä syy. **Synteettisessä 5.11.2026 tapauksessa 22.10.2026 NAV on 14 kalenteripäivää vanha**, ei tämän päivän hinta. Vanha salkkuhinta säilyy. Tämä ei ole väite oikean live-syötteen tämänhetkisestä päivämäärästä.

## Todellinen testinäyttö

Sovellus- ja testikoodi: **`adb6784453a02b42bbbb680bba49ff5427194d7b`**. Tätä seuraava raportointicommit muuttaa vain tätä dokumenttia. Node 22 / Playwright 1.57.0; paikallinen `/usr/bin/chromium` 154, ei fyysinen Android.

| Tarkistus | Tulos |
|---|---|
| Ensimmäinen käyttäjäpolun RED | 2 FAIL: rahaston lisäyspainike/polku puuttui |
| Diagnostiikan RED | 3 FAIL: `getNavResult` puuttui; erillinen Alpha-diagnostiikan vastatesti myös FAIL ennen korjausta |
| `node --test tests/*.test.mjs` rakennetulle paketille | **125 PASS / 0 FAIL / 0 SKIP** |
| `node tests/import-qa/qa8-guards.mjs` | **15 PASS / 0 FAIL** |
| Paikallinen staattinen pakkaus | **PASS**, ei julkaisua |
| Deterministinen Chromium-sarja | **207 PASS / 2 FAIL / 0 SKIP** (209 testiä) |
| Uusi käyttäjäpolku (sisältyy edelliseen) | **5 PASS**: 360px-vienti/palautus ja keskihinnan muutos, quota-rollback, puuttuva FX, offline, 14 päivän NAV-varoitus |
| Live-selainyhteydet | **3 FAIL** erillisissä ajoissa: suora FX sekä kaksi live-feed-testiä |
| Oikea Tesseract-stressiajo | **3 FAIL / 5 NOT RUN**: selainlataus/kielidata eivät saatavissa; Node `EAI_AGAIN cdn.jsdelivr.net` |
| Live NAV/OpenFIGI/FX-smoket | **FAIL / palvelun todellinen tila UNKNOWN**: `fetch failed`; NAV-hostin curl CONNECT sai proxylta HTTP **403** |

Deterministinen ajo:

```
npx playwright test -c /tmp/osake-playwright.config.mjs --grep-invert '@ocr-stress|browser fetch from official direct FX|Alpha3 browser gets all six live|Alpha3 original refresh dependencies'
```

Vain luetellut ulkoiset yhteystestit ja erillinen OCR-stressi erotettiin tästä ajosta. Niitä ei poistettu, ohitettu lähdekoodissa tai merkitty odotetuiksi epäonnistumisiksi. Paikallinen config käyttää repoa palvelimen työhakemistona, porttia 4173, kahta workeria ja järjestelmän Chromiumia (`--no-sandbox`). Repon normaali testikonfiguraatio on ennallaan.

`npm ci` ei ollut mahdollinen, koska repo ei sisällä lockfileä. Repon workflow'n mukainen `npm install --no-audit --no-fund --package-lock=false --cache /tmp/osake77-npm-cache` onnistui; riippuvuusversioita ei muutettu. Transitiivisten riippuvuuksien täydellistä lukitusta ei väitetä.

Tuoreen 22.10.-NAV:n vanha testi sidottiin 23.10.2026 kelloon sekä selaimessa että mock-vastauksessa. Kaikki vanhat taloudelliset assertit säilyivät. Uudet testit kattavat erikseen 8/14 päivän vanhenemisen; vanhaa NAV:ia ei piilotettu tuoreeksi. PWA-testipalvelimille lisättiin oikea uusi moduuli, ei tyhjää korvikeresurssia. Uuden painikkeen aiheuttama 320px-ylivuoto korjattiin rivittämällä toimintorivi; vanhat mobiiligeometriatestit läpäisivät lopullisen ajon.

## Jäljellä olevat esteet

1. **PWA FAIL:** `pwa-offline-sw` havaitsi ajoittain `controller:false` asennuksen jälkeen. `pwa-upgrade-path` havaitsi vanhan oman välimuistin uudelleen ilmestyvän päivityksen jälkeen. Assertit säilyvät punaisina. Muuttamattoman Alpha-HEADin erillisessä vertailuajossa oli myös **2 PASS / 3 FAIL** samoissa PWA-tiedostoissa. Siksi nämä eivät ole osoitus yksin uuden rahastomoduulin regressiosta, mutta ne ovat julkaisueste.
2. Automaattisen NAV-lähteen käyttöoikeudet ja osuuslajin/identiteetin riippumaton varmennus ovat avoimia. Manuaalipolku ei ratkaise yleistä automaattista rahastohakua.
3. Live-syötteen uusinta päivää tai testitunnisteen oikeaa live-NAV-päivää ei saatu mitattua tämän ympäristön verkkorajoilla. 14 päivän tulos on deterministinen synteettinen regressio.
4. Oikeaa OCR-ketjua ei saatu ajettua loppuun. Normaali synteettisellä OCR-tekstillä ajettava selainkattaus ei korvaa tätä.
5. Ei GitHub-CI:n vihreää vahvistusta, riippumatonta hyväksyntää tai oikean Android-PWA:n päivitys-/palautusnäyttöä. Nykyiset PR:t eivät ole tämän työn perusteella mergevalmiita.

## QA-handoff

- **WORK:** nimellä lisättävä, paikallisesti vahvistettava rahasto + manuaalinen päivätty NAV + näkyvä stale-diagnostiikka.
- **LOCKED TARGET:** sovellus/testit `adb6784453a02b42bbbb680bba49ff5427194d7b`; raportti tämän päällä.
- **EVIDENCE:** **PARTIAL**, yllä todelliset PASS/FAIL/NOT RUN -luvut.
- **GATE:** riippumaton QA ja käyttäjän Android-hyväksyntä puuttuvat; **NO-GO mergeen/julkaisuun**.
- **ONE NEXT ACTION:** riippumaton arvioija tarkistaa manuaalipolun sekä jäljellä olevan PWA-päivitysvirheen ennen Alpha-julkaisupäätöstä.

Androidissa tarkistettava: lomakkeen näppäimistö/päivävalitsin ja tallennuksen saavutettavuus, määrän/kustannuksen/NAV:n ymmärrettävä ero, KÄSIN/≈/14 päivän varoitus, saman rahaston eri tilit, oikea JSON-tiedoston vienti/palautus, offline-avaus ja asennetun PWA:n päivitys varmuuskopion kanssa. Älä käytä oikeaa salkkua ensimmäisessä kokeessa.
