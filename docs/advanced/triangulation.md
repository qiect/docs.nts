# 三角剖分与曲面

三角剖分把任意点集或几何转换为三角形网格，是曲面建模、最近邻区域、地形分析的基础。NTS 提供完整的 Delaunay 三角剖分与 Voronoi 图实现。

## 为什么需要三角剖分

- **曲面重建**：把离散高程点变成连续地形面
- **最近邻区域**：每个点的"势力范围"（Voronoi 图）
- **插值**：在三角网格上做双线性插值
- **可视化**：3D 地形渲染的基础
- **路径规划**：导航网格 (navmesh)

## Delaunay 三角剖分

Delaunay 三角剖分是"最均匀"的三角化方式——任意三角形的外接圆内不包含其他点。

```csharp
using NetTopologySuite.Triangulate;

var points = new[]
{
    new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(2, 3),
    new Coordinate(6, 2), new Coordinate(5, 5), new Coordinate(1, 4)
};

// 1. 构建剖分器
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(points);   // 输入点集

// 2. 获取三角网格（MultiLineString）
var edges = builder.GetEdges(factory);
Console.WriteLine($"边数 = {edges.NumGeometries}");

// 3. 获取三角形（GeometryCollection of Polygon）
var triangles = builder.GetTriangles(factory);
Console.WriteLine($"三角形数 = {triangles.NumGeometries}");
```

<figure class="nts-diagram">
<svg viewBox="0 0 240 160" width="240" height="160">
  <g stroke="#0b6e4f" stroke-width="1.2" fill="rgba(11,110,79,0.08)">
    <polygon points="20,30 80,40 50,90"/>
    <polygon points="80,40 140,30 110,80"/>
    <polygon points="80,40 50,90 110,80"/>
    <polygon points="140,30 200,50 170,90"/>
    <polygon points="140,30 110,80 170,90"/>
    <polygon points="50,90 110,80 80,130"/>
    <polygon points="110,80 170,90 140,130"/>
    <polygon points="80,130 140,130 110,80"/>
  </g>
  <g fill="#a00">
    <circle cx="20" cy="30" r="3"/><circle cx="80" cy="40" r="3"/>
    <circle cx="140" cy="30" r="3"/><circle cx="200" cy="50" r="3"/>
    <circle cx="50" cy="90" r="3"/><circle cx="110" cy="80" r="3"/>
    <circle cx="170" cy="90" r="3"/><circle cx="80" cy="130" r="3"/>
    <circle cx="140" cy="130" r="3"/>
  </g>
</svg>
<figcaption>Delaunay 三角剖分示例</figcaption>
</figure>

## Voronoi 图

Voronoi 图是 Delaunay 的对偶图——每个区域内的所有点都"最接近"某个种子点。可以直接从 Delaunay 构建器获取：

```csharp
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(points);

// 获取 Voronoi 图（MultiPolygon，每个 Polygon 是一个势力范围）
var voronoi = builder.GetSubdivision()
                     .GetVoronoiDiagram(factory);

foreach (Polygon cell in voronoi.Geometries)
{
    // cell 内的所有点都最接近同一个种子
}
```

<figure class="nts-diagram">
<svg viewBox="0 0 240 160" width="240" height="160">
  <g stroke="#0b6e4f" stroke-width="1.2" fill="none">
    <path d="M 50 0 L 50 60 L 0 110"/>
    <path d="M 50 60 L 110 60 L 90 160"/>
    <path d="M 110 60 L 110 0"/>
    <path d="M 110 60 L 170 60 L 200 0"/>
    <path d="M 110 60 L 170 60 L 170 160"/>
    <path d="M 170 60 L 240 110"/>
    <path d="M 0 110 L 90 160"/>
    <path d="M 90 160 L 170 160"/>
  </g>
  <g fill="#a00">
    <circle cx="40" cy="40" r="3"/><circle cx="110" cy="20" r="3"/>
    <circle cx="190" cy="30" r="3"/><circle cx="70" cy="100" r="3"/>
    <circle cx="140" cy="100" r="3"/><circle cx="200" cy="100" r="3"/>
  </g>
</svg>
<figcaption>Voronoi 图：每块区域属于最近的种子点</figcaption>
</figure>

## ConformingDelaunayTriangulationBuilder：带约束

普通 Delaunay 只看点的位置，不尊重"线段约束"。如果你想在剖分中保留某条线段（如河流、道路），用约束版本：

```csharp
using NetTopologySuite.Triangulate;

var builder = new ConformingDelaunayTriangulationBuilder();

// 站点（点集）
builder.SetSites(points);

// 约束线段（这些线段必须出现在三角网格中）
var constraints = new List<Geometry>
{
    factory.CreateLineString(new[] { new Coordinate(0, 0), new Coordinate(6, 6) })
};
builder.SetConstraints(new GeometryCollection(constraints.ToArray(), factory));

var triangles = builder.GetTriangles(factory);
```

约束三角剖分会向网格中添加点，确保约束线段不跨三角形。

## VoronoiDiagramBuilder：直接 Voronoi

如果只想要 Voronoi 图，不必绕道 Delaunay：

```csharp
using NetTopologySuite.Triangulate;

var builder = new VoronoiDiagramBuilder();
builder.SetSites(points);

// 限制 Voronoi 图的边界（不裁剪则延伸到无穷远）
builder.ClipEnvelope = new Envelope(0, 10, 0, 10);

var diagram = builder.GetDiagram(factory);
```

## QuadEdgeSubdivision：底层结构

Delaunay 与 Voronoi 都基于 `QuadEdgeSubdivision`——一种四边数据结构，能同时表达三角形网格与对偶 Voronoi 图。需要细粒度控制时直接用它：

```csharp
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(points);

QuadEdgeSubdivision subdiv = builder.GetSubdivision();

// 访问所有顶点
foreach (var v in subdiv.GetVertices()) { ... }

// 访问所有三角形（primary faces）
foreach (var tri in subdiv.GetTriangleFaces(false)) { ... }

// 找包含某个点的三角形
var visitor = new QuadEdgeTriangleContainingPointLocator(subdiv);
var tri = visitor.Locate(new Coordinate(3, 3));
```

## 实战：高程插值

假设有 100 个高程采样点，要插值出任意位置的高程：

```csharp
// 1. 用 Delaunay 构建三角网格
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(samples.Select(s => s.Coordinate));
var subdiv = builder.GetSubdivision();

// 2. 定位查询点所在的三角形
var locator = new QuadEdgeTriangleContainingPointLocator(subdiv);
var tri = locator.Locate(queryPoint) as QuadEdgeTriangle;

// 3. 双线性插值
double elevation = Interpolate(tri, queryPoint);

double Interpolate(QuadEdgeTriangle tri, Coordinate p)
{
    // 取三角形三个顶点的高程
    var (a, b, c) = (tri.GetCoordinate(0), tri.GetCoordinate(1), tri.GetCoordinate(2));
    double zA = SampleAt(a), zB = SampleAt(b), zC = SampleAt(c);

    // 重心坐标插值
    double denom = (b.Y - c.Y) * (a.X - c.X) + (c.X - b.X) * (a.Y - c.Y);
    double wA = ((b.Y - c.Y) * (p.X - c.X) + (c.X - b.X) * (p.Y - c.Y)) / denom;
    double wB = ((c.Y - a.Y) * (p.X - c.X) + (a.X - c.X) * (p.Y - c.Y)) / denom;
    double wC = 1 - wA - wB;

    return wA * zA + wB * zB + wC * zC;
}
```

## 实战：服务区划分（Voronoi）

5 个配送中心，把城市划分成 5 块"最近中心负责"的区域：

```csharp
var centers = new[] { /* 5 个配送中心坐标 */ };

var builder = new VoronoiDiagramBuilder();
builder.SetSites(centers);
builder.ClipEnvelope = cityBoundary.EnvelopeInternal;

var voronoi = builder.GetDiagram(factory);

// 用城市边界裁剪 Voronoi 单元
var zones = voronoi.Geometries
    .Select(cell => cell.Intersection(cityBoundary))
    .ToList();
```

## 性能注意

- Delaunay 算法复杂度 O(n log n)，但常数因子较大
- 1 万点级：构建 < 1 秒
- 10 万点级：构建 5~15 秒，需要考虑分块
- 大数据集可先用 STRtree 分块，对每块单独剖分

## 小结

| 类 | 用途 |
| --- | --- |
| `DelaunayTriangulationBuilder` | 普通 Delaunay 三角剖分 |
| `ConformingDelaunayTriangulationBuilder` | 带约束线段 |
| `VoronoiDiagramBuilder` | 直接构建 Voronoi 图 |
| `QuadEdgeSubdivision` | 底层数据结构，支持细粒度查询 |

## 下一步

- [空间索引 STRtree](./spatial-index.md)
- [自定义操作与扩展](./extending.md)
- [API 速查表](../cookbook/cheatsheet.md)
