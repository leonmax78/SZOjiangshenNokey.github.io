// V226: formal reverse lookup module.
// Flow: search ITEM.INI records, use the selected item ID, then read the prebuilt MONSTER_C.INI DropItem reverse index.
(function(){
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
    try{return typeof locOf==='function'?locOf(monsterName):''}catch(e){return ''}
  }
  function sync(){
    try{ if(typeof window.SZO_SYNC_DATA==='function') window.SZO_SYNC_DATA(); }catch(e){console.warn('SZO_SYNC_DATA failed',e)}
    return window.SZO_DATA || {};
  }
  function getItems(){
    const d=sync();
    if(Array.isArray(d.items) && d.items.length)return d.items;
    try{ if(Array.isArray(items) && items.length)return items; }catch(e){}
    if(Array.isArray(window.items) && window.items.length)return window.items;
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

  window.showReverse=function(id,returnView){
    const itemId=String(id||'').trim();
    const backView=returnView||'reverse';
    const itemIndexObj=getItemIndex();
    const revObj=getDropReverse();
    const it=itemIndexObj[itemId] || getItems().find(function(x){return String(x?.ID||'').trim()===itemId});
    const reader=by('reader');
    if(!it){
      if(reader)reader.innerHTML='<section class="card"><button class="backBtn" onclick="goBackToPrevious(\''+escHtml(backView)+'\')">← 返回查詢</button><h1>找不到道具</h1><div class="empty">ID '+escHtml(itemId)+' 不在 ITEM.INI 裡。</div></section>';
      return;
    }
    const arr=(revObj[itemId]||[]).slice().sort(function(a,b){return (Number(b.rate)||0)-(Number(a.rate)||0)});
    window.v86LastView=backView;
    try{history.pushState({app:'detail',view:'reverse'},'','#reverse-'+itemId);}catch(e){}
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
    const fromItem=btn.hasAttribute('data-reverse-item');
    const id=btn.getAttribute('data-rev') || btn.getAttribute('data-reverse-item');
    if(id){ev.preventDefault();ev.stopPropagation();window.showReverse(id,fromItem?'item':'reverse');}
  },true);

  window.SZO_REVERSE_MODULE={
    getItems,
    getItemIndex,
    getDropReverse,
    searchReverseItems:window.searchReverseItems,
    showReverse:window.showReverse
  };
})();
