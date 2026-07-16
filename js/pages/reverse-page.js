// V226: formal reverse lookup module.
// Flow: search ITEM.INI records, use the selected item ID, then read the prebuilt MONSTER_C.INI DropItem reverse index.
(function(){
  let reverseMapPromise=null;
  let reverseMapMonsterIds=null;
  function by(id){return document.getElementById(id)}
  function escHtml(s){
    if(typeof esc==='function')return esc(s);
    return String(s??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
  }
  function nameOfSafe(o){
    try{return typeof nameOf==='function'?nameOf(o):String(o?.Name||'').trim()}catch(e){return String(o?.Name||'').trim()}
  }
  function typeNameSafe(it){
    try{return (typeof itemTypeName==='function'?itemTypeName(it?.Type):'') || it?.Type || ''}catch(e){return it?.Type||''}
  }
  function locSafe(monsterName){
    const key=String(monsterName||'').trim();
    if(!key)return '';
    const sources=[
      window.SZO_DATA&&window.SZO_DATA.locations,
      window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.locations,
      window.monsterLocations
    ];
    for(const src of sources){
      if(src && typeof src==='object' && !Array.isArray(src) && src[key])return src[key];
    }
    try{return typeof locOf==='function'?locOf(key):''}catch(e){return ''}
  }
  async function ensureReverseMapData(){
    if(reverseMapMonsterIds)return reverseMapMonsterIds;
    if(!reverseMapPromise){
      reverseMapPromise=fetch('data/stage_maps.json?v='+encodeURIComponent(document.body?.dataset?.version||'dev'),{cache:'force-cache'})
        .then(function(res){if(!res.ok)throw new Error('stage map data load failed');return res.json();})
        .then(function(data){
          const ids=new Set();
          (data?.stages||[]).forEach(function(stage){
            (stage.monsters||[]).forEach(function(monster){
              if(monster?.id!==undefined && monster?.id!==null)ids.add(String(monster.id));
            });
          });
          reverseMapMonsterIds=ids;
          return ids;
        })
        .catch(function(){reverseMapMonsterIds=new Set();return reverseMapMonsterIds;});
    }
    return reverseMapPromise;
  }
  function hasMapPoint(monsterId){
    return !!(reverseMapMonsterIds && reverseMapMonsterIds.has(String(monsterId||'')));
  }
  window.ensureReverseMapData=ensureReverseMapData;
  window.hasReverseMapPoint=hasMapPoint;
  function sync(){
    try{ if(typeof window.SZO_SYNC_DATA==='function') window.SZO_SYNC_DATA(); }catch(e){console.warn('SZO_SYNC_DATA failed',e)}
    return window.SZO_DATA || {};
  }
  let reverseDataPromise=null;
  async function ensureReverseDataLoaded(){
    if(reverseDataPromise)return reverseDataPromise;
    reverseDataPromise=(async function(){
      if(typeof window.ensureReverseBundlesLoaded==='function'){
        try{await window.ensureReverseBundlesLoaded();}catch(e){}
      }else if(typeof loadDataBundle==='function'){
        try{await loadDataBundle('search_items');}catch(e){}
      }
      const d=sync();
      if((!d.locations || !Object.keys(d.locations||{}).length) && typeof loadDataBundle==='function'){
        try{
          const locs=await loadDataBundle('locations');
          if(locs && typeof locs==='object' && !Array.isArray(locs)){
            try{monsterLocations=locs;}catch(e){}
            window.monsterLocations=locs;
          }
        }catch(e){}
      }
      sync();
    })();
    try{await reverseDataPromise;}finally{reverseDataPromise=null;}
  }
  function getSearchItems(){
    const bundles=window.SZO_DATA_BUNDLES||{};
    const data=bundles.search_items||bundles.search_index;
    return data&&Array.isArray(data.items)?data.items:[];
  }
  function liteItem(row){
    return {ID:String(row.id||row.ID||''),Name:row.name||row.Name||'',Type:row.type||row.Type||'',Level:row.level||row.Level||''};
  }
  function getItems(){
    const d=sync();
    if(Array.isArray(d.items) && d.items.length)return d.items;
    try{ if(Array.isArray(items) && items.length)return items; }catch(e){}
    if(Array.isArray(window.items) && window.items.length)return window.items;
    const searchRows=getSearchItems();
    if(searchRows.length)return searchRows.map(liteItem);
    return [];
  }
  function getItemIndex(){
    const d=sync();
    if(d.itemIndex && Object.keys(d.itemIndex).length)return d.itemIndex;
    try{ if(itemIndex && Object.keys(itemIndex).length)return itemIndex; }catch(e){}
    return window.itemIndex || {};
  }
  function getDropReverse(){
    const d=sync();
    if(d.dropReverse && Object.keys(d.dropReverse).length)return d.dropReverse;
    try{ if(dropReverse && Object.keys(dropReverse).length)return dropReverse; }catch(e){}
    return window.dropReverse || {};
  }
  function itemText(it){
    let kind='',status='';
    try{kind=typeof itemKind==='function'?itemKind(it):'';}catch(e){}
    try{status=typeof itemStatus==='function'?itemStatus(it):'';}catch(e){}
    return [
      nameOfSafe(it),it?.ID,it?.Level,it?.CLevel,it?.Type,
      typeNameSafe(it),it?.Help,it?.Magic,it?.Icon,it?.GIcon,
      kind,status
    ].join(' ').toLowerCase();
  }
  function uniqById(arr){
    const map=new Map();
    (arr||[]).forEach(function(it){
      const key=String(it?.ID||'').trim() || nameOfSafe(it);
      if(key && !map.has(key))map.set(key,it);
    });
    return Array.from(map.values());
  }
  function renderReverseResults(arr,total){
    const box=by('reverseResults');
    if(!box)return;
    box.innerHTML=arr.map(function(it){
      return '<button type="button" class="resultItem" data-rev="'+escHtml(it.ID)+'">'
        + '<div class="rName">'+escHtml(nameOfSafe(it))+'</div>'
        + '<div class="rSub">Lv.'+escHtml(it.Level||'')+'｜'+escHtml(typeNameSafe(it))+'｜ID '+escHtml(it.ID||'')+'</div>'
        + '</button>';
    }).join('') || '<div class="muted">找不到道具（已搜尋 '+escHtml(total||0)+' 筆道具）</div>';
  }

  window.searchReverseItems=function(){
    const input=by('reverseQ');
    const box=by('reverseResults');
    if(!input||!box)return;
    window.v86ReverseQ=input.value;
    const q=String(input.value||'').trim().toLowerCase();
    if(!q){box.innerHTML='<div class="muted">請輸入道具名稱</div>';return;}
    const src=getItems();
    if(!src.length){box.innerHTML='<div class="muted">道具資料尚未載入完成，請稍候再試一次</div>';return;}
    const arr=uniqById(src.filter(function(it){return itemText(it).includes(q);})).slice(0,100);
    renderReverseResults(arr,src.length);
  };

  window.showReverse=async function(id,returnView){
    const itemId=String(id||'').trim();
    const backView=returnView||'reverse';
    const reader=by('reader');
    if(reader)reader.innerHTML='<section class="card"><h1>掉落反查</h1><div class="muted">資料讀取中...</div></section>';
    await ensureReverseDataLoaded();
    const itemIndexObj=getItemIndex();
    const revObj=getDropReverse();
    const it=itemIndexObj[itemId] || getItems().find(function(x){return String(x?.ID||'').trim()===itemId});
    if(!it){
      if(reader)reader.innerHTML='<section class="card"><button class="backBtn" onclick="goBackToPrevious(\''+escHtml(backView)+'\')">← 返回查詢</button><h1>找不到道具</h1><div class="empty">ID '+escHtml(itemId)+' 不在 ITEM.INI 裡。</div></section>';
      return;
    }
    const arr=(revObj[itemId]||[]).slice().sort(function(a,b){return (Number(b.rate)||0)-(Number(a.rate)||0)});
    window.v86LastView=backView;
    try{history.pushState({app:'detail',view:'reverse'},'',location.pathname+location.search);}catch(e){}
    const rows=arr.map(function(x){
      const m=x.monster||{};
      const mn=nameOfSafe(m);
      return '<tr data-monster="'+escHtml(m.ID||'')+'">'
        + '<td>'+escHtml(mn)+'</td>'
        + '<td>'+escHtml(m.Level||'')+'</td>'
        + '<td>'+escHtml((Number(x.rate)||0).toFixed(6))+'%</td>'
        + '<td>'+escHtml(locSafe(mn)||'')+'</td>'
        + '</tr>';
    }).join('');
    if(reader){
      reader.innerHTML='<section class="card">'
        + '<button class="backBtn" onclick="goBackToPrevious(\''+escHtml(backView)+'\')">← 返回查詢</button>'
        + '<h1>'+escHtml(nameOfSafe(it))+'</h1>'
        + '<div class="muted">掉落反查｜共 '+arr.length+' 筆</div>'
        + (arr.length?'<div class="tableWrap"><table><thead><tr><th>怪物</th><th>Lv.</th><th>機率</th><th>位置</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">沒有怪物掉落這個道具。</div>')
        + '</section>';
    }
    try{if(typeof closeDrawer==='function')closeDrawer();}catch(e){}
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}
  };

  document.addEventListener('input',function(ev){
    if(ev.target && ev.target.id==='reverseQ')window.searchReverseItems();
  },true);
  document.addEventListener('click',function(ev){
    const btn=ev.target && ev.target.closest ? ev.target.closest('[data-rev],[data-reverse-item]') : null;
    if(!btn)return;
    const context=btn.getAttribute('data-reverse-context') || '';
    const fromItem=btn.hasAttribute('data-reverse-item');
    const id=btn.getAttribute('data-rev') || btn.getAttribute('data-reverse-item');
    if(id){
      ev.preventDefault();
      ev.stopPropagation();
      if(context==='nested'){
        window.showReverse(id,btn.getAttribute('data-reverse-back')||'reverse',btn.getAttribute('data-reverse-parent')||'');
      }else{
        window.showReverse(id,fromItem?'item':'reverse');
      }
    }
  },true);

  window.SZO_REVERSE_MODULE={
    getItems,
    getItemIndex,
    getDropReverse,
    searchReverseItems:window.searchReverseItems,
    showReverse:window.showReverse
  };
})();

// V406: compact reverse detail cards.  Bag-like pseudo monsters are easier to read
// as "drop location" drill-down links instead of a very wide nested table.
(function(){
  let reverseShardPromises={};
  function by(id){return document.getElementById(id)}
  function escHtml(s){
    if(typeof esc==='function')return esc(s);
    return String(s??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
  }
  function nameOfSafe(o){
    try{return typeof nameOf==='function'?nameOf(o):String(o?.Name||o?.name||'').trim()}catch(e){return String(o?.Name||o?.name||'').trim()}
  }
  function locSafe(monsterName){
    const key=String(monsterName||'').trim();
    if(!key)return '';
    const sources=[
      window.SZO_DATA&&window.SZO_DATA.locations,
      window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.locations,
      window.monsterLocations
    ];
    for(const src of sources){
      if(src && typeof src==='object' && !Array.isArray(src) && src[key])return src[key];
    }
    try{return typeof locOf==='function'?locOf(key):''}catch(e){return ''}
  }
  function sync(){
    try{ if(typeof window.SZO_SYNC_DATA==='function') window.SZO_SYNC_DATA(); }catch(e){console.warn('SZO_SYNC_DATA failed',e)}
    return window.SZO_DATA || {};
  }
  async function ensureReverseDataLoaded(){
    if(typeof window.ensureReverseBundlesLoaded==='function'){
      try{await window.ensureReverseBundlesLoaded();}catch(e){}
    }else if(typeof window.ensureLookupDataLoaded==='function'){
      try{await window.ensureLookupDataLoaded();}catch(e){}
    }
    const d=sync();
    if((!d.locations || !Object.keys(d.locations||{}).length) && typeof loadDataBundle==='function'){
      try{
        const locs=await loadDataBundle('locations');
        if(locs && typeof locs==='object' && !Array.isArray(locs)){
          try{monsterLocations=locs;}catch(e){}
          window.monsterLocations=locs;
        }
      }catch(e){}
    }
    sync();
    if(typeof window.ensureReverseMapData==='function')window.ensureReverseMapData().catch(function(){});
  }
  function getItems(){
    const d=sync();
    if(Array.isArray(d.items) && d.items.length)return d.items;
    try{ if(Array.isArray(items) && items.length)return items; }catch(e){}
    return Array.isArray(window.items) ? window.items : [];
  }
  function getSearchItems(){
    const bundles=window.SZO_DATA_BUNDLES||{};
    const data=bundles.search_items||bundles.search_index;
    return data&&Array.isArray(data.items)?data.items:[];
  }
  function itemLiteById(id){
    const itemId=String(id||'').trim();
    const full=getItemIndex()[itemId] || getItems().find(function(x){return String(x?.ID||x?.id||'').trim()===itemId});
    if(full)return full;
    const row=getSearchItems().find(function(x){return String(x?.id||x?.ID||'').trim()===itemId});
    return row?{ID:String(row.id||row.ID||''),Name:row.name||row.Name||'',Type:row.type||row.Type||'',Level:row.level||row.Level||''}:null;
  }
  function getItemIndex(){
    const d=sync();
    if(d.itemIndex && Object.keys(d.itemIndex).length)return d.itemIndex;
    try{ if(itemIndex && Object.keys(itemIndex).length)return itemIndex; }catch(e){}
    return window.itemIndex || {};
  }
  function getDropReverse(){
    const d=sync();
    if(d.dropReverse && Object.keys(d.dropReverse).length)return d.dropReverse;
    try{ if(dropReverse && Object.keys(dropReverse).length)return dropReverse; }catch(e){}
    return window.dropReverse || {};
  }
  function itemByName(name){
    const target=String(name||'').trim();
    if(!target)return null;
    return getItems().find(function(it){return nameOfSafe(it)===target;})
      || getSearchItems().map(function(row){return {ID:String(row.id||row.ID||''),Name:row.name||row.Name||'',Type:row.type||row.Type||'',Level:row.level||row.Level||''};}).find(function(it){return nameOfSafe(it)===target;})
      || null;
  }
  function applyReverseLocations(locs){
    if(!locs || typeof locs!=='object' || Array.isArray(locs))return false;
    const vals=Object.values(locs);
    if(!vals.length || !vals.some(function(v){return typeof v==='string';}))return false;
    try{monsterLocations=locs;}catch(e){}
    window.monsterLocations=locs;
    window.SZO_DATA=window.SZO_DATA||{};
    window.SZO_DATA.locations=locs;
    return true;
  }
  async function ensureReverseLocationsLoaded(){
    const d=sync();
    if(d.locations && Object.keys(d.locations||{}).length){
      applyReverseLocations(d.locations);
      return true;
    }
    if(typeof loadDataBundle!=='function')return false;
    const locs=await loadDataBundle('locations').catch(function(){return null;});
    return applyReverseLocations(locs);
  }
  async function ensureReverseItemDataLoaded(itemId){
    const id=String(itemId||'').trim();
    if(!id)return false;
    if(getDropReverse()[id]){
      await ensureReverseLocationsLoaded();
      return true;
    }
    const version=encodeURIComponent(document.body?.dataset?.version||'dev');
    const prefix=(id.slice(0,3)||'misc').replace(/[^0-9A-Za-z_-]/g,'');
    if(!reverseShardPromises[prefix]){
      reverseShardPromises[prefix]=fetch('data/drop_reverse_shards/'+prefix+'.json?v='+version,{cache:'force-cache'})
        .then(function(res){if(!res.ok)return {};return res.json();})
        .catch(function(){return {};});
    }
    const tasks=[reverseShardPromises[prefix]];
    if(typeof loadDataBundle==='function'){
      if(!getSearchItems().length)tasks.push(loadDataBundle('search_items').catch(function(){return null;}));
      tasks.push(loadDataBundle('locations').catch(function(){return null;}));
    }
    const results=await Promise.all(tasks);
    const shard=results[0]||{};
    results.forEach(applyReverseLocations);
    try{
      if(typeof dropReverse==='undefined' || !dropReverse)dropReverse={};
    }catch(e){}
    const target=shard[id]||[];
    const mapped=(target||[]).map(function(row){
      return {monster:{ID:row.monsterId,Name:row.monsterName},monsterId:row.monsterId,monsterName:row.monsterName,rate:Number(row.rate)||0,weight:Number(row.weight)||0};
    });
    try{dropReverse[id]=mapped;}catch(e){}
    window.dropReverse=window.dropReverse||{};
    window.dropReverse[id]=mapped;
    window.SZO_DATA=window.SZO_DATA||{};
    window.SZO_DATA.dropReverse=window.SZO_DATA.dropReverse||{};
    window.SZO_DATA.dropReverse[id]=mapped;
    const lite=itemLiteById(id);
    if(lite){
      try{itemIndex=itemIndex||{}; itemIndex[id]=itemIndex[id]||lite;}catch(e){}
      window.itemIndex=window.itemIndex||{};
      window.itemIndex[id]=window.itemIndex[id]||lite;
      window.SZO_DATA.itemIndex=window.SZO_DATA.itemIndex||{};
      window.SZO_DATA.itemIndex[id]=window.SZO_DATA.itemIndex[id]||lite;
    }
    sync();
    if(typeof window.ensureReverseMapData==='function')window.ensureReverseMapData().catch(function(){});
    return true;
  }
  window.ensureReverseItemDataLoaded=ensureReverseItemDataLoaded;
  function sourceItemForRow(rowName, monsterId){
    const sameName=itemByName(rowName);
    if(!sameName)return null;
    const type=String(sameName.Type||sameName.type||'').toUpperCase();
    if(type==='BONUS' || /錦囊|寶箱|福袋|寶匣|戰匣|包裹/.test(rowName)){
      return sameName;
    }
    const sameId=getItemIndex()[String(monsterId||'').trim()];
    return sameId || null;
  }
  function formatRate(rate){
    const n=Number(rate)||0;
    return n.toFixed(6)+'%';
  }
  function renderReverseCard(row,currentItemId,backView){
    const m=row.monster||{};
    const name=row.monsterName || nameOfSafe(m);
    const mid=row.monsterId || m.ID || m.id || '';
    const linkedItem=sourceItemForRow(name,mid);
    const rate=formatRate(row.rate);
    if(linkedItem){
      return '<div class="reverseDropCard reverseDropCardLinked">'
        + '<div class="reverseDropMain">'
        + '<button type="button" class="reverseDropName reverseDropLink" data-reverse-item="'+escHtml(linkedItem.ID||linkedItem.id||'')+'" data-reverse-context="nested" data-reverse-parent="'+escHtml(currentItemId||'')+'" data-reverse-back="'+escHtml(backView||'reverse')+'">'+escHtml(name)+'</button>'
        + '<button type="button" class="reverseDropAction" data-reverse-item="'+escHtml(linkedItem.ID||linkedItem.id||'')+'" data-reverse-context="nested" data-reverse-parent="'+escHtml(currentItemId||'')+'" data-reverse-back="'+escHtml(backView||'reverse')+'">掉落位置</button>'
        + '</div>'
        + '<div class="reverseDropRate">'+escHtml(rate)+'</div>'
        + '</div>';
    }
    const loc=locSafe(name)||'??????';
    const hasLoc=loc && loc!=='??????';
    const locHtml=mid && hasLoc
      ? '<button type="button" class="reverseDropLoc reverseMapLink" data-reverse-map-monster="'+escHtml(mid)+'" data-reverse-map-name="'+escHtml(name)+'">'+escHtml(loc)+'<span class="reverseMapHint">地圖</span></button>'
      : '<div class="reverseDropLoc">'+escHtml(loc)+'</div>';
    return '<div class="reverseDropCard reverseDropCardMonster">'
      + '<div class="reverseDropMain">'
      + '<button type="button" class="reverseDropName reverseDropMonsterName" data-monster="'+escHtml(mid)+'">'+escHtml(name)+'</button>'
      + locHtml
      + '</div>'
      + '<div class="reverseDropRate">'+escHtml(rate)+'</div>'
      + '</div>';
  }

  window.showReverse=async function(id,returnView,parentItemId){
    const itemId=String(id||'').trim();
    const backView=returnView||'reverse';
    const reader=by('reader');
    if(reader)reader.innerHTML='<section class="card"><h1>掉落反查</h1><div class="muted">資料讀取中...</div></section>';
    await ensureReverseItemDataLoaded(itemId);
    const it=itemLiteById(itemId);
    if(!it){
      if(reader)reader.innerHTML='<section class="card"><button class="backBtn" onclick="goBackToPrevious(\''+escHtml(backView)+'\')">← 返回查詢</button><h1>找不到道具</h1><div class="empty">ID '+escHtml(itemId)+' 不在 ITEM.INI 資料內。</div></section>';
      return;
    }
    const arr=(getDropReverse()[itemId]||[]).slice().sort(function(a,b){return (Number(b.rate)||0)-(Number(a.rate)||0)});
    window.v86LastView=backView;
    try{history.pushState({app:'detail',view:'reverse'},'',location.pathname+location.search);}catch(e){}
    let parentButton='';
    const parentToken=String(parentItemId||'').trim();
    if(parentToken.indexOf('collect:')===0){
      const collectId=parentToken.slice(8);
      const parentItem=getItemIndex()[collectId] || getItems().find(function(x){return String(x?.ID||x?.id||'').trim()===collectId});
      parentButton='<button class="backBtn reverseParentBackBtn" type="button" onclick="renderCollectDropDetail(\''+escHtml(collectId)+'\')">← 返回武冠：'+escHtml(parentItem?nameOfSafe(parentItem):collectId)+'</button>';
    }else{
      const parentItem=parentToken ? (getItemIndex()[parentToken] || getItems().find(function(x){return String(x?.ID||x?.id||'').trim()===parentToken})) : null;
      parentButton=parentItem ? '<button class="backBtn reverseParentBackBtn" type="button" onclick="showReverse(\''+escHtml(parentToken)+'\',\''+escHtml(backView)+'\')">← 返回'+escHtml(nameOfSafe(parentItem))+'</button>' : '';
    }
    const fallbackBackButton='<button class="backBtn" onclick="goBackToPrevious(\''+escHtml(backView)+'\')">← 返回查詢</button>';
    if(reader){
      reader.innerHTML='<section class="card reverseDetailCard">'
        + '<div class="reverseBackActions">'+(parentButton||fallbackBackButton)+'</div>'
        + '<h1>'+escHtml(nameOfSafe(it))+'</h1>'
        + '<div class="muted">掉落反查｜共 '+arr.length+' 筆</div>'
        + (arr.length?'<div class="reverseDropList">'+arr.map(function(row){return renderReverseCard(row,itemId,backView)}).join('')+'</div>':'<div class="empty">沒有怪物掉落這個道具。</div>')
        + '</section>';
    }
    try{if(typeof closeDrawer==='function')closeDrawer();}catch(e){}
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}
  };

  document.addEventListener('click',function(ev){
    const btn=ev.target && ev.target.closest ? ev.target.closest('[data-reverse-map-monster]') : null;
    if(!btn)return;
    ev.preventDefault();
    ev.stopPropagation();
    const id=btn.getAttribute('data-reverse-map-monster')||'';
    const name=btn.getAttribute('data-reverse-map-name')||'';
    (async function(){
      if(typeof showPageLoading==='function')showPageLoading('????','????????...');
      if(typeof window.ensureMapPageLoaded==='function')await window.ensureMapPageLoaded();
      else if(typeof window.loadScriptGroupOnce==='function')await window.loadScriptGroupOnce('page_map');
      if(typeof window.openMonsterMapLocations==='function')await window.openMonsterMapLocations(id,name);
    })();
  },true);
})();
