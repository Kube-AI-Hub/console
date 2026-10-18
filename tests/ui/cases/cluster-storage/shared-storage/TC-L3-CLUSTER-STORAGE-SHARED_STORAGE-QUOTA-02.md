# TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02 卷与配额 · 调整配额弹窗

- **用例 ID**: `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02`
- **级别**: L3  **套件**: `point`
- **模块**: `cluster-storage` / `shared-storage` `quota`
- **入口**: `{BASE_URL}/clusters/default/juicefs-storage/volumes`
- **需求**: `prd/cluster-storage/shared-storage/quota.md`

## 产品功能

配额弹窗的初始值、下限校验与提交结果。

### 关联需求

- `prd/cluster-storage/shared-storage/quota.md`

### 覆盖的验收场景

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02** — Given 打开某个卷的配额弹窗，When 输入低于已用的容量，Then「确定」不可用并提示下限；When 输入更大的容量并确定，Then 表格配额更新、PV 的 `spec.capacity` 与 JuiceFS quota 同步更新。

### 关联设计

- 技术方案 [`design/cluster-storage/shared-storage/quota.md`](../../../../design/cluster-storage/shared-storage/quota.md)

## 覆盖的用户故事

文案来自需求 [`prd/cluster-storage/shared-storage/quota.md`](../../../../prd/cluster-storage/shared-storage/quota.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为集群运维，把某个卷的配额调大，并确认改动不会被下一次挂载改回去


**Independent Test**：点某行「调整配额」，把 5TiB 改成 6TiB 并确定；表格配额变为 6.0 TiB，`kubectl get pv` 显示 `6Ti`，`juicefs quota get --path <subPath>` 显示 `6.0 TiB`；重启一个挂载该卷的 Pod 后仍为 6 TiB。

## 前置与配置

- 已登录，且在 default 集群
- 集群至少有一个共享卷

## 测试步骤

1. 打开 /clusters/default/juicefs-storage/volumes
2. 点第一行的「调整配额」，读取目录、已用与当前配额，读取输入框初始值
3. 把输入改成 1（GiB）并确定，核对提示与确定按钮状态
4. 点取消，核对表格配额未变
5. 再次打开，改成当前值 +1（TiB）并确定，核对表格配额更新

## 期望结果

- 弹窗初始值等于当前配额（按单位换算）
- 输入低于已用时确定按钮不可用，并出现下限提示
- 取消后表格配额不变
- 提交成功后表格配额变为新值

## 失败排查

- 输入框为空说明 Form.Item 覆盖了受控 Input
- 提交无反应时看 Input 的 onChange 是否按 (event, value) 取第二个参数

## 产品改版后如何更新自动化

- 单位下拉变化时改 QuotaModal 的定位
