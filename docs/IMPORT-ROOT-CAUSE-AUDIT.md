# Osakevahdin kuvatuonnin riippumaton koodiauditointi

Tarkastettu PR: https://github.com/naatti21/osakevahti/pull/53
Lukittu lähtöcommit: `acfb160c93b41070f4e1ea755d9602e1207c7a4a`.
Korjaushaara: `audit/alpha-import-root-cause-20261016`.
Vertailukohde: `deploy/osakevahti-alpha-20261013`, haettaessa
`957e0f648c2c787b731c9f80b3b86da303590ae7`.
Tuotantoa, käyttäjän salkkua, Worker-palvelua tai julkaisuasetuksia ei muutettu.

## Mitä on todistettu — ja mitä ei

Alkuperäistä pankin salkkukuvakaappausta, sen raakaa OCR/TSV-tulosta eikä
käyttäjätestin todellisia resolver-vastauksia ollut käytettävissä. Aiempi
keskusteluun liitetty Riskivahti-näkymä ei ole kyseinen tuontilähde. Alla olevat
viat on osoitettu lähdekoodilla ja synteettisillä regressioilla; ne eivät ole
väite alkuperäisen kuvan jokaisen virheen toistetusta juurisyystä.

| Ketjun vaihe | Todiste ja johtopäätös |
|---|---|
| OCR | `image-reader.js` käyttää paikallista Tesseract 5.1.0 fin+eng -lukua. TSV-sanat ryhmitellään riveiksi; riville jää laatikko ja keskimääräinen luottamus. Varsinaista kuvaa ei lähetetä resolverille. Kielimallit ja ohjelmakoodi tarvitsevat latausyhteyden. |
| Rivien muodostus | `screenshotCandidatesFromLines` hukkasi laatikot ja luotti taulukon järjestykseen. Synteettinen sarakejärjestys ei yhdistänyt määriä oikeisiin nimiin. Rinnakkaiset nimisarakkeet saattoivat antaa toisen kortin määrän viimeiselle nimelle. Samalla OCR-rivillä olevista kahdesta määrästä käytettiin ensimmäistä. |
| Nimi ja tunnisteet | Neljän latinalaisen kirjaimen vaatimus hylkäsi lyhyet ticker-nimet ja ei-latinalaiset nimet. Pelkkä kolmikirjaiminen ticker ei siis ole sama testitapaus kuin yhtiön koko nimi. Tickeriä ei saa arvata lyhyestä nimestä. |
| Valuutta | Vain viittä ISO-koodia luettiin. `$` muuttui aina USD:ksi, vaikka se voi tarkoittaa esimerkiksi CAD- tai AUD-valuuttaa. Korjaus käyttää ISO-koodeja ja pyytää täydentämään monitulkintaisen symbolin. |
| Yahoo / Worker | `worker/worker.js` hakee sumeasti enintään 10 osumaa, pitää enintään 8 EQUITY/ETF/MUTUALFUND-osumaa ja täydentää valuutan chart-metadatasta. Metadatan epäonnistuminen jättää kentät tyhjiksi. Sovitin ei toimita ISIN-tietoa: puuttuvaa ISINiä ei saa väittää vahvistetuksi. Kolme uutta testiä suorittaa juuri Workerin alkuperäiset funktiot synteettisellä HTTP-rajalla. |
| Suodatus | PR53 poistaa nollan nimiosuman roskatuloksia, mutta 0,5-raja sallii esimerkiksi Aurora Robotics → Aurora Mining. Pelkkä nimessä oleva ticker ei puolestaan löydä laajennettua yhtiönimeä. Asiakas säilytti viisi ja näytti vain kolme osumaa: oikea rinnakkaislistaus saattoi jäädä kokonaan käyttäjältä piiloon. |
| Vahvistus | Manuaalinen valinta tarkasti vain ISIN-ristiriidan. Käyttäjä saattoi valita eri valuutan ja siirtää saman hankintahinnan siihen ilman muunnosta. Nyt ristiriitainen listaus näkyy perusteluineen, mutta lähde on korjattava ennen valintaa. Heikko yksiköllinen määrä edellyttää käyttäjän vahvistusta myös "Jätä tunnistamatta" -polussa. |
| Erän elinkaari | Ensimmäisen tunnistetun rivin jälkeen hyväksyntä saattoi aktivoitua muiden hakujen ollessa kesken. Peruuttamisen jälkeen vanha vastaus saattoi käyttää tyhjennettyä tai uutta tuontitilaa. Nyt latauslukko ja eräkohtainen viite estävät nämä. |
| Yhdistäminen | Täsmällinen listausavain ei tarkastanut yhtiönimen ristiriitaa. Vääränniminen, vahvistamaton sama ticker/valuutta/markkinapaikka saattoi päivittää vanhan rivin. Korjaus tarkistaa ristiriidan myös täsmällisellä avaimella. Vanha rivi säilyy. |
| Lopullinen tallennus | Positiivista äärellistä määrää ja valuuttaa ei tarkastettu uudelleen lopullisessa portissa. Korjaus tarkastaa ne sekä keskeneräisen erän ennen muutoksia. |
| Instrumenttilaji | Resolverista tunnistettu ETF/rahasto ei säilyttänyt lajiaan, ellei lähde antanut sitä erikseen. Korjaus vie tarjoajan lajin valittuun instrumenttiin ja omistukseen. Laskentasääntöihin ei kosketa. |

Todennäköisiä alkuperäisen oireen osatekijöitä ovat liian väljä sumeiden
hakutulosten hyväksyminen, lyhyiden nimien hylkääminen ja OCR-kenttien
kohdistus. Ilman raakaa OCR:ää ja palveluvastauksia ei voi todistaa, mikä niistä
aiheutti juuri Nordean/AMD:n rivien sekoittumisen. Kahdeksan tarkistettavaa
riviä ei sellaisenaan ole vika: epävarman rivin pysäyttäminen on oikea tulos.

## PR53:n arvio

Vahvuudet: pieni rajattu muutos, ei yhtiöiden kovakoodausta hakusuodattimessa,
ISIN-ristiriidan esto, rinnakkaislistausten säilyttäminen valuuttaerosta
huolimatta sekä kolme synteettistä selainregressiota. Tutkimusmoottoria ei
virheellisesti esitetä tallennusluvan antajana.

Puutteet: testit painottuvat raportoituihin yhtiöihin, eivätkä mittaa aitoa
kuvan rivijakoa. AMD-testi käyttää koko yhtiönimeä. Käyttöliittymätekstien
estolista ei ratkaise yleistä dokumentin rakennetta. Suodatusraja,
listausleikkaus, manuaalinen valinta, erän keskeneräisyys ja yhdistämisen
ristiriidat jäävät tarkistamatta. En suosita alkuperäisen PR53:n hyväksymistä
lopulliseksi juurisyykorjaukseksi.

## Korjauksen rajat

- Ei OCR-mallin vaihtoa, uusia riippuvuuksia tai ulkoisia datapalveluita.
- Ei muutoksia jäädytettyyn `engine/`-tutkimusytimeen tai sen hyväksymisehtoihin.
- Hakutulosten pisteet ovat järjestysperuste, eivät tilastollinen varmuus.
- Epäselvät rinnakkaissarakkeet pysäytetään; niitä ei yritetä ratkaista arvauksella.
- Nimi/merkitys, kielen tuki, sarakkeet ja numeroiden paikalliset muodot eivät
  muutu yleismaailmallisesti ratkaistuiksi. Esimerkiksi `1,234` tarvitsee
  käyttäjän tarkistuksen, jos lähteen desimaalikäytäntö ei ole tiedossa.
- Kaikkien maiden pörssinimien/MIC-aliasien vastaavuuksia ei tunneta. Tuntematon
  tai ristiriitainen markkinapaikka jää tarkistettavaksi. Ei uusia arvattuja aliaksia.
- Yahoo ei takaa kattavaa hakua: Workerin enintään kahdeksan palautettua
  listausta ovat nyt kaikki näkyvissä, mutta tämä ei todista kaikkia maailman listauksia.
- Kuvan kielituki on edelleen fin+eng. Unicode-nimen säilyttäminen ei tarkoita,
  että nykyinen OCR tunnistaisi kaikki kirjoitusjärjestelmät kuvasta.
- Engine-auditointi on edelleen erillinen näkyvä huomautus. Sen `canPersist:false`
  ei muutu automaattiseksi tallennusluvaksi. Sovelluksen nimenomainen hyväksyntä
  on erillinen päätös; epäselvä tunniste voi jäädä käyttäjän tietoisesti vahvistamatta.
- Samaa tunnistamatonta nimeä/tickeriä ilman markkinapaikkaa ei voida yksilöidä
  maailmanlaajuisesti. Oikean kuvan ja listauksen tarkastus on edelleen tarpeen.

## Testaus

Testit ajettiin Node 24.19.0:lla ja järjestelmän Chromium 154.0.8037.57:llä.
CI:n Node 22 / Playwrightin oma Chromium ja etä-CI jäävät erikseen ajettaviksi.
Paikallinen Playwright-asetus säilytti TLS-tarkistukset ja käytti ympäristön
HTTPS-proxya, localhost-ohitusta, kahta työntekijää ja nollaa uusintaa.

| Tarkistus | Tulos |
|---|---|
| Alkuperäinen PR53, koko 152 selaintestin sarja | 148 PASS / 4 FAIL. Kolme elävän verkkopalvelun testiä sekä PWA-välimuistin päivitystestissä vanhan välimuistin poistumisen ajoitus. |
| Uusi logiikkasarja alkuperäisellä PR53-koodilla | 22 testiä: 16 FAIL / 6 PASS. Tämä on RED-todiste, ei hyväksyntä. |
| `npm run test:engine` lopullisella sovelluskoodilla | 36 PASS / 0 FAIL: 11 ennestään olevaa Engine-testiä, 22 tuontiregressiota ja 3 Workerin sopimustestiä. |
| `npm run test:qa-import` | 15 PASS / 0 FAIL. |
| Koko selaintestisarja muutosten jälkeen | 159 testiä: 156 PASS / 3 FAIL / 0 SKIP. Kaikki 7 uutta selainregressiota PASS. Prosessin paluuarvo 1. |
| Aito OCR: vanha stressisarja + uusi TSV-kuvatesti + erillinen CDN-testi | 10 testiä: 8 PASS / 2 FAIL / 0 SKIP. Prosessin paluuarvo 1. |
| Staattinen Alpha-paketti ja `tests/alpha-pages-package.test.mjs` | 4 PASS / 0 FAIL. Rakennus ei julkaise. |
| `git diff --check` | PASS. |

Selaintestien kolme jäljellä olevaa FAILia ovat alkuperäiset elävien palvelujen
FX-, kuuden JSON-syötteen ja Worker/fallback-ketjun testit (`Failed to fetch`).
Niitä ei ohitettu eikä korvattu mockeilla. Lähtöajon PWA-päivitysvirhe ei
uusiutunut lopullisessa ajossa: sitä ei väitetä korjatuksi, vaan se on mahdollinen
ajoitusriippuvainen ongelma.

OCR:n kaksi FAILia ovat selainkirjaston CDN-lataus ja koko selaimen CDN/OCR-
kierros. jsDelivr epäonnistui `net::ERR_CERT_AUTHORITY_INVALID`-virheeseen;
vaihtoehtoiset CDN:t `net::ERR_TUNNEL_CONNECTION_FAILED`-virheeseen. TLS-
tarkistusta ei poistettu. Ensimmäinen Node-OCR-yritys epäonnistui myös
kielitiedoston DNS-hakuun (`EAI_AGAIN`). Lopullisessa paikallisessa Node-OCR-ajossa
käytettiin samaa todellista, HTTPS-proxyn kautta jsDelivristä ladattua eng-mallia
Tesseractin paikallisessa välimuistissa; OCR-tulosta ei mockattu. Mallin SHA-256:
`5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`.
Tämä ei korvaa epäonnistunutta selaimen fin+eng/CDN-testiä.

Korjauksen väliajoissa löytyi lisäksi oma valuuttakoodien/tickerien törmäys
sekä esikatselun regressioita. Ne korjattiin muuttamatta vanhojen testien
odotuksia. Lopullinen oikean OCR:n tumma kuvakoe läpäisee myös tickerin ja
ISO-valuuttakoodin törmäystapauksen. Alkuperäinen käyttäjän kuva ei ollut testissä.

Testatun lopullisen `index.html`-tiedoston SHA-256:
`523193bc5c97987559f535fe5a29b2a9700dceda6d91e9a598f19c2d61af7727`.
Testien korjauksia ei piilotettu uusintayrityksillä. Uudet Node-testit sisältyvät
olemassa olevaan `test:engine`-komentoon, TSV-kuvatesti `test:ocr`-komentoon.
Olemassa olevia workflow-tiedostoja tai testiodotuksia ei muutettu.

Paikalliset todisteet ovat `/tmp/osakevahti-audit-locked.json`,
`/tmp/osakevahti-audit-ocr-final.json`, `/tmp/osakevahti-audit-red-node.log`,
`/tmp/osakevahti-audit-final-node.log`, `/tmp/osakevahti-audit-qa8/qa8-guards.json`
sekä samannimisten tuloshakemistojen synteettiset kuvat ja Playwright-tracet.
Niitä, kielimallia tai käyttäjän kuvia ei lisätty repositorioon.

## Android ja alkuperäinen kuva — vielä tekemättä

1. Käytä erillistä testisalkkua ja tarkistettavaa Alpha-versiota. Varmista myös
   asennetun PWA:n service workerin versio; älä testaa oikean salkun päälle.
2. Käsittele alkuperäinen kuva yksityisesti laitteella. Vertaa OCR:n tekstiä,
   rivien laatikoita ja määrän kohdistusta jokaiseen kuvan omistukseen. Älä
   liitä henkilötietoja, kuvaa tai raakaa OCR:ää julkiseen PR:ään.
3. Tarkista todelliset Yahoo-ehdokkaat: nimi, ticker, markkinapaikka, valuutta,
   instrumenttilaji sekä puuttuva ISIN. Tallenna vain anonymisoitu diagnoosi.
4. Kokeile hidas verkko, offline/OCR-kielidatan lataus, peruutus kesken haun,
   hylätty listausvalinta, heikko määrä, korjattu OCR ja hyväksyntä vasta kaikkien
   rivien jälkeen. Varmista että vanhat testiomistukset säilyvät myös uudelleenlatauksessa.
5. Tarkista Androidissa 320/360/393 CSS-pikselin näkymät, pitkä ehdokaslista,
   näkyvä ristiriidan syy, lähderivien avaaminen ja kaikkien painikkeiden käyttö.

Suositus: **korjaa lisää / varmista ennen hyväksyntää**. Korjaushaara on
arvioitava ja Android/originaalilähde varmennettava erikseen. Ei mergeä tai
julkaisua ilman käyttäjän erillistä hyväksyntää.
