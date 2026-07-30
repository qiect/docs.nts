# DE-9IM 模型

DE-9IM（Dimensionally Extended 9-Intersection Model，维度扩展九交模型）是 OGC 标准下"两个几何关系"的数学表达。NTS 的所有谓词——Contains、Within、Intersects……——本质都是 DE-9IM 矩阵的快捷检查。

理解 DE-9IM 让你能：

- 自定义谓词（标准谓词覆盖不到的边界情况）
- 阅读数据库的 `ST_Relate` 输出
- 精确诊断"为什么这两个几何 Contains 返回 false"

```csharp
using NetTopologySuite.Geometries;

// 本页示例共用工厂
var factory = new GeometryFactory();
```

## 几何的三部分

回顾一下，每个几何被分为三部分：

| 部分 | 含义 | Polygon | LineString | Point |
| --- | --- | --- | --- | --- |
| Interior (I) | 内部 | 多边形内部区域 | 除端点外的线段 | 点本身 |
| Boundary (B) | 边界 | 外壳 + 孔洞环 | 两个端点 | 空 |
| Exterior (E) | 外部 | 其余所有点 | 其余所有点 | 其余所有点 |

::: tip Exterior 是"除该几何外的整个平面"
`Exterior` 不是几何周围的"一圈"，而是平面上 **不属于 Interior 和 Boundary 的所有点**——一个无限大的开集。正因为 Exterior 无限，`A.E ∩ B.E` 几乎总是非空（维度 2）。
:::

## 3×3 矩阵

DE-9IM 把几何 A 的三部分与几何 B 的三部分两两相交，记录每个交集的 **维度**：

| | B.Interior | B.Boundary | B.Exterior |
| --- | --- | --- | --- |
| **A.Interior** | dim(A.I ∩ B.I) | dim(A.I ∩ B.B) | dim(A.I ∩ B.E) |
| **A.Boundary** | dim(A.B ∩ B.I) | dim(A.B ∩ B.B) | dim(A.B ∩ B.E) |
| **A.Exterior** | dim(A.E ∩ B.I) | dim(A.E ∩ B.B) | dim(A.E ∩ B.E) |

每个 cell 的值是交集的维度：

- `-1`：交集为空（无交点），记作 `F`
- `0`：交集是 Point（点集）
- `1`：交集是 LineString（线集）
- `2`：交集是 Polygon（面集）

把 9 个数字按行优先连起来，就得到一个 9 字符的字符串，例如 `212101212`。

### 矩阵与几何的对应

下面是两个部分重叠的多边形 A、B，9 个编号圆圈对应矩阵的 9 个 cell，右侧矩阵每格标注维度值与编号，便于一一对照。

<figure class="nts-diagram">
<svg viewBox="0 0 580 245" width="580" height="245">
  <!-- 左：几何叠加图 -->
  <g>
    <!-- A 多边形 -->
    <polygon points="20,180 170,180 170,40 20,40" fill="rgba(11,110,79,0.15)" stroke="#0b6e4f" stroke-width="2"/>
    <!-- B 多边形 -->
    <polygon points="120,210 270,210 270,70 120,70" fill="rgba(170,0,0,0.13)" stroke="#a00" stroke-width="2"/>
    <!-- 重叠区高亮 -->
    <polygon points="120,180 170,180 170,70 120,70" fill="rgba(255,200,0,0.38)" stroke="#a86300" stroke-width="1" stroke-dasharray="3 2"/>

    <!-- 标签 -->
    <text x="28" y="56" font-family="monospace" font-size="14" font-weight="bold" fill="#0b6e4f">A</text>
    <text x="256" y="86" font-family="monospace" font-size="14" font-weight="bold" fill="#a00">B</text>

    <!-- 交点强调 -->
    <circle cx="170" cy="70" r="3" fill="#333"/>
    <circle cx="120" cy="180" r="3" fill="#333"/>

    <!-- 编号圆圈 -->
    <!-- 1 重叠区 A.I∩B.I = 2 -->
    <circle cx="145" cy="125" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="145" y="129" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">1</text>
    <!-- 2 A.I∩B.B = 1 (B 左边界在 A 内) -->
    <circle cx="113" cy="125" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="113" y="129" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">2</text>
    <!-- 3 A.I∩B.E = 2 (A 内部非重叠) -->
    <circle cx="65" cy="105" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="65" y="109" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">3</text>
    <!-- 4 A.B∩B.I = 1 (A 右边界在 B 内) -->
    <circle cx="180" cy="125" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="180" y="129" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">4</text>
    <!-- 5 A.B∩B.B = 0 (边界交点) -->
    <circle cx="188" cy="62" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="188" y="66" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">5</text>
    <!-- 6 A.B∩B.E = 1 (A 左边界) -->
    <circle cx="20" cy="110" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="20" y="114" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">6</text>
    <!-- 7 A.E∩B.I = 2 (B 内部非重叠) -->
    <circle cx="225" cy="155" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="225" y="159" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">7</text>
    <!-- 8 A.E∩B.B = 1 (B 右边界) -->
    <circle cx="270" cy="155" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="270" y="159" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">8</text>
    <!-- 9 A.E∩B.E = 2 (外部) -->
    <circle cx="240" cy="55" r="9" fill="#fff" stroke="#333" stroke-width="1.2"/>
    <text x="240" y="59" text-anchor="middle" font-family="monospace" font-size="10" font-weight="bold" fill="#333">9</text>
  </g>

  <!-- 右：3×3 矩阵 -->
  <g transform="translate(340, 30)">
    <!-- 表头列标签 (A) -->
    <text x="-6" y="32" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.I</text>
    <text x="-6" y="74" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.B</text>
    <text x="-6" y="116" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.E</text>
    <!-- 表头行标签 (B) -->
    <text x="32" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.I</text>
    <text x="92" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.B</text>
    <text x="152" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.E</text>

    <!-- 行1 -->
    <rect x="2" y="12" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="24" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">2</text>
    <circle cx="50" cy="22" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="50" y="25" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">1</text>

    <rect x="62" y="12" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="84" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">1</text>
    <circle cx="110" cy="22" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="110" y="25" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">2</text>

    <rect x="122" y="12" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="144" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">2</text>
    <circle cx="170" cy="22" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="170" y="25" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">3</text>

    <!-- 行2 -->
    <rect x="2" y="52" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="24" y="80" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">1</text>
    <circle cx="50" cy="62" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="50" y="65" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">4</text>

    <rect x="62" y="52" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="84" y="80" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">0</text>
    <circle cx="110" cy="62" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="110" y="65" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">5</text>

    <rect x="122" y="52" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="144" y="80" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">1</text>
    <circle cx="170" cy="62" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="170" y="65" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">6</text>

    <!-- 行3 -->
    <rect x="2" y="92" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="24" y="120" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">2</text>
    <circle cx="50" cy="102" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="50" y="105" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">7</text>

    <rect x="62" y="92" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="84" y="120" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">1</text>
    <circle cx="110" cy="102" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="110" y="105" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">8</text>

    <rect x="122" y="92" width="60" height="40" fill="rgba(11,110,79,0.12)" stroke="#999"/>
    <text x="144" y="120" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">2</text>
    <circle cx="170" cy="102" r="7" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="170" y="105" text-anchor="middle" font-family="monospace" font-size="8" fill="#333">9</text>
  </g>
</svg>
<figcaption>两个部分重叠的多边形：9 个编号区域对应 3×3 矩阵的 9 个 cell，矩阵为 <code>212101212</code></figcaption>
</figure>

::: tip 看图记住矩阵结构
上图中：编号 **1**（重叠区，面集 → `2`）、**5**（边界交点，点集 → `0`）、**2/4/6/8**（边界与内部的交集，线集 → `1`）。`A.E ∩ B.E`（编号 9）几乎总是 `2`，因为两个外部都是无限面集。
:::

## 在 NTS 中获取 DE-9IM

`Geometry.Relate` 有两个重载：一个返回完整矩阵，一个按模式判断。

**签名**：

```csharp
public IntersectionMatrix Relate(Geometry g);              // 返回完整 DE-9IM 矩阵
public bool Relate(Geometry g, string intersectionPattern); // 按模式判断
```

**语义**：

- `Relate(g)`：计算并返回 `IntersectionMatrix` 对象，包含 9 个 cell 的维度
- `Relate(g, pattern)`：计算矩阵后，立即用 9 字符模式匹配，返回布尔值

```csharp
var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});
var b = factory.CreatePolygon(new[]
{
    new Coordinate(5, 5), new Coordinate(15, 5), new Coordinate(15, 15),
    new Coordinate(5, 15), new Coordinate(5, 5)
});

// 获取完整矩阵
IntersectionMatrix matrix = a.Relate(b);
string code = matrix.ToString();   // "212101212"

// 查看每个 cell（Location 是枚举：Interior=0, Boundary=1, Exterior=2）
Console.WriteLine(matrix[Location.Interior, Location.Interior]);  // 2
Console.WriteLine(matrix[Location.Interior, Location.Boundary]);  // 1
Console.WriteLine(matrix[Location.Boundary, Location.Boundary]);  // 0

// 直接按模式判断：a 是否包含 b 的部分内部？等价于 Overlaps
Console.WriteLine(a.Relate(b, "T*T***T**"));  // True
```

## IntersectionMatrix API 详解

`IntersectionMatrix` 是 DE-9IM 矩阵的对象封装，位于 `NetTopologySuite.Geometries` 命名空间。除了从 `Relate()` 获取，你也可以手动构造、修改、匹配。下面逐个讲解核心 API。

### 索引器 this[Location, Location]

**签名**：

```csharp
public int this[Location row, int column] { get; set; }
public int this[int row, int column] { get; set; }
```

**语义**：读取或设置矩阵中指定行列的维度值。`Location` 是枚举（`Interior=0`、`Boundary=1`、`Exterior=2`），可隐式转为 `int`，因此 `matrix[Location.Interior, Location.Boundary]` 与 `matrix[0, 1]` 等价。

行表示 A 的部分，列表示 B 的部分，与数学定义一致。

```csharp
IntersectionMatrix m = a.Relate(b);

// 读取：A 的内部与 B 的边界交集维度
int dim = m[Location.Interior, Location.Boundary];

// 写入：手动设置某个 cell（通常用于构造自定义矩阵）
m[Location.Exterior, Location.Exterior] = 2;
```

::: warning 索引器是可写的
`IntersectionMatrix` 是可变对象，索引器的 `set` 会修改内部状态。从 `Relate()` 拿到的矩阵若需长期保存，应立即 `ToString()` 转为字符串（或 `new IntersectionMatrix(m.ToString())` 构造独立副本），避免后续误改。
:::

### Is(Location, Location, int)

**签名**：

```csharp
public bool Is(Location row, Location column, int dimensionValue);
```

**语义**：判断指定 cell 是否 **等于** 某个维度值。`dimensionValue` 用 `-1` 表示空交集（即 `F`），`0/1/2` 表示点/线/面。

它等价于 `m[row, column] == dimensionValue`，但语义更清晰。

```csharp
IntersectionMatrix m = a.Relate(b);

// A 的内部是否完全不与 B 的内部相交？（即 disjoint 的一个条件）
bool interiorDisjoint = m.Is(Location.Interior, Location.Interior, -1);

// A 的边界与 B 的边界交集是否恰好是点集（维度 0）？
bool pointContact = m.Is(Location.Boundary, Location.Boundary, 0);
```

::: tip Is 用 -1 表示"空"，不是字符 'F'
`Is` 接受 `int` 参数，空交集用 `-1` 表示，而非字符 `'F'`。字符 `F` 是 `ToString()` 与 `Matches(pattern)` 中的写法，两者不要混淆。
:::

### Matches(string pattern)

**签名**：

```csharp
public bool Matches(string pattern);                    // 实例方法
public static bool Matches(string matrix, string pattern); // 静态方法
```

**语义**：将矩阵与 9 字符模式匹配，模式字符含义见下一节[通配符](#通配符)。实例方法检查当前矩阵；静态方法可直接对矩阵字符串做匹配，无需创建对象。

```csharp
IntersectionMatrix m = a.Relate(b);

// 实例方法：当前矩阵是否匹配 Contains 模式？
bool contains = m.Matches("T*****FF*");

// 静态方法：直接对字符串匹配，适合从数据库读出的 ST_Relate 文本
bool isDisjoint = IntersectionMatrix.Matches("FF2FF1212", "FF*FF****");  // True
```

`Matches` 是 `Relate(g, pattern)` 的底层：`a.Relate(b, pattern)` 本质就是 `a.Relate(b).Matches(pattern)`。

### ToString()

**签名**：`public override string ToString();`

**语义**：返回 9 字符矩阵字符串，按行优先排列，空交集输出 `F`，其余输出对应维度数字 `0/1/2`。这个字符串与 PostGIS 的 `ST_Relate` 输出完全一致。

```csharp
IntersectionMatrix m = a.Relate(b);
string s = m.ToString();   // 如 "212101212"

// 字符串按 3×3 还原：
// 2 1 2
// 1 0 1
// 2 1 2
```

::: tip ToString 是矩阵的标准序列化
`ToString()` 不是调试用的辅助输出，而是 DE-9IM 矩阵的 **标准序列化形式**。它可以存库、跨进程传递、再通过构造函数 `new IntersectionMatrix(s)` 还原。
:::

### Set(Location, Location, int)

**签名**：

```csharp
public void Set(Location row, Location column, int dimensionValue);
```

**语义**：设置指定 cell 的维度值。与索引器 `set` 功能相同，但 `Set` 的方法形式在批量构造时更直观。配套还有 `SetAtLeast`（仅当新值更大才更新）与 `SetAll`（全部设为同一值）。

```csharp
// 手动构造一个 "Contains" 关系的矩阵
var m = new IntersectionMatrix();
m.SetAll(-1);                                            // 先全部置空
m.Set(Location.Interior, Location.Interior, 2);          // A.I ∩ B.I = 2
m.Set(Location.Exterior, Location.Interior, -1);         // A.E ∩ B.I = F
m.Set(Location.Exterior, Location.Boundary, -1);         // A.E ∩ B.B = F
Console.WriteLine(m);   // "2******FF*"

// SetAtLeast：只在比当前值更大时更新（构造"至少满足"的矩阵时常用）
m.SetAtLeast(Location.Boundary, Location.Interior, 1);   // 若原值 <1 才设为 1
```

### 便捷判断方法

`IntersectionMatrix` 还内置了一组 `Is*` 方法，直接判断标准谓词，无需手写模式：

| 方法 | 等价模式 | 说明 |
| --- | --- | --- |
| `IsDisjoint()` | `FF*FF****` | 是否不相交 |
| `IsIntersects()` | `T********` 等（任一非空） | 是否相交 |
| `IsContains()` | `T*****FF*` | A 是否包含 B |
| `IsWithin()` | `T*F**F***` | A 是否在 B 内 |
| `IsEquals(dimA, dimB)` | `T*F**FFF*` | 是否拓扑相等 |
| `IsTouches(dimA, dimB)` | `FT*******` 等 | 是否仅边界接触 |
| `IsCrosses(dimA, dimB)` | 视维度组合 | 是否穿越 |
| `IsOverlaps(dimA, dimB)` | `T*T***T**` | 是否同维度部分相交 |

```csharp
IntersectionMatrix m = a.Relate(b);
if (m.IsContains()) { /* a 包含 b */ }
if (m.IsDisjoint()) { /* a 与 b 不相交 */ }
```

## 通配符

在用 `Relate(pattern)` 或 `Matches(pattern)` 做谓词判断时，可以用通配符：

| 字符 | 含义 |
| --- | --- |
| `T` | dim ≥ 0（交集非空） |
| `F` | dim = -1（交集为空） |
| `*` | 任意（不关心） |
| `0` | dim = 0（点） |
| `1` | dim = 1（线） |
| `2` | dim = 2（面） |

::: warning T/F 与 0/1/2 的区别
`T` 表示"任意非空"（含 0、1、2），`F` 表示"空"。而 `0`、`1`、`2` 是 **精确维度** 匹配。写模式时若只需"有交集"用 `T`，若需"交集恰好是点/线/面"才用数字。
:::

## 标准谓词的 DE-9IM 等价模式

每个 OGC 谓词都对应一个或多个 DE-9IM 模式。`Touches`、`Crosses` 等谓词因几何维度组合不同而有多种模式，满足任一即成立。

| 谓词 | DE-9IM 模式 |
| --- | --- |
| Equals | `T*F**FFF*` |
| Disjoint | `FF*FF****` |
| Intersects | `T********` 或 `*T*******` 或 `***T*****` 或 `****T****`（任一） |
| Touches | `FT*******` 或 `F**T*****` 或 `F***T****` |
| Crosses (Line × Line) | `0********` |
| Crosses (Line × Poly) | `T*T******` |
| Within | `T*F**F***` |
| Contains | `T*****FF*` |
| Overlaps (同维度) | `T*T***T**` |
| Covers | `T*TFF*FF*` |
| CoveredBy | `T*FFT**FF` |

### Contains 关系矩阵高亮

下图：大多边形 A 包含小多边形 B（B 完全在 A 内部，不碰边界）。`Contains` 模式 `T*****FF*` 的关键约束是第 1 位（`A.I∩B.I` 非空）与第 7、8 位（`A.E` 不与 `B.I`、`B.B` 相交——即 B 不溢出 A）。

<figure class="nts-diagram">
<svg viewBox="0 0 540 220" width="540" height="220">
  <!-- 左：几何示意 -->
  <g>
    <polygon points="20,30 240,30 240,190 20,190" fill="rgba(11,110,79,0.15)" stroke="#0b6e4f" stroke-width="2"/>
    <polygon points="80,90 170,90 170,140 80,140" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="2"/>
    <text x="28" y="48" font-family="monospace" font-size="13" font-weight="bold" fill="#0b6e4f">A</text>
    <text x="118" y="118" font-family="monospace" font-size="13" font-weight="bold" fill="#fff">B</text>
  </g>
  <!-- 右：矩阵高亮 -->
  <g transform="translate(300, 25)">
    <text x="-6" y="32" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.I</text>
    <text x="-6" y="74" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.B</text>
    <text x="-6" y="116" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.E</text>
    <text x="32" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.I</text>
    <text x="92" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.B</text>
    <text x="152" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.E</text>
    <!-- 行1 -->
    <rect x="2" y="12" width="60" height="40" fill="rgba(11,110,79,0.35)" stroke="#0b6e4f" stroke-width="2"/>
    <text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#0b6e4f">2</text>
    <rect x="62" y="12" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="92" y="40" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">F</text>
    <rect x="122" y="12" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="40" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">F</text>
    <!-- 行2 -->
    <rect x="2" y="52" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="32" y="80" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">1</text>
    <rect x="62" y="52" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="92" y="80" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">F</text>
    <rect x="122" y="52" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="80" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">F</text>
    <!-- 行3 -->
    <rect x="2" y="92" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="32" y="120" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="62" y="92" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="92" y="120" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="122" y="92" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="120" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">2</text>
  </g>
  <text x="300" y="180" font-family="monospace" font-size="11" fill="#0b6e4f">高亮：T(绿) = 必须非空，F(红) = 必须为空</text>
</svg>
<figcaption>Contains <code>T*****FF*</code>：A 内部与 B 内部有交集（绿），A 外部与 B 的内部/边界无交集（红）——B 完全在 A 内</figcaption>
</figure>

### Disjoint 关系矩阵高亮

下图：两个不相交的多边形。`Disjoint` 模式 `FF*FF****` 要求 A 的 interior、boundary 都不与 B 的 interior、boundary 相交（前 5 位中第 1、2、4、5 位为 `F`）。

<figure class="nts-diagram">
<svg viewBox="0 0 540 220" width="540" height="220">
  <!-- 左：几何示意 -->
  <g>
    <polygon points="20,50 130,50 130,170 20,170" fill="rgba(11,110,79,0.18)" stroke="#0b6e4f" stroke-width="2"/>
    <polygon points="170,50 280,50 280,170 170,170" fill="rgba(170,0,0,0.15)" stroke="#a00" stroke-width="2"/>
    <text x="60" y="118" font-family="monospace" font-size="13" font-weight="bold" fill="#0b6e4f">A</text>
    <text x="210" y="118" font-family="monospace" font-size="13" font-weight="bold" fill="#a00">B</text>
  </g>
  <!-- 右：矩阵高亮 -->
  <g transform="translate(300, 25)">
    <text x="-6" y="32" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.I</text>
    <text x="-6" y="74" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.B</text>
    <text x="-6" y="116" text-anchor="end" font-family="monospace" font-size="10" fill="#0b6e4f">A.E</text>
    <text x="32" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.I</text>
    <text x="92" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.B</text>
    <text x="152" y="-6" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">B.E</text>
    <!-- 行1 -->
    <rect x="2" y="12" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="62" y="12" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="92" y="40" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="122" y="12" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="40" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">2</text>
    <!-- 行2 -->
    <rect x="2" y="52" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="32" y="80" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="62" y="52" width="60" height="40" fill="rgba(170,0,0,0.30)" stroke="#a00" stroke-width="2"/>
    <text x="92" y="80" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#a00">F</text>
    <rect x="122" y="52" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="80" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">1</text>
    <!-- 行3 -->
    <rect x="2" y="92" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="32" y="120" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">2</text>
    <rect x="62" y="92" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="92" y="120" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">1</text>
    <rect x="122" y="92" width="60" height="40" fill="rgba(11,110,79,0.08)" stroke="#999"/>
    <text x="152" y="120" text-anchor="middle" font-family="monospace" font-size="15" fill="#666">2</text>
  </g>
  <text x="300" y="180" font-family="monospace" font-size="11" fill="#a00">高亮：4 个 F 表示 A 的 I/B 与 B 的 I/B 完全无交集</text>
</svg>
<figcaption>Disjoint <code>FF*FF****</code>：A、B 的 interior 与 boundary 两两不相交，矩阵为 <code>FF2FF1212</code></figcaption>
</figure>

::: tip 模式速记
看 `Within` 模式 `T*F**F***`：

- `A.I ∩ B.I = T`（A 内部在 B 内部）
- `A.I ∩ B.E = F`（A 内部不在 B 外部）
- `A.B ∩ B.E = F`（A 边界不在 B 外部）

合起来：A 完全在 B 内部。
:::

## 如何从两个具体几何手动推算矩阵

理解 DE-9IM 最好的方式是亲手推算一次。下面以"一条水平线穿过正方形"为例，分步演示。

**几何定义**：

- A = 线段 `(-5, 5) → (15, 5)`（一条水平线，横跨多边形左右）
- B = 多边形 `[0,10] × [0,10]`（单位正方形）

### 第 1 步：列出 A、B 的三部分

| | Interior | Boundary | Exterior |
| --- | --- | --- | --- |
| **A（线）** | 开线段 `(-5,5)→(15,5)`，不含两端点 | 两个端点 `(-5,5)`、`(15,5)` | 平面上除线以外的所有点 |
| **B（面）** | 开正方形 `(0,10)×(0,10)` | 四条边 | 平面上除正方形以外的所有点 |

### 第 2 步：逐行计算 9 个交集

**第 1 行：A.Interior（开线段）与 B 的三部分**

- `A.I ∩ B.I`：开线段穿过开正方形的部分，是 `(0,5)→(10,5)` 的开线段 → **1（线集）**
- `A.I ∩ B.B`：开线段与四条边的交点，是 `(0,5)`、`(10,5)` 两个点 → **0（点集）**
- `A.I ∩ B.E`：开线段在外部的部分，是 `(-5,5)→(0,5)` 与 `(10,5)→(15,5)` 两段开线段 → **1（线集）**

**第 2 行：A.Boundary（两个端点）与 B 的三部分**

- `A.B ∩ B.I`：两端点 `(-5,5)`、`(15,5)` 都在正方形外，不在内部 → **F（空）**
- `A.B ∩ B.B`：两端点都不在四条边上 → **F（空）**
- `A.B ∩ B.E`：两端点都在外部 → **0（点集）**

**第 3 行：A.Exterior（除线外的所有点）与 B 的三部分**

- `A.E ∩ B.I`：正方形内部除线上的点 → **2（面集）**
- `A.E ∩ B.B`：四条边除线穿过的两个点 `(0,5)`、`(10,5)` → **1（线集）**
- `A.E ∩ B.E`：外部与外部的交集 → **2（面集）**

### 第 3 步：拼成矩阵字符串

```
1 0 1
F F 0
2 1 2
```

按行优先连起来：**`101FF0212`**。

### 第 4 步：用 NTS 验证

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(-5, 5), new Coordinate(15, 5)
});
var poly = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

Console.WriteLine(line.Relate(poly));  // 101FF0212
Console.WriteLine(line.Crosses(poly)); // True（线穿过面，交集维度 1 < 面 2）
```

::: tip 推算的关键是"开/闭"之分
手算时最容易错的是 **Interior 是开集**（不含 boundary）。线段 `(-5,5)→(15,5)` 的 interior 不含端点 `(-5,5)`、`(15,5)`，但 **包含** 穿过正方形边界的那两个点 `(0,5)`、`(10,5)`——它们在线的内部，只是恰好在 B 的 boundary 上。这就是为什么 `A.I ∩ B.B = 0` 而非 `F`。
:::

## 自定义谓词：用 Relate

标准谓词不够用？直接写 DE-9IM 模式：

```csharp
// 检查 A 的内部接触 B 的边界但不进入 B 的内部
// 模式：A.I ∩ B.I = F, A.I ∩ B.B = T
bool result = a.Relate(b, "FT*******");
```

实际场景示例：判断一条线是否 **从外部终止于多边形边界**（不进入内部，有部分在外部，端点落在边界上）：

```csharp
// 模式 F*T*T**** 解读：
//   A.I ∩ B.I = F  —— 线内部不进入多边形内部
//   A.I ∩ B.E = T  —— 线内部有部分在外部（确保线不是全在边界上）
//   A.B ∩ B.B = T  —— 端点落在多边形边界上
bool stopsAtBoundary = line.Relate(poly, "F*T*T****");
```

对应几何：线 `(5,0)→(5,-5)`，多边形 `[0,10]×[0,10]`。线一端 `(5,0)` 落在多边形下边界，另一端 `(5,-5)` 在外部，线本身不进入内部——矩阵为 `FF1F00212`，匹配 `F*T*T****`。

## 解读数据库的 ST_Relate

PostGIS / SQL Server 的 `ST_Relate` 返回的就是 DE-9IM 矩阵字符串，与 NTS 的 `IntersectionMatrix.ToString()` 完全一致：

```sql
SELECT ST_Relate(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
  ST_GeomFromText('POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))')
);
-- 返回: 212101212（部分重叠）
```

常见矩阵速查：

| 矩阵 | 关系解读 |
| --- | --- |
| `FF2FF1212` | 两个不交多边形 |
| `FF2F11212` | 相邻多边形共享边 |
| `212101212` | 部分重叠多边形 |
| `0F2FF1FF2` | 多边形包含点（点在内部） |
| `F0FFFF212` | 点在多边形边界（A=点, B=面） |
| `101FF0212` | 线穿过多边形 |
| `1FF0FF212` | 线完全在多边形内部 |
| `0F1FF0102` | 两条线相交于一点 |
| `2FF1FF212` | 小多边形在大多边形内（Within） |
| `2FFF1FFF2` | 两几何拓扑相等 |

::: tip 用静态 Matches 直接判断数据库输出
从数据库读出 `ST_Relate` 字符串后，不必创建几何对象，直接用 `IntersectionMatrix.Matches(matrix, pattern)` 判断关系：

```csharp
// 从 PostGIS 读出的 relate 字符串
string relate = reader.GetString(0);   // 如 "FF2F11212"
if (IntersectionMatrix.Matches(relate, "FF*FF****"))
    // 相邻但不重叠
```
:::

## 实战：自定义"内部相切"谓词

假设你要判断：A 的边界与 B 的边界相切（共享部分边界），但 A 的内部完全在 B 内部。标准谓词没有现成的：

```csharp
public static bool InternallyTangent(Geometry a, Geometry b)
{
    // A.I ∩ B.E = F  —— A 内部不在 B 外部（A 内部全在 B 内）
    // A.B ∩ B.B = T  —— 边界共享
    return a.Relate(b, "**F*T****");
}
```

对应几何：A = `[0,10]×[0,10]`，B = `[0,20]×[0,10]`。A 完全在 B 内，且共享左边 `x=0`——矩阵为 `2FF11F212`，匹配 `**F*T****`。

## 工具函数：解读矩阵

写一个辅助函数，把矩阵字符串翻译成中文描述：

```csharp
static string Describe(string matrix)
{
    var sb = new StringBuilder();
    string[] labels = { "A内×B内", "A内×B边", "A内×B外",
                        "A边×B内", "A边×B边", "A边×B外",
                        "A外×B内", "A外×B边", "A外×B外" };
    for (int i = 0; i < 9; i++)
    {
        char c = matrix[i];
        string dim = c switch
        {
            'F' => "无交集",
            '0' => "点集",
            '1' => "线集",
            '2' => "面集",
            _ => c.ToString()
        };
        sb.AppendLine($"{labels[i]}: {dim}");
    }
    return sb.ToString();
}
```

## 常见几何对的矩阵

下面是几组经典几何对的 DE-9IM（均通过 NTS/GEOS 验证），用来建立直觉：

| 关系 | A | B | DE-9IM |
| --- | --- | --- | --- |
| 两个不交多边形 | `[0,10]×[0,10]` | `[20,30]×[0,10]` | `FF2FF1212` |
| 相邻多边形（共享边） | `[0,10]×[0,10]` | `[10,20]×[0,10]` | `FF2F11212` |
| 部分重叠多边形 | `[0,10]×[0,10]` | `[5,15]×[5,15]` | `212101212` |
| 多边形包含点（点在内部） | `[0,10]×[0,10]` | `(5,5)` | `0F2FF1FF2` |
| 点在多边形边界 | `(0,5)` | `[0,10]×[0,10]` | `F0FFFF212` |
| 线穿过多边形 | `(-5,5)-(15,5)` | `[0,10]×[0,10]` | `101FF0212` |
| 线完全在多边形内 | `(2,5)-(8,5)` | `[0,10]×[0,10]` | `1FF0FF212` |
| 两条线相交 | `(0,0)-(10,10)` | `(0,10)-(10,0)` | `0F1FF0102` |
| 面包含面（小在内不碰边） | `[0,20]×[0,20]` | `[5,10]×[5,10]` | `212FF1FF2` |
| 两多边形相等 | `[0,10]×[0,10]` | `[0,10]×[0,10]` | `2FFF1FFF2` |

::: warning 注意 A、B 的顺序
DE-9IM 矩阵 **不对称**：`A.Relate(B)` 与 `B.Relate(A)` 通常不同。例如"点在面内" `0FFFFF212`（A=点,B=面）与"面包含点" `0F2FF1FF2`（A=面,B=点）互为转置。调换 A、B 时，矩阵需转置（行列互换）。
:::

## DE-9IM 是数学，不是魔法

::: warning 不要过度依赖 DE-9IM
虽然 DE-9IM 能表达任意二元关系，但大部分实际需求用标准谓词就够了。直接用 DE-9IM 模式会让代码可读性下降。**只在标准谓词不能精确表达时**才用模式字符串，并在代码中注释每个 `T/F` 位置的语义。
:::

## 小结速查表

| 概念 / API | 关键点 |
| --- | --- |
| 矩阵结构 | 3×3，行=A 的 I/B/E，列=B 的 I/B/E，按行优先 9 字符 |
| cell 取值 | `F`(=-1 空) / `0`(点) / `1`(线) / `2`(面) |
| 通配符 | `T`(非空) `F`(空) `*`(任意) `0/1/2`(精确维度) |
| `Relate(g)` | 返回 `IntersectionMatrix` 完整矩阵 |
| `Relate(g, pattern)` | 按模式判断，返回 `bool` |
| `matrix[row, col]` | 索引器，读写单个 cell（`Location` 枚举） |
| `matrix.Is(r,c,dim)` | 判断 cell 是否等于指定维度（空用 `-1`） |
| `matrix.Matches(pattern)` | 实例模式匹配 |
| `IntersectionMatrix.Matches(s, p)` | 静态匹配，直接处理字符串 |
| `matrix.ToString()` | 9 字符序列化，等价于 PostGIS `ST_Relate` |
| `matrix.Set(r,c,dim)` | 设置 cell；另有 `SetAtLeast`、`SetAll` |
| 标准 Contains | `T*****FF*` |
| 标准 Within | `T*F**F***` |
| 标准 Disjoint | `FF*FF****` |
| 标准 Intersects | `T********`（任一非空） |
| 标准 Equals | `T*F**FFF*` |

**选型建议**：

- 日常关系判断 → 优先用 [标准谓词](./relationships.md)，`Covers`/`CoveredBy` 更符合直觉
- 标准谓词无法精确表达 → `Relate(g, pattern)` 自定义
- 诊断"为什么谓词返回 false" → `Relate(g).ToString()` 看矩阵
- 数据库 `ST_Relate` 字符串 → `IntersectionMatrix.Matches(s, pattern)` 直接判断

## 下一步

- [空间关系与谓词](./relationships.md)：回顾八大谓词的签名与陷阱
- [PreparedGeometry](../advanced/prepared-geometry.md)：同一几何多次谓词判定的性能优化
- [空间索引 STRtree](../advanced/spatial-index.md)：批量谓词查询的加速结构
- [几何属性](../core/geometry-properties.md)：几何自身的 interior/boundary/exterior 与度量
