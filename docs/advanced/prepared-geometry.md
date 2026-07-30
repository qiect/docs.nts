# PreparedGeometry 性能优化

当你要用同一个几何与大量其他几何做谓词判断时（典型：1 万个 POI 是否在某个城市多边形内），普通的 `polygon.Covers(point)` 每次都要重新计算拓扑，效率极低。`PreparedGeometry` 解决的正是这个问题。

## 问题：为什么慢

```csharp
// ❌ 慢：每个 POI 都重新分析多边形
foreach (var poi in tenThousandPois)
{
    if (cityPolygon.Contains(poi)) { ... }
}
```

每次 `Contains` 调用都会：

1. 重新构建多边形的边索引
2. 重新计算每个顶点的拓扑
3. 重新执行点-多边形测试

对于 **同一个多边形**，前两步完全是浪费。

## PreparedGeometry 的思路

`PreparedGeometry` 把多边形的拓扑结构、空间索引 **预先构建并缓存**，后续谓词判断只做第三步：

```csharp
using NetTopologySuite.Geometries.Prepared;

// ✅ 快：预处理一次，重复用
var prepared = PreparedGeometryFactory.Prepare(cityPolygon);

foreach (var poi in tenThousandPois)
{
    if (prepared.Contains(poi)) { ... }   // 只做点测试
}
```

实测速度提升 **10~100 倍**，几何越复杂提升越大。

## 支持的谓词

`PreparedGeometry` 支持的谓词（这是它能加速的）：

| 方法 | 等价方法 |
| --- | --- |
| `Intersects(g)` | `a.Intersects(g)` |
| `Covers(g)` | `a.Covers(g)` |
| `CoveredBy(g)` | `a.CoveredBy(g)` |
| `Contains(g)` | `a.Contains(g)` |
| `ContainsProperly(g)` | （扩展谓词，严格内部） |
| `Within(g)` | `a.Within(g)` |
| `Disjoint(g)` | `a.Disjoint(g)` |
| `Touches(g)` | `a.Touches(g)` |
| `Crosses(g)` | `a.Crosses(g)` |
| `Overlaps(g)` | `a.Overlaps(g)` |
| `AnyInteracts(g)` | 任意谓词为 true |

注意 **不支持运算**（Union、Buffer 等）—— `PreparedGeometry` 只优化谓词。

## 基础用法

```csharp
using NetTopologySuite.Geometries.Prepared;

var city = LoadCityPolygon();
var pois = LoadPois();

// 1. 预处理
IPreparedGeometry prepared = PreparedGeometryFactory.Prepare(city);

// 2. 批量判断
var inCity = pois.Where(p => prepared.Covers(p)).ToList();
```

## PreparedPolygonFactory：类型化工厂

`PreparedGeometryFactory` 是泛型入口，自动选择实现。如果你明确知道是 Polygon，可以用更具体的工厂：

```csharp
var prepared = new PreparedPolygonFactory().Create(cityPolygon);
// 内部用 PreparedPolygon，针对多边形优化
```

实现的类型对应关系：

| 输入类型 | Prepared 实现 |
| --- | --- |
| `Polygon` / `MultiPolygon` | `PreparedPolygon` |
| `LineString` / `MultiLineString` | `PreparedLineString` |
| `Point` / `MultiPoint` | `PreparedPoint` |
| 其他 | `BasicPreparedGeometry` |

## 性能基准

对 10000 个点，测试是否在一个 1000 顶点的多边形内：

| 方法 | 耗时 | 提升 |
| --- | --- | --- |
| `polygon.Contains(point)` | ~1200 ms | 基准 |
| `prepared.Contains(point)` | ~25 ms | ~48× |
| `IndexedPointInAreaLocator` | ~12 ms | ~100× |

::: tip 极致优化
如果是"点多边形内"这种最常见场景，`IndexedPointInAreaLocator` 甚至比 `PreparedGeometry.Covers` 还快。它专门为点-多边形测试设计。

```csharp
using NetTopologySuite.Algorithm.Locate;

var locator = new IndexedPointInAreaLocator(cityPolygon);
foreach (var p in pois)
{
    bool inside = locator.Locate(p.Coordinate) != Location.Exterior;
}
```
:::

## 应用场景

### 1. POI 落区分析

把全国 50 万个 POI 落到 3000 个区县多边形里。每个多边形用 `PreparedGeometry` 预处理一次：

```csharp
var districts = LoadDistricts();   // 3000 个区县
var pois = LoadAllPois();          // 50 万 POI

var result = new Dictionary<string, List<Point>>();

foreach (var d in districts)
{
    var prepared = PreparedGeometryFactory.Prepare(d.Geometry);
    var matched = pois.Where(p => prepared.Covers(p)).ToList();
    result[d.Name] = matched;
}
```

### 2. 实时地理围栏

车辆每秒上报位置，判断是否在某个围栏内：

```csharp
public class GeofenceService
{
    private readonly Dictionary<string, IPreparedGeometry> _zones = new();

    public void AddZone(string id, Geometry zone)
    {
        _zones[id] = PreparedGeometryFactory.Prepare(zone);
    }

    public List<string> CheckViolations(Point location)
    {
        return _zones
            .Where(kvp => kvp.Value.Contains(location))
            .Select(kvp => kvp.Key)
            .ToList();
    }
}
```

### 3. 与 STRtree 组合：粗过滤 + 精判断

```csharp
// 1. 用 STRtree 粗过滤（Envelope 相交）
var tree = new STRtree<Geometry>();
foreach (var d in districts)
    tree.Insert(d.Geometry.EnvelopeInternal, d);
tree.Build();

// 2. 对候选几何用 PreparedGeometry 精判断
var candidates = tree.Query(point.EnvelopeInternal);
foreach (var d in candidates)
{
    var prepared = preparedCache.GetOrAdd(d, PreparedGeometryFactory.Prepare);
    if (prepared.Covers(point))
    {
        // 命中
    }
}
```

## 内存与生命周期

`PreparedGeometry` 持有对原始 `Geometry` 的引用，并附加索引结构，所以内存占用比原几何略大。

- **缓存复用**：把 `PreparedGeometry` 缓存在静态字典或 DI 容器中，长期使用。
- **不要每查询一次都 Prepare**：那等于没优化。
- **几何不变性**：原始几何 **不能修改**——`PreparedGeometry` 不会检测变更。如果原始几何变化，必须重新 Prepare。

```csharp
// 错误：缓存 prepared 后又修改了原几何
var prepared = PreparedGeometryFactory.Prepare(poly);
// poly.Buffer(0); ← 假设这样"修复"了 poly
// prepared 现在指向旧拓扑，结果错误！
```

## 与普通谓词的等价性

`PreparedGeometry` 的谓词结果与普通谓词 **完全一致**，只是更快。它不改变语义。

```csharp
bool a = polygon.Contains(point);
bool b = prepared.Contains(point);
// a == b 永远成立
```

## 限制

1. 只加速谓词，不加速运算
2. 原始几何不可变（必须重新 Prepare 才能用新数据）
3. 占用额外内存（约比原几何多 30~80%）
4. 准备阶段有成本（构建索引约 1~50ms，取决于几何复杂度）

::: tip 何时 **不** 用 PreparedGeometry
- 只判断一次：直接用普通谓词更快（少了 Prepare 开销）
- 几何频繁变化：缓存无效
- 内存敏感场景：考虑用 `IndexedPointInAreaLocator` 等更轻量方案
:::

## 小结

- `PreparedGeometry` 适合"同一几何多次谓词判断"场景
- 典型提升 10~100 倍，几何越复杂收益越大
- 原始几何不可变，否则必须重新 Prepare
- "点多边形"极致场景可考虑 `IndexedPointInAreaLocator`

## 下一步

- [空间索引 STRtree](./spatial-index.md)：批量查询的粗过滤利器
- [空间谓词](../predicates/relationships.md)
- [API 速查表](../cookbook/cheatsheet.md)
