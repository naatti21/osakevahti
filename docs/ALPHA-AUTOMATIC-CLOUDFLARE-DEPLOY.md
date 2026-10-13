# OV Alpha — automaattinen Cloudflare Pages Direct Upload GitHub Actionsilla

Tämä korvaa jokaisen Osakevahti Alpha -päivityksen manuaalisen ZIP-latauksen. Kyseessä on **vain** erillinen testiprojekti `osakevahti-alpha-naatti21` Cloudflare Pagesissa, ei oikean Osakevahdin `naatti21.github.io/osakevahti/`-tuotanto.

## Miksi tämä kiertää GitHub–Cloudflare-kirjautumissilmukan

Cloudflare Pagesin olemassa oleva **Direct Upload** -projekti tukee Wrangler CLI:n kautta GitHub Actionsin tekemää julkaisua **ilman Cloudflaren Git-integraatiota**. GitHub Actions rakentaa sallitun `dist-alpha`-kansion ja julkaisee sen Wranglerilla.

Julkaisu suoritetaan ainoastaan GitHubin **`deploy/osakevahti-alpha-20261013`**-haarasta, **ei `main`ista**. Cloudflare CLI:n `--branch=main` viittaa **tämän olemassa olevan Cloudflare-projektin Production-haaraan**, ei GitHubin varsinaiseen `main`-haaraan.

## Käyttäjän tehtävä — kertaluonteinen valtuutus

1. Avaa Cloudflare Dashboard → **Account API Tokens** (https://dash.cloudflare.com/profile/api-tokens) → Create Token → Custom Token. Anna nimeksi esim. `osakevahti-alpha-deploy`.
2. Aseta Cloudflare-tokenille **Account → Cloudflare Pages → Edit** ja rajaa resurssi oikeaan Cloudflare-tiliin. **Älä käytä Global API Key -avainta.**
3. Ota token talteen **vain itsellesi**. Älä liitä sitä keskusteluun, GitHubin kooditiedostoon, PR:n kommenttiin tai sovelluksen HTML:ään.
4. Etsi Cloudflare-tilisi **Account ID** tilin Overview-sivulta. Tämä on tilin tunniste, ei salainen API-token.
5. Avaa GitHubissa `naatti21/osakevahti` → **Settings → Secrets and variables → Actions → New repository secret**. Lisää:
   - `CLOUDFLARE_API_TOKEN` = luomasi Cloudflare Pages Edit -token.
   - `CLOUDFLARE_ACCOUNT_ID` = kyseisen Cloudflare-tilin Account ID.
6. Varmista, että molemmat salaisuuksien **nimet** näkyvät GitHubin Actions secrets -luettelossa. Niiden arvoja ei voi eikä tarvitse näyttää ChatGPT:lle.

Palkan-laskennan repon `CLOUDFLARE_*`-secrets eivät siirry automaattisesti `osakevahti`-repoon; siksi ne täytyy lisätä erikseen. Voit jatkossa ilmoittaa vain **“GitHubin kaksi salaisuutta lisätty”**.

## Ylläpito — automaation käyttöönotto QA-portin jälkeen

- `.github/workflows/alpha-cloudflare-auto-deploy.yml` julkaisee vasta, kun kaikki saman SHA:n Playwright-/OCR-/QA8-/pakettitestit ovat läpäisseet. Yksikään epäonnistunut tai keskeneräinen testi ei saa laukaista julkaisua.
- Ensimmäinen käyttöön otettava Alpha 3 -julkaisupaketti on valmisteltu [Draft PR #23](https://github.com/naatti21/osakevahti/pull/23) -muutoksissa. Julkaisuhaara päivitetään hyväksyttyyn, oikean SHA:n sisältävään commit-kandidaattiin vasta erillisen valtuutuksen jälkeen; tämä ei vaadi GitHubin `main`in muuttamista.
- Kun tämä on kerran asennettu ja toimivaksi todettu, myöhemmät Alphan testiversiot voidaan julkaista julkaisuhaaraan tehtävällä hyväksytyllä pushilla ja testien valmistuttua automaattisesti. Jokaisesta muutoksesta jää GitHub Actionsin loki ja Cloudflare-deploy-merkintä.
- **Rajoitus:** työnkulku koskee vain `osakevahti-alpha-naatti21.pages.dev` -testialuetta. Varsinainen Osakevahti tuotannossa vaatii aina erillisen riippumattoman QA:n ja käyttäjän nimenomaisen julkaisuluvan. Alphan fyysiset Android-havainnot kerätään edelleen käyttäjältä.

## Virhetilanteet

- Jos toinen salaisuuksista puuttuu, julkaisu-jobi keskeytyy ennen Wrangleria.
- Jos Playwright, oikea julkinen markkinadata, QA8, OCR tai pakettitesti epäonnistuu, julkaisu estyy.
- Jos Cloudflare palauttaa virheen, aiempi Alpha-versio jää Pagesissa saataville ja GitHub-työnkulku kirjautuu epäonnistuneeksi.
- Sovelluksen manifest-ID `./?channel=alpha`, alkuperäinen origin ja paikallinen tallennusavain pysyvät ennallaan.

Dokumentaatio: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
