(() => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ヒーローの入場アニメーション(フォント読み込み後に開始してちらつきを避ける)
    const start = () => document.body.classList.add('is-ready');
    if (document.fonts && document.fonts.ready) {
        Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(start);
    } else {
        start();
    }

    // スクロール連動の出現
    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12 });
        reveals.forEach((el, i) => {
            // 同じグリッド内のカードは少しずつ時間差をつける
            el.style.transitionDelay = el.classList.contains('card') ? `${(i % 2) * 90}ms` : '0ms';
            io.observe(el);
        });
    } else {
        reveals.forEach((el) => el.classList.add('is-in'));
    }

    // 左レール: 進捗バーと現在のセクション番号
    const progress = document.querySelector('[data-progress]');
    const index = document.querySelector('[data-index]');
    const sections = document.querySelectorAll('[data-section]');

    const updateProgress = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
        if (progress) progress.style.transform = `scaleY(${ratio})`;
    };

    const updateIndex = () => {
        let current = sections[0];
        sections.forEach((section) => {
            if (section.getBoundingClientRect().top <= innerHeight * 0.4) current = section;
        });
        // ページ最下部ではフッターを現在地とする
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
            current = sections[sections.length - 1];
        }
        if (index && current) index.textContent = current.dataset.label;
    };

    let ticking = false;
    addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateProgress();
            updateIndex();
            ticking = false;
        });
    }, { passive: true });
    updateProgress();
    updateIndex();

    // ギャラリー: サムネイルで大きな1枚を切り替える
    document.querySelectorAll('[data-gallery]').forEach((gallery) => {
        const img = gallery.querySelector('.gallery-img');
        const caption = gallery.querySelector('.gallery-caption');
        const thumbs = [...gallery.querySelectorAll('.gallery-thumbs button')];
        const total = thumbs.length;

        thumbs.forEach((btn, i) => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('is-active')) return;
                thumbs.forEach((b) => {
                    b.classList.toggle('is-active', b === btn);
                    if (b === btn) b.setAttribute('aria-current', 'true');
                    else b.removeAttribute('aria-current');
                });
                caption.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(total).padStart(2, '0')} — `;
                caption.append(btn.dataset.caption);

                // 読み込みが済んでから差し替えて、白抜けを避ける
                const next = new Image();
                next.onload = next.onerror = () => {
                    img.classList.add('is-swapping');
                    setTimeout(() => {
                        img.src = btn.dataset.src;
                        img.alt = btn.dataset.alt;
                        img.classList.remove('is-swapping');
                    }, reduceMotion ? 0 : 200);
                };
                next.src = btn.dataset.src;
            });
        });
    });

    // 世代タブ(長い言葉のデータベース v1〜v3)
    document.querySelectorAll('[data-tabs]').forEach((list) => {
        const tabs = [...list.querySelectorAll('[role="tab"]')];

        const select = (tab, focus) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', on);
                t.tabIndex = on ? 0 : -1;
                document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
            });
            if (focus) tab.focus();
        };

        tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));

        list.addEventListener('keydown', (e) => {
            const i = tabs.indexOf(document.activeElement);
            if (i < 0) return;
            const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
            if (step) {
                e.preventDefault();
                select(tabs[(i + step + tabs.length) % tabs.length], true);
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                select(tabs[e.key === 'Home' ? 0 : tabs.length - 1], true);
            }
        });
    });

    // ヒーローの図形: マウス位置に合わせた軽い視差
    const hero = document.querySelector('.hero');
    if (hero && !reduceMotion && matchMedia('(hover: hover)').matches) {
        hero.addEventListener('pointermove', (e) => {
            const rect = hero.getBoundingClientRect();
            hero.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
            hero.style.setProperty('--my', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
        });
        hero.addEventListener('pointerleave', () => {
            hero.style.setProperty('--mx', 0);
            hero.style.setProperty('--my', 0);
        });
    }
})();
