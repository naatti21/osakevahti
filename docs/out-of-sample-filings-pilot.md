# Kahden uuden yhtiön sokkotesti – 7.11.2026

Sama koodi kuin Nokia/Microsoft-kokeessa, ei yhtään yhtiökohtaista tunnuslukutagia tai tekstirivisääntöä.

## Kohteet
- Elisa Oyj: LEI 743700TU2S3DXWGU7H32, ESEF-raportit 2021–2025 filings.xbrl.org-arkistosta. Raportin sisäinen juridinen tunniste tarkistetaan.
- Apple Inc.: CIK 0000320193, vuosien 2025, 2023 ja 2021 viralliset Form 10-K HTML-raportit Applen sijoittajasivuston käyttämästä CloudFront-jakelusta. Vertailusarakkeet kattavat teoriassa vuodet 2021–2025.

## Tutkimusmenetelmä
Jokaiselta vuodelta neljä lukua: liikevaihto, nettotulos, liiketoiminnan rahavirta ja lyhyt + pitkä lainavelka.

Uuden yhtiön poimintaan käytetään muuttamatta edellisen pilotin normalizeEsefXbrlJson- ja normalizeIssuerIrTables-funktioita. Poiminta epäonnistuu näkyvästi, jos raportin muoto on erilainen. Puuttuvaa ei oleteta nollaksi. 40 havainnon raakamatriisi tallentuu GitHub Actionsiin nimellä out-of-sample-pilot-report.

Elisan 2025 ESEF: https://filings.xbrl.org/filing/743700TU2S3DXWGU7H32-2025-12-31-ESEF-FI-1
Apple 2025: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/c636d8a7-8025-47d2-9b13-bcf5465343b3.html
Apple 2023: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/1999a9bb-1e5c-4aa2-a94e-91da5d7b4006.html
Apple 2021: https://d18rn0p25nwr6d.cloudfront.net/CIK-0000320193/23f4d432-c1c3-43be-9050-596f45eaeee9.html

Tämä on tutkimus-PR. Dataa ei julkaista käyttäjän PWA:han tai Cloudflare Workeriin. Tutkimusajo voi olla teknisesti vihreä, vaikka datan laatu ei riitä. Oikeiden tilikausien, konsernikäsitteiden, oikaisujen ja tiedon käyttöehtojen tarkistus on erillinen hyväksymisportti.
