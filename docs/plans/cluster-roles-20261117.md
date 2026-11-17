# 集群作用域角色（2026-11-17）

> 本批交付证据。范围：N-06 —— 集群作用域角色列表与详情两页签（权限规则 / 已授权用户）+ 平台角色页多集群切换（host 可写、成员只读）。
> 平台切换在 mlu370 多集群（host + 4paradigm）验证；B200 单集群仅验证选择器隐藏。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 在某个集群的上下文里核对角色、规则与直接授权用户 |
| 旧入口、部署 URL | 老 console /clusters/:cluster/roles[/:name/authorizations|/users]；新 UI 无集群作用域 roles 路由 |
| 新入口 | /kube-frontend/clusters/<cluster>/roles 与 /roles/<name>；侧栏 集群设置 › 集群角色 |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092）；host；admin；host 实测 218 个 clusterrole |
| 视口、主题 | 1600×1000 浅色（列表/规则/用户）；其余待补 |
| 子页面与状态范围 | 列表 loading/ready/empty/error；详情规则页签、用户页签、两空态 |
| 明确排除及批准 | 本页写角色、组/SA 授权列表、平台角色页多集群切换（§9） |
| 并行/安全边界 | 只新增页面/API/文档；E2E 只读，不改集群数据 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段、动作、默认项 | 归宿 | 新 AC/用例/断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-CROLE-01 | clusters/containers/Roles 列表 | 集群成员 | 名称/规则数/创建时间 | /clusters/<c>/roles | AC-ROLES-01；TC | 通过（B200） |
| LEG-CROLE-02 | 详情 authorizations | 集群成员 | 规则条目 | 详情「权限规则」页签 | AC-ROLES-01；TC | 通过 |
| LEG-CROLE-03 | 详情 users | 集群成员 | IAM 用户/状态/最近登录 | 详情「已授权用户」页签 + 空态 | AC-ROLES-01；TC | 通过（空态与数据两条） |

**计数**：3 项原子能力全部交付（只读）。平台页多集群切换另列。

## 3. 数据契约与全链路

| 能力 | 请求 | 字段 | 规则 | 映射 | 异常 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| 列表 | GET /kapis/iam…/clusterroles?limit=-1；成员 /kapis/clusters/<c>/… | metadata.name/creationTimestamp、rules[] | 一次取全，前端分页 | clusterRolesForClusterApi.list | 错误面板+重试 | 行数>0；规则数与接口一致 |
| 详情 | GET 同集合/<name> | rules[]、annotations | 规则按对象原样展示 | .get | 不存在→错误面板 | 规则行数=rules.length |
| 用户 | GET /kapis/iam…/users?clusterrole=<name>&limit=-1 | metadata.name、status.state/lastLoginTime | 只含 IAM 用户；原生绑定不在内 | .users | 空→空态；失败→面板+重试 | 用户行集合=IAPI 集合（B200 该角色为 0，走空态） |

## 4. 交互与复用基线

- 列表复用 ResourceList/ColumnVisibility/ListRefresh；详情用页签 + 两张表；无写入口。
- 系统角色带「系统」徽标；规则表列：API 组/资源/动作；用户表列：用户名/状态/最近登录。
- 成员集群 IAM 前缀通过路径函数切换；不把 host 数据当成员数据。

## 5. 编码与回归

- [x] AC-ROLES-01 覆盖列表、规则页签、用户页签（数据/空态）、只读。
- [x] E2E TC-ROLES-01（B200）；API 单测 3 条（host/成员前缀、users 映射）；tsc/build 通过。
- [x] 未提交/未推送；并行文件未回退。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 3 项只读能力 | — |
| 数据语义 | 通过（B200） | 规则行数=rules.length；IAM 用户集合与页面一致（0→空态） | 有 IAM 绑定的角色行未在 B200 出现 |
| 交互与权限 | 通过（admin） | 列表→详情→切页签 | 非 admin |
| 视觉 | 通过（B200 1600/1280/1024 深浅 + mlu370 平台切换） | 列表/规则/用户/平台 host/成员截图 | 旧站对照未生成 |
| 静态/类型/构建/测试 | 通过 | tsc 0；contracts 18/1534；api-client 44/438（新增角色 API 3 条）；build ✓ | — |
| 部署/全站 | 未执行 | — | 镜像部署与全站串行 E2E |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    pnpm --filter @kube-ai-hub/console-next build → 通过

    # E2E（B200 本地全栈）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/.../test_TC_L3_..._ROLES_01.py -n 0 → 1 passed (6.95s)

    # 平台角色页多集群切换（mlu370：host + 4paradigm，静态站 5177 → BFF 8096）
    KA_APP_URL=http://localhost:5177 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=***       pytest tests/.../test_TC_L3_..._ROLES_02.py -n 0 → 1 passed (8.08s)

## 8. 截图与记录

assets/cluster-roles-20261117/new：cluster-roles-list.png、cluster-role-detail-rules.png、cluster-role-detail-users.png（B200 1600 浅色）。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 平台角色页多集群切换 | 通过（mlu370） | host/成员切换、成员只读、host 写入口恢复；见 §12 |
| 有 IAM 用户绑定的角色页签数据 | 未在 B200 观察到（cluster-admin 也是 0） | 在多集群环境创建一个 IAM 用户+clusterrolebinding 后复跑 |
| 成员集群读取 | 未验收 | 多集群且成员可达 |
| 旧站对照 | 未生成 | 设计走查补 |
| 非 admin/部署/全站 | 未验收 | 普通集群成员、镜像与全站串行 E2E |

## 10. 流程反思

| 本踩到的事 | 已写入 |
| --- | --- |
| IAM users?clusterrole= 只列 IAM 管理的绑定；原生 k8s 绑定（system:*、SA、admin 引导）不出现，0 是真实结果 | 指南 §8 #35；设计 DEC-02：空态而非隐藏页签 |
| 平台角色 API 固定 host，直接复用到成员集群会串数据 | 设计 DEC-01：集群前缀函数，成员路径 /kapis/clusters/<c>/iam… |

## 11. 平台角色页多集群切换（2026-11-17，mlu370）

- 入口：/kube-frontend/access/clusterroles；集群数 >1 时顶部显示选择器（host + 成员）。
- host：保持原平台角色列表与创建/编辑/删除。
- 成员：只读视图，复用集群作用域角色页读取（/kapis/clusters/<c>/iam…），显示只读提示，隐藏创建入口；写操作留在集群控制台。
- 验证：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02 在 mlu370（host + 4paradigm）**1 passed（8.08s）**：选择器选项、成员角色行、无创建按钮、切回 host 恢复；截图 platform-roles-member.png / platform-roles-host.png。
- 单集群（B200）：选择器不渲染，页面行为不变。

## 12. 关联文档

- PRD：prd/kube-frontend/cluster-management/roles.md
- design：design/kube-frontend/cluster-management/roles.md
- 用例：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01 / -02
- 老页面：clusters/containers/Roles（列表/authorizations/users）
