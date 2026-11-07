# Sokkotestin tulos – Elisa + Apple – 7.11.2026

**Päätös: NO-GO tuotantokäyttöön.**

Koe tehtiin puhtaana out-of-sample-testinä. Vanhoja `normalizeEsefXbrlJson`- ja `normalizeIssuerIrTables`-funktioita EI muutettu. Yhtiökohtaisia IFRS-tageja tai HTML-tekstirivien poikkeuksia ei lisätty.

## Tulos

| Yhtiö | Ladatut vuosiraportit | Poimitut 5 vuoden luvut | Puutteet |
|---|---:|---:|---|
| Elisa Oyj, ESEF | 5/5 | **15/20** | Kaikkien vuosien lainavelka |
| Apple Inc., 10-K HTML | 3/3 | **0/20** | HTML-parseri ei tunnistanut taulukoita |
| **Yhteensä** | **8/8** | **15/40 = 37,5 %** | **25/40** |

Tämä on dokumentoitu **toteutuneen poiminnan kattavuus**, ei mitattu analyysin taloudellinen tarkkuus. Vasta riippumaton vuosikertomusvertailu hyväksyy arvot.

### Elisa: lähteestä poimitut luvut (milj. €)

| Vuosi | Liikevaihto | Tilikauden tulos | Liiketoiminnan rahavirta | Lainavelka |
|---|---:|---:|---:|---|
| 2021 | 1 997,9 | 343,5 | 595,7 | ei todennettu |
| 2022 | 2 129,5 | 372,8 | 591,8 | ei todennettu |
| 2023 | 2 180,5 | 374,0 | 647,8 | ei todennettu |
| 2024 | 2 191,5 | 356,4 | 650,9 | ei todennettu |
| 2025 | 2 257,1 | 341,8 | 688,6 | ei todennettu |

Kaikki 15 havaintoa olivat EUR-määräisiä, tilikausille 2021–2025 kohdistettuja ja niillä oli ESEF-taksonomian lähdekäsitteet:
- Liikevaihto: `ifrs-full:Revenue`.
- Tilikauden tulos: `ifrs-full:ProfitLoss`.
- Liiketoiminnan rahavirta: `ifrs-full:CashFlowsFromUsedInOperatingActivities`.

ESEF-raporttien sisäiset juridiset entity-ulottuvuudet tarkistettiin Elisan LEI:tä vasten ennen poimintaa.

Vuoden 2025 liikevaihto 2 257 miljoonaa euroa täsmää Nasdaqin 30.1.2026 julkaiseman Elisan tulostiedotteen kanssa. Se ei silti yksin hyväksy muita lukuja.
- Elisa, ESEF 2025: https://filings.xbrl.org/filing/743700TU2S3DXWGU7H32-2025-12-31-ESEF-FI-1
- Nasdaqin virallinen tiedote: https://view.news.eu.nasdaq.com/view?id=bc70477dd82574ecc77de2242e6687748&lang=en&src=micro

Lainavelka jätettiin puuttuvaksi, koska nykyiset yleiset IFRS-komponenttisäännöt eivät löytäneet sekä lyhytaikaista että pitkäaikaista lainaa turvallisesti. Ei korvattu nettovelalla, kokonaisveloilla tai nollalla.

### Apple: kaikki raportit saatavilla, mutta parseri hylkäsi rakenteen

Applen alkuperäisiin sijoittajamateriaaleihin linkittyvät 10-K HTML:t vuosilta 2021, 2023 ja 2025 latautuivat onnistuneesti. Yleinen Microsoftin vuosikertomuksessa onnistunut HTML-lukija ei tunnistanut mitään kolmesta vaaditusta taulukosta (tulos, rahavirta, tase).

Tästä ei voi päätellä, että Applen luvut puuttuisivat vuosikertomuksista. Luvut ovat raporteissa; parseri ei tunnista erilaista otsikointia ja HTML-taulukkorakennetta.

- Apple 2025: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html
- Apple 2023: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/1999a9bb-1e5c-4aa2-a94e-91da5d7b4006.html
- Apple 2021: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/23f4d432-c1c3-43be-9050-596f45eaeee9.html

## Mitä testi opetti

1. ESEF:n standarditaksonomia kattaa yleisimmät tulos- ja rahavirtaluvut Nokialla ja Elisalla. Velan koostamisessa raporttien käsitteet eroavat; tarvitaan taksonomian sallittu, yleiskäyttöinen normalisointi ja tilinpäätöksen pistevertailu.
2. HTML-taulukkojen tunnistuksessa pelkkä riviotsikoiden täsmävertailu ei yleisty Applen 10-K-lomakkeisiin. Tarvitaan otsikko-, sarake-, valuutta-, mittayksikkö- ja tilikausitunnistus sekä ristiriitojen hylkäys – **ei** Apple-erikoissääntöä.
3. Ennen uusien osakkeiden pisteytystä pitää erottaa datan **löytyminen**, oikean konsernin ja tilikauden **tunnistus** ja laskennan **oikeellisuus**. Vasta kolmas taso voi perustella osinkolaatua.

## Todistus ja julkaisuraja

- Tutkimusajon loki: https://github.com/naatti21/osakevahti/actions/runs/42381955720
- Sama työajo julkaisee yksityiskohtaisen `out-of-sample-pilot-report.json`-tiedoston CI-artifactina.
- Testi osoittaa rehellisen osittaisen onnistumisen ja fail-closed -toiminnan. **Ei** todista kattavaa globaalia osakeanalyysiä tai lähteiden jälleenjulkaisuoikeutta.
- PWA, Cloudflare Worker, käyttäjän salkku ja tuotantohaarat ovat ennallaan. Mitään ei yhdistetä ilman käyttäjän erillistä hyväksyntää.
