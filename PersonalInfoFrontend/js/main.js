const app = Vue.createApp({
  data() {
    return {
      persons: [], // 用於儲存從後端獲取的個人資料列表
      isLoadingData: false, // 用於列表數據加載狀態
      isLoading: false, // 用於表單提交狀態
      errorMessage: "", //錯誤訊息
      successMessage: "", // 成功訊息
      backendApiUrl: "http://localhost:5098/api/Persons", //後端 API 的 URL
      newPerson: {
        // 用於表單數據綁定
        name: "",
        email: "",
        dateOfBirth: "",
        address: "",
        phoneNumber: "",
        gender: "",
      },
      // 用於編輯的數據模型
      editingPerson: null, // 儲存當前編輯的 person 數據
      isediting: false, // 標誌是否處於編輯狀態
      originalPersonData: null, // 儲存編輯前原始數據，方便比對
      searchQuery:'',
      
    };
  },
  methods: {
    //獲取所有個人資料的方法
    async fetchPersons(searchString = '') {
      this.isLoadingData = true; // 開始加載，顯示加載動畫
      this.errorMessage = ""; // 清除之前的錯誤訊息
      this.successMessage = ""; // 清除成功訊息
      try {
        let url = `${this.backendApiUrl}`;
        if(searchString){
          // 若有搜尋字串，則添加到 URL 查詢參數
          // encodeURIComponent 用於確保搜尋字串中的特殊字元被正確編碼
          url += `?searchString=${encodeURIComponent(searchString)}`;
        }
        // 使用 fetch API 發送 GET 請求
        const response = await fetch(url);

        if (!response.ok) {
          // 如果 HTTP 狀態碼不是 2XX
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json(); // 解析 JSON 響應
        this.persons = data; // 更新 persons 數據
        console.log("成功獲取個人資料:", this.persons);
      } catch (error) {
        console.error("獲取個人資料失敗:", error);
        this.errorMessage = `無法加載資料: ${error.message}`; //顯示錯誤訊息給使用者
      } finally {
        this.isLoadingData = false; // 加載結束，無論成功或失敗
      }
    },
    // 新增個人資料的方法
    async addPerson() {
      this.isLoading = true; // 開始提交，禁用按鈕並顯示加載動畫
      this.errorMessage = "";
      this.successMessage = "";

      // 簡單的客戶端驗證
      if (
        !this.newPerson.name ||
        !this.newPerson.email ||
        !this.newPerson.dateOfBirth
      ) {
        this.errorMessage = "姓名、Email 和生日為必填欄位。";
        this.isLoading = false;
        return;
      }

      // 檢查 email 格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.newPerson.email)) {
        this.errorMessage = "請輸入有效的 Email 格式。";
        this.isLoading = false;
        return;
      }

      try {
        const response = await fetch(this.backendApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // 將 newPerson 物件轉換為 JSON 字串發送後端
          body: JSON.stringify(this.newPerson),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        const addedPerson = await response.json(); // 後端通常會返回新增的物件
        this.persons.push(addedPerson); // 將新增的資料加到列表中
        this.successMessage = `資料新增成功! Id: ${addedPerson.id}`;
        this.resetForm();
        console.log("個人資料新增成功:", addedPerson);

        // 如果數據複雜或有分頁，則須重新拉取
        this.fetchPersons();
      } catch (error) {
        console.error("新增個人資料失敗:", error);
        this.errorMessage = `新增資料失敗: ${error.message}`;
      } finally {
        this.isLoading = false; // 提交結束
        // 清除訊息
        setTimeout(() => {
          this.successMessage = "";
          this.errorMessage = "";
        }, 5000);
      }
    },
    // 清空表單的方法
    resetForm() {
      this.newPerson = {
        name: "",
        email: "",
        dateOfBirth: "",
        address: "",
        phoneNumber: "",
        gender: "",
      };
      this.successMessage = "";
      this.errorMessage = "";
    },
    // 將個人資料載入編輯表單方法
    editPerson(person) {
      // 深備份原始資料，避免修改列表
      this.editingPerson = JSON.parse(JSON.stringify(person));

      // DateOfBirth 轉換為 "YYYY-MM-DD" 格式，以正確顯示在 type="date" 的 input 中
      if (this.editingPerson.dateOfBirth) {
        const date = new Date(this.editingPerson.dateOfBirth);
        this.editingPerson.dateOfBirth = date.toISOString().split("T")[0];
      }

      this.isediting = true; // 進入編輯模式
      this.originalPersonData = JSON.parse(JSON.stringify(person)); // 儲存原始資料提供比對
      this.errorMessage = ""; // 清除錯誤訊息
      this.successMessage = ""; // 清除成功訊息
      console.log("準備編輯", this.editingPerson);

      // 顯示編輯模態框
      const editModal = new bootstrap.Modal(
        document.getElementById("editPersonModal")
      );
      editModal.show();
    },
    // 查看個人資料方法
    viewPerson(person) {
      alert(
        `查看個人資料:\n姓名: ${person.name}\nEmail: ${
          person.email
        }\n生日: ${this.formatDate(person.dateOfBirth)}`
      );
      console.log("查看", person);
    },
    // 取修編輯資料，清空編輯表單數據並隱藏模態框
    cancelEdit() {
      this.editingPerson = null;
      this.isediting = false;
      this.originalPersonData = null;
      this.errorMessage = "";
      this.successMessage = "";
      console.log("取消編輯。");

      const editModalElement = document.getElementById("editPersonModal");
      const modalInstance = bootstrap.Modal.getInstance(editModalElement);
      if (modalInstance) {
        modalInstance.hide();
      }
    },
    // 格式化日期的方法
    formatDate(dateString) {
      if (!dateString) return "無";
      const options = { year: "numeric", month: "long", day: "numeric" };
      // 由於後端傳回的可能是 ISO 格式字串，直接傳入 Date 構造函數即可
      return new Date(dateString).toLocaleDateString("zh-TW", options);
    },
    // 清除訊息的通用方法
    clearMessages() {
      setTimeout(() => {
        this.errorMessage = "";
        this.successMessage = "";
      }, 5000);
    },
    // 更新個人資料 後端 API PUT
    async updatePerson() {
      this.isLoading = true;
      this.errorMessage = "";
      this.successMessage = "";

      // 客戶端驗證
      if (
        !this.editingPerson.name ||
        !this.editingPerson.email ||
        !this.editingPerson.dateOfBirth
      ) {
        this.errorMessage = "姓名、Email 和生日為必填欄位。";
        this.isLoading = false;
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.editingPerson.email)) {
        this.errorMessage = "請輸入有效的 Email 格式。";
        this.isLoading = false;
        return;
      }

      try {
        // 發送 PUT 請求到後端 API
        const response = await fetch(
          `${this.backendApiUrl}/${this.editingPerson.id}`,
          {
            method: "PUT", // PUT 方法
            headers: {
              "Content-Type": "application/json",
            },
            // 將 editingPerson 物件轉換為 JSON 字串發送到後端
            body: JSON.stringify(this.editingPerson),
          }
        );

        if (!response.ok) {
          // 若響應不是 2xx 成功狀態碼
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        // PUT 返回 204 No Content
        // 手動更新前端列表中的數據，版本號與 LastModified 是後端生成

        // 尋找列表中要更新的原始數據索引
        const index = this.persons.findIndex(
          (p) => p.id === this.editingPerson.id
        );
        if (index !== -1) {
          // 重新從後端獲取最新的數據更新列表
          // 確保前端顯示的是後端處理後的版本浩和 LastModified
          const updatePersonResponse = await fetch(
            `${this.backendApiUrl}/${this.editingPerson.id}`
          );
          if (updatePersonResponse.ok) {
            const updatePersonData = await updatePersonResponse.json();
            this.persons[index] = updatePersonData; // 後端返回的數據更新列表
            this.successMessage = `資料更新成功! ID: ${updatePersonData.id}，新版本: ${updatePersonData.version}`;
          } else {
            // 如果獲取失敗，顯示更新成功的提示，但數據可能不是最新
            this.successMessage = `資料更新成功! 但列表可能未能即時更新。`;
            console.warn(
              "重新獲取更新後的資料失敗: ",
              updatePersonResponse.statusText
            );
            this.fetchPersons();
          }
        }

        this.cancelEdit(); // 更新後關閉模態框並清空數據
        console.log("個人資料更新成功:", this.editingPerson);
      } catch (error) {
        console.error("更新個人資料失敗:", error);
        this.errorMessage = `資料更新失敗! ${error.message}`;
      } finally {
        this.isLoading = false;
        this.clearMessages();
      }
    },
    // 彈出確認框以刪除個人資料
    confirmDelete(id) {
        if (id === null || id === undefined) {
        console.error("嘗試刪除時，ID 無效。");
        this.errorMessage = "無法刪除：資料ID缺失。";
        this.clearMessages(); // 清除錯誤訊息
        return;
    }
      if (confirm(`您確定要刪除 ID 為 ${id} 的個人資料嗎？此操作不可恢復！`)) {
        this.deletePerson(id); // 如果確認則執行刪除
      }
    },
    // 執行刪除個人資料的後端請求
    async deletePerson(id) {
      this.isLoading = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const response = await fetch(
          `${this.backendApiUrl}/${id}`,
          {
            method: "DELETE",
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }
        // 刪除成功後，從列表上移除
        this.persons = this.persons.filter((person) => person.id !== id);
        this.successMessage = `ID 為 ${id} 的個人資料以成功刪除。`;
        console.log(`個人資料 ID: ${id} 已刪除。`);
      } catch (error) {
        console.error("刪除個人資料失敗:", error);
        this.errorMessage = `刪除資料失敗: ${error.message}`;
      } finally {
        this.isLoading = false;
        this.clearMessages();
      }
    },
    // 執行搜尋的方法
    performSearch() {
      // 調用 fetchPersons 並傳入 searchQuery 的值
      this.fetchPersons(this.searchQuery);
    },
    // 清除搜尋並重新加載所有資料的方法
    clearSearch() {
      this.searchQuery = ''; // 清空搜尋輸入框綁定的值
      this.fetchPersons(); //獲取所有資料
    },
  },
  // 在組件掛載後立即調用 fetchPersons 方法
  mounted() {
    this.fetchPersons();
    console.log("前端 Vue.js 應用程式已掛載，並嘗試加載資料。");
  },
});

app.mount("#app");
