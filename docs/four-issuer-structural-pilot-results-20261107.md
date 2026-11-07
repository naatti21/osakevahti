# Neljän yhtiön yleisen raporttilukijan koe – 7.11.2026

**Tila:** teknisesti lupaava, **EI julkaisuvalmis / DATA NO-GO**.

## Mikä muuttui aiemmasta 15/40-sokkotestistä?

PR #102 paljasti, ettei Applen HTML-vuosikertomuksien rakennetta tunnistettu
lainkaan ja Elisan lainakäsitteitä ei tunnistettu kaikilta tilikausilta.

Tässä tutkimus-PR:ssä #103:
1. `engine/generic-statement-tables.mjs` luokittelee tilinpäätöstaulukot
   niiden **rakenteen ja yleisten kirjanpitokäsitteiden** perusteella
   (tuloslaskelma, rahavirtalaskelma, tase). Vuosiotsikot voivat olla
   nelinumeroisia vuosia tai muotoa `September 27, 2025`.
   Soluissa erilliset dollarisymbolit ja tyhjät esityssolut eivät
   sekoitu numeroihin.
2. Taseen korolliset lainat summataan vain, kun kaikki määritelmään
   tarvittavat rivit löytyvät. Tuki kahdelle **yleiselle**
   esitystavalle: `short-term debt + current portion + long-term debt`
   ja `commercial paper + current term debt + non-current term debt`.
   Tämä ei ole nettovelka eikä sisällä automaattisesti kaikkia
   leasingvelkoja.
3. ESEF:n yleiseen IFRS-sanastoon lisättiin
   `ifrs-full:ShorttermBorrowings`. Elisan lukua ei kovakoodattu.
4. **Kriittinen XBRL-korjaus:** xBRL-JSON `instant`-päivämäärä
   `2026-01-01T00:00:00` on **31.12.2025 loppusaldo**.
   Aiempi lukija näytti taseen lainat väärällä vuosiluvulla.
   Nokia PR #101:n vanha velkataulukko on korjattu tämän PR:n
   `docs/official-filings-pilot-results-20261107.md`-tiedostossa,
   ja vanhaan PR:ään jätettiin nimenomainen varoitus.

## Neljä todellista lähdekoetta (5 × 4 = 20 kenttää/yhtiö)

| Yhtiö | Muoto | Poimittu / 20 | Puuttuu |
| --- | --- | ---: | --- |
| Nokia | Virallinen ESEF, standardi IFRS XBRL | **20** | 0 |
| Elisa | Virallinen ESEF, standardi IFRS XBRL | **18** | vuosien 2021 ja 2022 lainavelka |
| Microsoft | Yhtiön HTML-vuosikertomukset | **17** | vuosien 2021–2023 lainavelka |
| Apple | Yhtiön alkuperäiset 10-K HTML-vuosikertomukset | **20** | 0 |
| **Yhteensä** | kaksi toisistaan erillistä lukutapaa | **75 / 80** | **5** |

**75/80 = 93,75 % lähteestä poimittuja kenttiä.** Tämä EI mittaa
tietojen taloudellista oikeellisuutta eikä ole universumin
kattavuustesti. Jokaisen poiminnan lähde ja tulkinta on erikseen
varmennettava ennen pisteytystä. Toistaiseksi vain neljä valittua
yhtiötä on testattu. Applen ja Microsoftin HTML ei ole sama
standardointitaso kuin ESEF XBRL.

### 2025 poiminnat vertailun helpottamiseksi

| Yhtiö | Valuutta | Liikevaihto | Tilikauden tulos | Liiketoiminnan rahavirta | Lainavelka* |
| --- | --- | ---: | ---: | ---: | ---: |
| Nokia | milj. EUR | 19 889 | 660 | 2 071 | **3 413** |
| Elisa | milj. EUR | 2 257,1 | 341,8 | 688,6 | 1 577,1 |
| Microsoft | milj. USD | 281 724 | 101 832 | 136 162 | 43 151 |
| Apple | milj. USD | 416 161 | 112 010 | 111 482 | 98 657 |

*Lainavelka: vain raporteista nimenomaisesti eritellyt
korolliset lyhyet/pitkät lainat. Ei nettovelka, ei kokonaisvelat.
ESEF:n hetkiarvojen raportointipäivä korjattu. Valuuttoja ei
muunnettu yhdeksi suureeksi.

## Toistettava lähdetodiste

- Nokian ja Microsoftin raportit:
  https://github.com/naatti21/osakevahti/actions/runs/42389799538
- Elisan ja Applen raportit:
  https://github.com/naatti21/osakevahti/actions/runs/42389799595
- Jokaisesta raportista työajo kirjaa lähdelinkin, valitun
  taksonomiakäsitteen tai taulukkorivin, tilikauden, valuutan ja
  hylätyt/puuttuvat kentät.
- Vanhat HTML-parserin tulokset säilyvät vertailua varten;
  Microsoftin **17/20** ei heikentynyt.
- GitHub Actionsin yleiset regressiotestit on ajettava erikseen
  ja niiden oltava vihreät ennen jatkokäyttöä.

## Kovat hyväksymisesteet (vielä avoinna)

1. Testaa useampi IFRS-yhtiö ja yhdysvaltalainen yhtiö eri
   toimialoilta ilman yrityskohtaisia muokkaussääntöjä.
2. Ratkaise Elisan kahden vanhemman vuoden ja Microsoftin kolmen
   vuoden puuttuvat velkakomponentit vain alkuperäisillä todisteilla.
3. Varmista 2021–2025 lukujen arvot ja mahdolliset oikaisut
   alkuperäisistä tilinpäätöksistä **riippumattomasti**.
4. Todista raporttien mittayksikkö (miljoonat/tuhannet), juridinen
   konserni, oikea tilikausi ja IFRS/US GAAP -erojen käsittely
   automaattisesti myös poikkeustilanteissa.
5. Varmista lähteiden käytön/lisenssien ehdot ja hallitse datan
   latausmäärät.
6. Vasta tämän jälkeen jatketaan salkunlaatu- tai osinkopisteytykseen.

**Ei mergeä, ei Cloudflare Worker -muutoksia, ei PWA-julkaisua,
ei ostosuosituksia.**
