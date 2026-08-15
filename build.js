// build.js —— 将《小说.txt》解析为网站章节页面与章节目录
// 用法：在项目根目录运行  node build.js
// 说明：按“旅途 第N章:标题 / 旅途 序章:标题”切分章节，
//       正文段落以空行分隔，段首全角空格缩进会被移除（由 CSS 的 text-indent 处理）。
const fs = require('fs');
const path = require('path');

const SRC = '小说.txt';
const STORIES_DIR = 'stories';

const txt = fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, ''); // 去除 BOM

const lines = txt.split(/\r?\n/);
const chapterRe = /^旅途\s+(序章|第(\d+)章)[:：](.+)$/;

const chapters = [];
let cur = null;
let curLines = [];

function flush() {
  if (cur) {
    cur.paragraphs = parseParagraphs(curLines);
    chapters.push(cur);
  }
  cur = null;
  curLines = [];
}

for (const line of lines) {
  const m = line.match(chapterRe);
  if (m) {
    flush();
    cur = {
      type: m[1],                              // "序章" 或 "第N章"
      num: m[2] ? parseInt(m[2], 10) : null,   // 章节数字（序章为 null）
      title: normalize(m[3])
    };
  } else {
    curLines.push(line);
  }
}
flush();

// 移除卷末标记行（如“（旅途卷，完）”）
const lastCh = chapters[chapters.length - 1];
if (lastCh && lastCh.paragraphs.length) {
  const last = lastCh.paragraphs[lastCh.paragraphs.length - 1];
  if (/^\(.+卷.+完\)$/.test(last)) lastCh.paragraphs.pop();
}

function normalize(s) {
  // 统一姓名分隔符（原文用了 • 与 · 混用，网站统一为 ·）
  return s.trim().replace(/•/g, '·');
}

function parseParagraphs(ls) {
  // 以空行分块；块内多行（无空行的换行）直接拼接
  const blocks = ls.join('\n').split(/\n\s*\n/);
  const out = [];
  for (const b of blocks) {
    const content = b
      .split(/\r?\n/)
      .map(l => l.replace(/^\u3000+/g, '').trim())
      .filter(l => l !== '')
      .join('')
      .replace(/•/g, '·');
    if (content !== '') out.push(content);
  }
  return out;
}

// 中文数字（1~29）
const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function cn(n) {
  if (n < 10) return DIGITS[n];
  if (n < 20) return '十' + (n % 10 === 0 ? '' : DIGITS[n % 10]);
  return DIGITS[Math.floor(n / 10)] + '十' + (n % 10 === 0 ? '' : DIGITS[n % 10]);
}

function getFile(ch) {
  if (ch.type === '序章') {
    return /2/.test(ch.title) ? 'chapter-00b.html' : 'chapter-00.html';
  }
  return 'chapter-' + String(ch.num).padStart(2, '0') + '.html';
}

function getLabel(ch) {
  if (ch.type === '序章') return '序章';
  return '第' + cn(ch.num) + '章';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function navHtml(prev, next) {
  const left = prev ? `<a href="${prev}">← 上一章</a>` : '<span>&nbsp;</span>';
  const right = next ? `<a href="${next}">下一章 →</a>` : '<span>&nbsp;</span>';
  return `            <nav class="chapter-nav">
                ${left}
                ${right}
            </nav>`;
}

function chapterHtml(ch, prev, next) {
  const label = getLabel(ch);
  const paras = ch.paragraphs.map(p => `                <p>${escapeHtml(p)}</p>`).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${label}:${ch.title} | 昼雨暗夜</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <header class="site-header">
        <nav class="main-nav">
            <a href="../index.html" class="site-title">昼雨暗夜</a>
            <ul class="nav-links">
                <li><a href="index.html">故事</a></li>
                <li><a href="../world/index.html">世界观</a></li>
                <li><a href="../characters/index.html">角色</a></li>
                <li><a href="../about.html">关于</a></li>
            </ul>
        </nav>
    </header>

    <main class="content">
        <article class="chapter">
            <header class="chapter-header">
                <p class="chapter-number">${label}</p>
                <h1>${escapeHtml(ch.title)}</h1>
            </header>

            <div class="chapter-content">
${paras}
            </div>

${navHtml(prev, next)}

            <a href="index.html" class="back-link">← 返回故事目录</a>
        </article>
    </main>

    <footer class="site-footer">
        <p>&copy; 2026 昼雨暗夜 · <a href="https://github.com/huimo-wuling">GitHub</a></p>
    </footer>

    <script src="../js/rain.js"></script>
</body>
</html>
`;
}

// 1) 写各章节文件
const files = chapters.map(getFile);
for (let i = 0; i < chapters.length; i++) {
  const prev = i > 0 ? files[i - 1] : null;
  const next = i < files.length - 1 ? files[i + 1] : null;
  const html = chapterHtml(chapters[i], prev, next);
  fs.writeFileSync(path.join(STORIES_DIR, files[i]), html, 'utf8');
}

// 2) 生成章节目录
function excerpt(ch) {
  const p = (ch.paragraphs[0] || '').trim();
  if (!p) return '';
  const s = p.slice(0, 24);
  return s + (p.length > 24 ? '…' : '');
}

const cards = chapters.map((ch) => {
  const label = getLabel(ch);
  return `                <article class="story-card">
                    <span class="story-tag">${label}</span>
                    <h3><a href="${getFile(ch)}">${escapeHtml(ch.title)}</a></h3>
                    <p class="story-excerpt">${escapeHtml(excerpt(ch))}</p>
                </article>`;
}).join('\n');

const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>故事 | 昼雨暗夜</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <header class="site-header">
        <nav class="main-nav">
            <a href="../index.html" class="site-title">昼雨暗夜</a>
            <ul class="nav-links">
                <li><a href="index.html">故事</a></li>
                <li><a href="../world/index.html">世界观</a></li>
                <li><a href="../characters/index.html">角色</a></li>
                <li><a href="../about.html">关于</a></li>
            </ul>
        </nav>
    </header>

    <main class="content">
        <section class="hero">
            <h1>旅途</h1>
            <p class="hero-subtitle">灰漠的追寻真相之路</p>
        </section>

        <section class="recent-stories">
            <h2>章节目录</h2>
            <div class="story-list">
${cards}
            </div>
        </section>
    </main>

    <footer class="site-footer">
        <p>&copy; 2026 昼雨暗夜 · <a href="https://github.com/huimo-wuling">GitHub</a></p>
    </footer>

    <script src="../js/rain.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(STORIES_DIR, 'index.html'), indexHtml, 'utf8');

console.log('章节总数：', chapters.length);
console.log('生成文件：', files.join(', '));
console.log('已生成：', path.join(STORIES_DIR, 'index.html'));
