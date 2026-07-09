import { useMemo, useState, type CSSProperties } from 'react'
import { useExamResults } from '../hooks/useAppData'
import { boxDistribution, categoryStats, overallAccuracy, passOutlook } from '../lib/stats'
import { categoryLabel, type Question, type StudyRecord } from '../types'
import type { DayActivity } from '../db/db'
import { addDaysKey, computeStreak, dayKey } from '../lib/dateutil'
import { Icon } from '../components/Icon'
import { BackHome } from '../components/BackHome'
import Reveal from '../components/Reveal'

// データは App 側で読込済みのものを props で受け取る。
// （Dashboard 自身で live query を張り直すと、回答直後の書込みと競合して
//  「読み込み中…」のまま止まることがあったため、二重購読をやめる）
export default function Dashboard({
  questions,
  records,
  activity,
  onHome,
  onOpenExams,
}: {
  questions: Question[]
  records: Map<string, StudyRecord>
  activity: DayActivity[]
  onHome: () => void
  onOpenExams: () => void
}) {
  const exams = useExamResults()

  const now = Date.now()
  const data = useMemo(
    () => ({
      cats: categoryStats(questions, records),
      boxes: boxDistribution(questions, records),
      acc: overallAccuracy(records),
    }),
    [questions, records],
  )

  const streak = useMemo(
    () => computeStreak(new Set(activity.map((a) => a.day)), dayKey(now)),
    [activity, now],
  )

  // 日次推移（回答数・正答率）。最初の学習日〜今日を左詰めで用意（最大90日）。
  // 表示期間はカード側のスライダーで切り替える。
  const daily = useMemo(() => {
    const byDay = new Map(activity.map((a) => [a.day, a]))
    const todayK = dayKey(now)
    const raw: { key: string; count: number; correct: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const k = addDaysKey(todayK, -i)
      const a = byDay.get(k)
      raw.push({ key: k, count: a?.count ?? 0, correct: a?.correct ?? 0 })
    }
    // 最初に学習した日より前の空白日は捨てる（左詰め）
    const firstIdx = raw.findIndex((d) => d.count > 0)
    return firstIdx < 0 ? [] : raw.slice(firstIdx)
  }, [activity, now])
  const dailyHasData = daily.length > 0

  const outlook = passOutlook(data.acc)
  const totalAnswered = data.cats.reduce((s, c) => s + c.answered, 0)

  return (
    <>
      <header className="appbar">
        <BackHome onClick={onHome} />
        <h1>成績</h1>
      </header>
      <div className="screen">
        {totalAnswered === 0 && (
          <div className="empty">
            まだ学習記録がありません。<br />ホームから1問はじめましょう。
          </div>
        )}

        {/* PC表示：左1/3＝合格ライン、右2/3＝その他。スマホ縦は従来どおり縦積み。 */}
        <div className="dash-grid">
          <div className="dash-left">
            {/* 合格ライン到達予測 */}
            <Reveal>
              <div className="card">
                <h2>合格ライン到達予測（60%）</h2>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: outlook.ok ? 'var(--correct)' : 'var(--accent)' }}>
                    {outlook.pct}%
                  </div>
                  <div
                    className="chip"
                    style={{ background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Icon name="flame" size={14} /> 連続{streak}日
                  </div>
                </div>
                <div className="progress" style={{ marginTop: 8 }}>
                  <span style={{ width: `${Math.min(100, outlook.pct)}%`, background: outlook.ok ? 'var(--correct)' : 'var(--accent)' }} />
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{outlook.label}</p>
              </div>
            </Reveal>
          </div>

          <div className="dash-right">
            {/* 日別の学習推移（回答数＋正答率）。表示期間はスライダーで調整 */}
            <Reveal>
              <div className="card">
                {dailyHasData ? (
                  <DailyTrendCard allDays={daily} />
                ) : (
                  <>
                    <h2>学習の推移</h2>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      学習を続けると、日ごとの回答数と正答率の推移が表示されます。
                    </p>
                  </>
                )}
              </div>
            </Reveal>

            {/* カテゴリ別正答率 */}
            <Reveal>
              <div className="card">
                <h2>カテゴリ別正答率</h2>
                {data.cats.length === 0 && <p className="muted">データなし</p>}
                {data.cats.map((c) => {
                  const pct = Math.round(c.accuracy * 100)
                  return (
                    <div className="bar-item" key={c.category}>
                      <div className="bar-head">
                        <span>{categoryLabel(c.category)}</span>
                        <span className="muted">
                          {c.answered > 0 ? `${pct}%` : '未学習'}（{c.answered}/{c.total}）
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${c.answered > 0 ? pct : 0}%`,
                            background: pct >= 60 ? 'var(--correct)' : pct >= 40 ? 'var(--accent)' : 'var(--wrong)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Reveal>

            {/* box分布 */}
            <Reveal>
              <div className="card">
                <h2>定着度（Leitner box分布）</h2>
                <BoxDist dist={data.boxes} />
                <p className="muted" style={{ marginTop: 6 }}>
                  左ほど苦手（box1）、右ほど定着（box5）。未学習は含みません。
                </p>
              </div>
            </Reveal>

            {/* 模試スコア推移（タップで受験履歴・復習へ） */}
            <Reveal>
              <button className="card card-btn" onClick={onOpenExams}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>模試スコア推移</h2>
                  <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    履歴・復習 <Icon name="arrow" size={14} />
                  </span>
                </div>
                {exams && exams.length > 0 ? (
                  <ScoreTrend scores={exams.map((e) => e.score)} />
                ) : (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    本番シミュレーションを受けると推移が表示されます。
                  </p>
                )}
                {exams && exams.length > 0 && (
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                    タップで1回ごとの詳細・分析・復習へ
                  </p>
                )}
              </button>
            </Reveal>
          </div>
        </div>
      </div>
    </>
  )
}

function BoxDist({ dist }: { dist: number[] }) {
  const boxes = [1, 2, 3, 4, 5]
  const max = Math.max(1, ...boxes.map((b) => dist[b]))
  const colors = ['var(--wrong)', '#f97316', 'var(--accent)', '#84cc16', 'var(--correct)']
  return (
    <div className="row" style={{ alignItems: 'flex-end', gap: 10, height: 120 }}>
      {boxes.map((b, i) => {
        const h = (dist[b] / max) * 100
        return (
          <div key={b} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 90, display: 'flex', alignItems: 'flex-end' }}>
              <div
                className="box-bar"
                style={{
                  width: '100%',
                  height: `${Math.max(4, h)}%`,
                  background: colors[i],
                  borderRadius: '8px 8px 0 0',
                }}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{dist[b]}</div>
            <div className="muted" style={{ fontSize: 11 }}>box{b}</div>
          </div>
        )
      })}
    </div>
  )
}

type Day = { key: string; count: number; correct: number }

/**
 * 学習推移カード。右上のスライダーで表示日数（3日〜全範囲、標準7日）を切り替え、
 * 直近 rangeDays 日ぶんを左詰めで表示する。
 */
function DailyTrendCard({ allDays }: { allDays: Day[] }) {
  const maxRange = allDays.length
  const minRange = Math.min(3, maxRange)
  const [rangeDays, setRangeDays] = useState(Math.max(minRange, Math.min(7, maxRange)))
  const shown = Math.min(rangeDays, maxRange)
  const days = allDays.slice(-shown)
  // スライダーの塗り（webkit用）を値から算出
  const pct = maxRange > minRange ? ((shown - minRange) / (maxRange - minRange)) * 100 : 100
  const rangeStyle = { '--pct': `${pct}%` } as CSSProperties

  return (
    <>
      <div className="dt-head">
        <h2>学習の推移</h2>
        {maxRange > minRange && (
          <label className="dt-range" title="表示する日数">
            <input
              type="range"
              min={minRange}
              max={maxRange}
              value={rangeDays}
              style={rangeStyle}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              aria-label="表示する日数"
            />
            <span className="dt-range-val">{shown}日</span>
          </label>
        )}
      </div>
      <DailyTrend days={days} />
    </>
  )
}

/**
 * 日別の学習推移。1つの図に「回答数（棒）」と「正答率（折れ線）」をまとめ、
 * 日付の横軸を明示する。左軸＝回答数（問）、右軸＝正答率（%）。
 * 回答数20問＝正答率60% を同じ高さの目標線に揃える。
 */
function DailyTrend({ days }: { days: Day[] }) {
  const n = days.length
  const W = 340
  const H = 182
  const padL = 28
  const padR = 32
  const padTop = 30
  const axisY = 150 // 横軸（ベースライン）
  const plotH = axisY - padTop
  const slot = (W - padL - padR) / n
  const cx = (i: number) => padL + slot * i + slot / 2
  const bw = Math.max(2, Math.min(18, slot - 4)) // 日数が多いほど細く

  // 回答数20問が正答率60%と同じ高さに来るよう軸を揃える（20/countMax = 60/100）
  const countMax = 100 / 3
  const gridY = (c: number) => axisY - (c / countMax) * plotH
  const barTopY = (c: number) => Math.max(padTop, axisY - (c / countMax) * plotH)
  const accY = (pct: number) => axisY - (pct / 100) * plotH
  const gridCounts = [10, 30] // 補助線（10ずつ）。20は目標線として別途描く。

  const pts = days.map((d, i) => ({
    i,
    x: cx(i),
    has: d.count > 0,
    pct: d.count > 0 ? Math.round((d.correct / d.count) * 100) : 0,
  }))
  // 連続してデータのある日どうしだけを線でつなぐ（空白日はまたがない）
  const segs: string[] = []
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].has && pts[i - 1].has) {
      segs.push(`M${pts[i - 1].x},${accY(pts[i - 1].pct)} L${pts[i].x},${accY(pts[i].pct)}`)
    }
  }
  const label = (key: string) => {
    const [, m, d] = key.split('-').map(Number)
    return `${m}/${d}`
  }
  // x軸ラベル：重ならない範囲でできるだけ多く表示（日数が少なければ全日、
  // 多ければ等間隔に間引く）。ラベル1つ分の目安幅からプロット幅で最大数を算出。
  const maxLabels = Math.max(2, Math.floor((W - padL - padR) / 40))
  const labelCount = Math.min(maxLabels, n)
  const labelIdx = [
    ...new Set(
      Array.from({ length: labelCount }, (_, k) =>
        Math.round((k * (n - 1)) / Math.max(1, labelCount - 1)),
      ),
    ),
  ]

  return (
    <svg className="daily-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="日別の回答数と正答率の推移">
      {/* 凡例 */}
      <rect x={padL} y={8} width={10} height={10} rx={2} className="dt-bar" />
      <text x={padL + 15} y={17} className="dt-leg">回答数</text>
      <line x1={padL + 70} y1={13} x2={padL + 92} y2={13} className="dt-line" />
      <circle cx={padL + 81} cy={13} r={3.5} className="dt-dot ok" />
      <text x={padL + 97} y={17} className="dt-leg">正答率</text>

      {/* 補助線（左軸=回答数の10ずつ） */}
      {gridCounts.map((c) => (
        <line key={c} x1={padL} y1={gridY(c)} x2={W - padR} y2={gridY(c)} className="dt-grid" />
      ))}
      {gridCounts.map((c) => (
        <text key={`l${c}`} x={padL - 4} y={gridY(c) + 3} className="dt-tick" textAnchor="end">
          {c}
        </text>
      ))}

      {/* 目標線：回答数20問＝正答率60% を1本で表現（左に20・右に60） */}
      <line x1={padL} y1={gridY(20)} x2={W - padR} y2={gridY(20)} className="dt-guide" />
      <text x={padL - 4} y={gridY(20) + 3} className="dt-goal" textAnchor="end">20</text>
      <text x={W - padR + 4} y={gridY(20) + 3} className="dt-goal" textAnchor="start">60</text>

      {/* 軸の端ラベル（左＝問/0、右＝100%） */}
      <text x={6} y={padTop - 8} className="dt-tick">問</text>
      <text x={padL - 4} y={axisY} className="dt-tick" textAnchor="end">0</text>
      <text x={W - padR + 4} y={padTop + 3} className="dt-tick" textAnchor="start">100%</text>

      {/* 回答数（棒・背景の量） */}
      {days.map((d, i) =>
        d.count > 0 ? (
          <rect
            key={d.key}
            x={cx(i) - bw / 2}
            y={barTopY(d.count)}
            width={bw}
            height={axisY - barTopY(d.count)}
            rx={2.5}
            className="dt-bar"
          />
        ) : null,
      )}

      {/* 横軸（ベースライン） */}
      <line x1={padL} y1={axisY} x2={W - padR} y2={axisY} className="dt-axis" />

      {/* 正答率（折れ線・主役） */}
      {segs.map((d, i) => (
        <path key={i} d={d} className="dt-line" />
      ))}
      {pts.map((p) =>
        p.has ? (
          <circle
            key={p.i}
            cx={p.x}
            cy={accY(p.pct)}
            r={4}
            className={p.pct >= 60 ? 'dt-dot ok' : 'dt-dot ng'}
          />
        ) : null,
      )}

      {/* 日付ラベル（横軸） */}
      {labelIdx.map((i) => (
        <text key={i} x={cx(i)} y={axisY + 16} className="dt-xlabel" textAnchor="middle">
          {label(days[i].key)}
        </text>
      ))}
    </svg>
  )
}

function ScoreTrend({ scores }: { scores: number[] }) {
  const W = 320
  const H = 140
  const pad = 24
  const n = scores.length
  const maxX = Math.max(1, n - 1)
  const x = (i: number) => pad + (i / maxX) * (W - pad * 2)
  const y = (v: number) => H - pad - (v / 100) * (H - pad * 2)
  const baseline = y(60)

  const pts = scores.map((s, i) => `${x(i)},${y(s)}`).join(' ')

  return (
    <svg className="line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="模試スコア推移">
      {/* 合格ライン 60点 */}
      <line x1={pad} y1={baseline} x2={W - pad} y2={baseline} stroke="var(--correct)" strokeDasharray="4 4" strokeWidth="1" />
      <text x={W - pad} y={baseline - 4} fontSize="10" fill="var(--correct)" textAnchor="end">
        合格60
      </text>
      {/* 軸 */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" strokeWidth="1" />
      {n > 1 && <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />}
      {scores.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s)} r="3.5" fill={s >= 60 ? 'var(--correct)' : 'var(--wrong)'} />
      ))}
    </svg>
  )
}
