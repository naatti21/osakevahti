# Osakevahti Alpha — eristetty Cloudflare Pages / Android -testi

**Tila 13.10.2026:** Tämä on testijulkaisun valmistelu, **ei julkaisu**. `main`, `naatti21.github.io/osakevahti/` ja alkuperäinen QA-lukittu PR #17 pysyvät koskemattomina. Käytä vain synteettisiä tietoja.

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
