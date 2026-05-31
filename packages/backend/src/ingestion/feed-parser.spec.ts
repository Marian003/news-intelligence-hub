import {describe, expect, it} from 'vitest';
import {parseFeed} from './feed-parser';

const RSS_2 = `<?xml version="1.0"?>
<rss version="2.0"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Tech News</title>
    <item>
      <title>Microsoft ships AI runtime</title>
      <link>https://example.com/ms-ai</link>
      <guid isPermaLink="false">tag:example,1</guid>
      <pubDate>Tue, 20 May 2025 12:00:00 GMT</pubDate>
      <dc:creator>Jane Doe</dc:creator>
      <description>&lt;p&gt;Short summary.&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>Full body content here.</p>]]></content:encoded>
    </item>
    <item>
      <title>Second</title>
      <link>https://example.com/second</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <entry>
    <title>Atom Post</title>
    <link rel="edit" href="https://example.com/edit"/>
    <link rel="alternate" href="https://example.com/atom-post"/>
    <id>urn:uuid:1234</id>
    <published>2025-05-20T12:00:00Z</published>
    <author><name>Alice</name></author>
    <summary>Atom summary text</summary>
    <content type="html">&lt;p&gt;Atom body&lt;/p&gt;</content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns="http://purl.org/rss/1.0/"
         xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.com"><title>RDF Feed</title></channel>
  <item rdf:about="https://example.com/rdf-1">
    <title>RDF Item</title>
    <link>https://example.com/rdf-1</link>
    <dc:date>2025-05-20T12:00:00Z</dc:date>
    <dc:creator>Bob</dc:creator>
    <description>RDF description</description>
  </item>
</rdf:RDF>`;

const expectedTs = Math.floor(Date.parse('2025-05-20T12:00:00Z') / 1000);

describe('parseFeed (RSS 2.0)', () => {
  const feed = parseFeed(RSS_2);

  it('reads the channel title and all items with a link', () => {
    expect(feed.title).toBe('Tech News');
    expect(feed.articles).toHaveLength(2);
  });

  it('maps fields, decoding entities and stripping HTML from the summary', () => {
    const [first] = feed.articles;
    expect(first.title).toBe('Microsoft ships AI runtime');
    expect(first.link).toBe('https://example.com/ms-ai');
    expect(first.guid).toBe('tag:example,1');
    expect(first.author).toBe('Jane Doe');
    expect(first.summary).toBe('Short summary.');
    expect(first.content).toContain('Full body content here.');
    expect(first.publishedAt).toBe(
      Math.floor(Date.parse('Tue, 20 May 2025 12:00:00 GMT') / 1000)
    );
  });
});

describe('parseFeed (Atom)', () => {
  const feed = parseFeed(ATOM);

  it('prefers the alternate link and maps entry fields', () => {
    expect(feed.title).toBe('Atom Example');
    expect(feed.articles).toHaveLength(1);
    const [entry] = feed.articles;
    expect(entry.link).toBe('https://example.com/atom-post');
    expect(entry.guid).toBe('urn:uuid:1234');
    expect(entry.author).toBe('Alice');
    expect(entry.summary).toBe('Atom summary text');
    expect(entry.content).toContain('Atom body');
    expect(entry.publishedAt).toBe(expectedTs);
  });
});

describe('parseFeed (RSS 1.0 / RDF)', () => {
  it('handles a single item and dc:* metadata', () => {
    const feed = parseFeed(RDF);
    expect(feed.title).toBe('RDF Feed');
    expect(feed.articles).toHaveLength(1);
    const [item] = feed.articles;
    expect(item.link).toBe('https://example.com/rdf-1');
    expect(item.author).toBe('Bob');
    expect(item.summary).toBe('RDF description');
    expect(item.publishedAt).toBe(expectedTs);
  });
});

describe('parseFeed (edge cases)', () => {
  it('throws on an unrecognized document', () => {
    expect(() => parseFeed('<html><body>nope</body></html>')).toThrow();
  });

  it('drops entries that have no link', () => {
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>No link here</title></item>
      <item><title>Has link</title><link>https://example.com/x</link></item>
    </channel></rss>`;
    const feed = parseFeed(xml);
    expect(feed.articles).toHaveLength(1);
    expect(feed.articles[0].link).toBe('https://example.com/x');
  });
});
