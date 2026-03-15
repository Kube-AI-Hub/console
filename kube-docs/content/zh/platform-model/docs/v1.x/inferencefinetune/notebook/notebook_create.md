---
title: "创建 Notebook 实例"
keywords: "行业大模型平台, 创建 Notebook, JupyterLab, VS Code, Eclipse Theia"
description: "介绍如何在行业大模型平台创建 Notebook 实例，选择开发环境和算力资源。"
linkTitle: "创建 Notebook 实例"
weight: 6110
---

## 创建入口

有以下两种方式进入 Notebook 创建页面：

- 点击右上角个人头像，选择**新建 Notebook**。
- 在模型详情页，点击**使用模型 → 使用 Notebook 开发**。

## 配置参数说明

进入 Notebook 实例创建页面后，填写以下配置信息：

| 参数 | 说明 |
|------|------|
| **实例名称** | 自定义名称，不能与已有实例重复 |
| **预装镜像** | 选择包含所需深度学习框架的预装开发环境镜像（如 PyTorch、TensorFlow） |
| **运行时框架** | 选择开发环境类型：JupyterLab、VS Code 或 Eclipse Theia |
| **区域/资源配置** | 选择算力资源规格（GPU 型号、显存大小、CPU/内存配置） |
| **副本数量** | 选择实例弹性副本范围 |

配置完成后，点击**创建实例**按钮。

## 查看实例列表

创建完成后，可在**资源控制台 → Notebook 实例列表**中查看所有已创建的实例及其运行状态。

## 注意事项

{{< notice note >}}
- Notebook 实例按使用时长计费，不使用时请及时停止实例以避免额外费用。
- 实例停止后，工作目录中的文件仍会保留；实例删除后，数据将被清除，请提前备份。
{{</ notice >}}
