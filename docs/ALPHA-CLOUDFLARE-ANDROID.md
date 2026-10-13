# Osakevahti Alpha — eristetty Cloudflare Pages / Android -testi

## Alpha 2 → Alpha 3: palautetaan kuusi toimivaa markkinasyötettä

**Sama Cloudflare Pages -projekti ja nykyinen OV Alpha -asennus säilyvät.** Alpha 2:n offline, backup, tilitietojen käsittely ja PWA-päivitys testattiin käyttäjän Androidilla onnistuneesti, mutta kurssipäivityksen fallback ja Osinkokoneiden/Rocket Radarin data olivat rikki Alpha 2:ssa.

**Todistettu juurisyy [testi-PR #22](https://github.com/naatti21/osakevahti/pull/22):** alkuperäinen Alpha-paketti sisälsi vain PWA:n kuusi staattista tiedostoa ja antoi Cloudflaren palauttaa SPA:n HTML-etusivun kuuden odotetun JSON-syötteen polussa (HTTP 200 mutta väärä sisältö). Julkisen GitHub Pages -tuotannon **kaikki kuusi** vastaavat validina JSON:na CORS `*` -otsakkeilla; markkina-Worker vastasi HTTP 200, validina JSON:na, CORS `*`.

**Alpha 3 -korjaus:** julkaistava sovelluskoodi lukee kuusi **julkista ja alkuperäisessä Osakevahdissa käytettyä** datasyötettä read-only-osoitteista `https://naatti21.github.io/osakevahti/{file}.json`. Käytössä `cache: no-store` ja erillinen aikaleimakysely; uusia asiakkaan tietoja, tokeneita, kirjautumisia tai paikallisia salkkutietoja ei lähetetä GitHub Pagesiin. Varsinainen kurssi-Worker säilyy ennallaan, fallback saa nyt datansa oikeasta olemassa olevasta osoitteesta. Alpha 3 sisältää näkyvän **ALPHA 3 · DATASYÖTTEET** -merkin ja uuden SW-cache-version `osakevahti-shell-v2.16-alpha3-feeds`.

**Miksi ei vain lisätä JSONia ZIP:iin?** Datan pitäisi päivittyä julkaisuista riippumatta. Staattinen hetkellinen kopiopaketti vanhenisi. Syötteet pysyvät alkuperäisen julkisen rajapinnan ja automaattisen datapäivityksen ohjaamina; jos alkuperäinen syöte pysähtyy, myös Alpha näyttää sen vanhentumisen. Testiversio ei saa mitään käyttäjän henkilökohtaisia salkku- tai API-avaintietoja näistä tiedostoista.

### Androidin Alpha 3 -testi

1. Ennen Direct Upload -päivitystä tarkista, että nykyinen OV Alpha 2 näyttää vanhat omistukset. Ota halutessasi paikallinen varmuuskopio.
2. Cloudflare → **nykyinen** `osakevahti-alpha-naatti21` -Pages-projekti → luo **Production**-ympäristöön uusi **Direct Upload** -julkaisu käyttäen testattua Alpha 3 ZIP:iä. Älä luo toista projektia tai muuta `main`.
3. Avaa **sama** puhelimen OV Alpha -kuvake, päivitä sivu verkkoyhteydellä ja varmista näkyvä `ALPHA 3 · DATASYÖTTEET`. Omistukset ja tililuokittelu eivät saa muuttua.
4. Valitse etusivulta **↻** (kurssipäivitys) ja tarkista, että kurssit päivittyvät tai näytetään täsmällinen datalähteen virhe. Tarkista myös rahastojen NAV, mikäli salkussa niitä on.
5. Avaa **Osinkokoneet** ja **Rocket Radar**. Niiden listojen on täytyttävä julkisen syötteen analyysituloksilla; tarkista päivitettyjen tietojen aikaleima. Tarkista myös muut markkina-/riski-/uutisosiot soveltuvin osin.
6. Sulje sama asennettu PWA, käynnistä uudelleen ja tarkista omistukset, hinnat, tililuokat ja Alpha 3 -merkki. Varmista sitten offline-avaus lentotilassa: paikallinen salkku ja app-shell näkyvät, mutta uutta julkista markkinadataa ei odoteta.

**Avoin raja:** nykyinen julkaistu Alpha 2 pysyy käytössä siihen saakka, kunnes Alpha 3 -korjaus on täysin QA-hyväksytty ja käyttäjä itse tekee Direct Upload -päivityksen. Tämä ei anna tuotanto-GO:ta.

---

**Tila 13.10.2026:** Tämä on testijulkaisun valmistelu, **ei julkaisu**. `main`, `naatti21.github.io/osakevahti/` ja alkuperäinen QA-lukittu PR #17 pysyvät koskemattomina. Käytä vain synteettisiä tietoja.

> **KÄYTÖSSÄ 13.10.2026: Direct Upload ZIP**, ei Cloudflare Connect to Git. GitHub–Cloudflare-kirjautuminen joutui mobiilissa looppiin, joten Alpha 1 julkaistiin onnistuneesti suoralla ZIP-latauksella. Alla oleva Git-yhdistämisen osio on vaihtoehtoinen, eikä sitä käytetä tässä Alpha 2 -päivityksessä. Älä poista nykyistä OV Alpha -asennusta.

## Alpha 1 → Alpha 2: oikean Android-asennuksen päivitystesti (Direct Upload)

**Kohde: nykyinen Cloudflare-projekti `osakevahti-alpha-naatti21`, sama osoite `https://osakevahti-alpha-naatti21.pages.dev/`.** Älä luo uutta projektia, vaihda manifest-ID:tä, käytä GitHub Pagesia tai julkaise GitHubin `main`-haaraan.

1. Ennen Cloudflare-latausta avaa asennettu OV Alpha puhelimessa. Tarkista, että omistukset näkyvät; ota halutessasi nykyisestä Alphasta oma JSON-varmuuskopio talteen puhelimeesi. Älä jaa oikeita salkkutietoja.
2. Sulje OV Alpha. Avaa GitHubin uuden Alpha 2 -Draft PR:n **Alpha Pages static package verification** -workflow'n hyväksytyn ajon `osakevahti-alpha-static-package` ZIP tai ChatGPT:n toimittama sama tarkistettu ZIP.
3. Cloudflare Dashboard → Workers & Pages → **olemassa oleva** `osakevahti-alpha-naatti21` → **Create deployment / Upload assets**. Lataa **Alpha 2 ZIP samaan projektiin**, Production-ympäristöön. Älä käytä `Connect Git`-toimintoa.
4. Avaa sama `https://osakevahti-alpha-naatti21.pages.dev/` Chromen välilehdellä verkkoyhteydellä. Varmista, että yläpalkin pienessä tekstissä lukee **ALPHA 2 · PÄIVITYSTESTI** ja alareunan huolto-osiossa **Osakevahti Alpha 2**.
5. Sulje asennettu OV Alpha kokonaan ja avaa **sama vanha OV Alpha -kuvake** uudelleen. Jos yläpalkissa lukee vielä vanha teksti, käy kerran Alpha-URL:ssa Chromessa verkon ollessa päällä ja sulje/avaa sovellus uudelleen. Älä poista asennusta, tyhjennä sivuston tietoja tai rekisteröi uutta PWA:ta.
6. Tarkista, että samat omistukset, määrät, hinnat, tilityypit ja palveluntarjoajat ovat säilyneet. Avaa Alpha vielä uudelleen lentotilassa (Wi-Fi pois) ja varmista, että **Alpha 2 -versionmerkki, dashboard ja samat omistukset** näkyvät offline.
7. Palauta verkkoyhteys ja kirjaa PASS/FAIL. Jos omistukset katoavat tai näkyy väärä versio, lopeta; älä tyhjennä selaintietoja tai palauta backupia ennen havainnon kirjaamista.

**Pysyvät sovellusidentiteetit:** PWA `name: Osakevahti Alpha`, `short_name: OV Alpha`, `id: ./?channel=alpha`, `start_url: ./`, localStorage-avain `osakevahti.single.v1`, origin `osakevahti-alpha-naatti21.pages.dev`. Päivityksessä vain näkyvä Alpha 2 -merkintä ja service workerin välimuisti `osakevahti-shell-v2.16-alpha2` muuttuvat. Aiempi `osakevahti-shell-v2.16-ocr-fix` on vanhan Alpha 1 -asennuksen välimuisti. Service workerin cache-eristys ei koske muiden PWA:iden välimuisteihin.

**Testin raja:** vain käyttäjän erillisessä Alpha-originiissa; tämä ei ole lupa päivittää oikean Osakevahdin GitHub Pages -tuotantoa.

---

## Erottelu

- Tuotanto: **Osakevahti**, origin `https://naatti21.github.io`.
- Androidin ensimmäinen testiversio: **Osakevahti Alpha**, lyhytnimi **OV Alpha**, manifest-id `./?channel=alpha`.
- Myöhempi vaihe: **Osakevahti Beta**, erikseen valmisteltava; ei sisälly tähän.
- Alpha kuuluu vain erilliselle originille, esimerkiksi `https://<oma-ainutkertainen-projektinimi>.pages.dev`. **Älä julkaise `https://naatti21.github.io/alpha/` tai `/osakevahti-alpha/` -polkuun:** localStorage ja CacheStorage ovat origin-kohtaisia, eivät repositoriokohtaisia. Pelkkä eri PWA-id ei eristä dataa.

## Alphan GitHub-lähde

- Repository: `naatti21/osakevahti`
- Vain Alphan Cloudflare Pages -julkaisuun tarkoitettu branch: `deploy/osakevahti-alpha-20261013`.
- Projektin mukana oleva build-skripti: `node scripts/build-alpha-pages.mjs`.
- Build output: `dist-alpha`.
- Ulostuloon sallitaan vain `index.html`, `sw.js`, `image-reader.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `robots.txt` ja `_headers`. Eri tyyppisiä tiedostoja, kirjautumistietoja, salkkubackupeja, dokumentteja tai testejä ei siirretä Pages-sivustolle.

## Käyttäjän kertaluonteinen asetus Cloudflaressa

Kun erillinen julkaisuhaara on luotu ja sen QA on vihreä:

1. Avaa Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**. Liitä GitHub-tili, jos tätä yhteyttä ei ole ennestään.
2. Valitse GitHub-repo `naatti21/osakevahti`. Luo **uusi Pages-projekti**, esim. `osakevahti-alpha-naatti21` (nimen on oltava vapaa). Älä muokkaa olemassa olevaa tuotantosovelluksen projektia.
3. Valitse **Production branch**: `deploy/osakevahti-alpha-20261013`. Varmista, että kentässä EI lue `main`. Nimitys `Production branch` tarkoittaa vain **tämän erillisen Alpha-projektin päähaaraa**, ei Osakevahdin varsinaista tuotantoa.
4. Framework preset: **None** / ilman frameworkia. **Build command**: `node scripts/build-alpha-pages.mjs`. **Build output directory**: `dist-alpha`. Root directory: repon juuri (`/`). **Älä lisää API-avaimia tai salaisuuksia**.
5. Estä automaattiset preview-deployt muilta brancheilta: projektin **Settings → Builds → Branch control → Preview branches: None** (tekstin tarkka sijainti voi vaihdella). Jätä vain Alpha-julkaisuhaara tämän projektin lähteeksi.
6. Tarkista ennen julkaisua projektin nimi, erillinen `*.pages.dev`-hostname ja valittu branch. Paina sitten projektin luonti-/deploy-vahvistusta. Tämä julkaisee **vain Alpha-testisivuston**; nykyiseen GitHub Pages -tuotantoon ei tehdä deployta.
7. Avaa uusi `https://...pages.dev`-osoite puhelimen Chrome-selaimella. Varmista, että näet **Osakevahti Alpha** ja sovellus näkyy asennettuna nimellä **OV Alpha**. Älä käytä tähän todellista salkkuasi, salaisia API-avaimia tai tuotannon varmuuskopioita.

Huom.: `X-Robots-Tag: noindex` ja `robots.txt` hillitsevät hakukoneindeksointia, **eivät suojaa sivustoa ulkopuolisilta**. Testiosoite on julkinen, mutta käyttäjän data tallentuu puhelimen kyseisen originin selaintallennukseen.

## Androidin ensimmäinen hyväksymiskoe

Tee vain Alpha-osoitteessa, älä tuotannon Osakevahdissa:

- [ ] Nimi **Osakevahti Alpha**; aloitusnäytön kuvakkeen teksti **OV Alpha**.
- [ ] Alpha aukeaa omana asennettuna sovelluksenaan (Chrome: valikko → Asenna sovellus / Lisää aloitusnäyttöön, jos tarjolla).
- [ ] Luo **syntteettinen** testiomistus (esimerkiksi MSFT, määrä 2, hankintahinta 100 USD) tai käytä muulla tavalla täysin kuvitteellista testisalkkua.
- [ ] Sulje Alpha, avaa uudelleen ja varmista, että testiomistus säilyy.
- [ ] Ota lentotila käyttöön ja avaa asennettu Alpha uudelleen. Sovelluksen käyttöliittymän ja testiomistuksen pitää näkyä ilman verkkoyhteyttä. Kurssi-/uutisdata ei välttämättä päivity ilman verkkoa.
- [ ] Kytke verkko takaisin. Testaa myöhemmässä **erillisessä** päivityskokeessa, että sovellus päivittyy ja testiomistus säilyy.
- [ ] Varmista tuotannon **Osakevahdin** kuvake ja salkku erillisinä. Älä tyhjennä tuotannon dataa tai välimuistia.

**Havaintojen raportointi:** laitteen Android-versio ja selainversio, Alpha-URL, mikä kohta PASS/FAIL ja virheilmoitus. Älä lähetä oikeita salkku- tai avaintietoja.

## Julkaisuportti

Tämä on erillinen PWA-testiympäristö. `main` ja varsinainen `Osakevahti` tuotannossa pysyvät ennallaan. Fyysisen Androidin testimerkintä on **NOT RUN**, kunnes käyttäjä suorittaa kokeen. Beta luodaan myöhemmin erikseen; kehityksessä uusi julkaisuhaaran SHA vaatii uudet CI-tulokset ja asianmukaisen QA-portin.
