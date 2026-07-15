// V301: collect book source lookup page.
(function(){
  const DATA_URL = 'data/collectbook_sources.json';
  const GROUP_SIZE = 96;
  const labels = {
    weapon: '武防出處',
    artifact: '法器出處',
    recipe: '配方出處',
    beast: '封獸出處'
  };
  const state = {
    data: null,
    loading: null,
    active: 'weapon',
    composing: false,
    query: { weapon: '', artifact: '', recipe: '', beast: '' },
    category: { weapon: 'all', artifact: 'all', recipe: 'all', beast: 'all' },
    segment: { weapon: 'all', artifact: 'all', recipe: 'all', beast: 'all' },
    sourceFilter: {
      weapon: { task: false, shop: false },
      artifact: { task: false, shop: false },
      recipe: { task: false, shop: false }
    }
  };

  function by(id){ return document.getElementById(id); }
  function escHtml(value){
    if(typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function textList(values, emptyText){
    const list = (values || []).filter(Boolean);
    return list.length ? list.map(x => `<span class="collectTag">${escHtml(x)}</span>`).join('') : `<span class="muted">${escHtml(emptyText || '-')}</span>`;
  }
  function normDropName(value){
    return String(value || '')
      .replace(/[\s\[\]【】<>＜＞「」『』《》〈〉（）()◢◣◥◤▾▴▸◂▼▲◆◇■□★☆‧·．・]/g, '')
      .trim();
  }
  function dropList(excelDrops, reverseDrops, emptyText){
    const reverse = reverseDrops || [];
    const usedReverse = new Set();
    const rows = [];
    function reverseMatches(name){
      const key = normDropName(name);
      if(!key) return [];
      return reverse.map((d, index) => ({ d, index })).filter(({ d }) => {
        const other = normDropName(d.monster);
        return other && (other === key || other.includes(key) || key.includes(other));
      });
    }
    (excelDrops || []).forEach(name => {
      const matches = reverseMatches(name);
      if(matches.length){
        matches.forEach(({ d, index }) => {
          usedReverse.add(index);
          rows.push({ name: d.monster || name, locations: d.locations || [], level: d.level || '', rate: d.rate, fromReverse: true });
        });
      }else{
        rows.push({ name, locations: [] });
      }
    });
    reverse.forEach((d, index) => {
      if(usedReverse.has(index)) return;
      rows.push({ name: d.monster || '', locations: d.locations || [], level: d.level || '', rate: d.rate, fromReverse: true });
    });
    const uniqRows = [];
    const seen = new Set();
    rows.forEach(row => {
      const name = String(row.name || '').trim();
      if(!name) return;
      const key = name + '|' + (row.locations || []).join('、') + '|' + (row.level || '') + '|' + (row.rate ?? '');
      if(seen.has(key)) return;
      seen.add(key);
      uniqRows.push({ name, locations: row.locations || [], level: row.level || '', rate: row.rate });
    });
    uniqRows.sort((a,b) => {
      const ar = Number(a.rate);
      const br = Number(b.rate);
      const ah = Number.isFinite(ar);
      const bh = Number.isFinite(br);
      if(ah && bh && br !== ar) return br - ar;
      if(ah !== bh) return ah ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'zh-Hant');
    });
    if(!uniqRows.length) return `<span class="muted">${escHtml(emptyText || '-')}</span>`;
    return `<div class="collectDropList">${uniqRows.map(row => {
      const loc = (row.locations || []).filter(Boolean).join('、');
      const meta = [];
      if(row.rate !== undefined && row.rate !== null && row.rate !== '') meta.push(Number(row.rate).toFixed(6) + '%');
      return `<div class="collectDropItem"><span class="collectDropName">${escHtml(row.name)}</span>${meta.length ? `<span class="collectDropInfo">${escHtml(meta.join('｜'))}</span>` : ''}${loc ? `<span class="collectDropLoc">${escHtml(loc)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function dropLocationText(row){
    if(row.kind === 'beast') return textList(row.locations, '沒有捕抓地點');
    const shopSet = new Set(row.shops || []);
    const drops = (row.excelSources || []).filter(x => !shopSet.has(x));
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const dropCount = reverseCount || drops.length;
    if(!dropCount) return '<span class="muted">沒有掉落位置</span>';
    if(!row.itemId) return dropList(drops, row.reverseDrops || [], '沒有掉落位置');
    return `<div class="collectDropSummary">
      <button class="collectReverseBtn primary" type="button" data-collect-reverse="${escHtml(row.itemId)}">查看掉落資訊<small>共 ${dropCount} 筆掉落資料</small></button>
    </div>`;
  }
  function formatRate(value){
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(6) + '%' : '-';
  }
  function getItemName(item){
    return String(item?.name || item?.Name || '').trim();
  }
  function getItemId(item){
    return String(item?.id || item?.ID || '').trim();
  }
  function getDropMonsterName(drop){
    return String(drop?.monsterName || drop?.monster?.Name || drop?.monster || '').trim();
  }
  function getDropMonsterLevel(drop){
    return String(drop?.monster?.Level || drop?.level || '').trim();
  }
  function getDropMonsterLocations(drop){
    if(Array.isArray(drop?.locations) && drop.locations.length) return drop.locations.filter(Boolean);
    const name = getDropMonsterName(drop);
    try{
      const loc = typeof locOf === 'function' ? locOf(name) : '';
      return loc ? [loc] : [];
    }catch(e){
      return [];
    }
  }
  async function enrichCollectSourceDrops(row){
    if(!row || row._sourceDropsReady) return row;
    const reverseRows = Array.isArray(row.reverseDrops) ? row.reverseDrops : [];
    const needNames = reverseRows
      .filter(drop => !getDropMonsterLocations(drop).length)
      .map(drop => getDropMonsterName(drop))
      .filter(Boolean);
    if(!needNames.length){
      row._sourceDropsReady = true;
      return row;
    }
    try{
      const [itemData, reverseData, monsterData] = await Promise.all([
        typeof loadDataBundle === 'function' ? loadDataBundle('items') : null,
        typeof loadDataBundle === 'function' ? loadDataBundle('drop_reverse') : null,
        typeof loadDataBundle === 'function' ? loadDataBundle('monsters') : null
      ]);
      const itemList = Array.isArray(itemData) ? itemData : [];
      const reverseIndex = reverseData && typeof reverseData === 'object' ? reverseData : {};
      const monsterById = {};
      (Array.isArray(monsterData) ? monsterData : []).forEach(monster => {
        const id = String(monster?.ID || monster?.id || '').trim();
        if(id) monsterById[id] = monster;
      });
      const sourceDropsByName = {};
      const sourceItemIdsByName = {};
      needNames.forEach(name => {
        const item = itemList.find(it => getItemName(it) === name);
        const id = getItemId(item);
        const drops = id ? (reverseIndex[id] || []) : [];
        if(!drops.length) return;
        sourceItemIdsByName[name] = id;
        sourceDropsByName[name] = drops.map(drop => {
          const monster = monsterById[String(drop?.monsterId || '').trim()] || drop?.monster || null;
          const enriched = Object.assign({}, drop, { monster });
          return {
            monster: getDropMonsterName(enriched),
            level: getDropMonsterLevel(enriched),
            rate: drop?.rate,
            locations: getDropMonsterLocations(enriched)
          };
        }).filter(drop => drop.monster);
      });
      row.sourceDropsByName = sourceDropsByName;
      row.sourceItemIdsByName = sourceItemIdsByName;
    }catch(e){
      row.sourceDropsByName = {};
      row.sourceItemIdsByName = {};
    }
    row._sourceDropsReady = true;
    return row;
  }
  function findCollectRow(itemId){
    const id = String(itemId || '');
    const kinds = [state.active, 'weapon', 'artifact', 'recipe'].filter((kind, index, arr) => kind && arr.indexOf(kind) === index);
    for(const kind of kinds){
      const row = getRows(kind).find(item => String(item.itemId || '') === id);
      if(row) return row;
    }
    return null;
  }
  function collectDropDetailRows(row){
    const reverse = Array.isArray(row?.reverseDrops) ? row.reverseDrops : [];
    if(reverse.length){
      return `<div class="tableWrap monsterDropTable collectDropDetailTable"><table>
        <thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead>
        <tbody>${reverse.map(drop => `<tr>
          <td>${escHtml(drop.monster || '-')}</td>
          <td>${escHtml((drop.locations || []).filter(Boolean).join('、') || '沒有位置資料')}</td>
          <td>${escHtml(formatRate(drop.rate))}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
    const shopSet = new Set(row?.shops || []);
    const drops = (row?.excelSources || []).filter(x => !shopSet.has(x));
    return drops.length
      ? `<div class="tableWrap monsterDropTable collectDropDetailTable"><table><thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead><tbody>${drops.map(name => `<tr><td>${escHtml(name)}</td><td>-</td><td>-</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">沒有掉落資料</div>';
  }
  function renderCollectDropDetail(itemId){
    const row = findCollectRow(itemId);
    const reader = by('reader');
    if(!reader) return;
    if(!row){
      reader.innerHTML = '<section class="card collectPage"><button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button><div class="empty">找不到這筆掉落資料</div></section>';
      return;
    }
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const shopSet = new Set(row.shops || []);
    const dropCount = reverseCount || (row.excelSources || []).filter(x => !shopSet.has(x)).length;
    reader.innerHTML = `<section class="card collectPage collectDropDetailPage">
      <button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button>
      <h1>${escHtml(row.name || '-')}</h1>
      <p class="muted collectDropDetailMetaLine">掉落反查｜共 ${dropCount} 筆</p>
      <div class="collectDropDetailList">${collectDropDetailRows(row)}</div>
    </section>`;
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function collectDropDetailRows(row){
    const reverse = Array.isArray(row?.reverseDrops) ? row.reverseDrops : [];
    if(reverse.length){
      return `<div class="collectReverseCompactList">${reverse.map(drop => {
          const sourceDrops = (row.sourceDropsByName || {})[drop.monster] || [];
          const sourceItemId = (row.sourceItemIdsByName || {})[drop.monster] || '';
          const loc = (drop.locations || []).filter(Boolean).join('、');
          const hasNested = sourceDrops.length && sourceItemId;
          return `<div class="collectReverseCompactRow">
            <div class="collectReverseCompactMain">
              <div class="collectReverseCompactName">${escHtml(drop.monster || '-')}</div>
              ${hasNested
                ? `<button type="button" class="collectNestedReverseBtn" data-collect-nested-reverse="${escHtml(sourceItemId)}" data-collect-parent="${escHtml(row.itemId || '')}">掉落位置</button>`
                : `<div class="collectReverseCompactLoc">${loc ? escHtml(loc) : '<span class="muted">沒有位置資料</span>'}</div>`}
            </div>
            <div class="collectReverseCompactRate">${escHtml(formatRate(drop.rate))}</div>
          </div>`;
        }).join('')}</div>`;
    }
    const shopSet = new Set(row?.shops || []);
    const drops = (row?.excelSources || []).filter(x => !shopSet.has(x));
    return drops.length
      ? `<div class="tableWrap monsterDropTable collectDropDetailTable"><table><thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead><tbody>${drops.map(name => `<tr><td>${escHtml(name)}</td><td>-</td><td>-</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">沒有掉落資料</div>';
  }
  async function renderCollectDropDetail(itemId){
    const row = findCollectRow(itemId);
    const reader = by('reader');
    if(!reader) return;
    if(!row){
      reader.innerHTML = '<section class="card collectPage"><button class="backBtn" type="button" data-collect-back>返回武冠系統</button><div class="empty">找不到掉落資料</div></section>';
      return;
    }
    await enrichCollectSourceDrops(row);
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const shopSet = new Set(row.shops || []);
    const dropCount = reverseCount || (row.excelSources || []).filter(x => !shopSet.has(x)).length;
    reader.innerHTML = `<section class="card collectPage collectDropDetailPage">
      <button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button>
      <h1>${escHtml(row.name || '-')}</h1>
      <p class="muted collectDropDetailMetaLine">掉落反查｜共 ${dropCount} 筆</p>
      <div class="collectDropDetailList">${collectDropDetailRows(row)}</div>
    </section>`;
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function taskText(row){
    if(!row.taskFlag) return '<span class="muted">-</span>';
    return row.taskNames && row.taskNames.length ? textList(row.taskNames) : '<span class="collectTag">任務取得</span>';
  }
  function beastSkillChecks(row){
    const enabled = new Set(row.skills || []);
    return `<div class="beastSkillChecks">
      ${['迷惑術','奪心術','縛靈術'].map(name => `<span class="beastSkill ${enabled.has(name) ? 'on' : 'off'}"><span class="beastCheckMark">${enabled.has(name) ? '✓' : ''}</span>${escHtml(name)}</span>`).join('')}
    </div>`;
  }
  function getRows(kind){
    const data = state.data || {};
    return Array.isArray(data[kind]) ? data[kind] : [];
  }
  function categories(kind){
    const rows = getRows(kind);
    if(kind === 'beast'){
      const ordered = [];
      rows.forEach(row => {
        if(row.category && !ordered.includes(row.category)) ordered.push(row.category);
      });
      return ordered;
    }
    if(kind !== 'weapon') return [];
    const exists = new Set(rows.map(row => row.category).filter(Boolean));
    const ordered = Array.isArray(state.data?.meta?.weaponCategoryOrder) ? state.data.meta.weaponCategoryOrder.filter(cat => exists.has(cat)) : [];
    rows.forEach(row => {
      if(row.category && !ordered.includes(row.category)) ordered.push(row.category);
    });
    return ordered;
  }
  function baseRowsForSegment(kind){
    const cat = state.category[kind] || 'all';
    return getRows(kind).filter(row => {
      if(cat !== 'all' && row.category !== cat) return false;
      return true;
    });
  }
  function segmentLabelBase(kind){
    if(kind === 'weapon'){
      return state.category.weapon !== 'all' ? state.category.weapon : '武防';
    }
    if(kind === 'artifact') return '法器';
    if(kind === 'recipe') return '配方';
    return '封獸';
  }
  function segments(kind){
    if(kind === 'beast') return [];
    if(kind === 'weapon' && state.category.weapon === 'all') return [];
    const rows = baseRowsForSegment(kind);
    const base = segmentLabelBase(kind);
    const count = Math.ceil(rows.length / GROUP_SIZE);
    return Array.from({ length: count }, (_, index) => ({
      value: String(index + 1),
      label: base + String(index + 1),
      from: index * GROUP_SIZE,
      to: Math.min((index + 1) * GROUP_SIZE, rows.length)
    }));
  }
  function segmentedRows(kind){
    const rows = baseRowsForSegment(kind);
    const seg = state.segment[kind] || 'all';
    if(seg === 'all') return rows;
    const index = Number(seg) - 1;
    if(!Number.isFinite(index) || index < 0) return rows;
    return rows.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE);
  }
  function filteredRows(kind){
    const q = String(state.query[kind] || '').trim().toLowerCase();
    const source = state.sourceFilter[kind] || {};
    return segmentedRows(kind).filter(row => {
      if(source.task && !row.taskFlag) return false;
      if(source.shop && !(row.shopFlag || (row.shops || []).length)) return false;
      if(!q) return true;
      return [row.name, row.itemId].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }
  async function loadData(){
    if(state.data) return state.data;
    if(state.loading) return state.loading;
    state.loading = fetch(DATA_URL + '?v=' + encodeURIComponent(document.body?.dataset?.version || 'dev'))
      .then(res => {
        if(!res.ok) throw new Error('Collect book data load failed');
        return res.json();
      })
      .then(data => {
        state.data = data;
        return data;
      });
    return state.loading;
  }
  function syncNav(kind){
    document.querySelectorAll('.navBtn[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'collect'));
    document.querySelectorAll('.formBox').forEach(box => box.classList.remove('active'));
    by('collectForm')?.classList.add('active');
    document.querySelectorAll('[data-collect-open]').forEach(btn => btn.classList.toggle('active', btn.dataset.collectOpen === kind));
  }
  function controls(kind){
    const cats = kind === 'weapon' || kind === 'beast' ? categories(kind) : [];
    const catLabel = kind === 'beast' ? '全部星等' : '全部分類';
    const catOptions = [`<option value="all">${catLabel}</option>`].concat(cats.map(cat => `<option value="${escHtml(cat)}" ${state.category[kind] === cat ? 'selected' : ''}>${escHtml(cat)}</option>`)).join('');
    const segs = segments(kind);
    const segmentOptions = ['<option value="all">全部區段</option>'].concat(segs.map(seg => `<option value="${escHtml(seg.value)}" ${state.segment[kind] === seg.value ? 'selected' : ''}>${escHtml(seg.label)}</option>`)).join('');
    const source = state.sourceFilter[kind] || { task: false, shop: false };
    const sourceFilters = kind !== 'beast' ? `<div class="collectChecks">
      <label class="collectCheck"><span>任務取得</span><input type="checkbox" data-collect-source="task" ${source.task ? 'checked' : ''}></label>
      <label class="collectCheck"><span>商店取得</span><input type="checkbox" data-collect-source="shop" ${source.shop ? 'checked' : ''}></label>
    </div>` : '';
    return `<div class="collectTools">
      <input id="collectSearch" value="${escHtml(state.query[kind])}" placeholder="搜尋${escHtml(labels[kind])}名稱或 ID">
      ${kind === 'weapon' || kind === 'beast' ? `<select id="collectCategory">${catOptions}</select>` : ''}
      ${segs.length ? `<select id="collectSegment">${segmentOptions}</select>` : ''}
    </div>${sourceFilters}`;
  }
  function metaPair(label, valueHtml, extraClass){
    return `<div class="collectMeta ${extraClass || ''}"><div class="collectMetaLabel">${escHtml(label)}</div><div class="collectMetaValue">${valueHtml}</div></div>`;
  }
  function list(kind, rows){
    const isBeast = kind === 'beast';
    const body = rows.map(row => {
      if(isBeast){
        return `<article class="collectRow collectBeastRow">
          <div class="collectItemHead"><div class="collectName">${escHtml(row.name)}</div><div class="collectScore">${escHtml(row.score || '-')} 分</div></div>
          <div class="collectGrid beastGrid">
            ${metaPair('甕種', escHtml(row.category || '-'))}
            ${metaPair('強度', escHtml(row.strength || '-'))}
            ${metaPair('術者可使用技能', beastSkillChecks(row))}
            ${metaPair('捕抓地點', dropLocationText(row), 'wide')}
          </div>
        </article>`;
      }
      const category = kind === 'weapon' ? `<div class="collectCategory">${escHtml(row.category || '-')}</div>` : '';
      return `<article class="collectRow">
        <div class="collectItemHead">
          <div><div class="collectName">${escHtml(row.name)}</div>${category}</div>
          <div class="collectScore">${escHtml(row.score || '-')} 分</div>
        </div>
        <div class="collectGrid">
          ${metaPair('任務取得', taskText(row))}
          ${metaPair('商店取得', textList(row.shops, '-'))}
          ${metaPair('掉落位置', dropLocationText(row), 'wide')}
        </div>
      </article>`;
    }).join('');
    return `<div class="collectList">${body || '<div class="empty">沒有符合條件的資料。</div>'}</div>`;
  }
  function renderLoaded(kind){
    state.active = labels[kind] ? kind : 'weapon';
    kind = state.active;
    window.SZO_COLLECT_ACTIVE = kind;
    syncNav(kind);
    const rows = filteredRows(kind);
    const reader = by('reader');
    if(!reader) return;
    reader.innerHTML = `<section class="card collectPage">
      <div class="collectHeader">
        <h1>${escHtml(labels[kind])}</h1>
        <div class="shopCount" id="collectCount">${rows.length} 筆</div>
      </div>
      ${controls(kind)}
      <div id="collectResults">${list(kind, rows)}</div>
    </section>`;
    const input = by('collectSearch');
    if(input) input.focus({preventScroll:true});
  }
  function renderCollectResults(){
    const kind = state.active;
    const rows = filteredRows(kind);
    const count = by('collectCount');
    const results = by('collectResults');
    if(count) count.textContent = rows.length + ' 筆';
    if(results) results.innerHTML = list(kind, rows);
  }
  function renderCollectMenu(){
    syncNav('menu');
    const reader = by('reader');
    if(!reader) return;
    const entries = ['weapon', 'artifact', 'recipe', 'beast'];
    reader.innerHTML = `<section class="card collectPage collectMenuPage">
      <h1>武冠收錄資料</h1>
      <div class="collectList">${entries.map(kind => `<button type="button" class="resultItem" data-collect-open="${escHtml(kind)}"><div class="rName">${escHtml(labels[kind])}</div><div class="rSub">查看${escHtml(labels[kind])}的來源與掉落資料</div></button>`).join('')}</div>
    </section>`;
  }
  async function renderCollectBookPage(kind){
    if(!labels[kind]){
      state.active = 'menu';
      window.SZO_COLLECT_ACTIVE = 'menu';
      window.v86LastView = 'collect';
      renderCollectMenu();
      try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
      try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
      return;
    }
    kind = labels[kind] ? kind : 'weapon';
    window.SZO_COLLECT_ACTIVE = kind;
    state.query[kind] = '';
    window.v86LastView = 'collect';
    const reader = by('reader');
    if(reader) reader.innerHTML = '<section class="card collectPage"><h1>武冠收錄資料</h1><div class="muted">資料載入中...</div></section>';
    try{
      await loadData();
      renderLoaded(kind);
    }catch(err){
      if(reader) reader.innerHTML = '<section class="card collectPage"><h1>武冠收錄資料</h1><div class="empty">武冠收錄資料載入失敗，請重新整理一次。</div></section>';
    }
    try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function clearCollectBookSearch(kind){
    if(kind && state.query[kind] !== undefined) state.query[kind] = '';
  }
  document.addEventListener('click', function(ev){
    const reverseBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-reverse]') : null;
    if(reverseBtn){
      ev.preventDefault();
      ev.stopPropagation();
      state.returnScroll = window.scrollY || document.documentElement.scrollTop || 0;
      renderCollectDropDetail(reverseBtn.dataset.collectReverse);
      return;
    }
    const nestedReverseBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-nested-reverse]') : null;
    if(nestedReverseBtn){
      ev.preventDefault();
      ev.stopPropagation();
      const id = nestedReverseBtn.dataset.collectNestedReverse;
      const parent = nestedReverseBtn.dataset.collectParent;
      if(id){
        const openNestedReverse = () => {
          if(typeof window.showReverse === 'function'){
            window.showReverse(id,'collect','collect:'+parent);
          }
        };
        if(typeof window.showReverse === 'function'){
          openNestedReverse();
        }else if(typeof window.ensureItemPageLoaded === 'function'){
          window.ensureItemPageLoaded().then(openNestedReverse);
        }
      }
      return;
    }
    const backBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-back]') : null;
    if(backBtn){
      ev.preventDefault();
      ev.stopPropagation();
      renderLoaded(state.active);
      requestAnimationFrame(() => {
        try{ window.scrollTo({top: state.returnScroll || 0, behavior: 'auto'}); }catch(e){}
      });
    }
  }, true);
  document.addEventListener('input', function(ev){
    if(ev.target && ev.target.id === 'collectSearch'){
      if(state.composing || ev.isComposing) return;
      state.query[state.active] = ev.target.value || '';
      renderCollectResults();
    }
  }, true);
  document.addEventListener('compositionstart', function(ev){
    if(ev.target && ev.target.id === 'collectSearch') state.composing = true;
  }, true);
  document.addEventListener('compositionend', function(ev){
    if(ev.target && ev.target.id === 'collectSearch'){
      state.composing = false;
      state.query[state.active] = ev.target.value || '';
      renderCollectResults();
    }
  }, true);
  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.id === 'collectCategory'){
      state.category[state.active] = ev.target.value || 'all';
      state.segment[state.active] = 'all';
      renderLoaded(state.active);
    }
    if(ev.target && ev.target.id === 'collectSegment'){
      state.segment[state.active] = ev.target.value || 'all';
      renderLoaded(state.active);
    }
    if(ev.target && ev.target.matches && ev.target.matches('[data-collect-source]')){
      const filter = state.sourceFilter[state.active];
      if(filter){
        filter[ev.target.dataset.collectSource] = !!ev.target.checked;
        renderLoaded(state.active);
      }
    }
  }, true);
  window.renderCollectBookPage = renderCollectBookPage;
  window.renderCollectDropDetail = renderCollectDropDetail;
  window.clearCollectBookSearch = clearCollectBookSearch;
})();
