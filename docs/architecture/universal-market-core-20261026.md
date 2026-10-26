# Osakevahti Alpha — universaali markkinadataperusta / vaihe 1

Päivä 2026-10-26. **Kehityshaara, ei julkaisuvalmis.** Tuotannon main ja Alphan deploy-haara eivät muutu tämän PR:n vuoksi.

## Ongelma

Nykyinen järjestelmä riippuu kiinteistä instrumenteista kahdessa eri paikassa:
- Frontend index.html sisältää LEGACY_DATA_KEYS-, isHelsinkiHolding-, finnhubSymbol- ja refreshMarket-polut, joissa on erityisesti vanhojen instrumenttien sidontoja.
- GitHubin .github/workflows/pages.yml sisältää etukäteen määrätyt SYMBOLS- ja FUND_PAGES-listat.
- Cloudflare Worker palauttaa valmiin assets-kokoelman; Resolver pystyy hakemaan instrumentteja, mutta se ei tee koko markkinadataketjua universaaliksi.
- Rahaston NAV-päivä, osakkeen viimeisen kaupan aika sekä palvelun hakuaika on erotettava. Sama 20 min tuoreusraja kaikille ei ole oikein.

## Vaiheen 1 muutokset tässä haarassa

- engine/market-core.mjs: instrumentin tunnisteet, pyynnöt salkun senhetkisistä instrumenteista, identiteettitarkistukset, osuuslaji/valuutta, markkinakaupan ja NAV-päivän aikamalli ja lähteen viiveestä riippuva laatu.
- engine/market-router.mjs: provider-neutral adapterikutsu ja varareititys; ei kiinteitä instrumenttinimiä.
- tests/market-core.test.mjs ja tests/market-router.test.mjs: tuntemattomat synteettiset arvopaperit, rahastot/ETF:t, hylätyt väärät identiteetit, vuosi-päätelmän merkitseminen, lähdekatkokset, eri markkinapaikat ja datan minimointi.
- package.json ja Quality gate: markkinamoottorin testit myös CI:ssä.

**Tietosuoja:** ulkoisessa haussa vain arvopaperin tunnistetiedot. Ei määrää, hankintahintaa, välittäjää, tiliä, salkun arvoa eikä tuonnin kuvadataa. Paikallinen salkku pysyy local-first.

**Identiteetti:** ISIN (jos tiedossa), MIC (jos tiedossa), valuutta ja osuuslaji. Ticker ja palveluntarjoajan koodi eivät yksin riitä osoittamaan oikeaa rahasto-osuuslajia. Epäselvä ehdokas vaatii käyttäjän hyväksynnän.

**Aikaleimat:** fetched_at on tiedonhakuaika, quote_at on toteutuneen kaupankäynnin aika ja nav_date rahaston arvostuspäivä. Niitä ei saa korvata toisillaan. Rahaston vuodeton DD.MM. voidaan näyttää merkittynä vuoden päätelmänä, ei lähteen vahvistamana vuotena.

## Seuraavat toteutusvaiheet ennen tuotantokäyttöä

1. Toteuta yleinen palvelinrajapinta /v1/search (ticker, nimi, ISIN) ja /v1/quotes (valittujen instrumenttien erä). Vahvista symbolit ja osoitteet, rajoita kutsumääriä ja aikakatkaisuja. Ei omistusmääriä palvelimelle.
2. Arvioi tarjoajien kattavuus, ISIN/rahasto-osuuslajit, pörssiaikaleimat, NAV, hinnat, käyttöehdot ja kustannus. Ilmainen Yahoo on epävirallinen eikä pysyvän toimivuuden tae. Providerien vaihdettavuus säilyy.
3. Kytke Alpha refreshMarket käyttämään dynaamista pyyntölistaa ja adapterireittiä. Nykyinen staattinen syöte voi olla tilapäinen legacy-varalähde, muttei instrumenttien rajaaja.
4. Lisää epäselvän instrumentin lähdesidonnan vahvistus ja sen paikallinen tallennus; älä koskaan arvaa yhdistämistä nimen perusteella.
5. Testaa uusien instrumenttien haku, tunnetut osakkeet ja rahastot, väärä valuutta/ISIN/osuuslaji, työkalun kaatuminen, NAV ilman vuotta, markkinapyhät, kesäaikavaihtelut, puhelimen offline/PWA-päivitys sekä salkun localStorage-palautus.

## Ei-neuvoteltavat hyväksymiskriteerit

- Tuettu, uusi instrumentti löytyy ilman tunnuksen lisäämistä lähdekoodiin.
- Virheellistä instrumenttia tai hinnan valuuttaa ei hyväksytä eikä muuteta virheellisesti käyttäjän omistuksia.
- Tiedon saatavuuden puute raportoidaan rehellisesti; rahaston NAV-päivää ei keksitä hakupäivästä.
- Käyttäjän määrät, hankintahinnat, tilit ja vanhat paikalliset tallennukset säilyvät.
- Android, CI, regressiot ja pilvijulkaisu testataan ennen hyväksyttyä deployta.

**Rajaus:** tässä vaiheessa on uusi testattava perusta, mutta Alpha UI ja julkaistu Worker eivät vielä käytä sitä. Vaihe 2 vaatii provider-sovittimet, varmistetun datapalvelun ja integraatiotestit. Ei mergeä/deployta automaattisesti.
