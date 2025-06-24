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
      searchQuery: "", // 搜尋字串
      currentPage: 1, // 當前頁碼，預設第一頁
      pageSize: 5, // 每頁顯示資料筆數
      totalItems: 0, // 資料總筆數
      totalPages: 0, // 總頁數
      pageNumbers: [], // 渲染分頁按鈕的頁碼陣列
    };
  },
  methods: {
    //獲取所有個人資料的方法(支援分頁和搜尋)
    async fetchPersons() {
      this.isLoadingData = true; // 開始加載，顯示加載動畫
      this.errorMessage = ""; // 清除之前的錯誤訊息
      this.successMessage = ""; // 清除成功訊息
      try {
        /**
         * 構件帶有搜尋、頁碼和每頁筆數的 URL
         */
        const url = new URL(this.backendApiUrl);
        if (this.searchQuery) {
          url.searchParams.append("searchString", this.searchQuery);
        }
        url.searchParams.append("pageNumber", this.currentPage);
        url.searchParams.append("pageSize", this.pageSize);

        const response = await fetch(url.toString());

        if (!response.ok) {
          // 如果 HTTP 狀態碼不是 2XX
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json(); // 解析 JSON 響應
        this.persons = data.items || []; // 從 response.items 獲取實際的資料陣列

        this.totalItems = data.totalCount || 0;
        this.totalPages = data.totalPages || 0;
        this.currentPage = data.pageNumber || 1;

        // 重新生成分頁按鈕
        this.generatePageNumber();

        console.log("成功獲取個人資料:", this.persons);
        console.log("分頁資訊:", {
          totalItems: this.totalItems,
          totalPages: this.totalPages,
          currentPage: this.currentPage,
          pageSize: this.pageSize,
        });
        showAlert("資料載入成功!", "success");
      } catch (error) {
        console.error("獲取個人資料失敗:", error);
        this.errorMessage = `無法加載資料: ${error.message}`; //顯示錯誤訊息給使用者
        showAlert("載入資料失敗!" + error.message, "danger");
      } finally {
        this.isLoadingData = false; // 加載結束，無論成功或失敗
      }
    },
    // 生成分頁按鈕
    generatePageNumber() {
      this.pageNumbers = [];
      const maxPagesToShow = 5; // 顯示頁碼按鈕最多數量

      let startPage, endPage;

      if (this.totalPages <= maxPagesToShow) {
        // 總頁數不多於限制
        startPage = 1;
        endPage = this.totalPages;
      } else {
        // 總頁數多於限制
        if (this.currentPage <= Math.ceil(maxPagesToShow / 2)) {
          startPage = 1;
          endPage = maxPagesToShow;
        } else if (
          this.currentPage + Math.floor(maxPagesToShow / 2) >=
          this.totalPages
        ) {
          startPage = this.totalPages - maxPagesToShow + 1;
          endPage = this.totalPages;
        } else {
          startPage = this.currentPage - Math.floor(maxPagesToShow / 2);
          endPage = this.currentPage + Math.floor(maxPagesToShow / 2);
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        this.pageNumbers.push(i);
      }
    },
    // 處理頁碼點擊方法
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
        this.currentPage = page;
        this.fetchPersons(); // web reloaded
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
        this.clearMessages(); // clear msg
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
        // this.persons.push(addedPerson);
        this.successMessage = `資料新增成功! Id: ${addedPerson.id}`;
        this.resetForm();
        console.log("個人資料新增成功:", addedPerson);
        // return to page 1 after updating
        this.currentPage = 1;
        // web reloaded
        this.fetchPersons();
      } catch (error) {
        console.error("新增個人資料失敗:", error);
        this.errorMessage = `新增資料失敗: ${error.message}`;
      } finally {
        this.isLoading = false; // request over
        this.clearMessages(); // clear msg
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
      // deeply backup
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
      // clearing msg only as nothing loading
      if (!this.isLoading && !this.isLoadingData) {
        setTimeout(() => {
          this.errorMessage = "";
          this.successMessage = "";
        }, 5000);
      }
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
        this.clearMessages();
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
        // 更新成功後，重新fetch數據，尤其版本號與 LastModified 
        this.successMessage = "資料更新成功!";
        console.log("個人資料更新成功:", this.editingPerson); // hint
        this.cancelEdit(); // modal closed and reset
        this.fetchPersons(); // web reloaded

        

        // 尋找列表中要更新的原始數據索引
        // const index = this.persons.findIndex(
        //   (p) => p.id === this.editingPerson.id
        // );
        // if (index !== -1) {
        //   // 重新從後端獲取最新的數據更新列表
        //   // 確保前端顯示的是後端處理後的版本浩和 LastModified
        //   const updatePersonResponse = await fetch(
        //     `${this.backendApiUrl}/${this.editingPerson.id}`
        //   );
        //   if (updatePersonResponse.ok) {
        //     const updatePersonData = await updatePersonResponse.json();
        //     this.persons[index] = updatePersonData; // 後端返回的數據更新列表
        //     this.successMessage = `資料更新成功! ID: ${updatePersonData.id}，新版本: ${updatePersonData.version}`;
        //   } else {
        //     // 如果獲取失敗，顯示更新成功的提示，但數據可能不是最新
        //     this.successMessage = `資料更新成功! 但列表可能未能即時更新。`;
        //     console.warn(
        //       "重新獲取更新後的資料失敗: ",
        //       updatePersonResponse.statusText
        //     );
        //     this.fetchPersons();
        //   }
        // }
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
        this.clearMessages();
        return;
      }
      if (confirm(`您確定要刪除 ID 為 ${id} 的個人資料嗎？此操作不可恢復！`)) {
        this.deletePerson(id);
      }
    },
    // 執行刪除個人資料的後端請求
    async deletePerson(id) {
      this.isLoading = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const response = await fetch(`${this.backendApiUrl}/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }
        // 刪除成功後，重新 fetch 數據
        
        this.successMessage = `ID 為 ${id} 的個人資料以成功刪除。`;
        console.log(`個人資料 ID: ${id} 已刪除。`);
        this.fetchPersons(); 
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
      // 執行搜尋時，重設回第一頁
      this.currentPage = 1;
      // 調用 fetchPersons 並傳入 searchQuery 的值
      this.fetchPersons(this.searchQuery);
    },
    // 清除搜尋並重新加載所有資料的方法
    clearSearch() {
      this.searchQuery = ""; // 清空搜尋輸入框綁定的值
      this.currentPage = 1;
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

function showAlert(message, type) {
  const alertPlaceholder = document.getElementById('alertPlaceholder');
  if(!alertPlaceholder) return;

  
  if(alertPlaceholder._timer){clearTimeout(alertPlaceholder._timer);alertPlaceholder._timer = null;}
  
  if(alertPlaceholder._transitionEndHandler){alertPlaceholder.removeEventListener('transitionend', alertPlaceholder._transitionEndHandler);alertPlaceholder._transitionEndHandler = null;}

  alertPlaceholder.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = [
    `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`,`<div>${message}</div>`,`<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="close"></button>`,`</div>`
  ].join('');

  alertPlaceholder.append(wrapper);
  
  setTimeout(() => {
    alertPlaceholder.classList.add('active');
  }, 10);

  const alertElement = wrapper.querySelector('.alert');

  setTimeout(() => {    
    if(alertElement) {
      const alert = bootstrap.Alert.getInstance(alertElement);
      if(alert) {
      alert.close();
    } else{
      alertElement.classList.remove('show');
    }
  }
  }, 1800);
  if(alertElement) {
    alertElement.addEventListener('closed.bs.alert', () => {
      wrapper.remove();
      console.log('Inner alert dismissed and removed from DOM.');
    });
  }

  alertPlaceholder._transitionEndHandler = (event) => {
    if(event.propertyName === "top" && !alertPlaceholder.classList.contains('active')) {
      if(alertPlaceholder.children.length === 0){
        alertPlaceholder.innerHTML = '';
      }
      alertPlaceholder.removeEventListener('transitionend', alertPlaceholder._transitionEndHandler);
      alertPlaceholder._transitionEndHandler = null;
    }
  };
  alertPlaceholder.addEventListener('transitionend', alertPlaceholder._transitionEndHandler);
}
