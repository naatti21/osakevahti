# OST/AOT-paikkakartta: ensimmäinen toteutettu osa (7.11.2026)

Tämä muutos on vain kehityshaarassa, eikä sitä ole julkaistu.

- Oma vahvistettu OST/AOT-omistusryhmä ja valitun listauksen uusi tilikohtainen paino.
- Puuttuva tai vahvistamaton hintadata ei muutu nollaksi. Hinta-arviot ilmoitetaan.
- Ei localStorage-skeeman muutosta, automaattista ostopäätöstä tai verkkopyyntöjä omistuksista.
- Veroskenaario on erillisen kuvitteellisen tilin laskenta. OST-tilin käteinen, talletettu pääoma,
  muut salkun ulkopuoliset omistukset, kotipaikka ja veroilmoitus ovat edelleen tuntemattomia.
- Suositus pysyy "Tieto ei riitä", kunnes datan, strategian ja OST-taloustietojen kattavuus on vahvistettu.
- Viite: https://www.vero.fi/henkiloasiakkaat/omaisuus/sijoitukset/osakes%C3%A4%C3%A4st%C3%B6tili/
- Viite: https://www.vero.fi/henkiloasiakkaat/omaisuus/sijoitukset/osingot/listatusta-yhti%C3%B6st%C3%A4-saadut-osingot/

Seuraavaksi: todistetut suomalaisten yhtiöiden osingot, maksuvuodet ja osuussarjat;
OST-talletusvaran ja tilien käteisen vapaaehtoinen syöttö; riippumaton verotuksen testaus.
Ei mergeä eikä deployta ennen riippumatonta review'ta, Android-testejä ja käyttäjän GO-päätöstä.
