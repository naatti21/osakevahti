# Osakevahti Alpha – julkisen rahastotaulukon varalähde (vaihe / jatko)

Päivä: 26.10.2026. **DRAFT / EI JULKAISTU / EI YHTEYTTÄ NYKYISEEN SALKKUUN**.

## Tavoite

Osakevahdin yksityiskäytössä käytetään ensisijaisesti ilmaisia kurssi- ja NAV-lähteitä. Kun rahaston ensisijainen NAV-päivä puuttuu tai on yli 7 päivää vanha, sallitaan **enintään kerran päivässä** vaihtoehtoisen julkisen rahastotiedon tarkistus. Julkisen sivun nimi, päivä ja hinta eivät yksin todista ISINiä, minkä vuoksi lähdesidonta pitää vahvistaa paikallisesti.

## Rahastoraportin havaittu julkinen aineisto

- Julkinen näyttö https://www.rahastoraportti.fi/ esittää osuuslajin, täydellisen arvostuspäivän, hinnan, valuutan ja vuoden alin/ylin -arvot.
- Palvelun oman esittelyn https://www.rahastoraportti.fi/aboutTheService mukaan lähes kaikkien Suomessa myytävien rahastojen päiväarvot ovat yleisölle maksutta luettavissa ja tiedot julkaistaan verkkosivulla tunneittain rahastoyhtiöiltä.
- Erillinen syötetilaus on tarjolla jälleenjakelijoille; **julkinen verkkosivu ei itsessään ole dokumentoitu avoin API eikä takaa koneellista pääsyä**.
- Web-katselussa palvelun vastauksena on myös nähty JavaScript-sovelluksen latauskuori, joten HTML-GET-pyyntö ei välttämättä sisällä rahastotaulukkoa. Aineistoa ei saa keksiä eikä sivun piilotettua autentikointia ohittaa.

## Toteutettu tässä vaiheessa

1. `engine/public-fund-fallback.mjs` – yleinen, rahastosta riippumaton lähdetaulukon rivien lukija sekä vain tarkasti osuuslajin nimeä ja valuuttaa vastaavan, käyttäjän **nimenomaisesti vahvistaman** ISIN→julkinen osuusluokkanimi -sidonnan kelpuutus. Ei osittaisen nimen hakua.
2. Validaatio: todellinen DD.MM.YYYY, vähintään positiivinen hinta, enintään 7 kalenteripäivää vanha NAV, ei hyväksyntää jos vanha lähde on salkun uutta NAV:ia vanhempi. Julkisissa listauksissa on havaittu myös vuoden vaihteluväliin nähden epäjohdonmukaisia numeroita – ristiriidat hylätään. Suuret NAV-hypyt vaativat käyttäjän erillistarkistuksen.
3. `shouldUseFundBackup` – vain puuttuvan/vanhan ensisijaisen NAV:n varayritys ja 24 tunnin viive yritysten välillä.
4. `scripts/market-data/public-fund-page-capability.mjs` – erillinen yksi GET julkiselle verkkosivulle ja robots.txt-tiedostoon, raportoi vain sen, saako automaattisesti tavallisen HTML-taulukon. Ei instrumenttikyselyjä, rahastotietojen talteenottoa, salasanoja eikä henkilötietoja.
5. Synteettiset regressiot sekä erillinen diagnostiikkatyönkulku.

## Tärkeät puuttuvat osat

- Yhtään automatisoitua Rahastoraportin hintasyöttöä ei vielä ole hyväksytty tai kytketty. Lukija käsittelee lähteen **käyttäjän nähtäväksi saamaa julkista taulukkotekstiä**, ei site:n piilossa olevia rajapintoja.
- Julkisissa taulukkoriveissä ei nähty varmennettua ISINiä: saman nimisiä osuusluokkia tai virheellisiä summia ei saa sitoa summittaisesti.
- Vasta lähdelisenssin, oikean koneellisesti saatavan julkisen rivin ja kertaluonteisen käyttäjän vahvistuksen jälkeen voidaan rakentaa automatisoitu yksi-haku-per-päivä -varalähde.
- Ei julkaistua Alphan versiota, Cloudflare Workeria, main-haaraa tai nykyistä localStorage-salkkua muuttavia tiedostoja.

**Sitova rajoite:** 0 €/kk. Ei massapoimintaa, välityspalvelun turvarajoitusten kiertämistä, tiheää pollailua eikä tekaistuja NAV-päiviä.

## Tekninen läpimurto: julkinen ISIN-tarkka JSON

26.10.2026 GitHubin yksi normaalin selaimen avaava testi vahvisti, että Rahastoraportin julkinen käyttöliittymä näyttää yli 2000 riviä ja lataa tietonsa onnistuneesti yhden julkisen taustatiedoston kautta.

Palvelun julkisen selaimen käyttämä URL:
https://rahastoraportti-backend.app.sijoitustutkimus.fi/FUND_CLOSING_PRICES_JSON/Fund_ClosingPrices_LATEST.json

Yhden GET-tarkistuksen vastaus: HTTP 200, noin 1,32 MB, JSON-taulukossa 2065 tietuetta. Jokaisessa tietueessa on ISIN, closePrice, closePriceDate ja fundCode; valuutta puuttuu kymmenestä tietueesta. Arvostuspäivät ovat kahdeksannumeroisia YYYYMMDD-merkkijonoja ja hinnat desimaalimerkkijonoja. Julkaistu selain käyttää samaa taustatiedostoa. Robots.txt: User-agent: * / tyhjä Disallow.

Uusi workers/providers/rahastoraportti-public.mjs lukee koko tämän julkisen listan tarvittaessa enintään kerran 24 tunnissa **yhden Worker-prosessin** näkökulmasta ja palauttaa vain pyydetyn ISINin päivätyn NAV-arvon. Se ei tunne rahastojen nimiä etukäteen, eikä lataa useita rahastokohtaisia sivuja. Koneellisesti virheellinen ISIN, puuttuva valuutta, epäkelpo/vanha päivämäärä, nollahinta tai kaksois-ISIN torjutaan. Virheissä estetään välitön uudelleenyritys.

Integraatio: Cloudflare-yhteensopiva yleinen gateway voi aktivoida varalähteen erikseen asetuksella ALLOW_PUBLIC_FUND_BACKUP=true. Tämä ei automaattisesti kytke kokeellista Yahoo-osakereittiä. Vastauksessa on sourceKind=public-web-publication ja requiresManualReview=true; käyttäjän salkkua ei päivitetä automaattisesti.

**Rajoitukset:** Tämä on julkisen verkkosivun käyttämä taustatiedosto, ei dokumentoitu erillinen yleiskäyttöinen tai uudelleenjakeluun lisensoitu API. Yksityiskäyttö, pieni kyselytahti ja julkinen saatavuus vähentävät käytännön haittaa, eivät yksin osoita kaikkia käyttöoikeuksia. Cloudflare Workerin muistin välimuisti ei ole globaalisti jaettu eikä siksi teknisesti takaa täsmälleen yhtä ulkoista hakua vuorokaudessa kaikkien prosessien yli. Mitään rahastotietoa ei julkaista uudelleen kokonaisena listana.

**Ei vielä tuotannossa:** Tämä PR on DRAFT-kehityshaara eikä nykyisen Alpha-PWA:n uusi versio. Edellyttää toteutettujen CI-testien hyväksyntää, eristettyä live-adapteritestiä, käyttäjän lähdevalintaa/varahintojen näyttötapaa ja mobiili-PWA-regressioita.
