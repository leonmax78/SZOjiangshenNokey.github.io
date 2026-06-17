// V339: clean Excel-table based Jiangshen calculators.
(function(){
  const $ = id => document.getElementById(id);
  const fmt = n => {
    try { return Number(n || 0).toLocaleString('zh-Hant'); }
    catch(e) { return String(n ?? ''); }
  };
  const fmtBig = v => {
    try { return BigInt(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    catch(e) { return String(v ?? ''); }
  };
  const readNum = (id, fallback = 0) => {
    const v = Number($(id)?.value ?? fallback);
    return Number.isFinite(v) ? v : fallback;
  };
  const data = () => {
    try { if (typeof DATA !== 'undefined') return DATA; } catch(e) {}
    return window.DATA || {};
  };
  const tableRow = (table, key) => (table && table[String(key)]) || null;
  const rowTotal = row => Number(row?.total ?? row?.cum ?? 0) || 0;
  const maxKey = table => {
    const keys = Object.keys(table || {}).map(Number).filter(Number.isFinite);
    return keys.length ? Math.max(...keys) : 0;
  };
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
  const ceilDiv = (a, b) => a / b + (a % b ? 1n : 0n);

  function starTable(){
    const d = data();
    return d.starSoulTable || d.starRequirements || {};
  }
  function auraTable(){
    return data().auraTable || {};
  }
  function expTable(){
    return data().expTable || {};
  }
  function starTotal(star){
    const max = maxKey(starTable()) || 20;
    const s = clampInt(star, 0, max);
    return rowTotal(tableRow(starTable(), s));
  }
  function starCost(cur, tar){
    const max = maxKey(starTable()) || 20;
    cur = clampInt(cur, 0, max);
    tar = clampInt(tar, 0, max);
    return Math.max(0, starTotal(tar) - starTotal(cur));
  }
  function auraTotal(level){
    const max = maxKey(auraTable()) || 400;
    const lv = clampInt(level, 0, max);
    return rowTotal(tableRow(auraTable(), lv));
  }
  function auraCost(cur, tar){
    const max = maxKey(auraTable()) || 400;
    cur = clampInt(cur, 0, max);
    tar = Math.max(cur, clampInt(tar, 0, max));
    return Math.max(0, auraTotal(tar) - auraTotal(cur));
  }
  function expAt(level){
    const table = expTable();
    const max = maxKey(table) || 2000;
    const lv = clampInt(level, 1, max);
    try { return BigInt(table[String(lv)] || 0); }
    catch(e) { return 0n; }
  }
  function levelFromExp(total, startLevel){
    const max = maxKey(expTable()) || 2000;
    let lv = clampInt(startLevel, 1, max);
    for (let i = lv; i <= max; i++) {
      if (expAt(i) <= total) lv = i;
      else break;
    }
    return lv;
  }
  function starOptions(selected = 20){
    const max = maxKey(starTable()) || 20;
    return Array.from({length:max + 1}, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${i} 星</option>`).join('');
  }

  function renderStarAuraPage(){
    const r = $('reader');
    if (!r) return;
    r.innerHTML = `<section class="card"><h1>降神、經驗、修練試算</h1><h2>星等 / 靈氣計算</h2>
      <div class="calcTabs"><button class="calcTab active" type="button" data-star-tab="star">星等計算</button><button class="calcTab" type="button" data-star-tab="aura">靈氣計算</button></div>
      <div id="starTabNeed"><h3>星等：需要的降神數量</h3><div class="kvGrid">
        <div class="kv"><div class="k">目前星等</div><div class="v"><select id="needCur">${starOptions(0)}</select></div></div>
        <div class="kv"><div class="k">目標星等</div><div class="v"><select id="needTar">${starOptions(20)}</select></div></div>
        <div class="kv"><div class="k">已有降神數量</div><div class="v"><input id="needOwned" type="number" value="0"></div></div>
        <div class="kv"><div class="k">倍率</div><div class="v"><input id="needRate" type="number" value="1" step="0.1"></div></div>
      </div><div class="quick"><button id="calcNeeds" type="button">計算星等</button></div><div id="starNeedResult"></div></div>
      <div id="starTabAura" style="display:none"><h3>靈氣：所需靈氣</h3><div class="kvGrid">
        <div class="kv"><div class="k">目前等級</div><div class="v"><input id="auraCur" type="number" value="0"></div></div>
        <div class="kv"><div class="k">目標等級</div><div class="v"><input id="auraTar" type="number" value="20"></div></div>
      </div><div class="quick"><button id="calcStarAura" type="button">計算靈氣</button></div><div id="auraNeedResult"></div></div>
    </section>`;
  }

  function renderExpPillPage(){
    const r = $('reader');
    if (!r) return;
    const max = maxKey(expTable()) || 2000;
    r.innerHTML = `<section class="card"><h1>降神、經驗、修練試算</h1><h2>等級 / 經驗丹</h2>
      <div class="calcTabs"><button class="calcTab active" type="button" data-exp-tab="need">等級經驗</button><button class="calcTab" type="button" data-exp-tab="eat">經驗丹升等</button></div>
      <div id="expTabNeed"><h3>等級：需要的經驗值</h3><div class="kvGrid">
        <div class="kv"><div class="k">現在等級</div><div class="v"><input id="expCur" type="number" value="1"></div></div>
        <div class="kv"><div class="k">目標等級</div><div class="v"><input id="expTar" type="number" value="${max}"></div></div>
      </div><div class="quick"><button id="calcExpNeed" type="button">計算需要經驗<small>換算乙太、聖鑽、真元顆數</small></button></div><div id="expNeedResult"></div></div>
      <div id="expTabEat" style="display:none"><h3>經驗丹：吃丹可提升到幾等</h3><div class="kvGrid">
        <div class="kv"><div class="k">現在等級</div><div class="v"><input id="eatStartLv" type="number" value="1"></div></div>
        <div class="kv"><div class="k">經驗丹單位（億）</div><div class="v"><input id="eatUnitYi" type="number" value="100"></div></div>
        <div class="kv"><div class="k">經驗丹數量</div><div class="v"><input id="eatCount" type="number" value="1"></div></div>
      </div><div class="quick"><button id="calcEatPill" type="button">計算升等<small>例如單位填 100 代表 100 億</small></button></div><div id="eatPillResult"></div></div>
    </section>`;
  }

  const previousSetJiang = window.setJiang;
  window.setJiang = function(kind){
    if (kind === 'starAura') {
      renderStarAuraPage();
      if (typeof closeDrawer === 'function') closeDrawer();
      window.scrollTo({top:0, behavior:'smooth'});
      return;
    }
    if (kind === 'expPill') {
      renderExpPillPage();
      if (typeof closeDrawer === 'function') closeDrawer();
      window.scrollTo({top:0, behavior:'smooth'});
      return;
    }
    if (typeof previousSetJiang === 'function') return previousSetJiang(kind);
  };

  window.calcNeeds = function(){
    const max = maxKey(starTable()) || 20;
    const cur = clampInt(readNum('needCur', 0), 0, max);
    const tar = clampInt(readNum('needTar', max), 0, max);
    const owned = Math.max(0, Math.floor(readNum('needOwned', 0)));
    const rate = Math.max(0.0001, readNum('needRate', 1));
    const raw = starCost(cur, tar);
    const afterOwned = Math.max(0, raw - owned);
    const need = Math.ceil(afterOwned / rate);
    const box = $('starNeedResult');
    if (box) box.innerHTML = `<div class="kvGrid" style="margin-top:12px"><div class="kv"><div class="k">星等區間</div><div class="v">${cur} 星 → ${tar} 星</div></div><div class="kv"><div class="k">累積需求</div><div class="v">${fmt(raw)} 顆降神</div></div><div class="kv"><div class="k">已有數量</div><div class="v">${fmt(owned)} 顆</div></div><div class="kv"><div class="k">扣除已有後</div><div class="v">${fmt(afterOwned)} 顆</div></div><div class="kv"><div class="k">倍率後還需</div><div class="v">${fmt(need)} 顆</div></div></div>`;
  };

  window.calcStarAura = function(){
    const max = maxKey(auraTable()) || 400;
    const cur = clampInt(readNum('auraCur', 0), 0, max);
    const tar = Math.max(cur, clampInt(readNum('auraTar', 20), 0, max));
    const total = auraCost(cur, tar);
    const box = $('auraNeedResult');
    if (box) box.innerHTML = `<div class="kvGrid" style="margin-top:12px"><div class="kv"><div class="k">等級區間</div><div class="v">${cur} → ${tar}</div></div><div class="kv"><div class="k">所需靈氣</div><div class="v">${fmt(total)}</div></div></div>`;
  };

  window.calcExpNeed = function(){
    const max = maxKey(expTable()) || 2000;
    const cur = clampInt(readNum('expCur', 1), 1, max);
    const tar = Math.max(cur, clampInt(readNum('expTar', max), 1, max));
    const need = expAt(tar) - expAt(cur);
    const yi = need / 100000000n;
    const ether = ceilDiv(need, 8000n * 100000000n);
    const diamond = ceilDiv(need, 3000n * 100000000n);
    const zhen = ceilDiv(need, 500n * 100000000n);
    const box = $('expNeedResult');
    if (box) box.innerHTML = `<div class="kvGrid" style="margin-top:12px"><div class="kv"><div class="k">等級區間</div><div class="v">${cur} → ${tar}</div></div><div class="kv"><div class="k">需要經驗</div><div class="v">${fmtBig(need)}</div></div><div class="kv"><div class="k">約幾億</div><div class="v">${fmtBig(yi)} 億</div></div><div class="kv"><div class="k">乙太 8000億</div><div class="v">${fmtBig(ether)} 顆</div></div><div class="kv"><div class="k">聖鑽 3000億</div><div class="v">${fmtBig(diamond)} 顆</div></div><div class="kv"><div class="k">真元 500億</div><div class="v">${fmtBig(zhen)} 顆</div></div></div>`;
  };

  window.calcEatPill = function(){
    const max = maxKey(expTable()) || 2000;
    const start = clampInt(readNum('eatStartLv', 1), 1, max);
    const unitYi = BigInt(Math.max(0, Math.floor(readNum('eatUnitYi', 100))));
    const count = BigInt(Math.max(0, Math.floor(readNum('eatCount', 1))));
    const gain = unitYi * 100000000n * count;
    const total = expAt(start) + gain;
    const lv = levelFromExp(total, start);
    const remain = lv < max ? expAt(lv + 1) - total : 0n;
    const box = $('eatPillResult');
    if (box) box.innerHTML = `<div class="kvGrid" style="margin-top:12px"><div class="kv"><div class="k">吃丹經驗</div><div class="v">${fmtBig(gain)}</div></div><div class="kv"><div class="k">可到等級</div><div class="v">${lv}</div></div><div class="kv"><div class="k">下一級還差</div><div class="v">${fmtBig(remain)}</div></div></div>`;
  };

  document.addEventListener('click', function(e){
    const starTab = e.target.closest('[data-star-tab]');
    if (starTab) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('[data-star-tab]').forEach(b => b.classList.remove('active'));
      starTab.classList.add('active');
      const need = $('starTabNeed');
      const aura = $('starTabAura');
      if (need) need.style.display = starTab.dataset.starTab === 'star' ? 'block' : 'none';
      if (aura) aura.style.display = starTab.dataset.starTab === 'aura' ? 'block' : 'none';
      return;
    }
    const expTab = e.target.closest('[data-exp-tab]');
    if (expTab) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('[data-exp-tab]').forEach(b => b.classList.remove('active'));
      expTab.classList.add('active');
      const need = $('expTabNeed');
      const eat = $('expTabEat');
      if (need) need.style.display = expTab.dataset.expTab === 'need' ? 'block' : 'none';
      if (eat) eat.style.display = expTab.dataset.expTab === 'eat' ? 'block' : 'none';
      return;
    }
    if (e.target && ['calcNeeds', 'calcStarAura', 'calcExpNeed', 'calcEatPill'].includes(e.target.id)) {
      e.preventDefault();
      e.stopPropagation();
      window[e.target.id]();
    }
  }, true);

  window.SZO_JIANGSHEN_EXCEL_TABLES = {
    starCost,
    auraCost,
    expAt,
    levelFromExp
  };
})();
