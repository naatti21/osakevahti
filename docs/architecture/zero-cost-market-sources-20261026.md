# Osakevahti Alpha: maksuton datalähdepatteristo

Päivä 2026-10-26. **0 euroa kuukaudessa.** Ei maksullisia palveluita, kokeilukortteja tai ilmaiseen kiintiöön perustuvaa automaattista tilausnostoa.

Tila: Kokeellinen kehityshaara, **ei deploy eikä käyttöliittymäintegraatio**. Pohjautuu PR #87:n yleiseen datapalveluun.

## Arkkitehtuuri

- Moottori muodostaa kyselyt salkun kulloisista instrumenteista, ei lähdekoodiin listatuista yksittäisistä nimistä tai osakkeista.
- Datalähde valitaan kyvykkyyden ja tarkastetun käyttöoikeuden perusteella: pörssikurssi, rahaston NAV, instrumentin identiteetti ja valuuttakurssi ovat eri palveluita.
- Ilmaisuus EI vielä todista käyttölupaa, kattavuutta tai datan laatua. Maksulliset tarjoajat estetään eksplisiittisellä freeSourceStatus-ehdolla.
- Käyttörajat huomioidaan ennen HTTP-kutsua. Kun ilmainen kiintiö täyttyy: säilytä vanha arvo merkittynä, älä päivitä maksulliselle tasolle.
- Lähteen alkuperä tallennetaan. Yahoo-Workeriin ja Yahoo-GitHub-syötteeseen menevät kaksi reittiä ovat **sama hinnan lähde**, eivät kaksi riippumatonta varmistusta.
- Salkun määrät, hankintahinnat, välittäjät ja pankkitilit eivät poistu puhelimelta.

## Ehdokkaat

| Datalaji | Ilmainen lähde | Käyttökelpoisuuden tila |
| --- | --- | --- |
| Osake/ETF intraday | Nykyinen Yahoo-haku | Toimiva kokeellinen perintölähde; epävirallinen rajapinta, käyttöehdot/tukevuus tarkistettava. Ei itsenäinen lähde, vaikka kuljetus Worker/GitHub eri. |
| Osakkeet | Nykyinen Finnhub free-avain | Käytössä eräillä US-osakkeilla; jokainen uusi pörssi/kiintiö/entitlement tarkistettava. |
| USA osake+ETF | Twelve Data Basic | 8 krediittiä/min, 800/päivä; henkilökohtainen internal non-display ja USA-osakkeet, ei yleistä Euroopan pörssihintaa. Käyttöliittymän display-oikeus tarkistettava erikseen. |
| Osakkeen EOD/historia | Alpha Vantage free | 25 API-kutsua/päivä; real-time ja 15 min US premium-only. Ei käytetä saumattomana live-varmistuksena. |
| Instrumentti-identiteetti | OpenFIGI API | Julkinen ilmainen API, keyless mapping 25/min ja 10 työpyyntöä/kutsu. Palauttaa mahdollisia FIGI:tä ja symboleita, ei hintoja eikä automaattisesti vahvistettua rahasto-osuuslajia. Toteutettu avaimettomana sovittimena. |
| EUR/USD ja muu FX | Frankfurter v2 | Avaimeton, päivätty keskuspankkiperusteinen viitekurssi. Toteutettu avaimettomana sovittimena, ei intraday-FX. |
| Rahastot | Issuer/rahastoyhtiön julkinen NAV | Kiireisin puuttuva ratkaisu. Jokaisesta havaintorakenteesta pitää saada ISIN, oikea osuuslaji, valuutta, NAV-hinta, **täysi arvostuspäivä** ja lähde; automaattisen käytön sallittavuus pitää selvittää. |
| Rahastojen välittäjäsivut | Nordnetin julkiset NAV-päivät | Monesti vuodeton DD.MM. eli ei yksin vahvistettu NAV-vuosi; sivun lukuaika ei ole NAV-päivä. |

## Viralliset lähdetiedot (26.10.2026)

- https://www.openfigi.com/api/documentation (free ja anonyymin mapping-rajoitukset)
- https://frankfurter.dev/ (v2/rate/BASE/QUOTE, maksuton keyless)
- https://twelvedata.com/pricing (Basic-lisenssi, 8/min, 800/päivä, US-painotus)
- https://www.alphavantage.co/support/api-key/ (25 kutsua/päivä, premium-only US reaaliaikainen ja viivästetty)
- https://www.nordeafunds.com/fi/rahastot/nordea-pohjoismaat-indeksi-select-a (ISIN ja rahaston arvo, mutta julkisessa tekstissä NAV-päivää ei esitetä samassa kentässä)

## Uuden koodin rajat

- engine/free-source-policy.mjs: lähteiden rajoitteet, riippumattoman alkuperän tarkistus, maksullisuussuoja, ilmaiskiintiön käyttö ja tietojen epävarmuuden nimeäminen.
- workers/providers/free-foundation.mjs: OpenFIGI ISIN-vaihtoehtojen haku ja Frankfurter v2 päivittäinen valuuttakurssi; kumpikaan ei kirjoita salkkutietoja.
- tests/free-source-battery.test.mjs: nollabudjetti, valuutta-aikaleimat, väärät parit, 429-virhe, henkilötietojen minimointi ja alias-lähteiden tunnistaminen.

## Seuraava julkaisuehto

1. Julkaise vain selkeästi ilmaiskäyttöön hyväksyttävät lähteet (ei lisenssirajoituksen kiertämistä).
2. Kytke OpenFIGI vain käyttäjän vahvistamaan instrumentti-identiteettiin; FIGI ei ole NAV.
3. Kytke Frankfurter FX vanhan valuuttalogikan rinnalle ensin vain lukutilassa ja varmista valittu keskuspankin lähde sekä kurssipäivä.
4. Testaa vähintään kaksi uutta erilaista suomalaista pörssiosaketta ja ETF:ää ilman kovakoodausta. Rahastolle vastaavat ISIN-/NAV-testit hyväksytystä ilmaisesta lähteestä.
5. GitHub CI, oikeat endpoint-probet, Android PWA testit sekä paikallisen salkun säilyminen. Olemassa olevaa tuotantoa ei kosketa ennen erillistä hyväksyntää.

**Älä koskaan merkitse samaa alkuperäistä hintaa kahdeksi riippumattomaksi varmistukseksi, äläkä täytä NAV-päivää HTTP-hakuhetkellä.**
