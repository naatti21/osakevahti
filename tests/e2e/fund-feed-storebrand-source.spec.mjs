import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
test('Storebrand Japan NAV source is whitelisted as one EUR fund and cannot override other quote keys',async()=>{
 const key='STOREBRAND_JAPAN_A_EUR';
 const url='https://www.nordnet.fi/rahastot/lista/storebrand-japan-a-eur-dbe9644c';
 expect((workflow.match(/"STOREBRAND_JAPAN_A_EUR":/g)||[])).toHaveLength(1);
 expect(workflow).toContain('"url": "'+url+'"');
 expect(workflow).toContain('for fund_key, spec in FUND_PAGES.items():');
 expect(workflow).toContain('fund_quotes[fund_key] = fund_page_quote(spec)');
 expect(workflow).toContain('raise RuntimeError("NAV-arvoa ei löytynyt rahastosivulta")');
 // A partial date from Nordnet must remain partial; no invention of NAV year.
 expect(workflow).toContain('nav_date = m.group(1)');
 expect(workflow).not.toMatch(/nav_date\s*=\s*datetime\.now/);
});
