using Microsoft.EntityFrameworkCore;
using PersonalInfoApi.Models; // Person 模型在 Models 資料夾中

namespace PersonalInfoApi.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // 讓 Entity Framwork Core 知道 Person 表
        public DbSet<Person> Persons { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // 可以選擇在此處進一步配置，例如欄位約束等
            // 如果需要更詳細的配置，例如指定表名，可以在這裡做
            // modelBuilder.Entity<Person>().ToTable("person_table");
        }
    }
}