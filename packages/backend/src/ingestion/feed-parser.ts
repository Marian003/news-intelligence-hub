import {XMLParser} from 'fast-xml-parser';

/**
 * One article as it comes off a feed, before any enrichment. Links are raw here;
 * normalization for dedup happens separately ({@link ./url-normalize}).
 */
export interface ParsedArticle {
  guid?: string;
  title: string;
  link: string;
  author?: string;
  publishedAt?: number; // Unix seconds, if the feed supplied a parseable date.
  summary?: string;
  content?: string;
}

export interface ParsedFeed {
  title?: string;
  articles: ParsedArticle[];
}

// fast-xml-parser only tokenizes XML into a plain object tree; the mapping from
// RSS/Atom elements to our shape below is ours, so it stays explainable/tested.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  processEntities: true,
});

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extracts the text of an element whether it's a plain string or `{#text}`. */
function text(node: unknown): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (typeof node === 'string') return node.trim() || undefined;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    const inner = (node as XmlNode)['#text'];
    if (typeof inner === 'string') return inner.trim() || undefined;
    if (typeof inner === 'number') return String(inner);
  }
  return undefined;
}

function stripHtml(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const stripped = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || undefined;
}

function toUnixSeconds(raw?: string): number | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

/** Maps an RSS 2.0 / RSS 1.0 `<item>` (they share element names). */
function mapRssItem(item: XmlNode): ParsedArticle {
  const link =
    text(item.link) ?? text(item.guid) ?? text(item['rdf:about']) ?? '';
  const description = text(item.description);
  return {
    guid: text(item.guid),
    title: text(item.title) ?? '(untitled)',
    link,
    author: text(item.author) ?? text(item['dc:creator']),
    publishedAt: toUnixSeconds(text(item.pubDate) ?? text(item['dc:date'])),
    summary: stripHtml(description),
    content: text(item['content:encoded']) ?? description,
  };
}

/** Resolves an Atom entry's display link, preferring rel="alternate". */
function atomLink(link: unknown): string {
  const links = asArray(link) as XmlNode[];
  const alternate = links.find(
    l => (l['@_rel'] ?? 'alternate') === 'alternate' && l['@_href']
  );
  const chosen = alternate ?? links.find(l => l['@_href']);
  if (chosen) return String(chosen['@_href']);
  // Some feeds put the URL as the element's text rather than an href attribute.
  return text(link) ?? '';
}

function atomAuthor(author: unknown): string | undefined {
  const first = asArray(author)[0] as XmlNode | undefined;
  return first ? text(first.name) : undefined;
}

function mapAtomEntry(entry: XmlNode): ParsedArticle {
  const summary = text(entry.summary);
  return {
    guid: text(entry.id),
    title: text(entry.title) ?? '(untitled)',
    link: atomLink(entry.link),
    author: atomAuthor(entry.author),
    publishedAt: toUnixSeconds(text(entry.published) ?? text(entry.updated)),
    summary: stripHtml(summary),
    content: text(entry.content) ?? summary,
  };
}

/**
 * Parses an RSS 2.0, RSS 1.0 (RDF), or Atom document into a uniform shape.
 * Throws on anything it doesn't recognize so the caller can mark the feed as
 * errored with a clear reason.
 */
export function parseFeed(xml: string): ParsedFeed {
  const root = parser.parse(xml) as XmlNode;

  const rss = root.rss as XmlNode | undefined;
  if (rss?.channel) {
    const channel = rss.channel as XmlNode;
    return {
      title: text(channel.title),
      articles: asArray(channel.item as XmlNode | XmlNode[])
        .map(mapRssItem)
        .filter(article => article.link),
    };
  }

  const rdf = root['rdf:RDF'] as XmlNode | undefined;
  if (rdf) {
    const channel = rdf.channel as XmlNode | undefined;
    return {
      title: channel ? text(channel.title) : undefined,
      articles: asArray(rdf.item as XmlNode | XmlNode[])
        .map(mapRssItem)
        .filter(article => article.link),
    };
  }

  const feed = root.feed as XmlNode | undefined;
  if (feed) {
    return {
      title: text(feed.title),
      articles: asArray(feed.entry as XmlNode | XmlNode[])
        .map(mapAtomEntry)
        .filter(article => article.link),
    };
  }

  throw new Error('Unrecognized feed format (expected RSS, RSS/RDF, or Atom)');
}
