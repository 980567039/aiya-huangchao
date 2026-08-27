# 项目事实源与文档同步规范

> 这是本项目解决“Demo、数据、GDD 不一致”问题的唯一规范。

## 1. 当前已确认的事实

| 项目 | 当前事实 | 事实来源 |
|---|---|---|
| 初始皇帝年龄 | **20岁** | `prototype/src/engine/GameState.ts` + `data/monthly_loop.json` |
| 一局长度 | **30年 / 360个月** | `data/monthly_loop.json` |
| 州数量 | **5州** | `data/provinces.json` / Prototype |
| 普通势力数量 | **4个** | `data/factions.json` / Prototype |
| 普通势力 | 士族、武将、百姓、豪强 | `data/factions.json` |
| 普通势力初始满意度 | **全部100** | `data/factions.json` |
| 皇权 | 国家级资源，不作为普通Faction | `GameState.ts` |
| 主城建筑 | **6类，独立Lv.1～Lv.5** | `data/buildings.json` |
| 军队粮耗 | **每名士兵每月0.05粮食** | `data/monthly_loop.json` |
| 兵营粮耗 | **每级每月300粮食** | `data/monthly_loop.json` |
| 粮荒后果 | 农民损失、士兵损失、百姓/武将满意度下降、地方压力上升 | `prototype/src/engine/FoodSystem.ts` |
| 当前Prototype重点 | 势力生存、主城建筑、粮食压力、奏折、事件、危机压力、提前败局 | `docs/development/prototype-v0.4.md` |

## 2. 文档分工

### README.md

只回答：这是什么游戏、当前做到哪里、下一步做什么、文档在哪里。

### GDD.md

回答：游戏最终想成为什么。描述核心玩法、设计原则、玩家体验、长期目标。

### docs/gameplay/

回答：某个系统应该怎么工作，例如月度循环、事件、势力、圣旨、Effect、叛乱、政策树。

### docs/development/

回答：当前应该怎么开发，以及什么时候算完成。当前 V0.4 实施基线见 `docs/development/prototype-v0.4.md`。

### data/

回答：当前可执行的具体规则和数值是什么。**可执行数值优先以 data 为准。**

### prototype/

回答：当前 Demo 实际做到了什么。Prototype README 记录实际实现状态，不代表最终设计一定如此。

## 3. Demo测试后，修改意见怎么同步

以后用户试玩 Demo 后提出修改意见，先分类，不要只改一个地方。

### A. 数值调整

同步：

1. `data/*.json`
2. 对应 `docs/gameplay/` 规则
3. Development 验收标准
4. Prototype 实现 / 测试
5. 必要时更新 README

### B. 机制修改

同步：

1. `docs/gameplay/`
2. `docs/development/`
3. `data/*.json`（如果属于配置）
4. Prototype Engine
5. Prototype UI
6. Prototype README

### C. 核心设计修改

必须同步：

1. `docs/GDD.md`
2. `docs/gameplay/`
3. `docs/development/`
4. `data/*.json`
5. `prototype/src/engine/`
6. `prototype/src/`
7. `prototype/README.md`
8. 必要时根 README
9. 在 `docs/project/change-log/` 留下变更记录

### D. 纯UI意见

通常修改 Prototype UI；只有当 UI 暴露出设计问题时才同步 GDD / Gameplay。

### E. 新功能需求

先设计再开发：

1. GDD / Gameplay
2. Development Checklist
3. Data
4. Engine
5. UI
6. Prototype README
7. 测试

## 4. 推荐同步顺序

```text
试玩反馈
 ↓
Bug / 数值 / 机制 / UI / 新功能
 ↓
明确设计决定
 ↓
更新 GDD / Gameplay
 ↓
更新 Development
 ↓
更新 Data
 ↓
修改 Engine / UI
 ↓
全仓库搜索旧规则
 ↓
测试
 ↓
更新 Prototype README / Change Log
```

## 5. 不允许的情况

如果出现：

```text
聊天说 A
GDD 写 B
Data 写 C
Demo 实现 D
```

必须停止继续扩展，先完成同步。

Agent 不允许只修改自己当前正在编辑的文件然后宣称需求完成。

## 6. 当前变更基线

2026-08-27 已确认：

```text
20岁登基
30年 / 360个月
5州
4普通势力 + 皇权国家资源
四大势力初始满意度100
6类主城建筑，每座Lv.1～Lv.5
军队与兵营消耗粮食
粮荒会损失农民和士兵，并降低百姓、武将满意度
```

具体变更见 `docs/project/change-log/2026-08-27-faction-food-capital.md`。
