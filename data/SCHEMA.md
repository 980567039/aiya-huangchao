# Data Schema V0.5

> 目的：明确 `data/` 是新游戏初始数据与可配置规则的 Source of Truth。Runtime TypeScript 负责加载、校验、执行，不再偷偷定义同一份初始数值。

## 1. Source of Truth 分层

| 文件 | 负责内容 |
|---|---|
| `national_resources.json` | 国家新游戏初始资源 |
| `factions.json` | 四大普通势力新游戏初始状态 |
| `provinces.json` | 五州新游戏初始状态 |
| `buildings.json` | 主城建筑、等级、建设成本、月度产出与维护 |
| `monthly_loop.json` | 时间、月度循环、粮食消耗、粮荒、叛乱阈值等规则参数 |
| `edicts.json` | 圣旨定义与效果引用 |
| `effects.json` | 可执行 Effect 定义 |
| `events.json` | 事件定义与事件选项 |
| `policy_skills.json` | 政策路线与技能定义 |

## 2. National Resources

`national_resources.json` 必须包含：

```text
treasury
food
weapons
army
authority
morale
```

其中 `authority` 是皇权国家属性，不是普通势力。

## 3. Factions

`factions.json` 必须且只能包含四个普通势力：

```text
gentry
military
peasants
landlords
```

每个势力必须包含：

```text
id
name
satisfaction
influence
wealth
organization
resentment
fear
```

新游戏初始 `satisfaction` 必须为 100；新君登基时不预设任何势力天然敌对。禁止在 factions.json 增加 `imperial`。

## 4. Provinces

`provinces.json` 必须且只能包含五州：

```text
north_shuo
he_dong
central
jiangnan
lingnan
```

每州必须包含：

```text
id
name
population
food
treasury
security
morale
corruption
local_loyalty
rebellion_risk
gentry_influence
landlord_influence
garrison
```

Runtime 可以把字段转换为 camelCase，但不得在加载阶段再额外修改初始数值。

## 5. Buildings

`buildings.json` 定义主城建筑。当前必须包含六类：

```text
granary
 treasury
barracks
armory
workshop
market
```

每个建筑必须包含：

```text
id
name
description
icon
tone
max_level
construction_cost
monthly_production
monthly_upkeep
```

当前所有建筑最高 5 级。每座建筑独立升级，不存在单一“主城等级”替代建筑等级。

兵营属于特殊建筑：它提供军队增长，同时增加每月粮食消耗。

## 6. Food Upkeep

`monthly_loop.json.food_upkeep` 是粮食规则的配置入口。

当前规则：

```text
army_food = army × army_food_per_soldier
barracks_food = Σ(barracks_level × barracks_food_per_level)
```

如果可用粮食不足以覆盖上述需求，进入粮荒：

- 粮食归零
- 损失部分农民
- 损失部分士兵
- 百姓满意度下降
- 武将满意度下降
- 地方民心 / 叛乱风险受到额外压力

## 7. Rule

任何属于“新游戏初始值”的数字必须进入 `data/`。

错误：

```ts
security: province.security - 10
rebellionRisk: 12
```

正确：

```ts
security: province.security
rebellionRisk: province.rebellion_risk
```

运行时 Effect 可以改变数值，但不得伪装成初始值。

## 8. Runtime 职责

Runtime 可以：

- 校验 ID
- 校验必填字段
- 转换命名格式
- 根据运行时规则计算变化
- 执行 Effect
- 推进月度循环
- 根据 Data 中的规则计算粮食短缺

Runtime 不应该：

- 重新定义 Data 中已有的初始值
- 用魔法数字覆盖 Data
- 在 UI 中直接修改国家状态

## 9. ID 引用规则

任何跨文件引用必须引用已有 ID：

```text
factionId → factions.json
provinceId → provinces.json
buildingId → buildings.json
effectId → effects.json
eventId → events.json
skillId → policy_skills.json
```

删除或重命名 ID 时必须全仓库搜索引用。

## 10. V0.5 校验清单

手动运行数据一致性检查时至少验证：

- [ ] factions 恰好4个
- [ ] factions 初始满意度全部为100
- [ ] provinces 恰好5个
- [ ] buildings 恰好6个
- [ ] 每个建筑 max_level = 5
- [ ] building ID 与 `GameState.BUILDING_IDS` 一致
- [ ] faction ID 与 `GameState.FACTION_IDS` 一致
- [ ] province ID 与 `GameState.PROVINCE_IDS` 一致
- [ ] national resources 与 `NationalResources` 一致
- [ ] province 初始值不再由 `seedData.ts` 二次修正
- [ ] faction 初始值不再由 `seedData.ts` 二次修正
- [ ] 所有跨文件 ID 都存在
- [ ] 粮食规则与 `monthly_loop.json.food_upkeep` 一致
- [ ] 叛乱阈值与月度循环文档一致
- [ ] 不存在旧的 `imperial` 普通势力定义
- [ ] 不存在旧的30岁开局定义

## 11. 修改流程

修改 Data 后：

```text
修改 data
  ↓
检查 GameState 类型
  ↓
检查 seedData
  ↓
检查 Engine 引用
  ↓
检查 GDD / Gameplay
  ↓
全仓库搜索旧值 / 旧 ID
  ↓
运行 Prototype
```

这是项目的 Data V0.5 基线。暂不加入 GitHub Actions，先通过本地/Agent 检查验证流程。
