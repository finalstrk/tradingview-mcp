# Research: Asia-Range Breakout at London Open
**Topic ID**: session_063
**Family**: session
**Date**: 2026-07-17
**Question**: Asia-range breakout at London open: measured statistics

---

結論：直接該当するGrade A証拠は見つからない。最良でも「USD/JPYでは弱い正のエッジ」、EUR/USD・NAS100では概ね否定的である。

1. **USD/JPY Asian-range breakout（YuRa）** — USD/JPY、Dukascopy tick、シグナル足は非開示。01:00–04:00 UTCの高安を測定し、終値が上抜け／下抜け後、次足始値で同方向へ進入。損切りはレンジ反対端、固定午後時刻で手仕舞い、1日1回。2019–22で時間帯・退出時刻を最適化し、2022–26をOOS評価：1,012取引、勝率45.75%、PF 1.16、$10,000→$20,230、最大DD 23.7%。片道$3.50/lot込み。コストを片道$8.50へ倍増してもPF 1.08、利益$5,445。[詳細](https://yuratrading.com/blogs/range-breakout) **Grade B**（コード・データ・取引表非公開）。ただし本文内でMonte Carlo対象が1,012取引／283取引、赤字率が4%／0%と矛盾する。また最初に2通貨から勝者を選んでおり、銘柄選択バイアスがある。OOS期間境界も2022年で重なって見える。実コスト後も残る可能性はあるがPF 1.08–1.16は薄く、スプレッド拡大・約定遅延で消え得る。Pine v6：**partial**—1分足でロジック実装可能だがtick約定、可変スプレッド、正確なlot手数料は再現困難。

2. **同一ロジックのEUR/USD反証** — 2021–25、1,301取引、勝率30.1%、PF 1.00、$10,000→$4,755、最大DD 72.5%。手数料込みだが全期間最適化、OOSなし。[比較結果](https://www.yuratrading.com/blog/range-breakout) **Grade B**。実質的に粗利益がコストで全消失しており、一般的な「欧州通貨ほどLondon breakoutに適する」という宣伝と反対の結果。Pine v6：**partial**（上記と同じ）。

3. **Asia Breakout Retest（Brno thesis）** — EUR/USD・NAS100。00:00–06:00 UTCの高安を確定し、06:00–14:00に終値ブレイク→境界へのリテスト→再度境界外で終値確定して進入。1日1回。SLはATR、TPは固定RRだが倍率非開示。2015–25：EUR/USD 2,029取引、加重勝率約32%、年次PF 0.70–1.28、11年中7年損失。NAS100 1,416取引、加重勝率約31%、年次PF 0.51–1.02で、実質ほぼ全年度不採算。[論文PDF](https://dspace.vut.cz/server/api/core/bitstreams/e6ccf939-cdf8-4ecc-a34c-16cd87460ca7/content) **Grade B**。OOS分離なし、さらに著者自身がspread・commission・slippage未反映と認めるため、実売買では結果は一段悪化する。Pine v6：**partial**—状態機械は実装可能だがATR/RRの欠落で完全再現不能。

4. **GBP/USD London breakout（TradingView手集計）** — 04:00–06:00 UTCレンジ、07:00以降にレンジ外なら即時、そうでなければ最初の終値ブレイクで進入。SL反対端、TP 1.5R、1日1回、SL>50 pips・銀行休日は除外。2025年5月のみ19取引、勝率52.6%、PF 1.74、+152.3 pips。[投稿](https://www.tradingview.com/chart/GBPUSD/PnNN8yXI-london-break-out-strategy-my-strategy-back-test-2025-may/) **Grade C**。コスト・ニュース・OOSなしで、標本が小さすぎる。Pine v6：**partial**—価格ルールは可能、休日・ニュース判定は外部データが必要。

総合すると、USD/JPY以外では否定的証拠が優勢。USD/JPYも選択・最適化・報告矛盾を考慮すれば、ライブ投入可能な確立済みエッジではなく、低コスト環境でのforward test候補に留まる。
