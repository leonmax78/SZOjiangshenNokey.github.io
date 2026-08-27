// V224: 正式裝備合成模組。
// app-core.js 只負責導覽與事件委派，合成資料解析、頁面渲染、材料統計與亂數模擬都集中在這裡。

let eqState={main:'',series:'',tier:'',type:'',q:'',uid:'',recipeCounts:{},simTotals:null,simCount:0,simRecipeCounts:{}};

function parseCompoundIniMulti(text){
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
  if(k==='Type'){
   if(!Array.isArray(cur.Type))cur.Type=cur.Type?[cur.Type]:[];
   cur.Type.push(v);
  }else if(cur[k]!==undefined){
   if(!Array.isArray(cur[k]))cur[k]=[cur[k]];
   cur[k].push(v);
  }else cur[k]=v;
 }
 push();return data.filter(x=>x&&(x.ID!==undefined||x.Name!==undefined||x.Item!==undefined));
}

function compTypeToDisplay(code){return ITEM_TYPE_MAP[String(code||'').trim()]||String(code||'').trim()}

function compGroupFromStable(stable,types){
 const s=Number(stable)||0;
 const isUnder=(types||[]).includes('UNDER_BOOT');
 if(isUnder||s>=70)return 'stable_70';
 if(s>=50)return 'stable_50';
 if(s>=12)return 'stable_12';
 return 'stable_1';
}

function compGroupLabel(g){
 return g==='stable_70'?'安定值70':g==='stable_50'?'安定值50':g==='stable_12'?'安定值12':'安定值1';
}

function compEffectList(r){
 const defs=[
  ['ConMin','ConMax','con','體魄'],['StrMin','StrMax','str','力量'],['IntMin','IntMax','int','智慧'],['DexMin','DexMax','dex','靈敏'],
  ['HPMin','HPMax','hp','生命'],['MPMin','MPMax','mp','精力'],['DamageMin','DamageMax','damage','傷害'],[['MagicAttackMin','MAttMin'],['MagicAttackMax','MAttMax'],'m_attack','術法攻擊'],
  [['ExtraDefMin','DefMin'],['ExtraDefMax','DefMax'],'def','物理防禦'],[['MagicDefMin','MDefMin'],['MagicDefMax','MDefMax'],'m_def','術法防禦'],
  ['FireAttMin','FireAttMax','fire_attack','火傷'],['IceAttMin','IceAttMax','ice_attack','冰傷'],['LightningAttMin','LightningAttMax','lightning_attack','雷傷'],['DarkAttMin','DarkAttMax','dark_attack','冥傷'],
  ['FireProbMin','FireProbMax','fire_prob','火傷機率'],['IceProbMin','IceProbMax','ice_prob','冰傷機率'],['LightningProbMin','LightningProbMax','lightning_prob','雷傷機率'],['DarkProbMin','DarkProbMax','dark_prob','冥傷機率']
 ];
 const out=[];
 for(const [a,b,stat,label] of defs){
  const read=(keys)=>{
   const arr=Array.isArray(keys)?keys:[keys];
   for(const key of arr){
    const n=Number(r[key]);
    if(Number.isFinite(n))return n;
   }
   return NaN;
  };
  const mn=read(a),mx=read(b);
  if(Number.isFinite(mn)||Number.isFinite(mx)){
   const min=Number.isFinite(mn)?mn:(Number.isFinite(mx)?mx:0);
   const max=Number.isFinite(mx)?mx:min;
   if(min!==0||max!==0)out.push({stat,label,min,max,stackable:true,raw_fields:[a,b]});
  }
 }
 return out;
}

function buildCompoundRecipesFromIni(text){
 const rows=parseCompoundIniMulti(text);
 const old=(((compoundConfigData&&compoundConfigData.recipes)||((typeof EQUIP_COMPOUND_DATA!=='undefined')&&EQUIP_COMPOUND_DATA.recipes))||[]);
 const oldByItem={},oldByName={};
 old.forEach(o=>{if(o.item_id)oldByItem[String(o.item_id)]=o;if(o.name)oldByName[o.name]=o});
 return rows.map(r=>{
  const itemId=String(r.Item||'').trim();
  const name=String(r.Name||('配方 '+(r.ID||itemId))).trim();
  const types=Array.isArray(r.Type)?r.Type:(r.Type?[r.Type]:[]);
  const group=compGroupFromStable(r.Stable,types);
  const fallback=oldByItem[itemId]||oldByName[name]||{};
  const parsedEffects=compEffectList(r);
  const parsedStats=new Set(parsedEffects.map(e=>e.stat));
  const effects=[
   ...parsedEffects,
   ...(fallback.effects||[]).filter(e=>e&&e.stat&&!parsedStats.has(e.stat))
  ];
  return Object.assign({},fallback,{
   id:Number(r.ID)||fallback.id||name,
   item_id:Number(itemId)||fallback.item_id||null,
   item_name:name,
   name,
   group,
   group_label:compGroupLabel(group),
   stable_value:Number(r.Stable)||fallback.stable_value||0,
   max_ref:Number(r.MaxRef)||fallback.max_ref||0,
   fail_rate:(r.Fail!==undefined&&r.Fail!=='')?Number(r.Fail):fallback.fail_rate,
   value:(r.Value!==undefined&&r.Value!=='')?Number(r.Value):fallback.value,
   type_codes:types.length?types:(fallback.type_codes||[]),
   display_types:types.length?types.map(compTypeToDisplay).filter(Boolean):(fallback.display_types||[]),
   first_raw:r.First!==undefined?Number(r.First):fallback.first_raw,
   effects,
   materials:fallback.materials||[],
   _recipe_source:'COMPOUND.INI'
  });
 }).filter(r=>r.name);
}

function eqData(){
 const fallback=(typeof EQUIP_COMPOUND_DATA!=='undefined'&&EQUIP_COMPOUND_DATA)||{equipment:[],recipes:[],type_order:[],calc_rules:{}};
 const cfg=compoundConfigData||fallback;
 const base=Object.assign({},fallback,cfg);
 if(compoundIniRecipes&&compoundIniRecipes.length){
  base.recipes=mergeCompoundIniRecipesWithConfig(compoundIniRecipes,(cfg.recipes||fallback.recipes||[]));
 }
 return base;
}

function mergeCompoundIniRecipesWithConfig(iniRecipes,configRecipes){
 const cfgByItem={},cfgByName={};
 (configRecipes||[]).forEach(r=>{
  if(r.item_id!==undefined&&r.item_id!==null)cfgByItem[String(r.item_id)]=r;
  if(r.name)cfgByName[String(r.name)]=r;
 });
 const cfgRecipeNames=new Set((configRecipes||[]).map(x=>String(x.name||'').trim()).filter(Boolean));
 const cfgRecipeItems=new Set((configRecipes||[]).map(x=>String(x.item_id||'').trim()).filter(Boolean));
 return (iniRecipes||[]).map(r=>{
  const cfg=cfgByItem[String(r.item_id)]||cfgByName[String(r.name)]||{};
  // 只有 compound_config.json 白名單內的配方才顯示
  const inWhitelist=
    cfgRecipeNames.has(String(r.name||'').trim()) ||
    cfgRecipeItems.has(String(r.item_id||'').trim());

  const out=Object.assign({},cfg,r);

  // 白名單外直接隱藏
  if(!inWhitelist) out.hidden=true;

  // config 控制網站邏輯
  out.materials=(cfg.materials&&cfg.materials.length)?cfg.materials:(r.materials||[]);
  if(cfg.hidden!==undefined)out.hidden=cfg.hidden;
  if(cfg.display===false)out.hidden=true;

  if(cfg.group_override)out.group=cfg.group_override;
  if(cfg.group_label_override)out.group_label=cfg.group_label_override;
  if(cfg.sort_order!==undefined)out.sort_order=cfg.sort_order;

  out._recipe_source='COMPOUND.INI + compound_config.json';
  return out;
 }).filter(r=>!r.hidden);
}

function eqUnique(arr){return [...new Set(arr.filter(v=>v!==undefined&&v!==null&&String(v).trim()!==''))]}

function eqEquipList(){return (eqData().equipment||[]).map(eqMergeItemIniStats)}

function eqMergeItemIniStats(eq){
 if(!eq)return eq;
 const id=String(eq.item_id||eq.Item||'').trim();
 const ini=(typeof itemIndex!=='undefined'&&itemIndex)?itemIndex[id]:null;
 if(!ini)return eq;
 const copy=Object.assign({},eq);
 copy.raw_item=ini;
 copy.base_stats=eqBuildBaseStatsFromItemIni(ini,eq.base_stats||{});
 copy._stats_source='ITEM.INI';
 return copy;
}

function eqNumOrUndef(v){if(v===undefined||v===null||v==='')return undefined;const n=Number(v);return Number.isFinite(n)?n:undefined}

function eqAddStatFromIni(base,key,label,val){const n=eqNumOrUndef(val);if(n!==undefined&&n!==0)base[key]={label,value:n}}

function eqAddRangeFromIni(base,key,label,min,max){
 const a=eqNumOrUndef(min),b=eqNumOrUndef(max);
 if(a!==undefined||b!==undefined){const mn=a!==undefined?a:(b||0),mx=b!==undefined?b:mn;if(mn!==0||mx!==0)base[key]={label,min:mn,max:mx}}
}

function eqBuildBaseStatsFromItemIni(raw,fallback){
 const base={};
 if(raw.Level!==undefined)base.level={label:'等級',value:eqNumOrUndef(raw.Level)||0};
 if(raw.CLevel!==undefined)base.clevel={label:'職等(CL)',value:eqNumOrUndef(raw.CLevel)||0};
 eqAddStatFromIni(base,'con','體魄',raw.Con);
 eqAddStatFromIni(base,'str','力量',raw.Str);
 eqAddStatFromIni(base,'int','智慧',raw.Int);
 eqAddStatFromIni(base,'dex','靈敏',raw.Dex);
 eqAddStatFromIni(base,'hp','生命',raw.HP);
 eqAddStatFromIni(base,'mp','精力',raw.MP);
 eqAddRangeFromIni(base,'damage','傷害',raw.DamageMin,raw.DamageMax);
 eqAddStatFromIni(base,'m_attack','術法攻擊',raw.MagicAttack);
 eqAddStatFromIni(base,'def','物理防禦',raw.ExtraDef);
 eqAddStatFromIni(base,'m_def','術法防禦',raw.MagicDef);
 eqAddStatFromIni(base,'fire_attack','火傷',raw.FireAttack);
 eqAddStatFromIni(base,'ice_attack','冰傷',raw.IceAttack);
 eqAddStatFromIni(base,'lightning_attack','雷傷',raw.LightningAttack);
 eqAddStatFromIni(base,'dark_attack','冥傷',raw.DarkAttack);
 eqAddStatFromIni(base,'fire_prob','火傷機率',raw.FireProb);
 eqAddStatFromIni(base,'ice_prob','冰傷機率',raw.IceProb);
 eqAddStatFromIni(base,'lightning_prob','雷傷機率',raw.LightningProb);
 eqAddStatFromIni(base,'dark_prob','冥傷機率',raw.DarkProb);
 eqAddStatFromIni(base,'ice_def','冰防',raw.IceDef);
 eqAddStatFromIni(base,'fire_def','火防',raw.FireDef);
 eqAddStatFromIni(base,'lightning_def','雷防',raw.LightningDef);
 eqAddStatFromIni(base,'dark_def','冥防',raw.DarkDef);
 eqAddStatFromIni(base,'paralysis_res','抗定身',raw.ParalysisRes);
 eqAddStatFromIni(base,'poison_res','抗毒',raw.PosionRes??raw.PoisonRes);
 eqAddStatFromIni(base,'blind_res','抗盲目',raw.BlindRes);
 eqAddStatFromIni(base,'silent_res','抗禁咒',raw.SilentRes);
 eqAddStatFromIni(base,'durability','耐久',raw.Durabulity??raw.Durability);
 eqAddStatFromIni(base,'weight','重量',raw.Weight);
 for(const k of ['level','clevel'])if(base[k]===undefined&&fallback[k]!==undefined)base[k]=fallback[k];
 return base;
}

function eqRecipesForType(tp){
 const wanted=compTypeToDisplay(tp);
 return (eqData().recipes||[]).filter(r=>(r.display_types||r.type_codes||[]).some(type=>compTypeToDisplay(type)===wanted));
}

function eqFmtVal(v){return v===undefined||v===null||v===''?'':fmt(Number(v)||0)}

function eqStatValueText(o){if(!o)return''; if(o.min!==undefined||o.max!==undefined)return `${eqFmtVal(o.min)}～${eqFmtVal(o.max)}`; return eqFmtVal(o.value)}

function eqStatNum(o,side){if(!o)return 0; if(o.value!==undefined)return Number(o.value)||0; if(side==='max')return Number(o.max)||0; return Number(o.min)||0}

function eqFilteredEquipment(){
 const q=(eqState.q||'').trim().toLowerCase();
 return eqEquipList().filter(e=>(!eqState.main||e.main_category===eqState.main)&&(!eqState.series||e.series_group===eqState.series)&&(!eqState.tier||String(e.tier||e.series_grade||'')===String(eqState.tier))&&(!eqState.type||e.display_type===eqState.type)&&(!q||String(e.search_text||e.name||'').toLowerCase().includes(q))).slice(0,160);
}

function eqFillSelect(id,vals,allLabel,cur){const el=byId(id); if(!el)return; el.innerHTML=`<option value="">${esc(allLabel)}</option>`+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join(''); el.value=cur||'';}

function eqRefreshFilters(){
 const all=eqEquipList();
 eqFillSelect('eqMain',eqUnique(all.map(e=>e.main_category)),'全部種類',eqState.main);
 const a1=all.filter(e=>!eqState.main||e.main_category===eqState.main);
 eqFillSelect('eqSeries',eqUnique(a1.map(e=>e.series_group)),'全部系列',eqState.series);
 const a2=a1.filter(e=>!eqState.series||e.series_group===eqState.series);
 const tiers=eqState.series?eqUnique(a2.map(e=>e.tier||e.series_grade)).sort((a,b)=>{const na=Number(a),nb=Number(b); if(!isNaN(na)&&!isNaN(nb))return na-nb; return String(a).localeCompare(String(b),'zh-Hant')}):[];
 eqFillSelect('eqTier',tiers,'全部階級 / 等級',eqState.tier);
 const typeOrder=eqData().type_order||[];
 const types=eqUnique(a2.filter(e=>!eqState.tier||String(e.tier||e.series_grade||'')===String(eqState.tier)).map(e=>e.display_type)).sort((a,b)=>{let ia=typeOrder.indexOf(a),ib=typeOrder.indexOf(b); if(ia<0)ia=999;if(ib<0)ib=999; return ia-ib;});
 eqFillSelect('eqType',types,'全部類型 / 部位',eqState.type);
}

function eqRefreshList(){
 const box=byId('eqList'); if(!box)return;
 const arr=eqFilteredEquipment();
 box.innerHTML=arr.map(e=>`<button class="resultItem" data-eq-uid="${esc(e.uid)}"><div class="rName">${esc(e.name)}</div><div class="rSub">${esc(e.main_category||'')}｜${esc(e.series||e.series_group||'')}｜${esc(e.display_type||'')}｜Lv.${esc(e.base_stats?.level||e.raw_item?.Level||'')}｜ID ${esc(e.item_id||'')}</div></button>`).join('') || '<div class="empty">請調整篩選條件，或找不到裝備。</div>';
}

function eqSelected(){return eqEquipList().find(e=>e.uid===eqState.uid)||null}

function eqAllowedRecipes(){
 const eq=eqSelected(); if(!eq)return [];
 const tp=eq.display_type;
 return eqRecipesForType(tp);
}

function eqRecipeById(id){return (eqData().recipes||[]).find(r=>String(r.id)===String(id))||null}

function eqSelectedRecipes(){
 const allowed=new Set(eqAllowedRecipes().map(r=>String(r.id)));
 return eqSortRecipePicks(Object.entries(eqState.recipeCounts||{}).filter(([id,c])=>allowed.has(String(id)) && Number(c)>0).map(([id,c])=>({recipe:eqRecipeById(id),count:Math.max(1,intOf(c,1))})).filter(x=>x.recipe));
}

function eqRecipeDefaultCount(recipe){return Math.max(1,intOf(recipe?.default_use_count,1)||1)}

function eqRecipeGroupRank(recipe){
 const g=recipe?.group||'';
 if(g==='stable_1')return 1;
 if(g==='stable_12')return 2;
 if(g==='stable_50')return 3;
 if(g==='stable_70')return 4;
 return 99;
}

function eqRecipeOrderIndex(recipe){
 const arr=eqData().recipes||[];
 const i=arr.findIndex(r=>String(r.id)===String(recipe?.id));
 return i<0?99999:i;
}

function eqSortRecipeObjects(arr){
 return (arr||[]).slice().sort((a,b)=>eqRecipeGroupRank(a)-eqRecipeGroupRank(b)||eqRecipeOrderIndex(a)-eqRecipeOrderIndex(b)||String(a.name||'').localeCompare(String(b.name||''),'zh-Hant'));
}

function eqSortRecipePicks(arr){
 return (arr||[]).slice().sort((a,b)=>eqRecipeGroupRank(a.recipe)-eqRecipeGroupRank(b.recipe)||eqRecipeOrderIndex(a.recipe)-eqRecipeOrderIndex(b.recipe)||String(a.recipe?.name||'').localeCompare(String(b.recipe?.name||''),'zh-Hant'));
}

function eqAddRecipe(id){
 const r=eqRecipeById(id); if(!r)return;
 eqState.recipeCounts=eqState.recipeCounts||{};
 if(!eqState.recipeCounts[String(id)]) eqState.recipeCounts[String(id)]=eqRecipeDefaultCount(r);
 eqResetRandom(false);
 eqRenderPreview(true);
}

function eqSimAddRecipe(id){
 const r=eqRecipeById(id); if(!r)return;
 eqState.simSelectedRecipes=eqState.simSelectedRecipes||{};
 eqState.simSelectedRecipes[String(id)]=true;
 renderEquipmentRandomPage(true);
}

function eqToggleRecipe(id){
 const r=eqRecipeById(id); if(!r)return;
 eqState.recipeCounts=eqState.recipeCounts||{};
 if(eqState.recipeCounts[String(id)]) delete eqState.recipeCounts[String(id)];
 else eqState.recipeCounts[String(id)]=eqRecipeDefaultCount(r);
 eqResetRandom();
 eqRenderPreview();
}

function eqSetRecipeCount(id,val){
 eqState.recipeCounts=eqState.recipeCounts||{};
 if(eqState.recipeCounts[String(id)]!==undefined){eqState.recipeCounts[String(id)]=Math.max(1,intOf(val,1)); eqResetRandom(); eqRenderPreview();}
}

function eqEffectAccumulator(){
 const acc={};
 for(const {recipe,count} of eqSelectedRecipes()){
  for(const e of recipe.effects||[]){
   const k=e.stat; if(!acc[k])acc[k]={stat:k,label:e.label||eqData().stat_labels?.[k]||k,min:0,max:0,value:0,unit:e.unit||'',hasRange:false,hasValue:false,stackable:e.stackable!==false, parts:[]};
   const mult=e.stackable===false?1:count;
   if(e.min!==undefined||e.max!==undefined){acc[k].hasRange=true; acc[k].min+=(Number(e.min)||0)*mult; acc[k].max+=(Number(e.max)||0)*mult; acc[k].parts.push(`${recipe.name} × ${count}：+${fmt((Number(e.min)||0)*mult)}${(Number(e.max)||0)!=(Number(e.min)||0)?'～'+fmt((Number(e.max)||0)*mult):''}`);}
   else {acc[k].hasValue=true; acc[k].value+=(Number(e.value)||0)*mult; acc[k].parts.push(`${recipe.name} × ${count}：${(Number(e.value)||0)>=0?'+':''}${fmt((Number(e.value)||0)*mult)}${e.unit||''}`);}
  }
 }
 return acc;
}

function eqBaseStatsWithRaw(eq){
 const base=Object.assign({},eq?.base_stats||{});
 const raw=eq?.raw_item||{};
 const add=(key,label,value)=>{if(value!==undefined&&value!==null&&value!==''&&base[key]===undefined)base[key]={label,value:Number(value)||0};};
 const addRange=(key,label,min,max)=>{if((min!==undefined||max!==undefined)&&base[key]===undefined)base[key]={label,min:Number(min)||0,max:Number(max??min)||0};};
 add('m_attack','術法攻擊',raw.MagicAttack);
 add('def','物理防禦',raw.ExtraDef);
 add('m_def','術法防禦',raw.MagicDef);
 add('ice_def','冰防',raw.IceDef);
 add('fire_def','火防',raw.FireDef);
 add('lightning_def','雷防',raw.LightningDef);
 add('dark_def','冥防',raw.DarkDef);
 add('paralysis_res','抗定身',raw.ParalysisRes);
 add('poison_res','抗毒',raw.PosionRes ?? raw.PoisonRes);
 add('blind_res','抗盲目',raw.BlindRes);
 add('silent_res','抗禁咒',raw.SilentRes);
 addRange('damage','傷害',raw.DamageMin,raw.DamageMax);
 add('level','等級',raw.Level);
 add('clevel','職等(CL)',raw.CLevel);
 return base;
}

function eqCLevelText(v){
 const n=Number(v);
 const map={0:'無',1:'一轉',2:'二轉',3:'三轉',4:'四轉',5:'五轉'};
 return map[n]||String(v||'');
}

function eqStatLabel(k,o,e){
 if(k==='m_attack')return '術法攻擊';
 if(k==='def')return '物理防禦';
 if(k==='m_def')return '術法防禦';
 if(k==='ice_def')return '冰防';
 if(k==='fire_def')return '火防';
 if(k==='lightning_def')return '雷防';
 if(k==='dark_def')return '冥防';
 if(k==='paralysis_res')return '抗定身';
 if(k==='poison_res')return '抗毒';
 if(k==='blind_res')return '抗盲目';
 if(k==='silent_res')return '抗禁咒';
 if(k==='level')return '等級';
 if(k==='clevel')return '職等(CL)';
 return o?.label||e?.label||eqData().stat_labels?.[k]||k;
}

function eqDisplayStatText(k,o){
 if(k==='clevel' && o)return eqCLevelText(o.value);
 return eqStatValueText(o)||'-';
}

function eqMetaLine(eq){
 const base=eqBaseStatsWithRaw(eq);
 const level=base.level?.value||eq?.raw_item?.Level||'';
 const clevel=base.clevel?.value??eq?.raw_item?.CLevel??'';
 const main=['等級 '+(level||'-'),'職等(CL) '+eqCLevelText(clevel)];
 const rest=['ID '+eq.item_id,eq.main_category,eq.series||eq.series_group,eq.display_type,(eq._stats_source||'內嵌備援')].filter(Boolean);
 return `<div class="eqTopMeta">${main.map(x=>`<span class="pill" style="font-size:14px;border-color:#60a5fa;color:#e0f2fe">${esc(x)}</span>`).join('')}${rest.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div>`;
}

function eqRenderStats(eq,includeEffects=true){
 const base=eqBaseStatsWithRaw(eq); const effMap=includeEffects?eqEffectAccumulator():{};
 const keys=eqUnique([...Object.keys(base),...Object.keys(effMap)]);
 const order=['level','clevel','con','str','int','dex','hp','mp','damage','m_attack','def','m_def','ice_def','fire_def','lightning_def','dark_def','fire_attack','ice_attack','lightning_attack','dark_attack','fire_prob','ice_prob','lightning_prob','dark_prob','paralysis_res','poison_res','blind_res','silent_res','attack','attack_range','durability','weight'];
 keys.sort((a,b)=>(order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b)) || String(a).localeCompare(String(b),'zh-Hant'));
 const left=keys.map(k=>{const o=base[k]; const label=eqStatLabel(k,o,null); return `<div class="kv"><div class="k">${esc(label)}</div><div class="v">${esc(eqDisplayStatText(k,o))}</div></div>`}).join('');
 if(!includeEffects){return `<div class="card" style="box-shadow:none"><h2 class="eqCompactTitle">目前裝備能力</h2><div class="eqStatGrid">${left}</div></div>`;}
 const right=keys.map(k=>{
  const o=base[k]; const e=effMap[k]; const label=eqStatLabel(k,o,e);
  let baseText=eqDisplayStatText(k,o); let addText=''; let finalText=baseText;
  if(e){
   if(e.hasRange){const bm=eqStatNum(o,'min'), bx=eqStatNum(o,'max'); const am=e.min, ax=e.max; addText=`<div class="eqYellow">+${fmt(am)}${am!==ax?'～'+fmt(ax):''}${e.unit||''}</div>`; finalText=`${fmt(bm+am)}${(bx+ax)!==(bm+am)?'～'+fmt(bx+ax):''}`;}
   else {const av=e.value; addText=`<div class="eqYellow">${av>=0?'+':''}${fmt(av)}${e.unit||''}</div>`; finalText=e.stackable===false?`${baseText} / ${fmt(av)}${e.unit||''}`:fmt(eqStatNum(o,'min')+av);}
   if(e.parts.length)addText+=`<div class="rSub">${esc(e.parts.join('、'))}</div>`;
  }
  return `<div class="kv"><div class="k">${esc(label)}</div><div class="v">${esc(finalText)}${addText}</div></div>`;
 }).join('');
 return `<div class="eqPreviewGrid"><div class="card" style="box-shadow:none"><h2 class="eqCompactTitle">裝備能力</h2><div class="eqStatGrid">${left}</div></div><div class="card" style="box-shadow:none"><h2 class="eqCompactTitle">合成後能力</h2><div class="eqSmall">白字為原有能力，黃字為所有已勾選配方的累加值。</div><div class="eqStatGrid">${right}</div></div></div>`;
}

function eqRenderRecipeArea(){
 const eq=eqSelected(); if(!eq)return '<div class="empty">請先選擇裝備。</div>';
 const recipes=eqSortRecipeObjects(eqAllowedRecipes());
 const groups=[['stable_1','安定值 1'],['stable_12','安定值 12'],['stable_50','安定值 50']];
 const groupRecipes=g=>recipes.filter(r=>g==='stable_50'?(r.group==='stable_50'||r.group==='stable_70'):r.group===g);
 const groupSelected=g=>eqSelectedRecipes().filter(x=>g==='stable_50'?(x.recipe.group==='stable_50'||x.recipe.group==='stable_70'):x.recipe.group===g);
 const renderSelected=g=>{
  const rows=groupSelected(g);
  if(!rows.length)return '<div class="muted" style="margin-top:8px">尚未加入這個安定值的配方。</div>';
  return `<div class="tableWrap" style="margin-top:10px"><table><thead><tr><th>已選配方</th><th>次數</th><th>操作</th></tr></thead><tbody>${rows.map(({recipe,count})=>`<tr><td><b>${esc(recipe.name)}</b><div class="rSub">${esc(recipe.effect_summary||'')}</div></td><td style="width:120px"><input class="eqRecipeCount" data-eq-recipe-count="${esc(recipe.id)}" type="number" min="1" value="${esc(count)}"></td><td style="width:90px"><button class="ghost" data-eq-recipe="${esc(recipe.id)}">移除</button></td></tr>`).join('')}</tbody></table></div>`;
 };
 return `<h3 id="eqRecipeAnchor">選擇配方</h3><div class="notice">配方改為下拉式加入，可跨安定值累加；材料清單會依安定值 1 → 12 → 50 的順序列出。</div>
 ${groups.map(([g,label])=>{const arr=groupRecipes(g);return `<div class="card" style="box-shadow:none"><h3>${esc(label)}</h3><label>加入配方</label><select data-eq-recipe-select="${esc(g)}"><option value="">請選擇要加入的配方</option>${arr.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}${r.effect_summary?'｜'+esc(r.effect_summary):''}</option>`).join('')}</select>${renderSelected(g)}</div>`}).join('')}
 <div class="quick"><button class="primary" id="eqOpenRandom">進入亂數模擬頁<small>進入後再選配方，像骰子一樣累計次數與材料</small></button><button class="primary" id="eqShowMaterials">產出所需材料清單<small>另開材料頁，並可返回</small></button></div>`;
}

function renderEquipmentCompoundPage(){
 if(
  typeof ensureCompoundDataLoaded==='function' &&
  (
   typeof compoundDataReady==='undefined'||!compoundDataReady||
   !(typeof itemIndex!=='undefined'&&itemIndex&&Object.keys(itemIndex).length)
  )
 ){
  if(typeof showPageLoading==='function')showPageLoading('常用裝備配方合成模擬');
  else byId('reader').innerHTML='<section class="card"><h1>常用裝備配方合成模擬讀取中</h1><div class="muted">正在載入道具、怪物與合成資料，請稍等。</div></section>';
  ensureCompoundDataLoaded().then(ok=>{if(ok)renderEquipmentCompoundPage();});
  return;
 }
 window.v86LastView='item';
 byId('reader').innerHTML=`<section class="card"><h1>常用裝備配方合成模擬</h1><div class="muted">先篩選裝備，點選裝備後會進入合成模擬頁。</div>
 <div class="eqFilterGrid"><div><label>種類（武器 / 防具 / 仙器）</label><select id="eqMain"></select></div><div><label>系列</label><select id="eqSeries"></select></div><div><label>階級 / 等級</label><select id="eqTier"></select></div><div><label>類型 / 部位</label><select id="eqType"></select></div><div style="grid-column:1/-1"><label>搜尋裝備名稱 / ID</label><input id="eqQ" value="${esc(eqState.q||'')}" placeholder="例如：椒圖、宮殤、劍、300"></div></div>
 <h3>選擇裝備</h3><div class="results" id="eqList"></div></section>`;
 eqRefreshFilters(); eqRefreshList();
 closeDrawer();
 window.scrollTo({top:0,behavior:'smooth'});
}

function eqRefreshSelect(){}

function openEquipmentSim(uid){
 eqState.uid=uid||eqState.uid;
 eqResetRandom(false);
 eqRenderPreview();
}

function eqRenderPreview(keepScroll=false){
 const y=window.scrollY||document.documentElement.scrollTop||0;
 const eq=eqSelected();
 if(!eq){renderEquipmentCompoundPage();return;}
 byId('reader').innerHTML=`<section class="card"><button class="backBtn" id="eqBackToList">← 返回裝備篩選</button><h1>常用裝備配方合成模擬</h1><h2>${esc(eq.name)}</h2>${eqMetaLine(eq)}${eqRenderStats(eq,true)}${eqRenderRecipeArea()}</section>`;
 closeDrawer();
 if(keepScroll)setTimeout(()=>window.scrollTo(0,y),0); else window.scrollTo({top:0,behavior:'smooth'});
}

function eqMaterials(recipe,count){const map={}; for(const st of recipe?.steps||[]){for(const m of st.materials||[]){const key=m.item_id||m.name; if(!map[key])map[key]={name:m.name||('ID '+m.item_id),item_id:m.item_id,qty:0}; map[key].qty+=(Number(m.qty)||0)*count;}} return Object.values(map);}

function eqAllMaterials(){const map={}; for(const {recipe,count} of eqSelectedRecipes()){for(const m of eqMaterials(recipe,count)){const key=m.item_id||m.name; if(!map[key])map[key]={name:m.name,item_id:m.item_id,qty:0}; map[key].qty+=m.qty;}} return Object.values(map);}

function showEquipmentMaterials(){
 const eq=eqSelected(), picks=eqSelectedRecipes(); if(!eq||!picks.length){empty('請先選擇裝備與至少一個配方');return}
 const sections=picks.map(({recipe,count})=>{const mats=eqMaterials(recipe,count); return `<h3>${esc(recipe.name)} × ${fmt(count)}</h3><div class="tableWrap"><table class="eqMatTable"><thead><tr><th>材料</th><th>數量</th></tr></thead><tbody>${mats.map(m=>`<tr><td>${esc(m.name)}</td><td>${fmt(m.qty)}</td></tr>`).join('')}</tbody></table></div>`;}).join('');
 byId('reader').innerHTML=`<section class="card"><button class="backBtn" id="eqBackToSim">← 返回常用裝備配方合成模擬</button><h1>所需材料清單</h1><div class="notice"><b>${esc(eq.name)}</b><br>材料依配方分開顯示，方便核對。</div>${sections}</section>`;
 window.scrollTo({top:0,behavior:'smooth'});
}

function eqResetRandom(clearSelection=true){eqState.simTotals={};eqState.simCount=0;eqState.simRecipeCounts={}; if(clearSelection)eqState.simSelectedRecipes={};}

function eqRollEffectValue(e){
 if(e.min!==undefined||e.max!==undefined){const min=Number(e.min)||0,max=Number(e.max)||min; return min+Math.floor(Math.random()*(max-min+1));}
 return Number(e.value)||0;
}

function eqSimToggleRecipe(id){eqState.simSelectedRecipes=eqState.simSelectedRecipes||{}; if(eqState.simSelectedRecipes[String(id)])delete eqState.simSelectedRecipes[String(id)]; else eqState.simSelectedRecipes[String(id)]=true; renderEquipmentRandomPage(true);}

function eqSimSelectedRecipes(){
 const allowed=new Set(eqAllowedRecipes().map(r=>String(r.id)));
 return Object.keys(eqState.simSelectedRecipes||{}).filter(id=>allowed.has(String(id))).map(id=>eqRecipeById(id)).filter(Boolean);
}

function eqRandomOnce(){
 if(!eqState.simTotals)eqState.simTotals={};
 if(!eqState.simRecipeCounts)eqState.simRecipeCounts={};
 const picks=eqSimSelectedRecipes(); if(!picks.length){alert('請先在亂數模擬頁勾選至少一個配方');return;}
 for(const recipe of picks){
  eqState.simRecipeCounts[String(recipe.id)]=(Number(eqState.simRecipeCounts[String(recipe.id)])||0)+1;
  for(const e of recipe.effects||[]){
   if(e.stackable===false)continue;
   const k=e.stat,label=e.label||eqData().stat_labels?.[k]||k;
   if(!eqState.simTotals[k])eqState.simTotals[k]={label,value:0};
   eqState.simTotals[k].value+=eqRollEffectValue(e);
  }
 }
 eqState.simCount++;
}

function eqRandomMaterialRows(){
 const counts=eqState.simRecipeCounts||{};
 const byRecipe=[];
 for(const [id,c] of Object.entries(counts)){
  const recipe=eqRecipeById(id); const count=Number(c)||0; if(!recipe||count<=0)continue;
  byRecipe.push({recipe,count,mats:eqMaterials(recipe,count)});
 }
 return byRecipe.sort((a,b)=>eqRecipeGroupRank(a.recipe)-eqRecipeGroupRank(b.recipe)||eqRecipeOrderIndex(a.recipe)-eqRecipeOrderIndex(b.recipe));
}

function eqRenderRandomRecipePicker(){
 const recipes=eqSortRecipeObjects(eqAllowedRecipes());
 const groups=[['stable_1','安定值 1'],['stable_12','安定值 12'],['stable_50','安定值 50']];
 const groupRecipes=g=>recipes.filter(r=>g==='stable_50'?(r.group==='stable_50'||r.group==='stable_70'):r.group===g);
 const groupSelected=g=>eqSortRecipeObjects(eqSimSelectedRecipes()).filter(r=>g==='stable_50'?(r.group==='stable_50'||r.group==='stable_70'):r.group===g);
 const renderSelected=g=>{
  const rows=groupSelected(g);
  if(!rows.length)return '<div class="muted" style="margin-top:8px">尚未加入這個安定值的模擬配方。</div>';
  return `<div class="tableWrap" style="margin-top:10px"><table><thead><tr><th>已選配方</th><th>已用次數</th><th>操作</th></tr></thead><tbody>${rows.map(recipe=>{const used=Number((eqState.simRecipeCounts||{})[String(recipe.id)])||0;return `<tr><td><b>${esc(recipe.name)}</b><div class="rSub">${esc(recipe.effect_summary||'')}</div></td><td>${fmt(used)}</td><td><button class="ghost" data-eq-sim-recipe="${esc(recipe.id)}">移除</button></td></tr>`}).join('')}</tbody></table></div>`;
 };
 return `<h3>選擇要模擬的配方</h3><div class="notice">這裡獨立選擇亂數模擬要用的配方，不需要先在上一頁勾好。每按一次「模擬一次」，目前加入的配方各計 1 次材料。</div>${groups.map(([g,label])=>{const arr=groupRecipes(g);return `<div class="card" style="box-shadow:none"><h3>${esc(label)}</h3><label>加入模擬配方</label><select data-eq-sim-recipe-select="${esc(g)}"><option value="">請選擇要加入的配方</option>${arr.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}${r.effect_summary?'｜'+esc(r.effect_summary):''}</option>`).join('')}</select>${renderSelected(g)}</div>`}).join('')}`;
}

function materialRank(item){
 if(typeof trainingMaterialRank==='function')return trainingMaterialRank(item);
 const s=String(item||'');
 let group=99;
 if(s.includes('四聖諦'))group=0;
 else if(s.includes('天照'))group=1;
 else if(s.includes('靈丹'))group=2;
 else if(s.includes('賢者之石'))group=3;
 else if(s.includes('真元'))group=4;
 else if(s.includes('聖鑽'))group=5;
 else if(s.includes('以太核'))group=6;
 else if(s.includes('六宇'))group=7;
 return [group,trainingElementRank(s),s];
}

function sortMaterialEntries(entries){
 return entries.sort((a,b)=>{
  const ra=materialRank(a[0]), rb=materialRank(b[0]);
  if(ra[0]!==rb[0])return ra[0]-rb[0];
  if(ra[1]!==rb[1])return ra[1]-rb[1];
  return ra[2].localeCompare(rb[2],'zh-Hant');
 });
}

// 提供命名空間給之後的 Python/HTML 編輯器或其他模組檢查可用功能。
window.SZO_COMPOUND_MODULE = {
  parseCompoundIniMulti: (typeof parseCompoundIniMulti==='function'?parseCompoundIniMulti:null),
  compTypeToDisplay: (typeof compTypeToDisplay==='function'?compTypeToDisplay:null),
  compGroupFromStable: (typeof compGroupFromStable==='function'?compGroupFromStable:null),
  compGroupLabel: (typeof compGroupLabel==='function'?compGroupLabel:null),
  compEffectList: (typeof compEffectList==='function'?compEffectList:null),
  buildCompoundRecipesFromIni: (typeof buildCompoundRecipesFromIni==='function'?buildCompoundRecipesFromIni:null),
  eqData: (typeof eqData==='function'?eqData:null),
  mergeCompoundIniRecipesWithConfig: (typeof mergeCompoundIniRecipesWithConfig==='function'?mergeCompoundIniRecipesWithConfig:null),
  eqUnique: (typeof eqUnique==='function'?eqUnique:null),
  eqEquipList: (typeof eqEquipList==='function'?eqEquipList:null),
  eqMergeItemIniStats: (typeof eqMergeItemIniStats==='function'?eqMergeItemIniStats:null),
  eqNumOrUndef: (typeof eqNumOrUndef==='function'?eqNumOrUndef:null),
  eqAddStatFromIni: (typeof eqAddStatFromIni==='function'?eqAddStatFromIni:null),
  eqAddRangeFromIni: (typeof eqAddRangeFromIni==='function'?eqAddRangeFromIni:null),
  eqBuildBaseStatsFromItemIni: (typeof eqBuildBaseStatsFromItemIni==='function'?eqBuildBaseStatsFromItemIni:null),
  eqRecipesForType: (typeof eqRecipesForType==='function'?eqRecipesForType:null),
  eqFmtVal: (typeof eqFmtVal==='function'?eqFmtVal:null),
  eqStatValueText: (typeof eqStatValueText==='function'?eqStatValueText:null),
  eqStatNum: (typeof eqStatNum==='function'?eqStatNum:null),
  eqFilteredEquipment: (typeof eqFilteredEquipment==='function'?eqFilteredEquipment:null),
  eqFillSelect: (typeof eqFillSelect==='function'?eqFillSelect:null),
  eqRefreshFilters: (typeof eqRefreshFilters==='function'?eqRefreshFilters:null),
  eqRefreshList: (typeof eqRefreshList==='function'?eqRefreshList:null),
  eqSelected: (typeof eqSelected==='function'?eqSelected:null),
  eqAllowedRecipes: (typeof eqAllowedRecipes==='function'?eqAllowedRecipes:null),
  eqRecipeById: (typeof eqRecipeById==='function'?eqRecipeById:null),
  eqSelectedRecipes: (typeof eqSelectedRecipes==='function'?eqSelectedRecipes:null),
  eqRecipeDefaultCount: (typeof eqRecipeDefaultCount==='function'?eqRecipeDefaultCount:null),
  eqRecipeGroupRank: (typeof eqRecipeGroupRank==='function'?eqRecipeGroupRank:null),
  eqRecipeOrderIndex: (typeof eqRecipeOrderIndex==='function'?eqRecipeOrderIndex:null),
  eqSortRecipeObjects: (typeof eqSortRecipeObjects==='function'?eqSortRecipeObjects:null),
  eqSortRecipePicks: (typeof eqSortRecipePicks==='function'?eqSortRecipePicks:null),
  eqAddRecipe: (typeof eqAddRecipe==='function'?eqAddRecipe:null),
  eqSimAddRecipe: (typeof eqSimAddRecipe==='function'?eqSimAddRecipe:null),
  eqToggleRecipe: (typeof eqToggleRecipe==='function'?eqToggleRecipe:null),
  eqSetRecipeCount: (typeof eqSetRecipeCount==='function'?eqSetRecipeCount:null),
  eqEffectAccumulator: (typeof eqEffectAccumulator==='function'?eqEffectAccumulator:null),
  eqBaseStatsWithRaw: (typeof eqBaseStatsWithRaw==='function'?eqBaseStatsWithRaw:null),
  eqCLevelText: (typeof eqCLevelText==='function'?eqCLevelText:null),
  eqStatLabel: (typeof eqStatLabel==='function'?eqStatLabel:null),
  eqDisplayStatText: (typeof eqDisplayStatText==='function'?eqDisplayStatText:null),
  eqMetaLine: (typeof eqMetaLine==='function'?eqMetaLine:null),
  eqRenderStats: (typeof eqRenderStats==='function'?eqRenderStats:null),
  eqRenderRecipeArea: (typeof eqRenderRecipeArea==='function'?eqRenderRecipeArea:null),
  renderEquipmentCompoundPage: (typeof renderEquipmentCompoundPage==='function'?renderEquipmentCompoundPage:null),
  eqRefreshSelect: (typeof eqRefreshSelect==='function'?eqRefreshSelect:null),
  openEquipmentSim: (typeof openEquipmentSim==='function'?openEquipmentSim:null),
  eqRenderPreview: (typeof eqRenderPreview==='function'?eqRenderPreview:null),
  eqMaterials: (typeof eqMaterials==='function'?eqMaterials:null),
  eqAllMaterials: (typeof eqAllMaterials==='function'?eqAllMaterials:null),
  showEquipmentMaterials: (typeof showEquipmentMaterials==='function'?showEquipmentMaterials:null),
  eqResetRandom: (typeof eqResetRandom==='function'?eqResetRandom:null),
  eqRollEffectValue: (typeof eqRollEffectValue==='function'?eqRollEffectValue:null),
  eqSimToggleRecipe: (typeof eqSimToggleRecipe==='function'?eqSimToggleRecipe:null),
  eqSimSelectedRecipes: (typeof eqSimSelectedRecipes==='function'?eqSimSelectedRecipes:null),
  eqRandomOnce: (typeof eqRandomOnce==='function'?eqRandomOnce:null),
  eqRandomMaterialRows: (typeof eqRandomMaterialRows==='function'?eqRandomMaterialRows:null),
  eqRenderRandomRecipePicker: (typeof eqRenderRandomRecipePicker==='function'?eqRenderRandomRecipePicker:null),
  materialRank: (typeof materialRank==='function'?materialRank:null),
  sortMaterialEntries: (typeof sortMaterialEntries==='function'?sortMaterialEntries:null)
};
