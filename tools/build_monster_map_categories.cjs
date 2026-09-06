const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const setting=process.argv[2];
if(!setting)throw new Error('Usage: node tools/build_monster_map_categories.cjs <SETTING directory>');
const decode=file=>new TextDecoder('big5').decode(fs.readFileSync(path.join(setting,file)));
const stages=decode('STAGE.INI').split(/\[Stage\]/i).slice(1).map(block=>Object.fromEntries([...block.matchAll(/^([A-Za-z0-9_]+)\s*=\s*([^\r\n]*)/gm)].map(m=>[m[1],m[2].trim()])));
const messages=fs.readdirSync(setting).filter(f=>/^(STG)?MSG\d+\.INI$/i.test(f)).flatMap(file=>decode(file).split(/\r?\n/).map((text,i)=>({file,line:i+1,text})).filter(row=>/五人|5人/.test(row.text)));
// User-confirmed: keep stage 101 searchable; hide the solo instance at 390.
const classified=stages.filter(s=>Number(s.ID)!==101&&(/七寶仙境/.test(s.Name)||(Number(s.Parallel)>0&&Number(s.GroupMission)>0)||[109,390].includes(Number(s.ID)))).map(s=>({
 stageId:Number(s.ID),stageName:s.Name,category:Number(s.ID)===109?'arena':/七寶仙境/.test(s.Name)?'qibao':'dungeon',
 evidence:{source:'STAGE.INI',parallel:Number(s.Parallel)||0,groupMission:Number(s.GroupMission)||0,limit:s.Limit==null?null:Number(s.Limit)},
 fivePlayerEvidence:Number(s.GroupMission)>0?messages.filter(row=>row.text.includes(s.Name.replace(/^修羅級/,''))).map(row=>({source:row.file,line:row.line,text:row.text})):[]
}));
fs.writeFileSync(path.join(root,'data/monster_map_categories.json'),JSON.stringify({version:1,stages:classified},null,2)+'\n');
console.log(JSON.stringify({dungeons:classified.filter(s=>s.category==='dungeon').length,qibao:classified.filter(s=>s.category==='qibao').length,review:stages.filter(s=>Number(s.Parallel)>0&&!classified.some(c=>c.stageId===Number(s.ID))).map(s=>({id:s.ID,name:s.Name}))}));
