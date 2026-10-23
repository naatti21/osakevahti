import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
// Preserve legacy tests. This broad profile still includes one LIVE FX test;
// report its network failure separately from deterministic application cases.
// Public-feed and @ocr-stress suites are separately NOT RUN when prerequisites
// are unavailable; they are not converted into passing or skipped results.
export default defineConfig({...base,testDir:'../e2e',testMatch:undefined,testIgnore:['**/alpha-public-live-feeds.spec.mjs'],grepInvert:/@ocr-stress/,use:{...base.use,baseURL:'http://127.0.0.1:4186'},webServer:{...base.webServer,command:'python3 -m http.server 4186 --bind 127.0.0.1',url:'http://127.0.0.1:4186/index.html'}});
