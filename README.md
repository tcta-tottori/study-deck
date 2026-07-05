# 生産管理プランニング3級 学習アプリ（study-deck）

ビジネス・キャリア検定「生産管理プランニング3級」合格を目的とした、**スマホのスキマ時間で苦手優先に高速反復**するための学習PWAです。React 19 + TypeScript + Vite + Dexie(IndexedDB) 製。**外部通信なし・オフライン完全動作**（AI解説など任意機能を除く）。

> 仕様の詳細は [`seisan-quiz-SPEC.md`](./seisan-quiz-SPEC.md) を参照。

**🔗 公開デモ: https://tcta-tottori.github.io/study-deck/**（スマホで開いて「ホーム画面に追加」でPWA化・オフライン利用可）

## 主な機能

- **一問一答（SRS）**: Leitner方式で「今忘れかけ」の問題を優先出題。回答→即採点（緑/赤）→解説展開→「次へ」のテンポループ。採点後は左スワイプでも次へ。
- **マイクロセッション**: ホームから「今すぐ1問 / 5問 / 10問 / 3分 / 間違いだけ」をワンタップ開始。
- **インターリービング既定ON**: カテゴリ横断でシャッフル。ホームの苦手カテゴリからは分野を絞って集中反復も可能。
- **本番シミュレーション**: 公式問題を優先して40問・制限時間つき。試験中は正誤非表示、提出後に得点・合否（24問=60点で判定）・所要時間・カテゴリ別内訳・誤答の見直しを表示。
- **成績ダッシュボード**: カテゴリ別正答率、Leitner box分布、連続学習日数（ストリーク）、合格ライン到達予測、模試スコア推移（合格60点の基準線つき）。
- **問題インポート**: 公式過去問を CSV / JSON で取込（id重複・answerIndex範囲などをバリデーション）。データは端末のIndexedDBにのみ保存。
- **その他**: ダークモード（自動）、1日1回のローカル通知（未対応環境はアプリ内バナーへフォールバック）、誤答ノート、任意のAI解説（各自のAnthropic APIキーを端末ローカル保存）。

## SRS（間違え優先再出題）

Leitner方式。正解で box +1（最大5）、不正解で box=1・当日再登場。出題は `dueAt<=now` を優先し、box小さい順→dueAt古い順。尽きたら未学習問題を投入。

| box | 1 | 2 | 3 | 4 | 5 |
|-----|---|---|---|---|---|
| 再出題間隔 | 即日 | 1日 | 3日 | 7日 | 14日 |

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm run build      # 型チェック + 本番ビルド（dist/）
npm run preview    # ビルド成果物のプレビュー
```

`public/` のPWAアイコンは `node scripts/gen-icons.mjs` で再生成できます。

## デプロイ（GitHub Pages）

- `vite.config.ts` の `base` はリポジトリ名 `/study-deck/` に設定済み。
- `main` ブランチへの push で `.github/workflows/deploy.yml` が `dist/` をGitHub Pagesへ公開します（リポジトリ設定 → Pages → Source を「GitHub Actions」にしてください）。

## 公式過去問の取り込み

公式過去問（JAVADA）は著作物（禁転載複製）です。**公開コードには含めず**、各自が個人学習の範囲で取り込みます。

1. `tools/convert_javada_pdf.py`（pdfplumber使用）を自分のPCで実行し、問題PDFから JSON/CSV のたたき台を生成。
2. 解答PDFを見て `answerIndex` を確定、計算式・穴埋め等は目視修正。
3. アプリの「取込」画面から CSV/JSON を読み込み → 端末のIndexedDBに保存。

`questions.official*.json` / `questions.R*.json` は `.gitignore` 済みです。

### CSVテンプレート列

```
id, category, subcategory, stem, choice1, choice2, choice3, choice4, answerIndex, explanation, source
```

`answerIndex` は 0〜3（1〜4表記も自動補正）。`category` は仕様の14分類の値（例: `共通_品質管理` / `PLN_生産方式`）。

## データはすべて端末内

問題・学習履歴・模試結果・設定はブラウザのIndexedDBに保存され、サーバへ送信されません。ブラウザのデータを消去すると学習履歴も消えます。
