# DT PDH PDL Break v1

前日高値（PDH）または前日安値（PDL）を明確に抜けたあと、同じ水準へのリテストが成立したタイミングだけを狙うデイトレード用セットアップです。単純なブレイク直後の飛び乗りではなく、ブレイク後の押し戻しを待つことで、前日レンジ端がサポートまたはレジスタンスとして機能している状況を検出します。

## 検出条件

- PDH/PDL は `request.security(syminfo.tickerid, "D", [high[1], low[1]], lookahead=barmerge.lookahead_on)` で取得する。
- Long は `close > pdh` でブレイク成立、`Retest timeout (bars)` 以内に `low <= pdh and close > pdh` でリテスト成立。
- Short は `close < pdl` でブレイク成立、`Retest timeout (bars)` 以内に `high >= pdl and close < pdl` でリテスト成立。
- 日替わりで Long/Short のステートと当日シグナル済みフラグをリセットする。
- ブレイク後リテスト待ちは `forming`、リテスト成立は `triggered`、タイムアウトは `expired` として扱う。

## Inputs

| 名前 | Default | 意味 |
|---|---:|---|
| Session preset | NY | Tokyo / London / NY / RTH / Custom から監視セッションを選ぶ。 |
| Custom session | 0930-1600 | `Session preset` が Custom のときだけ使うセッション文字列。 |
| Custom timezone | America/New_York | `Session preset` が Custom のときだけ使うタイムゾーン。 |
| Retest timeout (bars) | 12 | ブレイク成立後、リテスト成立を待つ最大バー数。 |

## SL/TP モデル

- Long: `entry = close`、`SL = リテスト足 low - ta.atr(14) * 0.25`。
- Long TP1: `entry + (entry - SL) * 1.5`。
- Long TP2: `pdh + (pdh - pdl) * 0.5`。
- Short: `entry = close`、`SL = リテスト足 high + ta.atr(14) * 0.25`。
- Short TP1: `entry - (SL - entry) * 1.5`。
- Short TP2: `pdl - (pdh - pdl) * 0.5`。

## 想定市場・セッション

デフォルトは NY セッションです。米国株、米国指数先物、流動性の高い FX/CFD の NY 時間ブレイク確認に向きます。日本株では Tokyo、欧州株価指数やロンドン時間の FX では London、米国現物株の通常取引時間に合わせる場合は RTH を使います。
