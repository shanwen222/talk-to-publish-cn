# OpenMontage 设计思想取舍

采纳：

- 固定阶段：research/plan → script → scene plan → assets → edit → compose。
- 阶段清单与角色说明可读、可审计。
- 每阶段有输入、输出、状态与验收门禁。
- 渲染前检查可达性，渲染后用 ffprobe 和业务断言自检。
- Provider 选择与工作流编排分离。

不采纳：

- 不复制其 700+ skills、工具注册表或 Python 编排层。
- 不把 OpenMontage 作为核心依赖。
- v1.0 不引入复杂评分器；provider 未配置时只返回 unavailable。

原因：保留其“agent 读清单并执行”的可扩展思想，同时避免重复权威源、许可证耦合和初版范围膨胀。
