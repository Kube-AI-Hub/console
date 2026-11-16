# 列表「显示列」接入（配置/保密/服务账号/存储）

> 继续 R-31「列显隐」这条能力线。日期 2026-11-16。
> 规格：prd|design/kube-frontend/configmaps/list.md（AC-CONFIGMAPS-LIST-11、DEC/GOT-11）。

## 1. 本批范围（4 个列表）

| 页面 | 可隐藏列 | 说明 |
| --- | --- | --- |
| 配置字典 | 3（项目/字段/创建时间） | 名称不可隐藏 |
| 保密字典 | 4 | 同上 |
| 服务账号 | 4 | 同上 |
| 项目存储（PVC/快照等 kind） | 6 | 页面键按 kind 区分 |

## 2. 接入分两步（这轮踩到的坑）

1. schema 上声明 `columnVisibility`（标签/重置标签/aiId）；
2. 给需要可隐藏的列标 `hideable: true`。

只做第一步时，选择器里**只有「重置」一项**——`ResourceList` 只渲染 `hideable` 的列，而默认列都没标。
第一轮探测就撞上了这个（菜单项只有 `:columns:reset`），补上 `hideable` 后菜单立刻正常。

## 3. 实测（B200 host，admin，项目 default）

| 步骤 | 结果 |
| --- | --- |
| 打开「显示列」 | 菜单项：`configmaps:columns:project` / `:keys` / `:createTime` / `:reset` |
| 取消「项目」 | 表头 6 → 5 行，`localStorage['kube-frontend.columns.configmaps'] = ["name","keys","createTime"]` |
| 点「重置」 | 表头恢复 6 |
| 名称列 | 不在可隐藏菜单里 |

## 4. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过（4 页） | 旧 console 的「列设置」在这些列表都有 |
| 交互 | 通过 | 用例逐页验证：菜单项、表头数变化、持久化、刷新后保持、重置恢复 |
| 视觉 | 通过（人工） | `/tmp/columns-menu.png` |
| 静态/类型/构建/测试 | 通过 | scoped 门禁 0/0；console-next tsc 0；vite build ✓；新用例 passed（12.42s）；四模块串行回归见下 |
| 未验收 | — | 其余 43 个多列列表仍未接入；浅色主题、部署环境、member 与全站串行 E2E |

## 5. 剩余

还有 43 个多列列表没有「显示列」（集群网关、告警策略、商店管理、联邦、工作负载等）。接入方式已经固定为两步，
每页改动约 3 处（import、schema、ResourceList props）+ 列上的 `hideable`。

## 6. 第二批（同日）：告警策略 / 联邦项目 / 集群告警消息

| 页面 | 可隐藏列 | 页面键 | 表格 aiId |
| --- | --- | --- | --- |
| 告警策略 | 4（启用/规则数/类型/创建时间） | `rule-groups` | `alertingrules:surface` |
| 联邦项目 | 4（命名空间/集群/传播状态/创建时间） | `federated-projects` | `federated-projects:surface` |
| 集群告警消息 | 6（摘要/状态/级别/规则组/来源/触发时间） | `cluster-alerting-messages` | 同名 |

用例 `CONFIGMAPS-LIST-11` 已扩到 **7 个页面**（前四个 + 这三个），逐页验证菜单项、取消勾选后表头减一、
持久化、刷新后保持、重置恢复，并断言名称列不在可隐藏菜单里（25.73s）。

第二批踩到的两个坑：

1. **hook 必须放在 schema 之后**：`columnKeys` 依赖 `schema.columns`，放在 `const state =` 之前（schema 之前）会报
   「used before its declaration」。
2. **surface 的 aiId 未必等于前缀**：告警策略页的 surface 是 `alertingrules:surface`，而列菜单前缀是
   `rule-groups`；用例需要为每页单独给出 surface 前缀。

## 7. 仍待接入

约 40 个多列列表（集群网关 17 列、商店管理 3 张表、多集群列表、工作空间成员、JuiceFS、集群自定义监控等）。
商店管理这类**一页多表**的页面需要为每张表分别接线，不能套用单表脚本。

## 8. 回归中两条 access-control 失败（已确认非本批引入）

三模块串行回归出现 2 条失败：`ACCESS_CONTROL_USERS_05`、`ACCESS_CONTROL_WORKSPACE_CONSOLE_05`（用户组名称生成的
等待超时）。单独串行重跑这两条 **2 passed（26.15s）**，且本批没有改动访问控制相关页面——属于长跑/并发下的
等待敏感用例，与列显隐改动无关。这与「长跑退化」的记录一致：判定按「失败单条复跑」。
