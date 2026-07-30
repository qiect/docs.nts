# 快速开始

本页帮助你用 5 分钟跑通第一个 NetTopologySuite 程序。我们覆盖三种最常见场景：控制台程序、ASP.NET Core Web API、以及在 EF Core 中读写 `geometry` 列。

## 环境要求

| 项 | 最低版本 | 推荐版本 |
| --- | --- | --- |
| .NET SDK | .NET 6 | .NET 8 LTS |
| IDE | Visual Studio 2022 / Rider / VS Code | 任意现代 .NET IDE |
| 操作系统 | Windows / Linux / macOS | 跨平台 |

NTS 2.x 同时支持 .NET Framework 4.6.1+、.NET Core 3.1、.NET 5/6/7/8。本教程的所有示例基于 .NET 8。

## 创建项目

```bash
# 1. 新建控制台项目
dotnet new console -n NtsQuickstart
cd NtsQuickstart

# 2. 添加 NTS 主包
dotnet add package NetTopologySuite --version 2.5.0

# 3. （可选）GeoJSON 序列化支持
dotnet add package NetTopologySuite.IO.GeoJSON --version 4.0.0
```

::: tip 版本说明
NTS 主包 `NetTopologySuite` 2.5 是当前的稳定线。IO 子包（GeoJSON/GML/WKB）使用 4.x 版本号体系，与主包兼容。
:::

## 第一个程序：判断点是否在多边形内

把 `Program.cs` 替换为：

```csharp
using NetTopologySuite.Geometries;

// 1. 几何工厂：所有几何对象的"出生地"
var factory = new GeometryFactory();

// 2. 定义一个矩形多边形（围栏）
var coords = new[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)   // 注意：首尾坐标必须相同，构成闭合环
};
var fence = factory.CreatePolygon(coords);

// 3. 测试几个点
Coordinate[] samples =
{
    new(5, 5),     // 内部
    new(15, 5),    // 外部
    new(10, 5)     // 边界
};

foreach (var c in samples)
{
    var p = factory.CreatePoint(c);
    Console.WriteLine($"({c.X},{c.Y})  CoveredBy = {p.CoveredBy(fence)}    Within = {p.Within(fence)}");
}
```

预期输出：

```
(5,5)  CoveredBy = True    Within = True
(15,5) CoveredBy = False   Within = False
(10,5) CoveredBy = True    Within = False
```

注意 `(10,5)`：它在多边形 **边界** 上——`CoveredBy` 返回 `True`，但 `Within` 返回 `False`。这是 OGC 谓词的细节，我们会在 [空间谓词](../predicates/relationships.md) 一节详细解释。

## 在 ASP.NET Core Web API 中使用

GeoJSON 是 Web 地图的标准数据格式。下面演示如何暴露一个返回 GeoJSON 的接口。

```bash
dotnet new webapi -n NtsApi
cd NtsApi
dotnet add package NetTopologySuite.IO.GeoJSON
```

`Program.cs`：

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.GeoJSON;

var builder = WebApplication.CreateBuilder(args);

// 注册 GeoJSON 序列化器
builder.Services.AddSingleton(new GeometryFactory());
builder.Services
    .AddControllers()
    .AddNewtonsoftJson(o =>
    {
        o.SerializerSettings.Converters.Add(new GeometryConverter());
    });

var app = builder.Build();
app.MapControllers();
app.Run();

[ApiController]
[Route("api/[controller]")]
public class ParksController(GeometryFactory factory) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var park = factory.CreatePolygon(new[]
        {
            new Coordinate(116.38, 39.91),
            new Coordinate(116.40, 39.91),
            new Coordinate(116.40, 39.93),
            new Coordinate(116.38, 39.93),
            new Coordinate(116.38, 39.91)
        });

        return Ok(new
        {
            type = "Feature",
            geometry = park,
            properties = new { name = "示例公园" }
        });
    }
}
```

请求 `/api/parks`，你会得到标准的 GeoJSON Feature：

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[116.38,39.91], [116.40,39.91], [116.40,39.93], [116.38,39.93], [116.38,39.91]]]
  },
  "properties": { "name": "示例公园" }
}
```

## 在 EF Core 中读写 geometry 列

最常见的真实场景：把几何对象存到数据库里。以 SQLite 为例：

```bash
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite
```

```csharp
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

public class Place
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public Geometry Location { get; set; } = default!;
}

public class AppDbContext : DbContext
{
    public DbSet<Place> Places => Set<Place>();

    protected override void OnConfiguring(DbContextOptionsBuilder b)
        => b.UseSqlite("Data Source=nts.db;");

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // 显式声明 Location 是 geometry 列
        mb.Entity<Place>().Property(p => p.Location).HasColumnType("geometry");
    }
}

// 使用：
using var db = new AppDbContext();
await db.Database.EnsureCreatedAsync();

db.Places.Add(new Place { Name = "天安门", Location = new Point(116.40, 39.90) });
await db.SaveChangesAsync();

// 查询：5 度范围内的所有地点
var origin = new Point(116.40, 39.90);
var nearby = db.Places
    .Where(p => p.Location.Distance(origin) < 5.0)
    .ToList();
```

::: warning 别忘了空间插件
EF Core 的数据库驱动需要专门的 NTS 插件，才能把 .NET 的 `Geometry` 翻译成 SQL 的空间函数。常见组合：

- SQLite：`Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite`
- PostgreSQL (Npgsql)：`Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`
- SQL Server：原生支持，无需额外插件，但需要 `Microsoft.EntityFrameworkCore.SqlServer`。
:::

## 常见安装问题

### Q: 编译报错 "The type or namespace 'NetTopologySuite' could not be found"

确认包真的安装到了正确项目里。在项目根目录运行 `dotnet list package` 查看。

### Q: 运行报错 "System.TypeLoadException: Could not load GeoAPI"

NTS 2.x 把 GeoAPI 内联到了主包，不再需要单独引用。如果你看到旧教程让你 `dotnet add package GeoAPI`，那是过时的——只装 `NetTopologySuite` 即可。

### Q: 序列化时报循环引用或属性过多

NTS 的 `Geometry` 对象包含大量导航属性。推荐用专门的转换器（`GeometryConverter`、`WKTWriter`、`WKBWriter`），不要直接用 `System.Text.Json` 默认序列化。

## 下一步

- [第一个几何对象](./first-geometry.md)：动手玩转 Point、LineString、Polygon
- [坐标与几何层级](../core/geometry-hierarchy.md)：理解对象模型
- [API 速查表](../cookbook/cheatsheet.md)：常用方法一览
