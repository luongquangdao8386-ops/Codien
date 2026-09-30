/* sw.js — Cơ Điện · 机电: mở app từ bản lưu trên máy (cache-first), tải bản mới ở nền.
 * Bản mới chỉ dùng khi người dùng bấm "Cập nhật · 更新" (trang gửi SKIP_WAITING).
 * BAN đổi mỗi lần index.html đổi (build gắn phiên bản + mã băm), nên iPhone luôn nhận ra bản mới.
 */
var BAN = '0.4.1-a1e61b16c4';
var CACHE = 'codien-app-' + BAN;
var THU_VIEN = 'codien-thuvien-1';   // thư viện (tên tệp có phiên bản), giữ qua các bản app
var ANH = 'codien-anh-1';            // ảnh Drive đã xem (thumbnail), tối đa ANH_TOI_DA tấm
var ANH_TOI_DA = 150;
var TEP = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
// Thư viện đọc / vẽ QR nằm cùng thư mục app: lưu sẵn để quét tem được khi mất mạng. Thiếu tệp thì bỏ qua, không làm hỏng bản cài.
var THU_VIEN_SAN = ['jsqr-1.4.0.js', 'qrcode-2.0.4.js'];
var LA_THU_VIEN = /\/(jsqr|qrcode)-[\d.]+\.js$/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(TEP.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error(u + ' ' + r.status);
        return c.put(u, r);
      });
    }));
  }).then(function () {
    return caches.open(THU_VIEN).then(function (c) {
      return Promise.all(THU_VIEN_SAN.map(function (u) {
        var url = new URL(u, self.registration.scope).href;
        return c.match(url).then(function (co) {
          return co || fetch(url).then(function (r) { if (r.ok) return c.put(url, r); });
        }).catch(function () {});
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
    if (req.mode === 'navigate') {           // cả link từ tem QR (…/?tb=MNK-001) đều mở index.html đã lưu
      e.respondWith(caches.open(CACHE).then(function (c) {
        return c.match('index.html').then(function (r) { return r || fetch(req); });
      }).catch(function () { return fetch(req); }));
      return;
    }
    if (LA_THU_VIEN.test(url.pathname)) {
      e.respondWith(caches.open(THU_VIEN).then(function (c) {
        return c.match(req, { ignoreSearch: true }).then(function (r) {
          return r || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
        });
      }));
      return;
    }
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (r) { return r || fetch(req); });
    }));
    return;
  }
  if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail' && /^w([1-9]\d?|[1-7]\d\d|800)$/.test(url.searchParams.get('sz') || '')) {
    e.respondWith(anhDaXem(req));
  }
});

/** Ảnh thumbnail Drive: có trên máy thì dùng, chưa có thì tải và lưu (tối đa ANH_TOI_DA tấm, không lưu khi bộ nhớ đã dùng quá nửa). */
function anhDaXem(req) {
  return caches.open(ANH).then(function (c) {
    return c.match(req).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (res) {
        if (res.ok || res.type === 'opaque') {
          var ban = res.clone();
          conCho().then(function (duoc) {
            if (!duoc) return;
            return c.put(req, ban).then(function () { return c.keys(); }).then(function (ks) {
              if (ks.length > ANH_TOI_DA) return Promise.all(ks.slice(0, ks.length - ANH_TOI_DA).map(function (k) { return c.delete(k); }));
            });
          }).catch(function () {});
        }
        return res;
      });
    });
  }).catch(function () { return fetch(req); });
}
function conCho() {
  try {
    if (self.navigator && navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (x) { return !x.quota || x.usage < x.quota * 0.5; }, function () { return true; });
    }
  } catch (e) {}
  return Promise.resolve(true);
}
