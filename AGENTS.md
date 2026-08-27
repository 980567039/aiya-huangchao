# AGENTS.md — AIYA Huangchao Agent Development Rules

> 本文件是本仓库对 Codex、Claude Code、Cursor Agent 及其他 Coding Agent 的项目级开发规范。
> **所有 Agent 在修改代码、数据或文档前必须阅读并遵守本文件。**

## 1. 核心原则：修改必须同步

本项目不是“代码优先、文档随便”的项目。

任何会改变游戏规则、数值、玩法、流程、UI 所表达的游戏状态或版本目标的修改，都必须检查所有受影响的文档、数据和 Prototype。

**禁止只修改 Demo / Prototype 而不检查设计文档。**

用户提出修改意见后，Agent 必须先判断修改影响范围，再实施修改。

---

## 2. Source of Truth 层级

当不同文件出现冲突时，按照以下优先级判断：

1. 用户最新明确确认的设计决定
2. `docs/project/source-of-truth.md`
3. `data/` 中的实际游戏配置
4. `docs/gameplay/` 中的机制定义
5. `docs/GDD.md` 中的总体设计
6. `prototype/` 中的当前实现
7. `README.md` / `docs/project/current-state.md` 中的项目状态说明

注意：Prototype 是“当前实现”，不是天然的设计真相。如果 Demo 与用户最新决定冲突，应修改实现和受影响文档，而不是反过来迁就代码。

---

## 3. 修改前必须做影响分析

收到需求后，先判断属于哪一类：

- Bug 修复
- 数值调整
- 游戏机制调整
- 新机制
- 删除机制
- UI / UX 调整
- 新事件 / 新技能 / 新圣旨
- 版本目标调整
- 项目结构 / 技术架构调整

然后搜索仓库中相关术语、旧值、字段和规则，确认影响范围。

**不能因为“只改一个数字”就假设只影响一个文件。**

---

## 4. 修改同步矩阵

| 修改类型 | 必须检查 / 同步 |
|---|---|
| 核心游戏规则 | GDD + Gameplay + Data + Prototype |
| 数值修改 | Data + 对应 Gameplay + Prototype |
| 新机制 | GDD + Gameplay + Development + Data + Prototype |
| 删除机制 | GDD + Gameplay + Development + Data + Prototype |
| 技能修改 | Policy Gameplay + skills data + Prototype |
| 新事件 | Event Gameplay + events data + Prototype + Development |
| 资源规则 | GDD + Gameplay + resources data + Prototype |
| 时间规则 | GDD + Monthly Loop + Data + Prototype |
| 势力规则 | GDD + Faction Gameplay + Data + Prototype |
| 叛乱规则 | Gameplay + Data + Prototype + 测试计划 |
| UI / UX | Prototype；如果改变玩法含义则同时更新 Gameplay |
| Bug 修复 | Prototype；若暴露规则与文档不一致，则同步规则文档 |
| 平衡性调整 | Data + Gameplay + Prototype + 测试记录 |
| 版本 / Roadmap | README + Development + Current State |
| 项目结构 | README + AGENTS + 相关 Development 文档 |

如果某一项不适用，可以不修改，但必须确认“不适用”的原因。

---

## 5. 用户试玩反馈的标准流程

用户可能只会说一句：

> “武将太强了。”

Agent 不能直接修改一个数值后结束。

必须执行：

```text
用户反馈
 ↓
判断问题类型
 ↓
全仓库搜索相关规则
 ↓
确定 Source of Truth
 ↓
提出 / 确认规则变化（如果需要）
 ↓
修改 Data
 ↓
修改 Gameplay / GDD
 ↓
修改 Prototype
 ↓
修改 Development Checklist（如果开发任务变化）
 ↓
更新 Current State / README（如果项目状态变化）
 ↓
全仓库搜索旧规则
 ↓
运行 / 测试
 ↓
汇报修改文件和验证结果
```

如果用户已经明确要求“直接改”，无需重复询问确认，但仍必须执行同步检查。

---

## 6. 数值规则：不要在多个地方硬编码

容易变化的核心数值应尽量只有一个实际配置来源。

例如：

```text
starting_age
monthly_army_food_cost
rebellion_threshold
skill_cost
```

优先放入 `data/`。

代码读取配置，而不是在多个 TypeScript 文件中复制数字。

文档应描述“规则”，而不是维护一份与代码完全重复的数字表。

如果某个数字属于设计决策且必须在文档中展示，必须注明其数据来源。

---

## 7. 设计与当前实现必须区分

最终游戏设计和当前 Prototype 可以不同，但必须明确标识。

例如：

```text
最终设计：30年一局
Prototype：当前开放5年测试
```

这是允许的。

但以下情况禁止存在：

```text
GDD：初始年龄30岁
Data：20岁
Prototype：20岁
README：30岁
```

如果 Demo 已经发生了正式设计变更，应更新相关文档；如果只是临时测试值，应明确写成 Prototype Test Value，不能冒充最终规则。

---

## 8. 文档职责

- `README.md`：项目入口、项目简介、当前状态、路线图
- `docs/GDD.md`：最终总体游戏设计
- `docs/gameplay/`：具体机制规则
- `docs/development/`：如何实现、开发顺序、验收标准
- `docs/project/source-of-truth.md`：规则来源、冲突处理原则
- `docs/project/current-state.md`：当前 Prototype 实际状态
- `data/`：实际可运行数据配置
- `prototype/`：当前可运行实现
- `AGENTS.md`：所有 Agent 必须遵守的协作和同步规则

---

## 9. 完成修改前的强制 Checklist

Agent 在结束任务前必须检查：

- [ ] 是否改变了游戏规则？
- [ ] 是否搜索了相关旧规则 / 旧数值？
- [ ] 是否确认了 Source of Truth？
- [ ] 是否同步了 Data？
- [ ] 是否同步了 Gameplay？
- [ ] 是否需要同步 GDD？
- [ ] 是否需要同步 Development？
- [ ] Prototype 是否与规则一致？
- [ ] README / Current State 是否需要更新？
- [ ] 是否还有旧值或旧规则残留？
- [ ] 是否进行了基本测试？
- [ ] 最终报告是否列出了修改文件？

**没有完成影响范围检查，不得声称任务已完成。**

---

## 10. 不要为了同步而制造重复

同步不意味着所有文档复制相同内容。

推荐：

```text
Data
= 实际数值

Gameplay
= 规则和公式

GDD
= 为什么这样设计 / 玩家体验目标

Development
= 怎么开发和怎么验收

Current State
= Demo 当前到底实现了什么
```

同一个事实只保留一个主要来源，其余文档通过引用、说明或摘要表达。

---

## 11. 用户最新意见优先

如果用户试玩 Demo 后明确提出新的设计意见，该意见视为新的设计输入。

Agent 必须：

1. 记录变化
2. 更新对应规则
3. 同步受影响文件
4. 保留必要的历史 / 版本信息

不得因为旧 GDD 写过相反内容，就继续实现旧规则。

---

## 12. 不确定时先搜索，不要猜

如果 Agent 不确定：

- 当前版本是多少
- 某个数值在哪里定义
- 某个机制是否已经实现
- 哪份文档是最新的
- 用户之前是否修改过规则

必须先搜索仓库。

**不要根据记忆或单个文件推断整个项目状态。**

---

## 13. 提交说明

Commit message 应说明实际修改的性质，例如：

```text
feat: add monthly event effects
fix: correct rebellion threshold
balance: increase army maintenance cost
docs: sync prototype rules
refactor: centralize game state config
```

如果一次用户需求同时改变代码、数据和文档，可以使用一个清晰的整体 commit，也可以拆成多个逻辑 commit，但不能遗漏同步。

---

## 14. 最终目标

本仓库必须始终保持：

```text
用户最新设计决定
        ↓
   设计文档
        ↓
    游戏规则
        ↓
      Data
        ↓
   Prototype
        ↓
      测试
        ↓
    用户试玩
        ↓
    新的反馈
        └────────→ 回到顶部
```

**任何 Agent 都不是只负责“把代码改好”，而是负责让“设计、数据、代码、文档、测试”保持一致。**
