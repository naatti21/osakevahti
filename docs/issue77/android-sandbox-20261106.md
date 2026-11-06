# Issue #77 – Android-testin erillinen QA-ympäristö (6.11.2026)

**Vain omaan käyttöön / testiin.** Tämä QA-haara lähtee PR #96:n tarkistetusta commitista `b4992621e151e7d489efb2ef0c7a1ed0cfa1405a`. Se **ei** yhdistä eikä julkaise `main`- tai `deploy/osakevahti-alpha-20261013`-haaraa.

## Suojaus ja julkaisutapa
- Build tuottaa tiukasti rajatun staattisen PWA:n. QA-artefaktissa näkyy erillinen nimi **Osakevahti QA – TESTI** ja manifestin oma `channel=issue77-qa`.
- Mahdollinen Cloudflare Pages -julkaisu menee **vain preview-haaraan** `issue77-android-sandbox` ja siten erilliseen origin-osoitteeseen. Workflow tarkistaa ensin Cloudflare-projektin tuotantohaaran; jos preview-haara on sama, se pysähtyy.
- Workflow ei käytä mainin eikä Alphan julkaisutyönkulkua. Jos Cloudflare-token puuttuu, jää pelkkä GitHub Actions -testi + ZIP-artifakti. Julkaisuosoitteen toteutuminen **pitää varmistaa GitHub-ajon logista**, ei arvata.
- Ei salkun etätallennusta, ei tuotuja portfolioita workflow'hun, ei käyttäjän omistus- tai tilitietoja verkkokutsuihin. Hakukenttä lähettää nimen tai ISINin erilliseen gatewayhin, jos palvelu on käytettävissä.
- GitHubin ulkoiset hintalähdekokeilut käyttävät vain julkisia testitunnisteita ja antavat **diagnostiikan**, eivät anna automaattiselle NAV:lle hyväksyntää.

## Android-testin käyttäjäpolku
1. Avaa nykyinen oikea Alpha **entiseen tapaan**. Asetukset → Varmuuskopio → **Vie JSON**. Varmista, että tiedosto tallentui puhelimeen. **Älä tyhjennä selaimen sivustodataa, poista sovellusta tai korvaa olemassa olevan Alphan tallennustilaa.**
2. Avaa GitHub Actions -ajossa varmennettu erillinen QA-osoite selaimessa. Tarkista yläotsikko **Osakevahti QA – TESTI**. Aloita **vain keksityillä testiarvoilla**; älä tuo oikeaa salkkua testiin.
3. Salkku → **+ Lisää rahasto** → nimi `QA Harjoitusrahasto`, ISIN tyhjäksi, EUR, palveluntarjoaja `TESTI`, tili `Tili 1`, määrä `0.37`, keskihankintahinta `80`, NAV `100`, päivä `2026-11-05`, lähde `Keksitty testihavainto`. Vahvista vaaditut valinnat. Odotettu laskennallinen arvostus `≈ 37,00 €`, hankintahinta erillään.
4. Lisää sama nimi toiselle tilille `Tili 2` ja määrä `4.3`. Omistusten tulee säilyä erillään. Kokeile saman rahaston lisäämistä uudestaan **samalle tilille**: tuplakirjaus estetään.
5. QA-sovelluksen Asetukset → Varmuuskopio → **Vie JSON**. Muuta ensimmäisen testiposition keskihintaa. Palauta testin JSON-tuonti: entisen keskihinnan ja kaikkien tilien tulee palautua.
6. Avaa QA vielä verkossa, sulje sovellus, kytke lentotila ja avaa **sama QA-osoite** uudelleen. Tarkista offline-avaus ja molempien positioiden säilyminen.
7. PWA-päivitystesti: pidä QA-asennus paikallaan. Kun QA-workflow'n `QA_GENERATION` vaihdetaan seuraavassa commitissa `v1` → `v2` ja preview päivittyy, avaa sovellus verkossa, sitten offline; varmista että testitiedot säilyvät. Päivitystä **ei saa testata tyhjentämällä sivustodata**.

## Hinta- ja tunnistuskokeilu
- Kokeile hakea yhtä tunnettua rahastoa nimellä ja ISINillä. Jos haku epäonnistuu / tarjoaa ristiriitaisia ehdokkaita, jatka manuaalisesti. ISIN-tarkiste ei itsessään vahvista rahaston oikeaa osuuslajia.
- Auto-NAV on toistaiseksi lukittu: testaa `KÄSIN NAV` ja päiväys/viitteellisyys. Rahastoraportin julkisen rajapinnan **yksi diagnostinen luku** ja OpenFIGI+Frankfurter näyttävät vain teknisen saatavuuden; niiden käyttöoikeudet tai kaikki rahasto-osuuslajit eivät ole todistettuja.
- Kirjaa havainto: onnistuiko haku, näkyikö varoitus, toimiiko offline, säilyvätkö tilit/määrät/hankintahinnat/NAV, palautuuko JSON ja toimiiko asennetun PWA:n päivitys.

**Hyväksyntä:** QA-ympäristön toiminta ei ole lupa julkaista PR #96:a Alphaan. Seuraava päätös perustuu puhelimen testitulokseen. Oikeaa salkkua ei tarvitse altistaa kokeilulle.
