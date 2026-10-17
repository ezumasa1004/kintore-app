// ===== キャッシュの名前（＝アプリのバージョン） =====
// ⚠️ アプリを更新するときは、必ずこの数字を増やす（v1 → v2 → v3 …）
const CACHE_NAME = "kintore-v28";

// ===== 更新内容（アップデートのお知らせに表示される） =====
// ⚠️ アプリを更新するときは、CACHE_NAME と一緒に、ここも必ず書き換える
// 友達が読んで分かる言葉で、1つの変更を1行ずつ書く
const RELEASE_NOTES = [
  "アップデートのとき、更新内容が表示されるようになりました",
];

// オフラインでも使えるように保存しておくファイル
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./lib/chart.umd.js",
  "./lib/jszip.min.js",   // ← 追加
  "./icons/icon-180.png",
];

// --- インストール：ファイルをすべてキャッシュに保存する ---
async function cacheFiles() {
  const cache = await caches.open(CACHE_NAME);
  // cache: "reload" … ブラウザに残っている古いファイルではなく、必ずサーバーから取り直す
  const requests = FILES.map((file) => new Request(file, { cache: "reload" }));
  await cache.addAll(requests);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheFiles());
});

// --- 有効化：古いバージョンのキャッシュを削除する ---
async function deleteOldCaches() {
  const keys = await caches.keys();
  for (const key of keys) {
    if (key !== CACHE_NAME) await caches.delete(key);
  }
  await self.clients.claim();
}

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches());
});

// --- ファイルの要求：キャッシュにあればそれを返し、なければネットから取る ---
async function respond(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(respond(event.request));
});

// --- アプリからの連絡を受け取る ---
self.addEventListener("message", (event) => {
  // 「更新して」と言われたら、すぐに新しいバージョンに切り替える
  if (event.data === "skipWaiting") {
    self.skipWaiting();
    return;
  }

  // 「更新内容を教えて」と言われたら、バージョンと更新内容を返す
  if (event.data === "getReleaseNotes") {
    event.ports[0].postMessage({
      version: CACHE_NAME.replace("kintore-", ""), // "kintore-v28" → "v28"
      notes: RELEASE_NOTES,
    });
  }
});