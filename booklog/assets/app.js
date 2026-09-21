/* 蔵書目録 — 表示ロジック
   データは data/books.js が window.BOOKSHELF に入れておく。 */
(function () {
  'use strict';

  var DATA  = window.BOOKSHELF || { generated: '', books: [] };
  var BOOKS = DATA.books || [];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var pad = function (n) { return ('000' + n).slice(-3); };
  var dot = function (d) { return d ? d.replace(/-/g, '.') : ''; };
  var isRead = function (b) { return !!b.finished; };

  var FILTERS = [
    { key: 'all',     label: 'すべて',       test: function () { return true; } },
    { key: 'read',    label: '読了',         test: isRead },
    { key: 'unread',  label: '未読・読書中', test: function (b) { return !isRead(b); } },
    { key: 'paper',   label: '紙の本',       test: function (b) { return b.type === '本'; } },
    { key: 'ebook',   label: '電子書籍',     test: function (b) { return b.type === '電子書籍'; } },
    { key: 'nocover', label: '書影なし',     test: function (b) { return !b.cover; } }
  ];

  var SORTS = {
    finished:     function (a, b) { return (b.finished || '').localeCompare(a.finished || ''); },
    finished_asc: function (a, b) { return (a.finished || '9999').localeCompare(b.finished || '9999'); },
    title:        function (a, b) { return (a.kana || a.title).localeCompare(b.kana || b.title, 'ja'); },
    author:       function (a, b) { return (a.author || '').localeCompare(b.author || '', 'ja'); },
    rating:       function (a, b) { return (b.rating || 0) - (a.rating || 0); },
    reviews:      function (a, b) { return (b.rating_n || 0) - (a.rating_n || 0); },
    pages:        function (a, b) { return (+b.pages || 0) - (+a.pages || 0); },
    year:         function (a, b) { return (+b.year || 0) - (+a.year || 0); }
  };

  var state = { q: '', filter: 'all', genres: [], sort: 'finished', view: 'grid' };

  /* ---------- 配色 ---------- */
  (function theme() {
    var root = document.documentElement;
    try {
      var saved = localStorage.getItem('bookshelf-theme');
      if (saved) root.setAttribute('data-theme', saved);
    } catch (e) {}

    $('#themeBtn').addEventListener('click', function () {
      var now = root.getAttribute('data-theme');
      var dark = now ? now === 'dark'
                     : window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('bookshelf-theme', next); } catch (e) {}
    });
  }());

  /* ---------- フッターの件数 ---------- */
  (function footnote() {
    var years = BOOKS.map(function (b) { return b.finished ? b.finished.slice(0, 4) : ''; })
                     .filter(Boolean).sort();
    $('#footnote').innerHTML =
      '<b>' + BOOKS.length + '</b> VOLUMES' +
      (years.length ? ' / ' + years[0] + '–' + years[years.length - 1] : '') + '<br>' +
      (DATA.generated ? 'UPDATED <b>' + esc(dot(DATA.generated)) + '</b>' : '');
  }());

  /* ---------- 流れる書名 ---------- */
  (function ticker() {
    var recent = BOOKS.slice()
      .sort(SORTS.finished).slice(0, 24)
      .map(function (b) { return '<span>' + esc(b.title.replace(/\s*[（(].*$/, '')) + '</span><i>✳</i>'; })
      .join('');
    $('#tickerIn').innerHTML = recent + recent;   // 半分ずらして無限に流す
  }());

  /* ---------- ヒーローの期間 ---------- */
  (function period() {
    var el = $('#heroPeriod');
    if (!el) return;
    var ms = BOOKS.map(function (b) { return b.finished ? b.finished.slice(0, 7) : ''; })
                  .filter(Boolean).sort();
    if (!ms.length) return;
    var f = function (m) { return m.replace('-', '.'); };
    el.innerHTML = esc(f(ms[0])) + ' <em>→</em> ' + esc(f(ms[ms.length - 1]));
  }());

  /* ---------- 直近に読んだ1冊 ---------- */
  (function latest() {
    var el = $('#heroSide');
    if (!el) return;
    var b = BOOKS.slice().sort(SORTS.finished)[0];
    if (!b) return;
    el.innerHTML =
      '<span class="boxlabel">LATEST READ</span>' +
      '<button class="latest__card" type="button" data-id="' + esc(b.id) + '" aria-label="' + esc(b.title) + ' の詳細">' +
        '<span class="latest__cover">' +
          (b.cover ? '<img src="' + esc(b.cover) + '" alt="" decoding="async">'
                   : '<span class="card__noimg"><span class="mark">本</span></span>') +
        '</span>' +
        '<span class="latest__info">' +
          (b.finished ? '<span class="latest__date">' + dot(b.finished) + '</span>' : '') +
          '<span class="latest__title">' + esc(b.title) + '</span>' +
          '<span class="latest__author">' + esc(b.author) + '</span>' +
        '</span>' +
      '</button>';
  }());

  /* ---------- 書影カルーセル ---------- */
  (function reel() {
    var track = $('#reelTrack');
    if (!track) return;
    var pool = BOOKS.filter(function (b) { return b.cover; });
    for (var i = pool.length - 1; i > 0; i--) {        // 読み込むたびに並びを変える
      var r = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[r]; pool[r] = t;
    }
    var html = pool.slice(0, 30).map(function (b) {
      return '<button type="button" data-id="' + esc(b.id) + '" aria-label="' + esc(b.title) + ' の詳細">' +
               '<img src="' + esc(b.cover) + '" alt="" loading="lazy" decoding="async">' +
             '</button>';
    }).join('');
    track.innerHTML = html + html;   // 半分ずらして無限に流す
  }());

  /* ---------- 絞り込みボタン ---------- */
  /* ---------- ジャンル ---------- */
  var GENRE_SHOWN = 16;            // 初期表示数。残りは「+N」で開く
  var genreOpen = false;

  var GENRE_COUNT = (function () {
    var c = {};
    BOOKS.forEach(function (b) {
      (b.genres || []).forEach(function (g) { c[g] = (c[g] || 0) + 1; });
    });
    return Object.keys(c).map(function (g) { return { name: g, n: c[g] }; })
                 .sort(function (x, y) { return y.n - x.n || x.name.localeCompare(y.name, 'ja'); });
  }());

  function renderGenres() {
    var list = genreOpen ? GENRE_COUNT : GENRE_COUNT.slice(0, GENRE_SHOWN);
    // 選択中のものは隠れていても必ず出す
    state.genres.forEach(function (g) {
      if (!list.some(function (x) { return x.name === g; })) {
        var hit = GENRE_COUNT.filter(function (x) { return x.name === g; })[0];
        if (hit) list = list.concat([hit]);
      }
    });
    var html = list.map(function (g) {
      var on = state.genres.indexOf(g.name) !== -1;
      return '<button class="chip chip--g" type="button" data-genre="' + esc(g.name) + '" aria-pressed="' + on + '">' +
               '<b>' + esc(g.name) + '</b><i>' + g.n + '</i></button>';
    }).join('');
    var rest = GENRE_COUNT.length - GENRE_SHOWN;
    if (rest > 0) {
      html += '<button class="chip chip--g chip--more" type="button" data-genre-toggle>' +
              (genreOpen ? '閉じる' : '他 ' + rest + ' 件') + '</button>';
    }
    if (state.genres.length) {
      html += '<button class="chip chip--g chip--clear" type="button" data-genre-clear>× 解除</button>';
    }
    $('#genres').innerHTML = html;
  }

  FILTERS = FILTERS.filter(function (f) {
    if (f.key === 'all') return true;
    var n = BOOKS.filter(f.test).length;
    return n > 0 && n < BOOKS.length;   // 0件・全件の絞り込みは出さない
  });
  $('#filters').innerHTML = FILTERS.map(function (f) {
    return '<button class="chip" type="button" data-filter="' + f.key + '" aria-pressed="' +
           (f.key === state.filter) + '">' + f.label + '</button>';
  }).join('');

  function current() {
    var q = state.q.trim().toLowerCase();
    var f = FILTERS.filter(function (x) { return x.key === state.filter; })[0] || FILTERS[0];
    return BOOKS.filter(function (b) {
      if (!f.test(b)) return false;
      if (state.genres.length) {      // 選んだジャンルのいずれかを含む本（OR）
        var gs = b.genres || [];
        if (!state.genres.some(function (g) { return gs.indexOf(g) !== -1; })) return false;
      }
      if (!q) return true;
      return [b.title, b.author, b.publisher, b.kana, b.label, b.series,
              (b.genres || []).join(' '), (b.tags || []).join(' ')]
             .join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(SORTS[state.sort] || SORTS.finished);
  }

  /* ---------- 描画パーツ ---------- */
  function thumb(b, cls, no) {
    var inner = b.cover
      ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy" decoding="async">'
      : '<span class="card__noimg"><span class="mark">本</span><span class="txt">NO IMAGE</span></span>';
    return '<span class="' + cls + '">' + inner +
           (no ? '<span class="card__no">' + no + '</span>' : '') + '</span>';
  }

  function cardHTML(b, i) {
    var meta = b.finished ? dot(b.finished)
                          : '<span class="unread">' + esc(b.status || '未設定') + '</span>';
    return '<button class="card reveal" type="button" data-id="' + esc(b.id) +
             '" style="transition-delay:' + (i % 14) * 25 + 'ms">' +
             thumb(b, 'card__thumb', pad(i + 1)) +
             '<span class="card__body">' +
               (b.genres && b.genres.length
                 ? '<span class="card__genre"><span>' + esc(b.genres.slice(0, 2).join(' / ')) + '</span></span>' : '') +
               '<span class="card__title">' + esc(b.title) + '</span>' +
               '<span class="card__author">' + esc(b.author) + '</span>' +
               '<span class="card__meta">' + meta + (b.pages ? '  /  ' + esc(b.pages) + 'P' : '') + '</span>' +
             '</span>' +
           '</button>';
  }

  function rowHTML(b, i) {
    return '<button class="row reveal" type="button" data-id="' + esc(b.id) + '">' +
             '<span class="row__no">' + pad(i + 1) + '</span>' +
             thumb(b, 'row__thumb', '') +
             '<span class="row__main">' +
               '<span class="row__title">' + esc(b.title) + '</span>' +
               '<span class="row__author">' + esc(b.author) + '</span>' +
             '</span>' +
             '<span class="row__pub">' + esc(b.publisher) + (b.year ? '  ' + esc(b.year) : '') + '</span>' +
             '<span class="row__date">' +
               (b.finished ? dot(b.finished) : '<span class="unread">未読</span>') +
             '</span>' +
           '</button>';
  }

  function listHTML(list) {
    var grouped = state.sort === 'finished' || state.sort === 'finished_asc';
    var counts = {};
    if (grouped) {
      list.forEach(function (b) {
        var y = b.finished ? b.finished.slice(0, 4) : '未読・読書中';
        counts[y] = (counts[y] || 0) + 1;
      });
    }
    var out = '', prev = null;
    list.forEach(function (b, i) {
      if (grouped) {
        var y = b.finished ? b.finished.slice(0, 4) : '未読・読書中';
        if (y !== prev) {
          out += '<div class="list__group"><h3>' + esc(y) + '</h3><span>' + counts[y] + ' VOLUMES</span></div>';
          prev = y;
        }
      }
      out += rowHTML(b, i);
    });
    return out;
  }

  /* ---------- ポジショニングマップ ---------- */
  var AXES = {
    depth:      { lo: '気軽に楽しむ',   hi: 'じっくり考える', step: true, fix: [1, 5],
                  get: function (b) { return b.axes && b.axes.depth; } },
    weight:     { lo: '読後感が軽い',   hi: '読後感が重い', step: true, fix: [1, 5],
                  get: function (b) { return b.axes && b.axes.weight; } },
    difficulty: { lo: 'すらすら読める', hi: '前提知識が要る', step: true, fix: [1, 5],
                  get: function (b) { return b.axes && b.axes.difficulty; } },
    rating:     { lo: '評価が低い',     hi: '評価が高い',
                  get: function (b) { return b.rating; } },
    reviews:    { lo: 'レビューが少ない', hi: 'レビューが多い', log: true,
                  get: function (b) { return b.rating_n; } },
    pages:      { lo: 'ページ数が少ない', hi: 'ページ数が多い',
                  get: function (b) { return +b.pages || null; } },
    year:       { lo: '出版が古い',     hi: '出版が新しい',
                  get: function (b) { return +b.year || null; } },
    finished:   { lo: '読んだのが昔',   hi: '読んだのが最近',
                  get: function (b) { return b.finished ? +b.finished.replace(/-/g, '') : null; } }
  };

  var mapState = { x: 'depth', y: 'weight', n: 30 };
  var mapSig = '';   // 描き直しが要るかの判定用

  // 軸の最小・最大。1〜5 の評価軸は尺度が決まっているので固定し、
  // 連続値（評価・ページ数など）だけ「いま描いている本」に合わせる。
  function rangeOf(key, list) {
    var fix = AXES[key].fix;
    if (fix) return { min: fix[0], max: fix[1], raw: { min: fix[0], max: fix[1] } };

    var vs = [];
    list.forEach(function (b) {
      var v = AXES[key].get(b);
      if (typeof v === 'number' && !isNaN(v)) vs.push(v);
    });
    if (!vs.length) return null;
    var raw = { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs) };
    if (AXES[key].log) {
      vs = vs.map(function (v) { return Math.log10(Math.max(v, 1)); });
      return { min: Math.min.apply(null, vs), max: Math.max.apply(null, vs), raw: raw };
    }
    return { min: raw.min, max: raw.max, raw: raw };
  }

  function axisPos(key, b, r) {
    if (!r) return null;
    var v = AXES[key].get(b);
    if (typeof v !== 'number' || isNaN(v)) return null;
    if (AXES[key].log) v = Math.log10(Math.max(v, 1));
    return r.max === r.min ? 0.5 : (v - r.min) / (r.max - r.min);
  }

  // 離散軸のばらつき幅。1目盛の9割ぶんを正規化座標に直す
  function jitterOf(key, r) {
    if (!AXES[key].step || !r) return 0;
    var span = r.raw.max - r.raw.min;
    return span > 0 ? 0.9 / span : 0;
  }

  // 点の大きさ。冊数が少ないほど大きく、画面が狭いほど小さく
  function ptSize(n, w) {
    var base = n <= 30 ? 46 : n <= 60 ? 36 : n <= 100 ? 30 : 24;
    var k = Math.pow(Math.min(1, w / 1100), 0.55);   // 幅なりに縮めるが効きは緩やかに
    return Math.max(16, Math.round(base * k));
  }

  // 1〜5 の離散軸は同じ座標に重なるので、IDから決まる量だけずらす
  function hash01(str, salt) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    h = (h ^ (salt * 2654435761)) >>> 0;
    return (h % 1000) / 1000;
  }

  // X も Y も「lo ↔ hi」で統一する（Y は左辺を90°回して下から上へ読ませる）
  function axisText(k) { return AXES[k].lo + ' ↔ ' + AXES[k].hi; }

  (function fillAxisSelects() {
    var opts = Object.keys(AXES).map(function (k) {
      return '<option value="' + k + '">' + axisText(k) + '</option>';
    }).join('');
    $('#mapX').innerHTML = opts;
    $('#mapY').innerHTML = opts;
    $('#mapX').value = mapState.x; $('#mapY').value = mapState.y;
  }());

  function renderMap(full) {
    var kx = mapState.x, ky = mapState.y;
    $('#mapAxisX').innerHTML = esc(AXES[kx].lo) + ' <em>↔</em> ' + esc(AXES[kx].hi);
    $('#mapAxisY').innerHTML = esc(AXES[ky].lo) + ' <em>↔</em> ' + esc(AXES[ky].hi);

    // 並び順の上位から、指定された冊数だけ取る（0 = すべて）
    var list = mapState.n ? full.slice(0, mapState.n) : full;

    var plot = $('#mapPlot');

    // 描く本だけで軸の範囲を決める
    var rx = rangeOf(kx, list), ry = rangeOf(ky, list);
    var jx = jitterOf(kx, rx), jy = jitterOf(ky, ry);

    var sig = list.map(function (b) { return b.id; }).join(',');

    if (sig !== mapSig) {                       // 対象が変わったときだけ組み直す
      mapSig = sig;
      plot.innerHTML = list.map(function (b, i) {
        return '<button class="pt pt--in" type="button" data-id="' + esc(b.id) + '"' +
                 ' style="animation-delay:' + (i % 30) * 12 + 'ms"' +
                 ' aria-label="' + esc(b.title) + '">' +
                 (b.cover ? '<img src="' + esc(b.cover) + '" alt="" decoding="async">' : '') +
               '</button>';
      }).join('');
    }

    // 冊数と実寸から点の大きさを決める
    var w = plot.clientWidth || 900;
    var size = ptSize(list.length, w);
    plot.style.setProperty('--pt-w', size + 'px');
    plot.style.setProperty('--pt-zoom', (Math.max(1.6, 96 / size)).toFixed(2));

    // 座標は毎回入れ直す。left/top に transition が効いて軸切替が動きになる
    var els = plot.children, shown = 0, skipped = 0;
    list.forEach(function (b, i) {
      var el = els[i];
      if (!el) return;
      var px = axisPos(kx, b, rx), py = axisPos(ky, b, ry);
      if (px === null || py === null) { el.hidden = true; skipped++; return; }
      // 同じ軸を縦横に選んだときは種を揃える。
      // 種が違うと縦横で別方向にずれ、本来一直線に並ぶはずの点が崩れる。
      if (jx) px += (hash01(b.id, 1) - 0.5) * jx;
      if (jy) py += (hash01(b.id, kx === ky ? 1 : 2) - 0.5) * jy;
      px = Math.min(1, Math.max(0, px));
      py = Math.min(1, Math.max(0, py));
      el.hidden = false;
      el.style.transitionDelay = (i % 30) * 8 + 'ms';
      el.style.left = (5 + px * 90).toFixed(2) + '%';
      el.style.top  = (95 - py * 90).toFixed(2) + '%';
      shown++;
    });

    $('#mapNote').textContent =
      shown + ' / ' + full.length + ' PLOTTED' +
      (skipped ? '　/　' + skipped + '冊は値なし' : '');
  }

  function changeAxis(which, value) {
    mapState[which] = value;
    // 対象は変わらないので組み直さず、座標だけ動かす
    renderMap(current());
  }
  $('#mapX').addEventListener('change', function (e) { changeAxis('x', e.target.value); });
  $('#mapY').addEventListener('change', function (e) { changeAxis('y', e.target.value); });
  $('#mapN').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-n]');
    if (!btn) return;
    mapState.n = +btn.dataset.n;
    Array.prototype.forEach.call(this.querySelectorAll('[data-n]'), function (c2) {
      c2.setAttribute('aria-pressed', String(c2 === btn));
    });
    render();
  });

  // 共有の吹き出し
  (function tip() {
    var tipEl = $('#mapTip'), plot = $('#mapPlot'), frame = plot.parentNode;

    function show(pt) {
      var b = BOOKS.filter(function (x) { return x.id === pt.dataset.id; })[0];
      if (!b) return;
      tipEl.textContent = b.title;
      tipEl.hidden = false;
      var fr = frame.getBoundingClientRect(), pr = pt.getBoundingClientRect();
      var x = pr.left + pr.width / 2 - fr.left;
      var y = pr.top - fr.top - 6;
      var half = tipEl.offsetWidth / 2;
      x = Math.max(half + 8, Math.min(fr.width - half - 8, x));   // 枠からはみ出させない
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    }
    function hide() { tipEl.hidden = true; }

    plot.addEventListener('mouseover', function (e) {
      var pt = e.target.closest('.pt'); if (pt) show(pt);
    });
    plot.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.pt')) hide();
    });
    plot.addEventListener('focusin', function (e) {
      var pt = e.target.closest('.pt'); if (pt) show(pt);
    });
    plot.addEventListener('focusout', hide);
    // 位置は枠に対する相対値なので、スクロールしてもずれない（hide 不要）
  }());

  var mapResize;
  window.addEventListener('resize', function () {
    if (state.view !== 'map') return;
    clearTimeout(mapResize);
    mapResize = setTimeout(function () { renderMap(current()); }, 150);
  });

  /* ---------- 積読タイムライン ---------- */
  var TL = window.TIMELINE || { months: [], books: [] };
  var MI = {};                                  // 月 → 何番目か
  TL.months.forEach(function (m, i) { MI[m] = i; });
  var MLAST = TL.months.length - 1;

  var mpos = function (m) { return MLAST > 0 ? MI[m] / MLAST : 0; };   // 0〜1

  // 行のバー領域（書名欄の右）に対する x 座標。CSS 変数と揃えておく
  function TRACK_AT(p) {
    return 'calc(var(--tl-padl) + var(--tl-name) + var(--tl-gap)' +
           ' + (100% - var(--tl-padl) - var(--tl-name) - var(--tl-gap) - var(--tl-padr)) * ' +
           p.toFixed(4) + ')';
  }
  var mlabel = function (m) { return m ? m.replace('-', '.') : '—'; };

  function monthsBetween(a, b) {
    if (!a || !b) return null;
    return (MI[b] - MI[a]);
  }

  // 月ごとの購入数・読了数。下のバーと同じ mpos に載せて時間軸を揃える
  (function flow() {
    var el = $('#tlFlow');
    if (!el || !TL.months.length) return;
    var buy = {}, read = {};
    TL.books.forEach(function (r) {
      if (r.b) buy[r.b] = (buy[r.b] || 0) + 1;
      if (r.r) read[r.r] = (read[r.r] || 0) + 1;
    });
    var max = 1;
    TL.months.forEach(function (m) { max = Math.max(max, buy[m] || 0, read[m] || 0); });

    var w = MLAST > 0 ? 100 / MLAST * 0.66 : 8;      // 1か月ぶんの幅（%）
    el.innerHTML = TL.months.map(function (m) {
      var b = buy[m] || 0, r = read[m] || 0;
      return '<div style="left:' + (mpos(m) * 100).toFixed(3) + '%;width:' + w.toFixed(3) +
               '%;margin-left:' + (-w / 2).toFixed(3) + '%"' +
               ' title="' + esc(mlabel(m)) + '　購入 ' + b + ' / 読了 ' + r + '">' +
               (b ? '<i class="up" style="height:' + (b / max * 48).toFixed(1) + '%"></i>' : '') +
               (r ? '<i class="down" style="height:' + (r / max * 48).toFixed(1) + '%"></i>' : '') +
             '</div>';
    }).join('');
  }());

  // 年の目盛り
  (function grid() {
    var head = $('#tlHead'), gridEl = $('#tlGrid');
    if (!head || !TL.months.length) return;
    var h = '', g = '';
    TL.months.forEach(function (m, i) {
      if (m.slice(5) !== '01' && i !== 0) return;
      var left = (mpos(m) * 100).toFixed(2) + '%';
      // 左のタイトル欄ぶんを避けて目盛りを置く（欄幅は CSS 変数で画面幅に追従）
      var at = TRACK_AT(mpos(m));
      h += '<span style="left:' + at + '">' + m.slice(0, 4) + '</span>';
      g += '<i style="left:' + at + '"></i>';
    });
    head.innerHTML = h;
    gridEl.innerHTML = g;
  }());

  function renderTimeline() {
    var rows = TL.books;

    // 絞り込みは一覧と同じ current() の結果に合わせる。
    // 蔵書に無い行（9件）だけは書名の一致で判定する。
    var q = state.q.trim().toLowerCase();
    var narrowed = state.genres.length || state.filter !== 'all' || q;
    var allow = null;
    if (narrowed) {
      allow = {};
      current().forEach(function (b) { allow[b.id] = 1; });
    }
    rows = rows.filter(function (r) {
      if (!allow) return true;
      if (r.id) return !!allow[r.id];
      return !!q && r.t.toLowerCase().indexOf(q) !== -1;
    });

    var html = rows.map(function (r) {
      var bar = '', dots = '';
      if (r.b && r.r) {
        var x1 = mpos(r.b) * 100, x2 = mpos(r.r) * 100;
        bar = '<span class="tlrow__bar" style="left:' + x1.toFixed(2) + '%;width:' +
              Math.max(0.4, x2 - x1).toFixed(2) + '%"></span>';
        dots = '<span class="tlrow__dot" style="left:' + x1.toFixed(2) + '%"></span>' +
               '<span class="tlrow__dot tlrow__dot--r" style="left:' + x2.toFixed(2) + '%"></span>';
      } else if (r.b) {                       // 積んだまま
        var xb = mpos(r.b) * 100;
        bar = '<span class="tlrow__bar tlrow__bar--open" style="left:' + xb.toFixed(2) +
              '%;width:' + Math.max(2, 100 - xb).toFixed(2) + '%"></span>';
        dots = '<span class="tlrow__dot" style="left:' + xb.toFixed(2) + '%"></span>';
      } else if (r.r) {                       // 購入日不明
        dots = '<span class="tlrow__dot tlrow__dot--r" style="left:' + (mpos(r.r) * 100).toFixed(2) + '%"></span>';
      }
      return '<button class="tlrow' + (r.id ? '' : ' tlrow--x') + '" type="button"' +
               (r.id ? ' data-id="' + esc(r.id) + '"' : '') +
               ' data-b="' + esc(r.b || '') + '" data-r="' + esc(r.r || '') + '"' +
               ' data-t="' + esc(r.t) + '">' +
               '<span class="tlrow__t">' + esc(r.t) + '</span>' +
               '<span class="tlrow__track">' + bar + dots + '</span>' +
             '</button>';
    }).join('');

    $('#tlRows').innerHTML = html;

    $('#tlNote').textContent =
      rows.length + ' / ' + TL.books.length + ' BOOKS　/　' +
      (TL.months[0] || '').replace('-', '.') + '–' + (TL.months[MLAST] || '').replace('-', '.');
  }

  // 絞り込みバーの実寸を CSS 変数へ。タイムラインの固定ヘッダがこの下に付く
  (function controlsHeight() {
    var el = document.querySelector('.controls');
    if (!el) return;
    var apply = function () {
      document.documentElement.style.setProperty(
        '--controls-h', Math.round(el.getBoundingClientRect().height) + 'px');
    };
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(el);
    else window.addEventListener('resize', apply);
  }());

  // 横スクロールを固定ヘッダに転写する
  (function syncHead() {
    var sc = $('#tlScroll'), inner = $('#tlFixedInner');
    if (!sc || !inner) return;
    sc.addEventListener('scroll', function () {
      inner.style.transform = 'translateX(' + (-sc.scrollLeft) + 'px)';
    }, { passive: true });
  }());

  // タイムラインの吹き出し
  (function tlTip() {
    var rowsEl = $('#tlRows'), tip = $('#tlTip');
    if (!rowsEl) return;
    rowsEl.addEventListener('mousemove', function (e) {
      var row = e.target.closest('.tlrow');
      if (!row) { tip.hidden = true; return; }
      var span = (row.dataset.b && row.dataset.r) ? monthsBetween(row.dataset.b, row.dataset.r) : null;
      tip.innerHTML = esc(row.dataset.t) + '<br>' +
        '購入 ' + mlabel(row.dataset.b) + '　読了 ' + mlabel(row.dataset.r) +
        (span !== null ? '　（' + span + 'か月）' : '');
      tip.hidden = false;
      tip.style.left = e.clientX + 'px';
      tip.style.top = e.clientY + 'px';
    });
    rowsEl.addEventListener('mouseleave', function () { tip.hidden = true; });
  }());

  /* ---------- 登場アニメーション ---------- */
  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -6% 0px' })
    : null;

  function observe(root) {
    var items = root.querySelectorAll('.reveal');
    Array.prototype.forEach.call(items, function (el) {
      if (io) io.observe(el); else el.classList.add('is-in');
    });
  }

  /* ---------- 描画 ---------- */
  var grid = $('#grid'), listEl = $('#list'), mapEl = $('#map'), tlEl = $('#tl'), empty = $('#empty');

  function render() {
    var list = current();
    var v = state.view;

    grid.hidden   = v !== 'grid';
    listEl.hidden = v !== 'list';
    mapEl.hidden  = v !== 'map';
    tlEl.hidden   = v !== 'tl';
    empty.hidden  = list.length > 0 || v === 'tl';

    if (v === 'grid')      { grid.innerHTML = list.map(cardHTML).join(''); observe(grid); }
    else if (v === 'list') { listEl.innerHTML = listHTML(list); observe(listEl); }
    else if (v === 'map')  { renderMap(list); }
    else                   { renderTimeline(); }

    var label = (FILTERS.filter(function (f) { return f.key === state.filter; })[0] || {}).label;
    $('#meta').textContent = list.length + ' / ' + BOOKS.length + '　' + label +
                             (state.genres.length ? '　' + state.genres.join(' + ') : '') +
                             (state.q ? '　“' + state.q + '”' : '');
    $('#topcount').textContent = list.length + ' / ' + BOOKS.length;
  }

  /* ---------- 詳細 ---------- */
  var sheet = $('#sheet'), sheetBody = $('#sheetBody'), lastFocus = null, sheetTimer = null;

  function spec(rows) {
    var body = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');
    return body ? '<dl class="spec">' + body + '</dl>' : '';
  }

  function openSheet(id) {
    var b = BOOKS.filter(function (x) { return x.id === id; })[0];
    if (!b) return;

    var tags = [].concat(
      (b.genres || []).map(function (g) { return '<span class="boxlabel">' + esc(g) + '</span>'; }),
      (b.awards || []).map(function (a) { return '<span class="boxlabel is-fill">' + esc(a) + '</span>'; }),
      [b.finished ? '<span class="boxlabel is-soft">読了 ' + esc(dot(b.finished)) + '</span>' : ''],
      [b.type ? '<span class="boxlabel is-soft">' + esc(b.type) + '</span>' : ''],
      [b.series ? '<span class="boxlabel is-soft">' + esc(b.series) + '</span>' : ''],
      (b.tags || []).slice(0, 5).map(function (t) { return '<span class="boxlabel is-soft">' + esc(t) + '</span>'; })
    ).join('');

    // ブクログの平均評価
    var rating = '';
    if (b.rating) {
      var full = Math.round(b.rating);
      rating = '<div class="sheet__rating">' +
                 '<span class="sheet__stars">' +
                   new Array(full + 1).join('★') + new Array(6 - full).join('☆') +
                 '</span>' +
                 '<span class="sheet__score">' + b.rating.toFixed(2) + '<small>/5</small></span>' +
                 '<span class="sheet__rcount">' +
                   (b.rating_n ? b.rating_n.toLocaleString('en-US') + ' REVIEWS' : '') +
                   ' · ' + (b.rating_src || 'ブクログ') +
                 '</span>' +
               '</div>';
    }


    $('#sheetNo').textContent = (b.isbn ? 'ISBN ' + b.isbn : 'ID ' + b.id);
    sheetBody.innerHTML =
      '<div class="sheet__cover">' +
        (b.cover ? '<img src="' + esc(b.cover) + '" alt="">'
                 : '<span class="card__noimg"><span class="mark">本</span><span class="txt">NO IMAGE</span></span>') +
      '</div>' +
      '<div class="sheet__info">' +
      (b.kana ? '<p class="sheet__kana">' + esc(b.kana) + '</p>' : '') +
      '<h2 class="sheet__title" id="sheetTitle">' + esc(b.title) + '</h2>' +
      '<p class="sheet__author">' + esc(b.author) + '</p>' +
      rating +
      '<div class="sheet__tags">' + tags + '</div>' +
      (b.desc ? '<p class="sheet__desc">' + esc(b.desc) + '</p>' : '') +
      spec([
        ['PUBLISHER', b.publisher],
        ['YEAR',      b.year],
        ['PAGES',     b.pages ? b.pages + 'p' : ''],
        ['PRICE',     b.price ? '¥' + Number(b.price).toLocaleString('en-US') : ''],
        ['LABEL',     b.label],
        ['SERIES',    b.series],
        ['ISBN',      b.isbn],
        ['ID',        b.id]
      ]) +
      '</div>';

    clearTimeout(sheetTimer);          // 閉じかけのタイマーが後から hidden に戻すのを防ぐ
    lastFocus = document.activeElement;
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    sheetBody.scrollTop = 0;
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
    $('.sheet__close', sheet).focus();
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    sheetTimer = window.setTimeout(function () { sheet.hidden = true; }, 340);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- イベント ---------- */
  $('#q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('#sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });

  $('#filters').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    Array.prototype.forEach.call(this.children, function (c) {
      c.setAttribute('aria-pressed', String(c === btn));
    });
    render();
  });

  $('#genres').addEventListener('click', function (e) {
    if (e.target.closest('[data-genre-toggle]')) { genreOpen = !genreOpen; renderGenres(); return; }
    if (e.target.closest('[data-genre-clear]')) { state.genres = []; renderGenres(); render(); return; }
    var btn = e.target.closest('[data-genre]');
    if (!btn) return;
    var g = btn.dataset.genre, i = state.genres.indexOf(g);
    if (i === -1) state.genres.push(g); else state.genres.splice(i, 1);
    renderGenres();
    render();
  });

  document.querySelector('.viewtoggle').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.view = btn.dataset.view;
    Array.prototype.forEach.call(this.children, function (c) {
      c.setAttribute('aria-pressed', String(c === btn));
    });
    render();
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    var hit = e.target.closest('.card, .row, .reel__track button, .latest__card, .pt, .tlrow[data-id]');
    if (hit) openSheet(hit.dataset.id);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
    if (e.key === '/' && sheet.hidden && document.activeElement !== $('#q')) {
      e.preventDefault(); $('#q').focus();
    }
  });

  renderGenres();
  render();
}());
