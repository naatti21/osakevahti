# Osinkovahti: suomalaisyhtiöiden lähteistetty aineisto — vaihe 2 (7.11.2026)

Kehityshaara: \`feature/fi-dividend-issuer-evidence-20261107\` PR #98:n päälle. Ei tuotanto-/Alpha-julkaisua.

## Toteutus
- Kolme yhtiökokouspäätöstä: Fortum 0,74 €/osake, Kesko B 0,90 €/osake, Metso 0,40 €/osake. Kaikki tilikaudelta 2025, päätetty vuonna 2026.
- Jokaisen yhtiön tilikaudet 2021–2025 ja alkuperäiset IR-lähdelinkit. Nämä ovat *päätöksiä tilikausilta*, eivät kalenterivuosittaisia maksuja.
- 2026 maksuerät näytetään erikseen. Kesko: 4 erää, viimeinen 21.1.2027. Metso: 4.5.2026 maksu vahvistettu erillisessä 21.10.2026 yhtiötiedotteessa; 30.10.2026 erän aikataulu vahvistettu, mutta maksun toteumaa ei tässä tietopaketissa ole erikseen todennettu.
- Muiden jo ohittuneiden maksupäivien kohdalla lukee yhä "päätetty maksupäivä, maksu vahvistamatta" – ei keksitä todisteita.
- Päätösluvut vahvistetaan ohjelmallisesti: listaustunnus, EUR, lähteen täsmällinen toimialue, vuosi, päivä, erien summa, maksupäivien duplikaatit ja todistetun maksun ajankohta.
- Vanhaa "Osinkokoneet"-seulontaa ei nimetä uudelleen. Verolaskuriin viedään vain täsmällinen listaus; tulevaa osinkotuottoa ei täytetä arvauksella.
- Ei uusia verkkopyyntöjä, henkilökohtaisten tilitietojen siirtoja tai salkkutietokannan muutoksia. Historiallinen valikoima pakataan PWA:n asennusvälimuistiin.
- Tämä on manuaalisesti tarkistettu dokumenttiaineisto, ei automaattisesti päivittyvä datalähde. 120 päivän jälkeen näytetään uudelleentarkistustarve.

## Lähteet (alkuperäiset)
- Fortum: https://www.fortum.com/investors/share-information
- Fortumin AGM: https://www.fortum.com/en/media/2026/03/decisions-fortum-corporations-annual-general-meeting-2026
- Kesko: https://www.kesko.fi/sijoittaja/osaketieto/osinkopolitiikka-ja-osinko/
- Keskon historia: https://www.kesko.fi/sijoittaja/osaketieto/osinkopolitiikka-ja-osinko/osinkohistoria/
- Kesko B:n osakesarja: https://www.kesko.fi/en/investor/share-information/
- Metso 2026: https://www.metso.com/corporate/investors/governance/agm/2026/
- Metson 21.10.2026 tiedote: https://www.metso.com/corporate/media/news/2026/10/record-date-and-payment-date-of-metsos-second-dividend-instalment-of-eur-0.20

## Nimenomaiset rajaukset
- Yhtiön osingon kestävyys, kassavirta, nettovelka, oikea tuotto-% ja käyttäjän tilikohtainen lopullinen ostosuositus EI OLE VALMIS.
- UPM pois tästä vaiheesta: sen 31.10.2026 osittaisjakautuminen ja 2.11.2026 uusi ISIN vaativat vertailukelpoisen historiallisen aineiston erillisen varmistuksen.
- Automatisoidun osinkoaineiston lisenssiä, todellista Android-PWA-testausta tai tulosten pitkäaikaista ajantasaisuutta ei ole vahvistettu.
- NO-GO: review, CI, Android ja datalähdeoikeudet ennen tuotantokäyttöä.
