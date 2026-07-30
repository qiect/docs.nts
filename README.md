# docs.nts

> 面向 .NET 开发者的全面、深入的 NetTopologySuite (NTS) 空间数据处理教程。

基于 VitePress 构建，包含 20+ 章节教程、100+ 可运行代码示例与 15+ 几何图解。

## 在线访问

- 网站地址：<https://qiect.github.io/docs.nts/>
- 源码仓库：<https://github.com/qiect/docs.nts>

## 教程内容

| 板块 | 章节 |
| --- | --- |
| 入门 | 认识 NTS · 快速开始 · 第一个几何对象 |
| 核心概念 | 几何层级 · WKT/WKB · GeometryFactory · 精度模型 |
| 几何操作 | 叠加分析 · 缓冲区 · 凸包与简化 |
| 空间谓词 | 八大谓词 · DE-9IM 模型 |
| 空间分析 | 测量与距离 · 最近点与投影 |
| 进阶 | PreparedGeometry · 三角剖分 · 空间索引 · 自定义扩展 |
| 生态集成 | EF Core · PostGIS / SpatiaLite / SQL Server |
| 速查资源 | API 速查表 · FAQ · 官方资料 |

## 本地开发

需要 Node.js 18+。

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器 (默认 5173 端口)
npm run build    # 构建生产产物到 docs/.vitepress/dist
npm run preview  # 本地预览构建产物
```

## 部署

站点通过 GitHub Actions 自动部署到 GitHub Pages。

- 触发条件：推送到 `main` 分支
- 工作流定义：[.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- 部署地址：<https://qiect.github.io/docs.nts/>

VitePress 的 `base` 已设置为 `/docs.nts/`，与仓库名一致。如需部署到自定义域名或 `username.github.io` 仓库，请同步修改 [docs/.vitepress/config.ts](docs/.vitepress/config.ts) 中的 `base`。

## 技术栈

- [VitePress](https://vitepress.dev/) — 静态站点生成器
- 自定义 Vue 主题，制图学灵感设计（深绿色品牌、等高线装饰）
- 内置本地搜索、暗色模式、响应式布局

## 目录结构

```
.
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts          # 站点配置（导航/侧边栏/搜索）
│   │   └── theme/             # 自定义主题
│   ├── public/favicon.svg
│   ├── index.md               # 首页
│   ├── guide/                 # 入门教程
│   ├── core/                  # 核心概念
│   ├── operations/            # 几何操作
│   ├── predicates/            # 空间谓词
│   ├── analysis/              # 空间分析
│   ├── advanced/              # 进阶主题
│   ├── integration/           # 生态集成
│   └── cookbook/               # 速查资源
├── .github/workflows/deploy.yml
└── package.json
```

## License

MIT
