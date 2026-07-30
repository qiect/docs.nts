# API 速查表

按场景分类的 NTS 方法速查。复制即用。

## 创建几何

```csharp
var f = new GeometryFactory();

// 点
var p = f.CreatePoint(new Coordinate(116.40, 39.90));
var p2 = new Point(116.40, 39.90) { SRID = 4326 };

// 线
var line = f.CreateLineString(new[] {
    new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 0) });

// 环（必须闭合）
var ring = f.CreateLinearRing(new[] {
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10), new Coordinate(0, 0) });

// 多边形
var poly = f.CreatePolygon(ring);
var polyWithHole = f.CreatePolygon(shell, new[] { hole1, hole2 });

// 集合
var mp   = f.CreateMultiPoint(new[] { new Point(0, 0), new Point(1, 1) });
var ml   = f.CreateMultiLineString(new[] { line1, line2 });
var mpl  = f.CreateMultiPolygon(new[] { poly1, poly2 });
var coll = f.CreateGeometryCollection(new Geometry[] { p, line, poly });

// 从 Envelope 创建矩形
var rect = f.ToGeometry(new Envelope(0, 10, 0, 10));

// 从坐标序列
var seq = f.CoordinateSequenceFactory.Create(new[] { 0.0, 0.0, 1.0, 1.0 }, 2);
var l2 = f.CreateLineString(seq);
```

## 序列化

```csharp
using NetTopologySuite.IO;

// WKT
var wkt = new WKTWriter { MaxCoordinatesPerLine = int.MaxValue }.Write(g);
var g1  = new WKTReader().Read("POINT (1 2)");

// WKB
var bytes = new WKBWriter().Write(g);
var g2    = new WKBReader().Read(bytes);

// GeoJSON
using NetTopologySuite.IO.GeoJSON;
var json = JsonSerializer.CreateDefault(new JsonSerializerSettings {
    Converters = { new GeometryConverter() }
}).Serialize(g);
```

## 几何属性

```csharp
g.Area;                  // 面积
g.Length;                // 周长 / 线长
g.Dimension;             // 0/1/2
g.GeometryType;          // GeometryType 枚举
g.IsEmpty;
g.IsValid;
g.SRID;
g.EnvelopeInternal;      // 边界框
g.Centroid;              // 质心
g.InteriorPoint;         // 内部代表点
g.NumGeometries;         // 集合中的子几何数
g.NumPoints;             // 顶点数
g.Coordinates;           // 所有顶点
g.GetGeometryN(i);       // 第 i 个子几何
```

## 谓词

```csharp
g1.Intersects(g2);       // 是否相交
g1.Disjoint(g2);         // 是否完全不相交
g1.Contains(g2);         // g1 是否包含 g2（严格内部）
g1.Within(g2);           // g1 是否被 g2 包含
g1.Covers(g2);           // g1 是否覆盖 g2（含边界）
g1.CoveredBy(g2);
g1.Touches(g2);          // 仅边界接触
g1.Crosses(g2);          // 穿越
g1.Overlaps(g2);         // 同维度部分重叠
g1.EqualsTopologically(g2);
g1.EqualsExact(g2);
g1.Relate(g2, "T*F**F***");   // DE-9IM 自定义模式
g1.IsWithinDistance(g2, d);   // 距离 ≤ d（快）
```

## 运算

```csharp
g.Buffer(d);                       // 缓冲
g.Buffer(d, new BufferParameters {
    QuadrantSegments = 16,
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round,
    IsSingleSided = false
});

g1.Union(g2);                      // 并集
g1.Intersection(g2);               // 交集
g1.Difference(g2);                 // 差集
g1.SymDifference(g2);              // 对称差

g.ConvexHull();                    // 凸包
g.Reverse();                       // 反向
g.Normalize();                     // 归一化（方向、顶点顺序）
g.Copy();                          // 深拷贝
g.Buffer(0);                       // 经典修复
```

## 测量

```csharp
g1.Distance(g2);                   // 平面欧氏最短距离
g1.Length;                         // 长度 / 周长
g1.Area;                           // 面积
g1.EnvelopeInternal.Distance(g2.EnvelopeInternal);  // 边界框距离（超快）

// 最近点
var pair = NetTopologySuite.Operation.Distance.DistanceOp.NearestPoints(g1, g2);
// pair[0] 在 g1 上，pair[1] 在 g2 上
```

## 简化

```csharp
using NetTopologySuite.Simplify;

var v1 = DouglasPeuckerSimplifier.Simplify(g, 0.5);          // 不保拓扑，快
var v2 = TopologyPreservingSimplifier.Simplify(g, 0.5);      // 保拓扑，慢
var v3 = VWSimplifier.Simplify(g, 0.001);                    // 视觉自然
```

## 修复

```csharp
using NetTopologySuite.Geometries.Utilities;

if (!g.IsValid) g = GeometryFixer.Fix(g);   // NTS 2.3+
// 老版本：g.Buffer(0)
```

## PreparedGeometry

```csharp
using NetTopologySuite.Geometries.Prepared;

var prep = PreparedGeometryFactory.Prepare(bigPolygon);
foreach (var p in manyPoints)
    if (prep.Covers(p)) { /* ... */ }
```

## 空间索引

```csharp
using NetTopologySuite.Index.Strtree;
using NetTopologySuite.Index.KdTree;
using NetTopologySuite.Index.Quadtree;

// STRtree（通用）
var tree = new STRtree<Point>();
foreach (var p in points) tree.Insert(p.EnvelopeInternal, p);
tree.Build();
var candidates = tree.Query(env).ToList();

// KdTree（点 / 最近邻）
var kd = new KdTree<int>();
foreach (var p in points) kd.Insert(p.Coordinate, p.Value);
var nearest = kd.NearestNeighbor(target);
var kNear   = kd.NearestNeighbors(target, 10);

// Quadtree（动态）
var qt = new Quadtree<Point>();
qt.Insert(p.EnvelopeInternal, p);
qt.Remove(p.EnvelopeInternal, p);   // 支持删除
```

## 三角剖分

```csharp
using NetTopologySuite.Triangulate;

var builder = new DelaunayTriangulationBuilder();
builder.SetSites(points);
var triangles = builder.GetTriangles(factory);
var voronoi   = builder.GetSubdivision().GetVoronoiDiagram(factory);

// 带约束
var constrained = new ConformingDelaunayTriangulationBuilder();
constrained.SetSites(points);
constrained.SetConstraints(lineConstraints);
var tris = constrained.GetTriangles(factory);
```

## 线性参考

```csharp
using NetTopologySuite.LinearReferencing;

var indexed = new LengthIndexedLine(lineString);
var at5     = indexed.ExtractPoint(5.0);          // 里程 5 处的点
var sub     = indexed.ExtractLine(2.0, 8.0);      // 里程 [2, 8] 子线段
var mile    = indexed.IndexOf(point.Coordinate);  // 反查里程
```

## 沿线投影

```csharp
using NetTopologySuite.Operation.Distance;

var pair = DistanceOp.NearestPoints(line, point);
var snapPoint = pair[0];   // 线上最近点
```

## 仿射变换

```csharp
using NetTopologySuite.Geometries.Utilities;

var transform = new AffineTransformation()
    .Translate(10, 5)
    .Rotate(Math.PI / 4)
    .Scale(2.0, 2.0);

var transformed = transform.Transform(geometry);
```

## 几何提取与遍历

```csharp
using NetTopologySuite.Geometries.Utilities;

// 提取所有 Point
var points = new List<Geometry>();
PointExtracter.Extract(multiGeometry, points);

// 提取所有 LineString
var lines = new List<Geometry>();
LinearComponentExtracter.Extract(multiGeometry, lines);

// 提取所有 Polygon
var polys = new List<Geometry>();
PolygonExtracter.Extract(multiGeometry, polys);

// 自定义遍历
public class MyFilter : IGeometryFilter {
    public void Filter(Geometry g) { /* ... */ }
}
multiGeometry.Apply(new MyFilter());
```

## 批量 Union

```csharp
using NetTopologySuite.Operation.Union;

var merged = new UnaryUnionOperation(listOfGeometries).Union();
```

## 加密

```csharp
using NetTopologySuite.Densify;

var dense = Densifier.Densify(line, 2.0);   // 每 2 单位插入一个点
```

## 快速复制粘贴代码模板

### 模板 1：判断 POI 是否在多边形内（高性能）

```csharp
public static List<Point> FindInside(Polygon area, IEnumerable<Point> pois)
{
    var prepared = PreparedGeometryFactory.Prepare(area);
    return pois.Where(p => prepared.Covers(p)).ToList();
}
```

### 模板 2：批量最近邻

```csharp
public static List<Point> KNearest(List<Point> all, Coordinate q, int k)
{
    var kd = new KdTree<Point>();
    foreach (var p in all) kd.Insert(p.Coordinate, p);
    return kd.NearestNeighbors(q, k).Select(r => r.Data).ToList();
}
```

### 模板 3：把线裁剪到多边形内

```csharp
public static Geometry Clip(Geometry line, Polygon boundary)
{
    return line.Intersection(boundary);
}
```

### 模板 4：合并多个多边形

```csharp
public static Geometry Merge(IEnumerable<Polygon> polys)
{
    return new UnaryUnionOperation(polys.Cast<Geometry>().ToList()).Union();
}
```

## 下一步

- [常见问题 FAQ](./faq.md)
- [官方资料与链接](./resources.md)
- 回到 [首页](../index.md)
