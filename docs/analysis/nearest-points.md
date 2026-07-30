# 最近点与投影

`Distance()` 告诉你两个几何有多远，但有时你需要知道 **最近在哪里**——比如"用户最近的道路入口"、"线段上的最近投影点"、"两几何的接触位置"。NTS 提供了一组精准的方法。

## NearestPoints：两几何最近点对

`a.NearestPoints(b)` 返回一对 `Coordinate`——分别来自 a 和 b，是两几何上距离最近的点：

```csharp
using NetTopologySuite.Operation.Distance;

var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0)
});

var point = factory.CreatePoint(new Coordinate(5, 3));

Coordinate[] nearest = DistanceOp.NearestPoints(line, point);
// nearest[0] = (5, 0)  ← 线上最近点
// nearest[1] = (5, 3)  ← 点本身

double distance = nearest[0].Distance(nearest[1]);  // 3
```

::: tip 两种调用方式
- 静态：`DistanceOp.NearestPoints(g1, g2)`
- 实例：`g1.Distance(g2)` 内部就调用了 DistanceOp

如果你既要距离又要最近点，直接用 `DistanceOp` 一次搞定，避免重复计算。
:::

## DistanceOp：完整 API

```csharp
public class DistanceOp
{
    public static double Distance(Geometry g0, Geometry g1);
    public static Coordinate[] NearestPoints(Geometry g0, Geometry g1);
    public static Coordinate[] ClosestPoints(Geometry g0, Geometry g1);

    public DistanceOp(Geometry g0, Geometry g1);
    public DistanceOp(Geometry g0, Geometry g1, double terminateDistance);

    public double Distance();
    public Coordinate[] NearestPoints();
    public Coordinate[] ClosestPoints();
    public bool IsWithinDistance(double dist);
}
```

`terminateDistance` 是性能优化：如果实际距离超过它，可以提前返回（不保证精确最近点）。

```csharp
// 我只关心 100 米内的最近点，更远的不要
var op = new DistanceOp(road, user, terminateDistance: 100);
if (op.IsWithinDistance(100))
{
    var pair = op.NearestPoints();
    // ...
}
```

## 点到线段的最近投影

最常见的场景：把一个 GPS 点"吸附"到最近的道路上。

```csharp
var road = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 5)
});

var gpsPoint = factory.CreatePoint(new Coordinate(3, 2));

var pair = DistanceOp.NearestPoints(road, gpsPoint);
var snapped = factory.CreatePoint(pair[0]);

Console.WriteLine($"吸附后位置: ({snapped.X}, {snapped.Y})");
// (3, 0) — 投影到第一段线段上
```

<figure class="nts-diagram">
<svg viewBox="0 0 280 100" width="280" height="100">
  <polyline points="20,80 200,80 200,30" fill="none" stroke="#0b6e4f" stroke-width="2.5"/>
  <circle cx="80" cy="55" r="4" fill="#a00"/>
  <circle cx="80" cy="80" r="4" fill="#0b6e4f"/>
  <line x1="80" y1="55" x2="80" y2="80" stroke="#888" stroke-dasharray="3 3"/>
  <text x="90" y="50" font-family="monospace" font-size="11" fill="#a00">GPS 点</text>
  <text x="90" y="78" font-family="monospace" font-size="11" fill="#0b6e4f">吸附点</text>
</svg>
<figcaption>把 GPS 点投影到道路</figcaption>
</figure>

## 沿线的线性参考 (Linear Referencing)

NTS 提供 `LinearReferencing` 命名空间，支持沿线的"里程"操作：

```csharp
using NetTopologySuite.LinearReferencing;

var route = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10)
});

// 取线上 5 单位里程处的点
var extractor = new LengthLocationMap(route);
var loc = extractor.GetLocation(5.0);
var ptAt5 = LengthLocationMap.GetPoint(route, loc);
// (5, 0)

// 取线全长
double totalLength = route.Length;  // 20

// 反向：从点找里程
var location = LengthLocationMap.GetLength(route, ptAt5);
```

应用：地铁线路"在 3.5 公里处设站"、高速公路桩号定位。

## ExtractLine：截取子线

`LengthIndexedLine` 还能截取一段：

```csharp
var indexed = new LengthIndexedLine(route);

// 从里程 5 截到 15
var subLine = indexed.ExtractLine(5, 15);
// LINESTRING (5 0, 10 0, 10 5)
```

## ClosestPoints：所有候选最近点

`NearestPoints` 只返回一对。如果两几何在某段上"平行贴合"，可能有无数最近点对。`ClosestPoints` 返回所有"局部最近"的点对：

```csharp
// 一条线与一条平行线
var a = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0)
});
var b = factory.CreateLineString(new[]
{
    new Coordinate(0, 1), new Coordinate(10, 1)
});

var pairs = DistanceOp.ClosestPoints(a, b);
// 返回多对点（端点 + 内部代表性点）
```

## IndexedPointInAreaLocator：批量点测试

如果你要测试大量点是否在同一个多边形内（不是"最近点"），用 `IndexedPointInAreaLocator` 比 `Covers` 还快：

```csharp
using NetTopologySuite.Algorithm.Locate;

var poly = LoadBigPolygon();
var locator = new IndexedPointInAreaLocator(poly);

foreach (var p in oneMillionPoints)
{
    var status = locator.Locate(p.Coordinate);
    bool inside = status == Location.Interior;
    bool onEdge = status == Location.Boundary;
}
```

`IndexedPointInAreaLocator` 内部构建面积树，单次定位接近 O(log n)。

## 实战：道路匹配（Map Matching 简化版）

```csharp
public static Geometry SnapToRoad(Geometry road, Point gps, double maxSnapDistance)
{
    var op = new DistanceOp(road, gps, terminateDistance: maxSnapDistance);
    if (!op.IsWithinDistance(maxSnapDistance))
        return gps;  // 太远，不吸附

    var pair = op.NearestPoints();
    return factory.CreatePoint(pair[0]);
}

// 用法
var snapped = SnapToRoad(roadNetwork, rawGps, maxSnapDistance: 50);
```

## 实战：找最近设施

```csharp
// 1000 个候选设施，找离用户最近的 5 个
var candidates = LoadFacilities();  // List<Point>
var user = new Coordinate(...);

// 简单做法：遍历 + 排序
var nearest5 = candidates
    .OrderBy(c => c.Coordinate.Distance(user))
    .Take(5)
    .ToList();

// 大数据集做法：用 STRtree 先粗过滤
var tree = new STRtree<Geometry>();
foreach (var c in candidates)
    tree.Insert(c.EnvelopeInternal, c);
tree.Build();

// 找 envelope 距离 < 阈值的候选，再精确算
```

详见 [空间索引 STRtree](../advanced/spatial-index.md)。

## 小结

| 方法 | 用途 |
| --- | --- |
| `DistanceOp.NearestPoints` | 两几何最近点对 |
| `DistanceOp.ClosestPoints` | 所有局部最近点 |
| `IndexedPointInAreaLocator` | 批量"点在面内"判断 |
| `LengthIndexedLine` | 沿线里程操作 |
| `LengthIndexedLine.ExtractLine` | 按里程截子线 |
| `LengthLocationMap` | 里程↔位置互转 |

## 下一步

- [空间索引 STRtree](../advanced/spatial-index.md)：批量最近邻查询
- [PreparedGeometry](../advanced/prepared-geometry.md)
- [三角剖分](../advanced/triangulation.md)
