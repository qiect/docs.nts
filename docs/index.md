---
layout: home

hero:
  name: NetTopologySuite
  text: 空间几何的 .NET 工具箱
  tagline: 从坐标到拓扑、从缓冲区到 DE-9IM——一份为 .NET 开发者准备的、深入且系统的 NetTopologySuite 实战教程。
  image:
    src: /favicon.svg
    alt: NetTopologySuite
  actions:
    - theme: brand
      text: 开始学习
      link: /01-getting-started/introduction
    - theme: alt
      text: 快速开始
      link: /01-getting-started/quickstart

features:
  - icon: 🚀
    title: 从零开始，步步为营
    details: 从创建第一个 Point 到理解 DE-9IM 矩阵，8 个阶段、25 篇文章，带你从 .NET 开发者成长为空间数据处理专家。
    link: /01-getting-started/introduction
    linkText: 开始学习 →
  - icon: 📐
    title: 完整的几何模型
    details: Coordinate、Point、LineString、Polygon、Multi* 系列——深入理解 OGC 简单要素规范的每一层，打好扎实基础。
    link: /02-geometry-fundamentals/geometry-hierarchy
    linkText: 探索几何模型 →
  - icon: 🔍
    title: 空间关系与 DE-9IM
    details: 从 Intersects 到 DE-9IM 自定义模式，理解每个谓词背后的拓扑原理，不再被"Contains 为什么返回 false"困惑。
    link: /03-spatial-relations/relationships
    linkText: 理解空间谓词 →
  - icon: ⊕
    title: 丰富的几何运算
    details: Union、Intersection、Buffer、ConvexHull、Simplify、Affine——覆盖所有常见空间变换，配合批量合并策略应对大规模数据。
    link: /04-geometry-operations/overlay
    linkText: 学习几何运算 →
  - icon: 📏
    title: 精确的空间测量
    details: 面积、长度、距离、最近点、线性参考——从基础测量到沿线投影，解决实际业务中的定位与度量问题。
    link: /05-spatial-measurement/measurement
    linkText: 掌握空间测量 →
  - icon: ⚡
    title: 性能优化实战
    details: PreparedGeometry 缓存 + STRtree/KdTree/Quadtree 空间索引，让万级数据的空间查询从秒级降到毫秒级。
    link: /06-performance/prepared-geometry
    linkText: 性能优化 →
  - icon: 🔺
    title: 三角剖分与高级扩展
    details: Delaunay 三角剖分、Voronoi 图、自定义 GeometryFilter/Transformer——掌握 NTS 的算法能力与扩展机制。
    link: /07-advanced-topics/triangulation
    linkText: 深入高级主题 →
  - icon: 🔌
    title: 生态集成与实战
    details: EF Core + PostGIS/SQL Server/SpatiaLite 无缝集成，坐标系转换，从代码到数据库打通全链路。
    link: /08-ecosystem/ef-core
    linkText: 生态集成 →
---