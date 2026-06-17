// V242 script loader: load manifest files in order, then start the app.
(function(){
  if(/^#reverse-\d+$/i.test(location.hash || '')){
    try{ history.replaceState(history.state, '', location.pathname + location.search); }catch(e){}
  }
  window.SZO_READY = false;
  const list = window.SZO_SCRIPT_MANIFEST || [];
  const version = document.body?.dataset?.version || 'dev';
  const status = () => document.getElementById('topStatus');

  function setStatus(msg){
    const el = status();
    if(el) el.textContent = msg;
  }

  function withVersion(src){
    if(/^https?:\/\//i.test(src)) return src;
    const join = src.includes('?') ? '&' : '?';
    return `${src}${join}v=${encodeURIComponent(version)}`;
  }

  function loadOne(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = withVersion(src);
      s.async = false;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error('Script load failed: ' + src));
      document.body.appendChild(s);
    });
  }

  (async function(){
    try{
      for(let i = 0; i < list.length; i++){
        setStatus('載入模組 ' + (i + 1) + '/' + list.length);
        await loadOne(list[i]);
      }
      if(typeof window.SZOAppInit === 'function') await window.SZOAppInit();
      window.SZO_READY = true;
      document.documentElement.classList.add('szo-ready');
      window.dispatchEvent(new CustomEvent('szo:ready'));
      setStatus('已準備');
    }catch(err){
      console.error(err);
      setStatus('模組載入失敗');
      const reader = document.getElementById('reader');
      if(reader) reader.innerHTML = '<div class="card"><h2>模組載入失敗</h2><p>' + String(err.message || err) + '</p></div>';
    }
  })();
})();
