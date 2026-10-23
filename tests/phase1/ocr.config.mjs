import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,testIgnore:[],expect:{...base.expect,timeout:60000},testMatch:['phase1/real-ocr.spec.mjs'],use:{...base.use,baseURL:'http://127.0.0.1:4184'},webServer:{...base.webServer,command:'python3 -m http.server 4184 --bind 127.0.0.1',url:'http://127.0.0.1:4184/index.html'}});
