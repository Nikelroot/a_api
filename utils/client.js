// qbittorrent/client.js
export class QBittorrentClient {
  constructor({ baseUrl, username, password }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;

    this.sid = null;
    this.loggingIn = null; // защита от параллельных логинов
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

      const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          Referer: this.baseUrl,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      if (!res.ok) {
        throw new Error(`qBittorrent login failed: ${res.status}`);
      }

      const setCookie = res.headers.get('set-cookie') || '';
      const sid = setCookie.match(/SID=([^;]+)/)?.[0];

      if (!sid) {
        throw new Error('qBittorrent SID cookie not found');
      }

      this.sid = sid;
      this.loggingIn = null;
      return sid;
    })();

    return this.loggingIn;
  }

  /* ---------- fetch с автологином ---------- */
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    await this.login();

    let res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Referer: this.baseUrl,
        Cookie: this.sid,
        ...headers
      },
      body
    });

    // если сессия умерла — логинимся ещё раз и повторяем запрос
    if (res.status === 403) {
      this.sid = null;
      await this.login();

      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Referer: this.baseUrl,
          Cookie: this.sid,
          ...headers
        },
        body
      });
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
      if (value !== undefined && value !== null) {
        form.set(key, String(value));
      }
    }

    await this.request('/api/v2/torrents/add', {
      method: 'POST',
      body: form
    });

    return true;
  }

  async pause(hash) {
    await this.request('/api/v2/torrents/pause', {
      method: 'POST',
      body: new URLSearchParams({ hashes: hash }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

  async resume(hash) {
    await this.request('/api/v2/torrents/resume', {
      method: 'POST',
      body: new URLSearchParams({ hashes: hash }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

  async getTorrentFiles(hash) {
    if (!hash) {
      throw new Error('Torrent hash is required');
    }

    const res = await this.request(`/api/v2/torrents/files?hash=${hash}`);

    return res.json();
  }

  async pauseTorrent(hash) {
    if (!hash) {
      throw new Error('Torrent hash is required');
    }

    await this.request('/api/v2/torrents/pause', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        hashes: hash // можно 'all'
      })
    });

    return true;
  }

  async resumeTorrent(hash) {
    if (!hash) {
      throw new Error('Torrent hash is required');
    }

    await this.request('/api/v2/torrents/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        hashes: hash
      })
    });

    return true;
  }
}
