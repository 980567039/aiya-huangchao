# 《哎呀，朕的皇朝怎么又亡啦》统一 Effect 系统 V0.3

> 状态：程序设计基线
> 目标：让技能、圣旨、奏折选择、事件、战争、叛乱共用一套效果模型。

## 1. 核心原则

所有改变游戏状态的行为，最终都转换成 Effect。

```text
玩家行为
  ↓
Action
  ↓
Effect
  ↓
State Change
  ↓
Event Hook
```

因此“天下共济”“强行征税”“旱灾”“东瀛战争胜利”虽然来源不同，但底层都可以修改同一组国家状态。

## 2. State 分类

### 国家级

- treasury：国库
- food：粮食
- weapons：兵器
- army：军队
- authority：皇权
- prestige：声望
- stability：国家稳定

### 势力级

- satisfaction：满意度
- influence：影响力
- wealth：财富
- organization：组织力
- resentment：积怨
- fear：恐惧

### 州级

- population
- food
- treasury
- security
- morale
- corruption
- gentry_influence
- landlord_influence
- military_presence
- local_loyalty
- rebellion_risk

### 时间状态

- duration
- cooldown
- temporary_modifiers

## 3. Effect 类型

V0.3 第一版支持：

- `resource_delta`：资源增减
- `faction_satisfaction`：势力满意度变化
- `faction_influence`：势力影响力变化
- `faction_wealth`：势力财富变化
- `state_modifier`：添加临时状态
- `province_modifier`：修改州状态
- `spawn_event`：触发后续事件
- `reduce_rebellion`：降低叛乱风险
- `increase_rebellion`：提高叛乱风险
- `unlock_skill`：解锁技能
- `start_war`：进入战争事件
- `create_memorial`：生成奏折

## 4. Effect 示例

### 天下共济

```json
{
  "type": "resource_delta",
  "target": "treasury",
  "formula": "donation_amount"
}
```

同时：

```text
士族满意度 -2
豪强满意度 -4
皇权 -1
```

之后根据结果概率触发：

`豪商主动捐献` / `士绅阳奉阴违` / `地方拒捐`

### 强行征税

```text
国库 +5000
百姓满意度 -8
豪强满意度 -6
民心 -10
```

并增加：

`tax_resistance` 状态

## 5. Modifier

不要直接修改基础值。

例如：

```text
food_consumption = base_consumption × (1 + modifiers)
```

技能“军屯”提供：

```text
army_food_consumption -15%
```

“天下无敌”提供：

```text
war_success +20%
rebellion_suppression +30%
```

## 6. 条件系统

Effect 可以带条件。

```text
if authority >= 60
if province.food < 40
if faction.satisfaction < 30
if skill.unlocked == true
```

支持 AND / OR。

## 7. Formula 系统

关键效果不写死数值，而使用公式。

例如募捐：

```text
donation = base_amount
          × authority_modifier
          × public_morale_modifier
          × faction_satisfaction_modifier
          × wealth_modifier
```

这样同一个技能在不同国家状态下会产生不同结果。

## 8. Event Hook

Effect 执行后允许监听后续事件。

例如：

```text
抄没家产
 ↓
豪强财富下降
 ↓
豪强积怨增加
 ↓
触发“豪强密谋”概率提高
 ↓
生成奏折
```

## 9. Action 与 Effect 的区别

Action 是“玩家做了什么”。

Effect 是“这个行为造成了什么”。

例如：

```text
Action: issue_edict(common_good)

Effects:
- treasury +X
- food +Y
- gentry satisfaction -2
- landlord satisfaction -4
- authority -1
- possible event: donation_success
```

这样 UI、日志、存档、回放都可以记录 Action，而模拟器只处理 Effect。

## 10. V0.3 验收标准

至少实现以下完整链路：

1. 玩家解锁“天下共济”
2. 玩家发布圣旨
3. Effect 系统计算实际募捐
4. 势力状态改变
5. 可能生成后续事件
6. 事件可以生成奏折
7. 奏折可以再次产生 Action
8. Action 再进入 Effect
9. 所有变化写入历史日志

最终形成：

`技能 → 圣旨 → Effect → 势力 → 事件 → 奏折 → 决策 → Effect`

这条闭环是进入正式原型开发前必须跑通的核心链路。
