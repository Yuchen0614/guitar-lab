# 吉他實驗室 Guitar Lab

從聽懂一首歌，到彈出自己的 Solo——全部在你的瀏覽器完成，**音檔不上傳、無後端、無帳號**。

**線上使用：https://yuchen0614.github.io/guitar-lab/**

## 功能模組（全部上線）

| 模組 | 說明 |
|---|---|
| 🔍 和弦分析 | 上傳音訊或貼 YouTube 連結（cobalt 公共實例）→ chroma 特徵 → 可選演算法（樣板比對 / Viterbi 平滑）→ 和弦時間軸 + 調性估計 |
| 🧩 段落與歌詞 | 自相似矩陣 + Foote novelty 切分段落（A/B/C 結構標記、SSM 熱圖）；歌詞押韻分析（十三轍韻基比對、44,401 字讀音表、韻式字母著色） |
| 🎼 Solo 譜生成 | 選調性、和弦進行與難度，沿和弦內音生成可彈奏 Solo——ASCII 六線譜 + alphaTab 標準譜 + 試聽 + TXT/alphaTex 匯出，seed 可重現 |
| 🎨 和弦圖工坊 | 點選琴格設計指法、即時命名、試聽、匯出 SVG/PNG，內建上百種指型 |
| 📖 樂理教室 | 互動課程：音程、音階、順階和弦、常用進行，互動指板對照 |
| 🥁 節奏・音感 | 節拍器、音程聽辨、和弦反應測驗，練習成果 localStorage 記錄 |

## 技術

- 純靜態網站（HTML/CSS/原生 JS），零框架、零建置步驟，全部客戶端運算
- 音訊分析：Web Audio API 本機解碼 + 自實作 FFT/PCP chroma（低音加權抑制諧波）
- 和弦辨識：24 大小三和弦樣板比對、Viterbi 動態規劃平滑（五度圈鄰居轉移）
- 段落切分：chroma 自相似矩陣 + Foote 棋盤核 novelty + 區塊相似度凝聚標記（方法同 FormFinder / SSMNet）
- Solo 生成：和弦音骨架 + 音階填充 + 把位連續性求解（方法參考 AutoLeadGuitar, McVicar et al. 2014），mulberry32 可重現 seed
- 譜面渲染：[alphaTab](https://alphatab.net)（MPL-2.0，CDN 懶載入、離線時 ASCII 譜仍可用）
- 和弦圖：自製 SVG 引擎（受 [SVGuitar](https://github.com/omnibrain/svguitar) 啟發）
- 中文押韻：自建韻基表——[mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data)（CC BY 4.0）+ Jun Da 頻率表 + [OpenCC](https://github.com/BYVoid/OpenCC) STCharacters 簡繁對映，腳本 `scripts/build-rhyme-data.py` 可重產
- YouTube 匯入：cobalt 相容 API（可自訂實例位址）

## 開發里程碑（全部完成 ✅）

- **M0** ✅ 網站骨架、設計系統、路由、部署管線
- **M1** ✅ 和弦圖引擎 + 點選編輯器
- **M2** ✅ 樂理教室 + 節奏/音感訓練
- **M3** ✅ 歌曲和弦分析引擎（含 YouTube 匯入）
- **M4** ✅ 段落切分 + 歌詞押韻分析
- **M5** ✅ Solo 六線譜生成器
- **M6** ✅ 全站驗收（六頁迴歸、無障礙、資源 388KB）

## 測試

```bash
node scripts/test-structure.js   # 段落引擎：合成 ABA 音訊 → 邊界/字母驗證（exit 0 = PASS）
python scripts/build-rhyme-data.py  # 重產押韻資料檔
```

## 授權

MIT License
