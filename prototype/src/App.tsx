import { useEffect, useMemo, useState } from "react";
import { advanceMonth, formatReignDate, newGame } from "./engine/GameEngine";
import type { FactionState, GameState, ProvinceState } from "./engine/GameState";
import "./styles.css";

const resourceLabels: Array<[keyof GameState["resources"], string, string]> = [
  ["treasury", "国库", "两"],
  ["food", "粮食", "石"],
  ["weapons", "兵器", "件"],
  ["army", "军队", "人"],
  ["authority", "皇权", ""],
  ["morale", "民心", ""],
];

const factionTone: Record<FactionState["id"], string> = {
  gentry: "tone-blue",
  military: "tone-red",
  peasants: "tone-green",
  landlords: "tone-amber",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function percentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function StatBar({ value, tone = "tone-blue" }: { value: number; tone?: string }) {
  return (
    <div className="stat-bar" aria-label={`${value} / 100`}>
      <span className={`stat-bar__fill ${tone}`} style={{ width: `${percentage(value)}%` }} />
    </div>
  );
}

function ProvinceCard({ province }: { province: ProvinceState }) {
  return (
    <article className="province-card">
      <div className="card-heading">
        <div>
          <h3>{province.name}</h3>
          <span className="muted">人口 {formatNumber(province.population)} 万</span>
        </div>
        <span className="status-dot" title="州情稳定" />
      </div>
      <div className="province-metrics">
        <span><b>粮食</b>{province.food}</span>
        <span><b>财赋</b>{province.treasury}</span>
        <span><b>治安</b>{province.security}</span>
        <span><b>民心</b>{province.morale}</span>
      </div>
      <div className="card-footer">
        <span>忠诚 {province.localLoyalty}</span>
        <span>驻军 {province.militaryPresence}</span>
      </div>
    </article>
  );
}

function FactionCard({ faction }: { faction: FactionState }) {
  const tone = factionTone[faction.id];
  return (
    <article className="faction-card">
      <div className="card-heading">
        <div>
          <h3>{faction.name}</h3>
          <span className="muted">影响力 {faction.influence}</span>
        </div>
        <span className={`faction-badge ${tone}`}>{faction.satisfaction}</span>
      </div>
      <div className="faction-satisfaction">
        <span>满意度</span>
        <strong>{faction.satisfaction}<small> / 100</small></strong>
      </div>
      <StatBar value={faction.satisfaction} tone={tone} />
      <div className="card-footer">
        <span>组织力 {faction.organization}</span>
        <span>积怨 {faction.resentment}</span>
      </div>
    </article>
  );
}

function App() {
  const [state, setState] = useState<GameState>(() => newGame());

  useEffect(() => {
    console.info("[Prototype V0.1] GameState", state);
  }, [state]);

  const progress = useMemo(() => (state.time.totalMonths / 360) * 100, [state.time.totalMonths]);
  const recentHistory = [...state.history].reverse().slice(0, 8);
  const formatHistoryDate = (entry: (typeof state.history)[number]) => formatReignDate({
    emperor: state.emperor,
    time: { totalMonths: entry.totalMonths, year: entry.year, month: entry.month },
  });

  const handleAdvance = () => setState((current) => advanceMonth(current));
  const handleRestart = () => setState(newGame());

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">哎呀，朕的皇朝怎么又亡啦</p>
          <h1>景和朝 · 主城区</h1>
        </div>
        <div className="topbar-actions">
          <span className="prototype-tag">PROTOTYPE V0.1 · SPRINT 1</span>
          <button className="secondary-button" type="button" onClick={handleRestart}>重新开始</button>
        </div>
      </header>

      <main>
        <section className="hero-panel">
          <div>
            <span className="section-kicker">当前时刻</span>
            <div className="date-line">
              <h2>{formatReignDate(state)}</h2>
              <span className="age-pill">皇帝 {state.emperor.age} 岁</span>
            </div>
            <p className="hero-copy">天下的奏折尚未堆满案头。先让时间走起来，看看这座皇朝能否安稳度过第一个月。</p>
          </div>
          <div className="reign-progress" aria-label={`已统治 ${state.time.totalMonths} 个月`}>
            <div className="progress-label"><span>三十年国运</span><strong>{state.time.totalMonths} / 360 月</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </section>

        <section className="resource-grid" aria-label="国家资源">
          {resourceLabels.map(([key, label, unit]) => (
            <article className="resource-card" key={key}>
              <span className="resource-label">{label}</span>
              <strong>{formatNumber(state.resources[key])}</strong>
              {unit && <small>{unit}</small>}
            </article>
          ))}
        </section>

        <div className="content-grid">
          <section className="section-block">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">地方概况</span>
                <h2>五州</h2>
              </div>
              <span className="section-note">州级数据 · 当前月未结算</span>
            </div>
            <div className="province-grid">
              {state.provinces.map((province) => <ProvinceCard key={province.id} province={province} />)}
            </div>
          </section>

          <section className="section-block">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">朝堂风向</span>
                <h2>四大势力</h2>
              </div>
              <span className="section-note">满意度与影响力分离</span>
            </div>
            <div className="faction-list">
              {state.factions.map((faction) => <FactionCard key={faction.id} faction={faction} />)}
            </div>
          </section>
        </div>

        <section className="bottom-grid">
          <section className="section-block history-block">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">留痕</span>
                <h2>历史日志</h2>
              </div>
              <span className="section-note">最近 {recentHistory.length} 个月</span>
            </div>
            {recentHistory.length === 0 ? (
              <div className="empty-state"><span className="empty-icon">册</span><p>尚未有月份结算。第一道圣旨还没有落下。</p></div>
            ) : (
              <div className="history-list">
                {recentHistory.map((entry) => (
                  <div className="history-row" key={entry.totalMonths}>
                    <span>{formatHistoryDate(entry)}</span>
                    <span className="muted">月度时间推进完成</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="advance-card">
            <span className="section-kicker">月度操作</span>
            <h2>批阅完毕？</h2>
            <p>进入下个月，推进皇帝年龄与国运时间。资源生产、事件和奏折将在后续 Sprint 接入。</p>
            <button className="primary-button" type="button" onClick={handleAdvance} disabled={Boolean(state.ending)}>
              {state.ending ? "三十年已毕" : "进入下个月"}<span>→</span>
            </button>
            {state.ending && <p className="ending-note">景和三十年已完成，皇帝正常退位。</p>}
          </aside>
        </section>
      </main>

      <footer className="app-footer">Sprint 1 仅验证时间与状态闭环 · 数据源：/data/*.json</footer>
    </div>
  );
}

export default App;
