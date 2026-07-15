// V242: data loading and parsing helpers.
function candidateUrls(name){
  const raw = String(name || '');
  const encoded = encodeURIComponent(raw).replace(/%2F/g, '/');
  const urls = ['./' + raw];
  if(encoded !== raw) urls.push('./' + encoded);
  return [...new Set(urls)];
}

async function fetchTimeout(url, ms = 30000){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try{
    return await fetch(url, { signal: ctrl.signal });
  }finally{
    clearTimeout(timer);
  }
}

async function fetchFirst(names, label){
  const tried = [];
  for(const name of names){
    for(const url of candidateUrls(name)){
      try{
        loadLine(`讀取 ${esc(name)} ...`);
        const res = await fetchTimeout(url);
        tried.push(`${url} HTTP ${res.status}`);
        if(!res.ok) continue;

        const buf = await res.arrayBuffer();
        let text = '';
        try{ text = new TextDecoder('big5').decode(buf); }catch(e){}
        if(!text || text.includes('�')){
          try{ text = new TextDecoder('utf-8').decode(buf); }catch(e){}
        }
        if(text && text.trim()){
          loadLine(`已讀取 ${esc(name)} (${Math.round(buf.byteLength / 1024)} KB)`, 'ok');
          return { name, text, tried };
        }
      }catch(e){
        tried.push(`${url} ${e && e.name === 'AbortError' ? 'timeout' : (e && e.message || e)}`);
      }
    }
  }
  loadLine(`${esc(label)} 資料讀取失敗`, 'bad');
  return { missing: true, tried };
}

function parseIni(text){
  const data = [];
  let cur = null;
  function push(){
    if(cur && Object.keys(cur).length) data.push(cur);
    cur = null;
  }
  for(const raw of String(text || '').replace(/^\ufeff/, '').split(/\r?\n/)){
    const line = String(raw || '').trim();
    if(!line || line.startsWith('//') || line.startsWith(';')) continue;
    if(line.startsWith('[') && line.endsWith(']')){
      push();
      cur = {};
      continue;
    }
    const p = line.indexOf('=');
    if(p < 0) continue;
    const k = line.slice(0, p).trim();
    const v = line.slice(p + 1).trim();
    if(/^ID$/i.test(k) && cur && (cur.ID !== undefined || cur.Id !== undefined || cur.id !== undefined)) push();
    if(!cur) cur = {};
    cur[k] = v;
  }
  push();
  return data.filter(x => x && (x.ID !== undefined || x.Name !== undefined));
}

function parseCSVLine(line){
  const out = [];
  let val = '';
  let q = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    const n = line[i + 1];
    if(q){
      if(c === '"' && n === '"'){
        val += '"';
        i++;
      }else if(c === '"') q = false;
      else val += c;
    }else{
      if(c === '"') q = true;
      else if(c === ','){
        out.push(val);
        val = '';
      }else val += c;
    }
  }
  out.push(val);
  return out.map(x => String(x || '').trim());
}

function parseLocations(text){
  const map = {};
  const sep = '\u3001';
  const nameCol = '\u602a\u7269\u540d\u7a31';
  const mapCol = '\u5730\u5716\u540d\u7a31';
  const idCol = '\u602a\u7269ID';
  const floorCol = '\u7d42\u672b\u6a13\u5c64';
  function formatLocation(loc, floor){
    const tower = '\u7d42\u672b\u4e4b\u5854';
    const romanSuffix = '\u2160\u2161\u2162\u2163\u2164\u2165\u2166\u2167\u2168\u2169';
    loc = String(loc || '').trim().replace(/[\u300c\u300d]/g, '');
    floor = String(floor || '').trim().replace(/[\u300c\u300d]/g, '');
    if(loc.startsWith(tower)) loc = tower;
    else loc = loc.replace(new RegExp(`[${romanSuffix}]+$`), '');
    if(!floor) return loc;
    const floors = floor.split(sep).map(x => x.trim()).filter(Boolean);
    if(!floors.length) return loc;
    return floors.map(part => `${loc}${part.startsWith('\u7b2c') ? part : '\u7b2c' + part}`).join(sep);
  }

  function addLocation(name, loc){
    name = String(name || '').trim();
    loc = String(loc || '').trim();
    if(!name || !loc) return;
    const existing = (map[name] || '').split(sep).map(x => x.trim()).filter(Boolean);
    if(existing.includes(loc)) return;
    existing.push(loc);
    map[name] = existing.join(sep);
  }
  const lines = String(text || '').replace(/^\ufeff/, '').split(/\r?\n/).filter(raw => raw.trim() && !raw.trim().startsWith('//'));
  if(!lines.length) return map;
  const first = lines[0].includes(',') ? parseCSVLine(lines[0]) : lines[0].split(/\t+/).map(x => x.trim());
  const headerMap = {};
  first.forEach((name, idx) => { headerMap[String(name || '').trim()] = idx; });
  if(headerMap[nameCol] !== undefined && headerMap[mapCol] !== undefined){
    for(const raw of lines.slice(1)){
      const p = raw.includes(',') ? parseCSVLine(raw) : raw.split(/\t+/).map(x => x.trim());
      const get = key => p[headerMap[key]] || '';
      if(get('StageID') === '347' && get(idCol) === '17986' && get('Pic') === '5678') continue;
      addLocation(get(nameCol), formatLocation(get(mapCol), get(floorCol)));
    }
    return map;
  }
  for(const raw of lines){
    let p = raw.includes(',') ? parseCSVLine(raw) : raw.split(/\t+/).map(x => x.trim());
    p = p.filter(Boolean);
    if(p.length < 2) continue;
    const name = p[0];
    if(!name || name === nameCol || name.toLowerCase() === 'name') continue;
    addLocation(name, formatLocation(p.slice(1).join(sep)));
  }
  return map;
}
