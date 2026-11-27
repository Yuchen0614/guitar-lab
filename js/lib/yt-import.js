/* 吉他實驗室 — YouTube 匯入共用模組（m15）
   背景：cobalt v11 起公共實例全面要求 Turnstile（瀏覽器人機驗證）或 Api-Key。
   本站（github.io 域）無法通過實例的 Turnstile 域名白名單，因此：
   - 支援 Api-Key 認證（Authorization: Api-Key xxx）——使用者在實例主取得 key 後填入即可
   - 自動輪詢多個候選實例，回傳第一個可用的
   - 錯誤分類：明確告訴使用者「缺 key」還是「影片需登入」還是「實例全掛」
   音訊下載後一樣只在本機解碼分析，不上傳任何伺服器。 */
(function () {
  'use strict';

  var YT = {};

  /* 候選實例清單（2026-11 驗證：全部啟用 turnstile 或 api-key auth；
     無驗證實例已絕跡——若使用者自架，直接填自己的 endpoint 即可） */
  YT.INSTANCES = [
    'https://yuuri-c.meowing.de',
    'https://eulogy-c.meowing.de',
    'https://nuko-c.meowing.de',
    'https://bergung-api.hoffnungfuerdiezukunft.net',
    'https://apicobalt.girlskissing.top',
    'https://melon.clxxped.lol'
  ];

  var SET_KEY = GL.store.bind('yt_settings', {
    endpoint: '',        // 自訂 endpoint（自架實例）
    apiKey: '',          // Api-Key（自架或向實例主申請）
    lastWorking: ''      // 最近成功的實例（優先用）
  });

  YT.settings = SET_KEY;

  /* 網址 → 影片 ID（支援 watch/shorts/embed/youtu.be） */
  YT.videoId = function (url) {
    var m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  };

  /* 錯誤碼 → 使用者友善訊息 + 修復建議 */
  function classifyError(code) {
    if (/auth\.key\.invalid/.test(code)) {
      return { kind: 'key-invalid', title: 'Api-Key 無效',
        msg: '實例回報這把 key 不正確。請到實例設定頁重新確認（設定裡可修改）。' };
    }
    if (/auth\.jwt|auth\.turnstile/.test(code)) {
      return { kind: 'need-auth', title: '此實例需要認證',
        msg: '公共 cobalt 實例現在全面要求人機驗證或 Api-Key，本站域名無法代你通過驗證。解法：自架 cobalt 實例（docker 一行），或向實例主申請 Api-Key，再填進「進階設定」。' };
    }
    if (/youtube\.login/.test(code)) {
      return { kind: 'video-login', title: '影片需要登入',
        msg: '這部影片有年齡/地區限制或需要登入，下載服務抓不到。請改用「上傳檔案」（把音檔拖進來）。' };
    }
    if (/youtube/.test(code)) {
      return { kind: 'video-issue', title: 'YouTube 端錯誤',
        msg: '下載服務無法處理這部影片（' + code + '）。可能是私人影片、直播存檔或地區限制。' };
    }
    if (/ratelimit|rate_limit/.test(code)) {
      return { kind: 'rate-limit', title: '實例流量上限',
        msg: '這個實例暫時達到請求上限，請等一下再試，或換一個實例位址。' };
    }
    return { kind: 'unknown', title: '匯入失敗',
      msg: '錯誤碼：' + code + '。可換實例位址再試，或改用上傳檔案。' };
  }

  /* 對單一實例請求音訊 tunnel
     回傳 { ok: true, url } 或 { ok: false, code, classified }
     用 XMLHttpRequest 的內建 timeout（不依賴 JS 定時器，各種環境都會準時觸發） */
  function requestInstance(endpoint, apiKey, videoUrl, timeoutMs) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint + '/', true);
      xhr.timeout = timeoutMs || 20000;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');
      if (apiKey) xhr.setRequestHeader('Authorization', 'Api-Key ' + apiKey);
      xhr.onload = function () {
        var j = null;
        try { j = JSON.parse(xhr.responseText); } catch (e) { /* non-json */ }
        if (j && (j.status === 'stream' || j.status === 'redirect' || j.status === 'tunnel')) {
          resolve({ ok: true, url: j.url });
          return;
        }
        var code = (j && j.error && j.error.code) || 'http-' + xhr.status;
        resolve({ ok: false, code: code, classified: classifyError(code) });
      };
      xhr.onerror = function () {
        resolve({ ok: false, code: 'network', classified: { kind: 'network', title: '連線失敗', msg: '無法連上 ' + endpoint } });
      };
      xhr.ontimeout = function () {
        resolve({ ok: false, code: 'timeout', classified: { kind: 'timeout', title: '實例逾時', msg: endpoint + ' 在 20 秒內沒有回應' } });
      };
      xhr.send(JSON.stringify({
        url: videoUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3',
        filenameStyle: 'basic'
      }));
    });
  }

  /* 主流程：影片網址 → （依序嘗試）自訂實例→最近成功→候選清單 → 音訊 tunnel URL
     onStatus(text) 回報進度文字 */
  YT.getTunnel = function (videoUrl, onStatus) {
    onStatus = onStatus || function () {};
    var apiKey = SET_KEY.data.apiKey || '';
    var endpoints = [];
    if (SET_KEY.data.endpoint) endpoints.push(SET_KEY.data.endpoint);
    if (SET_KEY.data.lastWorking && endpoints.indexOf(SET_KEY.data.lastWorking) < 0) {
      endpoints.push(SET_KEY.data.lastWorking);
    }
    YT.INSTANCES.forEach(function (e) {
      if (endpoints.indexOf(e) < 0) endpoints.push(e);
    });

    var idx = 0;
    function tryNext() {
      if (idx >= endpoints.length) {
        return Promise.resolve({
          ok: false,
          code: 'all-instances-failed',
          classified: { kind: 'all-failed', title: '所有實例都無法使用',
            msg: '試過 ' + endpoints.length + ' 個實例都失敗。目前公共 cobalt 實例全面要求認證（人機驗證或 Api-Key）。' +
              (apiKey ? '你已填 Api-Key——請確認 key 是否有效、實例是否支援 Api-Key 認證。' : '最快解法：自架實例（docker 一行指令）或取得 Api-Key 後填入「進階設定」。') + ' 或改用上傳檔案。' }
        });
      }
      var ep = endpoints[idx++];
      onStatus('嘗試實例 ' + idx + '/' + endpoints.length + '…');
      return requestInstance(ep, apiKey, videoUrl, 20000).then(function (r) {
        if (r.ok) {
          SET_KEY.data.lastWorking = ep;
          SET_KEY.save();
          return r;
        }
        // key-invalid / video-login 是「終局錯誤」：換實例也沒用，直接回報
        if (r.classified.kind === 'key-invalid' || r.classified.kind === 'video-login') return r;
        return tryNext();
      });
    }
    return tryNext();
  };

  /* tunnel URL → ArrayBuffer（帶進度回呼） */
  YT.downloadAudio = function (tunnelUrl, onStatus) {
    onStatus = onStatus || function () {};
    onStatus('下載音訊中…');
    return fetch(tunnelUrl).then(function (resp) {
      if (!resp.ok) throw new Error('下載失敗（HTTP ' + resp.status + '）');
      // 讀取 content-length 顯示進度（若有）
      var total = +(resp.headers.get('content-length') || 0);
      if (!resp.body || !total) return resp.arrayBuffer();
      var reader = resp.body.getReader();
      var chunks = [], received = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            var parts = chunks.map(function (c) { return c; });
            var buf = new Uint8Array(received);
            var off = 0;
            parts.forEach(function (c) { buf.set(c, off); off += c.length; });
            return buf.buffer;
          }
          chunks.push(r.value);
          received += r.value.length;
          onStatus('下載音訊中… ' + Math.round(received / total * 100) + '%');
          return pump();
        });
      }
      return pump();
    });
  };

  window.GLyoutube = YT;
})();
