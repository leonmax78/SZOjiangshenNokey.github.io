// V301: collect book source lookup page.
(function(){
  const DATA_URL = 'data/collectbook_sources.json';
  const BONUS_URL = 'data/collectbook_bonus.json';
  const GROUP_SIZE = 96;
  const FILTER_STORAGE_KEY = 'szo.collectbook.filters.v1';
  const SCROLL_STORAGE_KEY = 'szo.collectbook.scroll.v1';
  const labels = {
    bonus: '武冠鋒雲錄能力值',
    weapon: '武防出處',
    artifact: '法器出處',
    recipe: '配方出處',
    beast: '封獸出處'
  };
  const state = {
    data: null,
    locations: {},
    loading: null,
    active: 'weapon',
    composing: false,
    query: { weapon: '', artifact: '', recipe: '', beast: '' },
    category: { weapon: 'all', artifact: 'all', recipe: 'all', beast: 'all' },
    segment: { weapon: 'all', artifact: 'all', recipe: 'all', beast: 'all' },
    sourceFilter: {
      weapon: { task: false, shop: false },
      artifact: { task: false, shop: false },
      recipe: { task: false, shop: false }
    },
    scroll: {}
  };

  function by(id){ return document.getElementById(id); }
  function escHtml(value){
    if(typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function readCollectFilterState(){
    try{
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if(!raw) return;
      const saved = JSON.parse(raw);
      ['weapon','artifact','recipe','beast'].forEach(kind => {
        if(saved.query && typeof saved.query[kind] === 'string') state.query[kind] = saved.query[kind];
        if(saved.category && typeof saved.category[kind] === 'string') state.category[kind] = saved.category[kind];
        if(saved.segment && typeof saved.segment[kind] === 'string') state.segment[kind] = saved.segment[kind];
      });
      ['weapon','artifact','recipe'].forEach(kind => {
        if(saved.sourceFilter && saved.sourceFilter[kind]){
          state.sourceFilter[kind] = {
            task: !!saved.sourceFilter[kind].task,
            shop: !!saved.sourceFilter[kind].shop
          };
        }
      });
    }catch(e){}
  }
  function writeCollectFilterState(){
    try{
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        query: state.query,
        category: state.category,
        segment: state.segment,
        sourceFilter: state.sourceFilter
      }));
    }catch(e){}
  }
  function readCollectScrollState(){
    try{
      const saved = JSON.parse(localStorage.getItem(SCROLL_STORAGE_KEY) || '{}');
      state.scroll = saved && typeof saved === 'object' ? saved : {};
    }catch(e){ state.scroll = {}; }
  }
  function saveCollectScroll(kind){
    const target = labels[kind] ? kind : state.active;
    if(!target || target === 'menu' || target === 'bonus') return;
    if(!document.querySelector('.collectPage')) return;
    if(document.querySelector('.collectDropDetailPage,.collectMenuPage,.collectBonusPage')) return;
    try{
      state.scroll[target] = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
      localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(state.scroll));
    }catch(e){}
  }
  function restoreCollectScroll(kind){
    const top = Number(state.scroll[kind] || 0);
    if(!Number.isFinite(top) || top <= 0) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try{ window.scrollTo({ top, behavior: 'auto' }); }catch(e){ window.scrollTo(0, top); }
    }));
  }
  readCollectFilterState();
  readCollectScrollState();
  function textList(values, emptyText){
    const list = (values || []).filter(Boolean);
    return list.length ? list.map(x => `<span class="collectTag">${escHtml(x)}</span>`).join('') : `<span class="muted">${escHtml(emptyText || '-')}</span>`;
  }
  function cleanMapLocationName(value){
    let text = String(value || '').trim();
    if(!text) return '';
    text = text
      .replace(/[「」]/g, '')
      .replace(/[（(][^）)]*\d+[^）)]*[）)]/g, '')
      .replace(/[（(]\s*\d.*$/g, '')
      .replace(/^\s*\d+.*$/g, '')
      .replace(/[）)]/g, '')
      .replace(/\s+/g, '')
      .trim();
    if(!text || /^[\d,，、\s]+$/.test(text)) return '';
    return text;
  }
  function mapLocationList(values){
    const out = [];
    const seen = new Set();
    (values || []).forEach(value => {
      splitLocationText(value).forEach(part => {
        const name = cleanMapLocationName(part);
        if(!name || seen.has(name)) return;
        seen.add(name);
        out.push(name);
      });
    });
    return out;
  }
  function mapLocationTags(values, queryName, emptyText){
    const list = mapLocationList(values);
    return list.length ? list.map(name => collectMapButton(name, name, queryName || '')).join('') : `<span class="muted">${escHtml(emptyText || '-')}</span>`;
  }
  function collectMapButton(label, mapName, queryName){
    return `<button class="collectTag collectMapTag" type="button" data-collect-map-location="${escHtml(mapName || label)}" data-collect-map-query="${escHtml(queryName || '')}">${escHtml(label)}</button>`;
  }
  function collectNoteTag(text){
    return `<span class="collectTag collectNoteTag">${escHtml(text)}</span>`;
  }
  function shopLocationTags(values, emptyText){
    const list = uniqueList(values || []);
    return list.length ? list.map(name => `<button class="collectTag collectMapTag" type="button" data-collect-shop-location="${escHtml(name)}">${escHtml(name)}</button>`).join('') : `<span class="muted">${escHtml(emptyText || '-')}</span>`;
  }
  function splitLocationText(value){
    return String(value || '').split(/[、,，/／]+/).map(x => x.trim()).filter(Boolean);
  }
  function uniqueList(values){
    const out = [];
    const seen = new Set();
    (values || []).forEach(value => {
      splitLocationText(value).forEach(part => {
        if(!part || seen.has(part)) return;
        seen.add(part);
        out.push(part);
      });
    });
    return out;
  }
  function beastMergedLocations(row){
    if(!row || row.kind !== 'beast') return row?.locations || [];
    const monsterLoc = state.locations && row.name ? state.locations[row.name] : '';
    return uniqueList([...(row.locations || []), monsterLoc]);
  }
  function plainBeastName(value){
    return String(value || '').replace(/[\[\]【】]/g, '').trim();
  }
  function monsterLocationNames(name){
    const target = plainBeastName(name);
    if(!target || !state.locations) return [];
    const direct = state.locations[target] || state.locations[name];
    if(direct) return mapLocationList([direct]);
    const norm = value => plainBeastName(value).replace(/[〈〉《》<>＜＞「」『』★☆○◎●⊕帝神極真超．.‧·\s]/g, '');
    const needle = norm(target);
    if(!needle) return [];
    const found = [];
    Object.keys(state.locations).forEach(key => {
      const k = norm(key);
      if(k && (k === needle || k.includes(needle) || needle.includes(k))) found.push(state.locations[key]);
    });
    return mapLocationList(found);
  }
  function locationButtonsForMonster(monsterName, options){
    const labelMode = options?.labelMode || 'map';
    const fixedMaps = options?.maps || [];
    const maps = fixedMaps.length ? fixedMaps : monsterLocationNames(monsterName);
    const seen = new Set();
    return maps.map(mapName => {
      const clean = cleanMapLocationName(mapName);
      if(!clean || seen.has(clean)) return '';
      seen.add(clean);
      const label = labelMode === 'monster' ? `${clean}（${plainBeastName(monsterName)}）` : clean;
      return collectMapButton(label, clean, plainBeastName(monsterName));
    }).filter(Boolean);
  }
  function beastSpecialLocationTags(row){
    const name = plainBeastName(row?.name);
    const chips = [];
    const addMonster = (monsterName, maps, labelMode) => chips.push(...locationButtonsForMonster(monsterName, { maps, labelMode }));
    const addMapMonster = (label, mapName, monsterName) => chips.push(collectMapButton(label, mapName, monsterName));
    const addNpc = (label, mapName, npcName) => chips.push(collectMapButton(label, mapName, npcName));
    const addNote = text => chips.push(collectNoteTag(text));
    if(name === '熊武者'){
      chips.push(collectMapButton('桃花林西方（戌時-卯時）', '桃花林西方', '熊武者'));
    }else if(name === '虎霸王'){
      chips.push(collectMapButton('掩月松林（戌時-卯時）', '掩月松林', '虎霸王'));
    }else if(name === '兔仙人'){
      addMonster('飛毛兔', [], 'monster');
      addMonster('搗藥兔', [], 'monster');
      addNote('擊殺飛毛兔、搗藥兔機率變身');
    }else if(name === '九尾狐'){
      addMonster('百草狐郎中', [], 'monster');
      addNote('戌時-卯時擊殺百草狐郎中機率現身');
    }else if(name === '隱者狸仙'){
      addMonster('小妖狸', [], 'monster');
      addMonster('妖狸射手', [], 'monster');
      addNote('擊殺小妖狸、妖狸射手機率變身');
    }else if(name === '千年靈芝精' || name === '千年蔘精'){
      chips.push(collectMapButton('不老峰', '不老峰', '千年樹精'));
      chips.push(collectMapButton('掩月松林（擊殺千年樹精）', '掩月松林', '千年樹精'));
      addNote('擊殺千年樹精機率現身');
    }else if(name === '紫燄影凰'){
      addNpc('高昌郡（外域鐵匠漢哥）', '高昌郡', '外域鐵匠漢哥');
      addNote('四聖諦 200 顆兌換');
      addNpc('京城（侯利蒙）', '京城', '侯利蒙');
      addNote('聖恩彩票 3500 張兌換');
      addMapMonster('終末之塔第5、6層（森羅冷指）', '終末之塔第5層', '森羅冷指');
    }else if(name === '焚世炎帝'){
      addNpc('波斯西市（波斯聖寶商）', '波斯西市', '波斯聖寶商');
      addNote('大波斯聖徽 5000 個兌換');
    }else if(name === '浩天將神'){
      addNpc('波斯西市（波斯祕寶商）', '波斯西市', '波斯祕寶商');
      addNote('波斯聖徽 5000 個兌換');
      addMapMonster('終末之塔第126層守關者【翻江裂地鮫】', '終末之塔第126層', '翻江裂地鮫');
      addMapMonster('虛空渦心（虛淵鬥靈）', '虛空渦心', '虛淵鬥靈');
    }else if(name === '霜血霸蜥'){
      addNpc('靜默之丘（拜金仙女）', '靜默之丘', '拜金仙女');
      addNote('雄獅勳章 4000 個兌換');
      addMapMonster('赫勒神殿遺址（護棺刃鱷）', '赫勒神殿遺址', '護棺刃鱷');
      addMapMonster('終末之塔第26層守關者【虛空神凜冰麒】', '終末之塔第26層', '虛空神凜冰麒');
      addMapMonster('終末之塔第146層守關者【宇外兇鬥士】', '終末之塔第146層', '宇外兇鬥士');
    }
    return chips;
  }
  function sevenTreasureMapName(raw){
    if(raw.includes('帝')) return '帝七寶仙境　壹';
    if(raw.includes('神')) return '神七寶仙境　壹';
    if(raw.includes('超')) return '超七寶仙境　壹';
    if(raw.includes('真')) return '真七寶仙境　壹';
    if(raw.includes('極')) return '極七寶仙境　壹';
    return '七寶仙境　壹';
  }
  function splitMonsterNames(value){
    return String(value || '').split(/[、,，/／]+/).map(x => x.trim()).filter(Boolean);
  }
  function rawBeastLocationTags(row){
    const out = [];
    const seen = new Set();
    let bracketContextMap = '';
    const push = html => {
      if(!html || seen.has(html)) return;
      seen.add(html);
      out.push(html);
    };
    beastSpecialLocationTags(row).forEach(push);
    if(out.length) return out.join('');
    const rawRowName = String(row?.name || '').trim();
    const rowMonsterButtons = /^[\[【]/.test(rawRowName) ? locationButtonsForMonster(plainBeastName(rawRowName)) : [];
    if(rowMonsterButtons.length){
      rowMonsterButtons.forEach(push);
      return out.join('');
    }
    (row?.locations || []).forEach(rawValue => {
      const raw = String(rawValue || '').trim();
      if(!raw) return;
      if(raw.includes('水晶礦坑') && raw.includes('侏人神兵鐵匠')){
        push(collectMapButton('水晶礦坑（侏人神兵鐵匠）', '水晶礦坑', '侏人神兵鐵匠'));
        push(collectNoteTag('【水晶鑽、紅水晶鑽、青水晶鑽、灰水晶鑽】各125顆兌換'));
        return;
      }
      const exchangeMatch = raw.match(/找\s*([^【】\s]+)\s*[【\[]([^】\]]+)[】\]].*換取/);
      if(exchangeMatch){
        const mapName = cleanMapLocationName(exchangeMatch[1]);
        const npcName = exchangeMatch[2].trim();
        if(mapName && npcName) push(collectMapButton(`${mapName}（${npcName}）`, mapName, npcName));
        push(collectNoteTag(raw.replace(/\s+/g, ' ').trim()));
        return;
      }
      const mapMonsterMatch = raw.match(/[【\[]([^】\]]+)[】\]].*(?:小怪|怪物|Boss|王)[【\[]([^】\]]+)[】\]]/);
      if(mapMonsterMatch){
        const mapName = cleanMapLocationName(mapMonsterMatch[1]);
        const monsterName = mapMonsterMatch[2].trim();
        if(mapName && monsterName) push(collectMapButton(`${mapName}（${monsterName}）`, mapName, monsterName));
        return;
      }
      const towerMatch = raw.match(/終末之塔第\s*([0-9]+)\s*層守關者\s*[【\[]([^】\]]+)[】\]]/);
      if(towerMatch){
        const monsterName = towerMatch[2].trim();
        const label = `終末之塔第${towerMatch[1]}層守關者【${monsterName}】`;
        push(collectMapButton(label, `終末之塔第${towerMatch[1]}層`, monsterName));
        return;
      }
      const sevenMatches = [...raw.matchAll(/[【\[]([^】\]]+)[】\]]/g)].map(m => m[1].trim()).filter(Boolean);
      if(raw.includes('七寶仙境') && sevenMatches.length){
        bracketContextMap = sevenTreasureMapName(raw);
        const monsterNames = raw.includes('任一') ? splitMonsterNames(sevenMatches[sevenMatches.length - 1]) : sevenMatches;
        monsterNames.filter(monsterName => !monsterName.includes('七寶仙境')).forEach(monsterName => {
          push(collectMapButton(`${bracketContextMap.replace('　壹', '')}（${monsterName}）`, bracketContextMap, monsterName));
        });
        return;
      }
      if(raw.includes('無限鬥界') && sevenMatches.length){
        const mapName = raw.includes('修羅級') ? '修羅級無限鬥界' : '無限鬥界';
        sevenMatches.forEach(monsterName => push(collectMapButton(`${mapName}（${monsterName}）`, mapName, monsterName)));
        return;
      }
      if(/錦囊|抽取|彩票|勳章|仙印|天印|換取|兌換/.test(raw)){
        push(collectNoteTag(raw));
        return;
      }
      if(sevenMatches.length){
        sevenMatches.forEach(monsterName => {
          if(/錦囊|彩票|勳章|仙印|天印/.test(monsterName)){
            push(collectNoteTag(raw));
            return;
          }
          if(bracketContextMap){
            splitMonsterNames(monsterName).forEach(name => push(collectMapButton(`${bracketContextMap.replace('　壹', '')}（${name}）`, bracketContextMap, name)));
            return;
          }
          const buttons = locationButtonsForMonster(monsterName);
          if(buttons.length) buttons.forEach(push);
          else push(collectNoteTag(raw));
        });
        return;
      }
      const buttons = mapLocationTags([raw], plainBeastName(row?.name), '');
      if(buttons && !buttons.includes('muted')) push(buttons);
    });
    const monsterLoc = state.locations && row?.name ? state.locations[row.name] : '';
    if(monsterLoc) mapLocationList([monsterLoc]).forEach(mapName => push(collectMapButton(mapName, mapName, plainBeastName(row.name))));
    return out.length ? out.join('') : `<span class="muted">沒有捕抓地點</span>`;
  }
  function normDropName(value){
    return String(value || '')
      .replace(/[\s\[\]【】<>＜＞「」『』《》〈〉（）()◢◣◥◤▾▴▸◂▼▲◆◇■□★☆‧·．・]/g, '')
      .trim();
  }
  function dropList(excelDrops, reverseDrops, emptyText){
    const reverse = reverseDrops || [];
    const usedReverse = new Set();
    const rows = [];
    function reverseMatches(name){
      const key = normDropName(name);
      if(!key) return [];
      return reverse.map((d, index) => ({ d, index })).filter(({ d }) => {
        const other = normDropName(d.monster);
        return other && (other === key || other.includes(key) || key.includes(other));
      });
    }
    (excelDrops || []).forEach(name => {
      const matches = reverseMatches(name);
      if(matches.length){
        matches.forEach(({ d, index }) => {
          usedReverse.add(index);
          rows.push({ name: d.monster || name, locations: d.locations || [], level: d.level || '', rate: d.rate, fromReverse: true });
        });
      }else{
        rows.push({ name, locations: [] });
      }
    });
    reverse.forEach((d, index) => {
      if(usedReverse.has(index)) return;
      rows.push({ name: d.monster || '', locations: d.locations || [], level: d.level || '', rate: d.rate, fromReverse: true });
    });
    const uniqRows = [];
    const seen = new Set();
    rows.forEach(row => {
      const name = String(row.name || '').trim();
      if(!name) return;
      const key = name + '|' + (row.locations || []).join('、') + '|' + (row.level || '') + '|' + (row.rate ?? '');
      if(seen.has(key)) return;
      seen.add(key);
      uniqRows.push({ name, locations: row.locations || [], level: row.level || '', rate: row.rate });
    });
    uniqRows.sort((a,b) => {
      const ar = Number(a.rate);
      const br = Number(b.rate);
      const ah = Number.isFinite(ar);
      const bh = Number.isFinite(br);
      if(ah && bh && br !== ar) return br - ar;
      if(ah !== bh) return ah ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'zh-Hant');
    });
    if(!uniqRows.length) return `<span class="muted">${escHtml(emptyText || '-')}</span>`;
    return `<div class="collectDropList">${uniqRows.map(row => {
      const loc = (row.locations || []).filter(Boolean).join('、');
      const meta = [];
      if(row.rate !== undefined && row.rate !== null && row.rate !== '') meta.push(Number(row.rate).toFixed(6) + '%');
      return `<div class="collectDropItem"><span class="collectDropName">${escHtml(row.name)}</span>${meta.length ? `<span class="collectDropInfo">${escHtml(meta.join('｜'))}</span>` : ''}${loc ? `<span class="collectDropLoc">${escHtml(loc)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function dropLocationText(row){
    if(row.kind === 'beast') return rawBeastLocationTags(row);
    const shopSet = new Set(row.shops || []);
    const drops = (row.excelSources || []).filter(x => !shopSet.has(x));
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const dropCount = reverseCount || drops.length;
    if(!dropCount) return '<span class="muted">沒有掉落位置</span>';
    if(!row.itemId) return dropList(drops, row.reverseDrops || [], '沒有掉落位置');
    return `<div class="collectDropSummary">
      <button class="collectReverseBtn primary" type="button" data-collect-reverse="${escHtml(row.itemId)}">查看掉落資訊<small>共 ${dropCount} 筆掉落資料</small></button>
    </div>`;
  }
  function formatRate(value){
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(6) + '%' : '-';
  }
  function getItemName(item){
    return String(item?.name || item?.Name || '').trim();
  }
  function getItemId(item){
    return String(item?.id || item?.ID || '').trim();
  }
  function getDropMonsterName(drop){
    return String(drop?.monsterName || drop?.monster?.Name || drop?.monster || '').trim();
  }
  function getDropMonsterLevel(drop){
    return String(drop?.monster?.Level || drop?.level || '').trim();
  }
  function getDropMonsterLocations(drop){
    if(Array.isArray(drop?.locations) && drop.locations.length) return drop.locations.filter(Boolean);
    const name = getDropMonsterName(drop);
    try{
      const loc = typeof locOf === 'function' ? locOf(name) : '';
      return loc ? [loc] : [];
    }catch(e){
      return [];
    }
  }
  async function enrichCollectSourceDrops(row){
    if(!row || row._sourceDropsReady) return row;
    const reverseRows = Array.isArray(row.reverseDrops) ? row.reverseDrops : [];
    const needNames = reverseRows
      .filter(drop => !getDropMonsterLocations(drop).length)
      .map(drop => getDropMonsterName(drop))
      .filter(Boolean);
    if(!needNames.length){
      row._sourceDropsReady = true;
      return row;
    }
    try{
      const [itemData, reverseData, monsterData] = await Promise.all([
        typeof loadDataBundle === 'function' ? loadDataBundle('items') : null,
        typeof loadDataBundle === 'function' ? loadDataBundle('drop_reverse') : null,
        typeof loadDataBundle === 'function' ? loadDataBundle('monsters') : null
      ]);
      const itemList = Array.isArray(itemData) ? itemData : [];
      const reverseIndex = reverseData && typeof reverseData === 'object' ? reverseData : {};
      const monsterById = {};
      (Array.isArray(monsterData) ? monsterData : []).forEach(monster => {
        const id = String(monster?.ID || monster?.id || '').trim();
        if(id) monsterById[id] = monster;
      });
      const sourceDropsByName = {};
      const sourceItemIdsByName = {};
      needNames.forEach(name => {
        const item = itemList.find(it => getItemName(it) === name);
        const id = getItemId(item);
        const drops = id ? (reverseIndex[id] || []) : [];
        if(!drops.length) return;
        sourceItemIdsByName[name] = id;
        sourceDropsByName[name] = drops.map(drop => {
          const monster = monsterById[String(drop?.monsterId || '').trim()] || drop?.monster || null;
          const enriched = Object.assign({}, drop, { monster });
          return {
            monster: getDropMonsterName(enriched),
            level: getDropMonsterLevel(enriched),
            rate: drop?.rate,
            locations: getDropMonsterLocations(enriched)
          };
        }).filter(drop => drop.monster);
      });
      row.sourceDropsByName = sourceDropsByName;
      row.sourceItemIdsByName = sourceItemIdsByName;
    }catch(e){
      row.sourceDropsByName = {};
      row.sourceItemIdsByName = {};
    }
    row._sourceDropsReady = true;
    return row;
  }
  function findCollectRow(itemId){
    const id = String(itemId || '');
    const kinds = [state.active, 'weapon', 'artifact', 'recipe'].filter((kind, index, arr) => kind && arr.indexOf(kind) === index);
    for(const kind of kinds){
      const row = getRows(kind).find(item => String(item.itemId || '') === id);
      if(row) return row;
    }
    return null;
  }
  function collectDropDetailRows(row){
    const reverse = Array.isArray(row?.reverseDrops) ? row.reverseDrops : [];
    if(reverse.length){
      return `<div class="tableWrap monsterDropTable collectDropDetailTable"><table>
        <thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead>
        <tbody>${reverse.map(drop => `<tr>
          <td>${escHtml(drop.monster || '-')}</td>
          <td>${escHtml((drop.locations || []).filter(Boolean).join('、') || '沒有位置資料')}</td>
          <td>${escHtml(formatRate(drop.rate))}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
    const shopSet = new Set(row?.shops || []);
    const drops = (row?.excelSources || []).filter(x => !shopSet.has(x));
    return drops.length
      ? `<div class="tableWrap monsterDropTable collectDropDetailTable"><table><thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead><tbody>${drops.map(name => `<tr><td>${escHtml(name)}</td><td>-</td><td>-</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">沒有掉落資料</div>';
  }
  function renderCollectDropDetail(itemId){
    const row = findCollectRow(itemId);
    const reader = by('reader');
    if(!reader) return;
    if(!row){
      reader.innerHTML = '<section class="card collectPage"><button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button><div class="empty">找不到這筆掉落資料</div></section>';
      return;
    }
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const shopSet = new Set(row.shops || []);
    const dropCount = reverseCount || (row.excelSources || []).filter(x => !shopSet.has(x)).length;
    reader.innerHTML = `<section class="card collectPage collectDropDetailPage">
      <button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button>
      <h1>${escHtml(row.name || '-')}</h1>
      <p class="muted collectDropDetailMetaLine">掉落反查｜共 ${dropCount} 筆</p>
      <div class="collectDropDetailList">${collectDropDetailRows(row)}</div>
    </section>`;
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function collectDropDetailRows(row){
    const reverse = Array.isArray(row?.reverseDrops) ? row.reverseDrops : [];
    if(reverse.length){
      return `<div class="collectReverseCompactList">${reverse.map(drop => {
          const sourceDrops = (row.sourceDropsByName || {})[drop.monster] || [];
          const sourceItemId = (row.sourceItemIdsByName || {})[drop.monster] || '';
          const locHtml = mapLocationTags(drop.locations || [], drop.monster, '沒有位置資料');
          const hasNested = sourceDrops.length && sourceItemId;
          return `<div class="collectReverseCompactRow">
            <div class="collectReverseCompactMain">
              <div class="collectReverseCompactName">${escHtml(drop.monster || '-')}</div>
              ${hasNested
                ? `<button type="button" class="collectNestedReverseBtn" data-collect-nested-reverse="${escHtml(sourceItemId)}" data-collect-parent="${escHtml(row.itemId || '')}">掉落位置</button>`
                : `<div class="collectReverseCompactLoc">${locHtml}</div>`}
            </div>
            <div class="collectReverseCompactRate">${escHtml(formatRate(drop.rate))}</div>
          </div>`;
        }).join('')}</div>`;
    }
    const shopSet = new Set(row?.shops || []);
    const drops = (row?.excelSources || []).filter(x => !shopSet.has(x));
    return drops.length
      ? `<div class="tableWrap monsterDropTable collectDropDetailTable"><table><thead><tr><th>怪物</th><th>位置</th><th>機率</th></tr></thead><tbody>${drops.map(name => `<tr><td>${escHtml(name)}</td><td>-</td><td>-</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">沒有掉落資料</div>';
  }
  async function renderCollectDropDetail(itemId){
    const row = findCollectRow(itemId);
    const reader = by('reader');
    if(!reader) return;
    if(!row){
      reader.innerHTML = '<section class="card collectPage"><button class="backBtn" type="button" data-collect-back>返回武冠系統</button><div class="empty">找不到掉落資料</div></section>';
      return;
    }
    await enrichCollectSourceDrops(row);
    const reverseCount = Array.isArray(row.reverseDrops) ? row.reverseDrops.length : 0;
    const shopSet = new Set(row.shops || []);
    const dropCount = reverseCount || (row.excelSources || []).filter(x => !shopSet.has(x)).length;
    reader.innerHTML = `<section class="card collectPage collectDropDetailPage">
      <button class="backBtn" type="button" data-collect-back>← 返回武冠系統</button>
      <h1>${escHtml(row.name || '-')}</h1>
      <p class="muted collectDropDetailMetaLine">掉落反查｜共 ${dropCount} 筆</p>
      <div class="collectDropDetailList">${collectDropDetailRows(row)}</div>
    </section>`;
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function taskText(row){
    if(!row.taskFlag) return '<span class="muted">-</span>';
    return row.taskNames && row.taskNames.length ? textList(row.taskNames) : '<span class="collectTag">任務取得</span>';
  }
  function beastSkillChecks(row){
    const enabled = new Set(row.skills || []);
    return `<div class="beastSkillChecks">
      ${['迷惑術','奪心術','縛靈術'].map(name => `<span class="beastSkill ${enabled.has(name) ? 'on' : 'off'}"><span class="beastCheckMark">${enabled.has(name) ? '✓' : ''}</span>${escHtml(name)}</span>`).join('')}
    </div>`;
  }
  function getRows(kind){
    const data = state.data || {};
    return Array.isArray(data[kind]) ? data[kind] : [];
  }
  function getBonusRows(){
    const bonus = state.data?.bonus || {};
    return Array.isArray(bonus.rows) ? bonus.rows : [];
  }
  function collectScoreTotal(){
    return ['weapon', 'artifact', 'recipe', 'beast'].reduce((sum, kind) => {
      return sum + getRows(kind).reduce((part, row) => part + (Number(row.score) || 0), 0);
    }, 0);
  }
  function formatNum(value){
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('zh-TW') : String(value || '0');
  }
  function statGroupText(row, keys, labels){
    const values = keys.map(key => Number(row[key]) || 0);
    if(values.every(value => !value)) return '';
    const first = values[0];
    if(values.every(value => value === first)){
      return `<li><span>${escHtml(labels.join('、'))}</span><strong>+${formatNum(first)}</strong></li>`;
    }
    return keys.map((key, index) => values[index] ? `<li><span>${escHtml(labels[index])}</span><strong>+${formatNum(values[index])}</strong></li>` : '').join('');
  }
  function bonusName(row){
    const name = String(row?.Name || '').trim();
    const match = name.match(/^(鋒雲錄)(\d+)(重天)$/);
    if(!match) return name || '-';
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  function bonusStats(row){
    return [
      statGroupText(row, ['Con', 'Str', 'Int', 'Dex'], ['體魄', '力量', '智慧', '靈敏']),
      statGroupText(row, ['Def', 'MDef'], ['防禦', '術防']),
      statGroupText(row, ['MaxHP', 'MaxMP'], ['最大生命', '最大精力'])
    ].filter(Boolean).join('');
  }
  function categories(kind){
    const rows = getRows(kind);
    if(kind === 'beast'){
      const ordered = [];
      rows.forEach(row => {
        if(row.category && !ordered.includes(row.category)) ordered.push(row.category);
      });
      return ordered;
    }
    if(kind !== 'weapon') return [];
    const exists = new Set(rows.map(row => row.category).filter(Boolean));
    const ordered = Array.isArray(state.data?.meta?.weaponCategoryOrder) ? state.data.meta.weaponCategoryOrder.filter(cat => exists.has(cat)) : [];
    rows.forEach(row => {
      if(row.category && !ordered.includes(row.category)) ordered.push(row.category);
    });
    return ordered;
  }
  function baseRowsForSegment(kind){
    const cat = state.category[kind] || 'all';
    return getRows(kind).filter(row => {
      if(cat !== 'all' && row.category !== cat) return false;
      return true;
    });
  }
  function segmentLabelBase(kind){
    if(kind === 'weapon'){
      return state.category.weapon !== 'all' ? state.category.weapon : '武防';
    }
    if(kind === 'artifact') return '法器';
    if(kind === 'recipe') return '配方';
    return '封獸';
  }
  function segments(kind){
    if(kind === 'beast') return [];
    if(kind === 'weapon' && state.category.weapon === 'all') return [];
    const rows = baseRowsForSegment(kind);
    const base = segmentLabelBase(kind);
    const count = Math.ceil(rows.length / GROUP_SIZE);
    return Array.from({ length: count }, (_, index) => ({
      value: String(index + 1),
      label: base + String(index + 1),
      from: index * GROUP_SIZE,
      to: Math.min((index + 1) * GROUP_SIZE, rows.length)
    }));
  }
  function segmentedRows(kind){
    const rows = baseRowsForSegment(kind);
    const seg = state.segment[kind] || 'all';
    if(seg === 'all') return rows;
    const index = Number(seg) - 1;
    if(!Number.isFinite(index) || index < 0) return rows;
    return rows.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE);
  }
  function filteredRows(kind){
    const q = String(state.query[kind] || '').trim().toLowerCase();
    const source = state.sourceFilter[kind] || {};
    return segmentedRows(kind).filter(row => {
      if(source.task && !row.taskFlag) return false;
      if(source.shop && !(row.shopFlag || (row.shops || []).length)) return false;
      if(!q) return true;
      return [row.name, row.itemId, row.searchText, ...(kind === 'beast' ? beastMergedLocations(row) : [])].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }
  async function loadData(){
    if(state.data) return state.data;
    if(state.loading) return state.loading;
    const version = encodeURIComponent(document.body?.dataset?.version || 'dev');
    state.loading = Promise.all([
      fetch(DATA_URL + '?v=' + version).then(res => {
        if(!res.ok) throw new Error('Collect book data load failed');
        return res.json();
      }),
      fetch(BONUS_URL + '?v=' + version).then(res => res.ok ? res.json() : { rows: [] }).catch(() => ({ rows: [] })),
      typeof loadDataBundle === 'function' ? loadDataBundle('locations').catch(() => ({})) : Promise.resolve({})
    ]).then(([data, bonus, locations]) => {
        data.bonus = bonus || { rows: [] };
        state.data = data;
        state.locations = locations && typeof locations === 'object' && !Array.isArray(locations) ? locations : {};
        return data;
      });
    return state.loading;
  }
  function syncNav(kind){
    document.querySelectorAll('.navBtn[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'collect'));
    document.querySelectorAll('.formBox').forEach(box => box.classList.remove('active'));
    by('collectForm')?.classList.add('active');
    document.querySelectorAll('[data-collect-open]').forEach(btn => btn.classList.toggle('active', btn.dataset.collectOpen === kind));
  }
  function renderBonusPage(){
    state.active = 'bonus';
    window.SZO_COLLECT_ACTIVE = 'bonus';
    syncNav('bonus');
    const rows = getBonusRows();
    const reader = by('reader');
    if(!reader) return;
    const scoreTotal = collectScoreTotal();
    const latest = rows[rows.length - 1] || null;
    reader.innerHTML = `<section class="card collectPage collectBonusPage">
      <div class="collectBonusHero">
        <div>
          <h1>武冠鋒雲錄能力值</h1>
          <p>當前版本武冠最高積分：<strong>${formatNum(scoreTotal)}</strong></p>
        </div>
        ${latest ? `<div class="collectBonusLatest"><span>最高階</span><strong>${escHtml(bonusName(latest))}</strong></div>` : ''}
      </div>
      <div class="collectBonusList">${rows.map(row => `<article class="collectBonusCard">
        <div class="collectBonusHead">
          <div class="collectBonusName">${escHtml(bonusName(row))}</div>
          <div class="collectBonusScore">積分：${formatNum(row.Value)}</div>
        </div>
        <ul class="collectBonusStats">${bonusStats(row)}</ul>
      </article>`).join('') || '<div class="empty">沒有能力值資料。</div>'}</div>
    </section>`;
  }
  function controls(kind){
    const cats = kind === 'weapon' || kind === 'beast' ? categories(kind) : [];
    const catLabel = kind === 'beast' ? '全部星等' : '全部分類';
    const catOptions = [`<option value="all">${catLabel}</option>`].concat(cats.map(cat => `<option value="${escHtml(cat)}" ${state.category[kind] === cat ? 'selected' : ''}>${escHtml(cat)}</option>`)).join('');
    const segs = segments(kind);
    const segmentOptions = ['<option value="all">全部區段</option>'].concat(segs.map(seg => `<option value="${escHtml(seg.value)}" ${state.segment[kind] === seg.value ? 'selected' : ''}>${escHtml(seg.label)}</option>`)).join('');
    const source = state.sourceFilter[kind] || { task: false, shop: false };
    const sourceFilters = kind !== 'beast' ? `<div class="collectChecks">
      <label class="collectCheck"><span>任務取得</span><input type="checkbox" data-collect-source="task" ${source.task ? 'checked' : ''}></label>
      <label class="collectCheck"><span>商店取得</span><input type="checkbox" data-collect-source="shop" ${source.shop ? 'checked' : ''}></label>
    </div>` : '';
    return `<div class="collectTools">
      <input id="collectSearch" value="${escHtml(state.query[kind])}" placeholder="搜尋${escHtml(labels[kind])}名稱或 ID">
      ${kind === 'weapon' || kind === 'beast' ? `<select id="collectCategory">${catOptions}</select>` : ''}
      ${segs.length ? `<select id="collectSegment">${segmentOptions}</select>` : ''}
      <button class="ghost collectClearBtn" type="button" data-collect-clear>清空篩選</button>
    </div>${sourceFilters}`;
  }
  function metaPair(label, valueHtml, extraClass){
    return `<div class="collectMeta ${extraClass || ''}"><div class="collectMetaLabel">${escHtml(label)}</div><div class="collectMetaValue">${valueHtml}</div></div>`;
  }
  function list(kind, rows){
    const isBeast = kind === 'beast';
    const body = rows.map(row => {
      if(isBeast){
        return `<article class="collectRow collectBeastRow">
          <div class="collectItemHead"><div class="collectName">${escHtml(row.name)}</div><div class="collectScore">${escHtml(row.score || '-')} 分</div></div>
          <div class="collectGrid beastGrid">
            ${metaPair('甕種', escHtml(row.category || '-'))}
            ${metaPair('強度', escHtml(row.strength || '-'))}
            ${metaPair('術者可使用技能', beastSkillChecks(row))}
            ${metaPair('捕抓地點', dropLocationText(row), 'wide')}
          </div>
        </article>`;
      }
      const category = kind === 'weapon' ? `<div class="collectCategory">${escHtml(row.category || '-')}</div>` : '';
      return `<article class="collectRow">
        <div class="collectItemHead">
          <div><div class="collectName">${escHtml(row.name)}</div>${category}</div>
          <div class="collectScore">${escHtml(row.score || '-')} 分</div>
        </div>
        <div class="collectGrid">
          ${metaPair('任務取得', taskText(row))}
          ${metaPair('商店取得', shopLocationTags(row.shops, '-'))}
          ${metaPair('掉落位置', dropLocationText(row), 'wide')}
        </div>
      </article>`;
    }).join('');
    return `<div class="collectList">${body || '<div class="empty">沒有符合條件的資料。</div>'}</div>`;
  }
  function renderLoaded(kind){
    if(kind === 'bonus'){
      renderBonusPage();
      return;
    }
    state.active = labels[kind] ? kind : 'weapon';
    kind = state.active;
    window.SZO_COLLECT_ACTIVE = kind;
    syncNav(kind);
    const rows = filteredRows(kind);
    const reader = by('reader');
    if(!reader) return;
    reader.innerHTML = `<section class="card collectPage">
      <div class="collectHeader">
        <h1>${escHtml(labels[kind])}</h1>
        <div class="shopCount" id="collectCount">${rows.length} 筆</div>
      </div>
      ${controls(kind)}
      <div id="collectResults">${list(kind, rows)}</div>
      <button class="collectTopBtn" type="button" data-collect-top>↑ 回到頂部</button>
    </section>`;
    const input = by('collectSearch');
    if(input) input.focus({preventScroll:true});
    restoreCollectScroll(kind);
  }
  function renderCollectResults(){
    const kind = state.active;
    const rows = filteredRows(kind);
    const count = by('collectCount');
    const results = by('collectResults');
    if(count) count.textContent = rows.length + ' 筆';
    if(results) results.innerHTML = list(kind, rows);
  }
  function renderCollectMenu(){
    syncNav('menu');
    const reader = by('reader');
    if(!reader) return;
    const entries = ['bonus', 'weapon', 'artifact', 'recipe', 'beast'];
    reader.innerHTML = `<section class="card collectPage collectMenuPage">
      <h1>武冠收錄資料</h1>
      <div class="collectList">${entries.map(kind => `<button type="button" class="resultItem" data-collect-open="${escHtml(kind)}"><div class="rName">${escHtml(labels[kind])}</div><div class="rSub">查看${escHtml(labels[kind])}的來源與掉落資料</div></button>`).join('')}</div>
    </section>`;
  }
  async function renderCollectBookPage(kind){
    saveCollectScroll(state.active);
    if(!labels[kind]){
      state.active = 'menu';
      window.SZO_COLLECT_ACTIVE = 'menu';
      window.v86LastView = 'collect';
      renderCollectMenu();
      try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
      try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
      return;
    }
    kind = labels[kind] ? kind : 'weapon';
    window.SZO_COLLECT_ACTIVE = kind;
    window.v86LastView = 'collect';
    const reader = by('reader');
    if(reader) reader.innerHTML = '<section class="card collectPage"><h1>武冠收錄資料</h1><div class="muted">資料載入中...</div></section>';
    try{
      await loadData();
      renderLoaded(kind);
    }catch(err){
      if(reader) reader.innerHTML = '<section class="card collectPage"><h1>武冠收錄資料</h1><div class="empty">武冠收錄資料載入失敗，請重新整理一次。</div></section>';
    }
    try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
    if(kind === 'bonus') try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){}
  }
  function clearCollectBookSearch(kind){
    const target = labels[kind] ? kind : state.active;
    if(target && state.query[target] !== undefined) state.query[target] = '';
    if(target && state.category[target] !== undefined) state.category[target] = 'all';
    if(target && state.segment[target] !== undefined) state.segment[target] = 'all';
    if(state.sourceFilter[target]) state.sourceFilter[target] = { task: false, shop: false };
    if(target) state.scroll[target] = 0;
    writeCollectFilterState();
    try{ localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(state.scroll)); }catch(e){}
  }
  document.addEventListener('click', function(ev){
    const mapBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-map-location]') : null;
    if(mapBtn){
      ev.preventDefault();
      ev.stopPropagation();
      const mapName = mapBtn.dataset.collectMapLocation || '';
      const query = mapBtn.dataset.collectMapQuery || '';
      saveCollectScroll(state.active);
      (async () => {
        if(typeof showPageLoading === 'function') showPageLoading('地圖查詢', '正在載入地圖位置，請稍候。');
        if(typeof window.ensureMapPageLoaded === 'function') await window.ensureMapPageLoaded();
        if(typeof window.openMapSearchLocation === 'function') await window.openMapSearchLocation(mapName, query);
        try{ document.querySelectorAll('.navBtn[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'map')); }catch(e){}
        try{ document.querySelectorAll('.formBox').forEach(form => form.classList.remove('active')); }catch(e){}
        try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
        try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){}
      })();
      return;
    }
    const shopMapBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-shop-location]') : null;
    if(shopMapBtn){
      ev.preventDefault();
      ev.stopPropagation();
      const shopName = shopMapBtn.dataset.collectShopLocation || '';
      saveCollectScroll(state.active);
      (async () => {
        if(typeof showPageLoading === 'function') showPageLoading('地圖查詢', '正在載入商店位置，請稍候。');
        if(typeof window.ensureMapPageLoaded === 'function') await window.ensureMapPageLoaded();
        if(typeof window.openShopMapByLabel === 'function') await window.openShopMapByLabel(shopName);
        try{ document.querySelectorAll('.navBtn[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'map')); }catch(e){}
        try{ document.querySelectorAll('.formBox').forEach(form => form.classList.remove('active')); }catch(e){}
        try{ if(typeof closeDrawer === 'function') closeDrawer(); }catch(e){}
        try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){}
      })();
      return;
    }
    const reverseBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-reverse]') : null;
    if(reverseBtn){
      ev.preventDefault();
      ev.stopPropagation();
      state.returnScroll = window.scrollY || document.documentElement.scrollTop || 0;
      saveCollectScroll(state.active);
      renderCollectDropDetail(reverseBtn.dataset.collectReverse);
      return;
    }
    const clearBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-clear]') : null;
    if(clearBtn){
      ev.preventDefault();
      ev.stopPropagation();
      clearCollectBookSearch(state.active);
      renderLoaded(state.active);
      return;
    }
    const topBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-top]') : null;
    if(topBtn){
      ev.preventDefault();
      ev.stopPropagation();
      state.scroll[state.active] = 0;
      try{ localStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(state.scroll)); }catch(e){}
      try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){}
      return;
    }
    const nestedReverseBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-nested-reverse]') : null;
    if(nestedReverseBtn){
      ev.preventDefault();
      ev.stopPropagation();
      const id = nestedReverseBtn.dataset.collectNestedReverse;
      const parent = nestedReverseBtn.dataset.collectParent;
      if(id){
        const openNestedReverse = () => {
          if(typeof window.showReverse === 'function'){
            window.showReverse(id,'collect','collect:'+parent);
          }
        };
        if(typeof window.showReverse === 'function'){
          openNestedReverse();
        }else if(typeof window.ensureItemPageLoaded === 'function'){
          window.ensureItemPageLoaded().then(openNestedReverse);
        }
      }
      return;
    }
    const backBtn = ev.target && ev.target.closest ? ev.target.closest('[data-collect-back]') : null;
    if(backBtn){
      ev.preventDefault();
      ev.stopPropagation();
      renderLoaded(state.active);
      requestAnimationFrame(() => {
        try{ window.scrollTo({top: state.returnScroll || 0, behavior: 'auto'}); }catch(e){}
      });
    }
  }, true);
  document.addEventListener('input', function(ev){
    if(ev.target && ev.target.id === 'collectSearch'){
      if(state.composing || ev.isComposing) return;
      state.query[state.active] = ev.target.value || '';
      writeCollectFilterState();
      renderCollectResults();
    }
  }, true);
  document.addEventListener('compositionstart', function(ev){
    if(ev.target && ev.target.id === 'collectSearch') state.composing = true;
  }, true);
  document.addEventListener('compositionend', function(ev){
    if(ev.target && ev.target.id === 'collectSearch'){
      state.composing = false;
      state.query[state.active] = ev.target.value || '';
      writeCollectFilterState();
      renderCollectResults();
    }
  }, true);
  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.id === 'collectCategory'){
      state.category[state.active] = ev.target.value || 'all';
      state.segment[state.active] = 'all';
      writeCollectFilterState();
      renderLoaded(state.active);
    }
    if(ev.target && ev.target.id === 'collectSegment'){
      state.segment[state.active] = ev.target.value || 'all';
      writeCollectFilterState();
      renderLoaded(state.active);
    }
    if(ev.target && ev.target.matches && ev.target.matches('[data-collect-source]')){
      const filter = state.sourceFilter[state.active];
      if(filter){
        filter[ev.target.dataset.collectSource] = !!ev.target.checked;
        writeCollectFilterState();
        renderLoaded(state.active);
      }
    }
  }, true);
  window.addEventListener('pagehide', () => saveCollectScroll(state.active));
  window.renderCollectBookPage = renderCollectBookPage;
  window.renderCollectDropDetail = renderCollectDropDetail;
  window.clearCollectBookSearch = clearCollectBookSearch;
})();
