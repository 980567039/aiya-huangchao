import { useEffect, useMemo, useState } from "react";
import {
  BUILDING_DEFINITIONS,
  advanceMonth,
  buildBuilding,
  canBuild,
  formatReignDate,
  newGame,
  resolveMemorial,
} from "./engine/GameEngine";
import type { BuildingId, BuildingState, FactionState, GameState, Memorial, MemorialOption, NationalResources, ProvinceState } from "./engine/GameState";
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

type ResourceKey = keyof NationalResources;
type ResourceDelta = Partial<Record<ResourceKey, number>>;

/**
 * Building definitions are owned by the engine.  The optional aliases keep this
 * view compatible while upkeep is being moved into the monthly-loop schema.
 */
type BuildingDefinitionView = {
  name: string;
  description: string;
  maxLevel: number;
  constructionCost: ResourceDelta;
  monthlyProduction?: ResourceDelta;
  monthlyUpkeep?: ResourceDelta;
  upkeep?: ResourceDelta;
  icon?: string;
};

const buildingOrder: BuildingId[] = ["civilian", "barracks", "kitchen"];
const MONTH_DURATION_SECONDS = 120;
const buildingIcons: Record<BuildingId, string> = {
  civilian: "商",
  barracks: "戍",
  kitchen: "膳",
};
const resourceShortLabels: Record<ResourceKey, string> = {
  treasury: "国库",
  food: "粮食",
  weapons: "兵器",
  army: "军队",
  authority: "皇权",
  morale: "民心",
};

function definitionFor(id: BuildingId): BuildingDefinitionView {
  return (BUILDING_DEFINITIONS as Record<BuildingId, BuildingDefinitionView>)[id];
}

function formatDelta(value: number, unit = ""): string {
  return `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value))}${unit}`;
}

function entriesWithValues(values: ResourceDelta): Array<[ResourceKey, number]> {
  return (Object.entries(values) as Array<[ResourceKey, number | undefined]>)
    .filter((entry): entry is [ResourceKey, number] => typeof entry[1] === "number" && entry[1] !== 0);
}

function productionEntries(definition: BuildingDefinitionView): Array<[ResourceKey, number]> {
  return entriesWithValues(definition.monthlyProduction ?? {}).filter(([, value]) => value > 0);
}

function upkeepEntries(definition: BuildingDefinitionView): Array<[ResourceKey, number]> {
  const explicit = definition.monthlyUpkeep ?? definition.upkeep;
  if (explicit) return entriesWithValues(explicit).map(([key, value]) => [key, Math.abs(value)]);
  return entriesWithValues(definition.monthlyProduction ?? {})
    .filter(([, value]) => value < 0)
    .map(([key, value]) => [key, Math.abs(value)]);
}

function costLabel(cost: ResourceDelta): string {
  const values = entriesWithValues(cost);
  return values.length === 0
    ? "无需额外物资"
    : values.map(([key, value]) => `${resourceShortLabels[key]} ${formatNumber(value)}`).join(" · ");
}

const buildReasonLabels: Record<string, string> = {
  game_ended: "王朝已结束",
  unknown_building: "未知建筑",
  province_not_found: "主城不可用",
  max_level: "已达最高等级",
  insufficient_resources: "资源不足",
};

function buildReasonLabel(reason?: string): string {
  return reason ? buildReasonLabels[reason] ?? reason : "资源不足";
}

function levelFor(buildings: BuildingState[], id: BuildingId): number {
  return buildings.find((building) => building.id === id && building.provinceId === "central")?.level ?? 0;
}

function monthlyNet(buildings: BuildingState[]): ResourceDelta {
  const result: ResourceDelta = {};
  for (const building of buildings.filter((entry) => entry.provinceId === "central")) {
    const definition = definitionFor(building.id);
    for (const [key, value] of entriesWithValues(definition.monthlyProduction ?? {})) {
      result[key] = (result[key] ?? 0) + value * building.level;
    }
    for (const [key, value] of entriesWithValues(definition.monthlyUpkeep ?? definition.upkeep ?? {})) {
      result[key] = (result[key] ?? 0) - Math.abs(value) * building.level;
    }
  }
  return result;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function percentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function eventUrgencyLabel(urgency: Memorial["urgency"]): string {
  return urgency === "high" ? "危急" : urgency === "low" ? "缓急" : "要务";
}

function eventPressure(state: GameState, memorial: Memorial): number {
  const urgencyBase = memorial.urgency === "high" ? 82 : memorial.urgency === "low" ? 32 : 57;
  const reservePressure = Math.max(
    state.resources.food < 12_000 ? 12 : 0,
    state.resources.treasury < 8_000 ? 12 : 0,
    state.provinces.some((province) => province.security < 60 || province.rebellionRisk > 35) ? 14 : 0,
  );
  return percentage(urgencyBase + reservePressure);
}

type CrisisStatus = "stable" | "tense" | "crisis" | "collapse";
type CrisisSnapshot = {
  pressure: number;
  status: CrisisStatus;
  label: string;
  tone: string;
  summary: string;
};

const crisisStatusLabels: Record<CrisisStatus, string> = {
  stable: "稳定",
  tense: "紧张",
  crisis: "危机",
  collapse: "濒临崩溃",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numericValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function crisisStatusFromPressure(pressure: number): CrisisStatus {
  if (pressure >= 76) return "collapse";
  if (pressure >= 51) return "crisis";
  if (pressure >= 26) return "tense";
  return "stable";
}

function crisisTone(status: CrisisStatus): string {
  return `crisis-panel--${status}`;
}

function queueBand(count: number): { label: string; tone: string } {
  if (count <= 0) return { label: "暂无急报", tone: "queue-band--clear" };
  if (count <= 2) return { label: "1–2 件 · 可控", tone: "queue-band--light" };
  if (count <= 4) return { label: "2–4 件 · 拥挤", tone: "queue-band--busy" };
  return { label: "4–6 件 · 告急", tone: "queue-band--critical" };
}

function crisisSnapshot(state: GameState): CrisisSnapshot {
  const raw = (state as unknown as { crisis?: unknown }).crisis;
  let explicitPressure: number | undefined = numericValue((state as unknown as { crisisPressure?: unknown }).crisisPressure);
  let explicitStatus: CrisisStatus | undefined;
  let explicitSummary: string | undefined;
  if (numericValue(raw) !== undefined) {
    explicitPressure = numericValue(raw);
  } else if (isRecord(raw)) {
    explicitPressure = numericValue(raw.pressure) ?? numericValue(raw.globalPressure) ?? numericValue(raw.global_pressure) ?? numericValue(raw.score) ?? numericValue(raw.value);
    const rawStatus = stringValue(raw.status) ?? stringValue(raw.level);
    const statusMap: Record<string, CrisisStatus> = {
      stable: "stable", calm: "stable", tense: "tense", tension: "tense", crisis: "crisis", collapse: "collapse", critical: "collapse",
      稳定: "stable", 紧张: "tense", 危机: "crisis", 濒临崩溃: "collapse",
    };
    explicitStatus = rawStatus ? statusMap[rawStatus] : undefined;
    explicitSummary = stringValue(raw.summary) ?? stringValue(raw.description);
  }

  const ending = (state as unknown as { ending?: unknown }).ending;
  const endingReason = isRecord(ending) ? stringValue(ending.reason) : undefined;
  const hasEarlyEnding = Boolean(endingReason && endingReason !== "normal_retirement");
  const pending = state.pendingMemorials;
  const lowestFaction = state.factions.length > 0 ? Math.min(...state.factions.map((faction) => faction.satisfaction)) : 70;
  const weakestProvince = state.provinces.length > 0
    ? state.provinces.reduce((weakest, province) => Math.min(weakest, province.security, province.morale, province.rebellionRisk > 50 ? 100 - province.rebellionRisk : 100), 80)
    : 80;
  const highUrgency = pending.filter((memorial) => memorial.urgency === "high").length;
  const reserveStrain = (state.resources.food < 10_000 ? 11 : 0)
    + (state.resources.treasury < 8_000 ? 10 : 0)
    + (state.resources.weapons < 1_500 ? 6 : 0);
  const derivedPressure = 12
    + Math.max(0, 70 - lowestFaction) * 0.42
    + Math.max(0, 62 - weakestProvince) * 0.35
    + pending.length * 8
    + highUrgency * 7
    + reserveStrain;
  const pressure = percentage(Math.round(hasEarlyEnding ? 100 : explicitPressure ?? derivedPressure));
  const status = explicitStatus ?? crisisStatusFromPressure(pressure);
  const summary = explicitSummary
    ?? (status === "stable" ? "国库与地方秩序尚稳，可继续投资主城。"
      : status === "tense" ? "边地与朝堂出现裂痕，建设与储备将决定下一个月。"
        : status === "crisis" ? "急报频传，优先处理高危势力与粮军缺口。"
          : "多条防线正在同时崩塌，任何迟疑都可能触发败局。");
  return { pressure, status, label: crisisStatusLabels[status], tone: crisisTone(status), summary };
}

type OptionEffectTag = { label: string; kind: "benefit" | "cost"; factionId?: string };

const factionMetricLabels: Record<string, string> = {
  satisfaction: "满意度",
  influence: "影响力",
  wealth: "财富",
  organization: "组织力",
  resentment: "积怨",
  fear: "威慑",
};

function factionName(state: GameState, factionId: string): string {
  return state.factions.find((faction) => faction.id === factionId)?.name ?? factionId;
}

function optionEffectTags(option: MemorialOption, state: GameState): OptionEffectTag[] {
  const tags: OptionEffectTag[] = [];
  const rawOption = option as unknown as Record<string, unknown>;
  const appendRawTags = (value: unknown, kind: OptionEffectTag["kind"]) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item === "string") {
        // Benefits/costs in the event data are faction ids (for example
        // `peasants`), while the player-facing label must use the localized
        // faction name (百姓). Keep unknown strings readable for forward
        // compatibility with richer event metadata.
        tags.push({ label: factionName(state, item), kind, factionId: item });
        continue;
      }
      if (!isRecord(item)) continue;
      const factionId = stringValue(item.factionId) ?? stringValue(item.faction_id);
      const label = stringValue(item.label) ?? stringValue(item.name) ?? (factionId ? factionName(state, factionId) : undefined);
      if (!label) continue;
      const amount = numericValue(item.amount) ?? numericValue(item.value);
      tags.push({ label: amount === undefined ? label : `${label} ${formatDelta(amount)}`, kind, factionId });
    }
  };
  // Newer event schemas may expose explicit benefits/costs arrays in addition
  // to the normalized effects list. Keep this view forward-compatible.
  appendRawTags(rawOption.benefits, "benefit");
  appendRawTags(rawOption.costs, "cost");
  for (const effect of option.effects ?? []) {
    if (effect.type === "resource_delta") {
      tags.push({
        label: `${resourceShortLabels[effect.resource]} ${formatDelta(effect.amount)}`,
        kind: effect.amount >= 0 ? "benefit" : "cost",
      });
    } else if (effect.type === "faction_delta") {
      const factionLabel = factionName(state, effect.factionId);
      for (const key of Object.keys(factionMetricLabels)) {
        const amount = effect[key as keyof typeof effect];
        if (typeof amount !== "number" || amount === 0) continue;
        const isBadMetric = key === "resentment" || key === "fear";
        const isBenefit = isBadMetric ? amount < 0 : amount > 0;
        tags.push({
          label: `${factionLabel} · ${factionMetricLabels[key]} ${formatDelta(amount)}`,
          kind: isBenefit ? "benefit" : "cost",
          factionId: effect.factionId,
        });
      }
    } else if (effect.type === "province_delta") {
      const province = state.provinces.find((item) => item.id === (effect.provinceId ?? "central"));
      const provinceLabel = province?.name ?? "地方";
      for (const key of ["security", "morale", "rebellionRisk", "corruption"] as const) {
        const amount = effect[key];
        if (typeof amount !== "number" || amount === 0) continue;
        const isBadMetric = key === "rebellionRisk" || key === "corruption";
        tags.push({ label: `${provinceLabel} · ${key === "security" ? "治安" : key === "morale" ? "民心" : key === "rebellionRisk" ? "叛乱风险" : "腐败"} ${formatDelta(amount)}`, kind: isBadMetric ? (amount < 0 ? "benefit" : "cost") : (amount > 0 ? "benefit" : "cost") });
      }
    } else if (effect.type === "state_modifier") {
      tags.push({ label: `${effect.name} · ${effect.durationMonths}月`, kind: "benefit" });
    } else if (effect.type === "spawn_event") {
      tags.push({ label: "触发后续急报", kind: "cost" });
    }
  }
  return tags;
}

function earlyEndingDetails(state: GameState): { reason: string; trigger: string; logs: string[] } | null {
  const ending = (state as unknown as { ending?: unknown }).ending;
  if (!isRecord(ending)) return null;
  const rawReason = stringValue(ending.reason);
  if (!rawReason || rawReason === "normal_retirement") return null;
  const reasonLabels: Record<string, string> = {
    rebellion: "地方叛乱蔓延，朝廷失去控制",
    faction_rebellion: "地方叛乱蔓延，朝廷失去控制",
    civil_war: "地方叛乱蔓延，朝廷失去控制",
    bankruptcy: "国库枯竭，无法维持朝廷运转",
    treasury_empty: "国库枯竭，无法维持朝廷运转",
    famine: "粮道断绝，民心与秩序一同崩溃",
    starvation: "粮道断绝，民心与秩序一同崩溃",
    authority: "皇权跌破底线，诏令无人奉行",
    authority_collapse: "皇权跌破底线，诏令无人奉行",
    military_coup: "武将势力发动兵变，宫城易手",
    faction_overthrow: "朝廷失去关键势力支持，王朝被推翻",
    crisis: "朝廷危机压力达到濒临崩溃",
  };
  const triggerFactionValue = ending.triggerFaction;
  const triggerFactionName = isRecord(triggerFactionValue) ? stringValue(triggerFactionValue.name) : undefined;
  const triggerId = stringValue(ending.triggerFactionId) ?? stringValue(ending.factionId) ?? (typeof triggerFactionValue === "string" ? triggerFactionValue : undefined);
  const fallbackFaction = [...state.factions].sort((left, right) => left.satisfaction - right.satisfaction)[0];
  const trigger = triggerFactionName ?? (triggerId ? factionName(state, triggerId) : fallbackFaction?.name ?? "多方势力");
  const reason = stringValue(ending.cause) ?? stringValue(ending.description) ?? reasonLabels[rawReason] ?? rawReason;
  const explicitLogs = [ending.keyLogs, ending.logs, ending.history]
    .find((value): value is unknown[] => Array.isArray(value))
    ?.map((item) => stringValue(item)).filter((item): item is string => Boolean(item)) ?? [];
  const fallbackLogs = state.history.slice(-4).flatMap((entry) => [
    ...entry.events.map((event) => `急报：${event}`),
    ...entry.actions,
  ]).slice(-5);
  return { reason, trigger, logs: (explicitLogs.length > 0 ? explicitLogs : fallbackLogs).slice(-5) };
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

function BuildingCard({
  building,
  state,
  onBuild,
}: {
  building: BuildingId;
  state: GameState;
  onBuild: (building: BuildingId) => void;
}) {
  const definition = definitionFor(building);
  const level = levelFor(state.buildings, building);
  const check = canBuild(state, building, "central");
  const production = productionEntries(definition);
  const upkeep = upkeepEntries(definition);
  const atMax = level >= definition.maxLevel;
  const cardTone = building === "barracks" ? "building-card--red" : building === "kitchen" ? "building-card--green" : "building-card--blue";

  return (
    <article className={`building-card ${cardTone}`}>
      <div className="building-card__topline">
        <span className="building-icon" aria-hidden="true">{definition.icon ?? buildingIcons[building]}</span>
        <div className="building-title">
          <div className="building-title__line">
            <h3>{definition.name}</h3>
            <span className="building-level">Lv.{level} / {definition.maxLevel}</span>
          </div>
          <span className="muted">主城 · 经营建筑</span>
        </div>
      </div>
      <p className="building-description">{definition.description}</p>
      <div className="building-yields">
        <div>
          <span className="building-yields__label">每月产出</span>
          {production.length > 0 ? (
            <div className="building-yields__values">
              {production.map(([key, value]) => <span key={key} className={level > 0 ? "yield-positive" : "yield-preview"}>{level === 0 ? "建成后 " : ""}{resourceShortLabels[key]} {formatDelta(value * Math.max(level, 1))}</span>)}
            </div>
          ) : <span className="yield-empty">建成后生效</span>}
        </div>
        <div>
          <span className="building-yields__label">每月维护</span>
          {upkeep.length > 0 ? (
            <div className="building-yields__values">
              {upkeep.map(([key, value]) => <span key={key} className={level > 0 ? "yield-negative" : "yield-preview"}>{level === 0 ? "建成后 " : ""}{resourceShortLabels[key]} −{formatNumber(value * Math.max(level, 1))}</span>)}
            </div>
          ) : <span className="yield-empty">暂无维护</span>}
        </div>
      </div>
      <div className="building-card__footer">
        <div>
          <span className="building-cost-label">{atMax ? "已达最高等级" : `${level === 0 ? "建设" : "升级"}成本 · ${costLabel(check.cost ?? definition.constructionCost)}`}</span>
          {!atMax && !check.ok && <span className="building-warning">{buildReasonLabel(check.reason)}</span>}
        </div>
        <button
          className="build-button"
          type="button"
          onClick={() => onBuild(building)}
          disabled={atMax || !check.ok || Boolean(state.ending)}
        >
          {atMax ? "已满级" : level === 0 ? "开始建设" : "升级"}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [state, setState] = useState<GameState>(() => newGame());
  const [buildNotice, setBuildNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MONTH_DURATION_SECONDS);

  useEffect(() => {
    console.info("[Prototype V0.2] GameState", state);
  }, [state]);

  const progress = useMemo(() => (state.time.totalMonths / 360) * 100, [state.time.totalMonths]);
  const recentHistory = [...state.history].reverse().slice(0, 8);
  const formatHistoryDate = (entry: (typeof state.history)[number]) => formatReignDate({
    emperor: state.emperor,
    time: { totalMonths: entry.totalMonths, year: entry.year, month: entry.month },
  });

  const monthlyDelta = useMemo(() => monthlyNet(state.buildings), [state.buildings]);
  const monthlyPreview = Object.entries(monthlyDelta).filter(([, value]) => value).slice(0, 3);
  const handleAdvance = () => {
    setState((current) => {
      // A memorial is a deliberate pause in the clock. Resolve the current
      // decision before the next month's economy can be settled.
      if (current.ending || current.pendingMemorials.length > 0) return current;
      return advanceMonth(current);
    });
    setSecondsLeft(MONTH_DURATION_SECONDS);
    setBuildNotice(null);
  };
  const handleBuild = (building: BuildingId) => {
    const check = canBuild(state, building, "central");
    if (!check.ok) {
      setBuildNotice(`${definitionFor(building).name}暂时无法建设：${buildReasonLabel(check.reason)}`);
      return;
    }
    setState((current) => buildBuilding(current, building, "central"));
    const definition = definitionFor(building);
    setBuildNotice(`${definition.name}已完成升级，下一月结算后开始持续产出。`);
  };
  const handleRestart = () => {
    setState(newGame());
    setSecondsLeft(MONTH_DURATION_SECONDS);
    setBuildNotice(null);
  };

  const pendingMemorial = state.pendingMemorials[0];
  const pressure = pendingMemorial ? eventPressure(state, pendingMemorial) : 0;
  const timerUrgent = secondsLeft <= 8;
  const crisis = useMemo(() => crisisSnapshot(state), [state]);
  const queueInfo = queueBand(state.pendingMemorials.length);
  const endingDetails = earlyEndingDetails(state);

  // The clock is intentionally short in the prototype so the pressure is
  // legible in a demo. It pauses while a memorial is waiting for a choice.
  useEffect(() => {
    if (state.ending || state.pendingMemorials.length > 0) return undefined;
    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [state.ending, state.pendingMemorials.length]);

  useEffect(() => {
    if (secondsLeft !== 0 || state.ending || state.pendingMemorials.length > 0) return;
    // Keep the transition in an effect rather than inside the state updater so
    // React's updater stays pure and the timer can be tested deterministically.
    handleAdvance();
  }, [secondsLeft, state.ending, state.pendingMemorials.length]);

  const handleResolveMemorial = (memorialId: string, optionId: string) => {
    setState((current) => resolveMemorial(current, memorialId, optionId));
    setSecondsLeft(MONTH_DURATION_SECONDS);
    setBuildNotice(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">哎呀，朕的皇朝怎么又亡啦</p>
          <h1>景和朝 · 主城区</h1>
        </div>
        <div className="topbar-actions">
          <span className="prototype-tag">PROTOTYPE V0.3 · CRISIS LOOP</span>
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
            <p className="hero-copy">先经营主城，再应对天下风云。建设民营、兵营与伙房，让国库、军备和粮道在每次月结中持续增长。</p>
          </div>
          <div className="reign-progress" aria-label={`已统治 ${state.time.totalMonths} 个月`}>
            <div className="progress-label"><span>三十年国运</span><strong>{state.time.totalMonths} / 360 月</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className={`month-clock ${timerUrgent && !pendingMemorial ? "month-clock--urgent" : ""}`} aria-live="polite">
              <div className="month-clock__dial">{pendingMemorial ? "暂停" : formatClock(secondsLeft)}</div>
              <div className="month-clock__copy">
                <span className="month-clock__label">{pendingMemorial ? "朝堂急报 · 等待裁决" : "本月倒计时"}</span>
                <span className="month-clock__hint">{pendingMemorial ? "先处理急报，时间不会继续流逝。" : "归零自动进入下月，也可提前结算。"}</span>
                <div className="month-clock__bar"><span style={{ width: `${pendingMemorial ? 100 : (secondsLeft / MONTH_DURATION_SECONDS) * 100}%` }} /></div>
              </div>
            </div>
          </div>
        </section>

        <section className={`crisis-panel ${crisis.tone}`} aria-label="全局朝廷危机压力">
          <div className="crisis-panel__heading">
            <div>
              <span className="section-kicker">朝廷总览 · 危机压力</span>
              <div className="crisis-panel__title-line"><h2>{crisis.label}</h2><span className="crisis-status-pill">{crisis.pressure} / 100</span></div>
            </div>
            <div className={`queue-band ${queueInfo.tone}`}><strong>{state.pendingMemorials.length}</strong><span>件急报</span><small>{queueInfo.label}</small></div>
          </div>
          <div className="crisis-panel__body">
            <div className="crisis-pressure-track"><span style={{ width: `${crisis.pressure}%` }} /></div>
            <p>{crisis.summary}</p>
            <span className="crisis-panel__hint">{state.pendingMemorials.length > 0 ? `当前排队 ${state.pendingMemorials.length} 件 · 一次裁决一件，裁决后继续推进。` : "急报会按月度与局势压力陆续抵达，保持储备以应对突发事件。"}</span>
          </div>
        </section>

        {endingDetails && (
          <section className="ending-crisis-card" aria-live="assertive" aria-label="提前败局">
            <div className="ending-crisis-card__seal">崩</div>
            <div className="ending-crisis-card__body">
              <span className="section-kicker">国运提前终止</span>
              <h2>王朝未能撑到终局</h2>
              <p className="ending-crisis-card__reason"><b>败局原因</b>{endingDetails.reason}</p>
              <p className="ending-crisis-card__trigger"><b>触发势力</b>{endingDetails.trigger}</p>
              {endingDetails.logs.length > 0 && <div className="ending-crisis-card__logs"><b>关键日志</b>{endingDetails.logs.map((log, index) => <span key={`${log}-${index}`}>{log}</span>)}</div>}
            </div>
          </section>
        )}

        {pendingMemorial && (
          <section className="event-card" aria-live="assertive" aria-label="待处理事件">
            <div className="event-card__header">
              <div>
                <p className="event-card__eyebrow">朝堂急报 · 第 1 / {state.pendingMemorials.length} 件 · {pendingMemorial.source}</p>
                <h2>{pendingMemorial.title}</h2>
              </div>
              <span className="event-card__threat">{eventUrgencyLabel(pendingMemorial.urgency)}</span>
            </div>
            <p className="event-card__description">{pendingMemorial.description}</p>
            <div className="event-card__pressure">
              <div className="event-card__pressure-label"><span>局势压力</span><strong>{pressure} / 100</strong></div>
              <div className="event-card__pressure-track"><span style={{ width: `${pressure}%` }} /></div>
            </div>
            <div className="event-actions">
              {pendingMemorial.options.map((option, index) => (
                <button
                  className={`event-action ${index === pendingMemorial.options.length - 1 ? "event-action--danger" : ""}`}
                  key={option.id}
                  type="button"
                  onClick={() => handleResolveMemorial(pendingMemorial.id, option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                  {optionEffectTags(option, state).length > 0 && <span className="event-action__effects">{optionEffectTags(option, state).map((tag, tagIndex) => <em key={`${tag.label}-${tagIndex}`} className={`effect-tag effect-tag--${tag.kind}`}><b>{tag.kind === "benefit" ? "收益" : "代价"}</b>{tag.label}</em>)}</span>}
                </button>
              ))}
            </div>
            {state.pendingMemorials.length > 1 && <p className="event-result">还有 {state.pendingMemorials.length - 1} 件急报待处理。当前只裁决这一件，处理完会自动显示下一件。</p>}
          </section>
        )}

        <section className="resource-grid" aria-label="国家资源">
          {resourceLabels.map(([key, label, unit]) => (
            <article className="resource-card" key={key}>
              <span className="resource-label">{label}</span>
              <strong>{formatNumber(state.resources[key])}</strong>
              {unit && <small>{unit}</small>}
              {typeof monthlyDelta[key] === "number" && monthlyDelta[key] !== 0 && (
                <span className={`resource-delta ${monthlyDelta[key]! >= 0 ? "resource-delta--positive" : "resource-delta--negative"}`}>
                  {formatDelta(monthlyDelta[key]!)} / 月
                </span>
              )}
            </article>
          ))}
        </section>

        <section className="capital-block section-block">
          <div className="section-title-row">
            <div>
              <span className="section-kicker">主城建设 · 经营中枢</span>
              <h2>把资源变成国力</h2>
            </div>
            <span className="section-note">中央 · {state.buildings.filter((building) => building.provinceId === "central").length} 座建筑</span>
          </div>
          <div className="capital-intro">
            <span className="capital-intro__icon">策</span>
            <p>每座建筑都会在“结算经营”时按等级产出资源，同时消耗维护。前期优先补齐粮食与军备，攒下余量再迎接后期事件。</p>
            <span className="capital-intro__delta">
              {monthlyPreview.length > 0 ? <>本月预估净变化&nbsp;{monthlyPreview.map(([key, value]) => (
                <span key={key} className={Number(value) >= 0 ? "resource-delta--positive" : "resource-delta--negative"}>{resourceShortLabels[key as ResourceKey]} {formatDelta(Number(value))}</span>
              ))}</> : <span className="yield-empty">尚未建设建筑 · 点击卡片开始积累资源</span>}
            </span>
          </div>
          <div className="building-grid">
            {buildingOrder.map((building) => <BuildingCard key={building} building={building} state={state} onBuild={handleBuild} />)}
          </div>
          {buildNotice && <p className="build-notice" role="status">{buildNotice}</p>}
        </section>

        <div className="content-grid">
          <section className="section-block">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">地方概况</span>
                <h2>五州</h2>
              </div>
              <span className="section-note">州情概览 · 州级生产后续接入</span>
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
              <div className="empty-state"><span className="empty-icon">册</span><p>尚未有月份结算。先建设一座建筑，再进行第一次经营结算。</p></div>
            ) : (
              <div className="history-list">
                {recentHistory.map((entry) => (
                  <div className="history-row" key={entry.totalMonths}>
                    <span>{formatHistoryDate(entry)}</span>
                    <span className="muted">
                      {entry.events.length > 0
                        ? `朝堂急报 · ${entry.events.length} 件${entriesWithValues(entry.resourceChanges).length > 0 ? ` · ${entriesWithValues(entry.resourceChanges).slice(0, 2).map(([key, value]) => `${resourceShortLabels[key]} ${formatDelta(value)}`).join("  ")}` : ""}`
                        : entriesWithValues(entry.resourceChanges).length > 0
                          ? `经营结算 · ${entriesWithValues(entry.resourceChanges).slice(0, 3).map(([key, value]) => `${resourceShortLabels[key]} ${formatDelta(value)}`).join("  ")}`
                          : "暂无建筑产出"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="advance-card">
            <span className="section-kicker">月度操作</span>
            <h2>{pendingMemorial ? "先裁决，再理政" : "准备结算经营？"}</h2>
            <p>{pendingMemorial ? "朝堂急报正在等待圣裁。选择一项方略处理局势，倒计时会随即恢复。" : "倒计时归零后自动推进一个月；你也可以立即结算。建筑先产出与维护，再推进皇帝年龄和国运时间。"}</p>
            <button className="primary-button" type="button" onClick={handleAdvance} disabled={Boolean(state.ending) || Boolean(pendingMemorial)}>
              {state.ending ? "三十年已毕" : pendingMemorial ? "等待急报裁决" : "结算经营 · 进入下月"}<span>→</span>
            </button>
            {state.ending && <p className="ending-note">景和三十年已完成，皇帝正常退位。</p>}
          </aside>
        </section>
      </main>

      <footer className="app-footer">主城经营原型 · 月结产出、维护与建设升级 · 数据源：/data/*.json</footer>
    </div>
  );
}

export default App;
