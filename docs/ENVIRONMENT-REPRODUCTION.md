# StudyDrill（study-deck）環境再現ガイド

別のPC・別のアカウント・別のホスティング先で、このアプリを**同じ状態で動かす／作り直す**ための資料。
このファイルだけで「動かす → 変更点を直す → 公開する」まで到達できることを目的とする。

- 対象リポジトリ: `tcta-tottori/study-deck`
- アプリ名: StudyDrill（ビジネス・キャリア検定「生産管理プランニング3級」学習PWA）
- 公開先（現行）: https://tcta-tottori.github.io/study-deck/
- 関連ドキュメント: [`README.md`](../README.md)（利用者向け） / [`seisan-quiz-SPEC.md`](../seisan-quiz-SPEC.md)（当初の開発仕様書）

---

## 1. アプリの性質（再現時に効く前提）

| 項目 | 内容 |
|---|---|
| 形態 | クライアントのみのSPA（PWA）。**サーバサイド／バックエンドは存在しない** |
| データ保存先 | ブラウザの **IndexedDB のみ**（Dexie 経由）。サーバへ送信しない |
| 認証 | なし（ユーザーアカウントの概念なし） |
| 外部通信 | 原則ゼロ。例外は**任意機能のAI解説**（各自のAnthropic APIキーでブラウザから直接呼ぶ）とAIチャットを外部サイトで開くリンクのみ |
| 環境変数 | **なし**（`.env` 不要。ビルド時定数 `__BUILD_TIME__` のみ `vite.config.ts` で注入） |
| シークレット | **リポジトリに不要**。デプロイは `GITHUB_TOKEN`（Actions自動発行）だけで完結 |
| 問題データ | 公式過去問は著作物のためリポジトリに含めない。利用者が端末で取り込む |

つまり「再現」とは、**静的ファイルをビルドして配信できる状態にすること**とほぼ同義。DBサーバやAPIサーバの構築は不要。

---

## 2. 必要な環境

| ソフト | 検証済みバージョン | 備考 |
|---|---|---|
| Node.js | v22.22.2 | CIは Node 20 を使用（`.github/workflows/deploy.yml`）。20以上であれば可 |
| npm | 10.9.7 | `package-lock.json` があるので `npm ci` を推奨 |
| Git | 任意 | |
| Python 3 + pdfplumber | 任意 | 過去問PDF変換ツール `tools/convert_javada_pdf.py` を使う場合のみ |

ブラウザ要件: IndexedDB / Service Worker が動く現行ブラウザ。PWAとして使う場合は iOS Safari・Android Chrome を想定。

---

## 3. ローカルで動かす（最短手順）

```bash
git clone https://github.com/tcta-tottori/study-deck.git
cd study-deck
npm ci                # または npm install
npm run dev           # 開発サーバ（既定 http://localhost:5173/study-deck/）
```

その他のスクリプト（`package.json`）:

```bash
npm run build     # tsc -b（型チェック）→ vite build。成果物は dist/
npm run preview   # dist/ をローカル配信して本番同等の確認
npm run lint      # tsc -b --noEmit（型チェックのみ。ESLintは未導入）
```

**注意**: `vite.config.ts` の `base: '/study-deck/'` により、開発サーバでもURLは `http://localhost:5173/study-deck/` になる。ルート `/` を開くと404になるので、必ずサブパス付きで開くこと。

### 動作確認済みの実行ログ（2026-09 時点）

```
npm ci        → exit 0
npm run build → exit 0
  dist/index.html                 7.70 kB
  dist/assets/index-*.css        37.27 kB
  dist/assets/index-*.js        376.17 kB (gzip 121.81 kB)
  PWA v0.21.2 / generateSW / precache 15 entries (486.83 KiB) → dist/sw.js
```

---

## 4. 別環境へ移すときに**必ず直す箇所**

配信URLが `https://<user>.github.io/study-deck/` から変わる場合、パスがハードコードされている以下を揃える。3か所ずれると「真っ白」「アイコンが出ない」「PWAが更新されない」になる。

| # | ファイル | 箇所 | 現在の値 |
|---|---|---|---|
| 1 | `vite.config.ts` | `base` | `'/study-deck/'` |
| 2 | `vite.config.ts` | `manifest.start_url` / `manifest.scope` | `'/study-deck/'` |
| 3 | `vite.config.ts` | `workbox.navigateFallback` | `'/study-deck/index.html'` |
| 4 | `index.html` | `<link rel="icon">` ×2、`apple-touch-icon` の `href` | `/study-deck/favicon-*.png` 等 |

### ケース別の設定値

- **別リポジトリ名でGitHub Pages**（例 `my-study`）: 上記すべての `/study-deck/` を `/my-study/` に置換。
- **独自ドメイン or Netlify/Vercel/Cloudflare Pages のルート配信**: すべて `/` に置換（`base: '/'`、`start_url: '/'`、`scope: '/'`、`navigateFallback: '/index.html'`、`index.html` の href は `/favicon-48.png` 等）。SPAなので追加のリライト設定は不要（ルーティングはURLを使わない状態遷移方式）。
- **社内サーバのサブディレクトリ配信**: そのサブパスに合わせて同様に置換。配信元は静的ファイルをそのまま返せれば何でもよい（Nginx/Apache/S3等）。

置換の一括実行例:

```bash
# /study-deck/ → /my-study/ に変更する場合
grep -rl '/study-deck/' index.html vite.config.ts | xargs sed -i 's#/study-deck/#/my-study/#g'
npm run build
```

### リポジトリ名を変えたときのもう1点

`vite.config.ts` の `manifest.name` / `short_name`（`StudyDrill`）、`index.html` の `<title>`、Dexieのデータベース名 `study-deck`（`src/db/db.ts` の `super('study-deck')`）はURLとは独立。**DB名を変えると既存端末の学習データが見えなくなる**ため、同じ利用者の環境を引き継ぐ場合は変更しないこと。

---

## 5. GitHub Pages への公開手順（現行方式の再現）

ワークフロー: `.github/workflows/deploy.yml`

1. `main` への push（または手動 `workflow_dispatch`）で起動。
2. `actions/checkout` → `actions/setup-node@v4`（Node 20, npm キャッシュ）→ `npm ci` → `npm run build`。
3. `dist/.nojekyll` を作成（`_` 始まりファイルがJekyllに無視されるのを防ぐ）。
4. `dist/` を新規gitリポジトリとして初期化し、**`gh-pages` ブランチへ force push**（`deploy-pages` API は使わない方式）。
5. 認証は `secrets.GITHUB_TOKEN`（Actions が自動発行）。**追加のシークレット登録は不要**。`permissions: contents: write` が必要。

移設先リポジトリでの設定:

- Settings → Actions → General → Workflow permissions を **Read and write** にする（`permissions: contents: write` が効く前提）。
- Settings → Pages → Source を **Deploy from a branch → `gh-pages` / `(root)`** にする。
- 初回は `main` に push するか、Actions タブから `Deploy to GitHub Pages` を手動実行する。

GitHub Pages を使わない場合は、`npm run build` の `dist/` をそのまま任意の静的ホスティングへ配置すればよい（ワークフローは削除可）。

---

## 6. ディレクトリ構成と役割

```
study-deck/
├─ index.html                  エントリHTML。テーマ即時適用スクリプト＋起動ローダー(#boot)をインラインで持つ
├─ vite.config.ts              base / PWA manifest / workbox / __BUILD_TIME__ 定義
├─ package.json                依存とスクリプト
├─ tsconfig*.json              tsconfig.json（参照のみ）/ app（src）/ node（vite.config.ts）
├─ .github/workflows/deploy.yml  gh-pages への自動デプロイ
├─ public/                     PWAアイコン（pwa-192/512, favicon-32/48, apple-touch-icon）
├─ tools/convert_javada_pdf.py 公式PDF → 取込用JSON/CSV 変換（ローカル実行専用）
├─ seisan-quiz-SPEC.md         当初の開発仕様書（設計意図の一次資料）
└─ src/
   ├─ main.tsx                 起動（SW登録 → 起動時マイグレーション → React マウント）
   ├─ App.tsx                  画面切替・テーマ・ナビ・起動ローダー制御・リマインダ起動
   ├─ styles.css               全スタイル（約2,600行。CSS変数でライト/ダーク）
   ├─ types.ts                 Category / Question / StudyRecord / ExamResult / ExamProgress / AppSettings
   ├─ db/
   │   ├─ db.ts                Dexieスキーマ、既定設定、設定入出力、中断中試験の保存
   │   ├─ seed.ts              起動時の一度きりマイグレーション群
   │   └─ importQuestions.ts   CSV/JSON取込・バリデーション・CSVパーサ・公式問題リセット
   ├─ srs/srs.ts               Leitner法と出題キュー構築
   ├─ lib/
   │   ├─ study.ts             1問ごとの回答保存（SRS＋日次活動）、メモ／AI解説保存
   │   ├─ exam.ts              回（年度・前後期）の抽出、分野バランス抽出、出典ラベル
   │   ├─ stats.ts             カテゴリ別正答率・box分布・合格見込み
   │   ├─ backup.ts            学習データのJSONバックアップ／復元
   │   ├─ reminder.ts          1日1回のローカル通知（未対応環境はバナーへフォールバック）
   │   ├─ dateutil.ts          日付キー・ストリーク・残日数・時間整形
   │   ├─ categoryMap.ts       旧14分類→新7分類の変換、カテゴリ色
   │   ├─ subjects.ts          科目（試験）定義
   │   ├─ ai.ts                Anthropic API 直接呼び出しによる解説生成
   │   └─ askAi.ts             外部AIへ渡すプロンプト生成とURL組み立て、クリップボード
   ├─ hooks/useAppData.ts      Dexie useLiveQuery のラッパ（settings/questions/records/activity/examResults/今日の進捗）
   ├─ screens/                 Home / Quiz / Exam / Dashboard / Import / Settings / ExamHistory
   ├─ components/              Icon, BrandIcon, Toast, Loading, Reveal, BackHome, AiAsk, ChoiceReasons, ExamReview
   └─ data/questions.seed.json 旧同梱練習問題（※現在はコードから参照されていない。第12章参照）
```

画面遷移は React の `useState`（`App.tsx` の `View`）で管理し、**ルーターは使っていない**。URLは常に `base` 直下のまま変わらない。

---

## 7. データモデル（IndexedDB）

Dexie データベース名: **`study-deck`**（`src/db/db.ts`）

```ts
version(1).stores({
  questions:     'id, origin, category',
  studyRecords:  'questionId, box, dueAt, lastAnswered',
  examResults:   '++id, takenAt',
  settings:      'key',
  activity:      'day',
})
version(2).stores({
  examProgress:  'id',   // 中断中の本番シミュレーション（'current' の1件のみ）
})
```

主な型（`src/types.ts`）:

```ts
type Category =
  | '製品企画・設計管理' | '生産システム・生産計画' | '品質管理'
  | '原価管理' | '納期管理' | '安全衛生管理' | '環境管理'   // JAVADA試験範囲の7分類

interface Question {
  id: string                  // 例 "OFF-R07L-0001"
  origin: 'official' | 'original'
  category: Category
  subcategory?: string
  stem: string
  choices: [string, string, string, string]
  answerIndex: 0 | 1 | 2 | 3
  explanation: string
  choiceReasons?: [string, string, string, string]  // 選択肢ごとの○×理由（任意）
  source?: string
  aiExplanation?: string      // 後から生成・手入力した補足解説
  note?: string               // 誤答ノート
}

interface StudyRecord {
  questionId: string
  box: 1 | 2 | 3 | 4 | 5      // Leitner箱（1=苦手, 5=定着）
  dueAt: number               // 次回出題予定 epoch ms
  lastAnswered: number
  correctCount: number
  wrongCount: number
  lastWrongChoice?: 0 | 1 | 2 | 3
}

interface DayActivity { day: string /* 'YYYY-MM-DD' */; count: number; correct: number }

interface ExamResult {
  id?: number; takenAt: number; total: number; correct: number
  score: number /* 100点換算 */; passed: boolean; durationSec: number
  byCategory: Record<string, { correct: number; total: number }>
  questionIds: string[]; answers: number[]; label?: string
}

interface ExamProgress {
  id: 'current'; label: string; questionIds: string[]; answers: number[]
  cur: number; elapsedSec: number; durationSec: number; savedAt: number
}
```

### 設定の既定値（`DEFAULT_SETTINGS`）

| キー | 既定値 | 意味 |
|---|---|---|
| `subjectId` | `'seisan-kanri-planning-3'` | 学習科目（`src/lib/subjects.ts`） |
| `dailyGoal` | `20` | 1日の目標問題数 |
| `interleave` | `true` | 分野横断出題 |
| `examDurationSec` | `110 * 60` | 本番シミュレーションの制限時間（暫定110分） |
| `examDate` | `'2026-10-04'` | 試験日（ホームのカウントダウン） |
| `landscape` | `false` | 横画面モード（UIを回転） |
| `theme` | `'light'` | `auto` / `light` / `dark` |
| `reminderTime` | 未設定 | `'HH:MM'` |
| `anthropicApiKey` | 未設定 | 端末ローカルのみ。バックアップにも含めない |
| `seedVersion` | `0` | 旧シード管理の名残 |

### localStorage に置いているキー（IndexedDB外）

| キー | 用途 |
|---|---|
| `sd-theme` | 起動ローダーの配色を即決めるためのテーマ保存（`auto`/`light`/`dark`） |
| `originals-abolished-v1` | 同梱オリジナル問題の削除マイグレーション実行済みフラグ |
| `theme-base-migrated-v1` | 既定テーマを `auto`→`light` に寄せた実行済みフラグ |
| `cat-migrated-v1` | 旧14分類→新7分類のカテゴリ正規化の実行済みフラグ |
| `reminder-shown-day` | その日リマインドを出したかどうか |

**再現時の注意**: これらは端末ローカル。新環境では初回起動時に全マイグレーションが1回走る（データが無いので実質no-op）。

---

## 8. ロジック仕様（移植時に落とせない中核）

### 8.1 SRS（`src/srs/srs.ts`）

- Leitner方式。正解 → `box+1`（最大5）、`dueAt = now + 間隔[box]`。
- 不正解 → `box = 1`、`dueAt = now + 10分`（`RELEARN_STEP`。直後の即再登場を防ぎつつ同日中に復習）。
- 間隔 `BOX_INTERVALS`: box1=0（即日）/ box2=1日 / box3=3日 / box4=7日 / box5=14日。

### 8.2 出題キュー `buildQueue`

1. **その日すでに解いた問題は出さない**（`lastAnswered >= 当日0時` を除外。中断→再開で同じ問題が出ない）。
2. **未学習を最優先**で、7ジャンルを均等に回して出す（`balanceByCategory` による重み付きラウンドロビン）。
3. 未学習が尽きたら、**前日以前に学習し `dueAt <= now` のもの**を同じくジャンル均等で補完。
4. カテゴリ優先度は「正答率が低い・回答数が少ない」ほど先（`categoryPriority`）。
5. `wrongOnly`（間違いだけモード）は box1・2 のみを box昇順→dueAt古い順で出し、当日除外しない。
6. `questionIds` 指定時（試験結果からの復習など）はその集合を出題順のまま返す。

### 8.3 本番シミュレーション（`src/screens/Exam.tsx` / `src/lib/exam.ts`）

- 40問（`EXAM_N`）、1問2.5点の100点満点、**24問＝60点で合格**（`PASS_RATIO = 0.6`）。
- 出題は「全分野バランス（`pickBalanced`）」または「回ごと（年度・前後期）」を選択。
- 公式IDの規約 `OFF-R{YY}{E|L}-{NNNN}`（E=前期 / L=後期）から受験可能な回を自動抽出（`parseSessionKey` / `listSessions`）。出典表示は `令和7年度 後期 問15` 形式（`questionSourceLabel`）。
- 試験中は正誤非表示。中断すると `examProgress`（1件）へ保存し「続きから再開」可能。提出・破棄でクリア。
- 提出後: 得点・合否・所要時間・カテゴリ別内訳・誤答の見直し。結果は `examResults` に保存しダッシュボードで推移表示（合格ライン60点の基準線つき）。

### 8.4 集計（`src/lib/stats.ts` / `src/lib/dateutil.ts`）

- カテゴリ別正答率は `correct/(correct+wrong)`、未回答は分母に含めない。
- box分布は index0=未学習、1..5=各box。
- ストリークは `activity` の日付集合から連続日数を算出（今日が0問でも昨日までの連続は維持）。

### 8.5 バックアップ／復元（`src/lib/backup.ts`）

- 形式: `{ app:'studydrill', kind:'studydrill-learning-data', version:1, exportedAt, studyRecords, activity, examResults, settings, notes }`。
- ファイル名: `studydrill-backup-YYYYMMDD-HHmm.json`。
- **含めないもの**: 問題本文（著作物）、`anthropicApiKey`。
- 復元は studyRecords / activity / examResults を**置き換え**、設定はマージ、メモとAI解説は該当問題が取込済みの場合のみ適用（未取込は `notesPending` として件数返却）。
- 機種変更時の手順は「① 旧端末でバックアップ書き出し → ② 新端末で公式問題を取込 → ③ バックアップ復元」。

### 8.6 テーマ・PWA更新まわり（移植時に壊しやすい）

- `index.html` のインラインスクリプトが `localStorage['sd-theme']` を読み、Reactが走る前に `data-theme` を付ける（ダーク時のちらつき防止）。
- 起動ローダー `#boot` は `index.html` に直書き。初期データが揃い、かつ最低2秒表示してからフェードアウト（保険で15秒後に強制表示）。
- PWAは `registerType: 'autoUpdate'`（skipWaiting + clientsClaim）。更新検知時は `sw-updating` イベントでローダーを再表示し、リロードの二重ローディングを隠す。`prompt` に変えると旧キャッシュで固定される問題が出るため、意図的に自動更新にしている。

---

## 9. 問題データの投入（アプリを"使える状態"にする最後の一手）

ビルドしただけでは問題が0件。**公式過去問（JAVADA）は著作物なのでリポジトリに含めない**方針で、各自が端末に取り込む。

### 9.1 取込フォーマット

CSV列（`CSV_TEMPLATE`）:

```
id,category,subcategory,stem,choice1,choice2,choice3,choice4,answerIndex,explanation,source
```

- `answerIndex` は 0〜3（1〜4表記は自動で -1 補正）。
- `category` は7分類の値。旧14分類（`共通_品質管理`, `PLN_生産方式` など）は `normalizeCategory` が自動変換。
- CSVパーサは自前実装（ダブルクォート・改行・カンマ対応、RFC4180風）。ヘッダ行は `id` と `stem` を含むかで自動判定。
- CSV経由の取込は `origin: 'official'` 固定。JSONは `origin` を指定でき、`original` 以外は `official` 扱い。

JSON（`choiceReasons` 付きの例）:

```json
{
  "id": "OFF-R07L-01",
  "origin": "official",
  "category": "生産システム・生産計画",
  "subcategory": "管理のサイクル",
  "stem": "…（問題文）…",
  "choices": ["PDS", "PDCA", "QCD", "SDCA"],
  "answerIndex": 3,
  "explanation": "SDCA は標準（S）を起点に維持・定着を回すサイクルで、標準化を含む。",
  "choiceReasons": ["…", "…", "…", "…"],
  "source": "令和7年度 後期 生産管理プランニング3級 問1"
}
```

バリデーション（`validateQuestion`）: id必須・重複不可、category必須（正規化できること）、stem非空、choicesは文字列4つ、answerIndexは0〜3、`choiceReasons` は文字列4つの配列のときのみ採用。既存IDは上書き更新するが、**`note` と `aiExplanation` は保持**される。

### 9.2 PDF変換ツール

```bash
pip install pdfplumber
# 1) 問題PDFから雛形（answerIndex は -1 のまま）
python tools/convert_javada_pdf.py r07l041b01x.pdf --prefix OFF-R07L -o questions.R07L.json
# 2) 解答PDFを見て answers.csv（id,answerIndex[1-4]）を用意して流し込む
python tools/convert_javada_pdf.py r07l041b01x.pdf --prefix OFF-R07L \
       --answers answers_r07l.csv -o questions.R07L.json --csv questions.R07L.csv
```

透かし（禁転載複製）やページ識別子は除去されるが、計算式・穴埋め表・ルビを含む問題は抽出が乱れるため**目視修正が前提**。

### 9.3 著作権上の扱い（再現時も必ず踏襲）

- 公式問題は「禁転載複製」。**個人学習の範囲でのみ使用し、公開コードに埋め込まない**。
- `.gitignore` に `src/data/questions.official*.json` / `questions.official*.json` / `questions.R*.json` / `*.pdf` を登録済み。移植先でも同じ除外を維持すること。
- 取込データは端末のIndexedDBにのみ保存。取込画面から「取込データのリセット」（問題だけ削除・学習履歴は保持）が可能。

---

## 10. AI解説（任意機能）を有効にする場合

2系統ある。どちらも使わなくてもアプリは完全動作する。

1. **アプリ内生成**（`src/lib/ai.ts`）: 設定画面で各自のAnthropic APIキーを登録すると、`https://api.anthropic.com/v1/messages` をブラウザから直接呼んで解説を生成する。
   - ヘッダに `anthropic-dangerous-direct-browser-access: true` を付与（各自のキーを各自の端末で使う個人利用前提の割り切り）。
   - 使用モデルは `claude-haiku-4-5-20251001`、`max_tokens: 512`。
   - キーは `settings.anthropicApiKey` として**端末のIndexedDBに平文保存**。バックアップJSONには含めない。未設定時はUIのボタンを隠す。
2. **外部AIへ投げる**（`src/lib/askAi.ts`）: 問題・選択肢・正解・自分の解答からプロンプトを組み立て、`https://claude.ai/new?q=…` または `https://chatgpt.com/?q=…` を開く／クリップボードにコピーする。APIキー不要。

**セキュリティ上の注意**: 共有端末でキーを登録しない。キーを誤って公開しないよう、スクリーンショット共有時は設定画面を含めない。

---

## 11. 再現後の動作確認チェックリスト

ビルド・配信できたら、以下を順に確認すると主要機能を一通り踏める。

1. `/<base>/` を開き、起動ローダー → ホームが表示される（白画面のままなら `base` 不一致を疑う）。
2. 取込画面から CSV か JSON を読み込み、「追加 N件」が出る。エラー行が出た場合はメッセージに従う。
3. ホームの「今すぐ1問」→ 選択肢タップで即採点（緑／赤）→ 解説展開 →「次へ」。採点後は左スワイプでも進む。
4. 同じ問題が同日に再出題されないこと、別ジャンルが混ざって出ることを数問で確認。
5. 「間違いだけ」で box1・2 の問題だけが出ること。
6. 本番シミュレーションを開始 → 途中で中断 → 本番シミュレーションの開始画面最上部に「続きから再開」カードが出る → 再開して提出 → 得点・合否・カテゴリ別内訳・見直しが出る。
7. 成績画面でカテゴリ別正答率・box分布・ストリーク・模試スコア推移（60点の基準線）が描画される。
8. 設定 → データ → バックアップ書き出し → ブラウザデータ削除 → 取込＋復元で学習履歴が戻る。
9. スマホで「ホーム画面に追加」→ 機内モードで起動し、オフラインで出題できる（Service Worker）。
10. 設定でテーマをダークにし、再読み込み直後（ローダー段階）からダーク配色になる。

---

## 12. 既知の注意点・未整備事項（再現時にハマる／掃除候補）

- `README.md` に記載の `node scripts/gen-icons.mjs` は、**`scripts/` ディレクトリ自体が現在リポジトリに存在しない**。アイコンを再生成する場合は `public/` のPNG（192/512/favicon 32・48/apple-touch-icon）を手動で差し替える。
- `src/data/questions.seed.json`（481行）は**現在どこからも import されていない**。同梱オリジナル問題は `abolishOriginals()` で廃止済みのため、実質的に未使用の残置ファイル。
- `playwright-core` が devDependencies にあるが、**スクリプトからもコードからも参照していない**。自動テストは存在しない（`npm run lint` は型チェックのみ）。
- ESLint / Prettier / テストフレームワークは未導入。品質ゲートは `tsc -b` のみ（`strict` + `noUnusedLocals` + `noUnusedParameters`）。
- 開発サーバのURLがサブパス（`/study-deck/`）である点を忘れやすい。
- iOS の PWA 通知には制約があり、`Notification` 不可の環境ではアプリ内バナー（トースト）にフォールバックする。通知は**アプリ起動中のスケジュールのみ**で、バックグラウンド配信は行わない。
- IndexedDB がブラウザのデータ削除で消える＝学習履歴も消える。復旧手段はバックアップJSONのみ。
- `examDurationSec` の既定110分は「暫定値」（`seisan-quiz-SPEC.md` 記載）。実際の試験時間に合わせて設定画面から変更できる。

---

## 13. ゼロから作り直す場合の構築順（参考）

既存コードを使わず同等物を再実装する場合、`seisan-quiz-SPEC.md` の実装順序が最短経路。

1. Vite + React + TypeScript + `vite-plugin-pwa` で初期化、`base` をリポジトリ名に設定、ダークモード対応。
2. Dexie スキーマ（`questions` / `studyRecords`）＋設定テーブル。
3. **一問一答モード（最優先。ここだけで学習が回る）** とテンポループUX。
4. SRS（Leitner）ロジック。
5. ホームのワンタップ開始＆ストリーク。
6. 本番シミュレーション（40問・制限時間・提出後採点）。
7. インポート画面（CSV/JSON取込＋バリデーション）。
8. 成績ダッシュボード（本実装ではライブラリを使わず**インラインSVGで自前描画**している）。
9. PWAアイコン・manifest・ローカル通知・オフライン確認。

設計の絶対条件（仕様書より）: 起動〜1問目表示まで体感1秒以内 / 1問ごと即保存（中断耐性）/ 採点前スワイプ無効 / 親指ゾーンに選択肢 / 外部通信なしでの完全動作。

---

## 14. まとめ（3行）

- `npm ci && npm run build` で `dist/` が出れば再現完了。サーバ構築も環境変数もシークレットも不要。
- 配信URLを変えるなら `vite.config.ts`（base / start_url / scope / navigateFallback）と `index.html` のアイコンパスを**同じ値に揃える**。
- アプリは空の器なので、最後に**公式過去問をCSV/JSONで取り込む**まで行って初めて"使える状態"になる。
