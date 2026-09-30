/* sw.js — Cơ Điện · 机电: mở app từ bản lưu trên máy (cache-first), tải bản mới ở nền.
 * Bản mới chỉ dùng khi người dùng bấm "Cập nhật · 更新" (trang gửi SKIP_WAITING).
 * BAN đổi mỗi lần index.html đổi (build gắn phiên bản + mã băm), nên iPhone luôn nhận ra bản mới.
 */
var BAN = '0.2.0-d9f45649d3';
var CACHE = 'codien-app-' + BAN;
var THU_VIEN = 'codien-thuvien-1';   // thư viện CDN (đã ghim phiên bản), giữ qua các bản app
var TEP = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
var THU_VIEN_SAN = [];               // thư viện lưu sẵn cho lúc mất mạng (thêm ở phiên 3: đọc QR, vẽ QR, Excel)

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(TEP.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error(u + ' ' + r.status);
        return c.put(u, r);
      });
    }));
  }).then(function () {
    if (!THU_VIEN_SAN.length) return;
    return caches.open(THU_VIEN).then(function (c) {
      return Promise.all(THU_VIEN_SAN.map(function (u) {
        return c.match(u).then(function (co) { return co || fetch(u, { mode: 'cors' }).then(function (r) { if (r.ok) return c.put(u, r); }); }).catch(function () {});
      }));
    });
  }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('codien-app-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;          // gọi máy chủ (POST) đi thẳng
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(caches.open(CACHE).then(function (c) {
        return c.match('index.html').then(function (r) { return r || fetch(req); });
      }).catch(function () { return fetch(req); }));
      return;
    }
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (r) { return r || fetch(req); });
    }));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(THU_VIEN).then(function (c) {
      return c.match(req).then(function (r) {
        return r || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
    }));
  }
});
