(function(){
  const cache={item:null,monster:null,soul:null};
  function manifest(){return (window.SZO_DATA_BUNDLES&&window.SZO_DATA_BUNDLES.asset_manifest)||{}}
  function base(){
    const raw=(manifest().base||'assets/test-media').replace(/\/$/,'');
    if(raw.startsWith('/')||/^https?:\/\//i.test(raw))return raw;
    const path=String(location&&location.pathname||'');
    const prefix=path==='/test'||path.startsWith('/test/')?'/test/':'/';
    return prefix+raw.replace(/^\//,'');
  }
  function setOf(key){
    if(cache[key])return cache[key];
    const m=manifest();
    const list=key==='item'?m.itemIcons:(key==='monster'?m.monsterPics:m.soulIds);
    cache[key]=new Set(Array.isArray(list)?list.map(String):[]);
    return cache[key];
  }
  function mediaVersion(){
    const v=String(manifest().version||'').trim();
    return v?`?v=${encodeURIComponent(v)}`:'';
  }
  const monsterPortraitOverrides={
    '15714':'monster-portraits/m15714.png'
  };
  function pad4(v){const n=parseInt(String(v||'').trim(),10);return Number.isFinite(n)?String(n%10000).padStart(4,'0'):''}
  function legacyIconSuffixes(iconId,itemType){
    const n=parseInt(String(iconId||'').trim(),10);
    if(!Number.isFinite(n)||n<20000||n>=21000)return [];
    const tail=n%1000;
    const t=String(itemType||'').toUpperCase();
    const equip=['ARMOR','HELMET','BOOT','BRACER','ORNAMENT'];
    const weapon=['BLADE','SWORD','WHISK','AXE','SHIELD','ROD','SPEAR','STAFF','HAMMER'];
    const material=['MATERIAL','POTION','MAGIC_FIGURE','SUMMON_TOOL','TALISMAN','PRESCRIPTION'];
    const families=equip.includes(t)?[4,5,3]:(weapon.includes(t)?[5,4,3]:(material.includes(t)?[3,4,5]:[4,5,3]));
    return families.map(x=>String(x*1000+tail).padStart(4,'0'));
  }
  function itemIconSrc(item){
    const icon=item&&(item.Icon!==undefined?item.Icon:item.icon);
    const tries=[pad4(icon),...legacyIconSuffixes(icon,item&&(item.Type||item.type))].filter(Boolean);
    const set=setOf('item');
    const suffix=tries.find(x=>set.has(x));
    return suffix?`${base()}/item-icons/i${suffix}.png${mediaVersion()}`:'';
  }
  function monsterPortraitSrc(monster){
    const id=String(monster&&(monster.ID!==undefined?monster.ID:monster.id)||'').trim();
    if(id&&monsterPortraitOverrides[id])return `${base()}/${monsterPortraitOverrides[id]}${mediaVersion()}`;
    const pic=String(monster&&(monster.Pic!==undefined?monster.Pic:monster.pic)||'').trim();
    return pic&&setOf('monster').has(pic)?`${base()}/monster-portraits/m${pic}.png${mediaVersion()}`:'';
  }
  function soulPortraitSrc(soul){
    const id=String(soul&&(soul.ID!==undefined?soul.ID:soul.id)||'').trim();
    return id&&setOf('soul').has(id)?`${base()}/soul-portraits/s${id}.png${mediaVersion()}`:'';
  }
  function img(src,alt,cls){
    return src?`<span class="${cls||'assetThumb'}"><img src="${esc(src)}" alt="${esc(alt||'')}" loading="lazy" decoding="async" onerror="this.closest('.assetThumb,.assetHero')?.remove()"></span>`:'';
  }
  window.SZO_ASSET_MEDIA={manifest,itemIconSrc,monsterPortraitSrc,soulPortraitSrc,img};
})();
