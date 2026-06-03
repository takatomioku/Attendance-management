// =============================================
// IP判定ロジック（DB非依存・純粋関数のみ）
// 院内Wi-Fi打刻制限で使用。IPv4 / IPv6 の両方に対応する。
//
// 注意: tsconfig の target が未指定（ES3相当）のため BigInt リテラル（0n）は
// 使えない。BigInt() コンストラクタ経由で生成する。
// =============================================

export type ParsedIp = { version: 4 | 6; value: bigint };

const B0 = BigInt(0);
const B1 = BigInt(1);
const B8 = BigInt(8);
const B16 = BigInt(16);
const BFF = BigInt(0xff);
const BFFFF = BigInt(0xffff);

/**
 * リクエストヘッダーからクライアントの実IPを取得する。
 * Vercel では `x-forwarded-for` の先頭がクライアントのグローバルIP。
 */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return stripPort(first);
  }
  const real = headers.get('x-real-ip');
  if (real) return stripPort(real.trim());
  return null;
}

/** "1.2.3.4:5678" や "[::1]:5678" から末尾ポートを除去する */
function stripPort(ip: string): string {
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    if (end !== -1) return ip.slice(1, end);
  }
  // IPv4 + ポート（コロンが1個だけ）の場合のみポートを除去。
  // IPv6 はコロンを複数含むのでそのまま返す。
  if (ip.includes('.') && ip.split(':').length === 2) {
    return ip.split(':')[0];
  }
  return ip;
}

/** IP文字列を { version, value(bigint) } にパースする。失敗時 null。 */
export function parseIp(input: string): ParsedIp | null {
  if (!input) return null;
  let ip = input.trim();
  // IPv4射影IPv6（::ffff:1.2.3.4）は IPv4 として扱う
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) ip = mapped[1];

  if (ip.includes(':')) return parseIpv6(ip);
  if (ip.includes('.')) return parseIpv4(ip);
  return null;
}

function parseIpv4(ip: string): ParsedIp | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = B0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    value = (value << B8) + BigInt(n);
  }
  return { version: 4, value };
}

function parseIpv6(input: string): ParsedIp | null {
  let ip = input;
  // 末尾に埋め込まれた IPv4（例: 2001:db8::1.2.3.4）を16進2グループに変換
  const v4match = ip.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4match) {
    const v4 = parseIpv4(v4match[2]);
    if (!v4) return null;
    const high = (v4.value >> B16) & BFFFF;
    const low = v4.value & BFFFF;
    ip = v4match[1] + high.toString(16) + ':' + low.toString(16);
  }

  const dbl = ip.split('::');
  if (dbl.length > 2) return null;

  const toGroups = (s: string): bigint[] | null => {
    if (s === '') return [];
    const out: bigint[] = [];
    for (const p of s.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(p)) return null;
      out.push(BigInt(parseInt(p, 16)));
    }
    return out;
  };

  let groups: bigint[];
  if (dbl.length === 2) {
    const head = toGroups(dbl[0]);
    const tail = toGroups(dbl[1]);
    if (!head || !tail) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = head.concat(Array(missing).fill(B0)).concat(tail);
  } else {
    const g = toGroups(ip);
    if (!g) return null;
    groups = g;
  }

  if (groups.length !== 8) return null;
  let value = B0;
  for (const g of groups) {
    if (g > BFFFF) return null;
    value = (value << B16) + g;
  }
  return { version: 6, value };
}

function ipv4ToString(value: bigint): string {
  const a = (value >> BigInt(24)) & BFF;
  const b = (value >> B16) & BFF;
  const c = (value >> B8) & BFF;
  const d = value & BFF;
  return `${a}.${b}.${c}.${d}`;
}

function ipv6ToString(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    groups.push((((value >> BigInt(i * 16)) & BFFFF)).toString(16));
  }
  // 連続する "0" の最長区間を "::" に圧縮
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen < 2) return groups.join(':');
  const before = groups.slice(0, bestStart).join(':');
  const after = groups.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`;
}

/** IPを正規化した文字列にする（IPv4射影は IPv4 へ、IPv6 は圧縮表記） */
export function normalizeIp(ip: string): string | null {
  const p = parseIp(ip);
  if (!p) return null;
  return p.version === 4 ? ipv4ToString(p.value) : ipv6ToString(p.value);
}

/** version と prefix からネットマスク(bigint)を作る */
function maskFor(version: 4 | 6, prefix: number): bigint {
  const bits = version === 4 ? 32 : 128;
  if (prefix <= 0) return B0;
  if (prefix >= bits) return (B1 << BigInt(bits)) - B1;
  return ((B1 << BigInt(bits)) - B1) ^ ((B1 << BigInt(bits - prefix)) - B1);
}

/** ip が cidr（"1.2.3.0/24" や "2001:db8::/32"、prefix省略時は単一IP）に含まれるか */
export function ipInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf('/');
  const basePart = slash === -1 ? cidr : cidr.slice(0, slash);
  const base = parseIp(basePart.trim());
  const target = parseIp(ip.trim());
  if (!base || !target) return false;
  if (base.version !== target.version) return false;

  const bits = base.version === 4 ? 32 : 128;
  const prefix = slash === -1 ? bits : Number(cidr.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;

  const mask = maskFor(base.version, prefix);
  return (base.value & mask) === (target.value & mask);
}

/** ip が許可リスト（CIDR文字列の配列）のいずれかに一致するか */
export function isIpAllowed(ip: string, rules: string[]): boolean {
  return rules.some((r) => ipInCidr(ip, r));
}

/** CIDR文字列が妥当か（IPv4/IPv6・prefix範囲を検証） */
export function isValidCidr(cidr: string): boolean {
  const trimmed = cidr.trim();
  const slash = trimmed.indexOf('/');
  const basePart = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const base = parseIp(basePart.trim());
  if (!base) return false;
  if (slash === -1) return true;
  const bits = base.version === 4 ? 32 : 128;
  const prefix = Number(trimmed.slice(slash + 1));
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= bits;
}

/**
 * 検出したIPから登録用CIDRを提案する。
 * - IPv4: 単一アドレス（/32）。同一回線の端末はNATで同じグローバルIPになるため。
 * - IPv6: /64 プレフィックス。端末ごとにアドレスが変わるためネットワーク単位で許可する。
 */
export function suggestCidr(ip: string): string | null {
  const p = parseIp(ip);
  if (!p) return null;
  if (p.version === 4) return `${ipv4ToString(p.value)}/32`;
  const network = p.value & maskFor(6, 64);
  return `${ipv6ToString(network)}/64`;
}
