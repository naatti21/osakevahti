# Tilinpäätöslukujen lähdetodisteportti (7.11.2026)

**Vain tutkimuskoe. Ei hyväksyntää sijoituspäätösten tueksi.**

## Oikeiden lähdeajojen tulos

| Yhtiö | Lähteeseen rakenteellisesti täsmää | HTML, vaatii lisätarkistuksen | Puuttuu | Hylätty |
|---|---:|---:|---:|---:|
| Nokia / ESEF IFRS | 20 | 0 | 0 | 0 |
| Elisa / ESEF IFRS | 18 | 0 | 2 | 0 |
| Microsoft / virallinen IR-HTML | 0 | 17 | 3 | 0 |
| Apple / 10-K HTML | 0 | 20 | 0 | 0 |
| **Yhteensä** | **38** | **37** | **5** | **0** |

**Riippumattomasti varmennettu: 0 / 80.** PR #103:n aiempi poiminnan kattavuus 75/80 ei ole sama asia kuin riippumattomasti tarkistettu tietolaatu.

## Koodattu lähdetodiste

- Jokaisesta ladatusta lähderaportista lasketaan SHA-256-tiiviste alkuperäisestä tekstistä. Kuitti sisältää noutoajan, lähteen URL:n, tunnuksen ja muodon. Tiiviste ei ole julkaisijan digitaalinen allekirjoitus.
- ESEF:n jokaisen yksikköön sidotun faktan entity-ulottuvuuden juridinen LEI tarkistetaan. Entity-tekstin etuliite voi olla esimerkiksi scheme eikä lei; siksi etuliite tulkitaan aina dokumentin documentInfo.namespaces-sanastosta ja sen on vastattava ISO 17442 -tunnistejärjestelmää.
- Tietokenttä hyväksytään lähteeseen rakenteellisesti täsmääväksi vain, jos yksi ainoa lähdekuitti, identiteetti, valuutta, taksonomiakäsite, tilikausi ja taseen hetkellinen loppupäivä täsmäävät.
- Puuttuva, ristiriitainen, väärän yhtiön, väärän vuoden tai valuutan tieto estetään. Väärä namespace, väärä URL, puuttuva tiiviste ja päällekkäinen lähdekuitti estetään testeissä.
- HTML-raporteissa mittayksikön miljoonakertaa ei vielä ole sidottu yksittäisen tilinpäätöstaulukon lähdeotsikkoon. Siksi 37 HTML-poimintaa saavat needs-review-tilan.
- Sijoituskäyttö on aina NO_GO, vaikka lähdepoiminta olisi täydellinen.

## Havaittu ja korjattu ongelma

Ensimmäisellä lähdeajolla uusi tarkistin hylkäsi kaikki Nokian ja Elisan 38 rakenteista havaintoa, koska se etsi kirjaimellista lei-etuliitettä. Näissä virallisissa XBRL-JSON-raporteissa entity-kentän etuliite on scheme, joka osoittaa LEI-nimiavaruuteen. Tarkistin korjattiin seuraamaan nimiavaruuden URI:a, ei etuliitteen nimeä. Oikeat 38 havaintoa läpäisivät korjauksen jälkeen; väärennetty nimiavaruus hylätään regressiotestissä.

## Toistettavat GitHub Actions -lähdeajot

- Nokia ja Microsoft: https://github.com/naatti21/osakevahti/actions/runs/42396997964
- Elisa ja Apple: https://github.com/naatti21/osakevahti/actions/runs/42396997760
- XBRL International: https://www.xbrl.org/guidance/xbrl-json-tutorial/
- XBRL-päivämäärät: https://www.xbrl.org/dates-in-xbrl/
- ESEF-arkiston API: https://filings.xbrl.org/docs/api

## Seuraava hyväksymisportti

1. Varmista HTML-mittayksikkö kunkin taulukon lähikontekstista, älä oleta miljoonia.
2. Ristiintarkista vähintään jokaisen yhtiön vuoden 2025 avainluvut **toisesta riippumattomasta alkuperäisjulkaisusta**.
3. Testaa historialliset oikaisut, liikevaihdon/taseen käsitteiden vertailukelpoisuus ja eri raportointistandardit.
4. Varmista puuttuvat lainavelkakomponentit alkuperäisistä dokumenteista, ei arvauksista.
5. Tarkista lähteiden käyttöehdot ja latausrajat ennen automatisoitua tuotantokäyttöä.

**Ei muutoksia tuotanto-PWA:han, Cloudflare Workeriin tai sijoittajan omistuksiin.**