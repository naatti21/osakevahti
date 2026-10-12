# Osakevahti — repo-first QA-handoff

**Tila:** toimintamalli luonnos-PR:ssä, ei vielä tuotannossa. **Yhteinen playbook:** v1.8 (12.10.2026).  
**Edellisen QA8-uusinnan kohde:** PR #1, SHA `1686f91a6ccfe259c1890e13c89ea88b531862ac`. **Seuraavan riippumattoman QA:n kohde:** koonti-PR #4:n viimeisin SHA, kun CI on hyväksytysti ajettu.  
**Tämä yhdistetty koonti:** luonnos-PR #4 (perustuu korjaus-PR #3:een). QA8-vastatestit ja OCR-testiaineisto on portattu PR #2:sta. Uudet CI-tulokset koskevat vain testissä näkyvää täsmällistä SHA:ta.

## Tavoite

Käyttäjän ei tarvitse siirtää ZIP-paketteja ja pitkiä prompteja kehittäjän ja riippumattoman QA:n välillä. GitHubin PR-keskustelu toimii yhteisenä tilannekuvana. GitHub Actions suorittaa koneelliset testit ja säilyttää niistä ladattavat raportit. Work-agentti tekee riippumattoman tulkinnan ja käyttää tarvittaessa omia lisätestejä.

## Roolit ja julkaisuportti

- **Kehittäjä:** tekee korjaukset testattavaan haaraan, antaa SHA:n, testilinkit ja riskirajaukset PR-kommentissa.
- **GitHub Actions:** ajaa selaintestit, OCR-stressin ja 15 QA8:n lähde-evidenssin vastatestiä. `test-results/qa8-guards.json` sisältää yksilöidyt tarkistukset. OCR:n screenshotit ja Playwright-jäljet ovat `ocr-stress-report`-artefaktissa.
- **Riippumaton Work-QA:** lukee PR:n, lukitsee SHA:n, tarkistaa CI:n raakalogit ja varmistaa rajatut riskit myös oikeassa selaimessa. Kirjoittaa raportin samaan PR-keskusteluun **jos sillä on GitHubin kommentointioikeus**; muuten palauttaa tekstin keskusteluun.
- **Käyttäjä:** antaa erillisen nimenomaisen luvan vasta riippumattoman GO:n jälkeen. Kukaan ei yhdistä PR:ää, päivitä `main`ia tai julkaise sitä ilman tätä lupaa.

## Yksi Work-käynnistysviesti

> Tarkasta riippumattomasti repo `naatti21/osakevahti`, PR #1. Lue PR:n uusin QA-handoff, lukitse testattava SHA ja käy läpi GitHub Actionsin tulokset sekä avoimet release-esteet. Tee ensin P1-vastatestit, sitten selainpysyvyys ja vasta lopuksi lisä-OCR. Kirjaa PASS/FAIL/PARTIAL/NOT RUN, toisto-ohjeet ja GO/NO-GO PR-keskusteluun, jos oikeus sallii. Älä muuta koodia, testiodotuksia, haaroja tai julkaise mitään.

**Käyttösuositus:** Workin saatavilla oleva riittävän kevyt malli, Medium-päättely aluksi. Astra/Pro tai korkein päättely vain todelliseen vaikeaan esteeseen. Koneellisesti jo läpäistyjä stressiajoja ei ajeta Workissa uudelleen ilman perustetta. Tallenna väliraportti ensin, keskeytä P1-regressioon.

## Testien komennot ja merkitys

- `npm test`: tavalliset Playwright-selaintestit; **ei** OCR-stressiä.
- `npm run test:qa-import`: QA8:n 15 lähde-identiteetin tuotantofunktiotestiä; synteettinen resolveri ja tallennusstub; **ei** oikeaa OCR:ää tai selainpysyvyyttä.
- `npm run test:ocr`: oikea Tesseract Node-prosessissa synteettisille kuville sekä selaimen OCR-kirjaston lataustesti; **ei** täysi käyttäjän alkuperäisten 46 kuvan selainketju.
- `OCR stress` -työnkulku PR:ssä on aluksi **advisory**: vaikka workflow olisi vihreä, katso jokaisen testivaiheen **outcome**, julkaistu yhteenveto ja raakaraportti. `main`-ajossa testivirheet estävät tämän työnkulun onnistumisen.

Nämä automaattiset testit kattavat vain osan historiallisesta korpuksesta. Älä väitä niitä QA8:n 408 testin tai 46 kuvafikstuuran täydeksi uudelleensuoritukseksi.

## Viimeisin riippumaton QA8-uusinta (12.10.2026)

**Lukittu SHA:** `1686f91a6ccfe259c1890e13c89ea88b531862ac`. Raportti ja alkuperäinen 28 Mt:n testipaketti vastaanotettu keskustelussa. Tarkisteet:

- Raportti SHA256: `336d09a6a5d15c35a07a7bc09a221d46ed000b18f5db64d6e9c35c6e49556af0`
- ZIP SHA256: `b85e6730d66013f96d8caacc800d8dde24f23fdeb5c85c4926d1916b8a6bcf8d`

Tulos: **PARTIAL / NO-GO**. Q8-01–Q8-04 15/15, selaimen tallennus 4/4. Vanha 408-korpus 346/408 raakaa PASSia; vanhat OCR-kuvat 33/42, neljä QA8-kuvaa 4/4. Oikea selain-OCR paikallisilla resursseilla 1/1 PASS. Avoimina DEV-04:n hyväksyntäsopimus, normaalin CDN/OCR-verkkolatauksen todentaminen, IQM-kuvan OCR-esikatselu ja fyysinen Android/PWA. Nämä eivät poistu vain siksi, että uusi pienempi automaattitesti on vihreä.

**Auktoritatiivinen PR-kommentti:** https://github.com/naatti21/osakevahti/pull/1#issuecomment-6120298480

## QA-kommentin vähimmäispohja

1. PR ja testattu **täysi commit-SHA** (ei pelkkä haara).
2. Testimenetelmät, testattu versio ja fixture-lähteet/tarkisteet.
3. Kullekin kerrokselle PASS/FAIL/PARTIAL/NOT RUN; raakatulokset muuttumattomina.
4. Todelliset P1/P2-virheet, syy, toisto ja mahdolliset ympäristöesteet.
5. Tallennus / reload / peruutus ja vanhan salkun muuttumattomuus.
6. OCR-mock / Node-Tesseract / oikea selain-Tesseract / CDN / fyysinen Android eroteltuina.
7. Lopullinen **GO/NO-GO** sekä CI-/artefaktilinkit.

## Huomio GitHub-oikeuksista

Riippumattoman QA-agentin on käytettävä omaa GitHub-yhteyttään. Sen mahdolliset PR-kommentit eivät todista QA:n onnistumista, ellei testaus ole oikeasti suoritettu. Tällä hetkellä tästä keskustelusta **ei** voi käynnistää erillistä Work-agenttia automaattisesti, joten käyttäjä lähettää yllä olevan yhden aloitusviestin.

**Säilytys:** GitHub Actions -artefaktit ovat väliaikaisia (työnkulussa 7 päivää). Löydösten pysyvä yhteenveto jää PR-kommenttiin; vanha laaja ZIP säilyy erillisessä arkistossa. Älä pakkaa riippuvuuskansioita tai henkilötietoja repoihin.

## Koonti-PR:n rajoitus

Tämä dokumentti ei itsessään ole GO-lupa. Jokainen tuotantoversio vaatii itsenäisen QA:n ja käyttäjän nimenomaisen hyväksynnän. Korjattuun versioon kuuluvan ISIN-vahvistuksen vuoksi vanhat odotukset automaattisesti hyväksytystä **vahvistamattomasta** ISINistä ovat tarkoituksellisesti vanhentuneet. OCR:n todellinen verkkoketju ja Android-PWA ovat erilliset release-tarkastukset.
