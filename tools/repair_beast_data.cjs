const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'data/beasts.bundle.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const rows = context.window.SZO_BEASTS;
const catchIndex=JSON.parse(fs.readFileSync(path.join(root,'data/beast_catch_map_index.json'),'utf8')).byBeast;
const stages=JSON.parse(fs.readFileSync(path.join(root,'data/stage_maps.json'),'utf8')).stages;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/collectbook_sources.json'),'utf8')).beast;
const plain=value=>String(value||'').replace(/[\[\]【】]/g,'').replace(/\s+/g,'').replace(/\((斧|錘)\)/g,'');
const sharedAttack = rows.find(row=>row.name==='力士俑').attack;
for(const row of rows){
 if(['力士俑','力士俑(斧)','力士俑(錘)'].includes(row.name)){
  row.monsterId='5046';
  row.attack=sharedAttack;
  row.note='依確認共用力士俑資料';
 }
 if(row.name==='符兵 龍驤')row.monsterId='15031';
 if(row.name==='年小弟')row.monsterId='5782';
 const queryName=plain(row.name);
 const locations=catchIndex[queryName]||[];
 const source=catalog.find(item=>item.name===row.name);
 const extra=(source?.locations||[]).map(name=>stages.find(stage=>stage.stageName===name)).filter(Boolean);
 const used=new Set();
 row.captureLocations=[];
 for(const location of [...locations,...extra]){
  const stage=stages.find(item=>Number(item.stageId)===Number(location.stageId));
  if(!stage||used.has(stage.stageId))continue;
  const targets=stage.monsters.filter(monster=>plain(monster.name)===queryName);
  if(!targets.length)continue;
  used.add(stage.stageId);
  row.captureLocations.push({stageId:stage.stageId,stageName:stage.stageName,monsterName:targets[0].name,monsterIds:[...new Set(targets.map(monster=>String(monster.id)))]});
 }
}
fs.writeFileSync(file,'window.SZO_BEASTS='+JSON.stringify(rows)+';\n');
