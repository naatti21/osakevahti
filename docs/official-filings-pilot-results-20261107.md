# Virallisen tilinpäätösdatan pilotin TULOS — 7.11.2026

**Tila:** tutkimuskoe onnistui osittain, **NO-GO tuotantoon**.
Lähdeajo: https://github.com/naatti21/osakevahti/actions/runs/42380715328

Koe mittasi 2021–2025 yhteensä 40 solua: kaksi yhtiötä, neljä
talouslukua, viisi tilikautta.

## Nokia: 20/20 havaintoa, ESEF / IFRS, kaikki luvut miljoonaa euroa

| Tilikausi | Liikevaihto | Nettotulos | Liiketoiminnan rahavirta | Lyhyt + pitkä lainavelka |
| --- | ---: | ---: | ---: | ---: |
| 2021 | 22 202 | 1 645 | 2 625 | 5 576 |
| 2022 | 24 911 | 4 259 | 1 474 | 4 653 |
| 2023 | 22 258 | 679 | 1 317 | 4 477 |
| 2024 | 19 220 | 1 284 | 2 493 | 4 191 |
| 2025 | 19 889 | 660 | 2 071 | 3 887 |

**Lähde:** XBRL Internationalin filings.xbrl.org-arkiston 2021–2025
Nokian ESEF-iXBRL JSON; alkuperäinen ilmoitusarkisto Nasdaq.
LEI: \`549300A0JPRWG1KI7U06\`.

Avaa:
https://filings.xbrl.org/filing/549300A0JPRWG1KI7U06-2025-12-31-ESEF-FI-0

Yhtiöstä riippumattomat käsitteet:
\`ifrs-full:RevenueFromContractsWithCustomers\`,
\`ifrs-full:ProfitLoss\`,
\`ifrs-full:CashFlowsFromUsedInOperatingActivities\`,
\`ifrs-full:CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings\`
ja \`ifrs-full:LongtermBorrowings\`.

**Tärkeä löydetty ja korjattu virhe:**
ESEF xBRL-JSON raportoi vuotuisen ajanjakson **päättymispäivän
eksklusiivisena**. Esimerkiksi \`2025-01-01/2026-01-01\` on
tilikausi 2025. Alkuperäinen tulkinta siirsi arvot vuoden eteenpäin.
Korjaus ja regressiotesti sisältyvät koodiin. Tämän vuoksi pelkkä
"API toimii" ei riitä laatusertifikaatiksi.

2025-luvut (liikevaihto 19 889, tulos 660, rahavirta 2 071)
ristiintarkistettu Nokian viralliseen vuoden 2025 Form 20-F -raporttiin:
https://www.nokia.com/system/files/2026-03/nokia-form-20-f-2025.pdf

Lainavelka EI tarkoita nettovelkaa eikä välttämättä sisällä kaikkia
vuokrasopimusvelkoja. Eri tilikausien oikaisut/yritysjärjestelyt
vaativat erillisen vertailukelpoisuusarvion.

## Microsoft: 17/20 havaintoa virallisista HTML-vuosikertomuksista

SEC Company Facts -API palautti GitHubin runnerille HTTP 403:
https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json

**Estoa ei ohitettu.** Vaihtoehtoisena, eri luotettavuusluokan
lähteenä haettiin Microsoftin omat vuosikertomukset vuosilta 2025,
2023 ja 2021. Ne sisältävät myös välivuosien taulukkotiedot.

| Tilikausi | Liikevaihto | Nettotulos | Liiketoiminnan rahavirta | Lainavelka |
| --- | ---: | ---: | ---: | ---: |
| 2021 | 168 088 | 61 271 | 76 740 | Puuttuu |
| 2022 | 198 270 | 72 738 | 89 035 | Puuttuu |
| 2023 | 211 915 | 72 361 | 87 582 | Puuttuu |
| 2024 | 245 122 | 88 136 | 118 548 | 51 630 |
| 2025 | 281 724 | 101 832 | 136 162 | 43 151 |

Yksikkö: **miljoonaa Yhdysvaltain dollaria**.
Lähteet:
- https://www.microsoft.com/investor/reports/ar25/
- https://www.microsoft.com/investor/reports/ar23/
- https://www.microsoft.com/investor/reports/ar21/

Vuoden 2025 lainavelka = 0 (lyhyt) + 2 999 (pitkän lainaosuuden
lyhennykset) + 40 152 (pitkä) = 43 151 miljoonaa USD.
Vuoden 2024 = 6 693 + 2 249 + 42 688 = 51 630.

Muiden kolmen vuoden **lyhyen lainavelan erillistä riviä ei ollut**
valituissa taseen taulukoissa. Puuttuvaa ei oletettu nollaksi, eikä
siksi laskettu näennäistä täyttä lainavelkaa.

Microsoftin HTML-tekstiä ei pidä sekoittaa SEC:n standardoituihin
XBRL-tagattuihin lukuihin. Koodi nimeää lähdetason
\`issuer-html-not-xbrl\`. Yleinen taulukkolukija on vasta tutkimus,
ei osoitus muiden yhtiöiden tuesta.

## Kattavuus ja portit

| Tarkistus | Tulos |
| --- | --- |
| Nokia ESEF-raporttien lataus | 5/5 |
| Nokia 4 muuttujaa × 5 tilikautta | **20/20** |
| Microsoft SEC Company Facts suoraan GH-runnerilta | **HTTP 403** |
| Microsoft IR-raporttien lataus | 3/3 |
| Microsoft 4 muuttujaa × 5 tilikautta | **17/20** |
| Kokonaiskattavuus | **37/40 = 92,5 %** |
| Laajennus muihin yhtiöihin | Ei todistettu |
| Automatisoidun käytön lähdeoikeudet | Tarkistettava lähdekohtaisesti |
| PWA- tai Worker-julkaisu | **EI** |

Tekninen koe näyttää, että standarditaksonomioiden yleisiä käsitteitä
voidaan käyttää ilman käsin täytettyjä yhtiökohtaisia tunnuslukuja.
Se ei vielä osoita universaalia datan löytämistä, poikkeustapausten
ratkaisua eikä ostosuosituksen luotettavuutta.

### Seuraavan kokeen hyväksymisehdot
1. Valitse toinen suomalainen ESEF-yhtiö ja varmista, että samat
   IFRS-tagit toimivat ilman yhtiökohtaisia poikkeuksia.
2. Testaa yleinen HTML-IR-lukija toisella yhdysvaltalaisella yhtiöllä
   tai vaihda sallittuun standardoituun XBRL-lähteeseen.
3. Käsittele restatementit, valuutta, yritysjärjestelyt ja tilikausien
   poikkeavat kestot ennen yleistä viiden vuoden pisteytystä.
4. Varmista lähteiden käyttöehdot ja tarvittava hakutiheys.
5. Ota käyttöön vain hyväksytyn, versionoidun PWA/Worker-päivityksen kautta.
