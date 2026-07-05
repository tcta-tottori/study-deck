#!/usr/bin/env python3
"""
JAVADA「生産管理プランニング3級」問題PDF → 取込用JSON/CSV たたき台 変換ツール

前提:
  - 問題PDFはテキスト埋め込み型（born-digital）。OCR不要。
  - 書式は「問題N」→「ア．… イ．… ウ．… エ．…」。
  - 透かし「禁転載複製」やページ識別子（例: R7後-041B01-3）は除去する。

使い方:
  pip install pdfplumber
  # 1) 問題PDFから雛形を生成（answerIndex は -1 のまま出力）
  python tools/convert_javada_pdf.py r07l041b01x.pdf --prefix OFF-R07L -o questions.R07L.json
  # 2) 解答PDFを見て、別途 answers.csv （id,answerIndex[1-4]）を用意
  python tools/convert_javada_pdf.py r07l041b01x.pdf --prefix OFF-R07L \
         --answers answers_r07l.csv -o questions.R07L.json --csv questions.R07L.csv

注意:
  - 計算式・穴埋め表・ルビを含む問題は抽出が乱れるので、出力を必ず目視修正すること。
  - 出力は個人学習用。公開リポジトリにコミットしないこと（.gitignore 済み）。
"""
import argparse
import csv
import json
import re
import sys

# 選択肢の見出し（ア．イ．ウ．エ．／ア.／ア、等の表記ゆれを許容）
CHOICE_RE = re.compile(r"[（(]?([アイウエ])[）)]?[．.、:：]\s*")
QUESTION_RE = re.compile(r"問題?\s*([0-9０-９]+)")
NOISE_RE = re.compile(r"(禁転載複製|禁\s*転\s*載|[A-Z]?\d{1,2}[前後]-\d+[A-Z]\d+(-\d+)?)")

Z2H = str.maketrans("０１２３４５６７８９", "0123456789")


def clean(text: str) -> str:
    text = NOISE_RE.sub("", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def extract_text(pdf_path: str) -> str:
    try:
        import pdfplumber
    except ImportError:
        sys.exit("pdfplumber が必要です:  pip install pdfplumber")
    parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def parse_questions(raw: str):
    """『問題N』でブロック分割し、各ブロックを stem と 4択に分解する。"""
    lines = [clean(l) for l in raw.splitlines()]
    text = "\n".join(l for l in lines if l)

    # 問題番号の位置で分割
    starts = [(m.start(), m.group(1).translate(Z2H)) for m in QUESTION_RE.finditer(text)]
    questions = []
    for i, (pos, num) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        block = text[pos:end]
        # 先頭の「問題N」を除去
        block = QUESTION_RE.sub("", block, count=1).strip()

        # 選択肢の見出し位置を集める
        marks = list(CHOICE_RE.finditer(block))
        if len(marks) < 4:
            # 4択に満たない → 抽出失敗としてstemのみ保持（要目視）
            questions.append({"num": num, "stem": block, "choices": []})
            continue
        stem = block[: marks[0].start()].strip()
        choices = []
        for j in range(4):
            s = marks[j].end()
            e = marks[j + 1].start() if j + 1 < len(marks) else len(block)
            choices.append(block[s:e].strip())
        questions.append({"num": num, "stem": stem, "choices": choices})
    return questions


def load_answers(path: str):
    """answers.csv (id,answerIndex[1-4] または 0-3) を読む。"""
    ans = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if not row or not row[0].strip():
                continue
            qid = row[0].strip()
            if qid.lower() == "id":
                continue
            v = int(row[1])
            ans[qid] = v - 1 if 1 <= v <= 4 else v
    return ans


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--prefix", required=True, help="idの接頭辞 例: OFF-R07L")
    ap.add_argument("--answers", help="解答CSV (id,answerIndex)")
    ap.add_argument("-o", "--out", default="questions.json")
    ap.add_argument("--csv", help="CSVも書き出す場合の出力先")
    ap.add_argument("--category", default="共通_品質管理", help="暫定カテゴリ（後で目視分類）")
    args = ap.parse_args()

    raw = extract_text(args.pdf)
    parsed = parse_questions(raw)
    answers = load_answers(args.answers) if args.answers else {}

    out = []
    for q in parsed:
        qid = f"{args.prefix}-{int(q['num']):04d}"
        choices = q["choices"] + [""] * (4 - len(q["choices"]))
        out.append(
            {
                "id": qid,
                "origin": "official",
                "category": args.category,
                "stem": q["stem"],
                "choices": choices[:4],
                "answerIndex": answers.get(qid, -1),
                "explanation": "",
                "source": args.prefix,
            }
        )

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {args.out}  ({len(out)} questions)")

    missing = [q["id"] for q in out if q["answerIndex"] < 0]
    if missing:
        print(f"⚠ answerIndex 未確定: {len(missing)}件 → 解答PDFから埋めてください")

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(
                ["id", "category", "subcategory", "stem", "choice1", "choice2",
                 "choice3", "choice4", "answerIndex", "explanation", "source"]
            )
            for q in out:
                w.writerow(
                    [q["id"], q["category"], "", q["stem"], *q["choices"],
                     q["answerIndex"], q["explanation"], q["source"]]
                )
        print(f"wrote {args.csv}")

    print("※ 計算式・穴埋め・ルビを含む問題は抽出が乱れます。必ず目視修正してください。")


if __name__ == "__main__":
    main()
