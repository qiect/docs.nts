# 官方资料与链接

继续学习的权威资源。

## NTS 官方

- **GitHub 仓库**：[NetTopologySuite/NetTopologySuite](https://github.com/NetTopologySuite/NetTopologySuite)
- **官方文档**：[nettopologysuite.github.io/NetTopologySuite](https://nettopologysuite.github.io/NetTopologySuite/api/NetTopologySuite.html)
- **NuGet 包**：[NetTopologySuite](https://www.nuget.org/packages/NetTopologySuite)
- **Issue 列表**：[github.com/NetTopologySuite/NetTopologySuite/issues](https://github.com/NetTopologySuite/NetTopologySuite/issues)

## 关联项目

| 项目 | 用途 |
| --- | --- |
| [ProjNet](https://github.com/NetTopologySuite/ProjNet4GeoAPI) | 坐标系转换 (CRS) |
| [NetTopologySuite.IO.GeoJSON](https://www.nuget.org/packages/NetTopologySuite.IO.GeoJSON) | GeoJSON 序列化 |
| [NetTopologySuite.IO.PostGis](https://www.nuget.org/packages/NetTopologySuite.IO.PostGis) | PostGIS 二进制格式 |
| [NetTopologySuite.Features](https://www.nuget.org/packages/NetTopologySuite.Features) | Feature / FeatureCollection 抽象 |

## 上游与同源项目

- **JTS Topology Suite**（Java 原版）：[locationtech/jts](https://github.com/locationtech/jts)
  - NTS 算法与 JTS 1:1 对应，JTS 文档对 NTS 也适用
- **GEOS**（C/C++ 移植）：[libgeos/geos](https://github.com/libgeos/geos)
  - PostGIS 内部使用 GEOS

## 数据库空间扩展文档

| 数据库 | 文档 |
| --- | --- |
| PostgreSQL + PostGIS | [postgis.net/documentation](https://postgis.net/documentation/) |
| SQL Server Spatial | [Spatial Data Types](https://learn.microsoft.com/sql/relational-databases/spatial/spatial-data-types-overview) |
| SQLite + SpatiaLite | [gaia-gis.it/gaia-sins](https://www.gaia-gis.it/gaia-sins/) |
| MySQL Spatial | [Spatial Data Types](https://dev.mysql.com/doc/refman/8.0/en/spatial-types.html) |

## EF Core 空间数据

- **EF Core 空间数据官方文档**：[learn.microsoft.com/ef/core/modeling/spatial](https://learn.microsoft.com/ef/core/modeling/spatial)
- **Npgsql 文档**：[npgsql.org/efcore/mapping/nts.html](https://www.npgsql.org/efcore/mapping/nts.html)

## OGC 标准

- **Simple Features Access for SQL**：[OGC 06-104r4](https://www.ogc.org/standards/sfa)（NTS 实现的核心规范）
- **DE-9IM**：Wikipedia 上的 [DE-9IM](https://en.wikipedia.org/wiki/DE-9IM) 解释非常清楚

## 必读论文与文章

1. **"JTS Topology Suite: A Geometry Package for Java"** —— JTS 的设计哲学
2. **"Geometric Algorithms for Spatial Data"** —— NTS 涉及的核心算法综述
3. **PostGIS in Action**（书）—— 大量内容直接适用于 NTS
4. **PostGIS Documentation: Chapter 5 "Spatial Queries"** —— SQL 空间查询的圣经

## 经典教程与博客

- [Planet JTS](https://lin-ear-th-inking.blogspot.com/) —— JTS 作者 Martin Davis 的博客，深入解释算法
- [Planet PostGIS](https://www.postgis.us/) —— Regina Obe & Leo Hsu 的 PostGIS 实战博客
- [Boundless PostGIS Tutorial](https://workshops.boundlessgeo.com/postgis-intro/) —— 经典 PostGIS 教程

## 算法可视化

- [Voronoi Diagram 可视化](https://cartesiancafe.com/voronoi-diagram-delaunay-triangulation/) —— Voronoi 与 Delaunay 的图解
- [DE-9IM Matrix 交互演示](https://gis.stackexchange.com/questions/145/what-is-de-9im) —— 矩阵的视觉化解释

## 坐标参考系资源

- **EPSG Registry**：[epsg.org](https://epsg.org/) —— 全球坐标系数据库
- **EPSG.io**：[epsg.io](https://epsg.io/) —— 友好的 EPSG 查询界面
- **Spatial Reference**：[spatialreference.org](https://spatialreference.org/) —— WKT 格式查询

## 国内坐标系

中国常用坐标系：

| SRID | 名称 | 用途 |
| --- | --- | --- |
| 4326 | WGS84 | GPS、Google Maps |
| 4490 | CGCS2000 | 中国国家大地坐标系 |
| 4480 | CGCS2000 (3D) | 大地测量 |
| 3857 | Web 墨卡托 | Web 地图（米制） |
| 4527 | CGCS2000 / 3 度带 / 中央经线 114° | 中国 1:1 万测图 |
| 4499 | CGCS2000 / Gauss-Kruger CM 117E | 中国高斯投影 |

国内坐标转换注意事项：

- WGS84 ↔ GCJ-02（火星坐标）：需要 **非公开** 的偏移算法，NTS 不内置
- GCJ-02 ↔ BD-09：百度地图坐标系
- 高精度坐标转换用 CGCS2000 框架

## 推荐学习路径

### 入门（1 周）

1. 本教程的 [入门](../guide/introduction.md) → [快速开始](../guide/getting-started.md) → [第一个几何](../guide/first-geometry.md)
2. [几何层级](../core/geometry-hierarchy.md) → [WKT/WKB](../core/wkt-wkb.md)
3. 跑通 [API 速查表](./cheatsheet.md) 中的模板

### 进阶（2~3 周）

1. [几何操作](../operations/overlay.md) → [缓冲区](../operations/buffer.md)
2. [空间谓词](../predicates/relationships.md) → [DE-9IM](../predicates/de9im.md)
3. [PreparedGeometry](../advanced/prepared-geometry.md) → [空间索引](../advanced/spatial-index.md)
4. [EF Core 集成](../integration/ef-core.md)

### 实战（项目驱动）

1. 选一个真实场景（如"附近的人"、配送范围、轨迹分析）
2. 把数据库 + EF Core + NTS + Web API 全部串起来
3. 遇到性能问题回到本教程的 [进阶主题](../advanced/prepared-geometry.md) 章节

## 反馈与社区

- **本教程改进**：在 GitHub 仓库提 PR 或 Issue
- **NTS bug 报告**：[NetTopologySuite Issues](https://github.com/NetTopologySuite/NetTopologySuite/issues)
- **中文 GIS 社区**：osgeo.cn、CSDN GIS 板块

## 下一步

- [API 速查表](./cheatsheet.md)
- [常见问题 FAQ](./faq.md)
- 回到 [首页](../index.md)
