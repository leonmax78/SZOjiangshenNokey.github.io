// V256: clean item/reverse pages, latest item list, and bundle self-loading.
let itemOptionalRefreshPromise=null;
let itemSeriesMapCache=null;
let itemSeriesOptionsCache=null;
let itemKindOptionsCache=null;
let itemSeriesRefreshPromise=null;

function itemTypeName(t){return ITEM_TYPE_MAP[String(t||'').trim()]||''}

function itemKind(it){
 const candidates=[it.Kind,it.kind,it.RaceKind,it.Race,it.TargetRace,it.TargetKind].filter(v=>v!==undefined&&String(v).trim()!=='');
 for(const v of candidates){
  const h=normHex(v);
  if(h&&h!=='0x00000000'){
   const n=raceName(h);
   if(n)return n;
  }
 }
 return '';
}

function itemStatus(it){
 const raw=String(it?.ExtraStatus||'').trim();
 if(!raw||raw==='0')return '';
 const parts=raw.split(/[,\s;]+/).filter(Boolean);
 const names=parts.map(x=>statusName(x)||magicName(x)||(/^\d+$/.test(String(x))||/^0x/i.test(String(x))?`StatusID:${x}`:'')).filter(Boolean);
 return [...new Set(names)].join('、');
}

function itemDetailRows(it){
 const rows=[];
 for(const k of ITEM_DETAIL_ORDER){
  if(k==='Damage'){
   if(it.DamageMin||it.DamageMax)rows.push(['傷害',`${it.DamageMin||''}~${it.DamageMax||''}`]);
   continue;
  }
  if(k==='Type'){
   const typeName=itemTypeName(it.Type)||it.Type;
   if(typeName)rows.push(['類型',typeName]);
   continue;
  }
  if(k==='Kind'){
   const kindName=itemKind(it);
   if(kindName)rows.push(['專剋',kindName]);
   continue;
  }
  if(k==='ExtraStatus'){
   const st=itemStatus(it);
   if(st)rows.push(['特殊能力',st]);
   continue;
  }
  if(k in it&&String(it[k]??'').trim()!=='')rows.push([ITEM_DETAIL_RENAME[k]||k,it[k]]);
 }
 if(it.Help)rows.push(['說明',it.Help]);
 return rows;
}

function itemAbilityFields(it){
 const abilityKeys=new Set(['CLevel','HP','MP','Con','Str','Int','Dex','ExtraDef','Damage','MagicAttack','MagicDef','IceDef','FireDef','LightningDef','DarkDef','ParalysisRes','PosionRes','BlindRes','SilentRes','Value']);
 return itemDetailRows(it).filter(([label])=>{
  const reverse=Object.entries(ITEM_DETAIL_RENAME).find(([,v])=>v===label)?.[0];
  if(label==='傷害')return true;
  return abilityKeys.has(reverse||label);
 });
}

function itemSearchText(it){
 return `${nameOf(it)} ${it.ID||''} ${it.Level||''} ${it.Type||''} ${itemTypeName(it.Type)} ${itemKind(it)} ${it.Help||''}`.toLowerCase();
}

function uniqText(arr){
 return [...new Set((arr||[]).map(v=>String(v??'').trim()).filter(Boolean))];
}

function optionHtml(values,selected,label){
 return `<option value="">${esc(label)}</option>`+(values||[]).map(v=>`<option value="${esc(v)}" ${String(v)===String(selected||'')?'selected':''}>${esc(v)}</option>`).join('');
}

function itemEquipmentRows(){
 try{
  if(typeof eqEquipList==='function')return (eqEquipList()||[]).filter(Boolean);
  if(typeof eqData==='function')return ((eqData().equipment)||[]).filter(Boolean);
 }catch(e){}
 try{return ((typeof EQUIP_COMPOUND_DATA!=='undefined'&&EQUIP_COMPOUND_DATA&&EQUIP_COMPOUND_DATA.equipment)||[]).filter(Boolean)}catch(e){}
 return [];
}

function itemEquipmentId(eq){
 return String(eq?.item_id||eq?.Item||eq?.ID||'').trim();
}

function itemEquipmentSeries(eq){
 return String(eq?.series_group||eq?.series||'').trim();
}

function itemSeriesLabel(series){
 const raw=String(series||'').trim();
 if(!raw)return '';
 return raw.replace(/\(.+\)$/,'');
}

function itemSeriesMap(){
 if(itemSeriesMapCache)return itemSeriesMapCache;
 const bundle=window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.item_series;
 if(bundle&&bundle.byId){
  const map=new Map();
  Object.entries(bundle.byId).forEach(([id,list])=>{
   map.set(String(id),new Set((Array.isArray(list)?list:[]).map(itemSeriesLabel).filter(Boolean)));
  });
  itemSeriesMapCache=map;
  return itemSeriesMapCache;
 }
 const map=new Map();
 for(const eq of itemEquipmentRows()){
  const id=itemEquipmentId(eq);
  const series=itemSeriesLabel(itemEquipmentSeries(eq));
  if(!id||!series)continue;
  if(!map.has(id))map.set(id,new Set());
  map.get(id).add(series);
 }
 itemSeriesMapCache=map;
 return itemSeriesMapCache;
}

function resetItemSeriesCache(){
 itemSeriesMapCache=null;
 itemSeriesOptionsCache=null;
}

function itemKindBundle(){
 return window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.item_kind;
}

function itemKindOptions(){
 if(itemKindOptionsCache)return itemKindOptionsCache;
 const bundle=itemKindBundle();
 if(bundle&&Array.isArray(bundle.kinds)){
  itemKindOptionsCache=uniqText(bundle.kinds);
  return itemKindOptionsCache;
 }
 itemKindOptionsCache=uniqText((items||[]).map(it=>itemKind(it))).sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 return itemKindOptionsCache;
}

function itemMatchesKind(it,kind){
 if(!kind)return true;
 const id=String(it?.ID||it?.id||'').trim();
 const bundle=itemKindBundle();
 if(bundle&&bundle.byId&&id)return bundle.byId[id]===kind;
 return itemKind(it)===kind;
}

function itemSeriesOptions(){
 if(itemSeriesOptionsCache)return itemSeriesOptionsCache;
 const bundle=window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.item_series;
 if(bundle&&Array.isArray(bundle.series)){
  itemSeriesOptionsCache=uniqText(bundle.series);
  return itemSeriesOptionsCache;
 }
 const preferred=['職業裝','世貿裝','特仕裝','五佐','五絕','掉寶','經驗','仙器'];
 const rawSeries=uniqText(itemEquipmentRows().map(eq=>itemSeriesLabel(itemEquipmentSeries(eq))));
 itemSeriesOptionsCache=rawSeries.sort((a,b)=>{
  const ia=preferred.indexOf(a),ib=preferred.indexOf(b);
  if(ia>=0||ib>=0)return (ia>=0?ia:999)-(ib>=0?ib:999);
  return a.localeCompare(b,'zh-Hant');
 });
 return itemSeriesOptionsCache;
}

function fillItemAdvancedFilters(){
 const typeSel=byId('itemType');
 if(typeSel){
  typeSel.innerHTML='<option value="">全部類型</option>'+Object.entries(ITEM_TYPE_MAP||{}).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');
  typeSel.value=window.v86ItemType||'';
 }
 const kindSel=byId('itemKind');
 if(kindSel){
  const kinds=itemKindOptions();
  kindSel.innerHTML=optionHtml(kinds,window.v110ItemKind||'','全部專剋');
 }
 const seriesSel=byId('itemEqSeries');
 if(seriesSel){
  const series=itemSeriesOptions();
  seriesSel.innerHTML=optionHtml(series,window.v110ItemEqSeries||'',series.length?'全部系列':'系列載入中');
 }
}

function itemMatchesSeries(it,series){
 if(!series)return true;
 const map=itemSeriesMap();
 const hit=map.get(String(it?.ID||'').trim());
 return !!(hit&&hit.has(series));
}

function refreshItemSeriesWhenReady(){
 const seriesSel=byId('itemEqSeries');
 if(!seriesSel||itemSeriesRefreshPromise)return;
 if(window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.item_series){
  resetItemSeriesCache();
  fillItemAdvancedFilters();
  searchItems();
  return;
 }
 if(typeof ensureCompoundDataLoaded!=='function')return;
 itemSeriesRefreshPromise=ensureCompoundDataLoaded().then(ok=>{
  if(!ok||!byId('itemEqSeries'))return;
  resetItemSeriesCache();
  fillItemAdvancedFilters();
  searchItems();
 }).finally(()=>{
  itemSeriesRefreshPromise=null;
 });
}
window.refreshItemSeriesWhenReady=refreshItemSeriesWhenReady;

function hasItemData(){
 return (Array.isArray(window.items)&&window.items.length)||(window.SZO_DATA&&Array.isArray(window.SZO_DATA.items)&&window.SZO_DATA.items.length);
}
function itemSearchIndexRows(){
 const bundles=window.SZO_DATA_BUNDLES||{};
 const data=bundles.search_items||bundles.search_index;
 return data&&Array.isArray(data.items)?data.items:[];
}
function hasItemSearchIndex(){return itemSearchIndexRows().length>0}
function itemIndexTypeName(row){return itemTypeName(row.type)||row.type||''}
function itemIndexSearchText(row){return `${row.name||''} ${row.id||''} ${row.level||''} ${row.type||''} ${itemIndexTypeName(row)}`.toLowerCase()}
function filterItemIndexList(q,type,min,max,series,kind){
 const qText=(q||'').trim().toLowerCase();
 const minLv=min?intOf(min):null;
 const maxLv=max?intOf(max):null;
 return itemSearchIndexRows().filter(it=>
  (!qText||itemIndexSearchText(it).includes(qText))&&
  (!type||it.type===type)&&
  (minLv===null||intOf(it.level)>=minLv)&&
  (maxLv===null||intOf(it.level)<=maxLv)&&
  (!series||itemMatchesSeries({ID:it.id},series))&&
  itemMatchesKind({ID:it.id},kind)
 ).slice(0,180);
}
function itemIndexResultsHTML(arr){
 return arr.map(it=>`<button class="resultItem" data-item="${esc(it.id)}"><div class="rName">${esc(it.name)}</div><div class="rSub">Lv.${esc(it.level||'')} / ${esc(itemIndexTypeName(it))} / ID ${esc(it.id||'')}</div></button>`).join('')||'<div class="muted">找不到符合條件的道具。</div>';
}

function itemThumbHTML(it){const src=window.SZO_ASSET_MEDIA&&window.SZO_ASSET_MEDIA.itemIconSrc(it);return window.SZO_ASSET_MEDIA?window.SZO_ASSET_MEDIA.img(src,nameOf(it)||it.name,'assetThumb itemThumb'):''}
function startItemFullDataLoad(){
 if(hasItemData())return;
 const loader=typeof window.ensureItemDataLoaded==='function'?window.ensureItemDataLoaded:window.ensureLookupDataLoaded;
 if(typeof loader!=='function')return;
 loader().then(ok=>{
  if(!ok)return;
  if(byId('itemLatestList'))byId('itemLatestList').innerHTML=latestItemsHTML();
  if(byId('itemResults'))searchItems();
 });
}

function hasReverseData(){
 const d=window.SZO_DATA||{};
 return (d.dropReverse&&Object.keys(d.dropReverse).length)||(window.dropReverse&&Object.keys(window.dropReverse).length);
}

async function ensureReverseBundlesLoaded(){
 if(hasReverseData())return true;
 try{
   if(typeof loadDataBundle==='function'){
    const [itemData,monsterData,reverseData]=await Promise.all([
     loadDataBundle('items'),
     loadDataBundle('monsters'),
     loadDataBundle('drop_reverse')
    ]);
    if(Array.isArray(itemData)&&itemData.length){
     items=itemData;
     itemIndex={};
     for(const it of items)itemIndex[String(it.ID).trim()]=it;
    }
    if(Array.isArray(monsterData)&&monsterData.length){
     monsters=monsterData;
     const monsterById={};
     for(const m of monsters)monsterById[String(m.ID).trim()]=m;
     dropReverse={};
     if(reverseData&&typeof reverseData==='object'&&!Array.isArray(reverseData)){
      for(const [itemId,rows] of Object.entries(reverseData)){
       dropReverse[String(itemId)]=(rows||[]).map(row=>{
        const monster=monsterById[String(row.monsterId)]||{ID:row.monsterId,Name:row.monsterName};
        return {monster,rate:Number(row.rate)||0,weight:Number(row.weight)||0};
       }).filter(x=>x.monster);
      }
     }else{
      for(const m of monsters){
       for(const [iid,rate] of parseDrop(m.DropItem)){
        if(!dropReverse[iid])dropReverse[iid]=[];
        dropReverse[iid].push({monster:m,rate});
       }
      }
     }
     for(const iid of Object.keys(dropReverse)){
      const map=new Map();
      for(const row of dropReverse[iid]){
       const key=String(row.monster?.ID||nameOf(row.monster)||'').trim();
       if(!map.has(key)||(row.rate||0)>(map.get(key).rate||0))map.set(key,row);
      }
      dropReverse[iid]=[...map.values()].sort((a,b)=>(b.rate||0)-(a.rate||0));
     }
    }
    if(typeof window.SZO_SYNC_DATA==='function')window.SZO_SYNC_DATA();
    if(hasReverseData())return true;
   }
  }catch(e){console.warn('ensureReverseBundlesLoaded failed',e)}
 if(typeof window.ensureLookupDataLoaded==='function'){
  const ok=await window.ensureLookupDataLoaded();
  if(ok)return hasReverseData();
 }
 return hasReverseData();
}

function ensureItemOptionalData(id){
 if(itemOptionalRefreshPromise)return itemOptionalRefreshPromise;
 if((statusIndex&&Object.keys(statusIndex).length)&&(magicIndex&&Object.keys(magicIndex).length))return Promise.resolve(true);
 if(typeof loadDataBundle!=='function')return Promise.resolve(false);
 itemOptionalRefreshPromise=Promise.allSettled([
  loadDataBundle('status').then(data=>{if(Array.isArray(data))statuses=data;}),
  loadDataBundle('magic').then(data=>{if(Array.isArray(data))magics=data;})
 ]).then(()=>{
  statusIndex={};magicIndex={};
  for(const s of statuses||[])statusIndex[String(intOf(s.ID))]=s;
  for(const m of magics||[])magicIndex[String(m.ID).trim()]=m;
  try{if(typeof SZO_SYNC_DATA==='function')SZO_SYNC_DATA();}catch(e){}
  itemOptionalRefreshPromise=null;
  if(id&&location.hash==='#item-'+id)showItem(id,true);
  return true;
 }).catch(()=>{itemOptionalRefreshPromise=null;return false;});
 return itemOptionalRefreshPromise;
}

function latestItemsHTML(limit=320){
 if(!hasItemData())return '<div class="muted">資料載入中，請稍等。</div>';
 return (items||[]).slice().reverse().slice(0,limit).map(it=>`<button type="button" class="resultItem withAsset" data-item="${esc(it.ID)}">${itemThumbHTML(it)}<span class="resultText"><div class="rName">${esc(nameOf(it))}</div><div class="rSub">Lv.${esc(it.Level||'')} / ${esc(itemTypeName(it.Type)||it.Type||'')} / ID ${esc(it.ID||'')}</div></span></button>`).join('');
}

async function renderItemPage(tab='item'){
 const activeItem=tab==='item';
 const activeReverse=tab==='reverse';
 if(tab==='compound'){
  if(typeof showPageLoading==='function')showPageLoading('常用裝備配方合成模擬');
  else byId('reader').innerHTML='<section class="card pageLoadingCard"><h1>常用裝備配方合成模擬讀取中</h1><div class="muted">正在載入配方與裝備資料，請稍等。</div></section>';
  if(typeof ensureCompoundDataLoaded==='function'){
   const ok=await ensureCompoundDataLoaded();
   if(!ok)return;
  }
  renderEquipmentCompoundPage();
  return;
 }
 byId('reader').innerHTML=activeItem?`<section class="card latestSearchPage itemAdvancedSearchPage"><h1>道具查詢</h1>
  <div class="latestQueryLayout">
    <div class="latestMainPane">
      <div class="kvGrid">
        <div class="kv"><div class="k">道具名稱 / ID / 類型</div><div class="v"><input id="itemQ" placeholder="例如：經驗丹、藥草、277、火傷" value="${esc(window.v86ItemQ||'')}" oninput="searchItems()"></div></div>
        <div class="kv"><div class="k">類型</div><div class="v"><select id="itemType" onchange="searchItems()"></select></div></div>
        <div class="kv"><div class="k">最低 Lv</div><div class="v"><input id="itemMin" type="number" value="${esc(window.v86ItemMin||'')}" oninput="searchItems()"></div></div>
        <div class="kv"><div class="k">最高 Lv</div><div class="v"><input id="itemMax" type="number" value="${esc(window.v86ItemMax||'')}" oninput="searchItems()"></div></div>
        <div class="kv"><div class="k">系列快選</div><div class="v"><select id="itemEqSeries" onfocus="refreshItemSeriesWhenReady()" onchange="searchItems()"></select></div></div>
        <div class="kv"><div class="k">專剋屬性</div><div class="v"><select id="itemKind" onchange="searchItems()"></select></div></div>
      </div>
      <div class="itemFilterActions"><button type="button" onclick="clearItemSearchFilters()">清空篩選</button></div>
      <div class="notice itemFilterNote">系列快選依合成模擬清單建立；類型依 ITEM.INI 原始欄位篩選。</div>
      <div class="results" id="itemResults"></div>
    </div>
    <aside class="latestSidePane">
      <div class="latestSideTitle">最新道具清單</div>
      <div class="latestSideHint">依 ITEM.INI 原始順序反向顯示，越新的道具越上面。</div>
      <div class="latestList" id="itemLatestList">${latestItemsHTML()}</div>
    </aside>
  </div>
 </section>`:`<section class="card"><h1>掉落反查</h1>
  <div class="kvGrid"><div class="kv"><div class="k">輸入道具名稱</div><div class="v"><input id="reverseQ" placeholder="例如：獄魔灼血、30200" value="${esc(window.v86ReverseQ||'')}" oninput="searchReverseItems()"></div></div></div>
  <div class="results" id="reverseResults"></div>
 </section>`;
 fillItemAdvancedFilters();
 if(activeItem){
  startItemFullDataLoad();
  if(hasItemData()||hasItemSearchIndex())searchItems();
  else{
   byId('itemResults').innerHTML='<div class="muted">資料載入中，請稍等。</div>';
   const loader=typeof window.ensureItemSearchIndexLoaded==='function'?window.ensureItemSearchIndexLoaded:(typeof window.ensureSearchIndexLoaded==='function'?window.ensureSearchIndexLoaded:window.ensureLookupDataLoaded);
   if(typeof loader==='function')loader().then(ok=>{if(ok)renderItemPage('item');else byId('itemResults').innerHTML='<div class="empty">?????????</div>';});
  }
 }else if(activeReverse){
  if(hasReverseData())searchReverseItems();
  else{
   byId('reverseResults').innerHTML='<div class="muted">資料載入中，請稍等。</div>';
   ensureReverseBundlesLoaded().then(ok=>{if(ok)searchReverseItems();else byId('reverseResults').innerHTML='<div class="empty">反查資料載入失敗。</div>';});
  }
 }
}

function openItemMenuOnly(){
 currentView='item';
 document.querySelectorAll('.navBtn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='item'));
 document.querySelectorAll('.formBox').forEach(f=>f.classList.remove('active'));
 byId('itemForm')?.classList.add('active');
 byId('reader').innerHTML='';
}

async function setItemSub(kind){
 openItemMenuOnly();
 if(kind==='item'){await renderItemPage('item');closeDrawer();window.scrollTo({top:0,behavior:'smooth'});}
 if(kind==='reverse'){await renderItemPage('reverse');closeDrawer();window.scrollTo({top:0,behavior:'smooth'});}
 if(kind==='compound'){await renderItemPage('compound');closeDrawer();window.scrollTo({top:0,behavior:'smooth'});}
}

function searchItems(){
 const itemQ=byId('itemQ'); if(!itemQ)return;
 window.v86ItemQ=itemQ.value;
 window.v86ItemType=byId('itemType')?.value||'';
 window.v86ItemMin=byId('itemMin')?.value||'';
 window.v86ItemMax=byId('itemMax')?.value||'';
 window.v110ItemEqSeries=byId('itemEqSeries')?.value||'';
 window.v110ItemKind=byId('itemKind')?.value||'';
 const q=itemQ.value.trim().toLowerCase();
 const type=window.v86ItemType;
 const min=window.v86ItemMin?intOf(window.v86ItemMin):null;
 const max=window.v86ItemMax?intOf(window.v86ItemMax):null;
 const series=window.v110ItemEqSeries;
 const kind=window.v110ItemKind;
 const box=byId('itemResults'); if(!box)return;
 if(!hasItemData()&&!hasItemSearchIndex()){box.innerHTML='<div class="muted">資料載入中，請稍等。</div>';return;}
 if(!(q||type||window.v86ItemMin||window.v86ItemMax||series||kind)){box.innerHTML='';return;}
 if(!hasItemData()){
  box.innerHTML=itemIndexResultsHTML(filterItemIndexList(q,type,window.v86ItemMin,window.v86ItemMax,series,kind));
  return;
 }
 const arr=items.filter(it=>
  (!q||itemSearchText(it).includes(q))&&
  (!type||it.Type===type)&&
  (min===null||intOf(it.Level)>=min)&&
  (max===null||intOf(it.Level)<=max)&&
  itemMatchesKind(it,kind)&&
  itemMatchesSeries(it,series)
 ).slice(0,180);
 box.innerHTML=arr.map(it=>{
  const parts=[`Lv.${esc(it.Level||'')}`,esc(itemTypeName(it.Type)||it.Type||''),itemKind(it)?`專剋 ${esc(itemKind(it))}`:'',`ID ${esc(it.ID)}`].filter(Boolean);
  return `<button class="resultItem withAsset" data-item="${esc(it.ID)}">${itemThumbHTML(it)}<span class="resultText"><div class="rName">${esc(nameOf(it))}</div><div class="rSub">${parts.join(' / ')}</div></span></button>`;
 }).join('')||'<div class="muted">沒有符合的道具。</div>';
}

function clearItemSearchFilters(){
 window.v86ItemQ='';
 window.v86ItemType='';
 window.v86ItemMin='';
 window.v86ItemMax='';
 window.v110ItemEqSeries='';
 window.v110ItemKind='';
 ['itemQ','itemType','itemMin','itemMax','itemEqSeries','itemKind'].forEach(id=>{
  const el=byId(id);
  if(el)el.value='';
 });
 searchItems();
}

function showItem(id,skipPush){
 window.v86LastView='item';
 if(!skipPush){try{history.pushState({app:'detail',view:'item'},'','#item-'+id);}catch(e){}}
 if(!hasItemData()&&typeof window.ensureItemDataLoaded==='function'){
  byId('reader').innerHTML=`<section class="card"><button class="backBtn" type="button" onclick="goBackToPrevious('item')">← 返回道具查詢</button><h1>道具資料讀取中</h1><div class="muted">正在載入完整道具資料，請稍等。</div></section>`;
  window.ensureItemDataLoaded().then(ok=>{if(ok)showItem(id,true);});
  return;
 }
 const it=itemIndex[String(id).trim()]; if(!it)return;
 ensureItemOptionalData(String(id));
 const rows=itemDetailRows(it).filter(x=>x[1]!==''&&x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=='0');
 const compactRows=rows.filter(([k,v])=>k!=='說明'&&String(v).length<=32);
 const fullRows=rows.filter(([k,v])=>k==='說明'||String(v).length>32);
 const kvHtml=compactRows.map(([k,v])=>{
  return `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
 }).join('');
 const fullHtml=fullRows.map(([k,v])=>{
  const cls=k==='說明'?' itemFullRow itemHelpRow':' itemFullRow';
  return `<div class="kv${cls}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
 }).join('');
 const hero=itemThumbHTML(it).replace('assetThumb itemThumb','assetHero itemHero');
 byId('reader').innerHTML=`<section class="card itemCompact itemDetailCompact"><button class="backBtn" type="button" onclick="goBackToPrevious('item')">← 返回道具查詢</button><div class="assetPreviewPanel itemPreviewPanel"><div class="assetArtPanel">${hero}<h1>${esc(nameOf(it))}</h1></div><div class="assetInfoPanel"><div class="kvGrid itemDataGrid">${kvHtml}</div></div></div>${fullHtml?`<div class="kvGrid itemDetailExtra">${fullHtml}</div>`:''}<div class="quick"><button type="button" data-reverse-item="${esc(it.ID)}">反查掉落怪物<small>查看哪些怪物會掉這個道具</small></button></div></section>`;
 closeDrawer();window.scrollTo({top:0,behavior:'smooth'});
}

window.SZO_ITEM_MODULE={itemTypeName,itemKind,itemStatus,itemDetailRows,itemAbilityFields,itemSearchText,renderItemPage,openItemMenuOnly,setItemSub,searchItems,showItem};
window.renderItemPage=renderItemPage;
window.openItemMenuOnly=openItemMenuOnly;
window.setItemSub=setItemSub;
window.searchItems=searchItems;
window.clearItemSearchFilters=clearItemSearchFilters;
window.showItem=showItem;
