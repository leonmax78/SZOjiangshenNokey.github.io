// V504: five-slot main jiangshen comparison with desktop one-row layout.
(function(){
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const $ = id => document.getElementById(id);
  const E = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
  const getData = () => {
    try{ if(typeof DATA !== 'undefined') return DATA; }catch(e){}
    return window.DATA || {};
  };
  const statNames = () => {
    const data = getData();
    return data.stats && data.stats.length
      ? data.stats
      : ['血量', '精力', '體魄', '力量', '智慧', '靈敏', '術攻', '防禦', '術防'];
  };
  const heroNames = () => {
    const data = getData();
    return data.displayNames && data.displayNames.length
      ? data.displayNames
      : Object.keys(data.baseStats || {});
  };
  const fmt = value => {
    const n = Math.ceil(Number(value || 0));
    try{ return n.toLocaleString('zh-Hant'); }catch(e){ return String(n); }
  };
  const heroOptions = () => '<option value="">請選擇</option>' +
    heroNames().map(name => `<option value="${E(name)}">${E(name)}</option>`).join('');
  const starOptions = selected => Array.from({length: 20}, (_, i) => i + 1)
    .map(star => `<option value="${star}" ${star === selected ? 'selected' : ''}>${star} 星</option>`)
    .join('');
  const getAbility = (name, star) => {
    if(typeof ability === 'function') return ability(name, star) || {};
    return {};
  };
  const intAbility = obj => {
    const out = {};
    statNames().forEach(stat => { out[stat] = Math.ceil(Number(obj?.[stat] || 0)); });
    return out;
  };
  function closeMenu(){
    try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
  }
  function scrollTop(){
    try{ window.scrollTo({top: 0, behavior: 'smooth'}); }catch(e){ window.scrollTo(0, 0); }
  }
  function backButton(){
    if(typeof backButtonHTML === 'function') return backButtonHTML('jiang');
    return '<button class="backBtn" type="button" data-view="jiang">← 返回降神</button>';
  }
  function pickCard(label){
    return `<div class="kv comparePickCard">
      <div class="k">降神 ${label}</div>
      <div class="v">
        <select id="js${label}">${heroOptions()}</select>
        <label>星等</label>
        <select id="js${label}S">${starOptions(20)}</select>
      </div>
    </div>`;
  }
  function renderCompare(){
    const reader = $('reader');
    if(!reader) return;
    reader.innerHTML = `<section class="card mainComparePage">
      <h1>降神、經驗、修練試算</h1>
      <h2>主降神比較</h2>
      <div class="kvGrid mainCompareGrid">${labels.map(pickCard).join('')}</div>
      <div class="quick mainCompareAction">
        <button id="calcCompare" type="button">計算比較<small>比較已選降神的能力差異</small></button>
      </div>
    </section>`;
  }
  window.renderMainCompareFive = renderCompare;
  function selectedPicks(){
    return labels.map(label => {
      const name = $(`js${label}`)?.value || '';
      const star = Math.max(1, Math.min(20, Number($(`js${label}S`)?.value || 20)));
      return name ? { label, name, star, ability: intAbility(getAbility(name, star)) } : null;
    }).filter(Boolean);
  }
  window.calcCompare = function(){
    // Older comparison modules also forward this click. Once the first call
    // renders the result, ignore the duplicate call instead of replacing it
    // with the "select at least two" message.
    if(!labels.some(label => $(`js${label}`))) return;
    const picks = selectedPicks();
    if(picks.length < 2){
      if(typeof empty === 'function') empty('請至少選擇兩位主降神。');
      else alert('請至少選擇兩位主降神。');
      return;
    }
    const stats = statNames();
    const reader = $('reader');
    if(!reader) return;
    const header = picks.map(pick => `<th>${E(pick.label)}. ${E(pick.name)}<br><small>${pick.star} 星</small></th>`).join('');
    const rows = stats.map(stat => {
      const values = picks.map(pick => Number(pick.ability[stat] || 0));
      const max = Math.max(...values);
      return `<tr><td>${E(stat)}</td>${picks.map((pick, index) => `<td class="${values[index] === max && max > 0 ? 'supportBest' : ''}">${fmt(values[index])}</td>`).join('')}</tr>`;
    }).join('');
    reader.innerHTML = `<section class="card mainComparePage">${backButton()}
      <h1>主降神比較</h1>
      <div class="compareNameRow">
        ${picks.map(pick => `<div class="compareNameCard"><span>降神 ${E(pick.label)}</span><b>${E(pick.name)}</b><small>${pick.star} 星</small></div>`).join('')}
      </div>
      <div class="tableWrap"><table class="compareTable">
        <thead><tr><th>能力</th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
    scrollTop();
  };
  const oldSetJiang = window.setJiang;
  window.setJiang = function(kind){
    if(kind === 'compare'){
      renderCompare();
      closeMenu();
      scrollTop();
      return;
    }
    if(typeof oldSetJiang === 'function') return oldSetJiang(kind);
  };
  document.addEventListener('click', function(ev){
    if(ev.target && ev.target.id === 'calcCompare'){
      ev.preventDefault();
      ev.stopPropagation();
      window.calcCompare();
    }
  }, true);
})();
