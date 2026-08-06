// V205 soul.js
// Safe soul module copy.
// app-core.js still keeps original soul functions in this version.
// CHANGEBODYITEM.INI parsing and soul calculator logic are staged here for future full extraction.

function parseChangeBodyIniBlocks(text){
 const data=[];let cur=null;
 function push(){if(cur&&Object.keys(cur).length)data.push(cur);cur=null}
 for(const raw of String(text||'').replace(/^\ufeff/,'').split(/\r?\n/)){
  const line=String(raw||'').trim();
  if(!line||line.startsWith('//')||line.startsWith(';'))continue;
  if(line.startsWith('[')&&line.endsWith(']')){push();cur={};continue}


  const p=line.indexOf('='); if(p<0)continue;
  const k=line.slice(0,p).trim(),v=line.slice(p+1).trim();
  if(/^ID$/i.test(k)&&cur&&(cur.ID!==undefined))push();
  if(!cur)cur={};
  cur[k]=v;
 }
 push();return data.filter(x=>x&&x.Name);
}

function soulNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
const HIDDEN_SOUL_IDS_V0730=new Set([64,65,67,68,70,71]);
function isVisibleSoulV0730(soul){
 const id=soulNum(soul&&soul.ID);
 return !HIDDEN_SOUL_IDS_V0730.has(id);
}

function buildSoulDataFromChangeBodyIni(text){
 return parseChangeBodyIniBlocks(text).map(r=>({
  ID:soulNum(r.ID),
  Item:soulNum(r.Item),
  Name:String(r.Name||'').trim(),
  Base_Str:soulNum(r.Base_Str),
  Base_Int:soulNum(r.Base_Int),
  Base_Dex:soulNum(r.Base_Dex),
  Base_Con:soulNum(r.Base_Con),
  Extra_Def:soulNum(r.Extra_Def),
  Magic_Def:soulNum(r.Magic_Def),
  _source:'CHANGEBODYITEM.INI'
 })).filter(x=>x.Name&&isVisibleSoulV0730(x));
}

function getSoulListV106(){
 if(Array.isArray(changeBodyIniSouls)&&changeBodyIniSouls.length)return changeBodyIniSouls.filter(isVisibleSoulV0730);
 if(typeof SOUL_DATA!=='undefined'&&Array.isArray(SOUL_DATA))return SOUL_DATA.filter(isVisibleSoulV0730);
 return [];
}

window.SZO_SOUL_MODULE = {
  parseChangeBodyIniBlocks: (typeof parseChangeBodyIniBlocks==='function'?parseChangeBodyIniBlocks:null),
  soulNum: (typeof soulNum==='function'?soulNum:null),
  isVisibleSoulV0730: (typeof isVisibleSoulV0730==='function'?isVisibleSoulV0730:null),
  buildSoulDataFromChangeBodyIni: (typeof buildSoulDataFromChangeBodyIni==='function'?buildSoulDataFromChangeBodyIni:null),
  getSoulListV106: (typeof getSoulListV106==='function'?getSoulListV106:null)
};


// V207 active soul exports
try{
  if(typeof parseChangeBodyIniBlocks==='function')window.parseChangeBodyIniBlocks=parseChangeBodyIniBlocks;
  if(typeof soulNum==='function')window.soulNum=soulNum;
  if(typeof isVisibleSoulV0730==='function')window.isVisibleSoulV0730=isVisibleSoulV0730;
  if(typeof buildSoulDataFromChangeBodyIni==='function')window.buildSoulDataFromChangeBodyIni=buildSoulDataFromChangeBodyIni;
  if(typeof getSoulListV106==='function')window.getSoulListV106=getSoulListV106;
}catch(e){console.warn('V207 soul active export failed',e);}
