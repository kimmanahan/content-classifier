(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ContentClassifier = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_STOPWORDS = {
    the: 1, and: 1, for: 1, that: 1, with: 1, this: 1, from: 1, are: 1, was: 1, were: 1,
    you: 1, your: 1, our: 1, has: 1, have: 1, had: 1, not: 1, but: 1, can: 1, all: 1,
    any: 1, its: 1, their: 1, they: 1, them: 1, his: 1, her: 1, she: 1, him: 1, who: 1,
    what: 1, when: 1, where: 1, why: 1, how: 1, about: 1, into: 1, then: 1, also: 1,
    over: 1, more: 1, most: 1, such: 1, only: 1, just: 1, like: 1, some: 1, these: 1,
    those: 1, will: 1, would: 1, could: 1, should: 1, been: 1, being: 1, while: 1,
    after: 1, before: 1, between: 1, under: 1, through: 1, both: 1, each: 1, other: 1,
    because: 1, very: 1, many: 1, than: 1
  };

  var DEFAULT_CONFIG = {
    maxChars: 12000,
    maxEstimatedTokens: 3000,
    topicLimit: 5,
    articleSelector: 'article, [data-article-content], #article-body, main',
    stopwords: DEFAULT_STOPWORDS,
    pageTypeMap: {}
  };

  // ── Text utilities ────────────────────────────────────────

  function normalizeWhitespace(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Cap text to char/token budget.
   * Returns { text, truncated, estimatedTokens }
   */
  function capText(text, config) {
    var cfg = config || DEFAULT_CONFIG;
    var out = normalizeWhitespace(text);
    var truncated = 0;

    if (out.length > cfg.maxChars) {
      out = out.slice(0, cfg.maxChars);
      truncated = 1;
    }

    var estimatedTokens = Math.ceil(out.length / 4);
    if (estimatedTokens > cfg.maxEstimatedTokens) {
      out = out.slice(0, cfg.maxEstimatedTokens * 4);
      estimatedTokens = Math.ceil(out.length / 4);
      truncated = 1;
    }

    return { text: out, truncated: truncated, estimatedTokens: estimatedTokens };
  }

  // ── Topic extraction ──────────────────────────────────────

  /**
   * Extract top N keywords by frequency, filtering stopwords.
   * Returns array of { term, count } sorted descending.
   */
  function extractTopics(text, options) {
    var opts = options || {};
    var stopwords = opts.stopwords || DEFAULT_STOPWORDS;
    var limit = opts.limit || DEFAULT_CONFIG.topicLimit;
    var minLength = opts.minLength || 3;

    var lower = String(text || '').toLowerCase();
    var tokens = lower.match(/[a-z][a-z\-]{2,}/g) || [];
    var counts = {};

    for (var i = 0; i < tokens.length; i++) {
      var w = tokens[i];
      if (w.length < minLength) continue;
      if (stopwords[w]) continue;
      counts[w] = (counts[w] || 0) + 1;
    }

    var ranked = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });

    return ranked.slice(0, Math.max(1, limit)).map(function (term) {
      return { term: term, count: counts[term] };
    });
  }

  // ── DOM content extraction ────────────────────────────────

  function textFromSelector(selector, doc) {
    try {
      var el = (doc || document).querySelector(selector);
      return el ? normalizeWhitespace(el.textContent || '') : '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Extract the best article body text from the DOM by trying
   * a comma-separated list of CSS selectors in order and
   * returning the longest result.
   */
  function extractArticleText(selectorList, doc) {
    var selectors = String(selectorList || DEFAULT_CONFIG.articleSelector).split(',');
    var best = '';
    for (var i = 0; i < selectors.length; i++) {
      var t = textFromSelector(selectors[i].trim(), doc);
      if (t.length > best.length) best = t;
    }
    return best;
  }

  // ── Page-type classification ──────────────────────────────

  var BUILTIN_PAGE_PATTERNS = [
    { pattern: /^\/$|^\/index\.php$/, type: 'home' },
    { pattern: /^\/article\//,        type: 'article' },
    { pattern: /^\/articles/,         type: 'articles' },
    { pattern: /^\/news/,             type: 'news' }
  ];

  /**
   * Classify a URL pathname into a page type.
   *
   * @param {string} pathname       - e.g. window.location.pathname
   * @param {Object} [customMap]    - { '/my-path': 'my_type', ... } checked first
   * @returns {string}
   */
  function classifyPageType(pathname, customMap) {
    var p = String(pathname || '/').toLowerCase();

    if (customMap) {
      for (var prefix in customMap) {
        if (Object.prototype.hasOwnProperty.call(customMap, prefix)) {
          if (p.indexOf(prefix.toLowerCase()) === 0) return customMap[prefix];
        }
      }
    }

    for (var i = 0; i < BUILTIN_PAGE_PATTERNS.length; i++) {
      if (BUILTIN_PAGE_PATTERNS[i].pattern.test(p)) {
        return BUILTIN_PAGE_PATTERNS[i].type;
      }
    }

    return 'unknown';
  }

  // ── Full classify pipeline ────────────────────────────────

  /**
   * Run the full classification pipeline on a text string.
   *
   * @param {string} text
   * @param {Object} [config]
   * @returns {{
   *   wordCount: number,
   *   charCount: number,
   *   estimatedTokens: number,
   *   truncated: number,
   *   topics: Array<{term:string, count:number}>
   * }}
   */
  function classify(text, config) {
    var cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
    var bounded = capText(text, cfg);
    var clean = bounded.text;

    return {
      wordCount:       (clean.match(/\b[\w'-]+\b/g) || []).length,
      charCount:       clean.length,
      estimatedTokens: bounded.estimatedTokens,
      truncated:       bounded.truncated,
      topics:          extractTopics(clean, { stopwords: cfg.stopwords, limit: cfg.topicLimit })
    };
  }

  // ── Public API ────────────────────────────────────────────

  return {
    version: '1.0.0',
    classify:          classify,
    extractTopics:     extractTopics,
    extractArticleText: extractArticleText,
    classifyPageType:  classifyPageType,
    capText:           capText,
    DEFAULT_STOPWORDS: DEFAULT_STOPWORDS
  };
}));
