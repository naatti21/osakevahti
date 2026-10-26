# Osakevahti Alpha – maksuttomien lähteiden oikeat HTTP-rajapinnat

Päivä: 26.10.2026. Tila: **DRAFT / EI JULKAISTU**. Pohja: PR #88 / PR #87 / PR #86.

## Mitä toteutettiin

- `workers/free-reference-gateway.mjs`: GET /v1/identity?isin=... (OpenFIGI, tunnistusehdokkaat) ja GET /v1/fx?base=USD&quote=EUR (Frankfurter v2, päivätty valuuttaviite). Palautteissa erotellaan lähde ja luotettavuus; tunniste-ehdotus ei ole hinta eikä automaattinen osuma.
- `workers/universal-market-gateway.mjs`: uusi ilmainen rajapinta on yhdistetty Cloudflare Worker -entrypointiin, mutta vanhat Yahoo-pohjaiset kokeelliset quote/search-reitit ovat nyt oletuksena **suljetut**, kunnes staging-ympäristössä asetetaan eksplisiittisesti ALLOW_EXPERIMENTAL_YAHOO=true. Tätä ei saa tulkita hyväksytyksi dataoikeudeksi.
- Vain instrumenttitunniste tai kaksi valuuttakoodia; ei salkun omistuksia, määriä, hankintahintoja, tiliä, välittäjää, avaimia eikä tallennusta pilveen.
- Avaimeton API. Kutsurajat **yksittäisessä Worker-prosessissa** (OpenFIGI 10/min, FX 15/min), onnistuneiden lukujen välimuisti (OpenFIGI 7 päivää, FX 4 tuntia), rinnakkaisten identtisten kutsujen yhdistäminen. Nämä eivät ole globaaleja kiintiörajoja eri Cloudflare-instanssien välillä. Kummankaan palveluntarjoajan ilmaisesta tasosta ei synny rahallista ylityslaskua.
- Sovellus ei kirjoita paikallisiin omistuksiin; käyttöliittymä ei vielä kutsu uusia rajapintoja.

## Lähteet ja varaukset

OpenFIGI: https://www.openfigi.com/api/documentation
Avaimeton tunnistekartoitus, 25 mapping-kutsua/min ja 10 työtä/kutsu. Ei markkinahintaa. Eri listauspaikkojen ja rahastojen tulokset voivat olla epäselviä ja vaativat käyttäjän vahvistuksen.

Frankfurter: https://frankfurter.dev/
Maksuton, avaimeton v2/rate-palvelu. **Päivittäin** päivittyvä kurssi; ei pörssin intraday-hinta. Sovitin pyytää nyt eksplisiittisesti providers=ecb, jotta lähtö on EKP:n viitekurssi eikä oletuksena eri lähteistä laskettu yhdistelmä. Päivä, pari ja kurssin positiivisuus tarkistetaan. Jos EKP ei julkaise kyseistä paria, palvelu ilmoittaa ei saatavilla; siihen ei keksitä vaihtokurssia.

Rahastoraportti: https://www.rahastoraportti.fi/aboutTheService
Palveluntarjoaja sanoo tarjoavansa yleisölle maksutta lähes kaikkien Suomessa markkinoitujen rahastojen päivittäisiä hintoja, jotka rahastoyhtiöt toimittavat ja jotka julkaistaan verkkosivulla tunnin välein. Tämä on hyvä **tiedon todennuspaikka**. Sen erillinen automaattinen datasyöte on kuitenkin palveluntarjoajille ja datajulkaisijoille suunnattu palvelu. Automaattisen käytön lisenssi ja ISIN-/osuussarjan todentaminen ovat avoimia. Älä rakenna sen yksittäisten sivurivien luvattomaan massapoimintaan. Nimiosuman perusteella rahastoa ei hyväksytä.

## Keskeneräinen ja todelliset hyväksymiskriteerit

1. Oikeiden avaimettomien API-vastausten live-smoke ennen palvelun julkaisua. Syntetisoitu CI ei todista verkon toimivuutta, CORSia tai tiedon ajantasaisuutta.
2. Globaalisti jaettu käyttörajoitus tai riittävän harva henkilökohtainen käyttö. Nyt käytössä oleva per-isolate-rajoitus ei ole palvelinlaajuinen suoja.
3. Eristetty Cloudflare-staging Worker ja oikean Alphan käyttöliittymän vain-luku-diagnostiikka. Nykyiseen Worker-tuotantoon ei kosketa.
4. Pörssi-/ETF-datan sallittu, nollaeuroinen toimittaja sekä ISIN-tarkka päivitetty NAV-ketju puuttuvat vielä laajaan yleiskäyttöön. Ilman sitä hinta on 'ei saatavilla' tai 'vahvistamatta', ei keksitty arvio.
5. Regressiot: oikeat lisätyt instrumentit, erilliset NAV/arvostuspäivät, väärä ISIN/valuutta, maksimikiintiöt, offline/PWA/mobiili, paikallisen salkun säilyminen.
6. Vasta käyttäjän hyväksymän testauksen jälkeen voidaan harkita tuotannollista integrointia.

**Huomio:** CORS on selainten suojaus, ei todellinen palvelinpuolen autentikointi. Maksuttomaan julkiseen endpointiin ei lähetetä henkilötietoja eikä API-salaisuuksia.
