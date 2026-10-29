// Enrutador mínimo por método + patrón con parámetros (:id).
export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, opts, handler) {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    this.routes.push({ method, re, keys, opts, handler });
  }

  get(pattern, opts, handler) { this.add('GET', pattern, opts, handler); }
  post(pattern, opts, handler) { this.add('POST', pattern, opts, handler); }

  match(method, path) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}
