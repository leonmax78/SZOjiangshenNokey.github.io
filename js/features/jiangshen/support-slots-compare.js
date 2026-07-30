// V293: support jiangshen calculator, save slots, and comparison.
(function(){
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const D = () => { try{ if(typeof DATA !== 'undefined') return DATA; }catch(e){} return window.DATA || {}; };
  const stats = () => (D().stats && D().stats.length ? D().stats : ['血量','精力','體魄','力量','智慧','靈敏','術攻','防禦','術防']);
  const names = () => (D().displayNames && D().displayNames.length ? D().displayNames : Object.keys(D().baseStats || {}));
  const fmt = n => {
    const x = Math.ceil(Number(n || 0));
    try { return x.toLocaleString('zh-Hant'); } catch(e){ return String(x); }
  };
  const starOptions = (sel=1) => Array.from({length:21},(_,i)=>`<option value="${i}" ${i===sel?'selected':''}>${i} 星</option>`).join('');
  const SLOT_KEY = 'szo_support_slots_v88be';
  const CUR_KEY = 'szo_support_current_v88be';
  const SLOT_LETTERS = ['A','B','C','D','E'];

  function closeMenu(){ if(typeof closeDrawer === 'function') closeDrawer(); }
  function scrollTop(){ try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); } }
  function getAbility(name,star){ if(typeof ability === 'function') return ability(name,star) || {}; return {}; }
  function scale(a,rate=1){ const out={}; for(const st of stats()) out[st] = Math.ceil(Number(a?.[st] || 0) * rate); return out; }
  function add(a,b){ const out={}; for(const st of stats()) out[st] = Math.ceil(Number(a?.[st] || 0) + Number(b?.[st] || 0)); return out; }
  function kvGrid(obj){ return `<div class="kvGrid">${stats().map(st=>`<div class="kv"><div class="k">${E(st)}</div><div class="v">${fmt(obj?.[st] || 0)}</div></div>`).join('')}</div>`; }
  function emptyMsg(msg){ if(typeof empty === 'function') empty(msg); else alert(msg); }
  function supportBackBtn(){ return '<button class="backBtn" type="button" onclick="setJiang(\'support\')">← 返回副降神試算</button>'; }
  function defaultSet(){ return Array.from({length:5},()=>({n:'',s:1})); }
  function readJson(k,def){ try{return JSON.parse(localStorage.getItem(k) || '') || def;}catch(e){return def;} }
  function writeJson(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} }
  function normalizeSet(set){ return Array.from({length:5},(_,i)=>({n:set?.[i]?.n || '', s:Math.max(0,Math.min(20,Math.floor(Number(set?.[i]?.s ?? 1))))})); }
  function getSlots(){ const arr = readJson(SLOT_KEY,[]); return Array.from({length:5},(_,i)=>normalizeSet(Array.isArray(arr[i]) ? arr[i] : defaultSet())); }
  function setSlots(slots){ writeJson(SLOT_KEY, slots.map(normalizeSet)); }
  function getCurrent(){ return normalizeSet(readJson(CUR_KEY,defaultSet())); }
  function setCurrent(v){ writeJson(CUR_KEY,normalizeSet(v)); }
  function readPlan(prefix='P'){ return Array.from({length:5},(_,i)=>({n:$(prefix+'N'+i)?.value || '', s:Math.max(0,Math.min(20,Math.floor(Number($(prefix+'S'+i)?.value || 1))))})); }
  function fillPlan(prefix,set){ normalizeSet(set).forEach((p,i)=>{ const n=$(prefix+'N'+i), s=$(prefix+'S'+i); if(n)n.value=p.n || ''; if(s)s.value=String(p.s ?? 1); }); }
  function slotSummary(set){ const parts = normalizeSet(set).filter(p=>p.n).map(p=>`${p.n}(${p.s})`); return parts.length ? parts.join('、') : '空白'; }
  function saveCurrent(){ setCurrent(readPlan('P')); }
  function selectedNames(prefix='P'){ return Array.from({length:5},(_,i)=>$(prefix+'N'+i)?.value || '').filter(Boolean); }
  function supportNameOptions(current='',chosen=[]){
    return '<option value="">空白</option>' + names()
      .filter(n => n === current || !chosen.includes(n))
      .map(n => `<option value="${E(n)}" ${n===current?'selected':''}>${E(n)}</option>`)
      .join('');
  }
  function refreshNameOptions(prefix='P'){
    const chosen = selectedNames(prefix);
    for(let i=0;i<5;i++){
      const sel = $(prefix+'N'+i);
      if(!sel) continue;
      const current = sel.value || '';
      sel.innerHTML = supportNameOptions(current, chosen);
    }
  }
  function planHtml(prefix='P'){
    return `<div class="supportPlan"><h3>降神配置</h3>${Array.from({length:5},(_,i)=>`
      <div class="kv supportChoiceCard">
        <div class="k">${i===0?'主降神':'副降神 '+i}</div>
        <div class="v"><select id="${prefix}N${i}" class="supportInput">${supportNameOptions()}</select><label>星等</label><select id="${prefix}S${i}" class="supportInput">${starOptions(i===0?20:1)}</select></div>
      </div>`).join('')}</div>`;
  }
  function slotOptions(selected=0){ const slots=getSlots(); return SLOT_LETTERS.map((x,i)=>`<option value="${i}" ${i===selected?'selected':''}>存檔 ${x}：${E(slotSummary(slots[i]))}</option>`).join(''); }
  function calcPlan(set){
    let total = Object.fromEntries(stats().map(s=>[s,0]));
    const picks = [];
    for(let i=0;i<5;i++){
      const p = normalizeSet(set)[i] || {};
      if(!p.n) continue;
      const shown = scale(getAbility(p.n,p.s || 1), i===0 ? 1 : 0.1);
      total = add(total, shown);
      picks.push({i,n:p.n,s:p.s || 1,a:shown});
    }
    const combos = typeof activeCombos === 'function' ? activeCombos(picks.map(p=>p.n)) : [];
    if(typeof comboBonus === 'function') total = add(total, scale(comboBonus(combos),1));
    return {total,picks,combos};
  }
  function picksText(res){
    return res.picks.length
      ? res.picks.map(p => `${p.i===0?'主降神':'副降神 '+p.i}：${E(p.n)} ${p.s}星${p.i===0?'':'（10%）'}`).join('、')
      : '尚未選擇';
  }
  function comboTextBlock(res){
    return res.combos && res.combos.length
      ? res.combos.map(c=>`<div class="notice"><b>${E(c)}</b><br>${E(((D().comboMembers || {})[c] || []).join('、'))}<br>${E(typeof comboText === 'function' ? comboText(c) : '')}</div>`).join('')
      : '<div class="empty">沒有成立連結</div>';
  }

  function renderSupport(){
    const reader = $('reader'); if(!reader) return;
    reader.innerHTML = `<section class="card"><h1>降神、經驗、修練試算</h1><h2>副降神試算</h2>
      <div class="notice">主降神以 100% 能力計算；副降神 1 ~ 4 各 10%。可直接試算，也可以存入 A ~ E 後做比較。</div>
      ${planHtml('P')}
      <div class="supportSaveBar">
        <button id="calcSupportOnce" type="button">直接試算</button>
        <label style="margin:0">存檔到<select id="supportSaveSlot">${SLOT_LETTERS.map((x,i)=>`<option value="${i}">${x}</option>`).join('')}</select></label>
        <button id="saveSupportSlot" type="button">存檔</button>
        <button id="openSupportCompare" type="button">開啟存檔比較</button>
      </div>
      <h3>目前存檔</h3><div id="supportSlotList" class="kvGrid"></div>
    </section>`;
    fillPlan('P',getCurrent());
    refreshNameOptions('P');
    document.querySelectorAll('.supportInput').forEach(el=>el.addEventListener('change',()=>{ saveCurrent(); if(/^PN\d+$/.test(el.id || '')) refreshNameOptions('P'); }));
    refreshSlotList();
    $('calcSupportOnce').onclick = calcSupportOnce;
    $('saveSupportSlot').onclick = () => {
      const idx = Number($('supportSaveSlot').value || 0);
      const slots = getSlots();
      const plan = readPlan('P');
      slots[idx] = plan;
      setSlots(slots);
      setCurrent(plan);
      refreshSlotList();
      alert('已存入存檔 ' + SLOT_LETTERS[idx] + '：' + slotSummary(plan));
    };
    $('openSupportCompare').onclick = renderSupportCompare;
  }
  function refreshSlotList(){
    const el = $('supportSlotList'); if(!el) return;
    const slots = getSlots();
    el.innerHTML = SLOT_LETTERS.map((x,i)=>`<div class="kv"><div class="k">存檔 ${x}</div><div class="v">${E(slotSummary(slots[i]))}</div></div>`).join('');
  }
  function calcSupportOnce(){
    saveCurrent();
    const res = calcPlan(readPlan('P'));
    if(!res.picks.length){ emptyMsg('請至少選擇一位降神'); return; }
    $('reader').innerHTML = `<section class="card">${supportBackBtn()}<h1>副降神試算結果</h1>
      <div class="muted">${picksText(res)}</div>
      <h3>總能力</h3>${kvGrid(res.total)}
      <h3>成立連結</h3>${comboTextBlock(res)}
      <h3>各降神能力</h3>
      ${res.picks.map(p=>`<div class="card supportChoiceCard" style="box-shadow:none"><h2>${E(p.i===0?'主降神':'副降神 '+p.i)}｜${E(p.n)}｜${p.s} 星${p.i===0?'':'｜10%'}</h2>${kvGrid(p.a)}</div>`).join('')}
    </section>`;
    scrollTop();
  }
  function compareSelectHtml(i){ return `<label>比較 ${i+1}<select id="cmpSlot${i}" class="supportCompareSelect"><option value="">不使用</option>${slotOptions()}</select></label>`; }
  function renderSupportCompare(){
    const slots = getSlots();
    $('reader').innerHTML = `<section class="card">${supportBackBtn()}<h1>副降神存檔比較</h1>
      <div class="notice">選擇 2 ~ 5 組存檔後比較總能力；每列最高值會用醒目顏色標示，同數值會一起標示。</div>
      <div class="supportSaveBar">${Array.from({length:5},(_,i)=>compareSelectHtml(i)).join('')}<button id="runSupportCompare" type="button">計算比較</button></div>
      <h3>存檔內容</h3><div class="kvGrid">${SLOT_LETTERS.map((x,i)=>`<div class="kv"><div class="k">存檔 ${x}</div><div class="v">${E(slotSummary(slots[i]))}</div></div>`).join('')}</div>
      <div id="supportCompareResult"></div>
    </section>`;
    for(let i=0;i<5;i++){ const s=$('cmpSlot'+i); if(s) s.value = i<2 ? String(i) : ''; }
    $('runSupportCompare').onclick = runSupportCompare;
    runSupportCompare();
    scrollTop();
  }
  function runSupportCompare(){
    const slots = getSlots();
    const selected = [];
    for(let i=0;i<5;i++){ const v=$('cmpSlot'+i)?.value; if(v !== '') selected.push(Number(v)); }
    const out = $('supportCompareResult'); if(!out) return;
    if(!selected.length){ out.innerHTML='<div class="empty">請至少選擇一組存檔</div>'; return; }
    const cols = selected.map(idx=>({idx,label:'存檔 '+SLOT_LETTERS[idx],set:slots[idx],res:calcPlan(slots[idx])})).filter(c=>c.res.picks.length);
    if(!cols.length){ out.innerHTML='<div class="empty">選擇的存檔沒有降神資料</div>'; return; }
    out.innerHTML = `<h3>總能力比較</h3><div class="tableWrap"><table class="compareTable"><thead><tr><th>能力</th>${cols.map(c=>`<th>${E(c.label)}<br><small>${E(slotSummary(c.set))}</small></th>`).join('')}</tr></thead><tbody>
      ${stats().map(st=>{
        const vals = cols.map(c=>Number(c.res.total[st] || 0));
        const max = Math.max(...vals);
        return `<tr><td>${E(st)}</td>${cols.map((c,i)=>`<td class="${max>0 && vals[i]===max ? 'supportBest' : ''}">${fmt(vals[i])}</td>`).join('')}</tr>`;
      }).join('')}
    </tbody></table></div>${cols.map(c=>`<h3>${E(c.label)} 成立連結</h3>${comboTextBlock(c.res)}`).join('')}`;
  }

  const REC_STAR_KEY = 'szo_jiang_recommend_stars_v1';
  const REC_SLOTS = ['主降神', '副降1', '副降2', '副降3', '副降4'];
  const REC_RATE = [1, 0.1, 0.1, 0.1, 0.1];
  const REC_METRICS = [
    {kind:'physicalStr', title:'物理職業（力）', desc:'依 力量 * 2 + 靈敏 / 2 + 防禦 * 0.25 排序', keys:['力量','靈敏','防禦']},
    {kind:'physicalDex', title:'物理職業（敏）', desc:'依 靈敏 * 2 + 力量 / 2 + 防禦 * 0.25 排序', keys:['靈敏','力量','防禦']},
    {kind:'spell', title:'術法職業', desc:'依 智慧 + 術攻 + 防禦 * 0.25 + 術防 * 0.25 排序', keys:['智慧','術攻','防禦','術防']},
    {kind:'defense', title:'防禦向', desc:'依 防禦 + 術防 排序', keys:['防禦','術防']}
  ];

  function recommendStars(){
    const saved = readJson(REC_STAR_KEY, null);
    const fallback = [20,20,20,20,20];
    return Array.from({length:REC_SLOTS.length},(_,i)=>Math.max(1,Math.min(20,Math.floor(Number(saved?.[i] ?? fallback[i])))));
  }
  function saveRecommendStars(stars){ writeJson(REC_STAR_KEY, stars); }
  function readRecommendStars(){
    return Array.from({length:REC_SLOTS.length},(_,i)=>Math.max(1,Math.min(20,Math.floor(Number($('recStar'+i)?.value || 1)))));
  }
  function recommendStarOptions(sel=20){
    return Array.from({length:20},(_,idx)=>{
      const i = idx + 1;
      return `<option value="${i}" ${i===sel?'selected':''}>${i} 星</option>`;
    }).join('');
  }
  const REC_DEF_WEIGHT = 0.25;
  function metricScore(total, kind){
    if(kind === 'physicalStr') return Number(total['力量'] || 0) * 2 + Number(total['靈敏'] || 0) / 2 + Number(total['防禦'] || 0) * REC_DEF_WEIGHT;
    if(kind === 'physicalDex') return Number(total['靈敏'] || 0) * 2 + Number(total['力量'] || 0) / 2 + Number(total['防禦'] || 0) * REC_DEF_WEIGHT;
    if(kind === 'spell') return Number(total['智慧'] || 0) + Number(total['術攻'] || 0) + Number(total['防禦'] || 0) * REC_DEF_WEIGHT + Number(total['術防'] || 0) * REC_DEF_WEIGHT;
    if(kind === 'defense') return Number(total['防禦'] || 0) + Number(total['術防'] || 0);
    return 0;
  }
  function recommendTotal(picks){
    let total = Object.fromEntries(stats().map(s=>[s,0]));
    picks.forEach((p,i)=>{
      total = add(total, scale(getAbility(p.n, p.s), REC_RATE[i] || 0.1));
    });
    const combos = typeof activeCombos === 'function' ? activeCombos(picks.map(p=>p.n)) : [];
    if(typeof comboBonus === 'function') total = add(total, scale(comboBonus(combos), 1));
    return {total, combos};
  }
  function emptyTotal(){
    return Object.fromEntries(stats().map(s=>[s,0]));
  }
  function abilityPart(name, star, rate){
    return scale(getAbility(name, star), rate);
  }
  function comboClusterNames(seedName, allNames){
    const valid = new Set(allNames);
    const cluster = new Set([seedName]);
    const combos = D().comboMembers || {};
    for(let round=0; round<4; round++){
      let changed = false;
      for(const members of Object.values(combos)){
        const group = (members || []).filter(n => valid.has(n));
        if(!group.some(n => cluster.has(n))) continue;
        for(const n of group){
          if(!cluster.has(n)){ cluster.add(n); changed = true; }
        }
      }
      if(!changed) break;
    }
    cluster.delete(seedName);
    return Array.from(cluster);
  }
  function candidateListForMain(mainName, kind, star, allNames){
    const ranked = allNames.map(n=>{
      const a = abilityPart(n, star, 0.1);
      return {n, a, score:metricScore(a, kind)};
    }).sort((a,b)=>b.score-a.score);
    const keep = new Map();
    ranked.slice(0, 28).forEach(c => keep.set(c.n, c));
    comboClusterNames(mainName, allNames).forEach(n => {
      if(!keep.has(n)){
        const a = abilityPart(n, star, 0.1);
        keep.set(n, {n, a, score:metricScore(a, kind)});
      }
    });
    return Array.from(keep.values()).sort((a,b)=>b.score-a.score).slice(0, 72);
  }
  function buildState(mainName, supportNames, stars){
    const picks = [{n:mainName, s:stars[0]}].concat(supportNames.map((n,i)=>({n, s:stars[i+1]})));
    const res = recommendTotal(picks);
    return {picks, total:res.total, combos:res.combos, score:0, quickScore:0};
  }
  function supportPermutations(names, stars){
    if(names.length !== 4) return [names];
    const sameStars = new Set((stars || []).slice(1)).size === 1;
    if(sameStars) return [names];
    const out = [];
    const used = Array(names.length).fill(false);
    const cur = [];
    function walk(){
      if(cur.length === names.length){ out.push(cur.slice()); return; }
      for(let i=0;i<names.length;i++){
        if(used[i]) continue;
        used[i] = true; cur.push(names[i]);
        walk();
        cur.pop(); used[i] = false;
      }
    }
    walk();
    return out;
  }
  function comboSeedStatesForMain(mainName, kind, stars, allNames){
    const cluster = comboClusterNames(mainName, allNames);
    if(cluster.length < 2) return [];
    const ranked = cluster.map(n=>{
      const a = abilityPart(n, stars[1], 0.1);
      const comboTouch = Object.values(D().comboMembers || {}).filter(m => (m || []).includes(n)).length;
      return {n, score:metricScore(a, kind) + comboTouch * 500};
    }).sort((a,b)=>b.score-a.score).slice(0, 12).map(x=>x.n);
    const pool = ranked.length >= 4 ? ranked : Array.from(new Set(ranked.concat(allNames.filter(n => n !== mainName)))).slice(0, 12);
    const seeds = [];
    function choose(start, picked){
      if(seeds.length >= 120) return;
      if(picked.length === 4){
        for(const order of supportPermutations(picked, stars)){
          const state = buildState(mainName, order, stars);
          state.score = metricScore(state.total, kind);
          state.quickScore = state.score;
          seeds.push(state);
          if(seeds.length >= 120) break;
        }
        return;
      }
      for(let i=start; i<pool.length; i++) choose(i+1, picked.concat(pool[i]));
    }
    choose(0, []);
    return seeds;
  }
  function topRecommendPlans(kind, stars){
    const allNames = names().filter(n => n && D().baseStats && D().baseStats[n]);
    const beamLimit = 48;
    const bestByMain = [];
    for(const mainName of allNames){
      const mainAbility = abilityPart(mainName, stars[0], REC_RATE[0]);
      let states = [{picks:[{n:mainName, s:stars[0]}], total:mainAbility, quickScore:metricScore(mainAbility, kind)}];
      for(let slot=1; slot<REC_SLOTS.length; slot++){
        const slotCandidates = candidateListForMain(mainName, kind, stars[slot], allNames);
        const next = [];
        for(const state of states){
          const used = new Set(state.picks.map(p=>p.n));
          for(const cand of slotCandidates){
            const n = cand.n;
            if(used.has(n)) continue;
            const picks = state.picks.concat({n, s:stars[slot]});
            const total = add(state.total || emptyTotal(), cand.a);
            next.push({picks, total, quickScore:metricScore(total, kind)});
          }
        }
        next.sort((a,b)=>b.quickScore-a.quickScore);
        states = next.slice(0, beamLimit);
      }
      const finalStates = states.concat(comboSeedStatesForMain(mainName, kind, stars, allNames));
      const best = finalStates.map(state=>{
        const res = recommendTotal(state.picks);
        return {...state, total:res.total, combos:res.combos, score:metricScore(res.total, kind)};
      }).sort((a,b)=>b.score-a.score)[0];
      if(best) bestByMain.push(best);
    }
    return bestByMain.sort((a,b)=>b.score-a.score).slice(0,3);
  }
  function statLine(total, keys){
    return keys.map(k=>`${E(k)} ${fmt(total[k] || 0)}`).join('　');
  }
  function recommendCompareTable(plans){
    if(!plans || !plans.length) return '';
    const planTitle = (plan, idx) => {
      const picks = plan.picks || [];
      const main = picks[0]?.n || '';
      const supports = picks.slice(1).map(p => p.n).filter(Boolean);
      return `${idx + 1}. ${main}${supports.length ? `(${supports.join('、')})` : ''}`;
    };
    const scoreVals = plans.map(p=>Number(p.score || 0));
    const scoreMax = Math.max(...scoreVals);
    const scoreRow = `<tr><td>推薦分數</td>${scoreVals.map(v=>`<td class="${v===scoreMax?'supportBest':''}">${fmt(v)}</td>`).join('')}</tr>`;
    const statRows = stats().map(st=>{
      const vals = plans.map(p=>Number(p.total?.[st] || 0));
      const max = Math.max(...vals);
      return `<tr><td>${E(st)}</td>${vals.map(v=>`<td class="${max>0 && v===max?'supportBest':''}">${fmt(v)}</td>`).join('')}</tr>`;
    }).join('');
    return `<h3>候補數值比較</h3><div class="tableWrap"><table class="compareTable"><thead><tr><th>能力</th>${plans.map((p,i)=>`<th>${E(planTitle(p,i))}</th>`).join('')}</tr></thead><tbody>${scoreRow}${statRows}</tbody></table></div>`;
  }
  function recommendCard(metric, plan, idx){
    return `<article class="kv supportChoiceCard" style="margin-top:12px">
      <h3>${idx + 1}. ${E(metric.title)}候補方案</h3>
      <div class="muted">${E(metric.desc)}：${fmt(plan.score)}</div>
      <div class="notice" style="margin-top:10px">${statLine(plan.total, metric.keys)}</div>
      <div class="kvGrid" style="margin-top:10px">
        ${plan.picks.map((p,i)=>`<div class="kv"><div class="k">${E(REC_SLOTS[i])}</div><div class="v"><b>${E(p.n)}</b><br><span class="muted">${p.s} 星${i===0?' / 100%':' / 10%'}</span></div></div>`).join('')}
      </div>
      ${plan.combos && plan.combos.length ? `<div class="muted" style="margin-top:10px">連結：${plan.combos.map(E).join('、')}</div>` : ''}
    </article>`;
  }
  function renderRecommendResults(){
    const stars = readRecommendStars();
    saveRecommendStars(stars);
    const box = $('jiangRecommendResults');
    if(!box) return;
    const kind = $('recMetric')?.value || 'physicalStr';
    const metric = REC_METRICS.find(m => m.kind === kind) || REC_METRICS[0];
    box.innerHTML = '<div class="notice">正在計算推薦組合...</div>';
    setTimeout(()=>{
      const plans = topRecommendPlans(metric.kind, stars);
      const html = `<section class="card supportChoiceCard" style="box-shadow:none;margin-top:18px;border-color:rgba(54,211,207,.55)">
        <h2>${E(metric.title)}</h2>
        <div class="muted">${E(metric.desc)}，列出前 3 個候補。</div>
        ${recommendCompareTable(plans)}
        ${plans.map((p,i)=>recommendCard(metric,p,i)).join('')}
      </section>`;
      box.innerHTML = html || '<div class="empty">沒有可用的降神資料。</div>';
    }, 20);
  }
  function renderRecommend(){
    const reader = $('reader'); if(!reader) return;
    const stars = recommendStars();
    reader.innerHTML = `<section class="card">
      <h1>副降神組合推薦方案</h1>
      <div class="notice">手動設定主降神與 4 個副降神的星等後，系統會推薦物理、術法、防禦三種方向各 1 ~ 3 個候補組合。副降神能力依 10% 納入，若組合成立也會納入連結加成。</div>
      <div class="kvGrid">
        ${REC_SLOTS.map((label,i)=>`<div class="kv"><div class="k">${E(label)}星等</div><div class="v"><select id="recStar${i}">${recommendStarOptions(stars[i])}</select></div></div>`).join('')}
        <div class="kv"><div class="k">推薦方向</div><div class="v"><select id="recMetric">${REC_METRICS.map(m=>`<option value="${E(m.kind)}">${E(m.title)}</option>`).join('')}</select></div></div>
      </div>
      <div class="supportSaveBar" style="margin-top:14px">
        <button id="runJiangRecommend" type="button">產生推薦方案</button>
      </div>
      <div id="jiangRecommendResults"><div class="empty">請先設定星等與推薦方向，再按「產生推薦方案」。</div></div>
    </section>`;
    $('runJiangRecommend').onclick = renderRecommendResults;
  }

  window.renderSupportSlotsPage = function(){ renderSupport(); closeMenu(); scrollTop(); };
  window.renderSupportComparePage = function(){ renderSupportCompare(); closeMenu(); scrollTop(); };
  window.renderJiangRecommendPage = function(){ renderRecommend(); closeMenu(); scrollTop(); };
  const oldSetJiang = window.setJiang;
  window.setJiang = function(kind){
    if(kind === 'support'){ window.renderSupportSlotsPage(); return; }
    if(kind === 'recommend'){ window.renderJiangRecommendPage(); return; }
    if(kind === 'supportCompare'){ window.renderSupportComparePage(); return; }
    if(typeof oldSetJiang === 'function') return oldSetJiang(kind);
  };
})();
