# 迁移收口状态（2026-11-16）

> 一次基于仓库现状与能力矩阵的汇总：哪些已经交付并验证、哪些明确不做、哪些被环境阻塞。
> 本文只写**可复核的事实**，每条都能指到记录或命令。

## 1. 页面级映射（可执行的判据）

| 检查 | 命令 | 当前结果 |
| --- | --- | --- |
| 老新页面映射 | `python3 prd/tools/gap_check.py` | 已迁移 **91** / 明确不做 **2** / 别处承接 **3** / 已登记缺口 **0** / 未归类 **0** |
| 路由与页面配对 | `python3 prd/tools/parity_check.py` | 合计待处理 **0** |
| 文档门禁 | `python3 prd/tools/check_docs.py --strict` | errors **0** / warnings **0** |
| 架构契约 | `npx vitest run --config config/vitest.config.ts` | **1452 passed** |
| 显式类型 | `npx tsc --noEmit`（console-next） | **0 error** |

结论：**旧 console 的导航页面在新 UI 都有落点**，没有「未归类」的页面。

## 2. 明确不做（2 条，均有理由）

| 项 | 理由 |
| --- | --- |
| 第三方登录 | 登录方式由服务端注入，控制台没有写入路径；部署无可配置身份源 |
| 账单/计量 | 部署未启用计量组件，页面没有数据源 |

## 3. 别处承接（3 条）

| 旧入口 | 新落点 |
| --- | --- |
| 项目内「应用」（CRD composing 应用） | 扩展资源 / 应用商店（两者不是同一功能） |
| 企业空间 DevOps | 集群作用域 `/kube-frontend/clusters/<cluster>/devops` |
| 集群角色 | 平台管理 → 访问控制 → 集群角色（同一能力，信息架构不同） |

## 4. 已闭环的页面族（本轮及之前各轮交付，均有串行 E2E 证据）

应用商店（18）、DevOps 工程（12）、镜像构建器（12）、灰度发布（8）、联邦项目（8）、监控告警（15）、
集群监控面板与系统组件（5）、集群成员写能力（6）、项目网关（5）、集群可见性授权（6）、配置/保密/服务账号（54+）、
项目概览（用量/趋势/排行）、企业空间概览（用量/项目排行）、列表刷新与每页档位（26 个列表）。

## 5. 被环境阻塞、无法在本环境验收的项（有证据）

| 项 | 阻塞原因（已登记） |
| --- | --- |
| 灰度发布监控曲线 | 本集群无 servicemesh 策略控制器；kapis 工作负载 metrics 404 |
| etcd 六图正分支、每节点 etcd 状态 | components/etcd 返回 200 但 13 个指标全 0 序列 |
| 通知渠道真实投递 | 集群无 webhook 接收方 |
| DevOps 运行成功状态/日志正文 | devops-controller CrashLoopBackOff（Jenkins 令牌不匹配） |
| 镜像构建器真实构建 | s2ioperator SA 缺 cluster-scope list/watch；minio DNS 缺失 |
| 成员集群 / 生产前端 | 环境只有 host 集群与本地静态站 |

## 6. 全站一次性 E2E 为什么不能作为判定

第 4 次全站串行跑（64 分 37 秒）得 151 failed / 218 passed / 19 skipped，失败呈「长跑退化」形态；
同批用例在新区里按区单跑全绿（configmaps 27 passed、monitoring 16 passed、access-control 44 passed、
project-settings 27 passed）。详见 [e2e-long-run-degradation-20261116.md](e2e-long-run-degradation-20261116.md)。
因此判定方式固定为「按区串行 + 失败单条复跑」。

## 7. 若要继续推进，可做且不依赖环境的项

1. 剩余约 27 个列表的每页档位（同一套状态已就绪，按页族推进）；
2. 列显隐逐页铺开（目前清单页族已接入）；
3. 长跑退化的环境侧采样（BFF 响应时间/连接数、SSH 隧道吞吐），把「长跑」变成可用判据；
4. 环境侧修复上述 6 项阻塞后，补验对应正分支。
