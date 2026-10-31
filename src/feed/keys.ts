// Lookup keys shared by the feed builder and the extension, so both sides
// normalise addresses the same way.
//   h:<host>        a whole host and everything under it
//   u:<host><path>  one exact address, scheme ignored
//   i:<ip>          a server IP address

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isIp(host: string): boolean {
  return IPV4.test(host) || host.includes(':');
}

export function cleanHost(host: string): string {
  return host.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function hostKey(host: string): string {
  return 'h:' + cleanHost(host);
}

export function ipKey(ip: string): string {
  return 'i:' + cleanHost(ip);
}

/** Exact address key, or null for anything that is not a web address. */
export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = cleanHost(u.hostname);
  if (!host) return null;
  const hostPort = u.port ? `${host}:${u.port}` : host;
  return 'u:' + hostPort + u.pathname + u.search;
}

/** Every key a visit to this address should be checked against. */
export function lookupKeysForUrl(raw: string): string[] {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return [];
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return [];
  const host = cleanHost(u.hostname);
  if (!host) return [];
  const keys = new Set<string>();
  const exact = urlKey(raw);
  if (exact) {
    keys.add(exact);
    if (exact.endsWith('/') && u.pathname.length > 1 && !u.search) keys.add(exact.slice(0, -1));
    else if (!u.search) keys.add(exact + '/');
  }
  if (isIp(host)) keys.add(ipKey(host));
  else {
    const labels = host.split('.');
    for (let i = 0; i < labels.length - 1; i++) keys.add('h:' + labels.slice(i).join('.'));
  }
  return [...keys];
}
