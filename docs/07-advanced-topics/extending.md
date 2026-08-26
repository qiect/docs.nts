# 自定义操作与扩展

NTS 不只是"调库"——它暴露了完整的算法接口，让你能写自定义的几何处理逻辑。本节介绍几种常见扩展场景。

## 自定义 GeometryFilter：遍历几何

`IGeometryFilter` 让你对一个几何树做遍历，每个子几何调用一次：

```csharp
using NetTopologySuite.Geometries.Utilities;

public class Counter : IGeometryFilter
{
    public int Points = 0, Lines = 0, Polys = 0;

    public void Filter(Geometry g)
    {
        switch (g)
        {
            case Point:       Points++; break;
            case LineString:  Lines++; break;
            case Polygon:     Polys++; break;
        }
    }
}

var counter = new Counter();
multiGeometry.Apply(counter);   // 遍历所有子几何
Console.WriteLine($"点 {counter.Points}, 线 {counter.Lines}, 面 {counter.Polys}");
```

## 自定义 GeometryTransformer：几何变换

`GeometryTransformer` 是几何变换的基类，子类实现 `TransformCoordinates` 即可对每个 Coordinate 做处理。

```csharp
using NetTopologySuite.Geometries.Utilities;

public class RoundCoordinates : GeometryTransformer
{
    private readonly double _precision;

    public RoundCoordinates(double precision) => _precision = precision;

    protected override CoordinateSequence TransformCoordinates(
        CoordinateSequence coords, Geometry parent)
    {
        var seq = coords.Copy();
        for (int i = 0; i < seq.Count; i++)
        {
            seq.SetX(i, Math.Round(seq.GetX(i) / _precision) * _precision);
            seq.SetY(i, Math.Round(seq.GetY(i) / _precision) * _precision);
        }
        return seq;
    }
}

var rounded = new RoundCoordinates(0.01).Transform(messyGeometry);
```

NTS 内置的变换器：

| 变换器 | 功能 |
| --- | --- |
| `AffineTransformation` | 仿射变换（旋转/平移/缩放/剪切） |
| `GeometryCombiner` | 几何组合 |
| `GeometryExtracter` | 提取特定类型子几何 |
| `LinearComponentExtracter` | 提取所有线组件 |
| `PointExtracter` | 提取所有点 |
| `PolygonExtracter` | 提取所有多边形 |

## 仿射变换

```csharp
using NetTopologySuite.Geometries.Utilities;

// 平移
var translate = new AffineTransformation().
    Translate(10, 5);   // X+10, Y+5

// 旋转（弧度）
var rotate = new AffineTransformation().
    Rotate(Math.PI / 4);  // 45 度

// 缩放
var scale = new AffineTransformation().
    Scale(2.0, 2.0);

// 组合
var composite = new AffineTransformation().
    Translate(10, 0).
    Rotate(Math.PI / 6).
    Scale(1.5, 1.0);

var transformed = composite.Transform(geometry);
```

## 自定义 Noder：线段求交

线段求交是叠加运算的核心。`Noder` 接口让你插入自定义的求交算法：

```csharp
using NetTopologySuite.Noding;

public class SimpleNoder : INoder
{
    public void ComputeNodes(IList<ISegmentString> segStrings)
    {
        // 对每对线段求交，把交点加入 segStrings
        // ... 自定义实现
    }

    public IList<ISegmentString> NodedSubstrings => /* ... */;
}
```

普通应用很少需要写 Noder——NTS 内置的 `MCIndexNoder`、`SnapRoundingNoder` 已经很强大。这是给算法研究者留的接口。

## 自定义谓词：用 IIntersectingMatrixFilter

如果你想自定义判断而不想写完整 DE-9IM 模式，可以实现 `RelateOp` 的扩展。更常见的做法是组合现有方法：

```csharp
public static class GeometryPredicates
{
    // 判断两个多边形是否"重叠率超过 50%"
    public static bool OverlapExceeds(Geometry a, Geometry b, double ratio)
    {
        var inter = a.Intersection(b);
        return inter.Area / Math.Min(a.Area, b.Area) > ratio;
    }

    // 判断线是否完全在多边形内部（含端点）
    public static bool EntirelyInside(Geometry line, Geometry poly)
    {
        return poly.Covers(line);
    }
}
```

## GeometryCombiner：批量组合

```csharp
using NetTopologySuite.Geometries.Utilities;

var geometries = new[] { point1, line2, poly3 };
var combined = GeometryCombiner.Combine(geometries);
// 自动判断：单一类型 → Multi*，混合 → GeometryCollection

// 直接 combine 成指定类型
var asCollection = GeometryCombiner.CreateGeometryCollection(geometries);
```

## 提取特定类型子几何

```csharp
using NetTopologySuite.Geometries.Utilities;

var geometries = new List<Geometry>();

// 提取所有 Point
PointExtracter.Extract(multiGeometry, geometries);
var points = geometries.OfType<Point>().ToList();

// 提取所有 LineString
var lines = new List<Geometry>();
LinearComponentExtracter.Extract(multiGeometry, lines);

// 提取所有 Polygon
var polys = new List<Geometry>();
PolygonExtracter.Extract(multiGeometry, polys);
```

## 自定义 GeometryEditor：编辑几何

`GeometryEditor` 与 `GeometryTransformer` 类似，但允许在编辑过程中改变几何类型：

```csharp
using NetTopologySuite.Geometries.Utilities;

public class PolygonToLineEditor : GeometryEditor
{
    protected override Geometry EditPolygon(Polygon polygon)
    {
        // 把所有多边形转成外壳线
        return polygon.Shell.Copy();
    }
}

var lines = new PolygonToLineEditor().Edit(multiPolygon, factory);
```

## 线性参考扩展

NTS 的 `LinearReferencing` 命名空间支持沿线操作。你可以基于它做更复杂的应用：

```csharp
using NetTopologySuite.LinearReferencing;

public class RouteService
{
    private readonly Geometry _route;

    public RouteService(Geometry route) => _route = route;

    // 取里程 [start, end] 之间的子线段
    public LineString Slice(double start, double end)
    {
        var indexed = new LengthIndexedLine(_route);
        return (LineString)indexed.ExtractLine(start, end);
    }

    // 在某里程处插入桩号
    public Point At(double mileage)
    {
        var indexed = new LengthIndexedLine(_route);
        return factory.CreatePoint(indexed.ExtractPoint(mileage));
    }

    // 反查：从位置反推里程
    public double MileageAt(Coordinate c)
    {
        var indexed = new LengthIndexedLine(_route);
        return indexed.IndexOf(new Coordinate(c));
    }
}
```

## 注册自定义几何类型

NTS 支持子类化 `Geometry` 实现自定义类型。这是高级用法，通常配合数据库自定义类型使用：

```csharp
public class MyCircle : Geometry
{
    public Coordinate Center { get; }
    public double Radius { get; }

    public MyCircle(Coordinate center, double radius, GeometryFactory factory)
        : base(factory)
    {
        Center = center;
        Radius = radius;
    }

    // 必须实现抽象方法：Area, Length, Reverse, etc.
    // 也需要注册自定义的 Reader/Writer
}
```

::: warning 自定义类型的代价
自定义几何类型需要实现大量抽象方法和与 NTS 内部算法的兼容性。除非有强需求，**优先用组合而不是继承**——把 `Geometry` 作为字段，包装你的业务逻辑。
:::

## 实战：把任意几何栅格化

```csharp
public static List<Coordinate> Rasterize(Geometry g, double cellSize)
{
    var result = new List<Coordinate>();
    var env = g.EnvelopeInternal;

    for (double x = env.MinX; x <= env.MaxX; x += cellSize)
    {
        for (double y = env.MinY; y <= env.MaxY; y += cellSize)
        {
            var cell = new Coordinate(x, y);
            if (g.Covers(factory.CreatePoint(cell)))
                result.Add(cell);
        }
    }
    return result;
}
```

::: tip 性能优化
上面这种暴力遍历对大几何很慢。生产代码应该：

1. 用 `IndexedPointInAreaLocator` 加速 Covers
2. 按 Envelope 跳过明显在外的网格
3. 用 `PreparedGeometry` 缓存
:::

## 小结

| 扩展点 | 用途 |
| --- | --- |
| `IGeometryFilter` | 遍历几何树 |
| `GeometryTransformer` | 变换坐标 |
| `AffineTransformation` | 仿射变换 |
| `INoder` | 自定义求交算法 |
| `GeometryCombiner` | 批量组合 |
| `GeometryEditor` | 编辑几何 |
| `LinearReferencing` | 沿线操作 |

## 下一步

- [EF Core 集成](../08-ecosystem/ef-core.md)
- [API 速查表](../appendix/cheatsheet.md)
- [常见问题 FAQ](../appendix/faq.md)
