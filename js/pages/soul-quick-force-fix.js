// V217：武魂快速數量按鈕最終保險修正
// 修正重點：
// 1) 支援 data-soul-count、data-c，以及 .soulQuick 裡面只有文字的按鈕。
// 2) 在 window capture 階段先處理 pointerdown/click，避免後面的全域事件把 click 吃掉。
// 3) 武魂頁每次重新渲染後都會重新補 data 與 onclick。
(function(){
  if (window.__SZO_SOUL_QUICK_FIX_V217__) return;
  window.__SZO_SOUL_QUICK_FIX_V217__ = true;

  const FIELD_MAP = [
    ['Base_Str','力量'], ['Base_Int','智慧'], ['Base_Dex','靈敏'],
    ['Base_Con','體魄'], ['Extra_Def','物理防禦'], ['Magic_Def','術法防禦']
  ];
  const QUICK_TEXT_VALUE = { '1':'1', '2':'2', '3':'3', '5':'5', '10':'10', '20':'20' };

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function num(v, d){ v = Number(v); return Number.isFinite(v) ? v : (d || 0); }
  function fmt(n){ return Math.floor(Number(n) || 0).toLocaleString('zh-TW'); }
  function soulPortraitHTML(soul){
    const src = window.SZO_ASSET_MEDIA && window.SZO_ASSET_MEDIA.soulPortraitSrc(soul);
    return src ? '<span class="assetHero soulHero" data-soul-portrait="' + esc(soul && soul.ID) + '"><img src="' + esc(src) + '" alt="' + esc(soul && soul.Name) + '" loading="eager" decoding="async"></span>' : '';
  }

  function getSoulList(){
    try{
      if (window.SZO_SOUL_MODULE && typeof window.SZO_SOUL_MODULE.getSoulListV106 === 'function') {
        const a = window.SZO_SOUL_MODULE.getSoulListV106();
        if (Array.isArray(a) && a.length) return a;
      }
    }catch(e){}
    try{
      if (typeof window.getSoulListV106 === 'function') {
        const a = window.getSoulListV106();
        if (Array.isArray(a) && a.length) return a;
      }
    }catch(e){}
    try{
      if (Array.isArray(window.changeBodyIniSouls) && window.changeBodyIniSouls.length) return window.changeBodyIniSouls;
    }catch(e){}
    try{
      if (Array.isArray(window.SOUL_DATA) && window.SOUL_DATA.length) return window.SOUL_DATA;
    }catch(e){}
    return [];
  }

  function maxSoulCount(){
    const list = getSoulList();
    return Math.max(1, list.length || 1);
  }

  function soulById(id){
    const list = getSoulList();
    return list.find(x => String(x.ID) === String(id)) || list[0] || null;
  }

  function manualUpdateSoulCalc(){
    const sel = document.getElementById('soulSelect');
    const cnt = document.getElementById('soulCount');
    const out = document.getElementById('soulResult');
    if (!cnt || !out) return false;
    const soul = soulById(sel ? sel.value : window.soulSelectedId);
    if (!soul) return false;
    const count = Math.max(1, num(cnt.value || window.soulCount, 1));
    window.soulSelectedId = soul.ID;
    window.soulCount = count;
    const rate = (count - 1) * 0.025;
    const rows = FIELD_MAP.map(function(pair){
      const key = pair[0], label = pair[1];
      const base = num(soul[key], 0);
      if (!base) return '';
      const bonus = Math.floor(base * rate);
      return '<div class="soulStat"><div class="k">' + esc(label) + '</div><div class="base">' + fmt(base) + (bonus > 0 ? '<span class="bonus">(+ ' + fmt(bonus) + ')</span>' : '') + '</div></div>';
    }).join('');
    const totalRows = FIELD_MAP.map(function(pair){
      const key = pair[0], label = pair[1];
      const base = num(soul[key], 0);
      if (!base) return '';
      const bonus = Math.floor(base * rate);
      return '<tr><td>' + esc(label) + '</td><td>' + fmt(base) + '</td><td style="color:#facc15;font-weight:1000">+' + fmt(bonus) + '</td><td>' + fmt(base + bonus) + '</td></tr>';
    }).join('');
    out.innerHTML = '<div class="soulPreviewPanel"><div class="notice soulNotice"><div class="assetDetailHead">' + soulPortraitHTML(soul) + '<div><b>' + esc(soul.Name || '') + '</b><span class="soulMetaLine">收藏數：' + fmt(count) + '</span><span class="soulMetaLine">加成：' + (rate * 100).toFixed(1).replace(/\.0$/, '') + '%</span></div></div></div><div class="soulPreviewStats"><h3>能力預覽</h3><div class="soulStats">' + rows + '</div></div></div><h3>詳細表</h3><div class="tableWrap"><table><thead><tr><th>能力</th><th>原始能力</th><th>收藏加成</th><th>合計</th></tr></thead><tbody>' + totalRows + '</tbody></table></div>';
    return true;
  }

  function updateSoulCalcPreferred(){
    try{
      if (typeof window.SZOLegacyUpdateSoulCalc === 'function') {
        window.SZOLegacyUpdateSoulCalc();
        return true;
      }
    }catch(e){}
    return manualUpdateSoulCalc();
  }

  function normalizeQuickValue(v){
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (/滿/.test(v)) return String(maxSoulCount());
    const m = v.match(/\d+/);
    return m ? m[0] : '';
  }

  function quickButtonFromEventTarget(target){
    if (!target || !target.closest) return null;
    let btn = target.closest('[data-soul-count], [data-c]');
    if (btn) return btn;
    btn = target.closest('.soulQuick button, .quickBtns button');
    if (btn) return btn;
    return null;
  }

  function valueFromButton(btn){
    if (!btn) return '';
    let v = btn.getAttribute('data-soul-count') || btn.getAttribute('data-c') || '';
    if (!v) v = QUICK_TEXT_VALUE[String(btn.textContent || '').trim()] || normalizeQuickValue(btn.textContent);
    if (/滿/.test(String(btn.textContent || ''))) v = String(maxSoulCount());
    return normalizeQuickValue(v);
  }

  function setSoulCount(v){
    v = normalizeQuickValue(v);
    if (!v) return false;
    const cnt = document.getElementById('soulCount');
    if (!cnt) return false;
    cnt.value = String(v);
    window.soulCount = String(v);
    try{ cnt.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
    try{ cnt.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
    try{
      if (typeof window.SZOLegacySetSoulCount === 'function') window.SZOLegacySetSoulCount(v);
      else updateSoulCalcPreferred();
    }catch(e){
      try{ manualUpdateSoulCalc(); }catch(err){ console.warn('V217 soul manual update failed', err); }
    }
    return true;
  }

  function handleQuickEvent(e){
    const btn = quickButtonFromEventTarget(e.target);
    if (!btn) return;
    const v = valueFromButton(btn);
    if (!v) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    setSoulCount(v);
  }

  function enhanceButton(btn){
    if (!btn || btn.__szoSoulQuickV217) return;
    const v = valueFromButton(btn);
    if (v) btn.setAttribute('data-soul-count', v);
    btn.type = 'button';
    btn.style.pointerEvents = 'auto';
    btn.style.position = btn.style.position || 'relative';
    btn.style.zIndex = btn.style.zIndex || '2';
    btn.addEventListener('pointerdown', handleQuickEvent, true);
    btn.addEventListener('mousedown', handleQuickEvent, true);
    btn.addEventListener('touchstart', handleQuickEvent, {capture:true, passive:false});
    btn.addEventListener('click', handleQuickEvent, true);
    btn.onclick = function(ev){ handleQuickEvent(ev || window.event); return false; };
    btn.__szoSoulQuickV217 = true;
  }

  function bindExistingButtons(){
    document.querySelectorAll('[data-soul-count], [data-c], .soulQuick button, .quickBtns button').forEach(enhanceButton);
    const cnt = document.getElementById('soulCount');
    if (cnt && !cnt.__szoSoulCountV217) {
      cnt.addEventListener('input', function(){ updateSoulCalcPreferred(); }, true);
      cnt.addEventListener('change', function(){ updateSoulCalcPreferred(); }, true);
      cnt.__szoSoulCountV217 = true;
    }
  }

  // window capture 比 document capture 更早，避免舊補丁先吃掉事件。
  window.addEventListener('pointerdown', handleQuickEvent, true);
  window.addEventListener('mousedown', handleQuickEvent, true);
  window.addEventListener('touchstart', handleQuickEvent, {capture:true, passive:false});
  window.addEventListener('click', handleQuickEvent, true);
  document.addEventListener('click', handleQuickEvent, true);
  document.addEventListener('change', function(e){ if (e.target && e.target.id === 'soulSelect') updateSoulCalcPreferred(); }, true);

  try{
    const mo = new MutationObserver(function(){ bindExistingButtons(); });
    mo.observe(document.documentElement, {childList:true, subtree:true});
  }catch(e){}
  window.SZOSetSoulCount = setSoulCount;
  window.SZOUpdateSoulCalc = updateSoulCalcPreferred;
  bindExistingButtons();
  setInterval(bindExistingButtons, 800);
})();
