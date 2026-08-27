# Data Schema V0.4

> 目的：明确 `data/` 是新游戏初始数据与可配置规则的 Source of Truth。Runtime TypeScript 负责加载、校验、执行，不再偷偷定义同一份初始数值。

## 1. Source of Truth 分层

| 文件 | 负责内容 |
|---|---|
| `national_resources.json` | 国家新游戏初始资源 |
| `factions.json` | 四大普通势力新游戏初始状态 |
| `provinces.json` | 五州新游戏初始状态 |
| `monthly_loop.json` | 时间、月度循环、叛乱阈值等规则参数 |
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

禁止在 factions.json 增加 `imperial`。

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

## 5. Rule

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

## 6. Runtime 职责

Runtime 可以：

- 校验 ID
- 校验必填字段
- 转换命名格式
- 根据运行时规则计算变化
- 执行 Effect
- 推进月度循环

Runtime 不应该：

- 重新定义 Data 中已有的初始值
- 用魔法数字覆盖 Data
- 在 UI 中直接修改国家状态

## 7. 设计规则与运行规则的区别

Data 中的初始值属于配置。

例如：

```text
北朔州 security = 55
```

Engine 中的运行规则可以让它下降：

```text
旱灾 → security - 5
```

这是允许的，因为 `-5` 是运行时 Effect，而不是隐藏的初始值。

## 8. ID 引用规则

任何跨文件引用必须引用已有 ID：

```text
factionId → factions.json
provinceId → provinces.json
effectId → effects.json
eventId → events.json
skillId → policy_skills.json
```

删除或重命名 ID 时必须全仓库搜索引用。

## 9. V0.4 校验清单

手动运行数据一致性检查时至少验证：

- [ ] factions 恰好4个
- [ ] provinces 恰好5个
- [ ] faction ID 与 `GameState.FACTION_IDS` 一致
- [ ] province ID 与 `GameState.PROVINCE_IDS` 一致
- [ ] national resources 与 `NationalResources` 一致
- [ ] province 初始值不再由 `seedData.ts` 二次修正
- [ ] faction 初始值不再由 `seedData.ts` 二次修正
- [ ] 所有跨文件 ID 都存在
- [ ] 叛乱阈值与月度循环文档一致
- [ ] 不存在旧的 `imperial` 普通势力定义
- [ ] 不存在旧的30岁开局定义

## 10. 修改流程

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

这是项目的 Data V0.4 基线。暂不加入 GitHub Actions，先通过本地/Agent 检查验证流程。
