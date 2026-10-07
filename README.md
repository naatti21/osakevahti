# Osakevahti v1

Kevyt henkilökohtainen PWA salkun, stop-tasojen ja omistuskohtaisten uutisten seurantaan.

## Miksi tämä rakenne

- Ei Streamlitiä eikä backend-pakkoa.
- Toimii GitHub Pagesissa tavallisena staattisena sivuna.
- Asennettavissa Androidin kotinäyttöön PWA:na.
- Omistukset ja Finnhub-avain tallennetaan vain selaimen `localStorage`en.
- Repo ei sisällä henkilökohtaista salkkua eikä API-avaimia.

## Käyttöönotto GitHub Pagesissa

1. Korvaa vanhan repon tiedostot tämän paketin sisällöllä.
2. GitHubissa: **Settings → Pages**.
3. Kohdassa **Build and deployment** valitse **Deploy from a branch**.
4. Branch: `main`, folder: `/ (root)`.
5. Tallenna ja odota Pages-linkin valmistumista.
6. Avaa linkki Androidin Chromessa → selaimen valikko → **Lisää aloitusnäyttöön / Asenna sovellus**.

## Finnhub

Luo Finnhub API -avain ja syötä se sovelluksessa kohtaan **Asetukset**.
Avainta ei kirjoiteta lähdekoodiin.

App käyttää Finnhubia:
- kurssille (`quote`)
- historiadatalle (`stock/candle`) ATR 14 -laskentaa varten
- yhtiöuutisille (`company-news`)

Jos tietty instrumentti ei ole Finnhubin paketissasi tai symboli eroaa välittäjän symbolista,
syötä `Finnhub-symboli` erikseen. Nykykurssin voi myös syöttää käsin.

## Valuuttamuunnos

Valuuttamuunnos käyttää Frankfurter API:a. Jos valuuttakurssia ei saada verkosta, appi säilyttää viimeisen onnistuneen kurssin.

## Stop-logiikka

Riskivahti laskee:
- käyttäjän oman stopin
- trailing-stopin korkeimmasta appin näkemästä kurssista
- ATR 14 × 2,5 -tason, jos historiadataa saadaan

Aktiiviseksi suojatasoksi valitaan korkein käytettävissä oleva näistä.
Jos ATR:ää ei ole, käyttöliittymä voi käyttää hankintahintaan perustuvaa varatasoa riskiluokan mukaan.

Tämä on päätöksenteon apuväline. Se ei tee kauppoja.

## Tärkeä rajoitus v1

Selain ei voi luotettavasti valvoa kursseja taustalla silloin, kun sovellus ei ole käynnissä.
v1:n ilmoitukset tarkistetaan päivityksen yhteydessä.

Seuraava vaihe on erillinen kevyt taustavahti, joka mahdollistaa aidot push-hälytykset.

## CSV

Sarakkeet:

`symbol,name,quantity,buy_price,currency,account,provider_symbol,manual_stop,trailing_pct,risk_class`

`risk_class`: `low`, `medium` tai `high`.

## Tietoturva

Älä koskaan commitoi API-avaimia tai henkilökohtaisia omistuksia julkiseen repoon.
