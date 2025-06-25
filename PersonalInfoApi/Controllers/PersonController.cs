using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // 引入 EF Core
using PersonalInfoApi.Data; //引入 DbContext
using PersonalInfoApi.Models; // 引入 Person Model
using System;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;

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
        [FromQuery] int pageSize = 10 // 每頁 10 筆
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

        /// <summary>
        /// 獲取個人資料的每月註冊趨勢數據
        /// </summary>
        /// <returns>包含月份標籤和對應新增人數的聚合數據</returns>
        [HttpGet("MonthlyRegistrationTrend")]
        public IActionResult GetMonthlyRegistrationTrend()
        {
            var rawTrendData = _context.Persons.Where(p=>p.CreatedAt != DateTime.MinValue).GroupBy(p=> new {
                Year = p.CreatedAt.Year,
                Month = p.CreatedAt.Month
            }).Select( g => new {
                g.Key.Year,
                g.Key.Month,
                Count = g.Count()
                }).OrderBy(x => x.Year).ThenBy(x => x.Month).ToList();
            
            var labels = new List<string>();
            var data = new List<int>();

            foreach(var item in rawTrendData){
                labels.Add($"{item.Year} - {item.Month}");
                data.Add(item.Count);
            }
            return Ok(new { labels, data });
        }
        /// <summary>
        /// 獲取所有個人資料的附加/歷史欄位數據。
        /// </summary>
        /// <returns>所有個人資料的附加欄位列表。</returns>
        [HttpGet("AdditionalInfo")]
        public async Task<ActionResult<IEnumerable<PersonAdditionalInfoDTO>>> GetPersonsAdditionalInfo()
        {
            var additionalInfoList = await _context.Persons.Select(p => new PersonAdditionalInfoDTO{
                Id = p.Id,
                Name = p.Name,
                LastModified = p.LastModified,
                Version = p.Version,
                OldName = p.OldName,
                OldEmail = p.OldEmail,
                OldDateOfBirth = p.OldDateOfBirth,
                OldAddress = p.OldAddress,
                OldPhoneNumber = p.OldPhoneNumber,
                OldGender = p.OldGender,
                OldModifiedDate = p.OldModifiedDate
            }).ToListAsync();

            return Ok(additionalInfoList);
        }
        /// <summary>
        /// 根據 ID 獲取特定個人資料的附加/歷史欄位數據。
        /// </summary>
        /// <param name="Id">個人資料的 ID。</param>
        /// <returns>指定個人資料的附加欄位數據。</returns>
        [HttpGet("AdditionalInfo/{Id}")]
        public async Task<ActionResult<PersonAdditionalInfoDTO>> GetPersonAdditionalInfoById(int Id)
        {
            var GetPersonsAdditionalInfo = await _context.Persons.Where(p => p.Id == Id).Select(p => new PersonAdditionalInfoDTO{
                Id = p.Id,
                Name = p.Name,
                LastModified = p.LastModified,
                Version = p.Version,
                OldName = p.OldName,
                OldEmail = p.OldEmail,
                OldDateOfBirth = p.OldDateOfBirth,
                OldAddress = p.OldAddress,
                OldPhoneNumber = p.OldPhoneNumber,
                OldGender = p.OldGender,
                OldModifiedDate = p.OldModifiedDate
            }).FirstOrDefaultAsync();

            if(GetPersonsAdditionalInfo == null){return NotFound($"找不到 ID 為 {Id} 的個人資料");}

            return Ok(GetPersonsAdditionalInfo);
        }


        // GET: api/Persons/5
        [HttpGet("{Id}")] // 路由參數 {Id}
        public async Task<ActionResult<Person>> GetPerson(int Id) {
            _logger.LogInformation($"接收到 GetPerson 請求，Id: {Id}。");
            if(_context.Persons == null) {
                _logger.LogWarning("Person 實體集為空。");
                return NotFound(); // 404 Not Found
            }

            var person = await _context.Persons.FindAsync(Id);

            if(person == null) {
                _logger.LogWarning($"未找到 ID 為 {Id} 的個人資料。");
                return NotFound(); // 404 Not Found
            }

            _logger.LogInformation($"成功獲取 ID 為 {Id} 的個人資料。");
            return Ok(person); // 200 Ok
        }
        // PUT: api/Persons/5
        [HttpPut("{Id}")] // 路由參數 {Id}
        public async Task<IActionResult> PutPerson(int Id, Person person) {
            _logger.LogInformation($"接收到 PutPerson 請求，ID: {Id}。");

            // 檢查請求 ID 是否與物件 ID 一致
            if(Id != person.Id) {
                _logger.LogWarning($"請求 ID ({Id}) 與資料物件 ID({person.Id}) 不匹配。");
                return BadRequest("請求 ID與資料物件 ID 不匹配。"); //400 Bad Request
            }
            
            // 確保 Person 實體集不為空
            if(_context.Persons == null) {
                _logger.LogWarning("Persons 實體集為空，無法執行更新操作。");
                return NotFound(); // 404 Not Found
            }
            // 1.從資料庫獲取現有實體，用於比對和更新 Old 欄位
            var existingPerson = await _context.Persons.AsNoTracking().FirstOrDefaultAsync(p => p.Id == Id);
            if(existingPerson == null) {
                _logger.LogWarning($"未找到 ID 為 {Id} 的個人資料，無法更新。");
                return NotFound(); // 404 Not Found
            }
            var minUpdateTime = TimeSpan.FromSeconds(15); // 設定最短更新間隔為 15秒
            if(existingPerson.LastModified.HasValue && (DateTime.UtcNow - existingPerson.LastModified.Value) < minUpdateTime){
                var timeLeft = minUpdateTime - (DateTime.UtcNow - existingPerson.LastModified.Value);
                var timeLeftInSeconds = (int)timeLeft.TotalSeconds;

                _logger.LogWarning($"ID 為 {Id} 的資料更新頻率過高。需等待 {timeLeftInSeconds} 秒後才能再次更新。");
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
                _logger.LogInformation($"成功更新 ID 為 {Id} 的個人資料。新版本: {person.Version}");
            }catch (DbUpdateConcurrencyException ex){ // 處理併發衝突
            if(!PersonExists(Id)) {
                _logger.LogWarning($"嘗試更新 ID 為 {Id} 的資料時，該資料已不存在。");
                return NotFound(); // 404 Not Found
            } else {
                _logger.LogError(ex, $"更新 ID 為 {Id} 的資料時發生併發衝突。");
                throw; // 拋出異常，讓上層處理
            }
            }catch(Exception ex) {
                _logger.LogError(ex, $"更新 ID 為 {Id} 的個人資料時發生錯誤。");
                return StatusCode(500, "更新個人資料時發生內部伺服器錯誤。");
            }

            return NoContent(); // 204 No Content，表示更新成功但無需返回內容 
        }

        // 輔助方法: 檢查 Person 是否存在
        private bool PersonExists(int Id) {
            return (_context.Persons?.Any(e => e.Id == Id)).GetValueOrDefault();
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
                return CreatedAtAction("GetPersons", new {Id = person.Id}, person);
            } 
            catch(Exception ex) {
                _logger.LogError(ex, "新增個人資料時發生錯誤。");
                // 返回 500 Internal Server Error 和錯誤訊息。
                return StatusCode(500, "新增個人資料時發生內部伺服器錯誤。");
            }
        }
        // DELETE: api/Person/5
        [HttpDelete("{Id}")]
        public async Task<IActionResult> DeletePerson(int Id) {
            _logger.LogInformation($"接收到 DeletePerson 請求，ID: {Id}。");

            if(_context.Persons == null) {
                _logger.LogWarning("Persons 實體集為空，無法執行刪除操作。");
                return NotFound();
            }

            var person = await _context.Persons.FindAsync(Id);
            if(person == null) {
                _logger.LogWarning($"未找到 ID 為 {Id} 的個人資料，無法刪除。");
                return NotFound();
            }
            
            _context.Persons.Remove(person); // 從資料中移除實體
            await _context.SaveChangesAsync(); // 將變更保存到資料庫

            _logger.LogInformation($"成功刪除 ID 為 {Id} 的個人資料。");
            return NoContent(); // 204
        }
        // POST: api/Persons/BulkDelete
        [HttpPost("BulkDelete")] // 定義路由為 /api/Persons/BulkDelete
        public async Task<IActionResult> BulkDeletePersons([FromBody] List<int> ids)
        {
            _logger.LogInformation($"接收到 BulkDeletePersons 請求，待刪除 ID 數量: {ids?.Count ?? 0}。");

            if (_context.Persons == null)
            {
                _logger.LogWarning("Persons 實體集為空，無法執行批量刪除操作。");
                return NotFound();
            }

            if (ids == null || !ids.Any())
            {
                _logger.LogWarning("批量刪除請求中未提供任何 ID。");
                return BadRequest("請提供要刪除的個人資料 ID 列表。");
            }

            // 1. 查詢所有要刪除的實體
            // 使用 Contains 查詢所有符合 ID 的 Person 物件
            var personsToDelete = await _context.Persons
                                                .Where(p => ids.Contains(p.Id))
                                                .ToListAsync();

            if (!personsToDelete.Any())
            {
                _logger.LogWarning("批量刪除請求中，提供的 ID 在資料庫中均未找到。");
                return NotFound("未找到任何符合條件的個人資料進行刪除。");
            }

            // 2. 從資料庫上下文中移除這些實體
            _context.Persons.RemoveRange(personsToDelete); // 使用 RemoveRange 進行批量移除

            // 3. 保存變更到資料庫
            try
            {
                var deletedCount = await _context.SaveChangesAsync(); // 返回實際刪除的記錄數
                _logger.LogInformation($"成功批量刪除 {deletedCount} 筆個人資料。");
                // 根據前端期望，可以返回 200 OK 或 204 No Content
                // 返回 200 OK 且帶有成功訊息可能對前端更友好
                return Ok(new { message = $"成功刪除 {deletedCount} 筆個人資料。", deletedCount = deletedCount });
                // 如果前端不關心具體刪除了幾筆，也可以返回 NoContent()
                // return NoContent(); // 204 No Content
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "執行批量刪除時發生錯誤。");
                // 返回 500 Internal Server Error
                return StatusCode(500, $"批量刪除失敗: {ex.Message}");
            }        
        }      
        
        [HttpPost("BulkCreate")] // 定義路由為 /api/Persons/BulkCreate
        public async Task<IActionResult> BulkCreatePersons([FromBody] List<Person> persons)
        {
            _logger.LogInformation($"接收到 BulkAddPersons 請求，待新增資料數量: {persons?.Count ?? 0}。");

            if (_context.Persons == null)
            {
                _logger.LogWarning("Persons 實體集為空，無法執行批量新增操作。");
                return NotFound("資料庫實體集未準備好。");
            }

            if (persons == null || !persons.Any())
            {
                _logger.LogWarning("批量新增請求中未提供任何資料。");
                return BadRequest("請提供要新增的個人資料列表。");
            }

            // 驗證並準備要新增的資料
            foreach (var person in persons)
            {
                // 在這裡可以加入更詳細的伺服器端驗證邏輯
                // 例如：檢查必填欄位是否為空、Email 格式、生日範圍等
                // 如果驗證失敗，你可以選擇：
                // 1. 返回 BadRequest 並指出哪些資料有問題
                // 2. 忽略無效資料，只處理有效資料
                // 3. 拋出異常，回滾整個批量操作

                // 保持與單筆新增一致的邏輯：設置初始值和清空舊資料欄位
                if (person.Version == null)
                {
                    person.Version = "1.0.0"; // 初始版本
                }
                person.LastModified = DateTime.UtcNow;

                person.OldName = null;
                person.OldEmail = null;
                person.OldDateOfBirth = null;
                person.OldPhoneNumber = null;
                person.OldAddress = null;
                person.OldGender = null;
                person.OldModifiedDate = null;

                // **重要：將 Id 設為 0**
                // 由於 Id 是 DatabaseGeneratedOption.Identity，EF Core 會自動處理主鍵。
                // 如果前端傳了 Id，它可能是一個舊的或無效的值，設置為 0 可以確保 EF Core 正確生成新的 Id。
                // 雖然大多數情況下 EF Core 會忽略傳入的 Id 並自動生成，但明確設置為 0 更安全。
                person.Id = 0;
            }

            try
            {
                // 使用 AddRange 進行批量添加
                _context.Persons.AddRange(persons);
                var addedCount = await _context.SaveChangesAsync(); // 保存所有變更

                _logger.LogInformation($"成功批量新增 {addedCount} 筆個人資料。");
                // 返回 200 OK，包含成功訊息和實際新增的筆數
                return Ok(new { message = $"成功新增 {addedCount} 筆個人資料。", addedCount = addedCount });
            }
            catch (DbUpdateException dbEx) // 捕獲資料庫更新相關異常
            {
                _logger.LogError(dbEx, "批量新增個人資料時發生資料庫更新錯誤。");
                // 可以嘗試解析 DbUpdateException 以提供更具體的錯誤訊息
                return StatusCode(500, $"資料庫錯誤: 無法新增部分或全部資料。詳細: {dbEx.Message}");
            }
            catch (Exception ex) // 捕獲其他一般異常
            {
                _logger.LogError(ex, "執行批量新增時發生未知錯誤。");
                // 返回 500 Internal Server Error
                return StatusCode(500, $"批量新增失敗: {ex.Message}");
            }
        }
    }
}