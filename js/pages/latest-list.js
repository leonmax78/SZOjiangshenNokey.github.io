/* V109：怪物 / 道具查詢新增右側最新清單。排序依 INI 原始順序反向：最下面最新 → 顯示在最上面。 */
(function(){
  function _e(s){return (typeof esc==='function')?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function _id(id){return document.getElementById(id)}
  function _safeName(o){try{return nameOf(o)}catch(e){return (o&&o.Name)||''}}
  function latestMonstersHTML(limit=260){
    const arr=(Array.isArray(monsters)?monsters:[]).slice().reverse().filter(m=>_safeName(m)).slice(0,limit);
    return arr.map(m=>`<button type="button" class="resultItem" onclick="showMonster('${_e(m.ID)}');return false;"><div class="rName">${_e(_safeName(m))}</div><div class="rSub">Lv.${_e(m.Level||'')}｜${_e(raceName(m.Type)||'')}${subtypeName(m.Type,m.SubType)?' / '+_e(subtypeName(m.Type,m.SubType)):''}｜ID ${_e(m.ID||'')}</div></button>`).join('') || '<div class="muted">沒有怪物資料</div>';
  }
  function latestItemsHTML(limit=320){
    const arr=(Array.isArray(items)?items:[]).slice().reverse().filter(it=>_safeName(it)).slice(0,limit);
    return arr.map(it=>`<button type="button" class="resultItem" data-item="${_e(it.ID)}"><div class="rName">${_e(_safeName(it))}</div><div class="rSub">Lv.${_e(it.Level||'')}｜${_e((typeof itemTypeName==='function'?itemTypeName(it.Type):it.Type)||it.Type||'')}｜ID ${_e(it.ID||'')}</div></button>`).join('') || '<div class="muted">沒有道具資料</div>';
  }
  window.renderMonsterPage=function(){
    const q=window.v88MonsterQ||'', min=window.v88MonsterMin||'', max=window.v88MonsterMax||'', race=window.v88MonsterRace||'', subtype=window.v88MonsterSubtype||'';
    _id('reader').innerHTML=`<section class="card monsterSearchPage latestSearchPage"><h1>怪物、封獸查詢</h1><div class="latestQueryLayout"><div class="latestMainPane">
      <div class="kvGrid">
        <div class="kv"><div class="k">怪物名稱 / ID / 位置 / 種族 / 子分類</div><div class="v"><input id="monsterQMain" placeholder="例如：問頂仙龍、飛燕、妖物系、蜘蛛精" value="${_e(q)}"></div></div>
        <div class="kv"><div class="k">種族</div><div class="v"><select id="monsterRaceMain">${monsterRaceOptionsHTML(race)}</select></div></div>
        <div class="kv"><div class="k">子分類</div><div class="v"><select id="monsterSubtypeMain">${monsterSubtypeOptionsHTML(subtype,race)}</select></div></div>
        <div class="kv"><div class="k">最低 Lv</div><div class="v"><input id="monsterMinMain" type="number" value="${_e(min)}"></div></div>
        <div class="kv"><div class="k">最高 Lv</div><div class="v"><input id="monsterMaxMain" type="number" value="${_e(max)}"></div></div>
      </div>
      <div class="results" id="monsterResultsMain"></div>
    </div><aside class="latestSidePane"><div class="latestSideTitle">最新怪物清單</div><div class="latestSideHint">依 MONSTER_C.INI 原始順序反向顯示，越新的資料越上面。</div><div class="latestList">${latestMonstersHTML()}</div></aside></div></section>`;
    searchMonstersMain();
  };
  window.searchMonstersMain=function(){
    const q=_id('monsterQMain'); if(!q)return;
    window.v88MonsterQ=q.value;
    window.v88MonsterMin=_id('monsterMinMain')?.value||'';
    window.v88MonsterMax=_id('monsterMaxMain')?.value||'';
    window.v88MonsterRace=_id('monsterRaceMain')?.value||'';
    window.v88MonsterSubtype=_id('monsterSubtypeMain')?.value||'';
    const subSel=_id('monsterSubtypeMain');
    if(subSel){const old=window.v88MonsterSubtype; subSel.innerHTML=monsterSubtypeOptionsHTML(old,window.v88MonsterRace); if([...subSel.options].some(o=>o.value===old))subSel.value=old; else {subSel.value=''; window.v88MonsterSubtype='';}}
    const hasFilter=!!(String(window.v88MonsterQ||'').trim()||String(window.v88MonsterMin||'').trim()||String(window.v88MonsterMax||'').trim()||String(window.v88MonsterRace||'').trim()||String(window.v88MonsterSubtype||'').trim());
    const box=_id('monsterResultsMain'); if(!box)return;
    if(!hasFilter){box.innerHTML='';return;}
    const arr=filterMonsterList(window.v88MonsterQ,window.v88MonsterMin,window.v88MonsterMax,window.v88MonsterRace,window.v88MonsterSubtype);
    box.innerHTML=monsterResultsHTML(arr);
  };
  window.searchMonsters=function(){window.searchMonstersMain();};

  const oldRenderItemPage=window.renderItemPage;
  window.renderItemPage=function(tab='item'){
    if(tab!=='item'){
      if(typeof oldRenderItemPage==='function')return oldRenderItemPage(tab);
      return;
    }
    _id('reader').innerHTML=`<section class="card latestSearchPage"><h1>道具查詢</h1><div class="latestQueryLayout"><div class="latestMainPane">
      <div class="kvGrid">
        <div class="kv"><div class="k">道具名稱 / ID / 類型</div><div class="v"><input id="itemQ" placeholder="例如：火神砲、錦囊、277" value="${_e(window.v86ItemQ||'')}"></div></div>
        <div class="kv"><div class="k">類型</div><div class="v"><select id="itemType"></select></div></div>
        <div class="kv"><div class="k">等級起</div><div class="v"><input id="itemMin" type="number" value="${_e(window.v86ItemMin||'')}"></div></div>
        <div class="kv"><div class="k">等級迄</div><div class="v"><input id="itemMax" type="number" value="${_e(window.v86ItemMax||'')}"></div></div>
      </div>
      <div class="results" id="itemResults"></div>
    </div><aside class="latestSidePane"><div class="latestSideTitle">最新道具清單</div><div class="latestSideHint">依 ITEM.INI 原始順序反向顯示，越新的道具越上面。</div><div class="latestList">${latestItemsHTML()}</div></aside></div></section>`;
    const sel=_id('itemType');
    if(sel){sel.innerHTML='<option value="">全部類型</option>'+Object.entries(ITEM_TYPE_MAP).map(([k,v])=>`<option value="${_e(k)}">${_e(v)}</option>`).join(''); sel.value=window.v86ItemType||'';}
    searchItems();
  };
  window.searchItems=function(){
    const itemQ=_id('itemQ'); if(!itemQ)return;
    window.v86ItemQ=itemQ.value; window.v86ItemType=_id('itemType')?.value||''; window.v86ItemMin=_id('itemMin')?.value||''; window.v86ItemMax=_id('itemMax')?.value||'';
    const q=itemQ.value.trim().toLowerCase(), type=window.v86ItemType, min=window.v86ItemMin?intOf(window.v86ItemMin):null, max=window.v86ItemMax?intOf(window.v86ItemMax):null;
    const box=_id('itemResults'); if(!box)return;
    if(!(q||type||window.v86ItemMin||window.v86ItemMax)){box.innerHTML='';return;}
    const arr=items.filter(it=>(!q||itemSearchText(it).includes(q))&&(!type||it.Type===type)&&(min===null||intOf(it.Level)>=min)&&(max===null||intOf(it.Level)<=max)).slice(0,150);
    box.innerHTML=arr.map(it=>`<button type="button" class="resultItem" data-item="${_e(it.ID)}"><div class="rName">${_e(_safeName(it))}</div><div class="rSub">Lv.${_e(it.Level||'')}｜${_e((typeof itemTypeName==='function'?itemTypeName(it.Type):it.Type)||it.Type||'')}｜ID ${_e(it.ID||'')}</div></button>`).join('')||'<div class="muted">找不到道具</div>';
  };
})();
