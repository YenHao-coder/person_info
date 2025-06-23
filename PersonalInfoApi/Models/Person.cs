using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PersonalInfoApi.Models{
    [Table("Person")] // 明確指定對應的資料庫表名
    public class Person{
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public required string Name { get; set; }

        [Required]
        [MaxLength(255)]
        [EmailAddress] // 提供 Email 格式驗證
        public required string Email { get; set;}

        [Required]
        [Column(TypeName = "DATE")] // 確保對應到 MySQL 的 DATE 類型
        public DateTime DateOfBirth { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; } //Nullable 類型，對應可選欄位

        [MaxLength(50)]
        public string? PhoneNumber { get; set; } //Nullable 類型

        [MaxLength(10)]
        public string? Gender { get; set; } //Nullable 類型

        public DateTime? LastModified { get; set; } //Nullable 類型，對應資料庫可 NULL

        [Required]
        [MaxLength(20)]
        public string Version { get; set; } = "1.0.0"; //預設值與資料庫一致

        //舊版資料欄位
        [MaxLength(255)]
        public string? OldName { get; set; }
        [MaxLength(255)]
        public string? OldEmail { get; set; }
        [Column(TypeName = "DATE")]
        public DateTime? OldDateOfBirth { get; set; }
        [MaxLength(500)]
        public string? OldAddress { get; set; }
        [MaxLength(50)]
        public string? OldPhoneNumber { get; set; }
        [MaxLength(10)]
        public string? OldGender { get; set; }
        public DateTime? OldModifiedDate { get; set; }
    }
}