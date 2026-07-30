# 空间关系与谓词

空间谓词回答"两个几何之间是什么关系"——这是空间查询的核心。NTS 实现了 OGC 定义的八大谓词，全部基于 [DE-9IM 模型](./de9im.md)。

## 八大谓词速览

| 谓词 | 方法 | 含义 |
| --- | --- | --- |
| Equals | `g1.EqualsTopologically(g2)` | 两几何拓扑相同 |
| Disjoint | `g1.Disjoint(g2)` | 完全没有公共点 |
| Intersects | `g1.Intersects(g2)` | 至少有一个公共点 |
| Touches | `g1.Touches(g2)` | 仅在边界上接触 |
| Crosses | `g1.Crosses(g2)` | 一个穿过另一个，维度低于两者 |
| Within | `g1.Within(g2)` | g1 完全在 g2 内部 |
| Contains | `g1.Contains(g2)` | g2 完全在 g1 内部 |
| Overlaps | `g1.Overlaps(g2)` | 同维度相交，但谁也不包含谁 |

另外两个 NTS 扩展谓词：

| 谓词 | 含义 |
| --- | --- |
| Covers | g1 包含 g2（含边界） |
| CoveredBy | g1 被 g2 覆盖（含边界） |

## 关键概念：interior / boundary / exterior

每个几何被分成三部分：

```
┌─────────────────────────────┐
│  exterior (外部)              │  ← 不在几何上的所有点
│   ┌───────────────────────┐  │
│   │  boundary (边界)         │  │ ← 几何的"轮廓"
│   │   ┌─────────────────┐  │  │
│   │   │  interior (内部)    │  │  │ ← 几何"里面"的点
│   │   └─────────────────┘  │  │
│   └───────────────────────┘  │
└─────────────────────────────┘
```

不同几何类型的 boundary 规则：

| 几何 | interior | boundary |
| --- | --- | --- |
| Point | 点本身 | 空 |
| LineString | 除端点外的所有点 | 两个端点 |
| LinearRing (闭合环) | 除端点外的所有点 | 空 |
| Polygon | 内部区域 | 外壳 + 所有孔洞 |

理解这三部分是掌握谓词的关键。

## 1. Intersects / Disjoint（最常用）

```csharp
var a = factory.CreatePolygon(...);  // 一个多边形
var b = factory.CreatePoint(...);    // 一个点

a.Intersects(b);   // 等价于 !a.Disjoint(b)
```

`Intersects` 是 **最快** 的谓词，因为它只要找到一个公共点就返回 true。在大量数据中筛选候选对象时，**永远先用 Intersects 粗过滤**，再用更严格的谓词二次判断。

## 2. Contains / Within

```csharp
var polygon = factory.CreatePolygon(...);
var point   = factory.CreatePoint(new Coordinate(5, 5));

polygon.Contains(point);   // true（点在多边形内部，且不在边界）
point.Within(polygon);     // true（等价于 polygon.Contains(point)）
```

::: warning 边界规则
OGC `Contains` 与 `Within` 是 **严格内部** 关系：如果点正好在边界上，**返回 false**。

```csharp
var onEdge = factory.CreatePoint(new Coordinate(0, 5));
polygon.Contains(onEdge);  // false！因为点在边界上
```

如果你需要"边界也算包含"，用 `Covers` / `CoveredBy`。
:::

## 3. Covers / CoveredBy（推荐）

NTS 对 OGC 谓词的扩展，更符合直觉：

```csharp
polygon.Covers(onEdge);     // true（包含边界）
onEdge.CoveredBy(polygon);  // true
```

**实际开发中，`Covers` 几乎总是比 `Contains` 更实用**——因为你通常希望"边界点也算在内"。

| 场景 | 推荐 |
| --- | --- |
| "用户是否在配送区内" | `Covers` |
| "餐厅是否在行政区里" | `Covers` |
| 严格拓扑判定（学术） | `Contains` / `Within` |

## 4. Touches

只在 **边界** 上有公共点，interior 不相交：

```csharp
var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 0), new Coordinate(5, 5),
    new Coordinate(0, 5), new Coordinate(0, 0)
});

var b = factory.CreatePolygon(new[]
{
    new Coordinate(5, 0), new Coordinate(10, 0), new Coordinate(10, 5),
    new Coordinate(5, 5), new Coordinate(5, 0)
});

a.Touches(b);  // true（共享一条边）
a.Intersects(b); // true
```

## 5. Crosses

"穿越"关系——一个几何穿过另一个，且结果维度低于两者最大维度：

```csharp
var line  = factory.CreateLineString(new[]
{
    new Coordinate(-1, 5), new Coordinate(11, 5)
});

var poly = factory.CreatePolygon(...);   // [0,10] × [0,10]

poly.Crosses(line);  // true（线穿过面）
line.Crosses(poly);  // true（对称）
```

典型场景：河流穿过省界、铁路穿过城市。

::: tip Crosses 的维度规则
- Line × Line：相交结果是 Point（0 维）
- Line × Polygon：相交结果是 LineString（1 维）
- Polygon × Polygon：**不能用 Crosses**（同维度），改用 Overlaps
:::

## 6. Overlaps

同维度的"部分相交"——既不是包含，也不是不相交：

```csharp
var a = factory.CreatePolygon(/* [0,10]×[0,10] */);
var b = factory.CreatePolygon(/* [5,15]×[5,15] */);

a.Overlaps(b);  // true（相交区域是 [5,10]×[5,10]，且彼此都不包含对方）
```

## 7. Equals

```csharp
var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

// 顶点顺序不同，但相同的多边形
var b = factory.CreatePolygon(new[]
{
    new Coordinate(10, 10), new Coordinate(10, 0), new Coordinate(0, 0),
    new Coordinate(0, 10), new Coordinate(10, 10)
});

a.EqualsTopologically(b);  // true（拓扑相等，无视顶点顺序）
a.EqualsExact(b);          // false（逐顶点比较，顺序不同）
```

| 方法 | 比较方式 |
| --- | --- |
| `EqualsExact` | 严格逐点比较（顺序、坐标完全相同） |
| `EqualsTopologically` | 拓扑相等（顶点顺序可不同） |
| `EqualsNormalized` | 先归一化（Normalize）再比较 |

## 谓词之间的关系图

```
                 ┌─ Disjoint ──── 全互斥
                 │
   两个几何 ─────┤
                 │                ┌─ Contains / Within
                 └─ Intersects ───┤
                                  ├─ Covers / CoveredBy
                                  ├─ Touches
                                  ├─ Crosses
                                  └─ Overlaps
```

记忆要点：

- `Disjoint` 与 `Intersects` 互为补集
- `Contains`、`Within` 互为对称
- `Covers`、`CoveredBy` 互为对称
- `Covers` ⊃ `Contains`（Covers 允许边界接触）

## 用 Relate 自定义谓词

每个谓词背后都是 DE-9IM 矩阵。你可以用 `Relate` 直接指定矩阵：

```csharp
// 等价于 a.Within(b)
a.Relate(b, "T*F**F***");

// 自定义：a 的内部与 b 的内部有交集，但不被 b 完全覆盖
a.Relate(b, "T********");
```

详见 [DE-9IM 模型](./de9im.md)。

## 性能优化：PreparedGeometry

如果你要对 **同一个几何** 做多次谓词判断（如检查 10000 个点是否在一个城市多边形内），用 `PreparedGeometry`：

```csharp
using NetTopologySuite.Geometries.Prepared;

var city = /* 加载城市多边形 */;
var preparedCity = PreparedGeometryFactory.Prepare(city);

foreach (var poi in tenThousandPois)
{
    if (preparedCity.Covers(poi))
    {
        // ...
    }
}
```

`PreparedGeometry` 预先构建空间索引和拓扑结构，重复判定速度提升 10~100 倍。详见 [PreparedGeometry](../advanced/prepared-geometry.md)。

## 实战案例：筛选行政区内的 POI

```csharp
var district = LoadDistrictPolygon();   // 区县多边形
var pois     = LoadAllPois();           // 1 万个 POI

// 错误做法：对每个 POI 调用 Contains（慢）
var slow = pois.Where(p => district.Contains(p)).ToList();

// 正确做法：用 PreparedGeometry
var prepared = PreparedGeometryFactory.Prepare(district);
var fast = pois.Where(p => prepared.Covers(p)).ToList();
```

## 常见陷阱

### 1. 边界上的点

```csharp
district.Contains(pointOnEdge);  // false！
district.Covers(pointOnEdge);    // true
```

### 2. MultiPolygon 的 Contains

`MultiPolygon.Contains(point)` 在任一子多边形包含该点时返回 true，无需手动遍历。

### 3. 浮点精度导致 false negative

```csharp
// 应该相交，但浮点误差让它"擦肩而过"
a.Intersects(b);  // 可能返回 false
```

如果你怀疑精度问题，可以：
- 降低 `PrecisionModel`（用 Fixed）
- 对几何做轻微 `Buffer(epsilon)` 再判断

## 小结

| 谓词 | 用途 |
| --- | --- |
| Intersects | 任何公共点（最常用，最快） |
| Disjoint | 完全不相交 |
| Contains / Within | 严格内部 |
| Covers / CoveredBy | 内部 + 边界（推荐日常用） |
| Touches | 仅边界接触 |
| Crosses | 穿越关系 |
| Overlaps | 同维度部分相交 |

## 下一步

- [DE-9IM 模型](./de9im.md)：理解谓词背后的数学
- [PreparedGeometry](../advanced/prepared-geometry.md)：谓词性能优化
- [空间索引 STRtree](../advanced/spatial-index.md)：批量查询加速
