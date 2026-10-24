import {defineConfig} from '@playwright/test';
import base from './full.config.mjs';
export default defineConfig({...base,testMatch:['e2e/alpha-public-live-feeds.spec.mjs','e2e/alpha-fx-refresh-feedback.spec.mjs'],testIgnore:[],grep:/browser fetch from official direct FX v1|live/i,grepInvert:undefined});
