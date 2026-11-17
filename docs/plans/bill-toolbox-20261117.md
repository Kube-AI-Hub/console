# 浮动工具箱与资源消费页（2026-11-17）

> 本批交付证据。范围：N-03 —— 全站浮动工具箱（6 入口、可拖拽、位置持久）与按项目/时间窗的资源消费页。
> B200 已启用计量（不是历史登记里的 404），因此账单页面按正向数据验收；未启用分支由单测覆盖。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 任意页面打开工具箱到达 6 个集群工具；资源消费页按项目看窗口内 CPU/内存/存储/GPU |
| 旧入口、部署 URL | 老 console 的 KubeTools 悬浮球 + /bill 账单页；新 UI 无入口/无页面 |
| 新入口 | AppShell 右下角悬浮球；/kube-frontend/clusters/<cluster>/bill（侧栏「资源消费」） |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092）；admin；计量接口实测 200（25 个 namespace） |
| 视口、主题 | 1600×1000（工具箱展开/拖动、账单 1h）；其余视口与深色待补 |
| 子页面与状态范围 | 工具箱收起/展开/拖动；账单 1h/6h/24h、表格、空态、未启用、错误 |
| 明确排除及批准 | 费用/价格、导出、工作空间与集群层级汇总、工具箱自定义/快捷键 |
| 并行/安全边界 | 只新增 shell/api/页面/文档；不改其他页面；E2E 不改集群数据 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项与完整选项 | 归宿/新位置 | 新 AC/用例/断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-TOOLS-01 | components/KubeTools 悬浮球 | 登录后全局 | 6 个工具入口（日志/事件/审计/消费/kubeconfig/kubectl） | Shell Toolbox，面板 6 行 | AC-BILL-01；TC-BILL-01 | 通过（B200） |
| LEG-TOOLS-02 | KubeTools 拖动 | — | Y 轴拖动 + 位置记忆 | 指针拖动（任意方向、clamp），localStorage | AC-BILL-01；TC-BILL-01 | 通过 |
| LEG-BILL-01 | containers/Bill | 平台管理员 | 按项目/时间区间看 CPU/内存/存储 | /clusters/<c>/bill：1h/6h/24h + 四列 | AC-BILL-02；TC-BILL-01 | 通过（B200 计量） |
| LEG-BILL-02 | 无计量时行为 | — | 历史记录「路由 404」 | 独立「未启用」状态 + 重试；403 仍错误 | AC-BILL-02；api 单测 | 通过（单测） |

**计数**：4 项原子能力；正向 3 项 B200 E2E，未启用分支单测。费用/导出等老账单细节明确排除。

## 3. 数据契约与全链路

| 能力 ID | 请求 | 字段 | 规则 | 映射 | 异常 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-BILL-01 | GET /kapis/metering.kubesphere.io/v1alpha1/namespaces?start=&end=&step=5m | metric_name、data.result[].metric.namespace、values | start/end Unix 秒；step 为 Go duration；CPU/内存/GPU 均值、PVC 最新 | namespaceUsageApi → ProjectUsage | 404/400/501/5xx → available:false；403 → throw | E2E 行数>0、表头、时间窗切换；单测聚合 |
| LEG-TOOLS-01 | 无（前端路由） | 当前 cluster | URL 集群 → 最近集群 → host | 6 个 href | 无集群时回退 host | E2E 6 个 href 断言 |
| LEG-TOOLS-02 | localStorage['kube-frontend:toolbox'] | right/bottom | 移动>3px 才持久化；抬起不 toggle | 悬浮球 style | 存储不可用仅本次生效 | E2E 拖动+刷新 |

## 4. 交互、视觉与复用基线

| 项 | 约定 | 验证 |
| --- | --- | --- |
| 工具箱 | 44px 球、面板在上方、6 行；Esc 关闭；指针捕获释放 | E2E + 截图 |
| 账单页 | 时间窗分段按钮 + 表格；CPU 降序；窗口说明 | E2E + 截图 |
| 状态 | loading/error/empty/unavailable/ready 五态 | E2E（ready）+ 单测（unavailable） |
| 复用 | 复用 AiSurface/Button/Skeleton/actionProps/ResourceErrorPanel；新增 Toolbox、ClusterBillPage、metering API | 契约/类型/构建 |

## 5. 编码与回归

- [x] AC-BILL-01/02 覆盖 6 入口、拖拽持久、按项目数据、未启用与空态。
- [x] API 单测 3 条；E2E TC-BILL-01（B200）。
- [x] tsc 0、contracts 18/1518、api 44/435、build 通过；页面级契约要求用 Button/不手写 Escape，已按约定修正。
- [x] 未提交/未推送；并行文件未回退。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 4 项原子能力 | — |
| 数据语义 | 通过（B200） | 25 个项目行、CPU 降序、切窗重查；未启用/403 单测 | 成员集群计量路径 |
| 交互与权限 | 通过（admin） | 工具箱展开/拖动/刷新保持；账单页可读 | 非 admin、移动端 |
| 视觉 | 通过（B200 1600/1280/1024 深浅） | 工具箱/账单 1h/拖动 + 三档深浅截图 | 旧站对照未生成 |
| 静态/类型/构建/测试 | 通过 | tsc 0；contracts 18/1518；api-client 44/435；build ✓ | — |
| 部署/全站 | 未执行 | — | 镜像部署与全站串行 E2E |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    pnpm --filter @kube-ai-hub/console-next build → 通过
    npx vitest run packages/api-client/test/metering.test.ts → 3 passed

    # E2E（B200 本地全栈）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/.../test_TC_L3_..._BILL_01.py -n 0 → 1 passed (7.85s)
    # 复跑：初始 5.38s；契约修复（Button/弹层）后 7.85s 通过

## 8. 截图与记录

assets/bill-toolbox-20261117/new：toolbox-open.png、toolbox-dragged.png、bill-1h.png（B200 1600 浅色）。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 旧站对照 | 未生成 | 设计走查补 |
| 未启用分支的真实页面证据 | 单测 | 在未装计量的集群执行同一页面 |
| 成员集群计量路径 | 未验收 | 多集群且成员启用计量 |
| 非 admin / 移动端 | 未验收 | 普通成员/手机视口 |
| 费用/导出/层级汇总 | 明确排除 | 产品需要时另立 |

## 10. 流程反思

| 本批踩到的事 | 已写入 |
| --- | --- |
| 计量 step 传数值秒（旧 utils）→ 400 time: missing unit；正确是 Go duration 5m | 指南 §8 #34：时间窗 API 的单位先探测，别照搬旧 util |
| 「没有数据」与「没有计量」混为一张空表会得出相反结论 | 设计 DEC-01 + PRD 边界：独立 unavailable 状态，403 不伪装 |
| 拖拽后抬起若直接 toggle 会误展开 | 设计 DEC-02：位移阈值 + 抬起只持久化 |

## 11. 关联文档

- PRD：prd/kube-frontend/cluster-management/bill.md（US1/US2、AC-BILL-01/02）
- design：design/kube-frontend/cluster-management/bill.md（DEC-BILL-01/02）
- 用例：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01
- 既有工具页面：logs / events / audit-logs / overview（kubeconfig）/ kubectl
