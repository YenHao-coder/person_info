namespace PersonalInfoApi.Models {
    public class PagedResult<T> {
        public List<T> Items { get; set; } = new List<T>() ; // 當前頁的資料列表
        public int TotalCount { get; set; } // 所有資料的總筆數
        public int PageNumber { get; set; } // 當前頁碼
        public int PageSize { get; set; } // 每頁筆數
        public int TotalPages { get; set; } // 總頁數
    }
}