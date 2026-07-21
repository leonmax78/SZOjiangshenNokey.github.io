// V212 shell: 只負責產生網站外框 DOM。
(function(){
  const root = document.getElementById('appRoot') || document.body;
  root.innerHTML = `<div id="mainShell">
<header class="topbar"><div class="topline">
  <button class="menuBtn" id="openMenuBtn">☰</button>
  <div class="brand"><div class="brandTitle" id="siteTitle">神州-四海同舟</div></div>
  <div class="maker" id="siteMaker" aria-hidden="true"></div>
  <button class="shellSettingsBtn" id="openUiSettingsBtn" type="button">網頁外觀</button>
  <div class="status" id="topStatus">準備中</div>
</div></header>
<div class="backdrop" id="backdrop"></div>
<div class="app">
<aside class="drawer" id="drawer">
  <div class="drawerHead"><div><div class="drawerTitle">功能選單</div><div class="muted" style="font-size:12px">選好後回到閱讀頁</div></div><button class="ghost closeOnly" id="closeMenuBtn">✕</button></div>
  <div class="drawerBody">
    <div class="navGroup" id="navGroup">
      <button class="navBtn major active" data-view="home">首頁 <span>›</span></button>
      <button class="navBtn major" data-view="jiang">降神、經驗、修練試算 <span>›</span></button>
      <div class="formBox" id="jiangForm">
        <button class="navBtn sub" data-jiang="support">副降神模擬 <span>›</span></button>
        <button class="navBtn sub" data-jiang="compare">主降神比較 <span>›</span></button>
        <button class="navBtn sub" data-jiang="stars">20星等 <span>›</span></button>
        <button class="navBtn sub" data-jiang="starAura">星等 / 靈氣 <span>›</span></button>
        <button class="navBtn sub" data-jiang="expPill">等級 / 經驗丹 <span>›</span></button>
        <button class="navBtn sub" data-jiang="training">修練機制 <span>›</span></button>
        <div id="jiangFields"></div>
      </div>
      <button class="navBtn major" data-view="monster">怪物查詢 <span>›</span></button>
      <button class="navBtn major" data-view="item">道具查詢 <span>›</span></button>
      <div class="formBox" id="itemForm">
        <div class="subMenuNote">道具相關功能</div>
        <button class="navBtn sub" data-item-open="item">道具查詢 <span>›</span></button>
        <button class="navBtn sub" data-item-open="reverse">掉落反查 <span>›</span></button>
        <button class="navBtn sub" data-item-open="compound">常用裝備配方合成模擬 <span>›</span></button>
      </div>
      <button class="navBtn major" data-view="map">地圖查詢 <span>›</span></button>
      <button class="navBtn major" data-view="soul">武魂能力試算 <span>›</span></button>
      <button class="navBtn major" data-view="collect">武冠收錄資料 <span>›</span></button>
      <div class="formBox" id="collectForm">
        <div class="subMenuNote">武冠收錄資料</div>
        <button class="navBtn sub" data-collect-open="bonus">武冠鋒雲錄能力值 <span>›</span></button>
        <button class="navBtn sub" data-collect-open="weapon">武防出處 <span>›</span></button>
        <button class="navBtn sub" data-collect-open="artifact">法器出處 <span>›</span></button>
        <button class="navBtn sub" data-collect-open="recipe">配方出處 <span>›</span></button>
        <button class="navBtn sub" data-collect-open="beast">封獸出處 <span>›</span></button>
      </div>
      <button class="navBtn major" data-view="shop">商店販賣資訊 <span>›</span></button>
      <button class="navBtn major" data-view="downloads">工具下載區 <span>›</span></button>
    </div>
    <div class="navGroup" id="manualGroup" style="display:none">
      <div class="navTitle">備用手動載入</div>
      <div class="muted" style="font-size:12px">自動讀取失敗時才需要。</div>
      <input type="file" id="manualFiles" multiple accept=".ini,.csv,.txt">
    </div>
    <div class="siteSupportTools" aria-label="站務連結">
      <button class="siteSupportBtn" id="openSupportBtn" type="button">贊助本站</button>
      <button class="siteSupportBtn" id="openContactBtn" type="button">聯絡站長</button>
    </div>
    <div class="visitorCounter" aria-label="網頁瀏覽人數">
      <div class="visitorCounterTitle">網頁瀏覽人數</div>
      <span class="visitorCounterBadgeBox">
        <img class="visitorCounterBadge" src="https://visitor-badge.laobi.icu/badge?page_id=leonmax78.test&left_text=%E2%80%8B&left_color=%23040605&right_color=%23040605&height=34&radius=999" alt="網頁瀏覽人數" loading="lazy">
      </span>
    </div>
  </div>
</aside>
<main class="content"><div class="reader" id="reader"></div></main>
</div>
</div>
<div class="authModal" id="licenseModal"><div class="authBox"><h2>授權驗證</h2><div class="muted">請貼上授權鑰匙。</div><textarea id="licenseInput"></textarea><div class="error" id="licenseError"></div><button class="primary" id="licenseSubmit">驗證授權</button></div></div>
<div class="siteModal" id="siteInfoModal" aria-hidden="true">
  <div class="siteModalBackdrop" data-site-modal-close></div>
  <section class="siteModalBox" role="dialog" aria-modal="true" aria-labelledby="siteInfoTitle">
    <button class="siteModalClose" type="button" data-site-modal-close>✕</button>
    <div class="siteModalEyebrow" id="siteInfoEyebrow">站務資訊</div>
    <h2 id="siteInfoTitle">贊助本站</h2>
    <div id="siteInfoBody"></div>
  </section>
</div>
<button id="collectFloatingTopBtn" class="collectTopBtn globalTopBtn" type="button" data-global-top data-collect-top hidden>↑ 回到頂部</button>
`;

  window.SZO_SET_GLOBAL_TOP_VISIBLE = function(visible){
    const btn = document.getElementById('collectFloatingTopBtn');
    if(btn) btn.hidden = !visible;
  };

  document.addEventListener('click', function(ev){
    const hit = ev.target && ev.target.closest ? ev.target.closest('[data-global-top]') : null;
    if(!hit) return;
    ev.preventDefault();
    ev.stopPropagation();
    try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){ window.scrollTo(0, 0); }
  }, true);

  // V213：快速選單保險事件。
  // 這裡在 shell 生成 DOM 後立刻綁定一次，避免後續模組載入失敗或 init 時機改變時，左上角 ☰ 沒反應。
  function bindShellMenu(){
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('backdrop');
    const openBtn = document.getElementById('openMenuBtn');
    const closeBtn = document.getElementById('closeMenuBtn');
    const open = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      if(drawer) drawer.classList.add('open');
      if(backdrop) backdrop.classList.add('open');
    };
    const close = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      if(drawer) drawer.classList.remove('open');
      if(backdrop) backdrop.classList.remove('open');
    };
    if(openBtn) openBtn.addEventListener('click', open, true);
    if(closeBtn) closeBtn.addEventListener('click', close, true);
    if(backdrop) backdrop.addEventListener('click', close, true);
    window.SZO_OPEN_MENU = open;
    window.SZO_CLOSE_MENU = close;
  }
  bindShellMenu();

  function bindSiteInfoTools(){
    const modal = document.getElementById('siteInfoModal');
    const title = document.getElementById('siteInfoTitle');
    const eyebrow = document.getElementById('siteInfoEyebrow');
    const body = document.getElementById('siteInfoBody');
    if(!modal || !title || !body) return;

    const paypalUrl = 'https://paypal.me/leonmax78';
    const issueUrl = 'https://github.com/leonmax78/SZOjiangshenNokey.github.io/issues';
    const discordName = 'leonmax78';
    const gmail = 'leonmax78@gmail.com';
    const jkopayImage = 'assets/donation-jkopay.jpg';
    const jkopayCode = '396';
    const jkopayAccount = '901616056';
    const ipassBankCode = '391';
    const ipassAccount = '0000001517184496';
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
    const open = (kind) => {
      if(kind === 'contact'){
        if(eyebrow) eyebrow.textContent = '聯絡站長';
        title.textContent = '聯絡站長';
        body.innerHTML = `
          <p>資料錯誤、功能建議、更新問題，可以用 GitHub Issues 留紀錄，也可以透過 Discord 或 Gmail 聯絡站長。</p>
          <div class="siteInfoList">
            <div><span>問題回報</span><strong>GitHub Issues</strong></div>
            <div><span>Discord</span><strong>${escapeHtml(discordName)}</strong></div>
            <div><span>Gmail</span><strong>${escapeHtml(gmail)}</strong></div>
          </div>
          <div class="siteModalActions">
            <a class="siteActionLink primaryLike" href="${issueUrl}" target="_blank" rel="noopener">開啟問題回報</a>
            <button class="primary" type="button" data-copy-text="${escapeHtml(discordName)}">複製 Discord</button>
            <a class="siteActionLink" href="mailto:${escapeHtml(gmail)}">寄信給站長</a>
          </div>
        `;
      }else{
        if(eyebrow) eyebrow.textContent = '贊助本站';
        title.textContent = '贊助本站';
        body.innerHTML = `
          <p>如果這個工具對你有幫助，可以自由贊助本站維護。贊助完全自願，不影響任何功能使用，感謝支持。</p>
          <div class="donationGrid">
            <div class="donationPanel">
              <div class="donationLabel">PayPal</div>
              <div class="donationTitle">線上贊助</div>
              <a class="siteActionLink primaryLike" href="${paypalUrl}" target="_blank" rel="noopener">前往 PayPal</a>
            </div>
            <div class="donationPanel donationQrPanel">
              <div class="donationLabel">街口支付</div>
              <img class="donationQr" src="${jkopayImage}" alt="街口支付收款 QR Code" loading="lazy">
              <div class="donationCodeList">
                <div><span>街口代碼</span><strong>${escapeHtml(jkopayCode)}</strong></div>
                <div><span>街口帳號</span><strong>${escapeHtml(jkopayAccount)}</strong></div>
              </div>
            </div>
            <div class="donationPanel">
              <div class="donationLabel">iPASS MONEY</div>
              <div class="donationTitle">手動轉帳資訊</div>
              <div class="donationCodeList">
                <div><span>電支機構代號</span><strong>${escapeHtml(ipassBankCode)}</strong></div>
                <div><span>iPASS MONEY</span><strong>${escapeHtml(ipassAccount)}</strong></div>
              </div>
            </div>
          </div>
          <div class="siteModalActions">
            <button class="primary" type="button" data-copy-text="${escapeHtml(jkopayAccount)}">複製街口帳號</button>
            <button class="primary" type="button" data-copy-text="${escapeHtml(ipassAccount)}">複製 iPASS MONEY</button>
          </div>
          <div class="siteInfoHint">街口這張收款碼可先當作固定收款用。若有人反應掃碼失敗，可用街口代碼與街口帳號手動輸入。</div>
        `;
      }
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    };

    document.getElementById('openSupportBtn')?.addEventListener('click', (ev) => { ev.preventDefault(); open('support'); });
    document.getElementById('openContactBtn')?.addEventListener('click', (ev) => { ev.preventDefault(); open('contact'); });
    modal.addEventListener('click', async (ev) => {
      const closeHit = ev.target && ev.target.closest && ev.target.closest('[data-site-modal-close]');
      if(closeHit){ close(); return; }
      const copyBtn = ev.target && ev.target.closest && ev.target.closest('[data-copy-text]');
      if(!copyBtn) return;
      const text = copyBtn.getAttribute('data-copy-text') || '';
      try{
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '已複製';
      }catch(err){
        copyBtn.textContent = text;
      }
    });
    document.addEventListener('keydown', (ev) => {
      if(ev.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }
  bindSiteInfoTools();

  // V221：模組尚未載入完成時，先擋住功能選單點擊。
  // 避免使用者第一次太快點「副降神模擬」時，先跑到舊版頁面，後面初始化又跳回首頁。
  document.addEventListener('click', function(ev){
    const hit = ev.target && ev.target.closest && ev.target.closest('[data-view],[data-jiang],[data-item-open]');
    if(!hit) return;
    if(window.SZO_READY) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const st = document.getElementById('topStatus');
    if(st) st.textContent = '模組載入中，請稍候再點一次';
  }, true);

  // V365：手機瀏覽器可能把已開啟的 SPA 分頁放回前景，卻保留舊資料陣列。
  // 回到分頁時檢查 build_meta；若線上資料較新，重新整理一次拿最新 bundle。
  (function bindDataFreshnessGuard(){
    const currentBuild = document.body?.dataset?.buildAt || '';
    if(!currentBuild || !window.fetch) return;
    let checking = false;
    let lastCheck = 0;
    async function checkFreshData(){
      const now = Date.now();
      if(checking || now - lastCheck < 15000) return;
      checking = true;
      lastCheck = now;
      try{
        const res = await fetch('data/build_meta.json?fresh=' + now, { cache: 'no-store' });
        if(!res.ok) return;
        const meta = await res.json();
        const remoteBuild = String(meta && meta.built_at || '');
        if(!remoteBuild || remoteBuild === currentBuild) return;
        const reloadKey = 'szo_reloaded_build_' + remoteBuild;
        if(sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
      }catch(err){
        // Ignore network failures; normal navigation still works.
      }finally{
        checking = false;
      }
    }
    window.addEventListener('focus', checkFreshData);
    window.addEventListener('pageshow', checkFreshData);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') checkFreshData();
    });
  })();

})();
