// Full shop lookup page: SHOP.INI + NPC map placements.
(function(){
  const SHOP_DATA_URL = 'data/shop_all.json';
  const MAP_DATA_URL = 'data/stage_maps.json';
  const SHOW_SHOP_COORDS = false;
  const state = {
    data: null,
    maps: null,
    stageId: null,
    activeKey: '',
    mode: 'sell',
    query: '',
    loading: null,
    composing: false,
    focusedSearch: false,
    inputTimer: null,
    exactItemName: ''
  };

  function by(id){ return document.getElementById(id); }
  function escHtml(value){
    if(typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function price(value){
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
  function syncData(){
    try{ if(typeof window.SZO_SYNC_DATA === 'function') window.SZO_SYNC_DATA(); }catch(e){}
    return window.SZO_DATA || {};
  }
  function getItemIndex(){
    const d = syncData();
    if(d.itemIndex && Object.keys(d.itemIndex).length) return d.itemIndex;
    try{ if(itemIndex && Object.keys(itemIndex).length) return itemIndex; }catch(e){}
    return window.itemIndex || {};
  }
  function nameOfSafe(row){
    try{ return typeof nameOf === 'function' ? nameOf(row) : String(row?.Name || row?.name || '').trim(); }
    catch(e){ return String(row?.Name || row?.name || '').trim(); }
  }
  async function fetchJson(url){
    const res = await fetch(url + '?v=' + encodeURIComponent(document.body?.dataset?.version || 'dev'), { cache: 'no-store' });
    if(!res.ok) throw new Error(url + ' load failed');
    return res.json();
  }
  async function loadShopData(){
    if(state.data && state.maps) return;
    if(state.loading) return state.loading;
    state.loading = Promise.all([fetchJson(SHOP_DATA_URL), fetchJson(MAP_DATA_URL)]).then(([data, maps]) => {
      state.data = data || { shops: [] };
      state.maps = maps || { stages: [] };
      const first = shopLocations()[0];
      if(first){
        if(state.stageId === null) state.stageId = first.stageId;
        if(!state.activeKey) state.activeKey = first.key;
      }
    });
    return state.loading;
  }
  function shopMap(){
    return new Map((state.data?.shops || []).map(shop => [String(shop.shopId), shop]));
  }
  function shopLocations(){
    const shops = shopMap();
    const rows = [];
    for(const stage of state.maps?.stages || []){
      for(const npc of stage.npcs || []){
        const shopId = String(npc.shop || '').trim();
        if(!shopId || !shops.has(shopId)) continue;
        rows.push({
          key: `${stage.stageId}:${npc.id}:${npc.rawX ?? npc.x}:${npc.rawY ?? npc.y}:${shopId}`,
          stageId: Number(stage.stageId),
          stageName: stage.stageName || '',
          npcId: String(npc.id || ''),
          npcName: npc.name || '',
          shopId,
          x: npc.coordX ?? npc.x ?? '',
          y: npc.coordY ?? npc.y ?? '',
          rawX: npc.rawX ?? npc.x ?? '',
          rawY: npc.rawY ?? npc.y ?? '',
          shop: shops.get(shopId)
        });
      }
    }
    return rows.sort((a,b) => a.stageId - b.stageId || a.npcName.localeCompare(b.npcName, 'zh-Hant') || Number(a.shopId) - Number(b.shopId));
  }
  function stagesWithShops(){
    const seen = new Map();
    for(const loc of shopLocations()){
      if(!seen.has(loc.stageId)) seen.set(loc.stageId, { stageId: loc.stageId, stageName: loc.stageName });
    }
    return [...seen.values()].sort((a,b) => a.stageId - b.stageId);
  }
  function modePrice(item){
    return state.mode === 'buy' ? item.buyPrice : item.sellPrice;
  }
  function mergeDisplayItems(items){
    const seen = new Map();
    for(const item of items || []){
      const key = [item.name || '', modePrice(item), item.icon || '', item.type || ''].join('|');
      if(!seen.has(key)) seen.set(key, item);
    }
    return [...seen.values()];
  }
  function itemHasMode(item, mode){
    const value = mode === 'buy' ? item.buyPrice : item.sellPrice;
    return value !== null && value !== undefined && value !== '';
  }
  function itemSearchText(item, loc){
    return [item.name, loc.stageName, loc.npcName, loc.shopId].join(' ').toLowerCase();
  }
  function itemMatches(item, loc){
    const q = state.query.trim().toLowerCase();
    if(!q) return true;
    if(state.exactItemName) return String(item.name || '').trim() === state.exactItemName;
    return itemSearchText(item, loc).includes(q);
  }
  function matchingItemCount(mode){
    const q = state.query.trim().toLowerCase();
    if(!q) return 0;
    let count = 0;
    for(const loc of shopLocations()){
      for(const item of loc.shop?.items || []){
        if(itemHasMode(item, mode) && itemSearchText(item, loc).includes(q)) count++;
      }
    }
    return count;
  }
  function maybeSwitchModeForQuery(){
    const q = state.query.trim();
    if(!q) return;
    if(matchingItemCount(state.mode)) return;
    const other = state.mode === 'buy' ? 'sell' : 'buy';
    if(matchingItemCount(other)) state.mode = other;
  }
  function filteredItems(loc){
    if(!loc?.shop) return [];
    const rows = (loc.shop.items || [])
      .filter(item => itemHasMode(item, state.mode))
      .filter(item => itemMatches(item, loc));
    return mergeDisplayItems(rows);
  }
  function rankedLocations(){
    const q = state.query.trim().toLowerCase();
    const rows = shopLocations();
    if(!q) return rows;
    return rows.map((loc, order) => {
      const items = filteredItems(loc);
      const direct = [loc.stageName, loc.npcName, loc.shopId].join(' ').toLowerCase().includes(q);
      const prices = items.map(item => Number(modePrice(item))).filter(Number.isFinite);
      const rankPrice = prices.length ? (state.mode === 'buy' ? Math.max(...prices) : Math.min(...prices)) : -1;
      return Object.assign({}, loc, { matchCount: items.length, direct, rankPrice, order });
    }).filter(loc => loc.matchCount || loc.direct).sort((a,b) => {
      if(a.matchCount && b.matchCount){
        const priceSort = state.mode === 'buy' ? b.rankPrice - a.rankPrice : a.rankPrice - b.rankPrice;
        return priceSort || b.matchCount - a.matchCount || a.order - b.order;
      }
      if(a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      return a.order - b.order;
    });
  }
  function itemSuggestionRows(limit = 10){
    const q = state.query.trim().toLowerCase();
    if(!q) return [];
    const rows = new Map();
    for(const loc of shopLocations()){
      for(const item of loc.shop?.items || []){
        if(!itemHasMode(item, state.mode)) continue;
        const name = String(item.name || '').trim();
        if(!name || !name.toLowerCase().includes(q)) continue;
        const priceValue = Number(state.mode === 'buy' ? item.buyPrice : item.sellPrice);
        const current = rows.get(name) || { name, count: 0, bestPrice: -1, lowPrice: Infinity };
        current.count += 1;
        if(Number.isFinite(priceValue)){
          current.bestPrice = Math.max(current.bestPrice, priceValue);
          current.lowPrice = Math.min(current.lowPrice, priceValue);
        }
        rows.set(name, current);
      }
    }
    if(rows.size <= 1 && rows.has(state.query.trim())) return [];
    return [...rows.values()].sort((a,b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      const aStarts = an.startsWith(q);
      const bStarts = bn.startsWith(q);
      if(aStarts !== bStarts) return aStarts ? -1 : 1;
      const priceSort = state.mode === 'buy' ? b.bestPrice - a.bestPrice : a.lowPrice - b.lowPrice;
      return priceSort || b.count - a.count || a.name.localeCompare(b.name, 'zh-Hant');
    }).slice(0, limit);
  }
  function renderItemSuggestions(){
    const rows = itemSuggestionRows();
    if(!rows.length) return '';
    return `<div class="shopSuggestions">
      <span>你是不是想找：</span>
      ${rows.map(row => `<button type="button" class="shopSuggestBtn" data-shop-suggest="${escHtml(row.name)}">${escHtml(row.name)}</button>`).join('')}
    </div>`;
  }
  function activeLocation(){
    const ranked = rankedLocations();
    if(!ranked.some(row => row.key === state.activeKey) && ranked[0]){
      state.activeKey = ranked[0].key;
      state.stageId = ranked[0].stageId;
    }
    const rows = shopLocations();
    return rows.find(row => row.key === state.activeKey) || ranked[0] || rows[0] || null;
  }
  function setStage(stageId){
    state.stageId = Number(stageId);
    const first = shopLocations().find(loc => Number(loc.stageId) === Number(state.stageId));
    if(first) state.activeKey = first.key;
  }
  function locationTitle(loc){
    return `${loc.stageName} / ${loc.npcName}`;
  }
  function locationSub(loc){
    return SHOW_SHOP_COORDS ? `Shop ${loc.shopId} / (${loc.x}, ${loc.y})` : `Shop ${loc.shopId}`;
  }
  function stageSelect(loc){
    const selected = loc?.stageId ?? state.stageId;
    return `<label class="shopSelectLabel">地圖
      <select id="shopStageSelect">
        ${stagesWithShops().map(stage => `<option value="${stage.stageId}" ${Number(stage.stageId) === Number(selected) ? 'selected' : ''}>${String(stage.stageId).padStart(3, '0')} ${escHtml(stage.stageName)}</option>`).join('')}
      </select>
    </label>`;
  }
  function npcSelect(loc){
    const stageId = loc?.stageId ?? state.stageId;
    let rows = shopLocations().filter(row => Number(row.stageId) === Number(stageId));
    const q = state.query.trim();
    if(q){
      const hitKeys = new Set(rankedLocations().filter(row => Number(row.stageId) === Number(stageId)).map(row => row.key));
      if(hitKeys.size) rows = rows.filter(row => hitKeys.has(row.key));
    }
    if(!rows.length) rows = shopLocations().filter(row => Number(row.stageId) === Number(stageId));
    return `<label class="shopSelectLabel">商店 NPC
      <select id="shopNpcSelect">
        ${rows.map(row => {
          const count = filteredItems(row).length;
          return `<option value="${escHtml(row.key)}" ${row.key === loc?.key ? 'selected' : ''}>${escHtml(row.npcName)} / ${escHtml(locationSub(row))}${q ? ` / ${count}筆` : ''}</option>`;
        }).join('')}
      </select>
    </label>`;
  }
  function itemThumb(item){
    const src = window.SZO_ASSET_MEDIA && window.SZO_ASSET_MEDIA.itemIconSrc({
      Icon: item.icon,
      Type: item.type,
      ID: item.itemId,
      Name: item.name
    });
    return src ? `<span class="shopItemThumb"><img src="${escHtml(src)}" alt="" loading="lazy" decoding="async"></span>` : '<span class="shopItemThumb emptyThumb"></span>';
  }
  function shopRows(items){
    if(!items.length) return '<div class="empty">找不到符合目前條件的商品。</div>';
    return `<div class="shopItemList">
      ${items.map(item => `<button type="button" class="shopItemCard" data-shop-item="${escHtml(item.itemId)}" data-shop-name="${escHtml(item.name)}">
        ${itemThumb(item)}
        <span class="shopItemText"><strong>${escHtml(item.name)}</strong></span>
        <span class="shopItemPrice">${price(modePrice(item))}</span>
      </button>`).join('')}
    </div>`;
  }
  function shopBlock(loc, items, extraClass){
    if(!loc) return '<div class="empty">沒有商店資料。</div>';
    return `<div class="shopBlock ${extraClass || ''}">
      <div class="shopBlockHead">
        <div>
          <h2>${escHtml(locationTitle(loc))}</h2>
          <div class="muted">${escHtml(locationSub(loc))}</div>
        </div>
        <button type="button" class="ghost shopMapBtn" data-shop-map="${escHtml(loc.key)}">地圖位置</button>
      </div>
      ${shopRows(items)}
    </div>`;
  }
  function searchResults(){
    const q = state.query.trim();
    if(!q) return '';
    const rows = rankedLocations()
      .map(loc => ({ loc, items: filteredItems(loc) }))
      .filter(row => row.items.length);
    if(!rows.length) return '<div class="empty">找不到符合目前條件的商店。</div>';
    return `<div class="shopResultList">
      ${rows.map(row => shopBlock(row.loc, row.items, 'shopResultBlock')).join('')}
    </div>`;
  }
  function renderLoaded(){
    const reader = by('reader');
    if(!reader) return;
    const isSearching = !!state.query.trim();
    const loc = activeLocation();
    const items = loc ? filteredItems(loc) : [];
    reader.innerHTML = `<section class="card shopPage">
      <div class="shopHeader">
        <div>
          <h1>商店販賣資訊</h1>
          <div class="muted">依地圖 NPC 商店整理，可從商店跳地圖，也可從地圖點商店。</div>
        </div>
        <div class="shopCount">${shopLocations().length} 個地圖商店</div>
      </div>
      <div class="shopTools">
        <div class="shopSearchBox">
          <input id="shopSearch" value="${escHtml(state.query)}" placeholder="搜尋商品 / 商店 / 地圖，例如：虎皮、京城、打鐵店長" autocomplete="off">
          <button type="button" class="ghost shopSearchBtn" data-shop-search>搜尋</button>
        </div>
        <div class="shopSearchNote">備注：部分商品受名聲影響，最多享八折優惠</div>
        ${renderItemSuggestions()}
        <div class="shopModeTabs">
          <button type="button" class="${state.mode === 'sell' ? 'active' : ''}" data-shop-mode="sell">販賣</button>
          <button type="button" class="${state.mode === 'buy' ? 'active' : ''}" data-shop-mode="buy">回收</button>
        </div>
      </div>
      <div class="shopPicker">
        ${stageSelect(loc)}
        ${npcSelect(loc)}
        ${isSearching ? `<div class="shopSearchHint">符合搜尋的商店會依${state.mode === 'buy' ? '回收高價' : '販賣低價'}優先排列。</div>` : ''}
      </div>
      ${isSearching ? searchResults() : shopBlock(loc, items)}
    </section>`;
  }
  function runSearch(){
    clearTimeout(state.inputTimer);
    if(state.composing) return;
    maybeSwitchModeForQuery();
    renderLoaded();
  }
  function scheduleRender(){
    clearTimeout(state.inputTimer);
    state.inputTimer = setTimeout(() => {
      if(!state.focusedSearch) runSearch();
    }, 300);
  }
  async function renderShopPage(){
    window.v86LastView = 'shop';
    const reader = by('reader');
    if(reader) reader.innerHTML = '<section class="card shopPage"><h1>商店販賣資訊</h1><div class="muted">資料載入中...</div></section>';
    try{
      await loadShopData();
      renderLoaded();
    }catch(err){
      if(reader) reader.innerHTML = '<section class="card shopPage"><h1>商店販賣資訊</h1><div class="empty">商店資料載入失敗，請重新整理一次。</div></section>';
    }
    try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function detailRows(it){
    if(!it) return [];
    try{
      if(typeof itemDetailRows === 'function') return itemDetailRows(it).filter(x => x[1] !== '' && x[1] !== undefined && x[1] !== null && String(x[1]).trim() !== '0');
    }catch(e){}
    return Object.entries(it).filter(([,v]) => v !== '' && v !== undefined && v !== null && String(v).trim() !== '0');
  }
  async function showShopItem(id, fallbackName){
    window.v86LastView = 'shop';
    const itemId = String(id || '').trim();
    const reader = by('reader');
    if(reader) reader.innerHTML = '<section class="card itemCompact"><button class="backBtn" type="button" data-shop-back>← 返回商店</button><h1>資料載入中...</h1></section>';
    if(typeof window.ensureLookupDataLoaded === 'function') await window.ensureLookupDataLoaded();
    const it = getItemIndex()[itemId];
    const title = it ? nameOfSafe(it) : (fallbackName || ('ID ' + itemId));
    const kv = detailRows(it).map(([k,v]) => {
      const cls = String(v).length > 34 ? ' itemFullRow' : '';
      return `<div class="kv${cls}"><div class="k">${escHtml(k)}</div><div class="v">${escHtml(v)}</div></div>`;
    }).join('');
    if(reader){
      reader.innerHTML = `<section class="card itemCompact shopItemDetail">
        <button class="backBtn" type="button" data-shop-back>← 返回商店</button>
        <h1>${escHtml(title)}</h1>
        <div class="muted">商店商品 ID ${escHtml(itemId)}</div>
        ${it ? `<div class="kvGrid">${kv}</div>` : '<div class="empty">ITEM 資料不存在。</div>'}
      </section>`;
    }
    try{ history.pushState({app:'detail',view:'shopItem'}, '', '#shop-item-' + encodeURIComponent(itemId)); }catch(e){}
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function locationByKey(key){
    return shopLocations().find(loc => loc.key === key) || null;
  }
  async function jumpToMap(key){
    const loc = locationByKey(key);
    if(!loc) return;
    if(typeof showPageLoading === 'function') showPageLoading('地圖查詢', '地圖載入中，請稍候...');
    if(typeof window.ensureMapPageLoaded === 'function') await window.ensureMapPageLoaded();
    if(typeof window.openShopMapLocation === 'function') await window.openShopMapLocation({
      stageId: loc.stageId,
      npcId: loc.npcId,
      npcName: loc.npcName,
      x: loc.rawX,
      y: loc.rawY,
      shopId: loc.shopId
    });
  }
  function openShopLocation(shopId, stageId, npcId, x, y){
    state.mode = 'sell';
    state.query = '';
    const loc = shopLocations().find(row =>
      String(row.shopId) === String(shopId)
      && Number(row.stageId) === Number(stageId)
      && String(row.npcId) === String(npcId)
      && String(row.rawX) === String(x)
      && String(row.rawY) === String(y)
    ) || shopLocations().find(row => String(row.shopId) === String(shopId));
    if(loc){
      state.stageId = loc.stageId;
      state.activeKey = loc.key;
    }
    renderShopPage();
  }

  document.addEventListener('compositionstart', ev => {
    if(ev.target?.id === 'shopSearch') state.composing = true;
  }, true);
  document.addEventListener('compositionend', ev => {
    if(ev.target?.id === 'shopSearch'){
      state.composing = false;
      state.query = ev.target.value || '';
      state.exactItemName = '';
    }
  }, true);
  document.addEventListener('input', ev => {
    if(ev.target?.id === 'shopSearch'){
      state.query = ev.target.value || '';
      state.exactItemName = '';
    }
  }, true);
  document.addEventListener('focusin', ev => {
    if(ev.target?.id === 'shopSearch') state.focusedSearch = true;
  }, true);
  document.addEventListener('focusout', ev => {
    if(ev.target?.id === 'shopSearch'){
      state.focusedSearch = false;
      if(!state.composing){
        scheduleRender();
      }
    }
  }, true);
  document.addEventListener('keydown', ev => {
    if(ev.target?.id === 'shopSearch' && ev.key === 'Enter'){
      ev.preventDefault();
      clearTimeout(state.inputTimer);
      state.query = ev.target.value || '';
      state.composing = false;
      runSearch();
    }
  }, true);
  document.addEventListener('change', ev => {
    if(ev.target?.id === 'shopStageSelect'){
      setStage(ev.target.value);
      renderLoaded();
    }
    if(ev.target?.id === 'shopNpcSelect'){
      state.activeKey = ev.target.value || state.activeKey;
      const loc = activeLocation();
      if(loc) state.stageId = loc.stageId;
      renderLoaded();
    }
  }, true);
  document.addEventListener('click', ev => {
    const mode = ev.target?.closest?.('[data-shop-mode]');
    if(mode){
      ev.preventDefault();
      state.mode = mode.dataset.shopMode || 'sell';
      renderLoaded();
      return;
    }
    const searchBtn = ev.target?.closest?.('[data-shop-search]');
    if(searchBtn){
      ev.preventDefault();
      const input = by('shopSearch');
      if(input) state.query = input.value || '';
      state.exactItemName = '';
      state.composing = false;
      runSearch();
      return;
    }
    const suggest = ev.target?.closest?.('[data-shop-suggest]');
    if(suggest){
      ev.preventDefault();
      state.query = suggest.dataset.shopSuggest || '';
      state.exactItemName = state.query.trim();
      state.composing = false;
      maybeSwitchModeForQuery();
      renderLoaded();
      return;
    }
    const mapBtn = ev.target?.closest?.('[data-shop-map]');
    if(mapBtn){
      ev.preventDefault();
      jumpToMap(mapBtn.dataset.shopMap || '');
      return;
    }
    const shopItem = ev.target?.closest?.('[data-shop-item]');
    if(shopItem){
      ev.preventDefault();
      showShopItem(shopItem.dataset.shopItem, shopItem.dataset.shopName || '');
      return;
    }
    const back = ev.target?.closest?.('[data-shop-back]');
    if(back){
      ev.preventDefault();
      renderShopPage();
    }
  }, true);

  window.renderShopPage = renderShopPage;
  window.showShopItem = showShopItem;
  window.openShopLocation = openShopLocation;
})();
