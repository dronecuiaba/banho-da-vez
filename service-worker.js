const CACHE_NAME = "banho-da-vez-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isOwnAsset = isSameOrigin && ASSETS.some(a => url.pathname.endsWith(a.replace("./", "")));

  // Só intercepta os próprios arquivos estáticos. Tudo que for de outra
  // origem (Firebase/Firestore, CDNs) passa direto pela rede, sem cache,
  // para não quebrar a sincronização em tempo real.
  if (event.request.method !== "GET" || !isOwnAsset) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
