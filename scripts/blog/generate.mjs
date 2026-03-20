import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const contentDir = path.join(projectRoot, 'content', 'blog');
const blogDir = path.join(projectRoot, 'src', 'blog');
const publicDir = path.join(projectRoot, 'public');
const manifestPath = path.join(blogDir, '.generated-manifest.json');

const requiredFields = ['title', 'date', 'description', 'slug', 'tags'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const defaultManifest = {
  generatedSlugs: [],
};

async function main() {
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? 'https://av.codes');
  const markdownFilePaths = await getMarkdownFilePaths();

  const posts = [];
  const validationErrors = [];

  for (const markdownFilePath of markdownFilePaths) {
    const source = await fs.readFile(markdownFilePath, 'utf8');
    const parsed = matter(source);
    const relativeFilePath = path.relative(projectRoot, markdownFilePath);
    const frontmatter = parsed.data ?? {};

    const fieldErrors = validateRequiredFields(frontmatter, relativeFilePath);
    const parsedDate = parseDate(frontmatter.date);

    if (!parsedDate.ok) {
      fieldErrors.push(`${relativeFilePath}: invalid "date" value "${String(frontmatter.date)}".`);
    }

    if (typeof frontmatter.slug !== 'string' || !slugPattern.test(frontmatter.slug)) {
      fieldErrors.push(
        `${relativeFilePath}: invalid "slug" "${String(frontmatter.slug)}". Use lowercase letters, numbers, and single hyphens.`,
      );
    }

    if (!Array.isArray(frontmatter.tags) || frontmatter.tags.length === 0) {
      fieldErrors.push(`${relativeFilePath}: "tags" must be a non-empty array of strings.`);
    } else if (frontmatter.tags.some((tag) => typeof tag !== 'string' || tag.trim().length === 0)) {
      fieldErrors.push(`${relativeFilePath}: "tags" must contain only non-empty strings.`);
    }

    if (Object.hasOwn(frontmatter, 'draft') && typeof frontmatter.draft !== 'boolean') {
      fieldErrors.push(`${relativeFilePath}: "draft" must be a boolean when provided.`);
    }

    if (fieldErrors.length > 0) {
      validationErrors.push(...fieldErrors);
      continue;
    }

    posts.push({
      sourcePath: relativeFilePath,
      title: frontmatter.title.trim(),
      description: frontmatter.description.trim(),
      slug: frontmatter.slug,
      tags: frontmatter.tags.map((tag) => tag.trim()),
      date: parsedDate.value,
      dateIso: parsedDate.value.toISOString(),
      isDraft: frontmatter.draft === true,
      html: marked.parse(parsed.content),
    });
  }

  collectDuplicateSlugErrors(posts, validationErrors);

  if (validationErrors.length > 0) {
    throw new Error(`Blog generation failed with ${validationErrors.length} error(s):\n- ${validationErrors.join('\n- ')}`);
  }

  const publishedPosts = posts
    .filter((post) => !post.isDraft)
    .sort((left, right) => right.date.getTime() - left.date.getTime() || left.slug.localeCompare(right.slug));

  await fs.mkdir(blogDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  const previousManifest = await readManifest();
  const publishedSlugs = publishedPosts.map((post) => post.slug);

  await cleanupStaleSlugDirectories(previousManifest.generatedSlugs, publishedSlugs);

  const indexPugPath = path.join(blogDir, 'index.pug');
  await writeFile(indexPugPath, renderBlogIndexPug(publishedPosts, siteUrl));

  for (const post of publishedPosts) {
    const postDir = path.join(blogDir, post.slug);
    const postPugPath = path.join(postDir, 'index.pug');

    await fs.mkdir(postDir, { recursive: true });
    await writeFile(postPugPath, renderPostPug(post, siteUrl));
  }

  await writeFile(path.join(publicDir, 'sitemap.xml'), renderSitemapXml(publishedPosts, siteUrl));
  await writeFile(path.join(publicDir, 'rss.xml'), renderRssXml(publishedPosts, siteUrl));
  await writeFile(path.join(publicDir, 'robots.txt'), renderRobotsTxt(siteUrl));

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedSlugs: publishedSlugs,
      },
      null,
      2,
    ) + '\n',
  );
}

async function getMarkdownFilePaths() {
  let entries = [];

  try {
    entries = await fs.readdir(contentDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(contentDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function validateRequiredFields(frontmatter, relativeFilePath) {
  const errors = [];

  for (const field of requiredFields) {
    const value = frontmatter[field];
    const isMissing = value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);

    if (isMissing) {
      errors.push(`${relativeFilePath}: missing required frontmatter field "${field}".`);
    }
  }

  if (typeof frontmatter.title !== 'string') {
    errors.push(`${relativeFilePath}: "title" must be a string.`);
  }

  if (typeof frontmatter.description !== 'string') {
    errors.push(`${relativeFilePath}: "description" must be a string.`);
  }

  return errors;
}

function parseDate(value) {
  if (typeof value !== 'string') {
    return { ok: false };
  }

  const trimmed = value.trim();
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsedDate = dateOnlyMatch ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false };
  }

  return { ok: true, value: parsedDate };
}

function collectDuplicateSlugErrors(posts, errors) {
  const seen = new Map();

  for (const post of posts) {
    const existing = seen.get(post.slug);

    if (!existing) {
      seen.set(post.slug, post);
      continue;
    }

    errors.push(`Duplicate slug "${post.slug}" found in ${existing.sourcePath} and ${post.sourcePath}.`);
  }
}

async function readManifest() {
  try {
    const content = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(content);

    if (!parsed || !Array.isArray(parsed.generatedSlugs)) {
      throw new Error('Manifest must include a "generatedSlugs" array.');
    }

    return {
      generatedSlugs: parsed.generatedSlugs.filter((slug) => typeof slug === 'string' && slugPattern.test(slug)),
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return defaultManifest;
    }

    throw new Error(`Unable to read manifest at ${path.relative(projectRoot, manifestPath)}: ${error.message}`);
  }
}

async function cleanupStaleSlugDirectories(previousSlugs, currentSlugs) {
  const currentSlugSet = new Set(currentSlugs);

  for (const previousSlug of previousSlugs) {
    if (currentSlugSet.has(previousSlug)) {
      continue;
    }

    const staleDirPath = path.join(blogDir, previousSlug);
    await fs.rm(staleDirPath, { recursive: true, force: true });
  }
}

function renderBlogIndexPug(posts, siteUrl) {
  const canonicalUrl = new URL('/blog/', siteUrl).toString();
  const ogImageUrl = new URL('/og-image.png', siteUrl).toString();
  const lines = [
    'doctype html',
    "html(lang='en')",
    '  head',
    "    meta(charset='UTF-8')",
    "    meta(name='viewport', content='width=device-width, initial-scale=1.0')",
    `    title ${escapePugText('Blog | av.codes')}`,
    "    meta(name='description', content='Engineering notes, implementation stories, and practical write-ups from av.codes.')",
    `    link(rel='canonical', href=${JSON.stringify(canonicalUrl)})`,
    `    meta(property='og:type', content='website')`,
    `    meta(property='og:url', content=${JSON.stringify(canonicalUrl)})`,
    `    meta(property='og:title', content='Blog | av.codes')`,
    `    meta(property='og:description', content='Engineering notes, implementation stories, and practical write-ups from av.codes.')`,
    `    meta(property='og:image', content=${JSON.stringify(ogImageUrl)})`,
    `    meta(name='twitter:card', content='summary_large_image')`,
    `    meta(name='twitter:url', content=${JSON.stringify(canonicalUrl)})`,
    `    meta(name='twitter:title', content='Blog | av.codes')`,
    `    meta(name='twitter:description', content='Engineering notes, implementation stories, and practical write-ups from av.codes.')`,
    `    meta(name='twitter:image', content=${JSON.stringify(ogImageUrl)})`,
    "    link(rel='preconnect', href='https://fonts.googleapis.com')",
    "    link(rel='preconnect', href='https://fonts.gstatic.com', crossorigin='')",
    "    link(rel='stylesheet', href='https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap')",
    "    link(rel='stylesheet', href='../main.scss')",
    "    link(rel='stylesheet', href='../blog.scss')",
    '  body.blog-page',
    "    svg(style='position:absolute;width:0;height:0')",
    "      filter#noise(color-interpolation-filters='sRGB' x='0%' y='0%' width='100%' height='100%')",
    "        feTurbulence(type='fractalNoise' baseFrequency='0.7' numOctaves='1' stitchTiles='stitch' result='noiseOut')",
    "        feColorMatrix(type='saturate' values='0' in='noiseOut' result='grayNoise')",
    "        feBlend(in='SourceGraphic' in2='contrastedNoise' mode='overlay' result='blended')",
    "        feComposite(in='blended' in2='SourceGraphic' operator='in')",
    '    main.blog-shell',
    '      div(style="padding: 1rem;")',
    "        a.blog-back-link(href='/') Back to home",
    "        h1.blog-title(data-text='Blog') Blog",
    '      ul.blog-post-list',
  ];

  for (const post of posts) {
    const postUrl = `/blog/${post.slug}/`;
    lines.push(
      '        li',
      `          a.blog-post-card(href=${JSON.stringify(postUrl)})`,
      `            h2.blog-post-card__title ${escapePugText(post.title)}`,
      `            p.blog-post-card__meta ${escapePugText(formatDisplayDate(post.date))} - ${escapePugText(post.tags.join(', '))}`,
      `            p.blog-post-card__description ${escapePugText(post.description)}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function renderPostPug(post, siteUrl) {
  const canonicalUrl = new URL(`/blog/${post.slug}/`, siteUrl).toString();
  const ogImageUrl = new URL('/og-image.png', siteUrl).toString();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: canonicalUrl,
    datePublished: post.dateIso,
    dateModified: post.dateIso,
    author: {
      '@type': 'Person',
      name: 'Ivan Charapanau',
      url: siteUrl,
    },
    publisher: {
      '@type': 'Person',
      name: 'Ivan Charapanau',
      url: siteUrl,
    },
  };

  const schemaJson = JSON.stringify(schema, null, 2);

  return [
    'doctype html',
    "html(lang='en')",
    '  head',
    "    meta(charset='UTF-8')",
    "    meta(name='viewport', content='width=device-width, initial-scale=1.0')",
    `    title ${escapePugText(`${post.title} | av.codes`)}`,
    `    meta(name='description', content=${JSON.stringify(post.description)})`,
    `    link(rel='canonical', href=${JSON.stringify(canonicalUrl)})`,
    `    meta(property='og:type', content='article')`,
    `    meta(property='og:url', content=${JSON.stringify(canonicalUrl)})`,
    `    meta(property='og:title', content=${JSON.stringify(`${post.title} | av.codes`)})`,
    `    meta(property='og:description', content=${JSON.stringify(post.description)})`,
    `    meta(property='og:image', content=${JSON.stringify(ogImageUrl)})`,
    `    meta(name='twitter:card', content='summary_large_image')`,
    `    meta(name='twitter:url', content=${JSON.stringify(canonicalUrl)})`,
    `    meta(name='twitter:title', content=${JSON.stringify(`${post.title} | av.codes`)})`,
    `    meta(name='twitter:description', content=${JSON.stringify(post.description)})`,
    `    meta(name='twitter:image', content=${JSON.stringify(ogImageUrl)})`,
    `    script(type='application/ld+json').`,
    ...schemaJson.split('\n').map((line) => `      ${line}`),
    "    link(rel='preconnect', href='https://fonts.googleapis.com')",
    "    link(rel='preconnect', href='https://fonts.gstatic.com', crossorigin='')",
    "    link(rel='stylesheet', href='https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap')",
    "    link(rel='stylesheet', href='../../main.scss')",
    "    link(rel='stylesheet', href='../../blog.scss')",
    '  body.blog-page',
    "    svg(style='position:absolute;width:0;height:0')",
    "      filter#noise(color-interpolation-filters='sRGB' x='0%' y='0%' width='100%' height='100%')",
    "        feTurbulence(type='fractalNoise' baseFrequency='0.7' numOctaves='1' stitchTiles='stitch' result='noiseOut')",
    "        feColorMatrix(type='saturate' values='0' in='noiseOut' result='grayNoise')",
    "        feBlend(in='SourceGraphic' in2='contrastedNoise' mode='overlay' result='blended')",
    "        feComposite(in='blended' in2='SourceGraphic' operator='in')",
    '    main.blog-shell.blog-post',
    "      a.blog-back-link(href='/blog/') Back to blog",
    `      h1.blog-title(data-text=${JSON.stringify(post.title)}) ${escapePugText(post.title)}`,
    `      p.blog-post-card__meta ${escapePugText(formatDisplayDate(post.date))} - ${escapePugText(post.tags.join(', '))}`,
    `      .blog-content!= ${JSON.stringify(post.html)}`,
  ].join('\n') + '\n';
}

function renderSitemapXml(posts, siteUrl) {
  const buildDate = new Date().toISOString();
  const blogLastModified = posts[0]?.dateIso ?? buildDate;

  const urls = [
    {
      loc: new URL('/', siteUrl).toString(),
      lastmod: buildDate,
    },
    {
      loc: new URL('/blog/', siteUrl).toString(),
      lastmod: blogLastModified,
    },
    ...posts.map((post) => ({
      loc: new URL(`/blog/${post.slug}/`, siteUrl).toString(),
      lastmod: post.dateIso,
    })),
  ];

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const url of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(url.loc)}</loc>`);
    lines.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

function renderRssXml(posts, siteUrl) {
  const channelUrl = new URL('/blog/', siteUrl).toString();
  const latestDate = posts[0]?.date ?? new Date('1970-01-01T00:00:00.000Z');

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>av.codes blog</title>',
    `    <link>${escapeXml(channelUrl)}</link>`,
    '    <description>Engineering notes from av.codes.</description>',
    `    <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(new URL('/rss.xml', siteUrl).toString())}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>`,
  ];

  for (const post of posts) {
    const postUrl = new URL(`/blog/${post.slug}/`, siteUrl).toString();
    lines.push('    <item>');
    lines.push(`      <title>${escapeXml(post.title)}</title>`);
    lines.push(`      <link>${escapeXml(postUrl)}</link>`);
    lines.push(`      <guid>${escapeXml(postUrl)}</guid>`);
    lines.push(`      <pubDate>${post.date.toUTCString()}</pubDate>`);
    lines.push(`      <description>${escapeXml(post.description)}</description>`);
    lines.push(`      <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[${post.html}]]></content:encoded>`);
    lines.push('    </item>');
  }

  lines.push('  </channel>');
  lines.push('</rss>');

  return `${lines.join('\n')}\n`;
}

function renderRobotsTxt(siteUrl) {
  const sitemapUrl = new URL('/sitemap.xml', siteUrl).toString();

  return [`User-agent: *`, 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n');
}

async function writeFile(filePath, nextContent) {
  try {
    const currentContent = await fs.readFile(filePath, 'utf8');

    if (currentContent === nextContent) {
      return;
    }
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, nextContent, 'utf8');
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapePugText(value) {
  return value.replaceAll('#{', '\\#{').replaceAll('!{', '\\!{');
}

function normalizeSiteUrl(value) {
  const parsed = new URL(value);

  return parsed.toString().replace(/\/$/, '');
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
