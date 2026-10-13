# Osakevahti — NOW

**Päivitetty:** 2026-10-13  
**Tila:** ALPHA 2 PHONE SMOKE PASS / PRODUCTION NO-GO  
**Repo:** https://github.com/naatti21/osakevahti  
**Tämä on operatiivinen tilannekortti, ei QA-päiväkirja.** Äppejien yhteinen `00_NOW.md` kokoaa muiden sovellusten tilanteen; tarkka näyttö kuuluu repo-PR:iin.

## Varmennettu nykytila

- **Varsinaisen sovelluksen main:** `735d6ecbd5749ed8d3cdcb5511d28c190c3adade`. GitHub Pages -tuotanto ei ole saanut alla kuvattuja Alpha-muutoksia.
- **Testattava erillinen Android-PWA:** `OV Alpha` Cloudflare Pages -originissa `https://osakevahti-alpha-naatti21.pages.dev/`. Ei sama origin kuin GitHub Pagesin tuotanto; käyttäjän salkkutiedot eivät saa sekoittua ympäristöjen välillä.
- **Alpha 2:** [Draft PR #20](https://github.com/naatti21/osakevahti/pull/20), HEAD `d74570cbebe5376154bd41f20a0bfa7274bb30e9`. PWA:n nimi/manifest-id ja localStorage-avain pidettiin samoina Alpha 1:n kanssa, jotta vanhan Android-asennuksen päivitystä voitiin kokeilla.
- **Kehittäjän automatisoitu näyttö:** [101/101 Playwright](https://github.com/naatti21/osakevahti/actions/runs/38398106439), [3/3 paketointi](https://github.com/naatti21/osakevahti/actions/runs/38398106350), [QA8 ja OCR-stressi](https://github.com/naatti21/osakevahti/actions/runs/38398106469) sekä [1/1 strict CDN OCR](https://github.com/naatti21/osakevahti/actions/runs/38398106444). Tämä ei yksin ole uusi riippumaton tuotanto-GO.
- **Fyysisen puhelimen Alpha 2 -päivitystesti:** käyttäjä ilmoitti, että online- ja offline-käyttö toimivat ja omistukset säilyivät. [Kirjaus PR #20:ssä](https://github.com/naatti21/osakevahti/pull/20#issuecomment-6146332024). Se on rajattu käyttäjän **PASS-havainto**, ei laaja tietuekohtainen auditointi.
- **Vielä erikseen vahvistamatta:** näkyikö `ALPHA 2 · PÄIVITYSTESTI` nimenomaan vanhasta kotinäytön `OV Alpha` -kuvakkeesta avattaessa; laitteen SW/cache-version yksityiskohtaista elinkaarta ei raportoitu. Älä nosta niitä PASSiksi.
- **Varsinainen tuotanto:** **NO-GO**, avoimet Draft-PR:t ja tuotannon julkaisuportti eivät muutu Alpha-smoken perusteella.

## ONE NEXT ACTION

Tee tarvittaessa **rajattu puhelinvahvistus**: avaa nimenomaan vanha `OV Alpha` -aloitusnäytön kuvake ja tarkista Alpha 2 -merkintä; älä poista sovellusta, tyhjennä tallennusta tai muuta tuotantoa. Sen jälkeen arvioidaan erikseen seuraava Alpha-/release-QA, ei automaattista mergeä.

**SINULTA TARVITAAN:** vain jos haluat sulkea puhelinversion viimeisen tarkistuskohdan, vahvista Alpha 2 -merkintä vanhasta kuvakkeesta. Muu jatkokehitys ei vaadi käyttäjää kopioimaan koodeja tai QA-raportteja käsin.

## Jatkamisohje

Tarkista GitHubista `main`, avoimet PR:t (#20 → #19 → #18 ja erilliset RC/QA-PR:t), uusin kommentti sekä CI oikealle SHA:lle. Vanhat lukitut QA-GO:t eivät siirry automaattisesti uudelle commitille. Käyttäjän nykyiseen asennukseen ei kosketa dokumentointitehtävän yhteydessä.
