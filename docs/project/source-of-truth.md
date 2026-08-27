# 项目事实源与文档同步规范

> 这是本项目以后解决“Demo、数据、GDD 不一致”问题的唯一规范。

## 1. 当前已确认的事实

| 项目 | 当前事实 | 事实来源 |
|---|---|---|
| 初始皇帝年龄 | **20岁** | `prototype/src/engine/GameState.ts` + `data/monthly_loop.json` |
| 一局长度 | **30年 / 360个月** | `data/monthly_loop.json` |
| 州数量 | **5州** | `data/provinces.json` / Prototype |
| 普通势力数量 | **4个** | `data/factions.json` / Prototype |
| 普通势力 | 士族、武将、百姓、豪强 | `data/factions.json` |
| 皇权 | 国家级资源，不作为普通Faction | `GameState.ts` |
| Prototype当前版本 | **V0.3：建国危局与五年求生** | `prototype/README.md` |
| 月度倒计时 | **120秒**（当前Prototype机制） | `prototype/README.md` |
| 当前原型重点 | 主城区建筑、五州生产、资源短缺、急报、事件队列、危机压力、提前败局 | `prototype/README.md` |

## 2. 文档分工

### README.md

只回答：

- 这是什么游戏？
- 当前做到哪里？
- 下一步做什么？
- 文档在哪里？

README 不维护容易频繁变化的具体数值。

### GDD.md

回答：

> 游戏最终想成为什么。

描述核心玩法、设计原则、玩家体验、长期目标。

不要在 GDD 中重复大量实现细节。

### docs/gameplay/

回答：

> 某个系统应该怎么工作。

例如月度循环、事件、势力、圣旨、Effect、叛乱、政策树。

### docs/development/

回答：

> 当前应该怎么开发，以及什么时候算完成。

### data/

回答：

> 当前可执行的具体规则和数值是什么。

**可执行数值优先以 data 为准。**

### prototype/

回答：

> 当前 Demo 实际做到了什么。

Prototype README 记录实际实现状态，不代表最终设计一定如此。

## 3. Demo测试后，修改意见怎么同步

以后用户试玩 Demo 后提出修改意见，先把意见分类，不要直接到处改数字。

### A. 数值调整

例如：

> “初始粮食太少，第一年压力太大。”

同步：

1. `data/*.json` —— 修改实际数值
2. `docs/gameplay/相关系统.md` —— 如果该数值属于设计规则，更新规则说明
3. `prototype/README.md` —— 如果影响当前玩法说明则更新
4. `README.md` —— 只有影响当前版本状态时才更新

### B. 机制修改

例如：

> “120秒倒计时太长，应该改成60秒。”

同步：

1. `docs/gameplay/相关系统.md` —— 记录机制变化
2. `docs/development/prototype-v0.1.md` —— 更新开发/验收标准
3. `data/*.json` —— 如果倒计时属于配置
4. Prototype代码 —— 实现修改
5. `prototype/README.md` —— 更新实际行为

### C. 核心设计修改

例如：

> “皇帝初始年龄从30岁改为20岁。”

这是核心规则变更，需要同步：

1. `data/monthly_loop.json`
2. `prototype/src/engine/GameState.ts`
3. `docs/GDD.md`
4. `docs/development/prototype-v0.1.md`
5. `README.md`（如果首页描述了该规则）
6. `prototype/README.md`

### D. 纯UI意见

例如：

> “奏折区域太小。”

通常只改：

- Prototype UI代码
- 必要时记录到开发任务

**不需要修改 GDD。**

### E. 新功能需求

例如：

> “增加一个可以让士族捐钱的仁政技能。”

先写设计，再写代码：

1. GDD / Gameplay —— 明确为什么存在、怎么玩
2. Development —— 增加开发任务和验收标准
3. data —— 定义技能和Effect数据
4. Prototype —— 实现
5. Prototype README —— 更新当前实现状态

## 4. 推荐同步顺序

每次 Demo 试玩反馈统一走：

```text
试玩反馈
 ↓
判断：Bug / 数值 / 机制 / UI / 新功能
 ↓
记录设计决定
 ↓
更新 Gameplay / GDD
 ↓
更新 Development Checklist
 ↓
修改 data
 ↓
修改 Prototype
 ↓
测试
 ↓
更新 Prototype README
 ↓
必要时更新根 README
```

## 5. 一个重要规则：不要让聊天记录成为事实源

聊天讨论中的内容只有在明确写入仓库后，才算正式设计决定。

如果出现：

```text
聊天里说 A
GDD 写 B
Demo 实现 C
```

必须先停止继续扩展，进行一次同步。

## 6. 版本规则

版本分为三类：

- **GDD / Gameplay 版本**：代表设计规则变化
- **Prototype 版本**：代表 Demo 实现状态
- **Data 版本**：代表可执行规则变化

三者不要求版本号完全相同，但必须在文档中明确当前状态。

## 7. 当前同步结论

本次检查确认最重要的不一致是：

```text
旧文档：30岁登基
实际Prototype：20岁登基
```

已将 `data/monthly_loop.json` 的 `starting_age` 同步为 **20**。

同时确认：

```text
旧设计：五大势力（把皇权算作势力）
当前Prototype：四大普通势力 + 皇权国家资源
```

以后按照“四大势力 + 皇权资源”作为当前Prototype事实源，除非未来重新做设计决策。
