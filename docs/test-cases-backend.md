# バックエンド テストケース一覧

`backend/test/` 配下のテストケースをファイル単位でまとめた一覧です。
テスト方針・カバレッジの品質ゲートは [testing.md](testing.md) を参照してください。

> テストを追加・変更したときは、この一覧も同じコミットで更新してください。

## サマリー

| 種別 | ファイル数 | テスト数 |
|---|---:|---:|
| 単体テスト（`test/unit/`） | 16 | 4,985 |
| E2E テスト（`test/e2e/`） | 3 | 24 |

単体テストの大半（4,725 件）は `race-pattern.scenarios.spec.ts` のパラメータ化テストです（全ウマ娘 135 体 × 35 ケース）。

## 目次

- 単体テスト
  - [auth](#auth)
  - [common](#common)
  - [race](#race)
  - [seed](#seed)
  - [umamusume](#umamusume)
- [E2E テスト](#e2e-テスト)
- [テスト未作成のソース](#テスト未作成のソース)

---

## 単体テスト

### auth

#### `unit/auth/auth.service.spec.ts`（3 件）

対象: `src/auth/auth.service.ts`

| メソッド | テストケース |
|---|---|
| `getUserData` | AuthMeResponse 形式でユーザー情報を返す |
| `getUserData` | 異なるユーザーIDでも正しく返す |
| `getUserData` | 空文字のユーザーIDでも動作する |

---

### common

#### `unit/common/cognito/cognito.service.spec.ts`（4 件）

対象: `src/common/cognito/cognito.service.ts`

| 対象 | テストケース |
|---|---|
| コンストラクタ | ConfigService から COGNITO_USER_POOL_ID と COGNITO_CLIENT_ID を取得する |
| `verifyToken` | 有効なトークンの場合 → sub（ユーザーID）を返す |
| `verifyToken` | 無効なトークンの場合 → null を返す |
| `verifyToken` | 無効なトークンの場合 → debug ログが出力される |

#### `unit/common/exceptions/business-logic.exception.spec.ts`（7 件）

対象: `src/common/exceptions/business-logic.exception.ts`

| 観点 | テストケース |
|---|---|
| コンストラクタ | 引数がすべてプロパティに正しく設定される |
| コンストラクタ | cause を省略した場合は undefined になる |
| クラス識別プロパティ | name が BusinessLogicException に設定される |
| クラス識別プロパティ | domain が application に設定される |
| デフォルト値 | errorCode を省略した場合は INTERNAL_001 が使われる |
| デフォルト値 | httpStatus を省略した場合は 400（BAD_REQUEST）が使われる |
| Error の継承 | instanceof Error が true になる |

#### `unit/common/exceptions/database.exception.spec.ts`（6 件）

対象: `src/common/exceptions/database.exception.ts`

| 観点 | テストケース |
|---|---|
| コンストラクタ | 引数がすべてプロパティに正しく設定される |
| コンストラクタ | cause を省略した場合は undefined になる |
| クラス識別プロパティ | name が DatabaseException に設定される |
| クラス識別プロパティ | domain が database に設定される |
| デフォルト値 | errorCode を省略した場合は DB_001 が使われる |
| Error の継承 | instanceof Error が true になる |

#### `unit/common/exceptions/external-api.exception.spec.ts`（6 件）

対象: `src/common/exceptions/external-api.exception.ts`

| 観点 | テストケース |
|---|---|
| コンストラクタ | 引数がすべてプロパティに正しく設定される |
| コンストラクタ | cause を省略した場合は undefined になる |
| クラス識別プロパティ | name が ExternalApiException に設定される |
| クラス識別プロパティ | domain が external_api に設定される |
| デフォルト値 | errorCode を省略した場合は EXTERNAL_001 が使われる |
| Error の継承 | instanceof Error が true になる |

#### `unit/common/filters/all-exceptions.filter.spec.ts`（20 件）

対象: `src/common/filters/all-exceptions.filter.ts`

| 例外種別 | テストケース |
|---|---|
| HttpException | 元のステータスコードで返す |
| HttpException | body が string の場合 → errorCode は HTTP_ERROR になる |
| HttpException | body が object で errorCode を持つ場合 → errorCode がレスポンスに含まれる |
| HttpException | body が object で errorCode を持たない場合 → errorCode は HTTP_ERROR になる |
| HttpException | warn / error ログは出力しない |
| HttpException | body の message が string[] の場合 → "; " で結合した文字列で返す（ValidationPipe 対応） |
| BusinessLogicException | httpStatus で指定したステータスコードで返す |
| BusinessLogicException | errorCode と message がレスポンスに含まれる |
| BusinessLogicException | warn ログが出力される |
| DatabaseException | 500 で返す |
| DatabaseException | errorCode が DatabaseException のものになる |
| DatabaseException | クライアントへのメッセージは固定文言になる |
| DatabaseException | error ログが出力される |
| ExternalApiException | 500 で返す |
| ExternalApiException | errorCode が ExternalApiException のものになる |
| ExternalApiException | error ログが出力される |
| 未知の例外（Error など） | 500 で返す |
| 未知の例外（Error など） | errorCode は INTERNAL_001 になる |
| 未知の例外（Error など） | クライアントへのメッセージは固定文言になる |
| 未知の例外（Error など） | error ログが出力される |

#### `unit/common/guards/auth.guard.spec.ts`（5 件）

対象: `src/common/guards/auth.guard.ts`

| 条件 | テストケース |
|---|---|
| `@Public()` ルート | 認証ヘッダーなしでも true を返す |
| 認証必須ルート | Authorization ヘッダーがない場合 → UnauthorizedException をスローする |
| 認証必須ルート | "Bearer " で始まらない Authorization ヘッダーの場合 → UnauthorizedException をスローする |
| 認証必須ルート | Cognito の verifyToken が null を返す場合 → UnauthorizedException をスローする |
| 認証必須ルート | 有効なトークンの場合 → true を返し、request.userId にユーザーIDをセットする |

#### `unit/common/utils/prisma-error.handler.spec.ts`（13 件）

対象: `src/common/utils/prisma-error.handler.ts`

| 条件 | テストケース |
|---|---|
| P2002（ユニーク制約違反） | ConflictException をスローする |
| P2002（ユニーク制約違反） | デフォルトのエラーコードとメッセージが使われる |
| P2002（ユニーク制約違反） | options でエラーコードとメッセージをオーバーライドできる |
| P2025（レコード未存在） | NotFoundException をスローする |
| P2025（レコード未存在） | デフォルトのエラーコードとメッセージが使われる |
| P2025（レコード未存在） | options でエラーコードとメッセージをオーバーライドできる |
| その他の PrismaClientKnownRequestError | DatabaseException をスローする |
| その他の PrismaClientKnownRequestError | DB_001 エラーコードで DatabaseException がスローされる |
| Prisma 以外の一般エラー | DatabaseException をスローする |
| Prisma 以外の一般エラー | location が DatabaseException に設定される |
| エッジケース | null を渡した場合 → DatabaseException をスローする |
| エッジケース | undefined を渡した場合 → DatabaseException をスローする |
| エッジケース | null の cause が DatabaseException に設定される |

---

### race

#### `unit/race/race.service.spec.ts`（21 件）

対象: `src/race/race.service.ts`

| メソッド | テストケース |
|---|---|
| `getRunRaces` | 出走済みレースを race_id 昇順で取得し race 情報のみ返す |
| `getRunRaces` | 出走済みレースが存在しない場合 → 空配列を返す |
| `cancelRunRaces` | 指定した raceIds を deleteMany で削除し取り消しメッセージを返す |
| `cancelRunRaces` | 1件のみ取り消す場合 → in 配列に1件だけ渡す |
| `getRaceList` | フィルタなし（state=-1, distance=-1）で findMany を race_rank フィルタのみで呼ぶ |
| `getRaceList` | state=0（芝）フィルタで race_state=0 を含む where で呼ぶ |
| `getRaceList` | distance=2（マイル）フィルタで distance=2 を含む where で呼ぶ |
| `getRaceList` | state=1 かつ distance=3 の複合フィルタで正しい where で呼ぶ |
| `getRegistRaceList` | G1/G2/G3 レース一覧を返す |
| `getRemaining` | 登録ウマ娘が存在しない場合 → 空配列を返す |
| `getRemaining` | 残レースが0件の場合 → isAllCrown が true になる |
| `getRemaining` | 残レースがある場合 → isAllCrown が false でカウントが正しい |
| `getRemaining` | 複数ウマ娘が存在する場合 → allCrownRace 昇順でソートされる |
| `registerOne` | 既に出走済みの場合 → 「既に出走済み」メッセージを返す |
| `registerOne` | 未出走の場合 → レコードを作成して登録メッセージを返す |
| `registerOne` | race_name がない場合 → ID をフォールバックとして使う |
| `raceRun` | レコードを作成して出走完了メッセージを返す |
| `registerPattern` | 複数レースを createMany(skipDuplicates) で一括登録する |
| `registerPattern` | 空配列を渡した場合 → createMany を data=[] で呼ぶ |
| `getRemainingToRace` | 指定月に残レースがある場合 → そのレースを含む結果を返す |
| `getRemainingToRace` | 指定月に残レースがない場合 → 次のスロットを探索する |

#### `unit/race/pattern.helpers.spec.ts`（103 件）

対象: `src/race/pattern/pattern.helpers.ts`

| 関数 | テストケース |
|---|---|
| `getApt` | 適性文字 S〜G → 4〜-3 に変換する（8 件のパラメータ化テスト） |
| `getApt` | 未知の文字列 → 0 |
| `sk` | "grade\|month\|half" 形式のキーを返す |
| `skFromIdx` | index 0 → junior 7月前半 |
| `skFromIdx` | index 1 → junior 7月後半 |
| `skFromIdx` | index 12 → classic 1月前半 |
| `skFromIdx` | index 36 → senior 1月前半 |
| `getAvailableSlots` | classic_flag=true のみ → classic スロット1件 |
| `getAvailableSlots` | classic_flag + senior_flag → 2スロット（classic と senior の両方） |
| `getAvailableSlots` | junior_flag=true のみ → junior スロット1件 |
| `getAvailableSlots` | 全フラグ false → スロット0件 |
| `isLarcRestrictedSlot` | classic 5月後半 → true（日本ダービー強制配置スロット） |
| `isLarcRestrictedSlot` | classic 5月前半 → false |
| `isLarcRestrictedSlot` | classic 7・8・9月（前後半とも） → true（3 件のパラメータ化テスト） |
| `isLarcRestrictedSlot` | classic 10月前半 → true |
| `isLarcRestrictedSlot` | classic 10月後半 → false |
| `isLarcRestrictedSlot` | classic 6月後半 → false |
| `isLarcRestrictedSlot` | senior 6月後半 → true |
| `isLarcRestrictedSlot` | senior 6月前半 → false |
| `isLarcRestrictedSlot` | senior 7〜12月前半 → true（6 件のパラメータ化テスト） |
| `isLarcRestrictedSlot` | senior 5月後半 → false |
| `isLarcRestrictedSlot` | junior 任意のスロット → false |
| `isBCRestrictedSlot` | senior 11月後半 → true |
| `isBCRestrictedSlot` | senior 12月前半 → true |
| `isBCRestrictedSlot` | senior 12月後半 → true |
| `isBCRestrictedSlot` | senior 11月前半 → true（BC最終レース配置スロットも割り当て不可） |
| `isBCRestrictedSlot` | senior 10月後半 → false |
| `isBCRestrictedSlot` | classic 11月後半 → false |
| `isBCRestrictedSlot` | junior 12月後半 → false |
| `getConsecutiveLength` | 空グリッドで提案スロット → 1 |
| `getConsecutiveLength` | 前後に1件ずつ既存 + 提案 → 3連続 |
| `getConsecutiveLength` | 3件連続既存の先頭に提案 → 4連続 |
| `getConsecutiveLength` | 隣接なし → 1 |
| `isConsecutiveViolation` | 3連続以内になる → false |
| `isConsecutiveViolation` | 4連続になる → true |
| `buildPatternFromGrid` | 空グリッド → 全スロット race_id: null |
| `buildPatternFromGrid` | 1件配置 → 対象スロットにレース情報が入る |
| `buildPatternFromGrid` | スロット数: junior=12, classic=24, senior=24 |
| `buildPatternFromGrid` | 配置したスロット以外は空（race_id: null） |
| `getAllRacesInPattern` | パターン内の race_id に対応するレースを返す |
| `getAllRacesInPattern` | 空パターン → 空配列 |
| `getAllRacesInPattern` | allGRaces に存在しない race_id は無視される |
| `calculateAndSetMainConditions` | 芝中距離レースのみ → surface="芝", distance="中距離" |
| `calculateAndSetMainConditions` | 芝2件・ダート1件 → surface="芝"（多数決） |
| `calculateAndSetMainConditions` | 中距離2件・マイル1件 → distance="中距離" |
| `calculateAndSetMainConditions` | ダートのみ → surface="ダート" |
| `calcBCStrategy` | 芝C以上かつ中距離C以上 → null（Bパターン・補修不要） |
| `calcBCStrategy` | C境界値（芝C・距離C）→ null |
| `calcBCStrategy` | 芝G → {芝: 3}（G→C に3枚必要、上限クリップ） |
| `calcBCStrategy` | 距離D → {中距離: 1}（D→C に1枚必要） |
| `calcBCStrategy` | 芝D・距離D → {芝: 1, 中距離: 1} |
| `calcBCStrategy` | 距離E → {中距離: 2}（E→C に2枚必要） |
| `calcBCStrategy` | ダートBCレース: ダート適性を参照する |
| `calcBCStrategy` | 短距離BCレース: sprint_aptitude を参照する |
| `calcBCStrategy` | 長距離BCレース: long_distance_aptitude を参照する |
| `buildAptitudeState` | UmamusumeRow の各適性フィールドを AptitudeState にマップする |
| `applyStrategyToAptitude` | G芝 + 3因子 → D（G→F→E→D） |
| `applyStrategyToAptitude` | A芝 + 3因子 → S（上限クリップ） |
| `applyStrategyToAptitude` | S芝 + 1因子 → S（既にSはクリップ） |
| `applyStrategyToAptitude` | G芝 + 1因子 → F |
| `applyStrategyToAptitude` | 複数属性を同時に向上する |
| `applyStrategyToAptitude` | 元のオブジェクトを変更しない（イミュータブル） |
| `raceMatchesAptitude` | 通常モード: 芝C以上かつ中距離C以上 → true |
| `raceMatchesAptitude` | 通常モード: 芝E（C未満）→ false |
| `raceMatchesAptitude` | 通常モード: ダートC以上かつマイルC以上 → true |
| `raceMatchesAptitude` | 通常モード: C境界値（芝C・距離C）→ true |
| `raceMatchesAptitude` | BCモード: BCと同じ馬場・距離 → true（適性スコア無関係） |
| `raceMatchesAptitude` | BCモード: 馬場が異なる → false |
| `raceMatchesAptitude` | BCモード: 距離が異なる → false |
| `isRaceRunnable` | 芝D・中距離D → true（D=スコア0以上） |
| `isRaceRunnable` | 芝E（スコア=-1）→ false |
| `isRaceRunnable` | 距離G（スコア=-3）→ false |
| `isRaceRunnable` | ダートD・マイルD → true |
| `isRaceRunnable` | 短距離D → true |
| `calcRunnableEnhancement` | 既に走れる（芝A・中距離A）→ null |
| `calcRunnableEnhancement` | 芝E → {芝: 1}（Eから1枚でD） |
| `calcRunnableEnhancement` | 芝G → {芝: 3}（Gから3枚でD） |
| `calcRunnableEnhancement` | 芝E・距離E → {芝: 1, 中距離: 1} |
| `calcRunnableEnhancement` | スロット全消費（6枠使用済み）→ null |
| `calcRunnableEnhancement` | 必要因子数がフリースロット超過 → null |
| `calcRunnableEnhancement` | ダート短距離レース: ダート適性不足を補修 |
| `calculateFactorComposition` | 常に6要素を返す（全A適性・戦略なし） |
| `calculateFactorComposition` | 常に6要素を返す（戦略あり） |
| `calculateFactorComposition` | 芝G・中距離G + 芝中距離レースのみ → 芝3・中距離3（G→D補修） |
| `calculateFactorComposition` | 戦略あり: 戦略因子が出力に含まれる |
| `calculateFactorComposition` | 戦略あり・残スロット不足分は 自由 で埋められる |
| `calculateFactorComposition` | isLarc=true: 戦略から芝・中距離が除外される |
| `calculateFactorComposition` | isLarc=true: 芝・中距離適性をAとして扱うため補修不要 |
| `calculateFactorComposition` | 出力は FACTOR_SORT_ORDER でソートされる（芝 < ダート < 距離 < 自由） |

#### `unit/race/race-pattern.service.spec.ts`（4 件）

対象: `src/race/pattern/race-pattern.service.ts`（DB モック + 実アルゴリズム）

| メソッド | テストケース |
|---|---|
| `getRacePattern` | 登録ウマ娘が存在しない場合 → InternalServerErrorException をスローする |
| `getRacePattern` | 全レース出走済みの場合 → パターンの各スロットにレースが入らない |
| `getRacePattern` | 残レースがある場合 → patterns に少なくとも1件のパターンが含まれる |
| `getRacePattern` | シナリオレースがある場合 → パターンが生成される |

#### `unit/race/race-pattern.scenarios.spec.ts`（4,725 件）

対象: `src/race/pattern/race-pattern.service.ts` / `bc-pattern-builder.service.ts` / `larc-pattern-builder.service.ts`

`backend/data/Umamusume.json` の全ウマ娘（135 体）それぞれに対して以下を実行するパラメータ化テスト。
BC 中間レースは「実際のゲームプレイでは先に出走済み」という前提で出走済みに設定してモックを構築する。

**BCシナリオ残レース数 × ラーク有無**（1 体あたり 30 件 = BC残 1/3/5/7/9 件 × 6 ケース）

| 条件 | テストケース |
|---|---|
| BC残 N 件 + ラーク残存あり | BC N 件 + larc パターンが生成される |
| BC残 N 件 + ラーク残存あり | 各パターンに必須フィールドがある（scenario / factors 6 枠 / totalRaces > 0） |
| BC残 N 件 + ラーク残存あり | 未出走レースが全件いずれかのパターンに含まれる |
| BC残 N 件 + ラーク残存なし | BC N 件パターンのみ生成される（larc なし） |
| BC残 N 件 + ラーク残存なし | 各パターンに必須フィールドがある |
| BC残 N 件 + ラーク残存なし | 未出走レースが全件いずれかのパターンに含まれる |

**ランダムBC出走済み × 全レース収録検証**（1 体あたり 5 件 = 出走済み BC 1/3/5/7/9 件）

| 条件 | テストケース |
|---|---|
| シード付きシャッフル（`${ウマ娘名}-${件数}`）で選んだ BC N 件を出走済み | 残レースが全件いずれかのパターンに収録される |

#### `unit/race/race-pattern.realdata.spec.ts`（35 件）

対象: `src/race/pattern/race-pattern.service.ts`（実 JSON データを使った結合テスト・全レース未走前提）

対象ウマ娘 7 体（スペシャルウィーク / ハルウララ / サクラバクシンオー / ホッコータルマエ / キングヘイロー / ジェンティルドンナ / アーモンドアイ）それぞれに以下 5 件を実行する。

| テストケース |
|---|
| パターン生成がエラーなく完了する |
| 1件以上のパターンが生成される |
| 各パターンは必須フィールドを持つ（scenario / factors 6 枚 / totalRaces > 0） |
| BC パターンに BC 最終レースが配置されている |
| 通常割り当てレースに適性D未満（E/F/G）の馬場・距離が含まれない |

---

### seed

#### `unit/seed/seed.service.spec.ts`（14 件）

対象: `src/seed/seed.service.ts`

| 対象 | テストケース |
|---|---|
| `onModuleInit` | 3つの upsert メソッドを順番に呼び出す |
| `upsertRaces` | DB に存在しない新規レースのみ createMany に渡す |
| `upsertRaces` | 全レースが既に存在する場合 → createMany を呼ばない |
| `upsertUmamusume` | DB に存在しない新規ウマ娘のみ createMany に渡す |
| `upsertScenarioRaces` | 形式A（文字列）: レース名からレコードを生成する |
| `upsertScenarioRaces` | 形式B（名前付き・シニア）: senior_flag が true になる |
| `upsertScenarioRaces` | 形式B（名前付き・クラシック）: senior_flag が false になる |
| `upsertScenarioRaces` | 形式B（名前付き・時期なし）: senior_flag が null になる |
| `upsertScenarioRaces` | 形式C/D（ネスト選択肢）: random_group が設定される |
| `upsertScenarioRaces` | レース名がマスタに存在しない場合 → warn ログを出力してスキップする |
| `upsertScenarioRaces` | ウマ娘がマスタに存在しない場合 → warn ログを出力してスキップする |
| `upsertScenarioRaces` | 既にシナリオ登録済みのウマ娘 → スキップする |
| `loadJsonFile` | ファイル読み込み失敗時に DatabaseException をスローする |
| `batchInsert` | DB 投入失敗時に DatabaseException をスローする |

---

### umamusume

#### `unit/umamusume/umamusume.mapper.spec.ts`（4 件）

対象: `src/umamusume/umamusume.mapper.ts`

| 関数 | テストケース |
|---|---|
| `toUmamusumeResponse` | Prisma の snake_case フィールドを camelCase に変換する |
| `toUmamusumeResponse` | レスポンスに Prisma 固有のフィールドが含まれない |
| `toRegisteredUmamusumeResponse` | umamusume リレーションを UmamusumeResponse に変換してラップする |
| `toRegisteredUmamusumeResponse` | レスポンスが RegisteredUmamusumeResponse の構造に一致する |

#### `unit/umamusume/umamusume.service.spec.ts`（15 件）

対象: `src/umamusume/umamusume.service.ts`

| メソッド | テストケース |
|---|---|
| `findAll` | 全ウマ娘を UmamusumeResponse に変換して返す |
| `findAll` | Prisma エラー時に handlePrismaError 経由で例外をスローする |
| `findUnregistered` | 登録済みウマ娘が存在しない場合 → notIn: [] で findMany を呼ぶ |
| `findUnregistered` | 登録済みウマ娘が存在する場合 → notIn フィルタ付きで findMany を呼ぶ |
| `findUnregistered` | Prisma エラー時に例外をスローする |
| `findRegistered` | 登録済みウマ娘を RegisteredUmamusumeResponse に変換して返す |
| `findRegistered` | 登録済みウマ娘が存在しない場合 → 空配列を返す |
| `unregister` | $transaction でレース削除とウマ娘削除を一括実行する |
| `unregister` | void を返す（レスポンスボディなし） |
| `unregister` | ログに userId と umamusumeId が含まれる |
| `unregister` | Prisma エラー時に例外をスローする |
| `register` | レースIDなしで登録する場合 → $transaction 内で create のみ呼ぶ |
| `register` | レースIDありで登録する場合 → $transaction 内で create と createMany を呼ぶ |
| `register` | UmamusumeResponse 形式で結果を返す |
| `register` | 重複登録時に ConflictException をスローする |

---

## E2E テスト

実行: `npm run -w backend test:e2e`（カバレッジ計測・品質ゲートの対象外）

#### `e2e/auth.e2e-spec.ts`（5 件）

対象: `src/common/guards/auth.guard.ts`（実 NestJS アプリ + モック Cognito）

| エンドポイント | テストケース |
|---|---|
| `GET /races/remaining`（認証必須） | Authorization ヘッダーなし → 401 を返す |
| `GET /races/remaining`（認証必須） | 無効なトークン → 401 を返す |
| `GET /races/remaining`（認証必須） | 有効なトークン → 200 を返す |
| `GET /races/remaining`（認証必須） | "Bearer " プレフィックスなしのトークン → 401 を返す |
| `GET /races`（`@Public()`） | Authorization ヘッダーなしでも 200 を返す |

#### `e2e/race.e2e-spec.ts`（12 件）

対象: `src/race/race.controller.ts`（実 NestJS アプリ + MockAuthGuard）

| エンドポイント | テストケース |
|---|---|
| `GET /races` | 200 を返し、getRaceList を呼ぶ |
| `GET /races` | state・distance クエリパラメータをサービスに渡す |
| `GET /races/registration-targets` | 200 を返し、getRegistRaceList を呼ぶ |
| `GET /races/remaining` | 200 を返し、認証済みユーザーIDで getRemaining を呼ぶ |
| `GET /races/remaining/search` | 200 を返し、クエリパラメータをサービスに渡す |
| `GET /races/run/:umamusumeId` | 200 を返し、認証済みユーザーIDと umamusumeId で getRunRaces を呼ぶ |
| `GET /races/run/:umamusumeId` | umamusumeId が数値でない場合 → 400 を返す |
| `DELETE /races/run` | 200 を返し、認証済みユーザーIDと body で cancelRunRaces を呼ぶ |
| `POST /races/run` | 200 を返し、raceRun を呼ぶ |
| `POST /races/results` | 200 を返し、registerOne を呼ぶ |
| `POST /races/results/batch` | 200 を返し、registerPattern を呼ぶ |
| `GET /races/patterns/:umamusumeId` | 200 を返し、getRacePattern を呼ぶ |

#### `e2e/umamusume.e2e-spec.ts`（7 件）

対象: `src/umamusume/umamusume.controller.ts`（実 NestJS アプリ + MockAuthGuard）

| エンドポイント | テストケース |
|---|---|
| `GET /umamusumes` | 200 を返し、全ウマ娘一覧を返す |
| `GET /umamusumes/unregistered` | 200 を返し、認証済みユーザーIDで findUnregistered を呼ぶ |
| `GET /umamusumes/registered` | 200 を返し、認証済みユーザーIDで findRegistered を呼ぶ |
| `DELETE /umamusumes/registrations/:umamusumeId` | 200 を返し、認証済みユーザーIDと umamusumeId で unregister を呼ぶ |
| `DELETE /umamusumes/registrations/:umamusumeId` | umamusumeId が数値でない場合 → 400 を返す |
| `POST /umamusumes/registrations` | 201 を返し、register を呼んで登録メッセージを返す |
| `POST /umamusumes/registrations` | raceIdArray が空の場合でも 201 を返す |

---

## テスト未作成のソース

[テスト規約](../prompts/coding-convention/backend/testing.md) の「ファイルタイプ別テスト要否」で不要としているもの（controller / module / constant 等）を除き、専用の spec ファイルがないソースです。

| ソース | 状況 |
|---|---|
| `src/race/pattern/bc-pattern-builder.service.ts` | `race-pattern.*.spec.ts` 経由で間接的に検証 |
| `src/race/pattern/larc-pattern-builder.service.ts` | `race-pattern.*.spec.ts` 経由で間接的に検証（分岐網羅率が低い） |
| `src/common/prisma/prisma.service.ts` | 未検証（DB 接続ライフサイクルのみ） |
