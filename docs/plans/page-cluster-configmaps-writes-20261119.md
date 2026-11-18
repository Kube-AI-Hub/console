# 集群级配置字典写能力（2026-11-19）

> 本页记录：集群作用域「配置字典」页补回旧 console 的四个行操作（编辑信息 / 编辑 YAML / 编辑设置 / 删除），
> 写按行所属项目寻址，联邦托管对象不渲染操作。方法见[迁移指南](../legacy-ui-migration-guide.md)，
> 模板见[单页交付模板](page-migration-template.md)。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 集群作用域：在跨项目列表里找到某个配置字典后**就地修改或删除**，不必再跳一次项目页 |
| 旧入口、源码 | `clusters/containers/ConfigMaps/index.jsx:45-80`（编辑信息 / 编辑 YAML / 编辑设置 / 删除） |
| 新入口、构建 | `apps/console-next/src/pages/cluster/ClusterConfigMapsPage.tsx`：行操作 + 复用项目页的四个对话框（编辑信息/编辑 YAML/编辑设置/删除确认） |
| 环境、集群、角色 | mlu370 `https://ka.watering.ai` + 本地 preview 5178；admin |
| 子页面与状态范围 | 普通行（四项操作）/ 联邦托管行（无操作）/ 写入失败（MutationAlert 显示服务端原因）/ 详情按需加载（LoadingDialog） |
| 明确排除及批准 | 不做跨项目**批量**删除（一次确认说不清「哪些项目的哪些对象」，旧页也没有）；不逐行做 SSAR（见 DEC） |
| 并行文件与安全边界 | 只改该页、该功能 PRD/design/spec/tests 与记录；E2E 在 default 建唯一命名对象并删除 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码证据 | 显示条件 | 字段/动作 | 归宿 | 新 AC/用例 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CLUSTER-CM-001 | `ConfigMaps/index.jsx:45-80` | 非联邦托管行 | 编辑信息（别名/描述 → merge-patch 注解） | 行操作 `editInfo` + `ConfigMapEditInfoDialog` | AC-CLUSTER_CONFIG-03 / TC-03 | 通过 |
| LEG-CLUSTER-CM-002 | 同上 | 同上 | 编辑 YAML（整对象 PUT） | `editYaml` + 懒加载 `ConfigMapYamlDialog` | 同上 | 通过 |
| LEG-CLUSTER-CM-003 | 同上 | 同上 | 编辑设置（data 键值） | `editSettings` + `ConfigMapEditSettingsDialog` | 同上 | 通过 |
| LEG-CLUSTER-CM-004 | 同上 | 同上 | 删除（输入名称确认） | `delete` + `ConfigMapDeleteDialog` | 同上 | 通过 |
| LEG-CLUSTER-CM-005 | 老页 `isFedManaged` | 联邦托管对象 | 不渲染行操作 | `visible: (row) => !row.federated` | 同上（单测断言无菜单按钮） | 通过 |

## 3. 数据契约与全链路

| 能力 ID | 请求 | 返回类型 | 字段 | 显示/写 | 缺值规则 | 对账 |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `PATCH /api/v1/namespaces/<行ns>/configmaps/<name>`（body `{metadata:{annotations}}`） | JSON | `kubesphere.io/alias-name`、`kubesphere.io/description` | 行操作对话框 | 清空键发 `null`（沿用项目页） | E2E 回读描述注解 |
| 002–003 | `PUT /api/v1/namespaces/<行ns>/configmaps/<name>` | JSON | 整对象 | YAML / data 编辑器 | 带 `resourceVersion` | 同上 |
| 004 | `DELETE /api/v1/namespaces/<行ns>/configmaps/<name>` | JSON | — | 删除确认 | 按行命名空间 | E2E 用**列表**确认消失（该部署对缺失对象返回 500 而非 404） |
| 005 | — | — | `federated` | 隐藏操作 | — | 单测断言联邦行无「更多操作」按钮 |

## 4. 交互、视觉与复用基线

- 行操作顺序与项目页一致：编辑信息 → 编辑 YAML → 编辑设置 → 删除（肌肉记忆）。
- 打开详情前先出对话框骨架（LoadingDialog），避免「点了没反应」。
- 写失败由 `MutationAlert` 显示服务端原因（403 会带命名空间与资源）。

## 5. 编码与回归

- [x] AC/design/spec/tests 同步；生成物重跑（503 篇）。
- [x] 复用项目页四个对话框，不复制表单。
- [x] 单测：联邦行不渲染操作、普通行四项齐全（`test/cluster-configmaps-writes.test.tsx`）。
- [x] E2E：建 → 搜索 → 编辑信息回读 → 删除并确认消失。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 5 条原子 ID | — |
| 数据语义 | 通过 | 按行命名空间寻址；注解回读一致 | — |
| 交互与权限 | 通过 | 四项操作、联邦保护、失败可见 | 真实非 admin 403 分支未在部署验证（靠服务端原因显示） |
| 视觉与主题 | 部分通过 | 1280 深色截图（`cluster-configmaps-writes`） | 1024/1600、浅色、英文 |
| 静态/类型/构建/测试 | 通过 | typecheck 0；单测含新增 1 条；契约套件；build；strict 门禁 0/0 | — |
| 本地全栈/mlu370 | 通过 | E2E 见 §7 | — |
| 新版部署/member/全站 | 未验收 | — | 生产、member、全站串行 E2E |

## 7. E2E（mlu370，`-n 0`）

| 用例 | 结果 |
| --- | --- |
| TC-…-CLUSTER_CONFIG-03（新增：行操作 + 编辑回读 + 删除确认） | 通过（7.80s） |
| CLUSTER_CONFIG 既有用例（01/02） | 通过 |

命令：`pytest tests/kube-frontend/cluster-management -q -n 0 -k "CLUSTER_CONFIG"` → **4 passed, 137 deselected in 34.84s**。
