# Virallisen tilinpäätösdatan pilotti — Nokia / Microsoft

Kokeilun tarkoitus: 5 tilikautta × 4 muuttujaa × 2 yhtiötä.
- Microsoft (CIK 0000789019): SEC Company Facts, US GAAP.
- Nokia (LEI 549300A0JPRWG1KI7U06): filings.xbrl.org ESEF / IFRS iXBRL JSON, Nasdaq-alkuperäinen raportti.
- Vuodet 2021–2025; Microsoftin tilikausi päättyy kesäkuussa, Nokian joulukuussa.
- Mitattavat: liikevaihto, tilikauden tulos, liiketoiminnan rahavirta, korollisen velan lyhyt + pitkä osa.

Ei yhtiökohtaisia tagipoikkeuksia. Käytetään yleisten standarditaksonomioiden käsitteitä. Tuntematon kenttä jää puuttuvaksi; sitä ei muuteta nollaksi. Eri tilikausien, valuuttojen tai raportointiyksiköiden lukuja ei yhdistetä.

## Mistä tarkistat todellisen tuloksen
PR:n GitHub Actions → **Official filings two-company pilot (research only)**.
Työajon lokissa on \`PILOT_EVIDENCE_BEGIN ... PILOT_EVIDENCE_END\` sisältäen jokaisen luvun ja sen lähdetunnisteen. Lukuja EI ole kovakoodattu raporteiksi.
Ajossa on erillinen \`result\`, joka on \`PARTIAL_OR_BLOCKED_NO_GO\`, jos 40/40 luku ei täyty.

## Lähteet
- SEC API https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Microsoftin SEC JSON https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json
- XBRL International arkiston rajapinta https://filings.xbrl.org/docs/api
- Nokian 2025 ESEF https://filings.xbrl.org/filing/549300A0JPRWG1KI7U06-2025-12-31-ESEF-FI-0

## Rajoitukset
- Tutkimus ei oikeuta automaattista tuotantokeruuta, suuria latausmääriä tai henkilötietojen siirtoa.
- SEC ei tue suoraa selaimen CORS-käyttöä, ja mahdolliset liikenne-/User-Agent-estot näytetään, ei ohiteta.
- Raporttien muutoshistorian, uusien IFRS-taksonomiaversioiden, oikaisujen ja yritysjärjestelyjen käsittely vaatii lisätyötä.
- Korollisen velan määritelmä tässä kokeessa on lyhyt + pitkä lainavelka: EI sisällä automaattisesti kaikkia vuokravelkoja, ja puuttuvat komponentit tekevät summasta puuttuvan.
- Vertailukelpoisuus yritysten välillä ei seuraa pelkästä numerosta. IFRS vs US GAAP voi johtaa eroihin.
- Mitään yhtiön osinkolaatu- tai ostosuositusta ei johdeta.

NO-GO: ei yhdistämistä tai julkaisua ennen testejä, oikeiden lukujen manuaalista pistotarkistusta ja lähdeoikeuksien arviointia.
