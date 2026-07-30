// Formal soul data page module in V219; large data moved to js/data/soul-data.js
(function(){
  const SOUL_DATA = (window.SZO_SOUL_DATA || window.SOUL_DATA || []).filter(function(s){
    return !(window.isVisibleSoulV0730 && !window.isVisibleSoulV0730(s));
  });
  const FIELD_MAP=[
    ['Base_Str','力量'],['Base_Int','智慧'],['Base_Dex','靈敏'],['Base_Con','體魄'],['Extra_Def','物理防禦'],['Magic_Def','術法防禦']
  ];
  function maxSoulCountV0730(){try{return Math.max(1,(getSoulListV106()||[]).length||SOUL_DATA.length||1);}catch(e){return SOUL_DATA.length||1;}}
  const MAX_SOUL_COUNT=maxSoulCountV0730();
  function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function N(v,d){v=Number(v);return Number.isFinite(v)?v:(d||0)}
  function F(n){return Math.floor(Number(n)||0).toLocaleString('zh-TW');}
  function by(id){return document.getElementById(id)}
  function soulById(id){const list=getSoulListV106();return list.find(x=>String(x.ID)===String(id))||list[0]||{}}
  function bonusRate(count){count=Math.max(1,N(count,1));return (count-1)*0.025;}
  function soulPortraitHTML(soul){
    const src=window.SZO_ASSET_MEDIA&&window.SZO_ASSET_MEDIA.soulPortraitSrc(soul);
    return src?'<span class="assetHero soulHero" data-soul-portrait="'+E(soul&&soul.ID)+'"><img src="'+E(src)+'" alt="'+E(soul&&soul.Name)+'" loading="eager" decoding="async"></span>':'';
  }
  function renderSoulCalc(){
    const list=getSoulListV106(); const first=list[0]||{};
    const savedId=window.soulSelectedId||first.ID;
    const savedCount=Math.max(1,N(window.soulCount||1,1));
    const options=list.map(x=>'<option value="'+E(x.ID)+'" '+(String(x.ID)===String(savedId)?'selected':'')+'>'+E(x.Name)+'</option>').join('');
    const reader=by('reader'); if(!reader)return;
    reader.innerHTML='<section class="card"><h1>武魂能力試算</h1><div class="muted">資料來源：'+E((Array.isArray(changeBodyIniSouls)&&changeBodyIniSouls.length)?'CHANGEBODYITEM.INI':'內嵌備援')+'。可直接搜尋 / 選擇武魂，輸入總收藏數後自動計算收藏加成。第 1 隻為原始能力，第 2 隻開始每多 1 隻增加 2.5%。</div><div class="kvGrid"><div class="kv"><div class="k">武魂</div><div class="v"><select id="soulSelect">'+options+'</select></div></div><div class="kv"><div class="k">總收藏武魂數</div><div class="v"><input id="soulCount" type="number" min="1" value="'+E(savedCount)+'"><div class="soulQuick"><button type="button" data-soul-count="1">1</button><button type="button" data-soul-count="2">2</button><button type="button" data-soul-count="3">3</button><button type="button" data-soul-count="5">5</button><button type="button" data-soul-count="10">10</button><button type="button" data-soul-count="20">20</button><button type="button" data-soul-count="'+MAX_SOUL_COUNT+'">滿收藏</button></div></div></div></div><div id="soulResult"></div></section>';
    bindSoulCalc();
    updateSoulCalc();
    if(window.innerWidth<980) closeDrawerSafe();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function bindSoulCalc(){
    const sel=by('soulSelect'), cnt=by('soulCount');
    if(sel) sel.addEventListener('change',()=>{window.soulSelectedId=sel.value;updateSoulCalc();});
    if(cnt) cnt.addEventListener('input',()=>{window.soulCount=cnt.value;updateSoulCalc();});
    // V215：快速收藏數按鈕直接綁在武魂頁渲染流程內。
    // 原本只靠全域 click capture；模組動態載入時 DOMContentLoaded 可能已經錯過，
    // 會造成 1/2/3/5/10/20/滿收藏 點了沒反應。
    document.querySelectorAll('[data-soul-count]').forEach(btn=>{
      btn.onclick=function(e){
        if(e) e.preventDefault();
        const c=by('soulCount');
        if(c){
          c.value=this.dataset.soulCount;
          window.soulCount=c.value;
          updateSoulCalc();
        }
      };
    });
  }
  function updateSoulCalc(){
    const sel=by('soulSelect'), cnt=by('soulCount'), out=by('soulResult'); if(!out)return;
    const soul=soulById(sel?sel.value:window.soulSelectedId);
    const count=Math.max(1,N(cnt?cnt.value:window.soulCount,1));
    window.soulSelectedId=soul.ID; window.soulCount=count;
    const rate=bonusRate(count);
    const rows=FIELD_MAP.map(([key,label])=>{
      const base=N(soul[key],0); if(!base)return '';
      const bonus=Math.floor(base*rate);
      return '<div class="soulStat"><div class="k">'+E(label)+'</div><div class="base">'+F(base)+(bonus>0?'<span class="bonus">(+ '+F(bonus)+')</span>':'')+'</div></div>';
    }).join('');
    const totalRows=FIELD_MAP.map(([key,label])=>{
      const base=N(soul[key],0); if(!base)return '';
      const bonus=Math.floor(base*rate);
      return '<tr><td>'+E(label)+'</td><td>'+F(base)+'</td><td style="color:#facc15;font-weight:1000">+'+F(bonus)+'</td><td>'+F(base+bonus)+'</td></tr>';
    }).join('');
    out.innerHTML='<div class="soulPreviewPanel"><div class="notice soulNotice"><div class="assetDetailHead">'+soulPortraitHTML(soul)+'<div><b>'+E(soul.Name||'')+'</b><span class="soulMetaLine">收藏數：'+F(count)+'</span><span class="soulMetaLine">加成：'+(rate*100).toFixed(1).replace(/.0$/,'')+'%</span></div></div></div><div class="soulPreviewStats"><h3>能力預覽</h3><div class="soulStats">'+rows+'</div></div></div><h3>詳細表</h3><div class="tableWrap"><table><thead><tr><th>能力</th><th>原始能力</th><th>收藏加成</th><th>合計</th></tr></thead><tbody>'+totalRows+'</tbody></table></div>';
  }
  function closeDrawerSafe(){try{ if(typeof closeDrawer==='function') closeDrawer(); }catch(e){}}
  function openItemMenuKeep(){
    try{ if(typeof openItemMenuOnly==='function') openItemMenuOnly(); }catch(e){}
  }
  function installSoulMenu(){return;}
  function patchSetItemSub(){
    const old=window.setItemSub;
    window.setItemSub=function(kind){
      if(kind==='soul'){
        try{openItemMenuKeep();}catch(e){}
        renderSoulCalc();
        return;
      }
      if(typeof old==='function') return old.apply(this,arguments);
    };
  }
  function patchClickCapture(){
    document.addEventListener('click',function(e){
      const el=e.target.closest&&e.target.closest('[data-item-open="soul"]');
      if(!el)return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      renderSoulCalc();
    },true);
    document.addEventListener('click',function(e){
      const b=e.target.closest&&e.target.closest('[data-soul-count]');
      if(!b)return;
      e.preventDefault();
      const cnt=by('soulCount'); if(cnt){cnt.value=b.dataset.soulCount; window.soulCount=cnt.value; updateSoulCalc();}
    });
  }
  function initSoulPatchV215(){
    installSoulMenu();
    patchSetItemSub();
    patchClickCapture();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initSoulPatchV215,{once:true});
  }else{
    initSoulPatchV215();
  }
  // In case another patch overwrites setItemSub later, re-apply the safe wrapper once.
  setTimeout(function(){installSoulMenu();patchSetItemSub();},0);
  window.renderSoulCalcPage=renderSoulCalc;
  window.SZOLegacyUpdateSoulCalc=updateSoulCalc;
  window.SZOLegacySetSoulCount=function(v){const c=by('soulCount'); if(c){c.value=v; window.soulCount=v; updateSoulCalc();}};
})();
