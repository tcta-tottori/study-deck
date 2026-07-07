import { useMemo } from 'react'
import { useExamResults } from '../hooks/useAppData'
import { boxDistribution, categoryStats, overallAccuracy, passOutlook } from '../lib/stats'
import { categoryLabel, type Question, type StudyRecord } from '../types'
import type { DayActivity } from '../db/db'
import { computeStreak, dayKey } from '../lib/dateutil'
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
