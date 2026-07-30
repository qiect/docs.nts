# DE-9IM 模型

DE-9IM（Dimensionally Extended 9-Intersection Model）是 OGC 标准下"两个几何关系"的数学表达。NTS 的所有谓词——Contains、Within、Intersects……——本质都是 DE-9IM 矩阵的快捷检查。

理解 DE-9IM 让你能：
- 自定义谓词（标准谓词覆盖不到的边界情况）
- 阅读数据库的 `ST_Relate` 输出
- 精确诊断"为什么这两个几何 Contains 返回 false"

## 几何的三部分

回顾一下，每个几何被分为三部分：

| 部分 | 含义 | Polygon | LineString | Point |
| --- | --- | --- | --- | --- |
| Interior (I) | 内部 | 多边形内部区域 | 除端点外的线段 | 点本身 |
| Boundary (B) | 边界 | 外壳 + 孔洞环 | 两个端点 | 空 |
| Exterior (E) | 外部 | 其余所有点 | 其余所有点 | 其余所有点 |

## 3×3 矩阵

DE-9IM 把几何 A 的三部分与几何 B 的三部分两两相交，记录每个交集的 **维度**：

| | B.Interior | B.Boundary | B.Exterior |
| --- | --- | --- | --- |
| **A.Interior** | dim(A.I ∩ B.I) | dim(A.I ∩ B.B) | dim(A.I ∩ B.E) |
| **A.Boundary** | dim(A.B ∩ B.I) | dim(A.B ∩ B.B) | dim(A.B ∩ B.E) |
| **A.Exterior** | dim(A.E ∩ B.I) | dim(A.E ∩ B.B) | dim(A.E ∩ B.E) |

每个 cell 的值是交集的维度：

- `-1`：交集为空（无交点）
- `0`：交集是 Point（点集）
- `1`：交集是 LineString（线集）
- `2`：交集是 Polygon（面集）

把 9 个数字连起来，就得到一个 9 字符的字符串，例如 `212101212`。

## 在 NTS 中获取 DE-9IM

```csharp
using NetTopologySuite.Algorithm;

var a = factory.CreatePolygon(...);
var b = factory.CreatePolygon(...);

IntersectionMatrix matrix = a.Relate(b);
string code = matrix.ToString();   // 如 "212101212"

// 查看每个 cell
matrix[Location.Interior, Location.Interior];  // 2
matrix[Location.Interior, Location.Boundary];  // 1
// ...
```

## 矩阵字符含义

完整字符串 "212101212" 拆开：

```
2 1 2
1 0 1
2 1 2
```

这表示两个相邻多边形（共享一条边）的关系。

## 通配符

在用 `Relate(pattern)` 做谓词判断时，可以用通配符：

| 字符 | 含义 |
| --- | --- |
| `T` | dim ≥ 0（交集非空） |
| `F` | dim = -1（交集为空） |
| `*` | 任意（不关心） |
| `0` | dim = 0（点） |
| `1` | dim = 1（线） |
| `2` | dim = 2（面） |

## 标准谓词的 DE-9IM 等价模式

| 谓词 | DE-9IM 模式 |
| --- | --- |
| Equals | `T*F**FFF*` |
| Disjoint | `FF*FF****` |
| Intersects | `T********` `*T*******` `***T*****` `****T****` (任一) |
| Touches | `FT*******` `F**T*****` `F***T****` |
| Crosses (Line × Line) | `0********` |
| Crosses (Line × Poly) | `T*T******` |
| Within | `T*F**F***` |
| Contains | `T*****FF*` |
| Overlaps (同维度) | `T*T***T**` |
| Covers | `T*TFF*FF*` |
| CoveredBy | `T*FFT**FF` |

::: tip 模式速记
看 `Within` 模式 `T*F**F***`：

- A.I ∩ B.I = T（A 内部在 B 内部）
- A.I ∩ B.E = F（A 内部不在 B 外部）
- A.B ∩ B.E = F（A 边界不在 B 外部）

→ A 完全在 B 内部。
:::

## 自定义谓词：用 Relate

标准谓词不够用？直接写 DE-9IM 模式：

```csharp
// 检查 A 是否"内部接触"B 的边界但不进入 B 的内部
// 模式：A.I ∩ B.I = F, A.I ∩ B.B = T
bool result = a.Relate(b, "FT*******");
```

实际场景示例：判断一条线是否 **终止于** 多边形边界（不进入也不穿过）：

```csharp
// Line.B ∩ Poly.I = F (端点不在内部)
// Line.B ∩ Poly.B = T (端点在边界上)
// Line.I ∩ Poly.I = F (内部不进入多边形)
bool stopsAtBoundary = line.Relate(poly, "**F*F*FF*");
```

## 解读数据库的 ST_Relate

PostGIS / SQL Server 的 `ST_Relate` 返回的就是 DE-9IM 矩阵：

```sql
SELECT ST_Relate(
  ST_GeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'),
  ST_GeomFromText('POLYGON((5 0, 15 0, 15 10, 5 10, 5 0))')
);
-- 返回: 212101212
```

| 矩阵 | 关系解读 |
| --- | --- |
| `FF2FF1212` | 一个多边形包含另一个 |
| `2********` | Intersects |
| `FF*FF****` | Disjoint |
| `212101212` | 相邻多边形共享边 |
| `1*0***102` | 线穿过面 |

## 实战：自定义"内部相切"谓词

假设你要判断：A 的边界与 B 的边界相切（共享部分边界），但 A 的内部完全在 B 内部或外部。标准谓词没有现成的：

```csharp
public static bool InternallyTangent(Geometry a, Geometry b)
{
    // A.I ∩ B.B = F  (A 内部不与 B 边界相交)
    // A.B ∩ B.B = T  (边界共享)
    return a.Relate(b, "**F*T****");
}
```

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

## DE-9IM 是数学，不是魔法

::: warning 不要过度依赖 DE-9IM
虽然 DE-9IM 能表达任意二元关系，但大部分实际需求用标准谓词就够了。直接用 DE-9IM 模式会让代码可读性下降。**只在标准谓词不能精确表达时**才用模式字符串。
:::

## 常见几何对的矩阵

下面是几组经典几何对的 DE-9IM，用来建立直觉：

| 关系 | A | B | DE-9IM |
| --- | --- | --- | --- |
| 两个不交多边形 | 矩形 | 远处的矩形 | `FF2FF2122` |
| 相邻多边形（共享边） | [0,10]×[0,10] | [10,20]×[0,10] | `FF2F11212` |
| 多边形包含点 | [0,10]×[0,10] | (5,5) | `0FFFF2122` |
| 点在多边形边界 | [0,10]×[0,10] | (0,5) | `F0FF21212` |
| 线穿过多边形 | [-5,5]水平线 | [0,10]×[0,10] | `1FF0FF212` |
| 两条线相交 | (0,0)-(10,10) | (0,10)-(10,0) | `0F1FF0102` |

## 小结

- DE-9IM 是 3×3 矩阵，记录两几何 I/B/E 两两交集的维度
- 标准 OGC 谓词都是 DE-9IM 模式的特例
- `Relate(pattern)` 让你写自定义谓词
- 数据库 `ST_Relate` 输出的就是 DE-9IM 字符串
- 实际开发中，**标准谓词 90% 场景够用**，DE-9IM 是诊断工具与扩展能力

## 下一步

- [空间谓词](./relationships.md)：回顾八大谓词
- [PreparedGeometry](../advanced/prepared-geometry.md)：谓词性能优化
- [测量与距离](../analysis/measurement.md)
