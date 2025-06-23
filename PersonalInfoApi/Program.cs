using MySql.Data.MySqlClient; // 確保這個 using 語句在文件開頭
using Microsoft.EntityFrameworkCore; // 引入 Entity Framework Core
using PersonalInfoApi.Data; // 引入DbContext
using PersonalInfoApi.Models; // 引入DbContext
using Pomelo.EntityFrameworkCore.MySql.Infrastructure; // 引入 Pomelo 的基礎設施，用於 ServerVersion
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

// Add serverices to the container.
builder.Services.AddControllers(); // 保持這個，需要 API 控制器
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 啟用 CORS
builder.Services.AddCors(options => {
    // options.AddPolicy("AllowAllOrigins",
    // builder => {
    //     builder.AllowAnyOrigin() // 允許所有來源
    //             .AllowAnyMethod() // 允許所有 HTTP 方法 (GET, POST, PUT, DELETE, OPTIONS等)
    //             .AllowAnyHeader(); // 允許所有請求頭
    // });

    options.AddDefaultPolicy(
        policy =>
        {
            policy.WithOrigins("http://localhost:8080","http://127.0.0.1:8080","http://localhost:5500","http://127.0.0.1:5500") // 允許來自這些來源的請求
             .AllowAnyHeader()
             .AllowAnyMethod(); 
        });
});

// --- 註冊 DbContext 服務 ---

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if(string.IsNullOrEmpty(connectionString))
{
    Console.WriteLine("錯誤: 找不到名為 'DefaultConnection' 的連接字串。請檢查 appsettings.json。");
    // 您可以選擇在這裡 throw new InvalidOperationException() 或直接退出應用程式，以便更快發現問題
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options => {options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),mySqlOptions => mySqlOptions.EnableStringComparisonTranslations());// 確保字元集設定
    });
}
// --- 註冊結束 ---



var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(); // 啟用 CORS 中介軟體


// app.MapGet("/weatherforecast", () =>
// {
//     var forecast =  Enumerable.Range(1, 5).Select(index =>
//         new WeatherForecast
//         (
//             DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
//             Random.Shared.Next(-20, 55),
//             summaries[Random.Shared.Next(summaries.Length)]
//         ))
//         .ToArray();
//     return forecast;
// })
// .WithName("GetWeatherForecast")
// .WithOpenApi();
app.UseAuthorization(); // 如果有，請確保保留
app.MapControllers(); // 確保這行，它會自動映射控制器路由

app.Run();

// record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
// {
//     public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
// }
