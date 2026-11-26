# 吉他實驗室 Guitar Lab

從聽懂一首歌，到彈出自己的 Solo——全部在你的瀏覽器完成，**音檔不上傳、無後端、無帳號**。

**線上使用：https://yuchen0614.github.io/guitar-lab/**

## 功能模組

| 模組 | 說明 | 狀態 |
|---|---|---|
| 🔍 和弦分析 | 上傳音訊 → chroma 特徵 → 可選演算法（樣板比對 / Viterbi 平滑）→ 和弦時間軸 | 開發中 |
| 🧩 段落與歌詞 | 自相似矩陣切分段落（A/B/C），中文拼音押韻分析 | 開發中 |
| 🎼 Solo 譜生成 | 選調性與進行，生成可彈奏 Solo 六線譜（alphaTab 渲染 + 試聽） | 開發中 |
| 🎨 和弦圖工坊 | 點選琴格設計指法、即時命名、匯出 SVG/PNG | 開發中 |
| 📖 樂理教室 | 互動課程：音程、音階、順階和弦、常用進行 | 開發中 |
| 🥁 節奏・音感 | 節拍器、音程聽辨、和弦測驗、進度記錄 | 開發中 |

## 技術

- 純靜態網站（HTML/CSS/原生 JS），零框架、零建置步驟
- 音訊分析：Web Audio API 本機解碼 + 自實作 PCP/NNLS chroma
- 和弦辨識：24 大小三和弦樣板比對、Viterbi 動態規劃平滑
- 段落切分：chroma 自相似矩陣 + Foote novelty
- 譜面渲染：[alphaTab](https://alphatab.net)（MPL-2.0）
- 和弦圖：自製 SVG 引擎（受 [SVGuitar](https://github.com/omnibrain/svguitar) 啟發）
- 中文押韻：[pinyin-pro](https://github.com/zh-lx/pinyin-pro) 韻母比對

## 開發里程碑

- **M0** ✅ 網站骨架、設計系統、路由、部署管線
- **M1** 和弦圖引擎 + 點選編輯器
- **M2** 樂理教室 + 節奏/音感訓練
- **M3** 歌曲和弦分析引擎（核心）
- **M4** 段落切分 + 歌詞押韻分析
- **M5** Solo 六線譜生成器
- **M6** 全站驗收

## 授權

MIT License
