// V256: monster search/detail/drop page with latest list and rich detail panels.
let monsterOptionalRefreshPromise = null;
const MONSTER_SEARCH_STATE_KEY='szo.monsterSearch.v1';

function readMonsterSearchState(){
 try{
  const raw=sessionStorage.getItem(MONSTER_SEARCH_STATE_KEY);
  return raw?JSON.parse(raw):{};
 }catch(e){return {}}
}

function writeMonsterSearchState(){
 try{
  sessionStorage.setItem(MONSTER_SEARCH_STATE_KEY,JSON.stringify({
   q:window.v88MonsterQ||'',
   min:window.v88MonsterMin||'',
   max:window.v88MonsterMax||'',
   race:window.v88MonsterRace||'',
   subtype:window.v88MonsterSubtype||''
  }));
 }catch(e){}
}

function restoreMonsterSearchState(){
 const state=readMonsterSearchState();
 if(window.v88MonsterQ===undefined || (!window.v88MonsterQ && state.q))window.v88MonsterQ=state.q||'';
 if(window.v88MonsterMin===undefined || (!window.v88MonsterMin && state.min))window.v88MonsterMin=state.min||'';
 if(window.v88MonsterMax===undefined || (!window.v88MonsterMax && state.max))window.v88MonsterMax=state.max||'';
 if(window.v88MonsterRace===undefined || (!window.v88MonsterRace && state.race))window.v88MonsterRace=state.race||'';
 if(window.v88MonsterSubtype===undefined || (!window.v88MonsterSubtype && state.subtype))window.v88MonsterSubtype=state.subtype||'';
}

function parseDrop(v){
 const nums=String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(nums.length<4)return [];
 const raw=[];
 for(let i=2;i+1<nums.length;i+=2){
  const id=String(nums[i]).trim();
  const w=Number(nums[i+1]);
  if(id&&id!=='0'&&Number.isFinite(w)&&w>0)raw.push([id,w]);
 }
 const total=raw.reduce((s,x)=>s+x[1],0);
 return total?raw.map(([id,w])=>[id,w/total*100,w,total]):[];
}

function syncMonsterDataForPage(){
 const bundled=window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.monsters;
 const shared=window.SZO_DATA&&window.SZO_DATA.monsters;
 const source=(Array.isArray(window.monsters)&&window.monsters.length&&window.monsters)||
  (Array.isArray(shared)&&shared.length&&shared)||
  (Array.isArray(bundled)&&bundled.length&&bundled)||
  (Array.isArray(monsters)&&monsters.length&&monsters);
 if(source&&source.length){
  monsters=source;
  window.monsters=source;
  window.SZO_DATA=window.SZO_DATA||{};
  window.SZO_DATA.monsters=source;
  return true;
 }
 return false;
}
function hasMonsterData(){return syncMonsterDataForPage()}
function monsterSearchIndexRows(){
 const bundles=window.SZO_DATA_BUNDLES||{};
 const data=bundles.search_monsters||bundles.search_index;
 return data&&Array.isArray(data.monsters)?data.monsters:[];
}
function hasMonsterSearchIndex(){return monsterSearchIndexRows().length>0}
let monsterSearchLocationPromise=null;
function ensureMonsterSearchLocations(){
 if(monsterLocations&&Object.keys(monsterLocations).length)return Promise.resolve(true);
 if(monsterSearchLocationPromise)return monsterSearchLocationPromise;
 if(typeof loadDataBundle!=='function')return Promise.resolve(false);
 monsterSearchLocationPromise=loadDataBundle('locations').then(data=>{
  if(data&&typeof data==='object'&&!Array.isArray(data))monsterLocations=data;
  monsterSearchLocationPromise=null;
  return !!(monsterLocations&&Object.keys(monsterLocations).length);
 }).catch(()=>{
  monsterSearchLocationPromise=null;
  return false;
 });
 return monsterSearchLocationPromise;
}
function monsterIndexRace(row){return raceName(row.type)}
function monsterIndexSubtype(row){return subtypeName(row.type,row.subType)}
function monsterIndexSearchText(row){return `${row.name||''} ${row.id||''} ${row.level||''} ${row.exp||''} ${monsterIndexRace(row)} ${monsterIndexSubtype(row)} ${locOf(row.name||'')}`.toLowerCase()}
function uniqueMonsterIndexValues(fn){const set=new Set();monsterSearchIndexRows().forEach(m=>{const v=String(fn(m)||'').trim();if(v)set.add(v)});return [...set]}

function monsterSearchText(m){return `${nameOf(m)} ${m.ID||''} ${m.Level||''} ${m.DropExp||''} ${raceName(m.Type)} ${subtypeName(m.Type,m.SubType)} ${locOf(nameOf(m))}`.toLowerCase()}
function uniqueMonsterValues(fn){const set=new Set();(monsters||[]).forEach(m=>{const v=String(fn(m)||'').trim();if(v)set.add(v)});return [...set]}

function monsterRaceOptionsHTML(selected){
 const order=Object.values(RACE_MAP);
 const vals=uniqueMonsterValues(m=>raceName(m.Type)).sort((a,b)=>(order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b))||a.localeCompare(b,'zh-Hant'));
 return `<option value="">全部種族</option>`+vals.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}

function monsterSubtypeOptionsHTML(selected,race){
 const order=Object.values(SUBTYPE_MAP);
 const vals=uniqueMonsterValues(m=>race&&raceName(m.Type)!==race?'':subtypeName(m.Type,m.SubType)).sort((a,b)=>(order.indexOf(a)<0?9999:order.indexOf(a))-(order.indexOf(b)<0?9999:order.indexOf(b))||a.localeCompare(b,'zh-Hant'));
 return `<option value="">全部子分類</option>`+vals.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}


function monsterIndexRaceOptionsHTML(selected){
 const order=Object.values(RACE_MAP);
 const vals=uniqueMonsterIndexValues(m=>monsterIndexRace(m)).sort((a,b)=>(order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b))||a.localeCompare(b,'zh-Hant'));
 return `<option value="">全部種族</option>`+vals.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}

function monsterIndexSubtypeOptionsHTML(selected,race){
 const order=Object.values(SUBTYPE_MAP);
 const vals=uniqueMonsterIndexValues(m=>race&&monsterIndexRace(m)!==race?'':monsterIndexSubtype(m)).sort((a,b)=>(order.indexOf(a)<0?9999:order.indexOf(a))-(order.indexOf(b)<0?9999:order.indexOf(b))||a.localeCompare(b,'zh-Hant'));
 return `<option value="">全部子分類</option>`+vals.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
}

function filterMonsterIndexList(q,min,max,race,subtype){
 const qText=(q||'').trim().toLowerCase();
 const minLv=min?intOf(min):null;
 const maxLv=max?intOf(max):null;
 const raceFilter=String(race||'').trim();
 const subtypeFilter=String(subtype||'').trim();
 let arr=monsterSearchIndexRows().filter(m=>
  (!qText||monsterIndexSearchText(m).includes(qText))&&
  (!raceFilter||monsterIndexRace(m)===raceFilter)&&
  (!subtypeFilter||monsterIndexSubtype(m)===subtypeFilter)&&
  (minLv===null||intOf(m.level)>=minLv)&&
  (maxLv===null||intOf(m.level)<=maxLv)
 );
 if(min||max)arr=arr.slice().sort((a,b)=>intOf(b.exp)-intOf(a.exp));
 return arr.slice(0,150);
}

function monsterIndexResultsHTML(arr){
 return arr.map(m=>{
  const loc=locOf(m.name);
  return `<button type="button" class="resultItem" data-monster="${esc(m.id)}"><div class="rName">${esc(m.name)}</div><div class="rSub">Lv.${esc(m.level||'')} / EXP ${esc(m.exp||0)} / ${esc(monsterIndexRace(m))}${monsterIndexSubtype(m)?' / '+esc(monsterIndexSubtype(m)):''}${loc?' / '+esc(loc):''}</div></button>`;
 }).join('')||'<div class="muted">???????????</div>';
}

function monsterThumbHTML(m){const src=window.SZO_ASSET_MEDIA&&window.SZO_ASSET_MEDIA.monsterPortraitSrc(m);return window.SZO_ASSET_MEDIA?window.SZO_ASSET_MEDIA.img(src,nameOf(m)||m.name,'assetThumb monsterThumb'):''}
function startMonsterFullDataLoad(){
 if(hasMonsterData())return;
 const loader=typeof window.ensureMonsterDataLoaded==='function'?window.ensureMonsterDataLoaded:window.ensureLookupDataLoaded;
 if(typeof loader!=='function')return;
 loader().then(ok=>{
  if(!ok)return;
  if(byId('monsterLatestList'))byId('monsterLatestList').innerHTML=latestMonstersHTML();
  if(byId('monsterResultsMain'))searchMonstersMain();
 });
}

function filterMonsterList(q,min,max,race,subtype){
 const qText=(q||'').trim().toLowerCase();
 const minLv=min?intOf(min):null;
 const maxLv=max?intOf(max):null;
 const raceFilter=String(race||'').trim();
 const subtypeFilter=String(subtype||'').trim();
 const hasLvFilter=!!(min||max);
 let arr=(monsters||[]).filter(m=>
  (!qText||monsterSearchText(m).includes(qText))&&
  (!raceFilter||raceName(m.Type)===raceFilter)&&
  (!subtypeFilter||subtypeName(m.Type,m.SubType)===subtypeFilter)&&
  (minLv===null||intOf(m.Level)>=minLv)&&
  (maxLv===null||intOf(m.Level)<=maxLv)
 );
 if(hasLvFilter)arr=arr.slice().sort((a,b)=>intOf(b.DropExp)-intOf(a.DropExp));
 return arr.slice(0,150);
}

function monsterResultLine(m){
 const sub=subtypeName(m.Type,m.SubType);
 const loc=locOf(nameOf(m));
 return `Lv.${esc(m.Level||'')} / EXP ${esc(m.DropExp||0)} / ${esc(raceName(m.Type))}${sub?' / '+esc(sub):''}${loc?' / '+esc(loc):''}`;
}

function monsterResultsHTML(arr){
 return arr.map(m=>`<button type="button" class="resultItem withAsset" data-monster="${esc(m.ID)}">${monsterThumbHTML(m)}<span class="resultText"><div class="rName">${esc(nameOf(m))}</div><div class="rSub">${monsterResultLine(m)}</div></span></button>`).join('')||'<div class="muted">沒有符合的怪物。</div>';
}

function latestMonstersHTML(limit=260){
 if(!hasMonsterData())return '<div class="muted">資料載入中，請稍等。</div>';
 return (monsters||[]).slice().reverse().slice(0,limit).map(m=>`<button type="button" class="resultItem withAsset" data-monster="${esc(m.ID)}">${monsterThumbHTML(m)}<span class="resultText"><div class="rName">${esc(nameOf(m))}</div><div class="rSub">Lv.${esc(m.Level||'')} / ${esc(raceName(m.Type))}${subtypeName(m.Type,m.SubType)?' / '+esc(subtypeName(m.Type,m.SubType)):''} / ID ${esc(m.ID||'')}</div></span></button>`).join('');
}

function beastRows(){return Array.isArray(window.SZO_BEASTS)?window.SZO_BEASTS:[]}
function beastByMonsterId(id){return beastRows().filter(row=>String(row.monsterId||'')===String(id||''))}
function beastStarsHTML(selected){
 return Array.from({length:9},(_,i)=>i+2).map(star=>`<button type="button" class="beastStarBtn ${Number(selected)===star?'active':''}" onclick="selectBeastStars(${star})">${star}星甕</button>`).join('');
}
function beastResultHTML(row,index){
 const m=(monsters||[]).find(item=>String(item.ID||'')===String(row.monsterId||''));
 const thumb=m?monsterThumbHTML(m):'';
 const meta=m?`${esc(raceName(m.Type))}${subtypeName(m.Type,m.SubType)?' / '+esc(subtypeName(m.Type,m.SubType)):''}`:'怪物資料待補';
 return `<button type="button" class="resultItem withAsset" onclick="showBeastDetail(${index})">${thumb}<span class="resultText"><div class="rName">${esc(row.name)}</div><div class="rSub">${esc(row.stars)}星甕 / ${meta}</div></span></button>`;
}
function renderBeastResults(){
 const box=byId('monsterResultsMain');if(!box)return;
 const star=Number(window.v88BeastStars||2);
 const q=String(byId('monsterQMain')?.value||'').trim().toLowerCase();
 box.innerHTML=beastRows().map((row,index)=>({row,index})).filter(item=>Number(item.row.stars)===star&&(!q||String(item.row.name).toLowerCase().includes(q))).map(item=>beastResultHTML(item.row,item.index)).join('')||'<div class="muted">沒有符合的封獸。</div>';
}
function selectBeastStars(star){window.v88BeastStars=Number(star);document.querySelectorAll('.beastStarBtn').forEach(btn=>btn.classList.toggle('active',btn.textContent===`${star}星甕`));renderBeastResults()}
function setMonsterQueryMode(mode){window.v88MonsterMode=mode==='beast'?'beast':'monster';renderMonsterPage()}

function renderMonsterPage(){
 restoreMonsterSearchState();
 const q=window.v88MonsterQ||'',min=window.v88MonsterMin||'',max=window.v88MonsterMax||'',race=window.v88MonsterRace||'',subtype=window.v88MonsterSubtype||'',beastMode=window.v88MonsterMode==='beast';
 if(!hasMonsterData()&&!hasMonsterSearchIndex()&&typeof window.ensureMonsterSearchIndexLoaded==='function'){
  byId('reader').innerHTML='<section class="card monsterSearchPage"><h1>怪物查詢</h1><div class="muted">正在載入怪物搜尋索引，請稍等。</div></section>';
  window.ensureMonsterSearchIndexLoaded().then(ok=>{if(ok)renderMonsterPage();else byId('reader').innerHTML='<section class="card"><h1>怪物查詢</h1><div class="empty">怪物資料載入失敗，請重新整理一次。</div></section>';});
  return;
 }
 byId('reader').innerHTML=`<section class="card monsterSearchPage latestSearchPage"><h1>怪物查詢</h1>
  <div class="monsterModeSwitch"><button type="button" class="${beastMode?'':'active'}" onclick="setMonsterQueryMode('monster')">查詢怪物</button><button type="button" class="${beastMode?'active':''}" onclick="setMonsterQueryMode('beast')">查詢封獸</button></div>
  ${beastMode?`<div class="beastStarPicker" aria-label="封甕星級">${beastStarsHTML(window.v88BeastStars||2)}</div>`:''}
  <div class="latestQueryLayout">
    <div class="latestMainPane">
      <div class="kvGrid">
        <div class="kv"><div class="k">${beastMode?'封獸名稱':'怪物名稱 / ID / 位置 / 種族 / 子分類'}</div><div class="v"><input id="monsterQMain" placeholder="${beastMode?'例如：影咒獸．垣鹿':'例如：黃帝、問頂仙龍、蜘蛛精'}" value="${esc(q)}" oninput="searchMonstersMain()"></div></div>
        ${beastMode?'':`
        <div class="kv"><div class="k">種族</div><div class="v"><select id="monsterRaceMain" onchange="searchMonstersMain()">${hasMonsterData()?monsterRaceOptionsHTML(race):monsterIndexRaceOptionsHTML(race)}</select></div></div>
        <div class="kv"><div class="k">子分類</div><div class="v"><select id="monsterSubtypeMain" onchange="searchMonstersMain()">${hasMonsterData()?monsterSubtypeOptionsHTML(subtype,race):monsterIndexSubtypeOptionsHTML(subtype,race)}</select></div></div>
        <div class="kv"><div class="k">最低 Lv</div><div class="v"><input id="monsterMinMain" type="number" value="${esc(min)}" oninput="searchMonstersMain()"></div></div>
        <div class="kv"><div class="k">最高 Lv</div><div class="v"><input id="monsterMaxMain" type="number" value="${esc(max)}" oninput="searchMonstersMain()"></div></div>
        `}
      </div>
      <div class="itemFilterActions"><button type="button" onclick="clearMonsterSearchFilters()">\u6e05\u7a7a\u7be9\u9078</button></div>
      <div class="results" id="monsterResultsMain"></div>
    </div>
    ${beastMode?'':`<aside class="latestSidePane">
      <div class="latestSideTitle">最新怪物清單</div>
      <div class="latestSideHint">依 MONSTER_C.INI 原始順序反向顯示，越新的資料越上面。</div>
      <div class="latestList" id="monsterLatestList">${latestMonstersHTML()}</div>
    </aside>`}
  </div>
 </section>`;
 startMonsterFullDataLoad();
 ensureMonsterSearchLocations().then(ok=>{
  if(ok&&byId('monsterResultsMain'))searchMonstersMain();
 });
 searchMonstersMain();
}

function searchMonstersMain(){
 const q=byId('monsterQMain'); if(!q)return;
 window.v88MonsterQ=q.value;
 if(window.v88MonsterMode==='beast'){renderBeastResults();return;}
 window.v88MonsterMin=byId('monsterMinMain')?.value||'';
 window.v88MonsterMax=byId('monsterMaxMain')?.value||'';
 window.v88MonsterRace=byId('monsterRaceMain')?.value||'';
 window.v88MonsterSubtype=byId('monsterSubtypeMain')?.value||'';
 writeMonsterSearchState();
 const subSel=byId('monsterSubtypeMain');
 if(subSel&&(hasMonsterData()||hasMonsterSearchIndex())){
  const old=window.v88MonsterSubtype;
  subSel.innerHTML=hasMonsterData()?monsterSubtypeOptionsHTML(old,window.v88MonsterRace):monsterIndexSubtypeOptionsHTML(old,window.v88MonsterRace);
  if([...subSel.options].some(o=>o.value===old))subSel.value=old;else{subSel.value='';window.v88MonsterSubtype='';writeMonsterSearchState();}
 }
 const box=byId('monsterResultsMain'); if(!box)return;
 const hasFilter=!!(String(window.v88MonsterQ||'').trim()||String(window.v88MonsterMin||'').trim()||String(window.v88MonsterMax||'').trim()||String(window.v88MonsterRace||'').trim()||String(window.v88MonsterSubtype||'').trim());
 if(!hasFilter){box.innerHTML='';return;}
 if(String(window.v88MonsterQ||'').trim()&&!(monsterLocations&&Object.keys(monsterLocations).length)){
  ensureMonsterSearchLocations().then(ok=>{if(ok&&byId('monsterResultsMain'))searchMonstersMain();});
 }
 box.innerHTML=hasMonsterData()?monsterResultsHTML(filterMonsterList(window.v88MonsterQ,window.v88MonsterMin,window.v88MonsterMax,window.v88MonsterRace,window.v88MonsterSubtype)):monsterIndexResultsHTML(filterMonsterIndexList(window.v88MonsterQ,window.v88MonsterMin,window.v88MonsterMax,window.v88MonsterRace,window.v88MonsterSubtype));
}

function showBeastDetail(index){
 const row=beastRows()[Number(index)];if(!row)return;
 const m=(monsters||[]).find(item=>String(item.ID||'')===String(row.monsterId||''));
 const hero=m?monsterThumbHTML(m).replace('assetThumb monsterThumb','assetHero monsterHero'):'';
 const basic=[['怪物名稱',row.name],['星級',`${row.stars}星甕`],['種族',m?raceName(m.Type):'待補'],['子分類',m?subtypeName(m.Type,m.SubType):'待補']];
 const ability=m?[
  ['生命',m.HP],['攻擊',row.attack==null?'待補':Math.round(Number(row.attack))],
  ['防禦',Math.round((Number(m.ExtraDef)||0)+(Number(m.Con)||0)*0.2+(Number(m.Dex)||0)*0.1)],
  ['術攻',Math.round((Number(m.MagicAttack)||0)+(Number(m.Int)||0)*2.4)],
  ['術防',Math.round((Number(m.MagicDef)||0)+(Number(m.Int)||0)*0.8)]
 ]:[['生命','待補'],['攻擊',row.attack==null?'待補':row.attack],['防禦','待補'],['術攻','待補'],['術防','待補']];
 const stats=m?[['體魄',m.Con],['力量',m.Str],['智慧',m.Int],['靈敏',m.Dex]]:[];
 const skills=m?[["技能1",monsterSkillText(m.Skill1)],["技能2",monsterSkillText(m.Skill2)],["技能3",monsterSkillText(m.Skill3)],["技能4",monsterSkillText(m.Skill4)]]:(row.skills||[]).map((skill,i)=>[`技能${i+1}`,skill]);
 byId('reader').innerHTML=`<section class="card monsterCompact"><button class="backBtn" type="button" onclick="renderMonsterPage()">← 返回封獸查詢</button><div class="assetPreviewPanel monsterPreviewPanel"><div class="assetArtPanel">${hero}<h1>${esc(row.name)}</h1><span class="beastTag">封獸 · ${esc(row.stars)}星甕</span></div><div class="assetInfoPanel"><div class="monsterPanel"><h3>怪物資料</h3>${monsterRowsHTML(basic,'monsterDataGrid')}</div><div class="monsterPanel"><h3>能力資訊</h3>${monsterRowsHTML(ability,'monsterStatGrid')}</div></div></div><div class="monsterGrid"><div class="monsterPanel"><h3>四圍</h3>${monsterRowsHTML(stats,'monsterStatGrid')}</div>${skills.some(item=>item[1])?`<div class="monsterPanel monsterSkillPanel"><h3>技能資訊</h3>${monsterRowsHTML(skills,'monsterSkillGrid')}</div>`:''}</div></section>`;
 window.scrollTo({top:0,behavior:'smooth'});
}

function clearMonsterSearchFilters(){
 window.v88MonsterQ='';
 window.v88MonsterMin='';
 window.v88MonsterMax='';
 window.v88MonsterRace='';
 window.v88MonsterSubtype='';
 writeMonsterSearchState();
 ['monsterQMain','monsterMinMain','monsterMaxMain','monsterRaceMain','monsterSubtypeMain'].forEach(id=>{
  const el=byId(id);
  if(el)el.value='';
 });
 const subSel=byId('monsterSubtypeMain');
 if(subSel&&(hasMonsterData()||hasMonsterSearchIndex())){
  subSel.innerHTML=hasMonsterData()?monsterSubtypeOptionsHTML('', ''):monsterIndexSubtypeOptionsHTML('', '');
 }
 searchMonstersMain();
}

function compactWanMonster(n){
 const v=Number(n)||0;
 if(Math.abs(v)>=10000){
  const x=v/10000;
  return (Math.round(x*10)/10).toLocaleString('zh-Hant')+'萬';
 }
 return Math.round(v).toLocaleString('zh-Hant');
}

function monsterBreakSuggestText(def){
 if(typeof window.breakSuggestText==='function')return window.breakSuggestText(def);
 const d=Number(def)||0;
 if(!d)return '';
 const r=64893/87946;
 const s=d/(2+r/2), x=s*r;
 const ax=d/(2+r/2), as=ax*r;
 return `破防參考：一般武器約 ${compactWanMonster(s)}力 / ${compactWanMonster(x)}敏；暗器約 ${compactWanMonster(as)}力 / ${compactWanMonster(ax)}敏`;
}

function ensureMonsterOptionalData(id){
 if(monsterOptionalRefreshPromise)return monsterOptionalRefreshPromise;
 if((magicIndex&&Object.keys(magicIndex).length)&&(monsterLocations&&Object.keys(monsterLocations).length))return Promise.resolve(true);
 if(typeof loadDataBundle!=='function')return Promise.resolve(false);
 monsterOptionalRefreshPromise=Promise.allSettled([
  loadDataBundle('magic').then(data=>{if(Array.isArray(data))magics=data;}),
  loadDataBundle('locations').then(data=>{if(data&&typeof data==='object'&&!Array.isArray(data))monsterLocations=data;})
 ]).then(()=>{
  magicIndex={};
  for(const m of magics||[])magicIndex[String(m.ID).trim()]=m;
  try{if(typeof SZO_SYNC_DATA==='function')SZO_SYNC_DATA();}catch(e){}
  monsterOptionalRefreshPromise=null;
  if(id&&location.hash==='#monster-'+id)showMonster(id,true);
  return true;
 }).catch(()=>{monsterOptionalRefreshPromise=null;return false;});
 return monsterOptionalRefreshPromise;
}

function monsterSkillText(v){
 const raw=String(v||'').trim();
 if(!raw)return '';
 return raw.split(',').map(x=>x.trim()).filter(Boolean).map(id=>{
  const mg=magicIndex[String(id).trim()];
  const n=mg&&mg.Name?String(mg.Name).trim():'';
  return n||id;
 }).join('、');
}

function monsterMoneyText(m){
 const min=m.DropMoneyMin||'',max=m.DropMoneyMax||'';
 if(!min&&!max)return '';
 return `${min||0} ~ ${max||0}`;
}

function syncMonsterItemDataForDrops(){
 const bundled=window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.items;
 const shared=window.SZO_DATA&&window.SZO_DATA.items;
 const source=(Array.isArray(window.items)&&window.items.length&&window.items)||
  (Array.isArray(shared)&&shared.length&&shared)||
  (Array.isArray(bundled)&&bundled.length&&bundled)||
  (Array.isArray(items)&&items.length&&items);
 if(source&&source.length){
  items=source;
  window.items=source;
  itemIndex={};
  source.forEach(it=>{itemIndex[String(it.ID).trim()]=it;});
  window.itemIndex=itemIndex;
  window.SZO_DATA=window.SZO_DATA||{};
  window.SZO_DATA.items=source;
  window.SZO_DATA.itemIndex=itemIndex;
  try{if(typeof SZO_SYNC_DATA==='function')SZO_SYNC_DATA();}catch(e){}
  return true;
 }
 return itemIndex&&Object.keys(itemIndex).length>0;
}

function ensureMonsterDropItemNames(id){
 if(syncMonsterItemDataForDrops())return Promise.resolve(true);
 if(typeof loadDataBundle==='function'){
  return loadDataBundle('items').then(data=>{
   if(Array.isArray(data)&&data.length){
    items=data;
    syncMonsterItemDataForDrops();
    return true;
   }
   return false;
  }).catch(()=>false);
 }
 if(typeof loadItemDataFromJson==='function'){
  return loadItemDataFromJson().then(()=>syncMonsterItemDataForDrops()).catch(()=>false);
 }
 return Promise.resolve(false);
}

function monsterDropRows(m){
 syncMonsterItemDataForDrops();
 return parseDrop(m.DropItem).map(([iid,rate])=>{
  const it=itemIndex[String(iid).trim()]||{};
  return [iid,it.Name||it.name||`道具 ID ${iid}`,rate.toFixed(6)+'%'];
 });
}

function monsterDropsTableHTML(drops){
 return drops.length?`<div class="tableWrap monsterDropTable"><table><thead><tr><th>道具</th><th>機率</th></tr></thead><tbody>${drops.map(r=>`<tr><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">沒有掉落資料</div>';
}

function showMonsterDropPage(id){
 window.v86LastView='monsterDrop';
 try{history.pushState({app:'detail',view:'monsterDrop'},'','#monster-drop-'+id);}catch(e){}
 const m=monsters.find(x=>String(x.ID).trim()===String(id).trim()); if(!m)return;
 if(!syncMonsterItemDataForDrops()){
  byId('reader').innerHTML=`<section class="card monsterDropPage"><button class="backBtn" type="button" onclick="showMonster('${esc(id)}')">← 返回怪物資料</button><h1>${esc(nameOf(m))}：掉落資料</h1><div class="empty">正在載入道具名稱，請稍候。</div></section>`;
  ensureMonsterDropItemNames(id).then(()=>{if(location.hash==='#monster-drop-'+id)showMonsterDropPage(id);});
  closeDrawer();window.scrollTo({top:0,behavior:'smooth'});
  return;
 }
 byId('reader').innerHTML=`<section class="card monsterDropPage"><button class="backBtn" type="button" onclick="showMonster('${esc(id)}')">← 返回怪物資料</button><h1>${esc(nameOf(m))}：掉落資料</h1>${monsterDropsTableHTML(monsterDropRows(m))}</section>`;
 closeDrawer();window.scrollTo({top:0,behavior:'smooth'});
}

async function showMonsterMapLocations(id, name){
 if(typeof showPageLoading==='function')showPageLoading('地圖查詢','正在載入這隻怪物的地圖位置，請稍候。');
 if(typeof ensureMapPageLoaded==='function')await ensureMapPageLoaded();
 if(typeof openMonsterMapLocations==='function')await openMonsterMapLocations(id, name);
 document.querySelectorAll('.navBtn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='map'));
 document.querySelectorAll('.formBox').forEach(f=>f.classList.remove('active'));
 if(typeof closeDrawer==='function')closeDrawer();
 window.scrollTo({top:0,behavior:'smooth'});
}

function monsterRowsHTML(rows,cls=''){
 const show=rows.filter(x=>x[1]!==''&&x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=='0');
 return `<div class="kvGrid ${cls}">${show.map(([k,v])=>`<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
}

function showMonster(id,skipPush){
 window.v86LastView='monster';
 if(!skipPush){try{history.pushState({app:'detail',view:'monster'},'','#monster-'+id);}catch(e){}}
 if(!hasMonsterData()&&typeof window.ensureMonsterDataLoaded==='function'){
  byId('reader').innerHTML=`<section class="card"><button class="backBtn" type="button" onclick="goBackToPrevious('monster')">← 返回怪物查詢</button><h1>怪物資料讀取中</h1><div class="muted">正在載入完整怪物資料，請稍等。</div></section>`;
  window.ensureMonsterDataLoaded().then(ok=>{if(ok&&location.hash==='#monster-'+id)showMonster(id,true);});
  return;
 }
 const m=monsters.find(x=>String(x.ID).trim()===String(id).trim()); if(!m)return;
 ensureMonsterOptionalData(String(id));
 const loc=locOf(nameOf(m));
 const drops=monsterDropRows(m);
 const basic=[
  ['ID',m.ID],['怪物名稱',nameOf(m)],['等級',m.Level],['生命',m.HP],['精力',m.MP],
  ['種族',raceName(m.Type)],['子分類',subtypeName(m.Type,m.SubType)],['經驗',m.DropExp],
  ['金錢',monsterMoneyText(m)],['位置',loc]
 ];
 const stats=[['體魄',m.Con],['力量',m.Str],['智慧',m.Int],['靈敏',m.Dex]];
 const defense=[
  ['物理防禦',m.ExtraDef],['術法攻擊',m.MagicAttack],['術法防禦',m.MagicDef],
  ['冰防',m.IceDef],['火防',m.FireDef],['雷防',m.LightningDef],['冥防',m.DarkDef],
  ['抗定身',m.ParalysisRes],['抗毒',m.PosionRes],['抗盲目',m.BlindRes],['抗禁咒',m.SilentRes]
 ];
 const skills=[
  ['技能1',monsterSkillText(m.Skill1)],['技能2',monsterSkillText(m.Skill2)],
  ['技能3',monsterSkillText(m.Skill3)],['技能4',monsterSkillText(m.Skill4)]
 ];
 const defenseVisible=defense.some(x=>x[1]!==''&&x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=='0');
 const skillVisible=skills.some(x=>x[1]!==''&&x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=='0');
 const breakNote=m.ExtraDef?`<div class="muted" style="margin-top:10px;font-weight:800">${esc(monsterBreakSuggestText(m.ExtraDef))}</div>`:'';
 const hero=monsterThumbHTML(m).replace('assetThumb monsterThumb','assetHero monsterHero');
 const beastTags=beastByMonsterId(id).map(row=>`<span class="beastTag">封獸 · ${esc(row.stars)}星甕</span>`).join('');
 byId('reader').innerHTML=`<section class="card monsterCompact">
  <button class="backBtn" type="button" onclick="goBackToPrevious()">← 返回怪物查詢</button>
  <div class="assetPreviewPanel monsterPreviewPanel">
    <div class="assetArtPanel">${hero}<h1>${esc(nameOf(m))}</h1>${beastTags}</div>
    <div class="assetInfoPanel">
      <div class="monsterTopActions">
        <button type="button" class="mapJumpBtn" onclick="showMonsterMapLocations('${esc(id)}','${esc(nameOf(m))}')">查看地圖位置<small>顯示出現地圖與點位</small></button>
        <button type="button" class="primary" onclick="showMonsterDropPage('${esc(id)}')">查看掉落資訊<small>${drops.length?`共 ${drops.length} 筆掉落資料`:'沒有掉落資料'}</small></button>
      </div>
      <div class="monsterPanel"><h3>怪物資料</h3>${monsterRowsHTML(basic,'monsterDataGrid')}</div>
      <div class="monsterPanel"><h3>能力資訊</h3>${monsterRowsHTML(stats,'monsterStatGrid')}</div>
    </div>
  </div>
  <div class="monsterGrid">
    ${defenseVisible?`<div class="monsterPanel"><h3>防禦資訊</h3>${monsterRowsHTML(defense,'monsterDefenseGrid')}${breakNote}</div>`:''}
    ${skillVisible?`<div class="monsterPanel monsterSkillPanel"><h3>技能資訊</h3>${monsterRowsHTML(skills,'monsterSkillGrid')}</div>`:''}
  </div>
 </section>`;
 closeDrawer();window.scrollTo({top:0,behavior:'smooth'});
}

window.parseDrop=parseDrop;
window.renderMonsterPage=renderMonsterPage;
window.searchMonstersMain=searchMonstersMain;
window.searchMonsters=searchMonstersMain;
window.clearMonsterSearchFilters=clearMonsterSearchFilters;
window.monsterSkillText=monsterSkillText;
window.showMonster=showMonster;
window.showMonsterDropPage=showMonsterDropPage;
window.showMonsterMapLocations=showMonsterMapLocations;
window.setMonsterQueryMode=setMonsterQueryMode;
window.selectBeastStars=selectBeastStars;
window.showBeastDetail=showBeastDetail;
