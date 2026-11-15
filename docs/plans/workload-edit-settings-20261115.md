# 工作负载「编辑设置」：资源限额与更新策略 · 交付记录 2026-11-15

按[交付模板](page-migration-template.md)记录的完整迁移单元：应用负载详情「编辑设置」弹窗补齐**容器资源限额**与**更新策略**两组字段。

## 1. 基线

- 分支 `develop`；环境 B200 host 集群，BFF :8092 + 前端 :5178，admin。
- 选择依据：能力矩阵 CHECK-04「日常资源完整表单、详情、创建与写闭环」。老 console 的编辑设置包含容器资源与更新策略，新 UI 的编辑弹窗此前只有镜像/拉取策略/环境变量/副本数，设置资源必须走 YAML。
- 旧实现依据：`src/actions/volume.js` 之外的相关文件为 `src/components/Forms/Workload/ContainerSettings`（requests/limits）与 `ContainerSettings/UpdateStrategy`（策略前缀 `STRATEGIES_PREFIX`：部署 `spec.strategy`，有状态副本集/守护进程集 `spec.updateStrategy`）。

## 2. 原子能力与归宿

| ID | 旧能力 | 新落点 | AC/TC | 结论 |
| --- | --- | --- | --- | --- |
| ES-01 | 编辑设置弹窗（镜像/拉取策略/环境变量/副本数） | 详情「编辑设置」 | EDIT_SETTINGS-01 | 保留 |
| ES-02 | 容器 CPU/内存请求与上限 | 弹窗「资源限额」分组 | EDIT_SETTINGS-03 / `…-03` | 本批补齐 |
| ES-03 | 更新策略（部署 RollingUpdate/Recreate；有状态副本集与守护进程集 RollingUpdate/OnDelete，含 maxUnavailable/maxSurge/partition） | 弹窗「更新策略」分组 | EDIT_SETTINGS-04 / `…-04` | 本批补齐 |
| **ES-04** | 选择节点（nodeSelector）、容器组标签、容器组注解 | 弹窗「高级设置」分组（三组共用键值编辑器） | EDIT_SETTINGS-05 / `…-05` | **本批补齐** |
| **ES-05** | 健康检查（存活/就绪/启动，HTTP/TCP/命令）与优雅终止（terminationGracePeriodSeconds） | 弹窗「健康检查」与「优雅终止」 | EDIT_SETTINGS-06 / `…-06` | **本批补齐** |
| **ES-06** | 存储挂载（临时卷/节点路径/持久卷声明/配置字典/保密字典 + 容器挂载点） | 弹窗「存储挂载」与每容器「挂载」两层 | EDIT_SETTINGS-07 / `…-07` | **本批补齐** |
| ES-07 | 容器组安全上下文、IP 池 | — | — | **待补**（仍走编辑 YAML，见 §7） |

## 3. 数据语义

- 存储挂载分两层：容器组上的 `spec.template.spec.volumes`（卷定义）与容器上的 `volumeMounts`（挂载点）。五种来源：临时卷 `emptyDir:{}`、节点路径 `hostPath.path`、持久卷声明 `persistentVolumeClaim.claimName`、配置字典 `configMap.name`、保密字典 `secret.secretName`。挂载只能选已定义的卷；卷名 DNS-1123 且唯一，挂载路径须绝对且同容器内不重复。删除卷时其挂载一并消失（读者需自行删除容器上的挂载行，页面在校验里提示）。

- 健康检查：三种探针（`livenessProbe`/`readinessProbe`/`startupProbe`）各自可启用；方式为 HTTP（`httpGet.scheme/path/port`）、TCP（`tcpSocket.port`）或命令（`exec.command`）。未启用即删除该键——写一个空探针会让容器多出一个永远成功的检查。只写表单填过的阈值，其余交给服务端默认（实测回读会补 `timeoutSeconds:1`/`periodSeconds:10`/`failureThreshold:3`）。
- 优雅终止：`spec.template.spec.terminationGracePeriodSeconds`；留空即删除该字段（用集群/镜像默认），非整数在本地拒绝。

- 高级设置：`spec.template.spec.nodeSelector`（键值映射）、`spec.template.metadata.labels`、`spec.template.metadata.annotations`（容器组模板上的标签与注解）；三者留空时删除对应字段。容器组标签必须保留 `spec.selector.matchLabels` 的每一个键值——选择器创建后不可变，本地比较后缺一个就禁用保存并说明（实测：移除后错误提示出现且保存按钮禁用）。

- 资源：只写 `resources.requests` / `resources.limits` 的 `cpu`、`memory` 四个键；容器上其它资源键（hugepages、GPU 厂商资源）原样保留；四个字段全空时不再写 requests/limits（apiserver 会把 `resources` 规范化为 `{}`，属服务端默认值）。
- 策略：按 kind 取 `spec.strategy` 或 `spec.updateStrategy`；`type` 之外的滚动参数按 kind 取 `maxUnavailable`/`maxSurge`（部署）、`partition`（有状态副本集）、`maxUnavailable`（守护进程集）；切到非滚动类型时删除 `rollingUpdate`。
- 本地校验：数量写法（`100m`/`0.5`/`1Gi`）、请求不大于上限、策略参数为百分比或整数；不合法时禁用提交并说明原因，不发请求。
- 整对象 PUT：body 从详情对象克隆后只替换本次涉及的字段，服务端写入的默认 `strategy.rollingUpdate.maxUnavailable=25%` 在未修改时保留（实测：只改 maxSurge 后 maxUnavailable 仍为 25%）。

## 4. 交互与权限

- 弹窗内「更新策略」分组只对部署/有状态副本集/守护进程集出现；任务与容器组没有可改的 Pod 模板，保持原有形态。
- 保存为整对象 PUT；409 时弹窗保持打开并提示刷新后重试（既有行为，未改）。
- 写入测试只创建唯一 `tc-e2e-*` 部署/有状态副本集，回读后 finally 删除；跑完复核本批对象无残留。

## 5. 视觉

- 弹窗分区顺序：副本数 → 更新策略 → 容器（镜像/拉取策略/环境变量/资源限额）→ 变更清单。
- 1024/1280/1600 三档无横向滚动（`scrollWidth` 等于视口宽度）；英文（`kube-frontend-locale=en`）分组与字段文案为英文。
- 截图：`/tmp/workload-edit-1024.png`、`/tmp/workload-edit-1280.png`、`/tmp/workload-edit-1600.png`、`/tmp/workload-edit-en.png`、`/tmp/workload-edit-settings.png`。
- 限制：本版本新 UI 无深浅主题切换入口，本批只核对默认主题。

## 6. 验证

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| 应用单测 | `console-next: vitest run` | 179 passed |
| 显式类型检查 | `console-next: tsc --noEmit` | 0 error |
| 构建 | `console-next: vite build` | ✓ built |
| 严格规格门禁 | `check_docs.py --strict` | errors=0 warnings=0 |
| 本批 E2E（`-n 0`） | EDIT_SETTINGS-03…07 + DETAIL-01 + EDIT_YAML-01 | 7 passed |
| 共享影响 | APP_WORKLOADS-DETAIL-01、EDIT_YAML-01、FULL-04、MOBILE-01 | 4 passed |
| 契约套件 | `npx vitest run --config config/vitest.config.ts` | 1331 passed / 1 failed（见下） |

基线失败（非本批）：`apps/console-next/src/pages/workspace/WorkspaceUserGroupsPage.tsx` 使用裸 `<button>`（提交 `e4b5d2d1d`，本工作区未改动），AI-surface 契约报 1 条失败；本批未修改该文件。

未执行：全站串行 E2E、部署环境（生产前端）复核、member 集群写入。

## 7. 遗留（本单元内仍可实施）

- 容器组安全上下文（securityContext）与容器组 IP 池（ippool，仅集群启用时）：老 console 的编辑设置包含这两项，新弹窗尚未提供，目前只能编辑 YAML。已登记为待补原子项（ES-07）。
- 任务（Job/CronJob）的编辑设置目前只有既有字段，未纳入资源限额与策略；本批未改动，保留原能力。
