// qbittorrent/client.js
export class QBittorrentClient {
  constructor({ baseUrl, username, password, timeoutMs = 15000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;

    this.sid = null; // строка вида "SID=...."
    this.loggingIn = null; // защита от параллельных логинов
    this.timeoutMs = timeoutMs;
  }

  /* ---------- helpers ---------- */
  _getSetCookieArray(res) {
    // 1) Spec/modern: Headers.getSetCookie() -> string[]
    if (typeof res.headers?.getSetCookie === 'function') {
      const arr = res.headers.getSetCookie();
      if (Array.isArray(arr) && arr.length) return arr;
    }

    // 2) Common fallback: single combined set-cookie
    const one = res.headers?.get?.('set-cookie');
    if (one) return [one];

    // 3) node-fetch: headers.raw()['set-cookie']
    const raw = res.headers?.raw?.();
    if (raw?.['set-cookie']?.length) return raw['set-cookie'];

    return [];
  }

  _extractSid(res) {
    const setCookies = this._getSetCookieArray(res);
    for (const sc of setCookies) {
      const m = String(sc).match(/(?:^|;\s*)SID=([^;]+)/);
      if (m?.[1]) return `SID=${m[1]}`;
      // иногда SID стоит в начале строки "SID=...; Path=/; ..."
      const m2 = String(sc).match(/^SID=([^;]+)/);
      if (m2?.[1]) return `SID=${m2[1]}`;
    }
    return null;
  }

  async _fetch(url, init = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------- login ---------- */
  async login() {
    if (this.sid) return this.sid;
    if (this.loggingIn) return this.loggingIn;

    this.loggingIn = (async () => {
      const body = new URLSearchParams({
        username: this.username,
        password: this.password
      });

      const res = await this._fetch(`${this.baseUrl}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          Referer: this.baseUrl,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      // По доке: 403 на логине = IP banned
      if (res.status === 403) {
        const text = await res.text().catch(() => '');
        throw new Error(`qBittorrent login failed (403). Possible IP ban. ${text}`);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`qBittorrent login failed: ${res.status}. ${text}`);
      }

      const sid = this._extractSid(res);
      if (!sid) {
        throw new Error(
          'qBittorrent SID cookie not found. ' +
            'In some fetch implementations Set-Cookie is not exposed; consider using a cookie jar / different HTTP client.'
        );
      }

      this.sid = sid;
      return sid;
    })();

    try {
      return await this.loggingIn;
    } finally {
      this.loggingIn = null;
    }
  }

  /* ---------- fetch с автологином ---------- */
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    await this.login();

    const doReq = () =>
      this._fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Referer: this.baseUrl,
          Cookie: this.sid,
          ...headers
        },
        body
      });

    let res = await doReq();

    // если сессия умерла — логинимся ещё раз и повторяем запрос ОДИН раз
    if (res.status === 403) {
      this.sid = null;
      await this.login();
      res = await doReq();

      if (res.status === 403) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `qBittorrent API still returns 403 after re-login. ` +
            `Possible IP ban or WebUI auth restriction. ${text}`
        );
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`qBittorrent API error ${res.status}: ${text}`);
    }

    return res;
  }

  /* ---------- API методы ---------- */

  async getTorrents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await this.request(`/api/v2/torrents/info${qs ? `?${qs}` : ''}`);
    return res.json();
  }

  async addMagnet(magnet, options = {}) {
    const form = new FormData();
    form.set('urls', magnet);

    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null) form.set(key, String(value));
    }

    const res = await this.request('/api/v2/torrents/add', { method: 'POST', body: form });

    // В qB иногда полезно прочитать тело (там бывает "Fails.")
    const text = await res.text().catch(() => '');
    if (text && text.trim() !== 'Ok.' && text.trim() !== 'OK' && text.trim() !== '') {
      // не всегда критично, но удобно для диагностики
      // можно заменить на throw, если хочешь строгость
    }

    return true;
  }

  async pause(hash) {
    if (!hash) throw new Error('Torrent hash is required');

    await this.request('/api/v2/torrents/pause', {
      method: 'POST',
      body: new URLSearchParams({ hashes: hash }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return true;
  }

  async resume(hash) {
    if (!hash) throw new Error('Torrent hash is required');

    await this.request('/api/v2/torrents/resume', {
      method: 'POST',
      body: new URLSearchParams({ hashes: hash }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return true;
  }

  async getTorrentFiles(hash) {
    if (!hash) throw new Error('Torrent hash is required');
    const res = await this.request(`/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`);
    return res.json();
  }

  /**
   * Установить приоритет для одного или нескольких файлов торрента.
   *
   * @param {string} hash - хеш торрента
   * @param {number|number[]|string|string[]} ids - file index(es) (лучше брать поле `index` из torrents/files)
   * @param {0|1|6|7|number} priority - 0=skip, 1=normal, 6=high, 7=max
   */
  async setFilePriority(hash, ids, priority) {
    if (!hash) throw new Error('Torrent hash is required');
    if (ids === undefined || ids === null) throw new Error('File id(s) is required');
    if (priority === undefined || priority === null) throw new Error('Priority is required');

    const idStr = Array.isArray(ids) ? ids.map(String).join('|') : String(ids);

    // По API: hash, id (через |), priority. :contentReference[oaicite:3]{index=3}
    await this.request('/api/v2/torrents/filePrio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        hash,
        id: idStr,
        priority: String(priority)
      })
    });

    return true;
  }
}
