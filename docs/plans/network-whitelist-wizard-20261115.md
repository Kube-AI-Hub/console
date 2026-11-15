# 网络隔离「白名单」新建向导 · 交付记录 2026-11-15

按[交付模板](page-migration-template.md)记录的完整迁移单元：项目网络隔离页的**创建网络策略**从「一个方向 + 一个对端」扩展为**多规则 + 三类对端 + 端口**。

## 1. 基线

- 分支 `develop`；环境 B200 host 集群，BFF :8092 + 前端 :5178，admin。
- 选择依据：能力矩阵 R-21「网络隔离的规则聚合视图 / 白名单新建向导」——规则视图已补，**新建向导待补**；老 console 的向导（`src/components/Modals/Network/Policies`）只支持「方向 + 项目/服务」单对端。

## 2. 原子能力与归宿

| ID | 旧能力 | 新落点 | AC/TC | 结论 |
| --- | --- | --- | --- | --- |
| NP-01 | 创建网络策略（方向 + 一个对端） | 「创建网络策略」弹窗 | NETWORK_ISOLATION-02 | 保留（已验收，改用新句柄） |
| NP-02 | 老 console 的「项目」对端 | 规则对端类型「项目（命名空间）」→ `namespaceSelector` | NETWORK_ISOLATION-04 | 本批补齐 |
| NP-03 | 老 console 的「服务」对端 | 规则对端类型「容器组标签」→ `podSelector`（服务即其 selector） | NETWORK_ISOLATION-04 | 本批补齐 |
| **NP-04** | 老 console 不支持的能力：多规则、地址段、端口/协议 | 规则行 + `ipBlock` + `ports`（含 `endPort`） | NETWORK_ISOLATION-04 | 本批补齐 |
| NP-05 | 描述 | 写入 `kubesphere.io/description` 注解 | NETWORK_ISOLATION-04 | 本批补齐 |

## 3. 数据语义

- `spec.podSelector`：`k=v,k2=v2` → `matchLabels`；留空写 `{}`（选中项目内全部容器组，而不是「一个都不选」）。
- 对端一律包一层：`from:[{podSelector|namespaceSelector|ipBlock}]`；命名空间对端用 `kubernetes.io/metadata.name`（Kubernetes 自己维护的标签）。
- 端口：`TCP/UDP/SCTP` + 端口号或 `80-90` 区间（后者写 `port` + `endPort`）；留空表示所有端口，不写 `ports`。
- `policyTypes` 由**非空**的规则列表推导：声明了方向却没有规则等于在该方向拒绝全部流量。
- 规则为空时不能提交（没有规则的白名单不放通任何流量）。

## 4. 验证

| 范围 | 命令 | 结果 |
| --- | --- | --- |
| API 单测（清单生成器） | `api-client: vitest run test/network-policy-manifest.test.ts` | 9 passed |
| API 全量单测 | `api-client: vitest run` | 346 passed |
| 应用单测 | `console-next: vitest run` | 179 passed |
| 显式类型检查 | 两个包 `tsc --noEmit` | 0 error（api-client src） |
| 构建 | `console-next: vite build` | ✓ built |
| 严格规格门禁 | `check_docs.py --strict` | errors=0 warnings=0 |
| E2E（`-n 0`） | NETWORK_ISOLATION-01/02/04、NETWORK_RULES-01 | 3 passed / 1 skipped（ISOLATION-01 因项目无策略跳过） |

实测回读：`spec.ingress` 两条规则（`podSelector` + `ports:[{TCP,8080}]`、`ipBlock:10.0.0.0/8`）、`spec.egress` 一条（`namespaceSelector`）、`policyTypes:[Ingress,Egress]`、注解 `kubesphere.io/description=e2e whitelist`。

## 5. 视觉

- 1024/1600 无横向滚动；弹窗分区：名称 → 描述 → 作用于哪些容器组 → 入站规则 → 出站规则；规则行五列（对端类型/对端/协议/端口/删除）。
- 英文（`kube-frontend-locale=en`）文案已核对。
- 截图：`/tmp/network-policy-wizard-1024.png`、`/tmp/network-policy-wizard-1600.png`、`/tmp/network-policy-wizard-en.png`、`/tmp/network-policy-create.png`。

## 6. 遗留

- 老 console 的「按服务多选」界面没有 1:1 复刻：新向导用「容器组标签」表达同一个选择器，一次可加多条规则。若后续需要「从服务列表勾选」的引导式体验，另立单元。
- 策略的规则仍不可在详情内编辑（走编辑 YAML），与老 console 一致。
