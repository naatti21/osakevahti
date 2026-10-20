# Osakevahti Alpha – markkinadatan lähdekelpoisuuden ensitutkimus (20.10.2026)

## Tavoite
Rahastohinnan automaattinen lähde ei saa perustua pelkkään Google/Yahoo-nimiosumaan tai samaan tekstiin kuin toisen osuussarjan NAV. Ennen uutta live-adapteria on pystyttävä näyttämään: **ISIN, osuussarjan valuutta ja tunniste, todellinen NAV-arvostuspäivä, NAV, lähde sekä käytön ehdot**. Päivä jolloin automaatti latasi sivun ei kelpaa NAV-päiväksi.

## Lähdekartta

| Lähde | Etsintä / identiteetti | NAV ja todellinen päivä | Integraation tila |
|---|---|---|---|
| Nykyinen GitHub `market-data.json` | Kuusi ennalta nimettyä fund-avainta | NAV-numero, mutta Nordea-päivä tyhjä ja Nordnet-päivä usein vain `16.10.`; hakuhetki merkitään aikaleimaksi | **Käytössä mutta puutteellinen**, ei uusille rahastoille |
| Cloudflare Worker `/resolve` / Yahoo | Yahoo-haku tukee `MUTUALFUND`-luokkaa | Ei todistettua yleistä ISIN-tarkkaa NAV+päivä -ketjua | **Ei hyväksytty NAV-lähteeksi** |
| Nordnet External API | Dokumentaatio sisältää `fundlist`-haun | Ei anonyymia toimivaa NAV-todistetta | **Ei kelpaa suunnittelun oletuslähteeksi:** Nordnetin Getting Started toteaa, ettei uusia API-asiakkaita oteta (20.10.2026) |
| Vanguardin virallinen rahastosivu | Global Stock Index EUR Acc, ISIN `IE00B03HD191`, valuutta EUR | Julkisella sivulla on päivätty NAV ja historia. Indeksoidut verkkoversiot näyttävät eri tarkistuspäivinä vanhentuneita otoksia | **Mahdollinen issuer-adapteri, mutta vakaata sallittua automaattista rajapintaa/redistribuutiota ei vahvistettu** |
| Storebrandin julkinen rahastoraportti | Global All Countries A EUR, ISIN `SE0013801453` | Kausiraportissa NAV kyseisen raporttikauden ajalta, ei päivittäinen ajantasainen rajapinta | **Ei vielä päivittäinen NAV-lähde** |
| EODHD Fund Fundamentals | Dokumentaatio kertoo ISIN- ja NAV-kentistä sekä `Update_Date`; EUFUND-eurooppalaisrahastojen tarjontaa on kuvattu | JSON-lähde mahdollinen **asiakas-/lisenssikohtaisesti**, mutta juuri testirahastojen tuoreutta, saatavuutta ja hintaa ei todennettu | **Ehdokas, ei integroitu** |
| OpenFIGI | Voisi auttaa instrumentin ID-kartoituksessa | Ei NAV-hinta-API | **Identiteettipalvelu, ei varahinnan lähde** |

## Varalähteen määritelmä

- Sama toimittaja kahden reitin (Worker / GitHub) läpi on *kuljetuksen varmistus*, ei hinnan riippumaton varmennus.
- Varalähde kelpaa vain, jos sama **ISIN/rahasto-osuussarja, valuutta, taloudellinen NAV-rooli ja päivä** on vahvistettu. Ei pakotettua 1:1 FX-pariteettia eikä väärän osuussarjan vaihtoa.
- Jos ensisijainen ja toinen vahvistettu toimittaja ovat ristiriidassa samana arvostuspäivänä, automaattinen hyväksyntä pysähtyy eikä valita satunnaista voittajaa.
- Hintatiedon tila näkyy sekä rivillä että koonnissa: ajantasainen, vanha, varasyöte, ristiriita, ei saatavilla. Käyttäjälle ei lähetetä toistuvia pop-uppeja.

## Kokeiltu tähän asti

- Päivän ja virheen erottava Alpha PR #58 on julkaistu eristettyyn Alpha-sivustoon SHA:lla `667215921a694d8a60f2424a33d6115b7e4c0512` Cloudflaren testien ja deployn kautta.
- PR #59 sisältää **vain puhtaan validointimoduulin** `fund-nav-evidence.mjs`, jolla ei ole verkkoyhteyttä eikä salkkutallennusta. Sen testit osoittavat esim. että toinen ISIN, toinen valuutta, eri osuussarja, väärä päivä tai epäluotettavan luokan lähde EI automaattisesti kelpaa hinnaksi. Tämä ei ole todiste uuden rahaston live-NAV-tuennasta.
- Nordnetin API:n dokumentaation olemassaolo ei ole osoitus avoimesta pääsystä; endpoint-kokeilu HTTP-yhteydellä jäi tämän tutkimusympäristön ulkopuolella vahvistamatta.

## Seuraava käytännön koe

1. Etsi yhdeltä **oikeasti käytettävissä olevalta ja sallitulta** markkinadata-/issuer-lähteeltä kaksi nykyisen kuusikon ulkopuolista rahastoa kahdelta eri liikkeeseenlaskijalta.
2. Dokumentoi kunkin tunnistusreitti (ISIN + share class + valuutta), todellinen päivätty NAV-vastaus ja mahdolliset käyttörajoitukset sekä kolmen peräkkäisen arvostuspäivän havaintojen saatavuus.
3. Jos tätä ei pystytä todentamaan, älä lisää uutta automaattista lähdettä. Esitä sovelluksessa `NAV ei saatavilla`, anna käyttäjän syöttää päivätty hinta käsin ja säilytä varmuuskopiossa lähteen metadata.
4. Vasta tämän jälkeen liitä uusi provider-adapteri ja käyttäjän hyväksymä rahastovalinta Alpaan. Älä lisää uusia hardkoodattuja `FUND_PAGES`-avaimia.

## Julkiset lähteet
- Nordnet API Getting Started: https://www.nordnet.se/externalapi/docs/getting_started
- Vanguard Global Stock Index EUR Acc: https://www.vanguard.co.uk/professional/product/fund/equity/9837/global-stock-index-fund-eur-acc
- Storebrandin dokumentti: https://api.storebrand.no/open/savings/funds/document?currencyCode=EUR&documentOrigin=WOLF&documentType=MONTHLY_FUND_REPORT&isin=SE0013801453&languageCode=en-GB
- EODHD Fund Fundamentals: https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds
- EODHD Europe funds announcement: https://eodhd.com/financial-apis-blog/new-european-funds-data
