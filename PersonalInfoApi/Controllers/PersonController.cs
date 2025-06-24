using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // 引入 EF Core
using PersonalInfoApi.Data; //引入 DbContext
using PersonalInfoApi.Models; // 引入 Person Model
using System;
using System.Linq;
using System.Collections.Generic;

namespace PersonalInfoApi.Controllers {
    [ApiController]
    [Route("api/[controller]")] // 定義 API 路徑為 /api/Persons
    public class PersonsController : ControllerBase {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PersonsController> _logger; // 引入日誌

        public PersonsController(ApplicationDbContext context, ILogger<PersonsController> logger) {
            _context = context;
            _logger = logger;
        }

        // GET: api/Persons
        // 這個方法現在同時處理獲取所有資料和帶搜尋參數的請求
        [HttpGet]
        public async Task<ActionResult<PagedResult<Person>>> GetPersons([FromQuery] string? searchString, [FromQuery] int pageNumber = 1, // 頁碼 1 
        [FromQuery] int pageSize = 5 // 每頁 5 筆
        ) {
            _logger.LogInformation($"接收到 GetPersons 請求。搜尋字串: '{searchString ?? "無"}', 頁碼: {pageNumber}, 每頁筆數: {pageSize}。");

            if(_context.Persons == null) {
                _logger.LogWarning("Person 實體集為空，無法獲取個人資料");
                return NotFound();
            }

            // 1. 應用搜尋篩選
            IQueryable<Person> persons = _context.Persons;
            // 若提供搜尋字串，則進行模糊搜尋
            if(!string.IsNullOrWhiteSpace(searchString)) {
                // 執行不區分大小寫得模糊搜尋，搜尋姓名或 Email
                persons = persons.Where(p => p.Name != null && p.Name.Contains(searchString, StringComparison.OrdinalIgnoreCase) || p.Email != null && p.Email.Contains(searchString, StringComparison.OrdinalIgnoreCase));
                _logger.LogInformation($"正在按搜尋字串 '{searchString}' 篩選資料。");
            }
            // 2. 計算總資料筆數 (在分頁之前)
            int totalCount = await persons.CountAsync();

            // 3. 應用分頁邏輯
            // 確保資料有固定排序，分頁結果才一致
            persons = persons.OrderBy(p => p.Id);

            var items = await persons.Skip((pageNumber - 1) * pageSize) // 跳過當前頁面的資料
            .Take(pageSize) // 取出當前頁面資料
            .ToListAsync();

            // 4. 準備分頁結果 DTO 並返回
            var pagedResult = new PagedResult<Person> {
                Items = items,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                // 計算總頁數
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
            _logger.LogInformation($"成功獲取分頁個人資料。總筆數: {totalCount}, 當前頁碼: {pageNumber}, 總頁數: {pagedResult.TotalPages}。");
            return Ok(pagedResult);

            // 假設您想按照某個順序返回，如按 Id 遞增
            // persons = persons.OrderBy(p => p.Id);

            // var result = await persons.ToListAsync();
            // _logger.LogInformation($"成功獲取 {result.Count} 筆個人資料。");
            // return Ok(result);
        }
        // GET: api/Persons
        // [HttpGet]
        // public async Task<ActionResult<IEnumerable<Person>>> GetPersons() {
        //     _logger.LogInformation("接收到 GetPersons 請求。");
        //     try {
        //         var persons = await _context.Persons.ToListAsync();
        //         _logger.LogInformation($"成功獲取{persons.Count} 筆個人資料。");
        //         return Ok(persons); // 返回 200 OK 和資料
        //     }
        //     catch (Exception ex) {
        //         _logger.LogError(ex, "獲取個人資料時發生錯誤。");
        //         // 返回 500 Internal Server Error 和錯誤訊息
        //         return StatusCode(500, "獲取個人資料時發生內部伺服器錯誤。");
        //     }
        // }

        /// <summary>
        /// 獲取個人資料的性別分布數據
        /// </summary>
        /// <returns>包含性別標籤和對應人數的聚合數據</returns>
        [HttpGet("GenderDistribution")]
        public IActionResult GetGenderDistribution() {
            var genderData = _context.Persons.GroupBy( p => p.Gender).Select( g => new {Gender = g.Key, // g.Key 是分組的鍵（性別值）
            Count = g.Count() // g.Count() 是每個分組的計數
            }).ToList();

            var labels = new List<string>();
            var data = new List<int>();

            foreach(var item in genderData){
                // Gender 為 null 或空字串，歸類 "未知"
                labels.Add(string.IsNullOrEmpty(item.Gender) ? "未知" : item.Gender);
                data.Add(item.Count);
            }
            return Ok (new {labels, data});
        }

        /// <summary>
        /// 獲取個人資料的年齡分佈數據
        /// </summary>
        /// <returns>包含年齡區間標籤和對應人數的聚合數據</returns>
        [HttpGet("AgeDistribution")] // 新增的 API 端點路由
        public IActionResult GetAgeDistribution(){
            var ageData = _context.Persons
            .Where(p => p.DateOfBirth != DateTime.MinValue).AsEnumerable()
            .Select(p=>{
                int age = DateTime.Today.Year - p.DateOfBirth.Year;
                if(DateTime.Today < p.DateOfBirth.AddYears(age)) {
                    age--;
                }
                return age;
            }).GroupBy(age => {
                if(age>=0 && age<=18) return "0-18歲";
                else if(age>=19 && age<=35) return "19-35歲";
                else if(age>=36 && age<=50) return "36-50歲";
                else if(age>=51) return "51歲以上";
                else return "未知年齡";
            }).Select(g => new {
                AgeGroup = g.Key,
                Count = g.Count()
            }).ToList();

            var allAgeGroups = new List<string> {"0-18歲", "19-35歲", "36-50歲", "51歲以上"};
            var labels = new List<string>();
            var data = new List<int>();

            foreach (var groupName in allAgeGroups) {
                labels.Add(groupName);
                data.Add(ageData.FirstOrDefault(a =>a.AgeGroup == groupName) ?.Count ?? 0);
            }

            var unknownAgeGroup = ageData.FirstOrDefault(a => a.AgeGroup == "未知年齡");
            if(unknownAgeGroup != null) {
                labels.Add(unknownAgeGroup.AgeGroup);
                data.Add(unknownAgeGroup.Count);
            }
            return Ok(new {labels, data});

        }


        // GET: api/Persons/5
        [HttpGet("{id}")] // 路由參數 {id}
        public async Task<ActionResult<Person>> GetPerson(int id) {
            _logger.LogInformation($"接收到 GetPerson 請求，Id: {id}。");
            if(_context.Persons == null) {
                _logger.LogWarning("Person 實體集為空。");
                return NotFound(); // 404 Not Found
            }

            var person = await _context.Persons.FindAsync(id);

            if(person == null) {
                _logger.LogWarning($"未找到 ID 為 {id} 的個人資料。");
                return NotFound(); // 404 Not Found
            }

            _logger.LogInformation($"成功獲取 ID 為 {id} 的個人資料。");
            return Ok(person); // 200 Ok
        }
        // PUT: api/Persons/5
        [HttpPut("{id}")] // 路由參數 {id}
        public async Task<IActionResult> PutPerson(int id, Person person) {
            _logger.LogInformation($"接收到 PutPerson 請求，ID: {id}。");

            // 檢查請求 ID 是否與物件 ID 一致
            if(id != person.Id) {
                _logger.LogWarning($"請求 ID ({id}) 與資料物件 ID({person.Id}) 不匹配。");
                return BadRequest("請求 ID與資料物件 ID 不匹配。"); //400 Bad Request
            }
            
            // 確保 Person 實體集不為空
            if(_context.Persons == null) {
                _logger.LogWarning("Persons 實體集為空，無法執行更新操作。");
                return NotFound(); // 404 Not Found
            }
            // 1.從資料庫獲取現有實體，用於比對和更新 Old 欄位
            var existingPerson = await _context.Persons.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if(existingPerson == null) {
                _logger.LogWarning($"未找到 ID 為 {id} 的個人資料，無法更新。");
                return NotFound(); // 404 Not Found
            }
            var minUpdateTime = TimeSpan.FromSeconds(15); // 設定最短更新間隔為 15秒
            if(existingPerson.LastModified.HasValue && (DateTime.UtcNow - existingPerson.LastModified.Value) < minUpdateTime){
                var timeLeft = minUpdateTime - (DateTime.UtcNow - existingPerson.LastModified.Value);
                var timeLeftInSeconds = (int)timeLeft.TotalSeconds;

                _logger.LogWarning($"ID 為 {id} 的資料更新頻率過高。需等待 {timeLeftInSeconds} 秒後才能再次更新。");
                // 返回 429 Too Many Requests (或 403, 409)
                Response.Headers["Retry-After"] = timeLeftInSeconds.ToString();
                return StatusCode(429, $"更新頻率過高。請等待 {timeLeftInSeconds} 秒後再嘗試。");
            }
            // 2.比對新舊資料，填充 Old* 欄位
            // 只有新值與舊值不同時，才紀錄舊值
            // 日期需要注意格式，在這裡假設已轉換
            person.OldName = existingPerson.Name != person.Name ? existingPerson.Name : existingPerson.OldName;
            person.OldEmail = existingPerson.Email != person.Email ? existingPerson.Email : existingPerson.OldEmail;
            person.OldDateOfBirth = existingPerson.DateOfBirth != person.DateOfBirth ? existingPerson.DateOfBirth : existingPerson.OldDateOfBirth;
            person.OldAddress = existingPerson.Address != person.Address ? existingPerson.Address : existingPerson.OldAddress;
            person.OldPhoneNumber = existingPerson.PhoneNumber != person.PhoneNumber ? existingPerson.PhoneNumber : existingPerson.OldPhoneNumber;
            person.OldGender = existingPerson.Gender != person.Gender ? existingPerson.Gender : existingPerson.OldGender;

            //3. 更新版本號和 LastModified
            // Version 我們處理為每次修改遞增，可以簡單地將現有版本號轉換為數字後加 0.01
            // 這裡假設 Version 是一個字串， 可以考慮穩健的版本控制策略(如 Semantic Versioning)
            // 為了簡單，我們只是將現有的 Version 設為 OldModifiedDate 的時間戳，並升成一個新的 LastModified 時間
            person.OldModifiedDate = existingPerson.LastModified; // 紀錄上一次修改時間
            person.LastModified = DateTime.UtcNow; // 更新為當前 UTC 時間

            // 簡單的版本號遞增邏輯: 若 version 是 "1.0.0"，則下次是 "1.0.1" 或 "1.1.0"
            // 這裡採用簡單的 parseFloat + 0.01
            if(float.TryParse(existingPerson.Version, out float oldVersionNum)) {
                person.Version = (oldVersionNum + 0.01f).ToString("F2"); // 格式化為兩位小數
            } else {
                person.Version = "1.00"; // 若舊版本號無效則重置
            }

            // 4. 通知 EF Core 該實體已處於修改狀態
            // Attach 和 State = Modified 的組合用於更新一個不被 DbContext 追蹤的實體
            _context.Entry(person).State = EntityState.Modified;

            try {
                await _context.SaveChangesAsync();
                _logger.LogInformation($"成功更新 ID 為 {id} 的個人資料。新版本: {person.Version}");
            }catch (DbUpdateConcurrencyException ex){ // 處理併發衝突
            if(!PersonExists(id)) {
                _logger.LogWarning($"嘗試更新 ID 為 {id} 的資料時，該資料已不存在。");
                return NotFound(); // 404 Not Found
            } else {
                _logger.LogError(ex, $"更新 ID 為 {id} 的資料時發生併發衝突。");
                throw; // 拋出異常，讓上層處理
            }
            }catch(Exception ex) {
                _logger.LogError(ex, $"更新 ID 為 {id} 的個人資料時發生錯誤。");
                return StatusCode(500, "更新個人資料時發生內部伺服器錯誤。");
            }

            return NoContent(); // 204 No Content，表示更新成功但無需返回內容 
        }

        // 輔助方法: 檢查 Person 是否存在
        private bool PersonExists(int id) {
            return (_context.Persons?.Any(e => e.Id == id)).GetValueOrDefault();
        }
        

        // POST: api/Persons
        [HttpPost]
        public async Task<ActionResult<Person>> PostPerson(Person person) {
            _logger.LogInformation("接收到 PostPerson 請求。");

            // 1. 設置初始值 (若前端未提供或資料庫有設置)
            if (person.Version == null) {
                person.Version = "1.0.0"; // 初始版本
            }
            person.LastModified = DateTime.UtcNow;

            // 2. 清空舊資料欄位
            person.OldName = null;
            person.OldEmail = null;
            person.OldDateOfBirth = null;
            person.OldPhoneNumber = null;
            person.OldAddress = null;
            person.OldGender = null;
            person.OldModifiedDate = null;

            try {
                // 存資料庫
                _context.Persons.Add(person);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"成功新增個人資料 Id:{person.Id}。");
                // 返回 201 CreatedAtAction，包含新增的資源和其 URL
                return CreatedAtAction("GetPersons", new {id = person.Id}, person);
            } 
            catch(Exception ex) {
                _logger.LogError(ex, "新增個人資料時發生錯誤。");
                // 返回 500 Internal Server Error 和錯誤訊息。
                return StatusCode(500, "新增個人資料時發生內部伺服器錯誤。");
            }
        }
        // DELETE: api/Person/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePerson(int id) {
            _logger.LogInformation($"接收到 DeletePerson 請求，ID: {id}。");

            if(_context.Persons == null) {
                _logger.LogWarning("Persons 實體集為空，無法執行刪除操作。");
                return NotFound();
            }

            var person = await _context.Persons.FindAsync(id);
            if(person == null) {
                _logger.LogWarning($"未找到 ID 為 {id} 的個人資料，無法刪除。");
                return NotFound();
            }
            
            _context.Persons.Remove(person); // 從資料中移除實體
            await _context.SaveChangesAsync(); // 將變更保存到資料庫

            _logger.LogInformation($"成功刪除 ID 為 {id} 的個人資料。");
            return NoContent(); // 204
        }
        

        
    }
}