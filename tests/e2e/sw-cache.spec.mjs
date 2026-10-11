import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("Osakevahti siivoaa vain omat vanhat cachet ja säilyttää Palkka PWA:n cachen", async ({ context }) => {
  const foreignCacheName = "palkka-pwa-v14";
  const oldCacheName = "osakevahti-shell-v2.16-ocr-fix";
  const newCacheName = "osakevahti-shell-v2.17-cache-isolation";

  const seed = await context.newPage();
  await seed.goto("/index.html", { waitUntil: "domcontentloaded" });

  await seed.evaluate(async ({ oldName, foreignName }) => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));

    const names = await caches.keys();
    await Promise.all(
      names.filter(name => name.startsWith("osakevahti-shell-")).map(name => caches.delete(name))
    );

    const stale = await caches.open(oldName);
    await stale.put(
      new Request(new URL("./old-osakevahti-marker.txt", location.href)),
      new Response("old-cache")
    );

    const foreign = await caches.open(foreignName);
    await foreign.put(
      new Request(new URL("./palkka-marker.txt", location.href)),
      new Response("preserve-palkka-offline")
    );
  }, { oldName: oldCacheName, foreignName: foreignCacheName });
  await seed.close();

  const page = await context.newPage();
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await page.waitForFunction(async ({ newName, oldName }) => {
    const names = await caches.keys();
    return names.includes(newName) && !names.includes(oldName);
  }, { newName: newCacheName, oldName: oldCacheName });

  const state = await page.evaluate(async ({ newName, foreignName }) => {
    const names = await caches.keys();
    const foreignCachePresent = names.includes(foreignName);
    const otherCache = await caches.open(foreignName);
    const marker = await otherCache.match(new URL("./palkka-marker.txt", location.href));
    return {
      ownCaches: names.filter(name => name.startsWith("osakevahti-shell-")).sort(),
      foreignCachePresent,
      foreignMarkerText: marker ? await marker.text() : null
    };
  }, { newName: newCacheName, foreignName: foreignCacheName });

  expect(state.ownCaches).toEqual([newCacheName]);
  expect(state.foreignCachePresent).toBe(true);
  expect(state.foreignMarkerText).toBe("preserve-palkka-offline");
});
