# content-classifier.js

Lightweight, zero-dependency JavaScript module for client-side NLP content classification. Extracts keywords, budgets token usage, identifies article text in the DOM, and classifies page type — no server round-trip, no external libraries.

Works in the browser (UMD global) and Node.js (`require`).

---

## Features

| Function | What it does |
|---|---|
| `classify(text, config)` | Full pipeline — caps text, counts words, extracts topics |
| `extractTopics(text, options)` | Tokenize + frequency rank, strip stopwords, return top N |
| `extractArticleText(selectors, doc)` | Try CSS selectors in order, return longest match |
| `classifyPageType(pathname, customMap)` | Map URL path to a page-type string |
| `capText(text, config)` | Enforce char + estimated-token budget |

---

## Quick start

```html
<script src="content-classifier.js"></script>
<script>
  var result = ContentClassifier.classify(document.body.innerText);
  console.log(result.topics);
  // [{ term: 'custody', count: 14 }, { term: 'divorce', count: 11 }, ...]
</script>
```

```js
// Node
const { classify, classifyPageType } = require('./content-classifier');

const result = classify(articleText, { topicLimit: 10 });
console.log(result);
// {
//   wordCount: 842,
//   charCount: 4901,
//   estimatedTokens: 1225,
//   truncated: 0,
//   topics: [ { term: 'custody', count: 14 }, ... ]
// }

console.log(classifyPageType('/article/how-to-file-for-divorce'));
// 'article'
```

---

## API

### `classify(text, config?)`

Runs the full pipeline. Returns:

```ts
{
  wordCount:       number,
  charCount:       number,
  estimatedTokens: number,   // chars / 4
  truncated:       0 | 1,
  topics:          Array<{ term: string, count: number }>
}
```

### `extractTopics(text, options?)`

```js
extractTopics(text, {
  stopwords:  { the: 1, and: 1, ... },  // words to skip
  limit:      5,                         // top N results
  minLength:  3                          // min token length
})
// → [{ term: 'custody', count: 14 }, ...]
```

### `extractArticleText(selectorList, doc?)`

Tries each selector in the comma-separated list and returns the text from the element with the most content.

```js
extractArticleText('article, #main-content, main', document)
```

### `classifyPageType(pathname, customMap?)`

```js
classifyPageType('/news/2024-ruling', {
  '/news':          'news_article',
  '/state-guide':   'state_guide',
  '/child-support': 'calculator'
})
// → 'news_article'
```

Built-in patterns: `home`, `article`, `articles`, `news`. Falls back to `'unknown'`.

### `capText(text, config?)`

```js
capText(rawText, { maxChars: 12000, maxEstimatedTokens: 3000 })
// → { text: '...', truncated: 0, estimatedTokens: 1225 }
```

---

## Configuration

All options passed to `classify()` or as defaults:

| Key | Default | Description |
|---|---|---|
| `maxChars` | `12000` | Hard character cap |
| `maxEstimatedTokens` | `3000` | Token cap (`chars / 4`) |
| `topicLimit` | `5` | Top N topics to return |
| `articleSelector` | `'article, [data-article-content], #article-body, main'` | Selector list for DOM extraction |
| `stopwords` | *(built-in ~60 words)* | Hash map of words to ignore |
| `pageTypeMap` | `{}` | Custom path → type mappings |

Extend the stopword list:

```js
const result = classify(text, {
  stopwords: Object.assign({}, ContentClassifier.DEFAULT_STOPWORDS, {
    lawyer: 1, attorney: 1, legal: 1
  })
});
```

---

## Design notes

- **ES5** — runs in any browser, no transpilation needed
- **UMD** — works as a browser global or CommonJS `require`
- **Token budget** uses the `chars / 4` heuristic — fast, no tokenizer dependency, accurate enough for capping upstream LLM input
- **Topic extraction** is pure TF (term frequency) within the document — appropriate for single-page classification where IDF context isn't available

---

## License

MIT
