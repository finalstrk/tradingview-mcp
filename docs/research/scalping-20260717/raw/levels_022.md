# Turtle-Soup / Stop-Hunt Reversal Patterns: Research Analysis

**topic_id:** levels_022  
**family:** levels  
**date:** 2026-07-17  
**question:** Turtle-soup / stop-hunt reversal patterns: objective rules and measured performance

## Analysis

調査結果：完全なルール、十分な標本、現実的コスト、アウト・オブ・サンプル（OOS）を同時に満たすTurtle-soup型の日中戦略は見つかれなかった。公開証拠は弱いか、混合・否定的である。

1. **20本スイング流動性スイープ**

市場・足：MNQ、MGC、NAS100 CFD、XAUUSD CFD、5分足。直近20本の高安を、ヒゲが最低1 ATR超過し、終値がレンジ内へ戻ったら反対方向へ終値エントリー。ストップ＝ヒゲ先端＋バッファ、目標＝反対側レンジ端または最低2R。セッション条件は不明。12か月、1,861取引、勝率53%、PF 1.32。内訳はMNQ 487件/PF 1.34、MGC 412/PF 1.21、NAS 524/PF 1.41、XAU 438/PF 1.32。ただし報告平均RR 1.2–1.3は「最低2R」と矛盾し、コストモデル・OOSなし。[結果](https://puravidaedge.com/blog/liquidity-sweep-strategies-backtest-results)／[方法](https://puravidaedge.com/methodology)。証拠B。Pine v6：可。追加1–2 tickのスリッページでPFが1近辺まで低下し得るため、リテールでの生存性は不確実。

2. **NQ Liquidity Sweep Reversal**

NQ、1/5/15分。等しい高値・安値またはスイングを2–5 tick抜き、最初にレベル内へ戻って確定した足で逆張り。ストップ＝スイープ先端外、目標＝反対側流動性/FVG、最低2R。活発なセッションを推奨。2023–2026、570取引、勝率37.2%、摩擦後PF 1.06、最大DD 65%。往復手数料$4.50＋片道1 tickを含むがOOSなし。[ソース](https://pinescriptforge.com/nq/liquidity-sweep-reversal/backtest)。証拠C（コード・データ非公開で、ページ表示にも不整合）。Pine：可。既に摩擦後PF 1.06なので、追加スリッページでほぼ確実に消える。

3. **ICT Turtle Soup＋翌日FVG持越し**

NQ、元データ1分、判定5分。9:30–11:30 ETに、pivot left=6/right=2の高安をスイープして反対側へ終値回帰。直前の3-point以上FVGを翌日へ持越し、接触位置が日中高安の15%以内かを検査。これは売買戦略ではなく、ストップ・利確なし。166日、123シグナル中翌日接触61件、期待側高安付近は5/61＝8.2%、反転18/61＝29.5%。ランダム基準約30%より悪い。OOS・コストなし。[ソース](https://seasonaledge.app/research/turtle-soup-fvg-backtest)。証拠B。Pine：部分可（診断は可能だが、将来のHOD/LODを使うため実売買不可）。明確な否定結果。

4. **EMA-ECR Stop-Hunt**

EURUSD、15分。前日・当週・前週高安でM/W型スイープを探し、EMA48/96クロス後EMA48リテストで参入。ストップ10 pipまたはスイープ足先端、利確30 pip以上（1:3）。2016–2018、初期$10,000・固定1 lotで+124.15%。取引数、勝率、PF、手数料、スプレッド、OOSは未報告。[査読会議論文](https://repository.petra.ac.id/18822/3/3._Stop_hunt_detection_using_indicators_-_PAPER.pdf)。形式上は証拠Aだが、再現性は低い。Pine：部分可（「明確なトレンド」とM/W判定が曖昧）。コスト耐性は判定不能。

総評：市場・銘柄選択によるサバイバーシップ、同一期間でのATR・RR・EMA調整、CFD業者データ、先物ロール、複数仮説試行が主要リスク。学術研究でも、1時間未満の見かけ上の反転の多くは一時的流動性とbid-ask bounceであり、スプレッド支払い後の戦略利益は消えると報告されている。[Heston–Korajczyk–Sadka](https://arxiv.org/abs/1005.3535)。したがって現状の最も支持可能な結論は「パターンは観測できるが、堅牢なリテール向け超過収益は未証明」である。
