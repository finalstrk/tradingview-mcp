# Full E2E / Pine 状態保全設計

Status: Phase 0a complete; Gate A0 approved and frozen; Gate A1 attempted once;
evidence integrated; new close-strategy approval required

Date: 2026-07-12

Scope: `npm test` coordinator、全live E2Eのstate guard、explicit target固定、Pine editor transaction、外部作用ledger

## 1. 現在の安全状態

直前の設計書scan中に、shellのcommand substitutionによって旧`npm test`が意図せず起動した。約44秒後に当該process groupだけをSIGTERMし、既知PIDの消滅は確認したが、`tests/e2e.test.js` worker内部のどのtestまで到達したかは確認できていない。

Phase 0aのread-only probeは1回、exit 0で完了し、chart target 3件、probe failure 0件だった。これによりprobe時点のcurrent snapshotは一部判明したが、事故前baselineがない項目の不変性と、事故中の`Ctrl+S`/POST因果は証明できない。

現在の扱いは次のとおりである。

- chart symbol/resolution/type/study count、shape count、replay、bottom widget、editor open/closed: Phase 0a時点のcurrent valueを観測済み
- default targetのcore 5項目: supplied baselineと一致
- Pine source、script identity、dirty、persistence mode、Cloud version: editorが全targetでclosedだったため観測不能
- known E2E source残留、`Ctrl+S` dispatch、Pine Facade POSTの事故因果: **unknown**
- state remediation: **未実施**
- 旧external gateの承認枠: **消費済み**

不明な作用を「起きていない」と推定しない。Gate A0承認前にdiscovery probeを実装・test・reviewしない。新しいeditor open、live mutation、save、reload、network POST、full gateは、Gate A1、後続設計承認、新しいapproval nonceの発行が終わるまで禁止する。

## 2. Phase 0: read-only impact audit

### 2.1 位置づけ

Phase 0は、改訂設計の実装承認と新external gateの再承認を求める前に行う。目的は事故後の現在値を観測することであり、事故前状態へ戻ったことを証明することではない。事故前baselineが存在しない項目は、現在値を読めても`unchanged`とは判定しない。

Gate A前の初回Phase 0は、既存のread-only inspection経路だけを使い、mutation可能なhelperやfull test runnerを起動しない。coordinator実装後は、Gate B前に同じauditを`npm test -- --phase0-read-only` modeで再実行する。このmodeはapproval nonceとspent leaseを要求しない代わりに、CDP read adapter以外のcapabilityを発行せず、mutation、network、keyboard、tab/TradingView process操作をruntimeで拒否する。

### 2.2 許可する操作

- repositoryとprocess状態のread-only確認
- CDP targetの列挙とread-only health probe
- chart、study、drawing、replay、panel、Pine editorのread-only state取得
- source本文を出力しないPine source取得可否の確認
- read-only APIから取得できる場合だけ、script identity、dirty、persistence mode、Cloud version signalの確認

### 2.3 禁止する操作

- source、symbol、resolution、type、visible range、study、drawing、replay、panelのmutation
- editor focus、keyboard/mouse input、`Ctrl+S`
- `Page.reload`
- Pine FacadeまたはCloudへのnetwork request
- tab/processの作成、終了、再起動
- state remediation、Cloud history操作、script version巻き戻し

### 2.4 成果物

Phase 0は本文やidentity値を出さず、各項目について次だけを報告する。

- `readable=true|false`
- `state=known|unknown`
- `baseline_comparable=true|false`
- 安全な固定error code
- numeric count

事故前baselineと比較できない項目は`baseline_comparable=false`のままとする。Phase 0で危険状態を見つけても修復せず、影響と次の承認要否をユーザーへ提示する。

### 2.5 Phase 0a実測結果

Probe実行回数は1回、process exitは0、chart targetは3件、failureは0件だった。source本文、source由来値、model URI、script identity、raw errorは出力していない。修復操作は行っていない。

| Target | Current chart state | Other observed state | Baseline interpretation |
|---|---|---|---|
| `0558976EACB39AC7E940B1C79E8FB20F` | symbol=`TSE_DLY:7438`、resolution=`1D`、type=`1`、studies=`8` | shapes=`0`、replay active、replay position present、bottom widget open、Pine editor closed | symbol/resolution/type/study count/editor closedのcore 5項目がsupplied baselineと一致 |
| `119DB9629A03197CFB120366EA6729CC` | symbol=`FX:USDJPY`、resolution=`15`、type=`1`、studies=`12` | shapes=`0`、replay inactive、bottom widget closed、Pine editor closed | accident前baselineなし。healthy target候補 |
| target ID prefix `6622` | symbol=`BATS:AXTI`、resolution=`15`、type=`1`、studies=`4` | shapes=`0`、replay inactive、bottom widget closed、Pine editor closed | accident前baselineなし |

3targetすべてでPine editorがclosedだったため、sourceとPine save controlはobservableではなかった。したがって、known E2E sourceの残留有無、事故中の`Ctrl+S`、Pine Facade POST、Cloud version変化との因果はunknownのままである。

Default `0558...` targetはcore baselineに一致したが、replayがinitial activeである。initial-active replayの完全復元APIが未証明の現時点では、full E2E mutation targetとして使わない。

## 3. 実行phaseと承認gate

1. **Phase 0a — complete**: 既存read-only inspectionによる事故影響audit。
2. **Gate A0 — complete**: secret-safe read-only discovery probeをofflineで作成・testし、独立reviewを完了。live actionは0。
3. **A0 offline work — complete**: fixed probe、fault/leak test、独立review、probe digestとexact commandを確定。
4. **Gate A1**: reviewed probe digest、exact command、full target ID、initial tuple、作用上限、page-network residualを提示し、限定live discoveryをユーザーが書面承認。
5. **Phase 1**: Gate A1の上限内でPine内部signalをread-only discovery。source mutation/save/keyboard/harness-initiated external network/reload/tab/process操作は0。
6. **Gate A evidence review**: Phase 1証拠に基づき、atomic Pine pathへ進むかread-only fallbackに固定するかをユーザーが決定し、実装方針を書面承認。
7. **Offline implementation**: coordinator、guard、adapter、unit testを実装。live操作なし。
8. **Offline validation**: unit、static boundary、manifest testを反復実行可能。
9. **Phase 0b**: 実装済みcoordinatorのread-only modeでcurrent stateを再確認。
10. **Gate B**: exact diff、target、command、作用上限、Cloud/TOCTOU riskを示し、新しいexternal gateとapproval nonceをユーザーが書面承認。
11. **唯一のexternal gate**: 新nonceでfull `npm test`を1回だけ実行。
12. **Read-only final audit**: counters、restore結果、test結果を確認。

以前ユーザーは、clean originalへの`Ctrl+S`最大1組にCloud履歴+1とTOCTOUの可能性があることを了承していた。しかし誤起動により、そのexternal gate枠は保守的に消費済みと扱う。設計全体の実装と、新nonceによる再実行には改めてユーザーの書面承認が必要である。

## 4. Phase 1: authoritative signal discovery

### 4.1 Gate A0: offline probe approval

Phase 0aでは全editorがclosedであり、UIを開かない条件のままではPine内部signalを発見できない。先に、live actionを持たない専用discovery probeをofflineで固定する。

Gate A0で承認を求めるのは次だけである。

- secret-safe read-only discovery probeの作成
- probeのunit/fault/leak test
- probeに対する独立read-only review
- reviewed file digestとexact commandの確定

Gate A0ではCDP接続、UI open、network、live testを実行しない。Gate A0の書面承認前にprobeを実装しない。

### 4.2 Discovery probe契約

probeはreview後に固定したmain-world functionだけを実行し、dynamic expression、arbitrary path、user-supplied codeを受け付けない。

出力allowlistは次へ限定する。

- boolean
- fixed type enum
- review済みruntime-path allowlistのmember name
- fixed error code
- numeric counter

次を出力、error、preview、IPC、fixtureへ含めない。

- Pine source本文または断片
- model URI、script ID、Cloud version identityの値
- object preview
- raw ProtocolError、raw cause、request params、exceptionDetails
- page exception message/stack/value

全async operationはfinite deadlineを持つ。deadline後もunderlying promiseのrejectionをsanitized handlerで回収し、late raw errorをstdout/stderrへ出さない。runtime生成sentinelをProtocolError、page exception、timeout late rejection、child test stdout/stderrへ注入し、漏えい0をoffline testする。

independent reviewerはfunction source、output allowlist、deadline、late-promise handling、secret leak tests、mutation absenceを確認する。review承認後のprobe file digestをGate A1 approval envelopeへbindし、digest不一致時はlive実行を拒否する。

### 4.3 Gate A1: limited live discovery approval

Gate A1で推奨するtargetはfull ID `119DB9629A03197CFB120366EA6729CC`である。Phase 0a initial tupleは次のとおりである。

```text
target_id=119DB9629A03197CFB120366EA6729CC
symbol=FX:USDJPY
resolution=15
chart_type=1
study_count=12
shape_count=0
replay_started=false
bottom_widget_open=false
pine_editor_open=false
```

Gate A1実行時はexact target IDとinitial tupleをread-onlyで再照合する。不一致ならUIを開かずfailureにする。

照合成功時だけPine editor openを最大1回試みる。open試行後は結果にかかわらず、同じtarget/contextであることをread-only確認し、`finally`でrestore-to-closedを最大1回だけ試みる。close failure/timeout/outcome unknownではeditor open残留リスクを報告し、retry、別target fallback、追加closeを行わない。

editorがvisibleになった場合だけreview済みprobeを1回実行し、stable script ID、dirty、persistence mode、Cloud version signal、model URIについて、availability、fixed type、allowlisted runtime pathだけを取得する。sourceを読めても本文やidentity値を返さない。

Gate A1の作用上限は次である。

- Pine editor open attempt: `<=1`
- restore-to-closed attempt: `<=1`
- discovery probe invocation: `<=1`
- retry/fallback: `0`
- source mutation/save/keyboard/mouse input/Pine Facade POST/`Page.reload`/tab/process操作: `0`
- harness-initiated external network: `0`

openによりTradingView page自身がbackground networkを開始する可能性は、harness-initiated networkと分ける。観測しない場合は`tradingview_page_initiated_network=unknown`と報告する。Network観測をGate A1へ含める場合も、URL、query、body、header、request/response previewを取得・出力せず、固定origin category別の件数とobservable booleanだけを返す。

open、identity check、probe、closeのどこかがfailure/unknownなら追加試行せず、read-only Pine fallbackへ移る。Gate A1の書面承認前にlive操作を実行しない。

### 4.4 Gate A1承認文

reviewerへ提示する承認文は、少なくとも次を含む。

> Reviewed probe digest、exact command、full target ID `119DB9629A03197CFB120366EA6729CC`、上記initial tupleを確認した。Pine editor open最大1回、secret-safe read-only probe最大1回、finally close最大1回を承認する。source mutation、save、keyboard/mouse input、harness-initiated external network、Pine Facade POST、reload、tab/process操作は承認しない。TradingView page自身のbackground networkはunknownまたは固定category countのみの観測となること、close failure/unknownではeditorがopenのまま残る可能性、retry/fallback 0を了承する。

承認時にはtemplate語ではなく、A0で確定したprobe digestとexact commandを実値で提示する。

### 4.5 未確認事項

現在のrepositoryとTradingView buildについて、次がauthoritativeであるという証拠はまだない。

- stable active Pine script ID
- dirty/clean signal
- manual-save/autosave persistence mode
- Cloud version identity
- initial-active replayを正確に復元するAPI

表示title、source一致、Monaco version counter、button labelだけからこれらを推測しない。

### 4.6 Read-only discovery要件

current buildに対し、mutationなしで次を調べる。

- runtime object pathとowner symbol
- 値の型、lifecycle、execution contextとの結び付き
- 同一状態で連続readしたときの安定性
- model URI、script ID、dirty、persistence modeの相互関係
- Cloud version signalがlocal stateかserver-backed stateか
- replay stateのactive/date/speed/playing/toolbarを取得・復元できる対称APIの有無

採用するsignalは、具体的なruntime pathまたはsource symbol、current build、read-only観測結果を証拠として残す。ただし値本文は記録しない。

### 4.7 分岐

- stable script ID、authoritative dirty、manual-save modeをすべて証明できる: Pine atomic mutationの実装候補へ進む。
- いずれかを証明できない: live Pineはread-only fallbackへ限定する。
- initial-active replayを正確に復元するAPIを証明できない: initial replay active時はreplay mutationを0回にしてfail-closedにする。
- Cloud version signalを取得できる: temporary transaction前後のversion不変を追加合否条件にする。
- Cloud version signalを取得できない: Cloud write 0とは主張せず、manual-save確認とharness save dispatch 0だけを証明する。

read-only Pine fallbackでは`get_source`、marker/error read、console read、toolbar detectionだけをliveで行い、`set_source`とsave guardはoffline fault injectionで検証する。このfallbackではlive set/save完了基準を満たせないため、専用disposable scriptなど別architectureを承認されない限り実装完了とはしない。

## 5. Single coordinator入口

### 5.1 `package.json`契約

`package.json`の`npm test`を唯一のcoordinator入口へ変更する。

```json
{
  "scripts": {
    "test": "node tests/test-coordinator.mjs"
  }
}
```

coordinatorを迂回してexternal live testを起動できるpackage scriptは置かない。`test:unit`はoffline専用として残せるが、CDP、network、keyboard、tab/process操作をruntime guardで拒否する。

`npm test`は次を順に行う。

1. offline unit、static external-boundary scan、manifest test。
2. Phase 0/1 evidenceとapproved implementation digestの照合。
3. approval nonce、spent lease、active run lockの検証。
4. read-only healthy target pre-probe。
5. explicit target/context固定。
6. live testをconcurrency 1で実行。
7. outer restoreとnumeric ledger assertion。

approval nonceがない通常実行はoffline checksまでで停止し、external actionを1件も起こさない。

### 5.2 Approval envelope

Gate Bの承認は次へbindする。

- repository HEADとworking-tree diff digest
- test manifest digest
- coordinator version
- explicit target IDまたは承認済みtarget選択規則
- external action budgets
- full command `npm test`
- 有効期限
- 一回限りのrandom approval nonce

nonce本文はログ、CLI引数、spent fileへ出さない。child processへapproval nonceを渡さず、coordinatorだけが保持する。

### 5.3 Persistent spent lease

coordinatorはexternal actionより前に、repositoryの`.git`配下へ次を作る。

```text
.git/tradingview-mcp-e2e/
  active.lock/
  spent/<nonce-digest>.json
```

手順は次のとおりである。

1. `active.lock` directoryをatomic createする。存在時は別runとして拒否する。
2. nonceの一方向digestでspent pathを決める。nonce本文は保存しない。
3. spent fileをexclusive createし、approval envelope digestとnumeric budgetsだけを書く。
4. fileとparent directoryをfsyncする。
5. spent leaseの永続化完了後にだけ最初のexternal actionを許す。

spent fileはrun成功、test failure、process crashを問わず残し、同じnonceの再使用を恒久拒否する。crashで`active.lock`が残った場合は自動削除しない。read-only process auditとユーザー承認を伴う別maintenance手順でだけ解除する。

normal終了時は、coordinatorが`active.lock`内のownership tokenと自身のin-memory tokenをconstant-time比較し、一致した場合だけlock directoryを削除する。削除後に`.git/tradingview-mcp-e2e/` parent directoryをfsyncして完了とする。ownership不一致、delete failure、fsync failureではlockを残し、fixed errorで終了する。他runのlockを削除しない。

### 5.4 Loopback IPC ledger

coordinatorは`127.0.0.1`のephemeral portへbindし、external adapter要求を一元処理する。

Pine ownerとPine Facade ownerはcoordinator process内へ集約する。child workerはreview済みmanifestに存在するfixed `case_id`だけを送る。source、endpoint、HTTP method、target ID、CDP expression、keyboard parameterをchildから受け取らない。coordinatorはcase IDをdigest-bound internal registryへ解決し、target policyとbudgetを再検証してから自身のadapterで実行する。unknown case ID、parameter追加、registry digest不一致を拒否する。

- childにはrun ID、loopback address、per-run capability tokenだけを環境変数で渡す。
- capability tokenはapproval nonceと別物にし、ログへ出さない。
- non-loopback接続、token不一致、sequence再利用、budget超過を拒否する。
- source、model URI、script ID、request/response body、raw errorをIPC payloadに含めない。
- coordinator自身がdispatch前にcounterをincrementし、child申告値を信用しない。
- action結果は`success|failure|unknown`と固定codeだけを返す。

process/CLIを跨ぐすべてのexternal actionはこのIPC経由にする。childはcase resultのboolean/fixed codeだけを受け取り、raw responseやidentity値を受け取らない。coordinator crash時はspent leaseが残るため、同じ承認で再実行できない。

### 5.5 Direct external access禁止

live testとtest-mode production pathは注入されたadapterだけを使う。

許可moduleを次へ限定する。

- coordinator
- CDP read adapter
- CDP mutation adapter
- Pine Facade adapter
- keyboard adapter
- loopback ledger client

static gateはallowlist外について次を拒否する。

- `chrome-remote-interface`のdirect import/require
- direct `fetch`、HTTP client、WebSocket client
- direct `Runtime`、`Page`、`Input`、DOM mutation domain call
- direct child-process経由のCLI external command
- `removeAllShapes`など全量削除API

scannerがimport aliasやdynamic callを安全に分類できない場合はpassさせず、manual allowlist reviewを要求する。runtimeでもcapabilityなしのCDP mutation、network、keyboard dispatchを拒否する。Facade POSTを行うCLI subprocessもledger clientを注入され、direct networkへfallbackしない。

## 6. Target、context、session ownership

### 6.1 Full run共有identity

full run全体で共有するidentityは次である。

- explicit target ID
- main frame identity
- loader/document identity
- main-world execution context unique identity

健康な既存targetをread-only pre-probeし、全live ownerへ`TV_MCP_E2E_TARGET_ID`として注入する。別target、先頭target、fallback targetへ接続しない。健康targetがなければreloadせずfail-closedにする。推奨runのreload countは0である。

Phase 0a結果に基づくPhase 1の推奨targetは、full ID `119DB9629A03197CFB120366EA6729CC`、symbol `FX:USDJPY`、resolution `15`、chart type `1`、studies `12`、shapes `0`、replay inactive、bottom widget/editor closedのtargetである。Gate A1実行直前にexact IDとinitial tupleを再照合する。`0558...`はreplay activeのため除外し、`119DB9629A03197CFB120366EA6729CC`が不一致または不健康なら`6622...`へ自動fallbackせず、作用0でGate A1をfailさせる。

### 6.2 Session identity

CDP session identityはsessionを開いたoperation owner内だけで有効である。別processや別CDP session間でsession ID一致を要求しない。

各Node adapterはCDP operationの直前と直後に次を照合する。

- owner-local sessionが同一でopen
- target IDがrun targetと一致
- context identityがrun contextと一致
- operation deadline内

post-checkが不一致またはtimeoutなら、mutation結果を`OUTCOME_UNKNOWN`とし、retry、save、別target fallbackを禁止する。

### 6.3 Page transactionの責務

browser main-world transactionが照合するのは次だけである。

- Monaco model URI
- active script identity
- dirty state
- persistence mode
- source

page内JavaScriptはCDP target IDやNode owner-local sessionを証明できないため、それらをtransaction結果として主張しない。target/session/contextはNode adapterがcall直前・直後に検証する。

## 7. Full E2E outer state guard

### 7.1 原則

full live run開始時に、全mutation surfaceのinitial stateをcaptureする。各mutationには単一owner、created-ID registry、restore contract、postconditionを割り当てる。owner未登録のmutationは実行しない。

既存objectを全削除してから再構築するcleanupは禁止する。initial objectを変更せず、testが作成したobjectだけをそのIDで削除する。

### 7.2 Mutation inventory

| Surface | Initial capture | Mutation owner | 許可するmutation | Restore / postcondition | Fail-closed条件 |
|---|---|---|---|---|---|
| Target/tab/process/reload | target ID、tab/process count | coordinator | なし | 同じtarget、追加tab/process 0、reload 0 | healthy targetなし、identity change |
| Symbol | canonical symbol | chart owner | test用symbolへ変更 | exact original symbolへ戻りstable read 2回 | getter/setter不明、restore timeout |
| Resolution | exact resolution | chart owner | test用resolutionへ変更 | exact original resolutionへ戻りstable read 2回 | 同上 |
| Chart type | numeric/type identity | chart owner | test用typeへ変更 | exact original type | 同上 |
| Visible range | from/toとAPI capability | range owner | capabilityが対称な場合だけ変更 | exact initial rangeまたは許容差を事前定義して復元 | exact restore APIを証明できない |
| Studies/indicators | initial study ID set、各visibility、変更対象config | study owner | test-created study追加、宣言済みvisibility toggle | created IDだけ削除、initial ID setとvisibility/config一致 | ID不明、全量削除しかない |
| Drawings/shapes | initial shape ID set | drawing owner | test-created drawing追加 | created ID registryのIDだけ削除、initial ID setが完全一致 | create ID不明、個別delete不能 |
| Replay | active、date、speed、playing、toolbar、availability | replay owner | initial inactive時、または完全対称restore APIが証明済みの場合だけ | initial replay tuple完全一致 | initial activeかつ正確な復元API未証明、state unknown |
| Bottom panel/UI | active widget、editor open、panel visible、取得可能size、focus | UI owner | 宣言済みpanel open/close/focusのみ | initial widget/open/visible/focus、取得可能sizeを復元 | generic click、stable owner/restoreなし |
| Pine source/model | model URI、script ID、dirty、persistence mode、source、view state | Pine owner | Phase 1 signal証明後のatomic temporary transactionだけ | same model/script、source一致、dirty initialへ復元 | signal不明、dirty/unknown、autosave/unknown |
| Pine save | clean originalとfocus、Cloud version signal可否 | save owner | 承認済み`Ctrl+S`最大1組 | source/model/script/dirty不変。version signalがあれば許容結果を検証 | preflight不一致、focus不能、outcome unknown |
| Batch symbol/timeframe | chart owner snapshot | batch ownerがchart ownerを借用 | 宣言した直列planだけ | batch全体と各row後のrestore contract | owner競合、partial restore |
| Alerts | initial alert ID set | alert owner | 今回はread-only。create/update/delete禁止 | initial ID set一致 | mutationが必要なtest |
| Watchlist | list identity、selected item | watchlist owner | 今回はread-only。add/remove/select禁止 | initial list/selection完全一致 | mutationが必要なtest |
| Layout | layout identity | layout owner | list/readのみ。switch/save禁止 | initial identity不変 | mutationが必要なtest |
| Data/console/capture | read対象とpanel state | read/UI owner | readのみ、panelはUI owner経由 | data source不変、panel復元 | hidden mutation検知 |
| Generic UI click/type | target element ownerとundo contract | UI owner | allowlistされた可逆elementだけ | owner固有postcondition | arbitrary first-match click、undo不明 |

### 7.3 Drawing契約

`removeAllShapes`、全shape列挙後の一括削除、initial shapeのdelete/recreateは禁止する。

1. run開始時にinitial shape ID setをcaptureする。
2. create operationが返したIDをowner registryへ即時登録する。
3. cleanupはregistry内のIDだけをindividual deleteする。
4. final shape ID setがinitial setと完全一致することを確認する。
5. create outcome unknownでは追加create/deleteを止め、read-only reconciliationだけを行う。

### 7.4 Replay契約

- initial inactive: start/step等を許可できる。cleanupはstop、realtime、toolbar stateをinitial inactiveへ戻し、stable readで確認する。
- initial active: date、speed、playing/paused、toolbar visibilityを正確に復元するAPIがPhase 1で証明できた場合だけmutationを許可する。
- initial activeで復元API未証明、またはinitial state unknown: replay mutation 0でtestをfail-closedにする。既存sessionをstopしない。

### 7.5 UI保証境界

保証対象はstable APIでcapture/restoreできるactive widget、editor open/closed、panel visible、editor focus、Monaco view stateである。任意DOM focus、popup、toast、undo/redo history、pixel-perfect panel sizeを証明できないbuildでは非保証として明示する。

generic clickは、対象element、期待mutation、owner、undo、postconditionがinventoryへ登録された場合だけ実行する。単に最初に見つかったbuttonをclickするtestは禁止する。

## 8. Pine atomic transaction

### 8.1 Preconditions

Phase 1で次をauthoritativeと証明できた場合だけ実装する。

- stable script ID
- dirty tri-state
- manual-save persistence mode
- model URI

initial dirtyが`dirty|unknown`、persistence modeが`autosave|unknown`ならtemporary mutationとsaveを0回にする。

### 8.2 Browser-side同期transaction

1回のmain-world同期function call内で次を完結する。途中に`await`、timer、network、Node round-tripを置かない。

1. model URI、script ID、dirty、persistence mode、sourceを取得してexpected値と比較。
2. original sourceとview stateをfunction-local memoryへ保持。
3. `try`内でtemporary sourceを設定。
4. temporary sourceをread-backして同期verify。
5. `finally`でoriginal sourceとview stateを復元。
6. restore後のmodel/script/dirty/source一致をbooleanで返す。

temporary source、original source、identity本文を返さない。test間にtemporary sourceを残さない。manual-save signalが未確認なら、このtransaction自体を実行しない。

### 8.3 Failureとdeadline

全CDP operationにfinite deadlineとabort handlingを設ける。setterがapply後にthrow、verify throw、restore throw、transport timeout、context invalidationを独立にtestする。

Node adapterがresponseを確定できなければ`MUTATION_OUTCOME_UNKNOWN`とする。unknown時はsave、retry、追加mutationを行わない。same target/context/model/scriptがread-onlyで再確認できる場合だけouter originalとのreconciliationを試み、復元できても当該runはfailureのままにする。

renderer process crash、TradingView crash、context destruction、OS crash、電源断ではJavaScript `finally`を保証できない。Node crash後もrendererが同期functionをrun-to-completionできる範囲ではfinallyが期待できるが、完全保証ではない。

## 9. Safe adapterとsecret containment

sourceを固定function declarationへ文字列連結せず、protocol value argumentとして渡す。ただしrequest parameter自体にsourceが含まれるため、adapter最内周でraw failureを固定errorへ置換する。

上位へ渡さないもの:

- raw ProtocolErrorとcause
- request params
- exceptionDetails
- page exception message/stack/value
- late rejected promiseのraw reason
- source/model/script本文を持つremote object

adapterはraw errorをcauseに付けず、code、phase、boolean、counterだけの新errorを生成する。timeout後のunderlying promiseにもsanitized catchを付ける。

remote objectはowner-local session、target、contextへbindし、context invalidation後に再利用しない。専用object groupを使い、success/failure/timeoutでfinite deadline付きreleaseを試みる。

runtime生成sentinelをProtocolError、page exception、verify throw、timeout late rejection、child TAP stdout/stderrへ注入し、logger、stack、summary、fixture、snapshot、working treeを含む全出力で漏えい0件をoffline検証する。

## 10. Network attributionとCloud safety

### 10.1 Network attribution

network観測は次の2系統を混同しない。

- `harness_initiated_network`: test/probe/coordinatorが明示的に開始したnon-loopback HTTP/WebSocket request。Gate A1では0。
- `tradingview_page_initiated_network`: editor open等を契機にTradingView page自身が開始したbackground request。観測しなければ`unknown`。

localhost CDP transportはcontrol channelとして別counterにし、`harness_initiated_network`へ含めない。Network domainでpage requestを観測する場合もpayloadを取得せず、次のfixed origin category別countだけを許可する。

- `tradingview_same_site`
- `tradingview_service_subdomain`
- `third_party`
- `unknown_origin`

URL、hostname本文、path、query、body、header、cookie、request/response previewは出力しない。観測不能時はcountを0へ潰さず、`tradingview_page_initiated_network_observable=false`と結果`unknown`を返す。

### 10.2 Cloud safetyの証明範囲

本設計は次だけを無条件に合否判定する。

- temporary transaction中のharness save command 0
- temporary source active中の`Ctrl+S` chord 0
- manual-save persistence modeのauthoritative確認
- Nodeへ戻る前のoriginal restore

これだけからTradingView Cloud write 0とは主張しない。

read-only Cloud version signalを取得できる場合は、temporary transaction直前とrestore直後、`Ctrl+S`より前のversion identity不変を必須にする。signalを取得できない場合は`cloud_version_verified=false`と報告し、Cloud write 0を成果として記載しない。

clean originalへの`Ctrl+S`はno-opが期待されるが、Cloud historyが1版増える可能性がある。version signalがある場合、save後はunchangedまたは承認済み範囲の1 incrementだけを許可する。signalがない場合、Cloud history outcomeはunknownとして最終報告する。

## 11. `Ctrl+S` chord契約

### 11.1 Preflight

Node adapter直前checkとpage preflightを組み合わせ、次を照合する。

- explicit target/context identity
- owner-local session open
- same model URI/script ID/source
- initial/current dirty=`clean`
- persistence mode=`manual-save`
- editor open/focused

page preflightとCDP Input dispatchの間にはTOCTOU residualがある。直列owner、context event監視、追加waitなしで窓を縮小するが0とは主張しない。

### 11.2 Countersとkey release

- `ctrl_s_chord_count <= 1`
- `key_event_count <= 2`
- 1 chordはmodifier付き`KeyS` keyDown 1回とkeyUp 1回である。

adapterはchord budgetをkeyDown前に消費する。keyDownを試みた後は、そのcallがfailureまたはoutcome unknownでも`finally`でkeyUpを1回試みる。keyUpもfinite deadlineを持つ。

`key_event_count`は各key eventのdispatch試行前にincrementする。transport outcomeがunknownでもcountを巻き戻さない。

keyDown/keyUpのどちらかがfailure/unknownならsave outcomeをunknownとし、2回目のchord、retry、別focus操作を禁止する。keyUp failureによるstuck-key residualも最終報告する。

## 12. Numeric external-effect ledger

coordinatorは少なくとも次を累積する。

- `page_reload_count`
- `pine_facade_post_count`
- `harness_initiated_network_count`
- `tradingview_page_initiated_network_observable`
- fixed origin category別page request count
- `ctrl_s_chord_count`
- `key_event_count`
- `tab_create_count`
- `tab_close_count`
- `tradingview_process_start_count`
- `tradingview_process_kill_count`
- per-surface mutation count
- outcome unknown count

新しく承認されるrunの上限候補は次である。

| Effect | Limit |
|---|---:|
| `Page.reload` | 0 |
| Pine Facade POST | 6 |
| Harness-initiated external network | 6（承認済みPine Facade POSTだけ） |
| `Ctrl+S` chord | 1 |
| key event | 2 |
| tab create/close | 0 |
| TradingView process start/kill | 0 |
| full external gate invocation | 1 |

Facade POSTは6case、retry 0とし、full external gateのharness-initiated external networkはこの6件だけである。Gate A1のharness-initiated external networkは0である。HTTP failureでも同じnonceで再実行しない。numeric ledgerはsource、identity、URL、header、body、raw errorを保存しない。TradingView page initiated networkは別counter/observable flagで報告する。

## 13. Offline verification

新external approvalを消費せず、次をofflineで反復検証する。

1. Phase 0 modeがmutation/network/inputを拒否する。
2. nonceなし`npm test`がoffline後に停止しexternal action 0。
3. spent nonceの二重invocation拒否。
4. concurrent coordinatorのactive lock拒否。
5. coordinator crash後もspent leaseが残る。
6. loopback以外、bad token、sequence replay、budget超過の拒否。
7. static gateがdirect fetch/CDP/Input/child CLI bypassを拒否。
8. explicit target以外へのfallback 0。
9. Node adapterのpre/post target/context/session check。
10. full mutation inventoryにownerなしmutation 0。
11. drawingsのinitial IDs保全、created IDsだけ削除、全shape削除禁止。
12. replay initial inactive復元とinitial-active fail-closed。
13. symbol/resolution/type/range/study/UIのsuccess/failure cleanup。
14. Pine apply後throw/verify throw/timeout/outcome unknown。
15. script/dirty/persistence signal unknown時のread-only fallback。
16. Cloud signal有無によるclaim分離。
17. keyDown failureでもkeyUp finally、chord<=1、events<=2。
18. ProtocolError/page exception/child TAPのsentinel漏えい0。
19. remote object/context lifecycleとrelease。
20. crash/unknown後のretry 0。
21. Gate A0 probeのfixed function、output/runtime-path allowlist、mutation absence。
22. probeのfinite deadline、late promise sanitize、child stdout/stderr sentinel漏えい0。
23. reviewed probe digest不一致時のGate A1拒否。
24. child IPCがfixed case ID以外を送れず、Pine/Facade ownerがcoordinator process内だけに存在する。
25. normal終了時のactive.lock ownership確認、削除、parent directory fsyncと、ownership不一致時のlock保全。

## 14. 唯一のexternal gate

Gate A/Bを通過した場合だけ、新approval nonceでfull `npm test`を1回実行する。その前後にtargeted Pine live、Facade-only、別full suiteを実行しない。

合否条件:

- offline/static/manifest tests全pass
- explicit target/contextが全ownerで不変
- full mutation inventoryのinitial/final invariantが全pass
- drawing initial IDs不変、test-created IDs残存0
- replay initial state完全復元、またはunsafe initial-activeでmutation 0
- Pine signalsが証明済みならatomic transaction pass。未証明ならread-only fallbackとして明示
- temporary sourceへのharness save dispatch 0
- Cloud version signalがある場合だけtransaction前後version不変
- `page_reload_count === 0`
- `pine_facade_post_count === 6`
- `harness_initiated_network_count === 6`（Pine Facade 6caseのみ）
- TradingView page initiated networkはobservable flagとfixed origin category count、または`unknown`
- `ctrl_s_chord_count <= 1`
- `key_event_count <= 2`
- tab/process追加操作0
- outcome unknown 0
- stdout/stderr sentinel 0
- outer restore全pass

external gateがfailure/unknownになった場合、same nonceでretryしない。read-only impact確認と新しいユーザー承認なしに別nonceを発行しない。

## 15. Alternative

| Approach | User-state risk | Cloud effect | Crash risk | Live coverage | Decision |
|---|---|---|---|---|---|
| Explicit healthy target + full outer guard + Pine atomic transaction | active stateをowner別に復元 | original save最大1組。Cloud write claimはsignal依存 | renderer fatal residual | 高い | signal証明後の推奨候補 |
| Dedicated disposable target/script | user active stateと分離 | script/tab create/deleteが必要 | active user stateへの影響を減らせる | 高い | 新しい外部作用承認が必要 |
| Active Pine read-only + offline mutation guards | Pine source mutation 0 | 0 | 最小 | set/save live不足 | signal未証明時の必須fallback |
| One-shot outer wrapper | process境界でstate喪失 | wrapper次第 | crash windowが広い | wrapper経由のみ | 不採用 |
| Pine live skip | Pine risk 0 | 0 | 0 | 回帰coverage不足 | 完了基準未達 |

## 16. 受入基準

| Requirement | Evidence |
|---|---|
| Accident containment | Phase 0 report。baselineなし項目はunknownを維持 |
| Approval isolation | 旧枠spent、新設計と新nonceの書面承認 |
| Gate A0 isolation | offline probe作成/test/independent reviewだけ。live action 0。承認前実装0 |
| Probe safety | fixed function、allowlisted output/path、finite deadline、late sanitize、sentinel漏えい0、reviewed digest bind |
| Gate A1 bounds | exact `119DB9629A03197CFB120366EA6729CC`、initial tuple再照合、open<=1、probe<=1、finally close<=1、retry/fallback0 |
| Single entry | `npm test`がcoordinatorだけを起動 |
| Nonce one-shot | `.git` spent leaseのatomic永続化、reuse 0 |
| Cross-process ledger | authenticated loopback IPCのnumeric counters |
| Coordinator ownership | Pine/Facade ownerはcoordinator process内。child IPCはfixed case IDのみ |
| Active lock cleanup | owner token一致時だけdelete、parent fsync。failure時lock保全 |
| Direct bypass 0 | static boundary testとruntime capability guard |
| Target/context | explicit targetとmain-world context identity不変 |
| Session scope | session identityはoperation owner内だけでpre/post照合 |
| Full state restore | inventory全surfaceでinitial/final invariant pass |
| Drawing safety | initial IDs不変、created IDsだけ削除、全shape削除0 |
| Replay safety | exact restore、またはinitial-active unsafe時mutation 0 |
| Pine signal validity | runtime path/build/read-only evidence。未証明時はfallback |
| Atomic mutation | browser同期transaction内でset/verify/finally restore/read-back |
| Deadline/unknown | 全CDP finite deadline、unknown時retry/save 0 |
| Cloud claim | manual-save+harness dispatch 0。version signal時だけversion不変 |
| Network attribution | harness initiatedとTradingView page initiatedを分離。pageはfixed category countまたはunknown |
| Save chord | same clean focused originalだけ。chord<=1、events<=2 |
| Key release | keyDown failure/unknownでもkeyUp finally 1回 |
| Secret containment | raw protocol/page/TAP sentinel漏えい0 |
| Crash boundary | renderer/OS crash、TOCTOU、stuck-key residualを最終報告 |
| External budget | reload0、POST6、tab/process0、external run1 |

## 17. 既知の未解決事項

- Phase 0aでcurrent chart/UI snapshotは取得したが、事故前baselineがない項目の不変性は証明できない。
- 全Pine editorがclosedだったため、known E2E source残留、事故中の`Ctrl+S`、Facade POST、Cloud version変化の因果はunknown。
- Gate A0は承認済みで、専用discovery probeはoffline test 157/157、独立review Approvedである。
- reviewed probe digestは`0400ce7e163bc475f2a68609551754fe4530f67062ba87ca6e0e3cb25d5d9125`、exact commandはapproval envelopeで固定済み。
- Pine editor openに伴うTradingView page initiated background networkは未観測で、現時点ではunknown。
- current TradingView buildのstable script ID signalは未確認。
- dirty/clean authoritative signalは未確認。
- manual-save/autosave authoritative signalは未確認。
- Cloud version signalの有無は未確認。
- initial-active replayの完全復元APIは未確認。
- Monaco undo/redo historyと任意DOM focusの完全復元は保証未確定。
- browser transactionでもrenderer/OS fatal crashを回復できない。
- save preflightとCDP Input間のTOCTOUを0にできない。
- keyUp failure時のstuck-key可能性を0にできない。
- Gate A1の限定editor-open/read-only discovery承認は未取得。
- Gate A evidence review後の実装方針承認は未取得。
- 新external gate用approval nonceは未取得。旧承認枠は誤起動により消費済み。

これらを証拠なしに解決済み扱いしない。Phase 0/1の結果によってread-only fallbackまたは実装不可分岐を選ぶ。
