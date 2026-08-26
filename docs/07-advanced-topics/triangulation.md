# 三角剖分

三角剖分把离散点集或几何体转换为三角形网格，是地形建模、最近邻区域划分、空间插值与图形渲染的基础。NTS 在 `NetTopologySuite.Triangulate` 命名空间下提供了一整套 Delaunay 三角剖分、Voronoi 图与多边形内部三角化的实现。

本页逐方法讲解三角剖分 API：每个类与方法的签名、语义、C# 示例、输出与常见陷阱，配 SVG 图示关键概念。

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.Triangulate;
using NetTopologySuite.Triangulate.QuadEdge;
using NetTopologySuite.Triangulate.Polygon;

// 本页示例共用工厂
var factory = new GeometryFactory();
```

## 三角剖分概念

### Delaunay 三角剖分

给定平面点集 P，**Delaunay 三角剖分** 是一种把 P 连成三角形网格的方式，满足两条等价性质：

- **空圆性质**：任意一个三角形的外接圆内部不包含 P 中的其他点。
- **最大化最小角**：在所有可能的三角化中，Delaunay 三角化使"最小的内角"达到最大——也就是最避免出现瘦长、退化三角形。

::: tip 退化情况
当 4 个或更多点共圆时，Delaunay 三角剖分不唯一（存在"翻转"二义性）。NTS 会给出其中一种合法结果。若数据可能共圆，不要假设顶点连接方式唯一。
:::

### Voronoi 图

**Voronoi 图**把平面划分成若干区域，每个区域对应一个种子点 p，区域内任意位置到 p 的距离都小于到其他种子点的距离。Voronoi 图与 Delaunay 三角剖分互为**对偶图**：

| Delaunay | Voronoi |
| --- | --- |
| 三角形 | Voronoi 顶点（三角形外心） |
| 三角形的边 | Voronoi 的边（两侧种子点的中垂线段） |
| 三角形的顶点 | Voronoi 的面（该顶点的"势力范围"） |

<figure class="nts-diagram">
<svg viewBox="0 0 360 180" width="360" height="180">
  <!-- Voronoi 边（对偶） -->
  <g stroke="#a86300" stroke-width="1" fill="none" stroke-dasharray="3 3">
    <path d="M 110 30 L 110 80 L 60 130"/>
    <path d="M 110 80 L 180 80 L 180 130"/>
    <path d="M 180 80 L 250 80 L 280 30"/>
    <path d="M 250 80 L 250 150"/>
    <path d="M 110 80 L 60 80"/>
  </g>
  <!-- Delaunay 三角形 -->
  <g stroke="#0b6e4f" stroke-width="1.4" fill="rgba(11,110,79,0.12)">
    <polygon points="60,30 180,30 110,80"/>
    <polygon points="180,30 280,30 250,80"/>
    <polygon points="180,30 250,80 110,80"/>
    <polygon points="60,30 110,80 60,80"/>
    <polygon points="60,80 110,80 60,130"/>
    <polygon points="110,80 180,80 60,130"/>
    <polygon points="110,80 180,80 180,130"/>
    <polygon points="180,80 250,80 180,130"/>
    <polygon points="250,80 280,30 280,90"/>
  </g>
  <!-- 种子点 -->
  <g fill="#a00">
    <circle cx="60" cy="30" r="3"/><circle cx="180" cy="30" r="3"/>
    <circle cx="280" cy="30" r="3"/><circle cx="60" cy="80" r="3"/>
    <circle cx="110" cy="80" r="3"/><circle cx="180" cy="80" r="3"/>
    <circle cx="250" cy="80" r="3"/><circle cx="60" cy="130" r="3"/>
    <circle cx="180" cy="130" r="3"/>
  </g>
  <text x="200" y="170" font-family="monospace" font-size="10" fill="#0b6e4f">Delaunay（实线）</text>
  <text x="60" y="170" font-family="monospace" font-size="10" fill="#a86300">Voronoi（虚线，对偶）</text>
</svg>
<figcaption>Delaunay 三角剖分与 Voronoi 图的对偶关系</figcaption>
</figure>

### 应用场景

| 场景 | 用哪个类 |
| --- | --- |
| 地形建模（DEM 三角网） | `DelaunayTriangulationBuilder` |
| 最近邻区域 / 服务区划分 | `VoronoiDiagramBuilder` |
| 等值线生成（先建 TIN 再追踪） | `DelaunayTriangulationBuilder` |
| 多边形三角化（渲染、面积分块） | `ConstrainedDelaunayTriangulator` |
| 保留河流/道路边的地形剖分 | `ConformingDelaunayTriangulationBuilder` |
| 细粒度查询（定位点所在三角形） | `QuadEdgeSubdivision` |

## DelaunayTriangulationBuilder 类

最常用的 Delaunay 三角剖分入口。流程固定：`SetSites` → `GetTriangles` / `GetEdges` / `GetSubdivision`。

### SetSites

**签名**：
```csharp
public void SetSites(ICollection<Coordinate> coords);
public void SetSites(Geometry geom);
```

**语义**：设置参与三角剖分的点集。两种重载：

- 传 `Coordinate` 集合：直接用这些点作为站点
- 传 `Geometry`：提取几何的所有顶点作为站点（自动去重）

调用后内部会去重并计算外接矩形。

```csharp
// 方式 1：坐标数组
var points = new[]
{
    new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(2, 3),
    new Coordinate(6, 2), new Coordinate(5, 5), new Coordinate(1, 4)
};
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(points);

// 方式 2：从几何体提取顶点
var multiPoint = factory.CreateMultiPointFromCoords(points);
var b2 = new DelaunayTriangulationBuilder();
b2.SetSites(multiPoint);   // 等价
```

::: warning SetSites 必须在 Get* 之前调用
`SetSites` 是唯一设置输入的入口。若忘记调用，`GetTriangles` 会抛出空引用或返回空集。设置后修改原数组不影响已计算的剖分（站点已被复制）。
:::

### Tolerance

**签名**：`public double Tolerance { set; }`

**语义**：设置容差，距离小于该值的两个点被视为同一点（吸附），用于提升数值稳健性。默认 `0.0`（不吸附）。

```csharp
builder.SetSites(points);
builder.Tolerance = 1e-6;   // 容差，必须在 Get* 之前设置
```

::: tip 共点数据的稳健性
含浮点噪声的采样点（如轨迹点几乎重合）可能导致剖分失败。设一个略大于噪声量级的 `Tolerance`（如 `1e-7`）能避免大部分稳健性问题。
:::

### GetTriangles

**签名**：`public GeometryCollection GetTriangles(GeometryFactory geomFact)`

**语义**：返回所有三角形，类型为 `GeometryCollection`，每个子几何是一个 `Polygon`（3 个顶点）。`geomFact` 决定输出几何的工厂（含 SRID、精度模型）。

```csharp
builder.SetSites(points);
GeometryCollection triangles = builder.GetTriangles(factory);

Console.WriteLine($"三角形数 = {triangles.NumGeometries}");
// 6 个点 → 通常 4 个三角形（n 个点 → 约 2n − 5 个三角形）

foreach (Polygon tri in triangles.Geometries)
{
    Console.WriteLine($"面积 = {tri.Area:F2}");
}
```

输出示例：
```
三角形数 = 4
面积 = 6.00
面积 = 5.50
...
```

::: warning GetTriangles 不包含外接"框"
剖分内部用一个超大的 frame 三角形包围所有点，输出的三角形已**剔除 frame 与之相连的辅助三角形**，只保留点集凸包内的部分。凸包外的"延伸区域"不会出现。
:::

### GetEdges

**签名**：`public MultiLineString GetEdges(GeometryFactory geomFact)`

**语义**：返回三角网格的边，类型为 `MultiLineString`。每条边是一条两点的 `LineString`。与 `GetTriangles` 共享同一份剖分，不会重算。

```csharp
builder.SetSites(points);
MultiLineString edges = builder.GetEdges(factory);

Console.WriteLine($"边数 = {edges.NumGeometries}");
// 三角形数 T、点数 n（凸包上 h 个点）：边数 ≈ 3T/2 + ...

// 常见用途：可视化三角网、找最长边、抽稀
double maxLen = edges.Geometries
    .Cast<LineString>()
    .Max(l => l.Length);
```

::: tip 同时取三角形和边会算两次吗
不会。`DelaunayTriangulationBuilder` 内部缓存了 `QuadEdgeSubdivision`，`GetTriangles` / `GetEdges` / `GetSubdivision` 第一次调用任一时构建，之后复用。
:::

### GetSubdivision

**签名**：`public QuadEdgeSubdivision GetSubdivision()`

**语义**：返回底层四边细分结构 `QuadEdgeSubdivision`。需要遍历顶点、定位点所在三角形、获取 Voronoi 图等细粒度操作时使用。详见 [QuadEdgeSubdivision](#quadedgesubdivision-类)。

```csharp
builder.SetSites(points);
QuadEdgeSubdivision subdiv = builder.GetSubdivision();

// 直接从细分结构取 Voronoi 图（不必另起 VoronoiDiagramBuilder）
GeometryCollection voronoi = subdiv.GetVoronoiDiagram(factory);

// 取所有顶点
foreach (Vertex v in subdiv.GetVertices(includeFrame: false))
{
    Console.WriteLine($"({v.X}, {v.Y})");
}
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 200" width="360" height="200">
  <g stroke="#0b6e4f" stroke-width="1.3" fill="rgba(11,110,79,0.12)">
    <polygon points="40,40 140,30 90,90"/>
    <polygon points="140,30 240,40 190,90"/>
    <polygon points="140,30 190,90 90,90"/>
    <polygon points="240,40 320,60 270,110"/>
    <polygon points="240,40 270,110 190,90"/>
    <polygon points="90,90 190,90 140,150"/>
    <polygon points="190,90 270,110 220,150"/>
    <polygon points="140,150 220,150 190,90"/>
  </g>
  <g fill="#a00">
    <circle cx="40" cy="40" r="3.5"/><circle cx="140" cy="30" r="3.5"/>
    <circle cx="240" cy="40" r="3.5"/><circle cx="320" cy="60" r="3.5"/>
    <circle cx="90" cy="90" r="3.5"/><circle cx="190" cy="90" r="3.5"/>
    <circle cx="270" cy="110" r="3.5"/><circle cx="140" cy="150" r="3.5"/>
    <circle cx="220" cy="150" r="3.5"/>
  </g>
  <!-- 空圆示意：一个三角形的外接圆内不含其他点 -->
  <circle cx="140" cy="90" r="55" fill="none" stroke="#a86300" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="150" y="92" font-family="monospace" font-size="9" fill="#a86300">空圆</text>
</svg>
<figcaption>DelaunayTriangulationBuilder 的输出：点集三角网，空圆性质成立</figcaption>
</figure>

## VoronoiDiagramBuilder 类

只想要 Voronoi 图时，直接用 `VoronoiDiagramBuilder`，不必绕道 Delaunay 构建器。它内部仍先建 Delaunay，再取对偶。

### SetSites

**签名**：
```csharp
public void SetSites(ICollection<Coordinate> coords);
public void SetSites(Geometry geom);
```

**语义**：设置 Voronoi 的种子点，重载语义同 `DelaunayTriangulationBuilder.SetSites`。

```csharp
var seeds = new[]
{
    new Coordinate(2, 2), new Coordinate(8, 3), new Coordinate(5, 7),
    new Coordinate(1, 8), new Coordinate(9, 9)
};
var vb = new VoronoiDiagramBuilder();
vb.SetSites(seeds);
```

### SetClipEnvelope / ClipEnvelope

**签名**：`public Envelope ClipEnvelope { set; }`

**语义**：设置裁剪矩形。Voronoi 单元理论上是无限延伸的多边形（外圈单元向无穷远张开），必须裁剪才能得到有界多边形。

- 不设置：用种子点外接矩形向外扩展一定比例作为裁剪框
- 设置后：用"裁剪框"与"种子外接矩形扩展框"中**较大**的那个裁剪

```csharp
vb.SetSites(seeds);
vb.ClipEnvelope = new Envelope(0, 10, 0, 10);   // 限制在 [0,10]×[0,10]
```

::: warning ClipEnvelope 是 set-only 且只取较大者
`ClipEnvelope` 是只写属性，且 NTS 取"你给的框"与"种子外接框扩展"中较大的一个。想让 Voronoi 严格贴城市边界，应在 `GetDiagram` 后再用 `cityBoundary.Intersection(cell)` 二次裁剪，不能只靠 `ClipEnvelope`。
:::

### SetTolerance / Tolerance

**签名**：`public double Tolerance { set; }`

**语义**：吸附容差，同 Delaunay 侧。重复或近乎重复的种子点会被合并，避免退化。

```csharp
vb.Tolerance = 1e-7;
```

### GetDiagram

**签名**：`public GeometryCollection GetDiagram(GeometryFactory geomFact)`

**语义**：返回 Voronoi 图，类型为 `GeometryCollection`，每个子几何是一个 `Polygon`——对应一个种子点的势力范围。

**关键特性**：每个单元 `Polygon` 的 `UserData` 被设置为对应种子点的 `Coordinate`。这是把"单元"映射回"种子点"的官方通道。

```csharp
vb.SetSites(seeds);
vb.ClipEnvelope = new Envelope(0, 10, 0, 10);

GeometryCollection diagram = vb.GetDiagram(factory);
Console.WriteLine($"单元数 = {diagram.NumGeometries}");   // 5

foreach (Polygon cell in diagram.Geometries)
{
    var site = (Coordinate)cell.UserData;   // 该单元的种子点
    Console.WriteLine($"单元面积 = {cell.Area:F2}, 种子 = ({site.X},{site.Y})");
}
```

::: tip 单元顺序与种子顺序不保证一致
`GetDiagram` 返回的单元顺序不一定等于 `SetSites` 的输入顺序。务必通过 `UserData` 取种子坐标做关联，不要按下标对应。
:::

<figure class="nts-diagram">
<svg viewBox="0 0 360 220" width="360" height="220">
  <g stroke="#0b6e4f" stroke-width="1.4" fill="rgba(11,110,79,0.18)">
    <polygon points="20,20 160,20 160,100 100,140 20,100"/>
    <polygon points="160,20 340,20 340,90 240,120 160,100"/>
    <polygon points="20,100 100,140 60,200 20,200"/>
    <polygon points="100,140 240,120 220,200 60,200"/>
    <polygon points="240,120 340,90 340,200 220,200"/>
  </g>
  <!-- 种子点 -->
  <g fill="#a00">
    <circle cx="90" cy="70" r="4"/><circle cx="250" cy="65" r="4"/>
    <circle cx="170" cy="130" r="4"/><circle cx="50" cy="160" r="4"/>
    <circle cx="290" cy="160" r="4"/>
  </g>
  <g font-family="monospace" font-size="9" fill="#a00">
    <text x="96" y="74">p1</text><text x="256" y="69">p2</text>
    <text x="176" y="134">p3</text><text x="56" y="164">p4</text>
    <text x="296" y="164">p5</text>
  </g>
</svg>
<figcaption>VoronoiDiagramBuilder 输出：每个 Polygon 内所有点都最接近对应的种子</figcaption>
</figure>

## ConformingDelaunayTriangulationBuilder 类

普通 Delaunay 只看点的位置，**不尊重任何线段约束**——一条河流、道路在结果里会被切分成多段跨越多个三角形。若想强制让某条线段作为完整边出现在三角网中，用约束版本。

**约束 Delaunay（Conforming Delaunay）** 与 **受限 Delaunay（Constrained Delaunay）** 的区别：

- **Conforming**：通过在约束线段上**插入额外点**（细分），使最终三角网同时满足 Delaunay 性质 **且** 约束线段作为边出现。NTS 的 `ConformingDelaunayTriangulationBuilder` 走这条路。
- **Constrained**：允许约束线段两侧三角形违反空圆性质，不插点。NTS 的多边形 `ConstrainedDelaunayTriangulator` 走这条路。

### SetSites

**签名**：`public void SetSites(Geometry sites)`

**语义**：设置站点（取几何体的所有顶点）。站点顶点不必包含约束顶点；与约束顶点重合的站点会被自动剔除。

```csharp
var builder = new ConformingDelaunayTriangulationBuilder();
builder.SetSites(factory.CreateMultiPointFromCoords(points));
```

### Constraints

**签名**：`public Geometry Constraints { set; }`

**语义**：设置约束线段。输入几何的所有线性分量（`LineString` / `MultiLineString`）都会作为约束边。约束顶点不必与站点不相交。**约束不能包含重复线段**（方向无关）。

```csharp
var builder = new ConformingDelaunayTriangulationBuilder();
builder.SetSites(factory.CreateMultiPointFromCoords(points));

// 一条必须出现在三角网中的线段（如河流）
var constraint = (Geometry)factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(6, 6)
});
builder.Constraints = constraint;
builder.Tolerance = 1e-6;
```

### Tolerance

**签名**：`public double Tolerance { get; set; }`

**语义**：吸附容差。约束强制阶段可能因数值问题失败，设一个非零容差能显著提升成功率。

### GetTriangles / GetEdges / GetSubdivision

**签名**：
```csharp
public GeometryCollection GetTriangles(GeometryFactory geomFact);
public MultiLineString GetEdges(GeometryFactory geomFact);
public QuadEdgeSubdivision GetSubdivision();
```

**语义**：与 `DelaunayTriangulationBuilder` 同名方法一致，返回的三角网已包含为满足约束而插入的额外点。

```csharp
builder.Constraints = constraint;
GeometryCollection triangles = builder.GetTriangles(factory);
Console.WriteLine($"三角形数 = {triangles.NumGeometries}");
// 比无约束版本多——因为约束线段上插入了细分点
```

::: warning ConstraintEnforcementException
约束强制在极端几何（极窄角、近共线约束）下可能抛 `ConstraintEnforcementException`。处理方式：调大 `Tolerance`、简化约束线段，或改用多边形内部的 `ConstrainedDelaunayTriangulator`。
:::

<figure class="nts-diagram">
<svg viewBox="0 0 360 200" width="360" height="200">
  <g stroke="#0b6e4f" stroke-width="1.2" fill="rgba(11,110,79,0.12)">
    <polygon points="40,40 120,30 90,80"/>
    <polygon points="40,40 90,80 60,120"/>
    <polygon points="120,30 200,40 150,80"/>
    <polygon points="120,30 150,80 90,80"/>
    <polygon points="90,80 150,80 120,120"/>
    <polygon points="90,80 120,120 60,120"/>
    <polygon points="150,80 200,40 240,80"/>
    <polygon points="150,80 240,80 180,140"/>
    <polygon points="150,80 180,140 120,120"/>
    <polygon points="240,80 300,60 300,120"/>
    <polygon points="240,80 300,120 180,140"/>
  </g>
  <!-- 约束边（红色，必须作为完整边出现，其上插入了细分点） -->
  <line x1="40" y1="40" x2="300" y2="120" stroke="#a00" stroke-width="2.5"/>
  <g fill="#a00">
    <circle cx="40" cy="40" r="3.5"/><circle cx="300" cy="120" r="3.5"/>
  </g>
  <!-- 约束上的细分点 -->
  <g fill="#a86300">
    <circle cx="120" cy="60" r="3"/><circle cx="200" cy="80" r="3"/>
  </g>
  <text x="60" y="180" font-family="monospace" font-size="10" fill="#a00">约束边（红）</text>
  <text x="180" y="180" font-family="monospace" font-size="10" fill="#a86300">细分点（橙）</text>
</svg>
<figcaption>ConformingDelaunay：约束线段作为完整边保留，必要时插入细分点</figcaption>
</figure>

## ConstrainedDelaunayTriangulator：多边形内部三角化

> 任务说明里把它叫 `DelaunayTriangulator`——NTS 中真正"直接对多边形内部三角化"的类是 `NetTopologySuite.Triangulate.Polygon.ConstrainedDelaunayTriangulator`。

这类专门用于把一个（或多个）多边形**内部**剖分成三角形，保留外壳与孔洞边界作为约束边，**不插点**。它是渲染、面积分块、有限元前处理的标准工具。

### Triangulate（静态入口）

**签名**：`public static Geometry Triangulate(Geometry geom)`

**语义**：对输入几何中的每个 `Polygon` 元素做受限 Delaunay 三角化，返回 `GeometryCollection` of `Polygon`（每个是三角形）。孔洞会被保留为三角形之间的"空洞"。

```csharp
// 带孔洞的凹多边形
var shell = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(5, 5), new Coordinate(0, 10), new Coordinate(0, 0)
});
var hole = factory.CreateLinearRing(new[]
{
    new Coordinate(4, 4), new Coordinate(6, 4), new Coordinate(6, 6),
    new Coordinate(4, 6), new Coordinate(4, 4)
});
var poly = factory.CreatePolygon(shell, new[] { hole });

Geometry tris = ConstrainedDelaunayTriangulator.Triangulate(poly);
Console.WriteLine($"三角形数 = {tris.NumGeometries}");

// 校验：三角形面积之和 = 原多边形面积（外壳 − 孔洞）
double sumArea = 0;
foreach (Polygon t in tris.Geometries) sumArea += t.Area;
Console.WriteLine($"面积校验: {sumArea:F4} vs {poly.Area:F4}");   // 相等
```

::: tip 多边形三角化用这个，不要用 SetSites
用 `DelaunayTriangulationBuilder.SetSites(poly)` 只会把多边形顶点当点集，得到的三角网覆盖顶点的凸包，会越过凹处与孔洞。要让三角形严格填在多边形**内部**（含挖洞），必须用 `ConstrainedDelaunayTriangulator`。
:::

### GetResult / GetTriangles（实例 API）

**签名**：
```csharp
public ConstrainedDelaunayTriangulator(Geometry inputGeom);
public Geometry GetResult();              // 返回 GeometryCollection of Polygon
public IList<Tri> GetTriangles();         // 返回轻量 Tri 列表（无需 GeometryFactory）
```

**语义**：构造后调用 `GetResult` 与静态 `Triangulate` 等价；`GetTriangles` 返回更轻量的 `Tri` 对象（仅含顶点索引与拓扑），适合不需要 `Polygon` 对象的算法链路。

```csharp
var cdt = new ConstrainedDelaunayTriangulator(poly);
IList<Tri> tris = cdt.GetTriangles();
Console.WriteLine($"Tri 数 = {tris.Count}");
```

::: warning 输入必须是有效的 Polygon
`ConstrainedDelaunayTriangulator` 假定输入多边形有效（不自相交、孔洞在外壳内）。无效多边形会得到错误三角化或异常。先 `IsValid` 校验，无效的用 `Buffer(0)` 或 `GeometryFixer` 修复。
:::

<figure class="nts-diagram">
<svg viewBox="0 0 360 200" width="360" height="200">
  <!-- 凹多边形外壳 + 内部三角化 -->
  <g stroke="#0b6e4f" stroke-width="1.3" fill="rgba(11,110,79,0.15)">
    <polygon points="40,40 320,40 180,100 320,160 40,160"/>
  </g>
  <g stroke="#0b6e4f" stroke-width="1" fill="none">
    <line x1="40" y1="40" x2="180" y2="100"/>
    <line x1="180" y1="100" x2="320" y2="40"/>
    <line x1="40" y1="160" x2="180" y2="100"/>
    <line x1="180" y1="100" x2="320" y2="160"/>
    <line x1="40" y1="40" x2="40" y2="160"/>
    <line x1="320" y1="40" x2="320" y2="160"/>
    <line x1="40" y1="40" x2="180" y2="160"/>
    <line x1="320" y1="40" x2="180" y2="160"/>
  </g>
  <!-- 孔洞（三角形围绕的空白） -->
  <rect x="160" y="80" width="40" height="40" fill="#fff" stroke="#a00" stroke-width="1.5"/>
  <text x="170" y="105" font-family="monospace" font-size="9" fill="#a00">孔洞</text>
</svg>
<figcaption>ConstrainedDelaunayTriangulator：多边形内部三角化，保留孔洞</figcaption>
</figure>

## QuadEdgeSubdivision 类

四边细分（QuadEdge）是 NTS 三角剖分的底层数据结构：一个 `QuadEdgeSubdivision` 同时编码 Delaunay 三角网与其对偶 Voronoi 图。`DelaunayTriangulationBuilder.GetSubdivision()` 返回的就是它。需要遍历、定位、自定义算法时直接使用。

> 关于遍历方法命名：NTS 在此类上**没有** `VisitVertices` / `VisitEdges` 方法。遍历顶点用 `GetVertices`，遍历边用 `GetPrimaryEdges` / `GetVertexUniqueEdges`，遍历三角形用 `GetTriangleEdges` 或 `VisitTriangles`（带 `ITriangleVisitor`）。下面按真实 API 讲解。

### GetVertices（遍历顶点）

**签名**：`public IEnumerable<Vertex> GetVertices(bool includeFrame)`

**语义**：返回所有顶点。`includeFrame: false` 时剔除包围点集的外部 frame 顶点（通常就是你想要的）。

```csharp
QuadEdgeSubdivision subdiv = builder.GetSubdivision();

foreach (Vertex v in subdiv.GetVertices(includeFrame: false))
{
    Console.WriteLine($"顶点 ({v.X:F2}, {v.Y:F2})");
}
```

::: warning 一定要传 includeFrame: false
默认若传 `true`，结果会包含 NTS 为包围点集而引入的 3 个 frame 顶点（位置在很远的外部）。绝大多数业务场景要传 `false`。
:::

### GetPrimaryEdges / GetVertexUniqueEdges（遍历边）

**签名**：
```csharp
public IList<QuadEdge> GetPrimaryEdges(bool includeFrame);
public IEnumerable<QuadEdge> GetVertexUniqueEdges(bool includeFrame);
```

**语义**：
- `GetPrimaryEdges`：返回三角网格的所有边（每条无向边只取一个方向）
- `GetVertexUniqueEdges`：每个顶点返回一条从它出发的边，便于"按顶点遍历邻接结构"

```csharp
foreach (QuadEdge e in subdiv.GetPrimaryEdges(includeFrame: false))
{
    Coordinate a = e.Orig.Coordinate, b = e.Dest.Coordinate;
    double len = a.Distance(b);
    // ...
}
```

::: tip QuadEdge 的方向
`QuadEdge` 是有向的，`e` 与 `e.Sym` 表示同一条无向边的两个方向。`GetPrimaryEdges` 已去重，每条无向边只返回一次。
:::

### VisitTriangles（访问者模式遍历三角形）

**签名**：`public void VisitTriangles(ITriangleVisitor triVisitor, bool includeFrame)`

**语义**：用访问者模式遍历所有三角形。`ITriangleVisitor.Visit(QuadEdge[] triEdges)` 接收三角形的 3 条边（CCW 顺序）。适合在遍历中累积状态、过滤特定三角形。

```csharp
// 统计面积小于 1 的"瘦小"三角形
int smallCount = 0;
subdiv.VisitTriangles(new CountSmallVisitor(() => smallCount++), includeFrame: false);

// 自定义访问者
public class CountSmallVisitor : ITriangleVisitor
{
    private readonly Action _onSmall;
    public CountSmallVisitor(Action onSmall) => _onSmall = onSmall;

    public void Visit(QuadEdge[] triEdges)
    {
        // 取三个顶点计算面积
        var a = triEdges[0].Orig.Coordinate;
        var b = triEdges[1].Orig.Coordinate;
        var c = triEdges[2].Orig.Coordinate;
        double area = Math.Abs((b.X - a.X) * (c.Y - a.Y)
                             - (c.X - a.X) * (b.Y - a.Y)) * 0.5;
        if (area < 1.0) _onSmall();
    }
}
```

::: tip 也可用 GetTriangleEdges / GetTriangleCoordinates
若不需访问者模式的"边对象"，`GetTriangleEdges(bool)` 返回 `IList<QuadEdge[]>`，`GetTriangleCoordinates(bool)` 返回 `IList<Coordinate[]>`，更直接。
:::

### Locate

**签名**：`public QuadEdge Locate(Coordinate p)`

**语义**：定位点 `p`，返回一条以包含 `p` 的三角形为左面的 `QuadEdge`。是基于已建好的细分结构的快速定位（O(√n) 量级）。

```csharp
QuadEdge e = subdiv.Locate(new Coordinate(3, 3));
// e 的左面三角形即包含 (3,3) 的三角形
```

::: warning Locate 返回的是边，不是三角形
`Locate` 返回 `QuadEdge`，要拿三角形需配合 `GetTriangleEdges`，或改用 `QuadEdgeTriangleContainingPointLocator`（见下文实战）。点落在 frame 外或细分外时行为未定义——务必先检查点是否在 `subdiv.Envelope` 内。
:::

### GetVoronoiCellPolygon / GetVoronoiDiagram

**签名**：
```csharp
public Polygon GetVoronoiCellPolygon(QuadEdge qe, GeometryFactory geomFact);
public IList<Geometry> GetVoronoiCellPolygons(GeometryFactory geomFact);
public GeometryCollection GetVoronoiDiagram(GeometryFactory geomFact);
```

**语义**：
- `GetVoronoiDiagram`：返回完整 Voronoi 图（`GeometryCollection` of `Polygon`）
- `GetVoronoiCellPolygons`：返回所有 Voronoi 单元列表
- `GetVoronoiCellPolygon(qe, ...)`：传入一条**以种子点为起点**的 `QuadEdge`，返回该种子点对应的 Voronoi 单元。用于只取单个单元的场景

```csharp
// 完整 Voronoi 图
GeometryCollection voronoi = subdiv.GetVoronoiDiagram(factory);

// 单个单元：先定位一条从某种子点出发的边
QuadEdge qe = subdiv.Locate(seedCoord);
Polygon cell = subdiv.GetVoronoiCellPolygon(qe, factory);
```

::: warning GetVoronoiCellPolygon 的参数是从种子点出发的边
`qe` 必须是一条 `Orig` 为种子点的 `QuadEdge`，传错边会得到错误的单元。不确定时直接用 `GetVoronoiDiagram`，按 `UserData` 关联种子。
:::

## 实战：高程插值

100 个高程采样点，插值任意位置的高程。典型流程：建三角网 → 定位查询点所在三角形 → 重心坐标插值。

```csharp
// 1. 用 Delaunay 构建三角网
var builder = new DelaunayTriangulationBuilder();
builder.SetSites(samples.Select(s => s.Coordinate).ToList());
QuadEdgeSubdivision subdiv = builder.GetSubdivision();

// 2. 定位查询点所在三角形（用现成的 locator）
var locator = new QuadEdgeTriangleContainingPointLocator(subdiv);
QuadEdgeTriangle tri = locator.Locate(queryPoint) as QuadEdgeTriangle;

// 3. 重心坐标插值
double elevation = Interpolate(tri, queryPoint, samples);

double Interpolate(QuadEdgeTriangle tri, Coordinate p, List<Sample> data)
{
    Coordinate a = tri.GetCoordinate(0),
              b = tri.GetCoordinate(1),
              c = tri.GetCoordinate(2);
    double zA = Lookup(data, a), zB = Lookup(data, b), zC = Lookup(data, c);

    // 重心坐标
    double denom = (b.Y - c.Y) * (a.X - c.X) + (c.X - b.X) * (a.Y - c.Y);
    double wA = ((b.Y - c.Y) * (p.X - c.X) + (c.X - b.X) * (p.Y - c.Y)) / denom;
    double wB = ((c.Y - a.Y) * (p.X - c.X) + (a.X - c.X) * (p.Y - c.Y)) / denom;
    double wC = 1 - wA - wB;

    return wA * zA + wB * zB + wC * zC;
}
```

::: tip 查询点落在凸包外
`QuadEdgeTriangleContainingPointLocator` 对凸包外的点返回 frame 三角形，插值会得到无意义的外推值。生产环境应先检查 `queryPoint` 是否在采样点凸包内（`point.Within(ConvexHull)`），范围外用其他策略（最近邻、外推限制）。
:::

## 实战：服务区划分（Voronoi + 边界裁剪）

5 个配送中心，把城市划分成 5 块"最近中心负责"的区域。`ClipEnvelope` 只能矩形裁剪，要严格贴城市边界须二次裁剪。

```csharp
var centers = new[] { /* 5 个配送中心坐标 */ };
var cityBoundary = (Polygon)/* 城市边界多边形 */;

var vb = new VoronoiDiagramBuilder();
vb.SetSites(centers);
vb.ClipEnvelope = cityBoundary.EnvelopeInternal;   // 粗裁剪到外接矩形

GeometryCollection rawDiagram = vb.GetDiagram(factory);

// 用城市边界精确裁剪每个单元
var zones = new List<Polygon>();
foreach (Polygon cell in rawDiagram.Geometries)
{
    var site = (Coordinate)cell.UserData;          // 该单元对应的配送中心
    Geometry zone = cell.Intersection(cityBoundary);
    if (zone is Polygon p) zones.Add(p);
    else if (zone is MultiPolygon mp)
        foreach (Polygon part in mp.Geometries) zones.Add(part);

    Console.WriteLine($"中心 ({site.X},{site.Y}) → 区域面积 {zone.Area:F0}");
}
```

## 实战：多边形三角化（用于渲染）

把一个复杂多边形转成三角形列表，喂给 OpenGL / DirectX / Canvas 等渲染管线。

```csharp
// 大量带孔多边形 → 三角形列表
Geometry tris = ConstrainedDelaunayTriangulator.Triangulate(multiPoly);

var verts = new List<float>();
foreach (Polygon t in tris.Geometries)
{
    foreach (Coordinate c in t.Coordinates.Take(3))   // 每个三角形 3 顶点
    {
        verts.Add((float)c.X);
        verts.Add((float)c.Y);
    }
}
// 上传 verts 到 GPU 缓冲
```

## 性能注意

- Delaunay 算法复杂度 O(n log n)，但常数因子较大；约束版本更重
- 量级参考（单线程，参考值）：
  - 1 万点：构建 < 1 秒
  - 10 万点：5~15 秒，需考虑分块
  - 100 万点：内存与时间显著，建议分块或换库
- 大数据集可先用 `STRtree` 分块，对每块单独剖分，再缝合边界（注意缝合规整）
- `ConformingDelaunayTriangulationBuilder` 因约束强制会插入大量点，约束线段越长越密，性能下降明显——能简化先简化
- `GetSubdivision()` 复用同一细分结构，多次取三角形/边/Voronoi 不要重复 `new` Builder
- `VoronoiDiagramBuilder` 与 `DelaunayTriangulationBuilder.GetSubdivision().GetVoronoiDiagram()` 等价但更直接，只取 Voronoi 时用前者

::: warning 别在高频循环里 new Builder
`DelaunayTriangulationBuilder` 构造与 `SetSites` 触发的排序、frame 构建成本不低。批量查询应一次性建网、复用 `QuadEdgeSubdivision`，只在循环里调 `Locate`。
:::

## 小结速查表

| 类 / 方法 | 用途 | 返回 |
| --- | --- | --- |
| `DelaunayTriangulationBuilder.SetSites` | 设置点集 | — |
| `DelaunayTriangulationBuilder.GetTriangles` | 取三角形 | `GeometryCollection` of `Polygon` |
| `DelaunayTriangulationBuilder.GetEdges` | 取三角网格边 | `MultiLineString` |
| `DelaunayTriangulationBuilder.GetSubdivision` | 取底层细分 | `QuadEdgeSubdivision` |
| `VoronoiDiagramBuilder.SetSites` | 设置种子 | — |
| `VoronoiDiagramBuilder.ClipEnvelope` | 裁剪矩形（取较大者） | — |
| `VoronoiDiagramBuilder.GetDiagram` | 取 Voronoi 图 | `GeometryCollection` of `Polygon`（`UserData` = 种子） |
| `ConformingDelaunayTriangulationBuilder.Constraints` | 设置约束线段 | — |
| `ConformingDelaunayTriangulationBuilder.GetTriangles` | 约束 Delaunay 三角形 | `GeometryCollection` of `Polygon` |
| `ConstrainedDelaunayTriangulator.Triangulate` | 多边形内部三角化（静态） | `GeometryCollection` of `Polygon` |
| `ConstrainedDelaunayTriangulator.GetResult` | 同上（实例） | `Geometry` |
| `ConstrainedDelaunayTriangulator.GetTriangles` | 轻量三角形列表 | `IList<Tri>` |
| `QuadEdgeSubdivision.GetVertices` | 遍历顶点 | `IEnumerable<Vertex>` |
| `QuadEdgeSubdivision.GetPrimaryEdges` | 遍历边 | `IList<QuadEdge>` |
| `QuadEdgeSubdivision.VisitTriangles` | 访问者遍历三角形 | — |
| `QuadEdgeSubdivision.Locate` | 定位点所在三角形 | `QuadEdge` |
| `QuadEdgeSubdivision.GetVoronoiDiagram` | 取 Voronoi 图 | `GeometryCollection` |
| `QuadEdgeSubdivision.GetVoronoiCellPolygon` | 取单个 Voronoi 单元 | `Polygon` |

## 下一步

- [空间索引 STRtree](./spatial-index.md)：定位查询的索引基础
- [自定义操作与扩展](./extending.md)：实现自己的 `ITriangleVisitor`
- [几何属性](../02-geometry-fundamentals/geometry-properties.md)：ConvexHull 等与三角剖分相关的属性
- [API 速查表](../appendix/cheatsheet.md)：所有 NTS 类一览
