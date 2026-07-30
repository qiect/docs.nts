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
      link: /guide/getting-started
    - theme: alt
      text: 项目介绍
      link: /guide/introduction

features:
  - icon: 🧭
    title: 完整几何类型层级
    details: Point、LineString、Polygon 及其 Multi 集合类型，遵循 OGC 简单要素规范 (SFS)，与 PostGIS、SQL Server 空间类型一一对应。
    link: /core/geometry-hierarchy
    linkText: 查看几何层级 →
  - icon: ⊕
    title: 强大的叠加分析
    details: Union、Intersection、Difference、SymDifference 四大叠加算子，支持任意维度组合与稳健的拓扑运算。
    link: /operations/overlay
    linkText: 学习叠加分析 →
  - icon: ◯
    title: 缓冲区与距离
    details: 单边/双边缓冲、端点与连接风格、象限分段数控制，配合 Distance、NearestPoints 解决邻域问题。
    link: /operations/buffer
    linkText: 探索缓冲区 →
  - icon: 🔍
    title: 空间谓词与 DE-9IM
    details: Contains、Within、Intersects、Touches、Crosses、Overlaps、Disjoint 七大谓词，背后是完整的 DE-9IM 维度扩展交矩阵。
    link: /predicates/relationships
    linkText: 理解空间谓词 →
  - icon: ⚡
    title: PreparedGeometry 性能优化
    details: 对同一几何进行多次空间判定时，PreparedGeometry 可缓存索引与拓扑结构，带来数量级的性能提升。
    link: /advanced/prepared-geometry
    linkText: 提速实战 →
  - icon: 🗂️
    title: STRtree 空间索引
    details: 内置 STRtree、Quadtree、KdTree 等空间索引，让"在大数据集中查找附近要素"从 O(n) 降到 O(log n)。
    link: /advanced/spatial-index
    linkText: 空间索引指南 →
  - icon: 🔌
    title: EF Core 与数据库集成
    details: 与 Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite / Npgsql.EntityFrameworkCore.PostgreSQL 无缝集成，直接读写 geometry 列。
    link: /integration/ef-core
    linkText: 集成 EF Core →
  - icon: 📐
    title: 三角剖分与曲面
    details: Delaunay 三角剖分、Voronoi 图、Delaunay 三角化器构建连续曲面与最近邻区域，服务地理分析。
    link: /advanced/triangulation
    linkText: 三角剖分入门 →
---
