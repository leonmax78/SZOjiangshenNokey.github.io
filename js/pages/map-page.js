// Stage map lookup page for the test site.
(function(){
  let mapDataPromise = null;
  let mapData = null;
  let shopDataPromise = null;
  let shopData = null;
  let monsterDataPromise = null;
  let monsterData = null;
  let itemDataPromise = null;
  let itemData = null;
  const SHOW_MAP_COORDS = false;
  const state = {
    query: '',
    stageId: null,
    monsters: new Set(),
    npcs: new Set(),
    composing: false,
    zoom: 1
  };

  function htmlEscape(s){
    return typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function ensureMapDataLoaded(){
    if(mapData) return mapData;
    if(!mapDataPromise){
      mapDataPromise = fetch('data/stage_maps.json?v=' + encodeURIComponent(document.body?.dataset?.version || 'dev'), { cache: 'force-cache' })
        .then(res => {
          if(!res.ok) throw new Error('地圖資料讀取失敗');
          return res.json();
        })
        .then(data => {
          mapData = data || { stages: [] };
          return mapData;
        });
    }
    return mapDataPromise;
  }

  async function ensureMapShopDataLoaded(){
    if(shopData) return shopData;
    if(!shopDataPromise){
      shopDataPromise = fetch('data/shop_all.json?v=' + encodeURIComponent(document.body?.dataset?.version || 'dev'), { cache: 'force-cache' })
        .then(res => {
          if(!res.ok) throw new Error('shop data load failed');
          return res.json();
        })
        .then(data => {
          shopData = data || { shops: [] };
          return shopData;
        });
    }
    return shopDataPromise;
  }

  async function fetchMapJson(url){
    const res = await fetch(url + '?v=' + encodeURIComponent(document.body?.dataset?.version || 'dev'), { cache: 'force-cache' });
    if(!res.ok) throw new Error(url + ' load failed');
    return res.json();
  }

  async function fetchMapBundle(key, jsonUrl){
    if(typeof loadDataBundle === 'function'){
      try{
        const data = await loadDataBundle(key);
        if(Array.isArray(data)) return data;
      }catch(e){}
    }
    return fetchMapJson(jsonUrl);
  }

  async function ensureMapMonsterDataLoaded(){
    if(monsterData) return monsterData;
    if(!monsterDataPromise){
      monsterDataPromise = Promise.all([
        fetchMapBundle('monsters', 'data/monsters.json'),
        fetchMapBundle('items', 'data/items.json')
      ]).then(([monsters, items]) => {
        monsterData = Array.isArray(monsters) ? monsters : [];
        itemData = Array.isArray(items) ? items : [];
        return monsterData;
      }).catch(err => {
        monsterDataPromise = null;
        throw err;
      });
    }
    return monsterDataPromise;
  }

  async function ensureMapItemDataLoaded(){
    if(itemData) return itemData;
    if(!itemDataPromise){
      itemDataPromise = fetchMapBundle('items', 'data/items.json').then(items => {
        itemData = Array.isArray(items) ? items : [];
        return itemData;
      }).catch(err => {
        itemDataPromise = null;
        throw err;
      });
    }
    return itemDataPromise;
  }


  async function preloadStageMapData(){
    try{ await ensureMapDataLoaded(); }catch(e){}
    try{ await ensureMapShopDataLoaded(); }catch(e){}
  }

  function shopById(shopId){
    const id = String(shopId || '').trim();
    return (shopData?.shops || []).find(shop => String(shop.shopId) === id) || null;
  }

  function modePrice(item, mode){
    return mode === 'buy' ? item.buyPrice : item.sellPrice;
  }

  function itemHasMode(item, mode){
    const value = modePrice(item, mode);
    return value !== null && value !== undefined && value !== '';
  }

  function mergeShopItems(items, mode){
    const seen = new Map();
    for(const item of items || []){
      const key = [item.name || '', modePrice(item, mode), item.icon || '', item.type || ''].join('|');
      if(!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()];
  }

  function priceText(value){
    const n = Math.floor(Number(value));
    if(!Number.isFinite(n)) return '-';
    const yi = Math.floor(n / 100000000);
    const wan = Math.floor((n % 100000000) / 10000);
    const rest = n % 10000;
    let text = '';
    if(yi) text += yi + '億';
    if(wan) text += wan + '萬';
    if(rest || !text) text += rest;
    return text + '兩';
  }

  function shopItemIcon(item){
    const media = window.SZO_ASSET_MEDIA;
    if(media && typeof media.itemIconSrc === 'function'){
      const src = media.itemIconSrc(item);
      if(src) return `<span class="mapShopThumb"><img src="${htmlEscape(src)}" alt="" loading="lazy" decoding="async"></span>`;
    }
    return '<span class="mapShopThumb emptyThumb"></span>';
  }

  function itemById(id){
    const target = String(id || '').trim();
    return (itemData || []).find(item => String(item.ID || item.id || '').trim() === target) || null;
  }

  function monsterById(id){
    const target = String(id || '').trim();
    return (monsterData || []).find(monster => String(monster.ID || monster.id || '').trim() === target) || null;
  }

  function parseDropList(value){
    const nums = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
    if(nums.length < 4) return [];
    const raw = [];
    for(let i = 2; i + 1 < nums.length; i += 2){
      const id = String(nums[i]).trim();
      const weight = Number(nums[i + 1]);
      if(id && id !== '0' && Number.isFinite(weight) && weight > 0) raw.push([id, weight]);
    }
    const total = raw.reduce((sum, row) => sum + row[1], 0);
    return total ? raw.map(([id, weight]) => ({ itemId: id, rate: weight / total * 100 })) : [];
  }

  function monsterName(monster, marker){
    return String(monster?.Name || monster?.name || marker?.name || '').trim();
  }

  function monsterLevel(monster, marker){
    return String(monster?.Level || monster?.level || marker?.level || '').trim();
  }

  function mapMonsterDropRows(monster){
    return parseDropList(monster?.DropItem).map(drop => {
      const item = itemById(drop.itemId) || {};
      return {
        itemId: drop.itemId,
        name: item.Name || item.name || `道具 ID ${drop.itemId}`,
        icon: item.Icon || item.icon || '',
        type: item.Type || item.type || '',
        rate: drop.rate.toFixed(6) + '%'
      };
    });
  }

  function monsterDropItemIcon(item){
    const media = window.SZO_ASSET_MEDIA;
    if(media && typeof media.itemIconSrc === 'function'){
      const src = media.itemIconSrc({ ID: item.itemId, Icon: item.icon, Type: item.type, Name: item.name });
      if(src) return `<span class="mapShopThumb"><img src="${htmlEscape(src)}" alt="" loading="lazy" decoding="async"></span>`;
    }
    return '<span class="mapShopThumb emptyThumb"></span>';
  }

  function mapMonsterPanelHtml(marker, monster){
    const name = monsterName(monster, marker);
    const isLoading = monster && monster.__loading;
    const drops = mapMonsterDropRows(monster);
    const portrait = markerImage(Object.assign({ kind: 'monster' }, marker, { pic: monster?.Pic || marker?.pic }));
    const level = monsterLevel(monster, marker);
    return `<div class="mapShopBackdrop" data-map-monster-backdrop>
      <section class="mapShopPanel mapMonsterPanel" role="dialog" aria-label="${htmlEscape(name)}">
        <div class="mapShopHead mapMonsterHead">
          <div class="mapMonsterTitle">
            ${portrait ? `<span class="mapMonsterThumb"><img src="${htmlEscape(portrait)}" alt="" loading="lazy" decoding="async"></span>` : ''}
            <span>
              <h2>${htmlEscape(name || '怪物')}</h2>
              <div class="mapShopMeta">Lv.${htmlEscape(level || '')} / ${htmlEscape(marker.stageName || '')}</div>
            </span>
          </div>
          <button type="button" class="ghost mapMiniBtn" data-map-monster-close>關閉</button>
        </div>
        <div class="mapShopActions">
          <strong>掉落資訊</strong>
        </div>
        <div class="mapShopItems">
          ${isLoading ? '<div class="empty">掉落資料載入中，請稍等。</div>' : drops.map(item => `<button type="button" class="mapShopItem" data-map-monster-item="${htmlEscape(item.itemId)}">
            ${monsterDropItemIcon(item)}
            <span class="mapShopText"><strong>${htmlEscape(item.name)}</strong></span>
            <span class="mapShopPrice">${htmlEscape(item.rate)}</span>
          </button>`).join('') || '<div class="empty">沒有掉落資料</div>'}
        </div>
        <div class="mapShopActions mapMonsterFooterActions">
          <button type="button" class="ghost mapShopOpenPage" data-map-monster-open-detail>查看怪物資料</button>
        </div>
      </section>
    </div>`;
  }

  async function showMapMonsterPanel(marker){
    closeMapMonsterPanel();
    window.__szoMapMonsterMarker = marker;
    document.body.insertAdjacentHTML('beforeend', mapMonsterPanelHtml(marker, { __loading: true }));
    await ensureMapMonsterDataLoaded();
    await ensureMapItemDataLoaded();
    const monster = monsterById(marker.id) || {};
    closeMapMonsterPanel();
    document.body.insertAdjacentHTML('beforeend', mapMonsterPanelHtml(marker, monster));
    window.__szoMapMonsterMarker = marker;
  }

  function closeMapMonsterPanel(){
    document.querySelectorAll('[data-map-monster-backdrop]').forEach(el => el.remove());
  }

  function mapShopPanelHtml(marker, shop, mode){
    const activeMode = mode === 'buy' ? 'buy' : 'sell';
    const items = mergeShopItems((shop?.items || [])
      .filter(item => itemHasMode(item, activeMode))
      .slice(), activeMode);
    const title = `${marker.stageName || ''} / ${marker.name || ''}`;
    return `<div class="mapShopBackdrop" data-map-shop-backdrop>
      <section class="mapShopPanel" role="dialog" aria-label="${htmlEscape(title)}">
        <div class="mapShopHead">
          <div>
            <h2>${htmlEscape(marker.name || '商店')}</h2>
            <div class="mapShopMeta">${htmlEscape(marker.stageName || '')} / Shop ${htmlEscape(shop?.shopId || marker.shop || '')}</div>
          </div>
          <button type="button" class="ghost mapMiniBtn" data-map-shop-close>關閉</button>
        </div>
        <div class="mapShopActions">
          <div class="mapShopModes">
            <button type="button" class="${activeMode === 'sell' ? 'active' : ''}" data-map-shop-mode="sell">販賣</button>
            <button type="button" class="${activeMode === 'buy' ? 'active' : ''}" data-map-shop-mode="buy">回收</button>
          </div>
          <button type="button" class="ghost mapShopOpenPage" data-map-shop-open-page>查看商店頁</button>
        </div>
        <div class="mapShopItems">
          ${items.map(item => `<button type="button" class="mapShopItem" data-map-shop-item="${htmlEscape(item.itemId)}">
            ${shopItemIcon(item)}
            <span class="mapShopText">
              <strong>${htmlEscape(item.name || '')}</strong>
            </span>
            <span class="mapShopPrice">${priceText(modePrice(item, activeMode))}</span>
          </button>`).join('') || '<div class="empty">這個模式沒有商品資料。</div>'}
        </div>
      </section>
    </div>`;
  }

  async function showMapShopPanel(marker, mode){
    await ensureMapShopDataLoaded();
    const shop = shopById(marker.shop);
    if(!shop) return;
    closeMapShopPanel();
    document.body.insertAdjacentHTML('beforeend', mapShopPanelHtml(marker, shop, mode || 'sell'));
    window.__szoMapShopMarker = marker;
    window.__szoMapShopMode = mode || 'sell';
  }

  function closeMapShopPanel(){
    document.querySelectorAll('.mapShopBackdrop').forEach(el => el.remove());
  }

  function markerText(marker){
    return `${marker.name || ''} ${marker.id || ''} ${marker.level || ''} ${marker.x || marker.coordX || ''} ${marker.y || marker.coordY || ''}`.toLowerCase();
  }

  function stageMatches(stage, q){
    if(!q) return true;
    const head = `${stage.stageId || ''} ${stage.stageName || ''}`.toLowerCase();
    if(head.includes(q)) return true;
    return (stage.monsters || []).some(m => markerText(m).includes(q)) || (stage.npcs || []).some(n => markerText(n).includes(q));
  }

  function markerMatches(marker, q){
    return !q || markerText(marker).includes(q);
  }

  function filteredStages(){
    const q = state.query.trim().toLowerCase();
    return (mapData?.stages || []).filter(stage => stageMatches(stage, q));
  }

  function mapSuggestionKey(kind, id, stageId, name){
    return `${kind}:${id || ''}:${stageId || ''}:${name || ''}`;
  }

  function mapSearchSuggestions(limit = 10){
    const q = state.query.trim().toLowerCase();
    if(!q) return [];
    const rows = [];
    const seen = new Set();
    const push = row => {
      const key = mapSuggestionKey(row.kind, row.id, row.stageId, row.name);
      if(seen.has(key) || rows.length >= limit) return;
      seen.add(key);
      rows.push(row);
    };
    (mapData?.stages || []).forEach(stage => {
      const stageHead = `${stage.stageId || ''} ${stage.stageName || ''}`.toLowerCase();
      if(stageHead.includes(q)){
        push({
          kind: 'stage',
          id: stage.stageId,
          stageId: stage.stageId,
          name: stage.stageName,
          label: `${String(stage.stageId).padStart(3, '0')} ${stage.stageName}`,
          note: '地圖'
        });
      }
      monsterGroups(stage).forEach(group => {
        if(markerMatches(group, q)){
          push({
            kind: 'monster',
            id: group.id,
            stageId: stage.stageId,
            name: group.name,
            label: group.name,
            note: `${stage.stageName} / Lv.${group.level || ''} / 共 ${group.points?.length || 0} 點`
          });
        }
      });
      (stage.npcs || []).forEach(npc => {
        const row = Object.assign({ kind: 'npc' }, npc);
        if(markerMatches(row, q)){
          push({
            kind: 'npc',
            id: npc.id,
            stageId: stage.stageId,
            name: npc.name,
            label: npc.name,
            note: `${stage.stageName}${roleLabel(npc.role) ? ' / ' + roleLabel(npc.role) : ''}`
          });
        }
      });
    });
    return rows;
  }

  function renderMapSuggestions(){
    const suggestions = mapSearchSuggestions();
    if(!state.query.trim() || !suggestions.length) return '';
    return `<div class="mapSuggestions" aria-label="搜尋候選">
      ${suggestions.map(s => `<button type="button" class="mapSuggestBtn" data-map-suggest="${htmlEscape(s.kind)}" data-id="${htmlEscape(s.id)}" data-stage="${htmlEscape(s.stageId)}" data-name="${htmlEscape(s.name)}">
        <span>${htmlEscape(s.label)}</span>
        <small>${htmlEscape(s.note)}</small>
      </button>`).join('')}
    </div>`;
  }

  function restoreMapSearchFocus(pos){
    const input = byId('mapSearchInput');
    if(!input) return;
    input.focus({ preventScroll: true });
    const p = Math.min(Number.isFinite(pos) ? pos : input.value.length, input.value.length);
    try{ input.setSelectionRange(p, p); }catch(e){}
  }

  function applyMapSuggestion(btn){
    const kind = btn.dataset.mapSuggest;
    const id = btn.dataset.id || '';
    const stageId = Number(btn.dataset.stage);
    const name = btn.dataset.name || '';
    state.query = name;
    state.stageId = stageId;
    state.monsters.clear();
    state.npcs.clear();
    const stage = (mapData?.stages || []).find(s => Number(s.stageId) === stageId);
    if(kind === 'monster' && id) state.monsters.add(String(id));
    if(kind === 'npc' && stage){
      (stage.npcs || []).forEach(n => {
        if(String(n.id || '') === String(id) || String(n.name || '') === name) state.npcs.add(npcKey(n));
      });
    }
    renderLoaded();
  }

  function currentStage(){
    const stages = filteredStages();
    if(!stages.length) return null;
    let stage = stages.find(s => Number(s.stageId) === Number(state.stageId));
    if(!stage){
      stage = stages[0];
      state.stageId = Number(stage.stageId);
      autoCheckMatches(stage);
    }
    return stage;
  }

  function monsterGroupKey(marker){
    return String(marker.id || '');
  }

  function npcKey(marker){
    return `${marker.id}:${marker.x}:${marker.y}`;
  }

  function markerKey(marker){
    return marker.kind === 'npc' ? npcKey(marker) : monsterGroupKey(marker);
  }

  function autoCheckMatches(stage){
    state.monsters.clear();
    state.npcs.clear();
    const q = state.query.trim().toLowerCase();
    if(!q) return;
    monsterGroups(stage).forEach(group => { if(markerMatches(group, q)) state.monsters.add(markerKey(group)); });
    (stage.npcs || []).forEach(n => { if(markerMatches(Object.assign({ kind: 'npc' }, n), q)) state.npcs.add(npcKey(n)); });
  }

  function roleLabel(role){
    return { shop: '商店', function: '功能', mission: '任務', talk: '對話' }[role] || '';
  }

  function markerLabel(marker){
    const lv = marker.level ? ` Lv.${marker.level}` : '';
    const role = marker.kind === 'npc' ? roleLabel(marker.role) : '';
    const roleText = role ? ` / ${role}` : '';
    return `${marker.name || '未命名'}${lv}${roleText}`;
  }

  function coordLabel(marker){
    if(!SHOW_MAP_COORDS) return '';
    const x = marker.coordX ?? marker.x ?? '';
    const y = marker.coordY ?? marker.y ?? '';
    return `(${x}, ${y})`;
  }

  function monsterGroups(stage){
    const groups = new Map();
    (stage.monsters || []).forEach(marker => {
      const key = monsterGroupKey(marker);
      if(!groups.has(key)){
        groups.set(key, Object.assign({ kind: 'monster', points: [] }, marker));
      }
      groups.get(key).points.push(marker);
    });
    return [...groups.values()].sort((a, b) => {
      const la = Number(a.level) || 0, lb = Number(b.level) || 0;
      return la - lb || String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant') || Number(a.id) - Number(b.id);
    });
  }

  function monsterGroupLabel(group){
    const lv = group.level ? ` Lv.${group.level}` : '';
    const count = Array.isArray(group.points) ? group.points.length : 0;
    return `${group.name || '未命名'}${lv} / 共 ${count} 點`;
  }

  function markerList(stage, kind){
    const rows = kind === 'monster' ? monsterGroups(stage) : (stage.npcs || []).map(n => Object.assign({ kind: 'npc' }, n));
    const checked = kind === 'monster' ? state.monsters : state.npcs;
    if(!rows.length) return '<div class="muted mapEmptyLine">沒有資料</div>';
    return rows.map(marker => {
      const key = markerKey(marker);
      const label = kind === 'monster' ? monsterGroupLabel(marker) : `${marker.name || '未命名'}${roleLabel(marker.role) ? ' / ' + roleLabel(marker.role) : ''}`;
      return `<label class="mapMarkerChoice">
        <input type="checkbox" data-map-${kind}="${htmlEscape(key)}" ${checked.has(key) ? 'checked' : ''}>
        <span>${htmlEscape(label)}</span>
      </label>`;
    }).join('');
  }

  function visibleMarkers(stage){
    const monsterRows = (stage.monsters || []).filter(m => state.monsters.has(monsterGroupKey(m))).map(m => Object.assign({ kind: 'monster' }, m));
    const npcRows = (stage.npcs || []).filter(n => state.npcs.has(npcKey(n))).map(n => Object.assign({ kind: 'npc' }, n));
    return monsterRows.concat(npcRows);
  }

  function markerDots(stage){
    const w = Number(stage.width) || 1;
    const h = Number(stage.height) || 1;
    return visibleMarkers(stage).map(marker => {
      const left = Math.max(0, Math.min(100, Number(marker.x || 0) / w * 100));
      const top = Math.max(0, Math.min(100, Number(marker.y || 0) / h * 100));
      const cls = marker.kind === 'npc' ? 'npc' : 'monster';
      const src = markerImage(marker);
      const fallback = marker.kind === 'npc' ? 'N' : 'M';
      const inner = src ? `<img src="${htmlEscape(src)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false;this.parentElement.classList.remove('withImage')"><span hidden>${fallback}</span>` : `<span>${fallback}</span>`;
      const shopAttrs = marker.kind === 'npc' && marker.shop ? ` data-map-shop="${htmlEscape(marker.shop)}" data-map-shop-stage="${htmlEscape(stage.stageId)}" data-map-shop-stage-name="${htmlEscape(stage.stageName || '')}" data-map-shop-npc="${htmlEscape(marker.id || '')}" data-map-shop-name="${htmlEscape(marker.name || '')}" data-map-shop-x="${htmlEscape(marker.x ?? '')}" data-map-shop-y="${htmlEscape(marker.y ?? '')}" data-map-shop-coord-x="${htmlEscape(marker.coordX ?? marker.x ?? '')}" data-map-shop-coord-y="${htmlEscape(marker.coordY ?? marker.y ?? '')}"` : '';
      const monsterAttrs = marker.kind === 'monster' ? ` data-map-monster-dot="1" data-map-monster="${htmlEscape(marker.id || '')}" data-map-monster-stage="${htmlEscape(stage.stageId)}" data-map-monster-stage-name="${htmlEscape(stage.stageName || '')}" data-map-monster-name="${htmlEscape(marker.name || '')}" data-map-monster-level="${htmlEscape(marker.level || '')}" data-map-monster-pic="${htmlEscape(marker.pic || '')}"` : '';
      return `<button type="button" class="mapDot ${cls}${src ? ' withImage' : ''}${marker.shop ? ' shopNpcDot' : ''}" style="left:${left}%;top:${top}%;" title="${htmlEscape(markerLabel(marker))}"${shopAttrs}${monsterAttrs}>
        ${inner}
      </button>`;
    }).join('');
  }

  function zoomValue(){
    const n = Number(state.zoom);
    if(!Number.isFinite(n)) return 1;
    return Math.max(0.5, Math.min(2.25, n));
  }

  function applyZoomToDom(stage){
    const z = zoomValue();
    const target = stage || currentStage();
    const surface = document.querySelector('.mapZoomSurface');
    const imageStage = document.querySelector('.mapImageStage');
    const label = document.querySelector('.mapZoomBar span');
    if(target && surface){
      surface.style.width = `${Math.round((Number(target.width) || 1) * z)}px`;
      surface.style.height = `${Math.round((Number(target.height) || 1) * z)}px`;
    }
    if(imageStage) imageStage.style.transform = `scale(${z})`;
    if(label) label.textContent = `${Math.round(z * 100)}%`;
  }

  function assetBase(){
    return (window.SZO_ASSET_MANIFEST && window.SZO_ASSET_MANIFEST.base) || 'assets/test-media';
  }

  function pad4(v){
    return String(v || '').padStart(4, '0');
  }

  function markerImage(marker){
    const pic = marker.pic;
    if(pic === undefined || pic === null || pic === '') return '';
    const base = assetBase();
    if(marker.kind === 'monster') return `${base}/monster-portraits/m${pic}.png`;
    return `${base}/npc-portraits/n${pic}.png`;
  }

  function renderLoaded(){
    const reader = byId('reader');
    if(!reader) return;
    const stages = filteredStages();
    const stage = currentStage();
    if(!stage){
      reader.innerHTML = `<section class="card mapPage"><h1>地圖查詢</h1>
        <div class="mapToolbar">
        <label>搜尋地圖 / 怪物 / NPC
          <input id="mapSearchInput" value="${htmlEscape(state.query)}" placeholder="例如：京城、大山犬、敖姬">
        </label>
        <button type="button" class="ghost mapClearSearchBtn" data-map-clear-search>清空搜尋</button>
      </div>
      ${renderMapSuggestions()}
        <div class="empty">找不到符合的地圖。</div></section>`;
      return;
    }
    const stageOptions = stages.map(s => `<option value="${Number(s.stageId)}" ${Number(s.stageId) === Number(stage.stageId) ? 'selected' : ''}>${String(s.stageId).padStart(3,'0')} ${htmlEscape(s.stageName)}</option>`).join('');
    reader.innerHTML = `<section class="card mapPage">
      <h1>地圖查詢</h1>
      <div class="mapToolbar">
        <label>搜尋地圖 / 怪物 / NPC
          <input id="mapSearchInput" value="${htmlEscape(state.query)}" placeholder="例如：京城、大山犬、敖姬">
        </label>
        <label>地圖
          <select id="mapStageSelect">${stageOptions}</select>
        </label>
        <button type="button" class="ghost mapClearSearchBtn" data-map-clear-search>清空搜尋</button>
      </div>
      ${renderMapSuggestions()}
      <div class="mapLayout">
        <aside class="mapLeftPane">
        <section class="mapSide mapMonsterSide">
          <div class="mapSideHead">
            <h2>怪物</h2>
            <div><button type="button" class="ghost mapMiniBtn" data-map-all="monster">全選</button><button type="button" class="ghost mapMiniBtn" data-map-none="monster">全不選</button></div>
          </div>
          <div class="mapChoiceList">${markerList(stage, 'monster')}</div>
        </section>
        <section class="mapSide mapNpcSide">
          <div class="mapSideHead">
            <h2>NPC</h2>
            <div><button type="button" class="ghost mapMiniBtn" data-map-all="npc">全選</button><button type="button" class="ghost mapMiniBtn" data-map-none="npc">全不選</button></div>
          </div>
          <div class="mapChoiceList">${markerList(stage, 'npc')}</div>
        </section>
        </aside>
        <div class="mapCanvasWrap">
          <div class="mapZoomBar">
            <label>縮放
              <input id="mapZoomInput" type="range" min="0.5" max="2.25" step="0.05" value="${zoomValue()}">
            </label>
            <span>${Math.round(zoomValue() * 100)}%</span>
          </div>
          <div class="mapLoading" id="mapImageLoading">地圖載入中</div>
          <div class="mapZoomSurface" style="width:${Math.round((Number(stage.width)||1)*zoomValue())}px;height:${Math.round((Number(stage.height)||1)*zoomValue())}px;">
            <div class="mapImageStage" style="transform:scale(${zoomValue()});width:${Number(stage.width)||1}px;height:${Number(stage.height)||1}px;">
              <img id="mapImage" src="${htmlEscape(stage.image)}" alt="${htmlEscape(stage.stageName)}" decoding="async" fetchpriority="high">
              <div class="mapOverlay">${markerDots(stage)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
    const img = byId('mapImage');
    const loading = byId('mapImageLoading');
    if(img && loading){
      const done = () => { loading.hidden = true; };
      if(img.complete) done();
      else img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => { loading.textContent = '地圖載入失敗'; }, { once: true });
    }
  }

  async function renderStageMapPage(){
    if(typeof showPageLoading === 'function') showPageLoading('地圖查詢', '地圖載入中，請稍候。');
    else if(byId('reader')) byId('reader').innerHTML = '<section class="card pageLoadingCard"><h1>地圖載入中</h1><div class="muted">正在載入地圖資料，請稍候。</div></section>';
    await ensureMapDataLoaded();
    if(state.stageId === null){
      const first = (mapData.stages || [])[0];
      if(first) state.stageId = Number(first.stageId);
    }
    renderLoaded();
    const prewarmMonsterData = () => {
      ensureMapMonsterDataLoaded().catch(() => {});
    };
    if(typeof requestIdleCallback === 'function') requestIdleCallback(prewarmMonsterData, { timeout: 1500 });
    else setTimeout(prewarmMonsterData, 250);
  }

  let mapDragState = null;
  function dragTargetAllowed(target){
    if(!target?.closest) return false;
    if(target.closest('.mapZoomBar,.mapDot,button,input,select,label,a')) return false;
    return !!target.closest('.mapCanvasWrap');
  }
  function startMapDrag(ev){
    if(ev.button !== undefined && ev.button !== 0) return;
    if(!dragTargetAllowed(ev.target)) return;
    const wrap = ev.target.closest('.mapCanvasWrap');
    if(!wrap) return;
    mapDragState = {
      wrap,
      pointerId: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY
    };
    wrap.classList.add('dragging');
    try{ wrap.setPointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault();
  }
  function moveMapDrag(ev){
    if(!mapDragState || mapDragState.pointerId !== ev.pointerId) return;
    const dx = ev.clientX - mapDragState.x;
    const dy = ev.clientY - mapDragState.y;
    mapDragState.wrap.scrollLeft -= dx;
    mapDragState.wrap.scrollTop -= dy;
    mapDragState.x = ev.clientX;
    mapDragState.y = ev.clientY;
    ev.preventDefault();
  }
  function endMapDrag(ev){
    if(!mapDragState || mapDragState.pointerId !== ev.pointerId) return;
    const wrap = mapDragState.wrap;
    wrap.classList.remove('dragging');
    try{ wrap.releasePointerCapture(ev.pointerId); }catch(e){}
    mapDragState = null;
  }

  document.addEventListener('compositionstart', ev => {
    if(ev.target?.id === 'mapSearchInput') state.composing = true;
  });

  document.addEventListener('pointerdown', startMapDrag, true);
  document.addEventListener('pointermove', moveMapDrag, true);
  document.addEventListener('pointerup', endMapDrag, true);
  document.addEventListener('pointercancel', endMapDrag, true);

  document.addEventListener('compositionend', ev => {
    if(ev.target?.id === 'mapSearchInput'){
      state.composing = false;
      const pos = ev.target.selectionStart ?? ev.target.value.length;
      state.query = ev.target.value || '';
      const stage = currentStage();
      if(stage) autoCheckMatches(stage);
      renderLoaded();
      restoreMapSearchFocus(pos);
    }
  });

  document.addEventListener('input', ev => {
    if(ev.target?.id === 'mapSearchInput'){
      if(state.composing || ev.isComposing) return;
      const pos = ev.target.selectionStart ?? ev.target.value.length;
      state.query = ev.target.value || '';
      const stage = currentStage();
      if(stage) autoCheckMatches(stage);
      renderLoaded();
      restoreMapSearchFocus(pos);
    }
    if(ev.target?.id === 'mapZoomInput'){
      state.zoom = Number(ev.target.value) || 1;
      applyZoomToDom();
    }
    const monster = ev.target?.dataset?.mapMonster;
    if(monster){
      ev.target.checked ? state.monsters.add(monster) : state.monsters.delete(monster);
      renderLoaded();
    }
    const npc = ev.target?.dataset?.mapNpc;
    if(npc){
      ev.target.checked ? state.npcs.add(npc) : state.npcs.delete(npc);
      renderLoaded();
    }
  });

  document.addEventListener('change', ev => {
    if(ev.target?.id === 'mapStageSelect'){
      state.stageId = Number(ev.target.value);
      const stage = currentStage();
      if(stage) autoCheckMatches(stage);
      renderLoaded();
    }
  });

  document.addEventListener('click', ev => {
    const monsterDot = ev.target?.closest?.('.mapDot[data-map-monster-dot]');
    if(monsterDot){
      const id = monsterDot.dataset.mapMonster || '';
      if(id){
        ev.preventDefault();
        showMapMonsterPanel({
          kind: 'monster',
          id,
          name: monsterDot.dataset.mapMonsterName || '',
          level: monsterDot.dataset.mapMonsterLevel || '',
          pic: monsterDot.dataset.mapMonsterPic || '',
          stageId: Number(monsterDot.dataset.mapMonsterStage) || state.stageId,
          stageName: monsterDot.dataset.mapMonsterStageName || ''
        });
        return;
      }
    }
    const shopDot = ev.target?.closest?.('[data-map-shop]');
    if(shopDot){
      ev.preventDefault();
      const marker = {
        kind: 'npc',
        id: shopDot.dataset.mapShopNpc || '',
        name: shopDot.dataset.mapShopName || '',
        shop: shopDot.dataset.mapShop || '',
        stageId: Number(shopDot.dataset.mapShopStage) || state.stageId,
        stageName: shopDot.dataset.mapShopStageName || '',
        x: Number(shopDot.dataset.mapShopX) || 0,
        y: Number(shopDot.dataset.mapShopY) || 0,
        coordX: shopDot.dataset.mapShopCoordX || shopDot.dataset.mapShopX || '',
        coordY: shopDot.dataset.mapShopCoordY || shopDot.dataset.mapShopY || ''
      };
      showMapShopPanel(marker, 'sell');
      return;
    }
    const suggest = ev.target?.closest?.('[data-map-suggest]');
    if(suggest){
      applyMapSuggestion(suggest);
      return;
    }
    const all = ev.target?.closest?.('[data-map-all]')?.dataset.mapAll;
    const none = ev.target?.closest?.('[data-map-none]')?.dataset.mapNone;
    const stage = currentStage();
    if(!stage || (!all && !none)) return;
    const set = (all || none) === 'monster' ? state.monsters : state.npcs;
    const rows = (all || none) === 'monster' ? monsterGroups(stage) : (stage.npcs || []).map(n => Object.assign({ kind: 'npc' }, n));
    set.clear();
    if(all) rows.forEach(row => set.add(markerKey(row)));
    renderLoaded();
  });

  document.addEventListener('click', ev => {
    if(!ev.target?.closest?.('[data-map-clear-search]')) return;
    state.query = '';
    state.monsters.clear();
    state.npcs.clear();
    renderLoaded();
  });

  document.addEventListener('click', ev => {
    const mode = ev.target?.closest?.('[data-map-shop-mode]');
    if(mode && window.__szoMapShopMarker){
      ev.preventDefault();
      showMapShopPanel(window.__szoMapShopMarker, mode.dataset.mapShopMode || 'sell');
      return;
    }
    const openPage = ev.target?.closest?.('[data-map-shop-open-page]');
    if(openPage && window.__szoMapShopMarker){
      ev.preventDefault();
      const marker = window.__szoMapShopMarker;
      closeMapShopPanel();
      (async () => {
        if(typeof window.ensureShopPageLoaded === 'function') await window.ensureShopPageLoaded();
        if(typeof window.openShopLocation === 'function') window.openShopLocation(marker.shop, marker.stageId, marker.id, marker.x, marker.y);
      })();
      return;
    }
    const close = ev.target?.closest?.('[data-map-shop-close]');
    if(close || ev.target?.matches?.('[data-map-shop-backdrop]')){
      ev.preventDefault();
      closeMapShopPanel();
    }
    const monsterDetail = ev.target?.closest?.('[data-map-monster-open-detail]');
    if(monsterDetail && window.__szoMapMonsterMarker){
      ev.preventDefault();
      const marker = window.__szoMapMonsterMarker;
      closeMapMonsterPanel();
      (async () => {
        if(typeof window.showMonster !== 'function'){
          if(typeof window.ensureMonsterPageLoaded === 'function'){
            await window.ensureMonsterPageLoaded();
          }else if(typeof window.loadScriptGroupOnce === 'function'){
            await window.loadScriptGroupOnce('page_monster');
          }else if(typeof window.loadScriptGroup === 'function'){
            await window.loadScriptGroup('page_monster');
          }
        }
        if(typeof window.showMonster === 'function') window.showMonster(marker.id);
      })();
      return;
    }
    const monsterClose = ev.target?.closest?.('[data-map-monster-close]');
    if(monsterClose || ev.target?.matches?.('[data-map-monster-backdrop]')){
      ev.preventDefault();
      closeMapMonsterPanel();
    }
  });

  window.openMonsterMapLocations = async function(monsterId, monsterName){
    state.monsters.clear();
    state.npcs.clear();
    await ensureMapDataLoaded();
    const target = String(monsterId || '');
    let foundName = monsterName || '';
    const stage = (mapData.stages || []).find(s => (s.monsters || []).some(m => {
      const ok = String(m.id) === target;
      if(ok && !foundName) foundName = m.name || '';
      return ok;
    }));
    state.query = foundName || target;
    if(stage){
      state.stageId = Number(stage.stageId);
      state.monsters.add(target);
    }
    await renderStageMapPage();
  };

  window.openShopMapLocation = async function(info){
    await ensureMapDataLoaded();
    const targetStageId = Number(info?.stageId);
    const targetNpcId = String(info?.npcId || '');
    const targetShopId = String(info?.shopId || '');
    const targetX = String(info?.x ?? '');
    const targetY = String(info?.y ?? '');
    state.monsters.clear();
    state.npcs.clear();
    const stage = (mapData.stages || []).find(s => Number(s.stageId) === targetStageId)
      || (mapData.stages || []).find(s => (s.npcs || []).some(n => String(n.shop || '') === targetShopId));
    if(stage){
      state.stageId = Number(stage.stageId);
      const npc = (stage.npcs || []).find(n =>
        String(n.id || '') === targetNpcId
        && (!targetX || String(n.x ?? '') === targetX)
        && (!targetY || String(n.y ?? '') === targetY)
      ) || (stage.npcs || []).find(n => String(n.shop || '') === targetShopId);
      if(npc){
        state.query = npc.name || '';
        state.npcs.add(npcKey(npc));
      }else{
        state.query = info?.npcName || '';
      }
    }
    await renderStageMapPage();
  };

  window.ensureMapPageLoaded = async function(){ return true; };
  window.renderStageMapPage = renderStageMapPage;
})();
