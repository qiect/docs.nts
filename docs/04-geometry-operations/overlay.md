# 叠加分析 (Overlay)

叠加分析是 GIS 的"布尔代数"——把两个几何通过交、并、差、对称差组合成新的几何。NTS 的四大算子全部基于 JTS 的稳健叠加引擎（OverlayNG），结果保证拓扑有效。本页逐方法详解每个算子与底层操作类。

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Union;
using NetTopologySuite.Operation.Overlay;
using NetTopologySuite.Operation.Overlay.Snap;
using NetTopologySuite.Geometries.Utilities;

// 本页示例共用工厂
var factory = new GeometryFactory();

// 贯穿全页的示例几何：A、B 两个部分重叠的正方形
var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(4, 0), new Coordinate(4, 4),
    new Coordinate(0, 4), new Coordinate(0, 0)
});   // 面积 16

var b = factory.CreatePolygon(new[]
{
    new Coordinate(2, 0), new Coordinate(6, 0), new Coordinate(6, 4),
    new Coordinate(2, 4), new Coordinate(2, 0)
});   // 面积 16，与 A 重叠区 [2,0]×[4,4] = 面积 8
```

## 四大算子总览

<figure class="nts-diagram">
<svg viewBox="0 0 360 100" width="360" height="100">
  <g font-family="monospace" font-size="10">
    <!-- Union -->
    <circle cx="37" cy="40" r="20" fill="rgba(11,110,79,0.30)" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="53" cy="40" r="20" fill="rgba(11,110,79,0.30)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="45" y="82" text-anchor="middle" fill="#444">A ∪ B</text>

    <!-- Intersection -->
    <circle cx="127" cy="40" r="20" fill="none" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="143" cy="40" r="20" fill="none" stroke="#a00" stroke-width="1.5" stroke-dasharray="3 2"/>
    <path d="M 135,22 A 20,20 0 0,1 135,58 A 20,20 0 0,1 135,22 Z" fill="rgba(11,110,79,0.55)" stroke="#0b6e4f" stroke-width="1.2"/>
    <text x="135" y="82" text-anchor="middle" fill="#444">A ∩ B</text>

    <!-- Difference A−B -->
    <circle cx="217" cy="40" r="20" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="233" cy="40" r="20" fill="none" stroke="#a00" stroke-width="1.5" stroke-dasharray="3 2"/>
    <text x="225" y="82" text-anchor="middle" fill="#444">A − B</text>

    <!-- SymDifference -->
    <circle cx="307" cy="40" r="20" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="323" cy="40" r="20" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="1.5"/>
    <path d="M 315,22 A 20,20 0 0,1 315,58 A 20,20 0 0,1 315,22 Z" fill="#fff" stroke="none"/>
    <text x="315" y="82" text-anchor="middle" fill="#444">A ⊕ B</text>
  </g>
</svg>
<figcaption>四大叠加算子的几何含义（绿色为 A，红色虚线为 B）</figcaption>
</figure>

| 算子 | 方法 | 含义 | 是否可交换 |
| --- | --- | --- | --- |
| 交集 | `a.Intersection(b)` | 同时在 a 和 b 中的点 | 是 |
| 并集 | `a.Union(b)` | 在 a 或 b 中的所有点 | 是 |
| 差集 | `a.Difference(b)` | 在 a 中但不在 b 中的点 | 否（A−B ≠ B−A） |
| 对称差 | `a.SymDifference(b)` | 恰属于 a 或 b 之一的点 | 是 |

不知道该用哪种方式？看这张决策图：

```mermaid
flowchart TD
    Start([需要叠加运算]) --> Q1{批量合并多个几何?}
    Q1 -->|是| UU[UnaryUnionOp.Union<br/>O(n log n) 级联]
    Q1 -->|否| Q2{两个几何两两运算?}
    Q2 -->|是| Q3{出现细缝/TopologyException?}
    Q3 -->|否| Direct["a.Intersection(b) 等直接方法<br/>底层走 OverlayNGRobust"]
    Q3 -->|是| Snap[SnapOverlayOp<br/>显式 snap 处理微缝]
    Q2 -->|否| Q4{组合异构几何为集合?}
    Q4 -->|是| Comb[GeometryCombiner.Combine]
    Q4 -->|否| Q5{输入是否无效?}
    Q5 -->|是| Fix[先 GeometryFixer 修复]
    Q5 -->|否| Direct
    Fix --> Direct
```

## Intersection

**签名**：`public Geometry Intersection(Geometry other)`

**语义**：返回同时在两个几何中的点集（交集 A ∩ B）。结果维度可能**低于**输入维度（见[维度规则](#维度规则完整表)）。

```csharp
var inter = a.Intersection(b);
Console.WriteLine(inter.AsText());   // POLYGON ((2 0, 4 0, 4 4, 2 4, 2 0))
Console.WriteLine(inter.Area);       // 8  ← 重叠区 [2,0]×[4,4]

// 面积守恒验证：a + b − union = intersection
Console.WriteLine(a.Area + b.Area - a.Union(b).Area == inter.Area);  // True
```

<figure class="nts-diagram">
<svg viewBox="0 0 200 130" width="200" height="130">
  <rect x="30" y="20" width="80" height="80" fill="none" stroke="#0b6e4f" stroke-width="1.5"/>
  <rect x="70" y="20" width="80" height="80" fill="none" stroke="#a00" stroke-width="1.5" stroke-dasharray="4 3"/>
  <rect x="70" y="20" width="40" height="80" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="40" y="15" font-family="monospace" font-size="10" fill="#0b6e4f">A</text>
  <text x="135" y="15" font-family="monospace" font-size="10" fill="#a00">B</text>
  <text x="90" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">A ∩ B（面积 8）</text>
</svg>
<figcaption>Intersection：取两几何的公共部分</figcaption>
</figure>

::: warning 维度会下降
两条相交的 `LineString`，`Intersection` 通常返回 `Point`（交点），而非线。这是 OGC 标准行为，不是 bug——交集取的是"同时属于两者的点"，线与线只在交点处共属。若要的是"重合的线段"，结果会是 `LineString`。
:::

::: tip TopologyException 先查有效性
对无效几何（自相交多边形等）调用 `Intersection` 可能抛 `TopologyException`。先 `IsValid` 校验，无效时用 `GeometryFixer.Fix` 修复（见[无效几何处理](#无效几何处理)）。
:::

## Union

**签名**：`public Geometry Union(Geometry other)`

**语义**：返回并集 A ∪ B——在 a 或 b 中的所有点。

```csharp
var union = a.Union(b);
Console.WriteLine(union.AsText());   // POLYGON ((0 0, 6 0, 6 4, 0 4, 0 0))
Console.WriteLine(union.Area);       // 24  ← [0,0]×[6,4]

// 面积守恒验证：union = a + b − intersection
Console.WriteLine(union.Area == a.Area + b.Area - a.Intersection(b).Area);  // True
```

<figure class="nts-diagram">
<svg viewBox="0 0 200 130" width="200" height="130">
  <rect x="30" y="20" width="120" height="80" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="30" y="20" width="80" height="80" fill="none" stroke="#0b6e4f" stroke-width="1" opacity="0.45"/>
  <rect x="70" y="20" width="80" height="80" fill="none" stroke="#a00" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
  <text x="40" y="15" font-family="monospace" font-size="10" fill="#0b6e4f">A</text>
  <text x="135" y="15" font-family="monospace" font-size="10" fill="#a00">B</text>
  <text x="90" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">A ∪ B（面积 24）</text>
</svg>
<figcaption>Union：合并两几何，内部边界被消除</figcaption>
</figure>

::: warning 两个 Union 重载别混淆
`Geometry` 有两个 `Union`：
- `Union(Geometry other)`：二元并集，本节介绍的方法。
- `Union()`（无参）：把 `GeometryCollection` 自身的子几何合并，等价于对该集合做一次 unary union。语义完全不同，注意调用形态。
:::

::: tip 不要循环 Union
合并 N 个几何时，`list.Aggregate((x, y) => x.Union(y))` 是 O(n²)。改用 [`UnaryUnionOp`](#unaryunionop-类)，内部级联合并，接近 O(n log n)。
:::

## Difference

**签名**：`public Geometry Difference(Geometry other)`

**语义**：返回差集 A − B——在 a 中但不在 b 中的点。**不可交换**：A − B 与 B − A 通常不同。

```csharp
var diff = a.Difference(b);
Console.WriteLine(diff.AsText());   // POLYGON ((0 0, 2 0, 2 4, 0 4, 0 0))
Console.WriteLine(diff.Area);       // 8  ← A 的左半 [0,0]×[2,4]

// 验证：A − B = A − (A ∩ B)
Console.WriteLine(diff.Area == a.Area - a.Intersection(b).Area);  // True

// 不可交换性
Console.WriteLine(a.Difference(b).Area);   // 8
Console.WriteLine(b.Difference(a).Area);   // 8（此处对称，但几何不同：左半 vs 右半）
```

<figure class="nts-diagram">
<svg viewBox="0 0 200 130" width="200" height="130">
  <rect x="30" y="20" width="80" height="80" fill="none" stroke="#0b6e4f" stroke-width="1.5"/>
  <rect x="70" y="20" width="80" height="80" fill="none" stroke="#a00" stroke-width="1.5" stroke-dasharray="4 3"/>
  <rect x="30" y="20" width="40" height="80" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="40" y="15" font-family="monospace" font-size="10" fill="#0b6e4f">A</text>
  <text x="135" y="15" font-family="monospace" font-size="10" fill="#a00">B</text>
  <text x="50" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">A − B（面积 8）</text>
</svg>
<figcaption>Difference：从 A 中挖去与 B 重叠的部分</figcaption>
</figure>

::: warning 结果维度跟随左操作数
`Difference(A, B)` 的结果维度通常等于 A 的维度（若无拓扑塌陷）。`Polygon − Polygon` 仍为面；`LineString − Polygon` 为线（落在多边形外的线段）。若 B 把 A 切成多块，结果是 `MultiPolygon`。
:::

## SymDifference

**签名**：`public Geometry SymDifference(Geometry other)`

**语义**：返回对称差 A ⊕ B = (A − B) ∪ (B − A)——恰属于 a 或 b 之一的点。**可交换**：A ⊕ B = B ⊕ A。

```csharp
var sym = a.SymDifference(b);
Console.WriteLine(sym.GeometryType);  // MultiPolygon
Console.WriteLine(sym.Area);          // 16  ← 左半 8 + 右半 8

// 验证：sym = a + b − 2 × intersection
Console.WriteLine(sym.Area == a.Area + b.Area - 2 * a.Intersection(b).Area);  // True

// 与 Union 的关系：sym = union − intersection
Console.WriteLine(sym.Area == a.Union(b).Area - a.Intersection(b).Area);      // True
```

<figure class="nts-diagram">
<svg viewBox="0 0 200 130" width="200" height="130">
  <rect x="30" y="20" width="80" height="80" fill="none" stroke="#0b6e4f" stroke-width="1.5"/>
  <rect x="70" y="20" width="80" height="80" fill="none" stroke="#a00" stroke-width="1.5" stroke-dasharray="4 3"/>
  <rect x="30" y="20" width="40" height="80" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="110" y="20" width="40" height="80" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="40" y="15" font-family="monospace" font-size="10" fill="#0b6e4f">A</text>
  <text x="135" y="15" font-family="monospace" font-size="10" fill="#a00">B</text>
  <text x="90" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">A ⊕ B（面积 16，两块）</text>
</svg>
<figcaption>SymDifference：并集挖去交集，留下"非公共"部分</figcaption>
</figure>

::: tip SymDifference 等价于两次 Difference 的并集
`a.SymDifference(b)` 与 `a.Difference(b).Union(b.Difference(a))` 拓扑等价，但前者一次调用更高效且更稳健。
:::

## 维度规则完整表

叠加算子对输入维度处理灵活，下表列出**全部四算子**的结果类型规律：

| 输入 A | 输入 B | Union | Intersection | Difference (A−B) | SymDifference |
| --- | --- | --- | --- | --- | --- |
| Polygon | Polygon | Polygon / MultiPolygon | Polygon / MultiPolygon | Polygon / MultiPolygon | MultiPolygon |
| LineString | LineString | MultiLineString | Point（交点）/ LineString（重合段） | MultiLineString | MultiLineString |
| LineString | Polygon | GeometryCollection | LineString / MultiLineString（被裁剪） | LineString / MultiLineString | GeometryCollection |
| Point | Polygon | GeometryCollection | Point（在内/边上）/ 空 | Point（在外）/ 空 | GeometryCollection |
| Point | Point | MultiPoint | Point（重合）/ 空 | Point / 空 | MultiPoint |

::: tip 结果维度的两条规律
1. **Intersection 维度可能下降**：取两几何公共部分，结果维度 ≤ min(dim(A), dim(B))。
2. **Difference 维度跟随 A**：A − B 的结果维度通常等于 dim(A)（除非发生精度塌陷）。

混合维度的输入，`Union` 与 `SymDifference` 会返回 `GeometryCollection`；同维度同类型输入通常返回 `Multi*`。
:::

## UnaryUnionOp 类

**命名空间**：`NetTopologySuite.Operation.Union`

**用途**：高效合并一组几何。相比循环调用 `Union`，它采用级联（cascaded）合并策略——先把几何按空间邻近分组、自底向上合并，时间复杂度接近 O(n log n)，远优于循环 Union 的 O(n²)。它还能"清洗"自相交的 `MultiPolygon`（各子多边形仍须各自有效）。

### 构造

```csharp
public UnaryUnionOp(IEnumerable<Geometry> geoms)
public UnaryUnionOp(IEnumerable<Geometry> geoms, GeometryFactory geomFact)
public UnaryUnionOp(Geometry geom)   // 传入 GeometryCollection 也可
```

### Union() — 执行合并

**签名**：`public Geometry Union()`

**语义**：执行级联合并并返回结果。这是触发实际计算的入口（构造时只保存输入）。

```csharp
var polygons = new List<Geometry> { a, b, /* … 1000 个相邻行政多边形 */ };
Geometry merged = new UnaryUnionOp(polygons).Union();
Console.WriteLine(merged.Area);   // 所有多边形面积之和 − 重叠部分
```

### 静态 Union() — 便捷入口

**签名**：

```csharp
public static Geometry Union(IList<Geometry> geoms)
public static Geometry Union(IList<Geometry> geoms, GeometryFactory geomFact)
public static Geometry Union(Geometry geom)
```

**语义**：一行完成"构造 + 合并"，适合无需配置的简单场景。

```csharp
Geometry merged = UnaryUnionOp.Union(polygons);
```

### SetUnionFunction — 注入自定义合并策略

**签名**：`public void SetUnionFunction(UnionStrategy unionStrategy)`

**语义**：替换内部的合并实现。`UnionStrategy` 是一个策略接口，实例默认使用经典 overlay 合并策略。高级用户可注入自定义策略（如走 `OverlayNG` 固定精度、或接入第三方算法）。普通业务无需调用。

```csharp
var op = new UnaryUnionOp(polygons);
// op.SetUnionFunction(myStrategy);   // 一般用默认即可
var merged = op.Union();
```

::: warning 异构集合也支持
`UnaryUnionOp` 完全支持异构 `GeometryCollection`（点、线、面混合）。对面合并取并区域；对线合并做"完全 node 化 + 消解"（重合段合并为一条）；对点合并去重。若要的是"合并连通线"而非消解，用 `LineMerger`。
:::

::: tip 输入无效 MultiPolygon 的清洗
`UnaryUnionOp` 总是在 `Multi*` 的子组件上操作，因此能修复"子多边形之间相互相交"的无效 `MultiPolygon`——前提是每个子多边形自身有效。
:::

## OverlayOp 类

**命名空间**：`NetTopologySuite.Operation.Overlay`

**用途**：经典（legacy）叠加操作类，把两几何的拓扑图建好后计算任一算子的结果。NTS 2.x 中 `Geometry.Intersection/Union/...` 等方法默认走新一代引擎 OverlayNG（更稳健）；`OverlayOp` 保留给需要经典算法、或需要访问中间拓扑图（`Graph` 属性）的场景。

### 构造与 GetResultGeometry

**签名**：

```csharp
public OverlayOp(Geometry g0, Geometry g1)
public Geometry GetResultGeometry(SpatialFunction overlayOpCode)
```

**语义**：构造时为 g0、g1 建立拓扑图；`GetResultGeometry` 按 `SpatialFunction` 枚举（`Intersection` / `Union` / `Difference` / `SymDifference`）返回结果。

```csharp
var op = new OverlayOp(a, b);
var inter = op.GetResultGeometry(SpatialFunction.Intersection);
Console.WriteLine(inter.Area);   // 8

// 静态便捷方法
var uni = OverlayOp.Overlay(a, b, SpatialFunction.Union);
Console.WriteLine(uni.Area);     // 24
```

### Graph 属性 — 暴露中间拓扑

**签名**：`public PlanarGraph Graph { get; }`

**语义**：返回叠加计算构建的拓扑图，供高级调试或自定义标签使用。普通业务很少用到。

::: warning GetResultGeometry 建议只调一次
官方文档提示 `GetResultGeometry` 每次调用都会触发计算，**建议只调用一次**。若需对同一对几何做多个算子，分别构造实例、或直接用便捷静态方法 `OverlayOp.Overlay(g0, g1, opCode)`，不要指望一次构造多次复用结果。
:::

::: tip 性能取舍
新项目优先用 `Geometry` 直接方法（底层 OverlayNGRobust，自带 snap 容错）。需要经典算法或访问 `Graph` 时才用 `OverlayOp`。批量合并不要用 `OverlayOp` 循环，用 [`UnaryUnionOp`](#unaryunionop-类) 或 `CoverageUnion`。
:::

## SnapOverlayOp 类

**命名空间**：`NetTopologySuite.Operation.Overlay.Snap`

**用途**：先对两几何做" snapping（吸附）"——把几乎重合的顶点/边吸附到一起——再做叠加。专治"两几何本应贴合，却因微小偏差留下细缝（sliver）"的问题。

### 构造与 GetResultGeometry

**签名**：

```csharp
public SnapOverlayOp(Geometry g1, Geometry g2)
public Geometry GetResultGeometry(SpatialFunction opCode)
```

**语义**：构造时计算合适的 `snapTolerance` 并对输入做吸附变换；`GetResultGeometry` 返回吸附后的叠加结果。

```csharp
// 两个本应共享边界、却有 1e-9 级偏差的多边形
var snap = new SnapOverlayOp(polyA, polyB);
var cleanUnion = snap.GetResultGeometry(SpatialFunction.Union);
// 合并后不会出现细长缝隙
```

### snapTolerance — 吸附容差

`snapTolerance` 由 `GeometrySnapper` 根据几何尺度自动推算（通常取最小线段长度与精度模型的相关量），一般**无需手动设置**。容差过大会误吸附本应分离的顶点，过小则消除不了细缝——让自动推算处理是稳妥选择。

::: tip 现代 NTS 已内置 snap 容错
NTS 2.x 的 `OverlayNGRobust`（`Geometry` 直接方法的底层）在普通运算失败时会自动尝试多级 snapping。因此日常场景**不必**显式用 `SnapOverlayOp`。仅当遇到顽固的细缝、或需要可预测的吸附行为时，才显式调用它。
:::

::: warning 还有 SnapIfNeededOverlayOp
`SnapIfNeededOverlayOp` 是"按需 snap"包装：先用普通 overlay，失败再回退到 snap。它常被经典引擎内部使用。现代代码用 OverlayNGRobust 即可覆盖同样诉求。
:::

## GeometryCombiner 类

**命名空间**：`NetTopologySuite.Geometries.Utilities`

**用途**：把一组几何组合成一个集合几何，**不做任何空间运算**（不合并、不裁剪），只决定容器类型。适合把异构几何打包传递。

### Combine — 自动选择容器

**签名**：`public static Geometry Combine(IEnumerable<Geometry> geoms)`

**语义**：把多个几何组合为一个。规则：
- 全部同类型（如全是 `Polygon`）→ 返回 `MultiPolygon`
- 类型混合 → 返回 `GeometryCollection`
- 只有一个输入 → 返回它本身
- 空输入 → 空 `GeometryCollection`

```csharp
var combined = GeometryCombiner.Combine(new Geometry[] { point1, line2, poly3 });
Console.WriteLine(combined.GeometryType);   // GeometryCollection

var polys = GeometryCombiner.Combine(new Geometry[] { polyA, polyB });
Console.WriteLine(polys.GeometryType);      // MultiPolygon
```

### CreateGeometryCollection — 强制集合类型

**签名**：`public static Geometry CreateGeometryCollection(IEnumerable<Geometry> geoms)`

**语义**：无论输入类型是否一致，都返回 `GeometryCollection`。

```csharp
// 即使全是多边形，也包成 GeometryCollection
var asColl = GeometryCombiner.CreateGeometryCollection(new Geometry[] { polyA, polyB });
Console.WriteLine(asColl.GeometryType);   // GeometryCollection
```

::: warning Combine 不是 Union
`GeometryCombiner.Combine` 只打包，不消除重叠——两个相交多边形 `Combine` 后仍是 `MultiPolygon`，内部边界和重叠都保留。要真正合并区域用 `Union` / `UnaryUnionOp`。
:::

## UnionAll 自定义实现模式

NTS 没有内建的 `Geometry.UnionAll(...)` 静态方法，但用 `UnaryUnionOp` 包一层即可。要点是正确处理**空集**与**工厂**：

```csharp
// 把任意几何序列合并为一个几何；空序列返回空 GeometryCollection
Geometry UnionAll(IEnumerable<Geometry> geoms, GeometryFactory factory)
{
    var list = geoms.ToList();
    if (list.Count == 0)
        return factory.CreateGeometryCollection();
    return UnaryUnionOp.Union(list);
}

// 用法
var merged = UnionAll(circles, factory);
Console.WriteLine(merged.IsEmpty);   // False
Console.WriteLine(UnionAll(Array.Empty<Geometry>(), factory).IsEmpty);  // True
```

::: tip 空集的语义
空输入应返回**空几何**（而非 `null`）。空几何是合法对象，可继续参与运算（通常传播空集）。这与 [几何属性](../02-geometry-fundamentals/geometry-properties.md#isempty) 中"空几何是合法几何"一致。
:::

## 叠加运算的数值稳健性

叠加是几何运算中数值最敏感的部分——它要把两几何的所有边求交并重新拼装。浮点误差会导致三类问题：

1. **漏交/伪交**：本应相交的边因精度被判定不相交，或反之。
2. **细缝（sliver）**：本应贴合的边界留下极窄缝隙。
3. **TopologyException**：拓扑图构建失败。

NTS 的应对策略：

| 策略 | 说明 |
| --- | --- |
| **OverlayNGRobust**（默认） | `Geometry` 直接方法的底层；失败时自动多级 snap 重试，绝大多数场景无需干预 |
| **SnapRoundingNoder** | 把坐标吸附到固定网格，彻底消除浮点不确定性（固定精度模型场景） |
| **PrecisionModel** | 用 `GeometryFactory(new PrecisionModel(scale))` 限定计算精度；`UnaryUnionNG.Union(geoms, pm)` 走固定精度合并 |
| **GeometryFixer / Buffer(0)** | 修复无效输入，治本于"输入不合法" |

::: warning 经纬度下叠加需先投影
经纬度（WGS84）坐标下做叠加不会报错，但精度模型按"度"运作，细小坐标差会被放大成拓扑问题。建议先投影到米制坐标系（如 CGCS2000 / Web 墨卡托）再叠加。详见 [精度模型](../02-geometry-fundamentals/precision-model.md)。
:::

```csharp
// 用固定精度模型提升稳健性（坐标按 0.01 取整）
var pm = new PrecisionModel(100);          // 1/100 精度
var f = new GeometryFactory(pm, 0);
var safeUnion = new UnaryUnionOp(polys, f).Union();
```

## 跨类型叠加：线裁剪

最常见的跨维度需求：用多边形裁剪线。`Intersection` 天然支持——结果维度跟随两几何的公共部分（线与面的交集是"落在面内的线段"）。

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
// LINESTRING (0 1, 4 1)  ← 只剩落在边界内的部分
Console.WriteLine(clipped.Length);   // 4
```

::: tip 批量裁剪同一多边形
对 10 万条线裁剪同一多边形时，**合并后再裁剪**比逐条裁剪快得多：

```csharp
var allInOne = factory.CreateMultiLineString(allLines.ToArray());
var clipped = allInOne.Intersection(boundary);   // 一次性裁剪
```
:::

## 无效几何处理

无效几何（自相交、孔洞超出外壳、环未闭合等）会让叠加产生错误结果或异常。**运算前先校验并修复**：

### Buffer(0) — 经典修复

```csharp
if (!a.IsValid)
    a = a.Buffer(0);   // 用 0 距离缓冲"规整"几何，能修复多数自相交
```

`Buffer(0)` 历史悠久、兼容性好，但对复杂无效（如孔洞超出外壳）可能丢失部分区域。

### GeometryFixer — 更强的修复（NTS 2.3+）

```csharp
using NetTopologySuite.Geometries.Utilities;

if (!a.IsValid)
    a = GeometryFixer.Fix(a);   // 修复自相交、孔洞越界、退化环等
```

`GeometryFixer` 逐组件修复，保留尽可能多的原始结构，比 `Buffer(0)` 更可靠，是新项目首选。

::: tip 入库时统一修复
生产环境建议在数据入库环节用 `IsValid` 校验 + `GeometryFixer` 修复，保证库里都是有效几何，后续叠加就不会反复处理无效输入。
:::

## 实战案例

### 案例 1：合并配送范围

100 个骑手各有半径 3km 的圆形配送范围，合并成"店铺整体可达区域"：

```csharp
var riderCenters = new List<Coordinate>
{
    new(0, 0), new(2, 0), new(4, 0), new(1, 2), new(3, 2)
};

// 每个骑手 → 圆形多边形
var circles = riderCenters
    .Select(c => factory.CreatePoint(c).Buffer(3.0))
    .Cast<Geometry>()
    .ToList();

// 一次性级联合并（不要循环 Union）
var reachable = UnaryUnionOp.Union(circles);
Console.WriteLine($"整体可达面积 = {reachable.Area:F2}");

// 派单：判断某点是否在可达范围内
var customer = factory.CreatePoint(new Coordinate(2.5, 1));
Console.WriteLine(reachable.Covers(customer));   // True / False
```

### 案例 2：行政边界合并

把一组相邻的行政区多边形合并成一个"城市群"范围。这类数据通常共享边界，合并后应无缝隙：

```csharp
// districts：从 shapefile / 数据库读入的区县多边形
var districtGeoms = districts.Select(d => d.Geometry).ToList();

// 先修复（行政数据常有微小自相交/缝隙）
var fixedGeoms = districtGeoms
    .Select(g => g.IsValid ? g : GeometryFixer.Fix(g))
    .ToList();

// 级联合并
var cityRegion = UnaryUnionOp.Union(fixedGeoms);

// 若数据源精度差、合并后仍残留细缝，可对"原始两两相邻多边形"用 snap 合并兜底：
// var snapped = new SnapOverlayOp(polyA, polyB)
//     .GetResultGeometry(SpatialFunction.Union);

// 验证：合并后面积 ≈ 各区面积之和（缝隙消失则略小）
var sumArea = districtGeoms.Sum(g => g.Area);
Console.WriteLine($"合并面积 {cityRegion.Area:F0}，各区之和 {sumArea:F0}");
```

::: tip CoverageUnion 处理"无缝覆盖"
当多边形构成**有效覆盖**（无重叠、共享边界，如完整行政区划），`CoverageUnion`（`NetTopologySuite.Operation.OverlayNG`）比 `UnaryUnionOp` 更快——它识别覆盖结构，避免全局 node 化。仅当数据是真正的覆盖时才用。
:::

## 叠加方法速查表

| 需求 | 方法 / 类 | 复杂度 / 备注 |
| --- | --- | --- |
| 两几何交集 | `a.Intersection(b)` | 结果维度可能下降 |
| 两几何并集 | `a.Union(b)` | 注意与无参 `Union()` 区分 |
| 两几何差集 | `a.Difference(b)` | 不可交换 |
| 两几何对称差 | `a.SymDifference(b)` | 可交换，常返回 `Multi*` |
| 批量合并 | `UnaryUnionOp.Union(list)` | O(n log n)，级联 |
| 经典叠加（含拓扑图） | `OverlayOp.Overlay(g0, g1, op)` | 需经典算法/`Graph` 时用 |
| 吸附叠加（治细缝） | `SnapOverlayOp.GetResultGeometry(op)` | snapTolerance 自动推算 |
| 打包组合（不运算） | `GeometryCombiner.Combine(geoms)` | 同型→Multi*，混合→Collection |
| 修复无效几何 | `GeometryFixer.Fix(g)` / `g.Buffer(0)` | 运算前必做 |
| 覆盖合并 | `CoverageUnion.Union(coverage)` | 仅限有效无缝覆盖 |
| 固定精度合并 | `UnaryUnionNG.Union(geoms, pm)` | 提升数值稳健性 |

## 下一步

- [缓冲区 Buffer](./buffer.md)：圆形/方形/单边缓冲，与叠加配合做"可达范围"
- [凸包与简化](./convex-simplify.md)：Douglas-Peucker 与拓扑安全简化，叠加后降顶点数
- [空间谓词](../03-spatial-relations/relationships.md)：叠加前的相交/包含判断
- [自定义操作与扩展](../07-advanced-topics/extending.md)：`GeometryCombiner`、`Noder` 等扩展点
