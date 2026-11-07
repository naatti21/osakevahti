# Osakevahdin yleinen osaketarkistus: kivijalka (7.11.2026)

## Toiminto
- Markkinavahti -> **Tutki osake** (ei uusia kortteja pääetusivulle).
- Kaikki sallittua merkistöä käyttävät pörssitunnukset kelpaavat syötteeksi; yhtäkään yhtiötä ei kovakoodata.
- Nykyinen \`/instrument?symbol=...\`-rajapinta käyttää ainoastaan käyttäjän syöttämää tunnusta. API-vastaus arvioidaan paikallisessa \`stock-inspection.mjs\`-moottorissa.
- Näytetään ajallinen kurssihavainto lähteineen, kurssikehitys 1/3/6 kk vain, jos riittävästi oikeita havaintoja, ja raportoidut 12 kk osinkotapahtumat erikseen.
- Aito osinkolaatu, viiden tilikauden vahvistettu historia, tulos, kassavirta, nettovelka ja oikea OST/AOT-suositus: **Tieto ei riitä**, ellei lähde oikeasti anna niitä.
- Vanhat/ristiriitaiset/virheelliset osake- ja valuuttatiedot hylätään, ei näennäisiä tuottopisteitä.
- Instrumenttilaji (EQUITY/ETF) välitetään metatietona, jos lähde ilmoittaa; ETF:lle ei esitetä osakeanalyysiä. Vanhan Worker-version puuttuva lajimerkintä ilmoitetaan vahvistamattomaksi.

## Tietosuoja ja tekniset rajat
- Ei vaadi uusien yhtiöiden ohjelmointia, käyttäjän salkun lähettämistä tai muutoksia omistus-/varmuuskopiointitietoihin.
- Datan nykyinen reitti on Yahoo Chart -> Osakevahdin Cloudflare Worker -> käyttäjän mobiili-PWA; toteutuksen valmistuminen ei vielä todista julkisen Yahoo-rajapinnan käyttöoikeutta tai korkean saatavuuden tuotantokelpoisuutta.
- Nykyinen single-symbol Worker ei ole aukoton yhtiöiden tunnistusjärjestelmä: ISIN, MIC, osuuslaji ja verotuksellinen kotipaikka odottavat varmennettua lähdettä.
- Free-tier-vaihtoehdoissa EODHD tarjoaa 20 kutsua/päivä ja yhden vuoden historian; se ei kata 5v osinkoanalyysiä tai fundamentteja ilmaiseksi. Twelve Data:n osinkohistoria on rajattu maksulliseen Grow-tasoon. Tietoja ei integroida ilman lisenssi- ja kattavuustarkistusta.
- 7.11.2026 lähteet:
  - https://eodhd.com/help/plans
  - https://twelvedata.com/docs
  - https://www.nasdaq.com/market-activity/stocks (ei ole datan käyttöoikeus)
- Muutos toimitetaan vain kehityshaaraan. Ei Cloudflare Worker- eikä PWA-deployta. Riippumaton testaus ja mobiilin hyväksyntä ennen julkaisua.

## Jatko
1. Todelliset julkisesti sallitut ja vähintään 5 vuoden kattavat fundamentti- ja osinkolähteet; tariffin, lisenssin ja markkinakattavuuden todiste.
2. Yhtiön identiteetin, osuuslajin, valuutan ja kaupankäyntipaikan varmennettu tietue.
3. Versionoitu viiden tilikauden talous- ja osinkotapahtumien syöte ja puuttuvien tilikausien erotus.
4. Osingon kestävyyden ja OST/AOT-tilivalinnan arviointi vasta tämän jälkeen.
