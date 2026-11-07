# HTML-tilinpäätösten mittayksikkötodiste – 7.11.2026

**Tutkimus-PR #105 – EI tuotantojulkaisu.**

## Miksi tämä muutos tehtiin?

PR #104:n laatuportti raportoi 37 Microsoftin ja Applen HTML-raporteista
poimittua talouslukua `needs-review`-tilaan. Syynä oli, että
`normalizeGenericStatementHtml` käytti oletusarvoista 1 000 000
-kerrointa vailla **nimenomaisen taulukon mittayksikköilmoitusta**.
Tällainen oletus voisi vääristää talouslukua tuhat- tai miljoonakertaisesti.

## Mitä nyt toteutettiin?

Uusi `engine/html-statement-unit-evidence.mjs` toimii vanhan,
yhtiöistä riippumattoman HTML-taulukon lukijan päällä:

1. Lukee arvot ensin kertoimella **1**. Se ei saa käyttää
   kutsujan syöttämää eikä oletettua miljoonakerrointa.
2. Selvittää jokaiselle kolmelle tilinpäätöstaulukolle oman
   mittayksikkönsä:
   - Microsoftin vuosikertomuksessa `(In millions)` löytyy
     **taulukon ensimmäisistä riveistä**.
   - Applen Form 10-K:ssä `(In millions)` löytyy
     **juuri taulukkoa edeltävästä otsikosta**.
3. Tunnistaa yleiset `dollars`, `thousands`, `millions`
   ja `billions`-ilmoitukset. Erilliset osakekohtaiset
   poikkeukset eivät muuta kokonaisliikevaihdon tai velan kerrointa.
4. Sitouttaa todisteen taulukkotunnukseen, raportin URL:iin,
   mittakaavakertoimeen ja ilmoituksen tekstimuotoon.
5. Jos mittayksiköitä ei löydy, löytyy ristiriita tai taulukko
   ei ole yksiselitteinen, arvo saa `missing` / `conflict`
   -tilan. Muiden taulukoiden mittayksikköä ei lainata.
6. Alkuperäinen `engine/generic-statement-tables.mjs`
   säilyy kehitysvertailuna, mutta varsinainen tutkimusajo
   käyttää nyt todistuspohjaista kerrointa.

## Todellinen mittayksikkökoe

| Yhtiö | Lähteestä poimitut arvot | Mittakaava todistettu | Jatkotarkistettava |
|---|---:|---:|---:|
| Microsoft | 17/20 | **17/17** | 17/17 |
| Apple | 20/20 | **20/20** | 20/20 |
| **Yhteensä** | **37/40** | **37/37** | **37/37** |

Molempien yhtiöiden vuoden 2025, 2023 ja 2021
vuosikertomusten taulukoissa sekä viiden vuoden vertailusarakkeissa
mittayksikkötodiste löydettiin. Luvut säilyivät ennallaan,
mutta niitä ei enää kerrota oletuskertoimella.

- Microsoftin lähdeajo: https://github.com/naatti21/osakevahti/actions/runs/42399447549
- Applen lähdeajo: https://github.com/naatti21/osakevahti/actions/runs/42399447540
- Microsoft vuosikertomus 2025: https://www.microsoft.com/investor/reports/ar25/
- Apple Form 10-K 2025: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html

### Mitä mittakaavatodiste EI todista

- Raportin $-merkki ja taulukkorivien kertoimet eivät yksin
  varmista valtion verotuksellista kotipaikkaa tai kaikkia valuuttakäytäntöjä.
- Raportin mittayksikön oikea käsittely ei tee poiminnasta
  riippumatonta tilinpäätöstarkastusta.
- Kahden yhtiön ja kolmen raportin onnistunut käsittely ei
  todista että kaikki maailman HTML-vuosikertomukset toimivat.
- Historiallisten oikaisujen, osuuslajien, konsernimuutosten,
  käypien arvojen ja lainavelan laskentamallien vertailukelpoisuus
  on vielä varmistettava.

**Riippumattomasti tarkastettu 0/80 koko neliyhtiöaineistossa.**
`investmentUse: NO_GO` on edelleen oikea päätös.

## Seuraava tutkimuskierros

Valitaan **riippumaton toinen virallinen julkaisu** Microsoftin
ja Applen vuoden 2025 lukujen ristiintarkistukseen.
Sen jälkeen lisätään automaattinen raporttien oikaisuhavaitsin
ja testataan uusi yhtiö ilman poikkeussääntöjä.

Ei PWA-, Worker- tai main-haaran muutoksia.