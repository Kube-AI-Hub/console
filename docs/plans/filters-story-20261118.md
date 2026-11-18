# 多选筛选：在 Storybook 上验（2026-11-18）

## 实测（`Schema/ResourceList › filters and columns`）

```
before:            ['node-a', 'node-b']
勾选「英伟达」:      ['node-a']            ← 单选生效
再勾选「CPU」:       ['node-a', 'node-b']   ← 多选取并集
```

两条规则：单个选项能过滤、多个选项是**并集**（不是交集——交集会让「同时是 NVIDIA 又是 CPU」变成空）。

## 筛选弹层的结构（写选择器前先看）

```
popper 文本:  英伟达|CPU|清除厂商
roles:        dialog / group / checkbox
```

选项是 `checkbox`（不是 `menuitemcheckbox`），弹层是 `dialog`。**每次都要先 dump 一次结构**——
这是本轮第三次因为猜 role 而超时（前两次是列显隐菜单与每页触发器）。

## 未覆盖

「清除厂商」按钮没有点通（可访问名与文本不一致）。清除路径在应用里验过（空态的「清空搜索与筛选」），
这里只记未覆盖。
