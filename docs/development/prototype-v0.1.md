# 《哎呀，朕的皇朝怎么又亡啦》Prototype V0.1 开发实施文档

> 目标：把现有 GDD 转化为一个可运行、可测试的最小游戏原型。
> 原则：先验证玩法，再做美术；先完成闭环，再扩展内容。

## 1. V0.1 目标

玩家从**20岁**登基开始，在主城区处理来自五州的奏折，使用圣旨和政策技能，管理四大普通势力与国家资源，并验证“决策 → 后果 → 新问题”的循环是否好玩。

最终游戏目标为约30年统治；Prototype 可以采用更短测试周期。

## 2. 技术路线

第一版推荐：TypeScript + React + Vite + JSON，浏览器本地运行，不需要后端。

后续正式游戏可以迁移到 Godot，但游戏规则、数据和 UI 必须分离。

## 3. V0.1 必须做

- [ ] 单机运行
- [ ] 5州：北朔、河东、中州、江南、岭南
- [ ] 4势力：士族、武将、百姓、豪强
- [ ] 国家资源：国库、粮食、兵器、军队、皇权、民心
- [ ] 州状态
- [ ] 势力状态
- [ ] 月度循环
- [ ] 奏折
- [ ] 事件
- [ ] 圣旨 / Action
- [ ] Effect
- [ ] 仁政 / 集权 / 暴政 / 强兵四条路线
- [ ] 基础叛乱与平叛
- [ ] 历史日志
- [ ] 30年结局评价

## 4. 暂时不做

- [ ] 真实历史地图
- [ ] 城市级管理
- [ ] 即时战斗
- [ ] 正式美术与动画
- [ ] 复杂人物关系
- [ ] 后宫 / 联姻
- [ ] 多皇帝继承
- [ ] 复杂外交
- [ ] Steam SDK / 成就
- [ ] 联机 / 云同步

## 5. 推荐目录

```text
prototype/
├── src/
│   ├── engine/
│   │   ├── GameEngine.ts
│   │   ├── GameState.ts
│   │   ├── MonthlyLoop.ts
│   │   ├── EffectEngine.ts
│   │   ├── EventEngine.ts
│   │   ├── RebellionEngine.ts
│   │   └── SkillEngine.ts
│   ├── data/
│   ├── components/
│   └── App.tsx
├── package.json
└── README.md
```

核心原则：`engine / data / UI` 分离。

## 6. GameState

```ts
GameState {
  time
  emperor
  resources
  provinces[]
  factions[]
  activeModifiers[]
  activeEvents[]
  pendingMemorials[]
  unlockedSkills[]
  history[]
  ending
}
```

所有关键状态集中在 GameState，不把规则状态藏在 React Component 中。

---

# 7. 开发阶段

## Phase 1：项目初始化

- [ ] React + TypeScript + Vite
- [ ] engine / data / components 目录
- [ ] GameState 类型
- [ ] GameEngine
- [ ] newGame()
- [ ] 开发服务器启动

**验收：** 页面显示“景和元年·正月 / 皇帝20岁”，控制台可看到完整 GameState。

## Phase 2：五州、四势力、国家资源

### 五州字段

```text
population
food
treasury
security
morale
corruption
local_loyalty
rebellion_risk
```

### 势力字段

```text
satisfaction
influence
wealth
organization
resentment
fear
```

### 国家资源

```text
treasury
food
weapons
army
authority
morale
```

**验收：** 新游戏不存在 undefined / NaN，五州和四势力始终存在。

## Phase 3：时间系统

- [ ] 月 +1
- [ ] 12月进入下一年
- [ ] 皇帝每年 +1岁
- [ ] 360个月结束
- [ ] 技能冷却减少
- [ ] Modifier 持续时间减少

核心 API：`advanceMonth(state): GameState`

**验收：** 连续推进12个月后年月、年龄正确；20岁登基的皇帝一年后为21岁。

## Phase 4：经济系统

- [ ] 五州生产粮食
- [ ] 五州产生财政
- [ ] 中央征收
- [ ] 军队粮食消耗
- [ ] 行政消耗
- [ ] 预留战争消耗

**验收：** 连续运行12个月后资源确实变化，但不会第一年固定破产或无限增长。

## Phase 5：势力系统

- [ ] 满意度
- [ ] 影响力
- [ ] 财富
- [ ] 组织力
- [ ] 积怨
- [ ] 恐惧

必须保证 `satisfaction != influence`。

**验收：** 针对某势力的政策可以改变满意度/积怨，而不会错误同步影响力。

## Phase 6：Effect Engine

核心 API：`applyEffect(state, effect): GameState`

第一版支持：

- [ ] resource_delta
- [ ] faction_satisfaction
- [ ] faction_influence
- [ ] faction_wealth
- [ ] state_modifier
- [ ] province_modifier
- [ ] spawn_event
- [ ] increase_rebellion
- [ ] reduce_rebellion

禁止 UI 按钮直接修改 GameState；统一走 `Action → EffectEngine → GameState`。

**验收：** 一个测试 Action 能产生明确 before/after 差异并留下日志。

## Phase 7：奏折

结构：

```ts
Memorial {
  id
  title
  source
  provinceId?
  factionId?
  description
  urgency
  options[]
}
```

第一批：河东旱灾、武将索要军饷、士族请求减税、豪强拒绝捐税、流民增加。

**验收：** 打开奏折 → 选择方案 → Effect → 状态变化 → 奏折移除 → 历史记录。

## Phase 8：事件

第一批：旱灾、洪灾、蝗灾、流民、土匪、粮价上涨、士族请愿、豪强抗税、武将索饷。

事件根据 GameState 条件和权重产生，不做纯固定脚本。

**验收：** 同一事件在不同州状态下拥有不同概率或后果。

## Phase 9：政策路线

第一版每条只做3个技能。

### 仁政
- [ ] 爱民如子
- [ ] 天下共济
- [ ] 轻徭薄赋

### 集权
- [ ] 皇命如山
- [ ] 钦差巡按
- [ ] 密奏制度

### 暴政
- [ ] 铁腕
- [ ] 强行征税
- [ ] 抄没家产

### 强兵
- [ ] 募兵令
- [ ] 军屯
- [ ] 军功爵

**验收：** 技能不只是文字描述，而是真正改变状态或提供新的决策方式。

## Phase 10：叛乱

至少支持：百姓民变、豪强抗命、士族政变风险、武将兵变风险。

行为区别：

```text
百姓：流民 → 土匪 → 民变
豪强：抗税 → 资助土匪 → 地方割据
士族：抵制 → 行政瘫痪 → 政变
武将：欠饷 → 抗命 → 兵变
```

**验收：** 测试数据把某势力风险推过阈值后，能够触发对应危机。

## Phase 11：平叛

第一版不做战斗画面，只做结果计算：派兵镇压、招安、赈灾、谈判。

派兵消耗军队、粮食、兵器、国库。

**验收：** 叛乱能被解决或升级，并明确显示资源和政治代价。

## Phase 12：主界面

```text
顶部：国家状态
左侧：五州
中间：奏折
右侧：四大势力
底部：技能 / 圣旨 / 历史日志
```

核心按钮：`【进入下个月】`

**验收：** 玩家不看开发者工具也能完成一轮基本操作。

## Phase 13：历史日志

记录月份、资源变化、势力变化、事件、奏折、玩家 Action、叛乱。

**验收：** 可以回顾最近12个月的关键决策和后果。

## Phase 14：结局

正常：360个月退位。

提前：皇帝死亡、武将政变、士族政变、全国性农民军成功。

评价：中兴之主、明君、守成之主、平庸之主、暴君、昏君、亡国之君。

---

# 8. Sprint 计划

## Sprint 1：让皇帝活起来

当前只做9项：

1. React + TypeScript + Vite
2. GameState
3. 五州
4. 四势力
5. 国家资源
6. `newGame()`
7. `advanceMonth()`
8. 最简单主界面
9. 进入下个月

### Sprint 1 验收

连续点击12次“进入下个月”：

- 年月正确
- 皇帝年龄正确
- 无 NaN / undefined
- 五州、四势力始终存在
- 刷新后可以重新开始

## Sprint 2：让国家开始运转

- [ ] 州生产
- [ ] 中央征收
- [ ] 军队消耗
- [ ] 行政消耗
- [ ] 月度资源日志
- [ ] 势力基础变化

## Sprint 3：第一次真正做选择

- [ ] Effect Engine
- [ ] 旱灾
- [ ] 奏折
- [ ] 3个以上处理方案
- [ ] Action → Effect
- [ ] 历史日志

**这是第一个玩法验收点。** 如果“旱灾 → 奏折 → 决策 → 后果”不好玩，暂停扩展。

## Sprint 4：政策路线

- [ ] 四路线各3技能
- [ ] 技能点
- [ ] 解锁条件
- [ ] 技能效果

## Sprint 5：危机闭环

- [ ] 叛乱风险
- [ ] 百姓民变
- [ ] 豪强抗命
- [ ] 武将兵变
- [ ] 士族政变风险
- [ ] 平叛
- [ ] 后续奏折

## Sprint 6：年度与结局

- [ ] 年度结算
- [ ] 12个月回顾
- [ ] 30年计时
- [ ] 提前结束
- [ ] 结局评价

---

# 9. 测试方案

### Test A：正常玩家
凭直觉决策。

### Test B：仁政
尽量使用仁政。

### Test C：暴政
尽量使用暴政。

### Test D：极端测试
故意持续压低一个势力的满意度，验证叛乱链。

比较国库、粮食、军力、民心、皇权、四大势力满意度、叛乱次数、奏折数量、最终评价。

重点检查：

- [ ] 是否存在唯一正确玩法
- [ ] 是否有无脑强技能
- [ ] 资源压力是否过低
- [ ] 资源压力是否过高
- [ ] 是否有真正两难选择
- [ ] 玩家过去的行为是否会影响未来

---

# 10. Definition of Done

V0.1 必须能够：

- [ ] 开始新游戏
- [ ] 查看五州
- [ ] 查看四大势力
- [ ] 查看国家资源
- [ ] 推进月份
- [ ] 资源发生变化
- [ ] 产生事件
- [ ] 产生奏折
- [ ] 处理奏折
- [ ] 发布至少一种圣旨
- [ ] 解锁技能
- [ ] 技能改变状态
- [ ] 产生叛乱风险
- [ ] 触发至少一种叛乱
- [ ] 平叛
- [ ] 查看历史日志
- [ ] 完整运行测试周期
- [ ] 触发结局评价

## 11. 与其他文档的关系

本文件描述**怎么开发 Prototype**，不是最终设计的唯一来源。

正式设计以 `docs/GDD.md`、`docs/gameplay/` 和 `docs/project/source-of-truth.md` 为准；实际可运行数值优先来自 `data/`。

任何用户试玩反馈导致的规则变化，必须遵守根目录 `AGENTS.md` 与 `docs/project/change-management.md`，禁止只修改 Prototype。
