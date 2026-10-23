import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
// Network availability is a separate job, never a reason to skip a safety assertion.
export default defineConfig({...base,testMatch:['e2e/**/*.spec.mjs','phase1/*.spec.mjs'],testIgnore:['**/alpha-public-live-feeds.spec.mjs','**/real-ocr.spec.mjs'],grepInvert:/@ocr-stress|browser fetch from official direct FX v1/,use:{...base.use,baseURL:'http://127.0.0.1:4173'},webServer:{...base.webServer,command:'python3 -m http.server 4173 --bind 127.0.0.1',url:'http://127.0.0.1:4173/index.html'}});
