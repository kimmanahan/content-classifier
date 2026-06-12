(function (win, doc) {
  'use strict';

  if (win.MALBotLayer && win.MALBotLayer.version) return;

  var defaultStopwords = {
    the: 1, and: 1, for: 1, that: 1, with: 1, this: 1, from: 1, are: 1, was: 1, were: 1,
    you: 1, your: 1, our: 1, has: 1, have: 1, had: 1, not: 1, but: 1, can: 1, all: 1,
    any: 1, its: 1, their: 1, they: 1, them: 1, his: 1, her: 1, she: 1, him: 1, who: 1,
    what: 1, when: 1, where: 1, why: 1, how: 1, about: 1, into: 1, then: 1, also: 1,
    over: 1, more: 1, most: 1, such: 1, only: 1, just: 1, like: 1, some: 1, these: 1,
    those: 1, will: 1, would: 1, could: 1, should: 1, been: 1, being: 1, while: 1,
    after: 1, before: 1, between: 1, under: 1, through: 1, both: 1, each: 1, other: 1,
    because: 1, very: 1, many: 1, than: 1, legal: 1, law: 1, laws: 1, attorney: 1,
    attorneys: 1, family: 1, article: 1, guide: 1, state: 1, states: 1, information: 1
  };

  var cfg = {
    dataLayerName: 'dataLayer',
    eventName: 'mal_data_layer',
    pageType: '',
    articleType: '',
    articleCategory: '',
    articleSelector: 'article, [data-article-content], #article-body, main',
    maxArticleChars: 12000,
    maxEstimatedTokens: 3000,
    topicLimit: 3,
    autoPush: true,
    stopwords: defaultStopwords
  };

  if (win.MALBotLayerConfig && typeof win.MALBotLayerConfig === 'object') {
    for (var k in win.MALBotLayerConfig) {
      if (Object.prototype.hasOwnProperty.call(win.MALBotLayerConfig, k)) {
        cfg[k] = win.MALBotLayerConfig[k];
      }
    }
  }

  function parseUA() {
    var ua = (win.navigator && win.navigator.userAgent) ? String(win.navigator.userAgent) : '';
    var u = ua.toLowerCase();
    var browser = 'Other';
    var os = 'Other';

    if (u.indexOf('edg/') >= 0) browser = 'Edge';
    else if (u.indexOf('opr/') >= 0 || u.indexOf('opera') >= 0) browser = 'Opera';
    else if (u.indexOf('chrome/') >= 0 && u.indexOf('edg/') < 0 && u.indexOf('opr/') < 0) browser = 'Chrome';
    else if (u.indexOf('firefox/') >= 0) browser = 'Firefox';
    else if (u.indexOf('safari/') >= 0 && u.indexOf('chrome/') < 0) browser = 'Safari';

    if (u.indexOf('windows') >= 0) os = 'Windows';
    else if (u.indexOf('android') >= 0) os = 'Android';
    else if (u.indexOf('iphone') >= 0 || u.indexOf('ipad') >= 0 || u.indexOf('ios') >= 0) os = 'iOS';
    else if (u.indexOf('mac os x') >= 0 || u.indexOf('macintosh') >= 0) os = 'macOS';
    else if (u.indexOf('linux') >= 0) os = 'Linux';

    var device = 'desktop';
    if (u.indexOf('mobile') >= 0 || u.indexOf('iphone') >= 0 || u.indexOf('android') >= 0) device = 'mobile';
    if (u.indexOf('tablet') >= 0 || u.indexOf('ipad') >= 0) device = 'tablet';

    return {
      ua: ua,
      browser: browser,
      os: os,
      device: device
    };
  }

  function detectBot(ua) {
    var u = String(ua || '').toLowerCase();
    var patterns = [
      'bot', 'crawl', 'spider', 'slurp', 'bingpreview', 'duckassistbot', 'applebot',
      'gptbot', 'chatgpt-user', 'oai-searchbot', 'anthropic-ai', 'claudebot',
      'perplexitybot', 'ccbot', 'facebookexternalhit', 'whatsapp', 'telegrambot',
      'headless', 'phantomjs', 'python-requests', 'curl/', 'wget/'
    ];

    for (var i = 0; i < patterns.length; i++) {
      if (u.indexOf(patterns[i]) >= 0) return 1;
    }

    if (win.navigator && win.navigator.webdriver) return 1;
    return 0;
  }

  function normalizeWhitespace(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function capNLPText(text) {
    var out = normalizeWhitespace(text);
    var truncated = 0;

    if (out.length > cfg.maxArticleChars) {
      out = out.slice(0, cfg.maxArticleChars);
      truncated = 1;
    }

    var estimatedTokens = Math.ceil(out.length / 4);
    if (estimatedTokens > cfg.maxEstimatedTokens) {
      out = out.slice(0, cfg.maxEstimatedTokens * 4);
      estimatedTokens = Math.ceil(out.length / 4);
      truncated = 1;
    }

    return {
      text: out,
      truncated: truncated,
      estimatedTokens: estimatedTokens
    };
  }

  function textFromSelector(selector) {
    try {
      var el = doc.querySelector(selector);
      if (!el) return '';
      return normalizeWhitespace(el.textContent || '');
    } catch (e) {
      return '';
    }
  }

  function getArticleText() {
    if (typeof cfg.articleText === 'string' && cfg.articleText.trim() !== '') {
      return normalizeWhitespace(cfg.articleText);
    }

    var selectors = String(cfg.articleSelector || '').split(',');
    var best = '';
    for (var i = 0; i < selectors.length; i++) {
      var t = textFromSelector(selectors[i].trim());
      if (t.length > best.length) best = t;
    }
    return best;
  }

  function topTopics(text, limit) {
    var lower = String(text || '').toLowerCase();
    var words = lower.match(/[a-z][a-z\-]{2,}/g) || [];
    var counts = {};

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (cfg.stopwords[w]) continue;
      counts[w] = (counts[w] || 0) + 1;
    }

    var ranked = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });

    return ranked.slice(0, Math.max(1, limit || cfg.topicLimit || 3));
  }

  function getMetaContent(name) {
    var meta = doc.querySelector('meta[name="' + name + '"]');
    if (meta && meta.content) return String(meta.content).trim();
    return '';
  }

  function getPropertyContent(prop) {
    var meta = doc.querySelector('meta[property="' + prop + '"]');
    if (meta && meta.content) return String(meta.content).trim();
    return '';
  }

  function resolvePageType() {
    if (cfg.pageType) return String(cfg.pageType);

    var fromMeta = getMetaContent('page-type');
    if (fromMeta) return fromMeta;

    var body = doc.body;
    if (body && body.getAttribute('data-page-type')) {
      return String(body.getAttribute('data-page-type'));
    }

    var p = (win.location && win.location.pathname) ? win.location.pathname.toLowerCase() : '/';
    if (p === '/' || p === '/index.php') return 'home';
    if (p.indexOf('/article/') === 0) return 'article';
    if (p.indexOf('/articles') === 0) return 'articles';
    if (p.indexOf('/news') === 0) return 'news';
    if (p.indexOf('/state-guide') === 0) return 'state_guide';
    if (p.indexOf('/child-support') === 0) return 'child_support_estimator';
    if (p.indexOf('/alimony-estimator') === 0) return 'alimony_estimator';
    if (p.indexOf('/divorce-cost-calculator') === 0) return 'divorce_cost_calculator';
    if (p.indexOf('/modification-checker') === 0) return 'modification_checker';
    return 'unknown';
  }

  function collect() {
    var uaData = parseUA();
    var isBot = detectBot(uaData.ua);
    var path = (win.location && win.location.pathname) ? win.location.pathname : '/';
    var params = new URLSearchParams((win.location && win.location.search) ? win.location.search : '');

    var payload = {
      event: cfg.eventName,
      pageType: resolvePageType(),
      requestPath: path,
      requestMethod: 'GET',
      isBot: isBot,
      botAgent: isBot ? uaData.ua : '',
      userContext: {
        userAgent: uaData.ua,
        browser: uaData.browser,
        operatingSystem: uaData.os,
        deviceType: uaData.device,
        language: (win.navigator && win.navigator.language) ? String(win.navigator.language) : '',
        platformHint: (win.navigator && win.navigator.platform) ? String(win.navigator.platform) : '',
        doNotTrack: (win.navigator && win.navigator.doNotTrack) ? String(win.navigator.doNotTrack) : '',
        referer: doc.referrer || ''
      },
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || ''
    };

    var articleText = getArticleText();
    if (articleText.length > 0) {
      var bounded = capNLPText(articleText);
      var clean = bounded.text;
      payload.articleWordCount = (clean.match(/\b[\w'-]+\b/g) || []).length;
      payload.articleCharacterCount = clean.length;
      payload.articleTopTopics = topTopics(clean, cfg.topicLimit);
      payload.nlpEstimatedTokens = bounded.estimatedTokens;
      payload.nlpInputTruncated = bounded.truncated;
      payload.articleType = cfg.articleType || getPropertyContent('article:type') || getMetaContent('article-type') || '';
      payload.articleCategory = cfg.articleCategory || getPropertyContent('article:section') || getMetaContent('article-category') || '';
    }

    return payload;
  }

  function push(payload) {
    var dlName = cfg.dataLayerName || 'dataLayer';
    win[dlName] = win[dlName] || [];
    win[dlName].push(payload || collect());
    return win[dlName];
  }

  win.MALBotLayer = {
    version: '1.0.0',
    config: cfg,
    collect: collect,
    push: push
  };

  if (cfg.autoPush) {
    push();
  }
})(window, document);
