# 叠加分析 (Overlay)

叠加分析是 GIS 的"代数运算"——把两个几何通过布尔运算组合成新的几何。NTS 提供四大叠加算子，全部基于 JTS 的稳健算法。

## 四大算子

<figure class="nts-diagram">
<svg viewBox="0 0 360 160" width="360" height="160">
  <g font-family="monospace" font-size="11">
    <!-- 输入 -->
    <circle cx="40" cy="40" r="22" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f"/>
    <circle cx="60" cy="40" r="22" fill="rgba(200,40,40,0.20)" stroke="#a00"/>
    <text x="50" y="80" text-anchor="middle" fill="#444">A ∪ B (Union)</text>

    <circle cx="140" cy="40" r="22" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f"/>
    <circle cx="160" cy="40" r="22" fill="rgba(200,40,40,0.20)" stroke="#a00"/>
    <path d="M 145 22 A 22 22 0 0 1 155 22 A 22 22 0 0 1 155 58 A 22 22 0 0 1 145 58 A 22 22 0 0 1 145 22 Z" fill="rgba(180,180,40,0.6)" stroke="#660"/>
    <text x="150" y="80" text-anchor="middle" fill="#444">A ∩ B (Intersection)</text>

    <circle cx="240" cy="40" r="22" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f"/>
    <circle cx="260" cy="40" r="22" fill="none" stroke="#a00" stroke-dasharray="3 3"/>
    <text x="250" y="80" text-anchor="middle" fill="#444">A − B (Difference)</text>

    <circle cx="340" cy="40" r="22" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f"/>
    <circle cx="360" cy="40" r="22" fill="rgba(200,40,40,0.20)" stroke="#a00"/>
    <text x="350" y="80" text-anchor="middle" fill="#444">A ⊕ B (SymDiff)</text>
  </g>
</svg>
<figcaption>四大叠加算子的几何含义</figcaption>
</figure>

| 算子 | 方法 | 含义 |
| --- | --- | --- |
| 并集 | `a.Union(b)` | 包含 a 和 b 中所有点的几何 |
| 交集 | `a.Intersection(b)` | 同时在 a 和 b 中的点 |
| 差集 | `a.Difference(b)` | 在 a 中但不在 b 中的点 |
| 对称差 | `a.SymDifference(b)` | 在 a 或 b 中但不同时在两者中的点 |

## 基础示例

```csharp
using NetTopologySuite.Geometries;

var factory = new GeometryFactory();

var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(4, 4),
    new Coordinate(0, 4), new Coordinate(0, 0)
});

var b = factory.CreatePolygon(new[]
{
    new Coordinate(2, 0), new Coordinate(6, 0), new Coordinate(6, 4),
    new Coordinate(2, 4), new Coordinate(2, 0)
});

Console.WriteLine($"Union area: {a.Union(b).Area}");                       // 24
Console.WriteLine($"Intersection area: {a.Intersection(b).Area}");         // 8
Console.WriteLine($"Difference area: {a.Difference(b).Area}");              // 8
Console.WriteLine($"SymDifference area: {a.SymDifference(b).Area}");        // 16
```

## 维度规则

叠加算子对输入维度有要求，但 NTS 处理得相当灵活：

| 输入 A | 输入 B | Union 结果 | Intersection 结果 |
| --- | --- | --- | --- |
| Polygon | Polygon | Polygon / MultiPolygon | Polygon |
| LineString | LineString | MultiLineString | Point（交点）或 LineString（重合段） |
| LineString | Polygon | GeometryCollection | LineString（被裁剪） |
| Point | Polygon | GeometryCollection | Point（在内/边上时） |

::: tip 维度下降
Intersection 的结果维度 **可能低于** 输入。比如两条相交的 LineString，Intersection 通常返回 Point（交点）。这是 OGC 标准行为，不是 bug。
:::

## UnaryUnion：批量并集

当你需要合并一组几何，不要循环调用 `Union`——会非常慢。用 `UnaryUnionOperation`：

```csharp
using NetTopologySuite.Operation.Union;

var polygons = new List<Geometry>
{
    factory.CreatePolygon(...),
    factory.CreatePolygon(...),
    // ... 1000 个相邻的行政多边形
};

var op = new UnaryUnionOperation(polygons);
Geometry merged = op.Union();
```

`UnaryUnionOperation` 内部使用级联合并策略，时间复杂度接近 O(n log n)，远优于循环 Union 的 O(n²)。

## 跨类型叠加：线裁剪

最常见的实际需求之一：用多边形裁剪线。

```csharp
// 一条横跨边界的路线
var route = factory.CreateLineString(new[]
{
    new Coordinate(-1, 1),
    new Coordinate(2, 1),
    new Coordinate(5, 1),
    new Coordinate(8, 1)
});

// 边界：[0, 4] × [0, 4]
var boundary = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(4, 4),
    new Coordinate(0, 4), new Coordinate(0, 0)
});

var clipped = route.Intersection(boundary);
Console.WriteLine(clipped.AsText());
// LINESTRING (2 1, 4 1)  ← 只剩边界内的部分
```

## UnionAll 与空集

NTS 2.x 在 `Geometry` 上没有直接的 `UnionAll` 静态方法，但可以这样写：

```csharp
Geometry UnionAll(IEnumerable<Geometry> geoms)
{
    var list = geoms.ToList();
    if (list.Count == 0) return factory.CreateGeometryCollection();
    return new UnaryUnionOperation(list).Union();
}
```

## 处理无效几何

如果输入几何无效（自相交、孔洞超出外壳等），叠加运算结果可能错误。先校验并修复：

```csharp
if (!a.IsValid)
{
    // 缓冲 0 是经典的"修复"技巧，NTS 还提供更强的 buffer(0)
    a = a.Buffer(0);
}

var result = a.Union(b);
```

更强大的修复工具是 `GeometryFixer`（NTS 2.3+）：

```csharp
using NetTopologySuite.Geometries.Utilities;

var fixedA = GeometryFixer.Fix(a);
// GeometryFixer 能修复：自相交、孔洞超出外壳、退化环等
```

## 性能优化：OverlayOp 与函数裁剪

对于一次性运算，直接用方法即可。对于大批量裁剪（如对 10 万条线裁剪同一多边形），可以缓存：

```csharp
// 同一个多边形反复裁剪不同线
var clipper = boundary;  // 直接复用几何引用

foreach (var line in allLines)
{
    var result = line.Intersection(clipper);
    // ...
}
```

如果裁剪边界固定且线很多，可以考虑把所有线合并成一个 MultiLineString 后一次性裁剪：

```csharp
var allInOne = factory.CreateMultiLineString(allLines.ToArray());
var clipped = allInOne.Intersection(boundary);
```

## 叠加运算的边界情况

### 1. 边界重叠

两个相邻多边形共享一条边时，Union 应当合并它们且不出现"内部线"。NTS 通常能正确处理，但如果几何有微小偏差，可能出现细缝。解决办法：先用 `Buffer(0)` 或 `GeometryFixer` 修复。

### 2. 空几何参与运算

```csharp
var empty = factory.CreatePolygon();
var result = a.Union(empty);  // 等于 a 本身
var result2 = a.Intersection(empty);  // 空几何
```

### 3. 不同维度几何

```csharp
var point = factory.CreatePoint(new Coordinate(2, 2));
var poly  = factory.CreatePolygon(...);

var u = point.Union(poly);   // GeometryCollection(Point, Polygon)
var i = point.Intersection(poly);  // Point（如果点在多边形内）
```

## 一个真实案例：合并配送范围

假设你有 100 个骑手，每个骑手有一个圆形配送范围（半径 3km）。要把所有范围合并成"店铺整体可达区域"：

```csharp
var factory = new GeometryFactory();
var riderCenters = new List<Coordinate>
{
    new(0, 0), new(2, 0), new(4, 0), new(1, 2), new(3, 2)
};

var circles = riderCenters
    .Select(c => factory.CreatePoint(c).Buffer(3.0))
    .Cast<Geometry>()
    .ToList();

var merged = new UnaryUnionOperation(circles).Union();
Console.WriteLine($"整体可达面积 = {merged.Area:F2}");
```

## 小结

- 四大算子：Union / Intersection / Difference / SymDifference
- 批量合并用 `UnaryUnionOperation`，避免循环 Union
- 输入先校验有效性，必要时用 `GeometryFixer` 修复
- 不同维度叠加会产生混合类型 GeometryCollection
- 实战场景：行政边界合并、配送范围、线段裁剪

## 下一步

- [缓冲区 Buffer](./buffer.md)：圆形/方形/单边缓冲
- [凸包与简化](./convex-simplify.md)：Douglas-Peucker 与拓扑安全简化
- [空间谓词](../predicates/relationships.md)
