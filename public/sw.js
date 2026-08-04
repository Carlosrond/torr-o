// Service worker do Torrão — o mínimo que faz o app instalar e abrir rápido,
// sem NUNCA servir dado velho de venda.
//
// Regras, na ordem em que importam:
// 1. Supabase (dado de negócio) não passa pelo cache de jeito nenhum: preço,
//    pedido e comissão têm que ser o que está no banco agora.
// 2. Navegação (index.html) é network-first: deploy novo chega na próxima
//    abertura; o cache só responde quando está sem rede.
// 3. /assets/ do Vite tem hash no nome (imutável): cache-first sem medo.
const CACHE = 'torrao-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const { request } = evento
  const url = new URL(request.url)

  // só GET do próprio site — Supabase e qualquer POST seguem direto pra rede
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // navegação: rede primeiro; cache é só o modo offline
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copia))
          return resposta
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // assets com hash + ícones/manifest: cache primeiro
  evento.respondWith(
    caches.match(request).then(
      (guardado) =>
        guardado ??
        fetch(request).then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copia))
          }
          return resposta
        }),
    ),
  )
})
