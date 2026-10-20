# フロントエンド テストケース一覧

`frontend/test/unit/` 配下のテストケースをファイル単位でまとめた一覧です。
テスト方針・カバレッジの品質ゲートは [testing.md](testing.md) を参照してください。

> テストを追加・変更したときは、この一覧も同じコミットで更新してください。

## サマリー

| 種別 | ファイル数 | テスト数 |
|---|---:|---:|
| 単体テスト（`test/unit/`） | 8 | 111 |

## 目次

- [core](#core)
- [shared](#shared)
- [テスト未作成のソース](#テスト未作成のソース)

---

## core

#### `core/guards/auth.guard.spec.ts`（3 件）

対象: `src/app/core/guards/auth.guard.ts`

| 条件 | テストケース |
|---|---|
| ログイン済み | true を返す（ルートへのアクセスを許可） |
| 未ログイン | UrlTree を返す（リダイレクト） |
| 未ログイン | /login へのリダイレクト UrlTree を返す |

#### `core/interceptors/auth.interceptor.spec.ts`（4 件）

対象: `src/app/core/interceptors/auth.interceptor.ts`

| 条件 | テストケース |
|---|---|
| トークンが存在する | Authorization: Bearer &lt;token&gt; ヘッダーを付与してリクエストを渡す |
| トークンが存在する | 元のリクエストは変更せず、クローンにヘッダーを付与する |
| トークンが null | Authorization ヘッダーを付与せず元のリクエストをそのまま渡す |
| getToken の呼び出し | リクエストごとに getFreshToken を呼ぶ |

#### `core/services/auth.service.spec.ts`（28 件）

対象: `src/app/core/services/auth.service.ts`

| 対象 | テストケース |
|---|---|
| 初期状態 | トークンが null であること |
| 初期状態 | isLoggedIn が false であること |
| セッション復元 | Cognito に現在ユーザーがいない場合はトークンが設定されない |
| セッション復元 | セッションが有効な場合はトークンが設定される |
| セッション復元 | セッションが無効な場合はトークンが設定されない |
| セッション復元 | getSession がエラーを返した場合はトークンが設定されない |
| セッション復元 | Cognito ユーザーがいない場合は isInitialized が true になる |
| セッション復元 | セッション復元が完了したら isInitialized が true になる |
| `login` | 認証成功時に success: true を返し、トークンを設定する |
| `login` | 認証失敗時に success: false と error メッセージを返す |
| `signUp` | 登録成功時に success: true を返す |
| `signUp` | 登録失敗時に success: false と error メッセージを返す |
| `confirmSignUp` | 確認成功時に success: true を返す |
| `confirmSignUp` | 確認失敗時に success: false と error メッセージを返す |
| `logout` | トークンをクリアして isLoggedIn が false になる |
| `logout` | Cognito ユーザーがいない状態でも正常に logout できる |
| `getToken` | ログイン前は null を返す |
| `getToken` | ログイン後はトークン文字列を返す |
| `forgotPassword` | 送信成功時に success: true を返す |
| `forgotPassword` | 送信失敗時に success: false と error メッセージを返す |
| `confirmForgotPassword` | パスワードリセット成功時に success: true を返す |
| `confirmForgotPassword` | パスワードリセット失敗時に success: false と error メッセージを返す |
| `resendConfirmationCode` | 再送成功時に success: true を返す |
| `resendConfirmationCode` | 再送失敗時に success: false と error メッセージを返す |
| `getFreshToken` | Cognito ユーザーがいない場合は null を返す |
| `getFreshToken` | セッションが有効な場合はトークンを返し tokenSignal も更新する |
| `getFreshToken` | セッションが無効な場合は null を返し tokenSignal をクリアする |
| `getFreshToken` | getSession がエラーを返した場合は null を返し tokenSignal をクリアする |

#### `core/services/character.service.spec.ts`（6 件）

対象: `src/app/core/services/character.service.ts`

| メソッド | テストケース |
|---|---|
| `getUnregisteredUmamusumes` | 未登録ウマ娘の一覧を返す |
| `getUnregisteredUmamusumes` | API エラー時にエラーを伝播する |
| `getRegisteredUmamusumes` | 登録済みウマ娘の一覧を返す |
| `getRegisteredUmamusumes` | API エラー時にエラーを伝播する |
| `registerCharacter` | 正しいリクエストボディで POST する |
| `registerCharacter` | API エラー時にエラーを伝播する |

#### `core/services/race.service.spec.ts`（13 件）

対象: `src/app/core/services/race.service.ts`

| メソッド | テストケース |
|---|---|
| `getRaces` | フィルタなしでレース一覧を取得する |
| `getRaces` | 馬場・距離フィルタ付きでレース一覧を取得する |
| `getRaces` | API エラー時にエラーを伝播する |
| `getRegistrationTargets` | 登録用レース一覧を取得する |
| `getRegistrationTargets` | API エラー時にエラーを伝播する |
| `getRemainingRaces` | 残レース情報の一覧を取得する |
| `getRemainingRaces` | API エラー時にエラーを伝播する |
| `getPatterns` | 指定ウマ娘のパターンを取得する |
| `getPatterns` | API エラー時にエラーを伝播する |
| `registerBatchResults` | 全レースを一括登録する |
| `registerBatchResults` | API エラー時にエラーを伝播する |
| `registerOneResult` | 1件のレースを登録する |
| `registerOneResult` | API エラー時にエラーを伝播する |

---

## shared

#### `shared/components/toast/toast.service.spec.ts`（12 件）

対象: `src/app/shared/components/toast/toast.service.ts`

| 対象 | テストケース |
|---|---|
| 初期状態 | isVisible が false であること |
| 初期状態 | message が空文字であること |
| `show` | メッセージが設定され isVisible が true になる |
| `show` | デフォルトの type は success |
| `show` | type に error を指定できる |
| `show` | 3秒後に isVisible が false になる |
| `show` | 3秒未満では isVisible が true のまま |
| `show` | show を連続呼び出すとタイマーがリセットされる |
| `showSessionExpired` | persistent な error トーストを表示する |
| `showSessionExpired` | persistent トーストが既に表示中の場合は何もしない（重複防止） |
| `showSessionExpired` | 通常トーストが表示中の場合は上書きする |
| `showSessionExpired` | show() のタイマーをキャンセルし、3 秒後も表示され続ける |

#### `shared/utils/color-mapper.spec.ts`（30 件）

対象: `src/app/shared/utils/color-mapper.ts`

| 関数 | テストケース |
|---|---|
| `gradeBg` | 1(G1) → amber グラデーションを返す |
| `gradeBg` | 2(G2) → slate グラデーションを返す |
| `gradeBg` | 3(G3) → orange グラデーションを返す |
| `gradeBg` | 未定義の値は gray グラデーションを返す |
| `gradeBadge` | 1(G1) → amber バッジを返す |
| `gradeBadge` | 2(G2) → slate バッジを返す |
| `gradeBadge` | 3(G3) → orange バッジを返す |
| `gradeBadge` | 未定義の値は gray バッジを返す |
| `gradeColor` | 適性 S〜G → amber / rose / orange / lime / cyan / indigo / slate / gray-400 を含むクラスを返す（8 件のパラメータ化テスト） |
| `gradeColor` | 未定義の値は gray-300 を返す |
| `getDistanceBgColor` | 1(短距離) → pink を返す |
| `getDistanceBgColor` | 2(マイル) → green を返す |
| `getDistanceBgColor` | 3(中距離) → yellow を返す |
| `getDistanceBgColor` | 4(長距離) → blue を返す |
| `getDistanceBgColor` | 未定義の値は gray を返す |
| `getSurfaceBgColor` | 0(芝) → lime を返す |
| `getSurfaceBgColor` | 1(ダート) → amber を返す |
| `getRaceCountClass` | 0 → yellow（全冠色）を返す |
| `getRaceCountClass` | 1 → green を返す |
| `getRaceCountClass` | 2 → green を返す |
| `getRaceCountClass` | 3以上 → red を返す |
| `getRaceCountDisplay` | 0 → 王冠絵文字を返す |
| `getRaceCountDisplay` | 1以上 → 数値文字列を返す |

#### `shared/utils/race-formatter.spec.ts`（15 件）

対象: `src/app/shared/utils/race-formatter.ts`

| 関数 | テストケース |
|---|---|
| `getRaceRank` | 1 → GI を返す |
| `getRaceRank` | 2 → GII を返す |
| `getRaceRank` | 3 → GIII を返す |
| `getRaceRank` | 未定義の値は空文字を返す |
| `getDistanceLabel` | 1 → 短距離 を返す |
| `getDistanceLabel` | 2 → マイル を返す |
| `getDistanceLabel` | 3 → 中距離 を返す |
| `getDistanceLabel` | 4 → 長距離 を返す |
| `getDistanceLabel` | 未定義の値は空文字を返す |
| `getRunSeason` | 全フラグ OFF のとき空文字を返す |
| `getRunSeason` | ジュニアのみのとき "ジュニア" を返す |
| `getRunSeason` | 全フラグ ON のとき "ジュニア / クラシック / シニア" を返す |
| `getRunSeason` | クラシック・シニアのとき "クラシック / シニア" を返す |
| `getRunSeason` | クラシックのみのとき "クラシック" を返す |
| `getRunSeason` | シニアのみのとき "シニア" を返す |

---

## テスト未作成のソース

spec ファイルが存在しないソースです。Vitest のカバレッジはテストから読み込まれたファイルだけを計測するため、
**以下のファイルは現在のカバレッジ率の分母に含まれていません**。

| ソース | 種別 |
|---|---|
| `src/app/app.ts` | ルートコンポーネント |
| `src/app/core/services/navigation.service.ts` | サービス（画面遷移） |
| `src/app/features/auth/forgot-password/forgot-password.ts` | 画面コンポーネント |
| `src/app/features/auth/login/login.ts` | 画面コンポーネント |
| `src/app/features/auth/register/register.ts` | 画面コンポーネント |
| `src/app/features/character-list/character-list.ts` | 画面コンポーネント |
| `src/app/features/character-regist/character-regist.ts` | 画面コンポーネント |
| `src/app/features/landing/landing.ts` | 画面コンポーネント |
| `src/app/features/race-cancel/race-cancel.ts` | 画面コンポーネント |
| `src/app/features/race-list/race-list.ts` | 画面コンポーネント |
| `src/app/features/remaining-race/remaining-race-list.ts` | 画面コンポーネント |
| `src/app/features/remaining-race/remaining-race-pattern.ts` | 画面コンポーネント |
| `src/app/shared/components/aptitude-badge/aptitude-badge.ts` | 共通コンポーネント |
| `src/app/shared/components/sidebar/sidebar.ts` | 共通コンポーネント |
| `src/app/shared/components/toast/toast.ts` | 共通コンポーネント（ロジックは `toast.service.ts` で検証済み） |
