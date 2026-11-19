/** Small, dependency-free BM25 index over knowledge sections. */

const STOP = new Set(
  `a an and are as at be but by can do does for from has have how i if in into is it its of on or our should so
  than that the their them then there these they this to use used using was we were what when which who will with
  you your must may also each any all more most not no only other same such very via per`.split(/\s+/),
);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/c#/g, ' csharp ')
    .replace(/c\+\+/g, ' cpp ')
    .replace(/\.net\b/g, ' dotnet ')
    .replace(/ue5\b/g, ' unreal ue5 ')
    .replace(/node:test/g, ' node test nodetest ');
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && t.endsWith('es') && !t.endsWith('ses')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  if (t.length > 5 && t.endsWith('ed')) return t.slice(0, -2);
  return t;
}

export function tokenize(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export interface IndexEntry<T> {
  item: T;
  /** Weighted fields: title/heading/tags count more than body text. */
  title: string;
  heading: string;
  tags: string[];
  text: string;
}

export class Bm25Index<T> {
  private docs: { item: T; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(entries: IndexEntry<T>[]) {
    let total = 0;
    for (const e of entries) {
      const tf = new Map<string, number>();
      const add = (s: string, w: number) => {
        for (const t of tokenize(s)) tf.set(t, (tf.get(t) ?? 0) + w);
      };
      add(e.title, 3);
      add(e.heading, 3);
      add(e.tags.join(' '), 2);
      add(e.text, 1);
      let len = 0;
      for (const v of tf.values()) len += v;
      total += len;
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ item: e.item, tf, len });
    }
    this.avgLen = this.docs.length ? total / this.docs.length : 1;
  }

  get size() {
    return this.docs.length;
  }

  search(query: string, opts: { limit?: number; filter?: (item: T) => boolean; boost?: (item: T) => number } = {}) {
    const terms = [...new Set(tokenize(query))];
    const N = this.docs.length || 1;
    const k1 = 1.2;
    const b = 0.75;
    const out: { item: T; score: number }[] = [];
    for (const d of this.docs) {
      if (opts.filter && !opts.filter(d.item)) continue;
      let score = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / this.avgLen)));
      }
      if (score <= 0) continue;
      out.push({ item: d.item, score: score * (opts.boost ? opts.boost(d.item) : 1) });
    }
    out.sort((a, b2) => b2.score - a.score);
    return out.slice(0, opts.limit ?? 10);
  }
}
