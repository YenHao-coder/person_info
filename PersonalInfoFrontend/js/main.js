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
      pageSize: 10, // 每頁顯示資料筆數
      totalItems: 0, // 資料總筆數
      totalPages: 0, // 總頁數
      pageNumbers: [], // 渲染分頁按鈕的頁碼陣列

      errors: {
        name: "",
        email: "",
        dateOfBirth: "",
        address: "",
        phoneNumber: "",
        gender: "",
      },
      // 用於儲存編輯表單的驗證錯誤
      editErrors: {
        name: "",
        email: "",
        dateOfBirth: "",
        address: "",
        phoneNumber: "",
        gender: "",
      },
      isBatchDeleteMode: false, // 標誌是否處於批量刪除模式
      isBatchAddMode: false, // 標誌是否處於批量新增模式
      // 每個元素都是一個 Person 物件，包含 isError 和 errorDetails
      batchPersonsToAdd: [],
      // 儲存批量新增表單的驗證錯誤
      batchAddErrors: [], // 預計是一個陣列，每個元素對應 batchPersonsToAdd 的一個物件，包含該行所有欄位的錯誤訊息
      currentSortBy: 'id', // 預設排序欄位，應與後端數據模型中的屬性名稱一致 (小寫)
      currentSortOrder: 'asc', // 預設排序方式 ('asc'/'desc')

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
        this.persons = (data.items || []).map(person => {
        // 如果已經在批量刪除模式，則保持之前的 isSelected 狀態
        // 否則，初始化為 false
        return { ...person, isSelected: this.isBatchDeleteMode ? (person.isSelected || false) : false };
        });

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
    // 列印圖表功能
    printChart() {
      window.print();
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

      if (!this.validateAllFields('newPerson')) {
        showAlert("請檢查表單中的錯誤，並完成必填項目","danger");
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
    // 驗證欄位有效性
    validateField(type, field) {
      const targetObject = type === "newPerson" ? this.newPerson : this.editingPerson;
      const errorObject = type === "newPerson" ? this.errors : this.editErrors;

      errorObject[field] = ""; // 先清除該欄位的錯誤訊息

      switch (field) {
        case "name":
          if (!targetObject.name) {
            errorObject.name = "姓名為必填。";
          } else if (targetObject.name.length < 2) {
            errorObject.name = "姓名至少需要2個字。";
          }
          break;
        case "email":
          if (!targetObject.email) {
            errorObject.email = "Email 為必填。";
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetObject.email)) {
            errorObject.email = "請輸入有效的 Email 格式。";
          }
          break;
        case "dateOfBirth":
          if (!targetObject.dateOfBirth) {
            errorObject.dateOfBirth = "生日為必填。";
          } else {
            const today = new Date();
            const dob = new Date(targetObject.dateOfBirth);
            if (dob > today) {
              errorObject.dateOfBirth = "生日不能晚於今天。";
            }
          }
          break;
        case "address":
          // 地址可以為空，如果非空則長度限制
          if (targetObject.address && targetObject.address.length > 100) {
            errorObject.address = "地址長度不能超過100個字。";
          }
          break;
        case "phoneNumber":
          // 電話可以為空，如果非空則檢查格式 (簡單範例：只允許數字和特定符號)
          if (targetObject.phoneNumber && !/^[0]{1}[9]{1}[0-9]{8}$/.test(targetObject.phoneNumber)) {
            errorObject.phoneNumber = "電話號碼格式不正確。";
          } else if (targetObject.phoneNumber && targetObject.phoneNumber.length < 10) {
            errorObject.phoneNumber = "電話號碼至少需要10位數。";
          }
          break;
        case "gender":
          // 性別可以為空，但如果選擇了無效值也可以提示
          if (targetObject.gender && !['男', '女', '其他', ''].includes(targetObject.gender)) {
            errorObject.gender = "請選擇有效的性別。";
          }
          break;
      }
      this.isLoading = false;
      // 返回驗證結果 (是否有錯誤)
      return Object.values(errorObject).every(msg => msg === "");
    },
    // 驗證所有欄位
    validateAllFields(type) {
        const targetObject = type === "newPerson" ? this.newPerson : this.editingPerson;
        const errorObject = type === "newPerson" ? this.errors : this.editErrors;

        // 重置所有錯誤訊息
        for (const key in errorObject) {
            errorObject[key] = "";
        }

        let isValid = true;
        // 依次驗證每個欄位
        if (!this.validateField(type, "name")) isValid = false;
        if (!this.validateField(type, "email")) isValid = false;
        if (!this.validateField(type, "dateOfBirth")) isValid = false;
        if (!this.validateField(type, "address")) isValid = false;
        if (!this.validateField(type, "phoneNumber")) isValid = false;
        if (!this.validateField(type, "gender")) isValid = false;

        this.isLoading = false;

        return isValid;
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
      for(const key in this.error){
        this.errors[key] = "";
      }
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

      for(const key in this.editErrors){
        this.editErrors[key] = "";
      }

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
      if (!this.validateAllFields('editingPerson')) {
        showAlert("請檢查表單中的錯誤，並完成必填項目。","danger")
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
    // 進入批量刪除模式
    enterBatchDeleteMode() {
      this.isBatchDeleteMode = true;
      // 初始化所有 persons 的 isSelected 狀態為 false
      this.persons.forEach(person => {
        // 使用 Vue.set 確保新增的屬性是響應式的
        if (!person.hasOwnProperty('isSelected')) {
          Vue.set(person, 'isSelected', false);
        } else {
          person.isSelected = false; // 清除之前的選擇狀態
        }
      });
      this.clearMessages(); // 清除可能存在的訊息
      showAlert("已進入批量刪除模式，請選擇要刪除的項目。", "info");
      console.log("進入批量刪除模式");
    },
    // 退出批量刪除模式
    exitBatchDeleteMode() {
      this.isBatchDeleteMode = false;
      // 清除所有 persons 的 isSelected 狀態，或直接移除這個屬性 (取決於需求)
      this.persons.forEach(person => {
        if (person.hasOwnProperty('isSelected')) {
          person.isSelected = false;
        }
      });
      this.clearMessages(); // 清除可能存在的訊息
      showAlert("已退出批量刪除模式。", "info");
      console.log("退出批量刪除模式");
    },
    // 切換單個項目的選中狀態
    togglePersonSelection(person) {
      // 確保 isSelected 屬性已存在且是響應式的
      if (!person.hasOwnProperty('isSelected')) {
        Vue.set(person, 'isSelected', true);
      } else {
        person.isSelected = !person.isSelected;
      }
      console.log(`Person ${person.id} selection: ${person.isSelected}`);
    },
    // 全選/取消全選當前頁面所有項目
    toggleSelectAll() {
      const newSelectedState = !this.isAllSelected;
      this.persons.forEach(person => {
        if (!person.hasOwnProperty('isSelected')) {
          Vue.set(person, 'isSelected', isChecked);
        } else {
          person.isSelected = isChecked;
        }
      });
      console.log(`所有項目已 ${isChecked ? '全選' : '取消全選'}`);
    },
    // 獲取所有選中項目的 ID
    getSelectedPersonIds() {
      return this.persons
        .filter(person => person.isSelected)
        .map(person => person.id);
    },
    // 確認批量刪除
    confirmBulkDelete() {
      const selectedIds = this.getSelectedPersonIds();
      if (selectedIds.length === 0) {
        showAlert("請至少選擇一筆要刪除的資料。", "warning");
        return;
      }
      // 使用原生 confirm 或自訂模態框
      if (confirm(`您確定要刪除選定的 ${selectedIds.length} 筆個人資料嗎？此操作不可恢復！`)) {
        this.bulkDeletePersons(selectedIds);
      }
    },
    // 執行批量刪除的後端請求 (假設後端提供 /api/Persons/BulkDelete API)
    async bulkDeletePersons(ids) {
      this.isLoading = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const response = await fetch(`${this.backendApiUrl}/BulkDelete`, { // 假設 API 端點是 /api/Persons/BulkDelete
          method: "POST", // 批量刪除通常使用 POST，因為會傳遞多個 ID
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids), // 將 ID 陣列作為 JSON 傳遞
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        // 成功後重新載入資料
        this.successMessage = `已成功刪除 ${ids.length} 筆選定的個人資料。`;
        console.log(`成功刪除 ${ids.length} 筆個人資料。`);
        this.fetchPersons(); // 重新獲取並顯示最新的列表
        this.exitBatchDeleteMode(); // 刪除完成後自動退出批量刪除模式
      } catch (error) {
        console.error("批量刪除個人資料失敗:", error);
        this.errorMessage = `批量刪除失敗: ${error.message}`;
      } finally {
        this.isLoading = false;
        this.clearMessages();
      }
    },
    canBulkDelete() {
        return this.isAnySelected;
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
    // 進入批量新增模式
    enterBatchAddMode() {
      this.isBatchAddMode = true;
      this.isBatchDeleteMode = false; // 確保退出批量刪除模式
      this.batchPersonsToAdd = []; // 清空之前的批量新增數據
      this.batchAddErrors = []; // 清空之前的錯誤訊息
      this.addNewPersonRow(); // 預設新增一行空白行
      this.clearMessages();
      showAlert("已進入批量新增模式，請填寫要新增的資料。", "info");
      console.log("進入批量新增模式");
    },
    // 退出批量新增模式
    exitBatchAddMode() {
      this.isBatchAddMode = false;
      this.batchPersonsToAdd = []; // 清空所有資料
      this.batchAddErrors = []; // 清空所有錯誤訊息
      this.clearMessages();
      showAlert("已退出批量新增模式。", "info");
      console.log("退出批量新增模式");
    },
    // 向批量新增表單添加一行空白資料
    addNewPersonRow() {
      if (this.canAddMoreRows) {
        const newPersonTemplate = {
          name: "",
          email: "",
          dateOfBirth: "",
          address: "",
          phoneNumber: "",
          gender: "",
          // 為每一行新增一個 isError 標誌，以及一個 errorDetails 物件
          // isError: false,
          // errorDetails: { name: "", email: "", dateOfBirth: "", address: "", phoneNumber: "", gender: "" }
        };
        this.batchPersonsToAdd.push(newPersonTemplate);
        // 同時為新行添加一個對應的錯誤物件
        this.batchAddErrors.push({ name: "", email: "", dateOfBirth: "", address: "", phoneNumber: "", gender: "" });
        console.log("新增一行空白資料。");
      } else {
        showAlert(`最多只能新增 ${this.pageSize} 筆資料。`, "warning");
      }
    },
    // 從批量新增表單移除指定行的資料
    removePersonRow(index) {
      if (this.batchPersonsToAdd.length > 1) { // 至少保留一行
        this.batchPersonsToAdd.splice(index, 1);
        this.batchAddErrors.splice(index, 1); // 同時移除對應的錯誤物件
        console.log(`移除第 ${index + 1} 行資料。`);
      } else {
        showAlert("至少需要保留一筆資料進行填寫。", "warning");
      }
    },
    // 驗證批量新增的單筆資料
    validateBatchField(index, field) {
        const targetObject = this.batchPersonsToAdd[index];
        const errorObject = this.batchAddErrors[index];

        errorObject[field] = ""; // 先清除該欄位的錯誤訊息

        switch (field) {
            case "name":
                if (!targetObject.name) {
                    errorObject.name = "姓名為必填。";
                } else if (targetObject.name.length < 2) {
                    errorObject.name = "姓名至少需要2個字。";
                }
                break;
            case "email":
                if (!targetObject.email) {
                    errorObject.email = "Email 為必填。";
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetObject.email)) {
                    errorObject.email = "請輸入有效的 Email 格式。";
                }
                break;
            case "dateOfBirth":
                if (!targetObject.dateOfBirth) {
                    errorObject.dateOfBirth = "生日為必填。";
                } else {
                    const today = new Date();
                    const dob = new Date(targetObject.dateOfBirth);
                    if (dob > today) {
                        errorObject.dateOfBirth = "生日不能晚於今天。";
                    }
                }
                break;
            case "address":
                if (targetObject.address && targetObject.address.length > 100) {
                    errorObject.address = "地址長度不能超過100個字。";
                }
                break;
            case "phoneNumber":
                if (targetObject.phoneNumber && !/^[0]{1}[9]{1}[0-9]{8}$/.test(targetObject.phoneNumber)) {
                    errorObject.phoneNumber = "電話號碼格式不正確。";
                } else if (targetObject.phoneNumber && targetObject.phoneNumber.length < 10) {
                    errorObject.phoneNumber = "電話號碼至少需要10位數。";
                }
                break;
            case "gender":
                if (targetObject.gender && !['男', '女', '其他', ''].includes(targetObject.gender)) {
                    errorObject.gender = "請選擇有效的性別。";
                }
                break;
        }
        // 返回驗證結果 (是否有錯誤)
        return Object.values(errorObject).every(msg => msg === "");
    },
    // 驗證批量新增表單中的所有欄位
    validateAllBatchFields() {
        let allValid = true;
        // 清除所有現有的批量新增錯誤訊息
        this.batchAddErrors.forEach(errorObject => {
            for (const key in errorObject) {
                errorObject[key] = "";
            }
        });

        this.batchPersonsToAdd.forEach((person, index) => {
            // 對每一筆資料的每個欄位進行驗證
            if (!this.validateBatchField(index, "name")) allValid = false;
            if (!this.validateBatchField(index, "email")) allValid = false;
            if (!this.validateBatchField(index, "dateOfBirth")) allValid = false;
            if (!this.validateBatchField(index, "address")) allValid = false;
            if (!this.validateBatchField(index, "phoneNumber")) allValid = false;
            if (!this.validateBatchField(index, "gender")) allValid = false;
        });

        // 檢查是否有完全空白的行，如果所有欄位都為空，則不算作有效行
        const nonBlankRows = this.batchPersonsToAdd.filter(person => {
            return Object.values(person).some(value => value !== "" && value !== null);
        });

        if (nonBlankRows.length === 0) {
            showAlert("請至少填寫一筆完整的資料。", "warning");
            allValid = false;
        }

        return allValid;
    },
    // 執行批量新增的後端請求
    async bulkAddPersons() {
      this.isLoading = true;
      this.errorMessage = "";
      this.successMessage = "";

      // 執行客戶端驗證
      if (!this.validateAllBatchFields()) {
        showAlert("請檢查批量新增表單中的錯誤，並完成必填項目。", "danger");
        this.isLoading = false;
        return;
      }

      // 過濾掉完全空白的行（如果用戶新增了多行但沒填寫）
      const validPersonsToSubmit = this.batchPersonsToAdd.filter(person => {
          return Object.values(person).some(value => value !== "" && value !== null);
      });

      if (validPersonsToSubmit.length === 0) {
          showAlert("沒有有效的資料可以提交。請填寫至少一筆資料。", "warning");
          this.isLoading = false;
          return;
      }

      try {
        const response = await fetch(`${this.backendApiUrl}/BulkCreate`, { // 假設 API 端點是 /api/Persons/BulkAdd
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validPersonsToSubmit), // 將 Person 物件陣列作為 JSON 傳遞
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`
          );
        }

        // 後端可能會返回新增成功的筆數或新增的資料列表
        const result = await response.json(); // 假設後端返回 { message: "...", addedCount: X }

        this.successMessage = `成功新增 ${result.addedCount || validPersonsToSubmit.length} 筆個人資料。`;
        console.log(`成功批量新增 ${result.addedCount || validPersonsToSubmit.length} 筆個人資料。`);

        this.fetchPersons(); // 重新獲取並顯示最新的列表
        this.exitBatchAddMode(); // 批量新增完成後自動退出模式
        window.scrollTo(0, 0); // 回到頂端
      } catch (error) {
        console.error("批量新增個人資料失敗:", error);
        this.errorMessage = `批量新增失敗: ${error.message}`;
      } finally {
        this.isLoading = false;
        this.clearMessages();
      }
    },
    // 個人資料表格排序
    toggleSort(columnName) {
      // 確保欄位名稱符合預期，避免錯誤
      const validSortColumns = ['name', 'gender', 'dateOfBirth', 'address', 'email', 'phoneNumber', 'id'];
      if (!validSortColumns.includes(columnName)) {
        console.warn(`不支援對欄位 '${columnName}' 進行排序。`);
        return;
      }

      // 如果點擊的是當前排序的欄位，則切換排序方向
      if (columnName === this.currentSortBy) {
        this.currentSortOrder = (this.currentSortOrder === 'asc') ? 'desc' : 'asc';
      } else {
        // 如果點擊的是不同的欄位，則將其設為新的排序欄位，並預設為升冪
        this.currentSortBy = columnName;
        this.currentSortOrder = 'asc';
      }
    },
    // 更新表格標頭上排序圖標的視覺效果
    updateSortIcons() {
      // 移除所有排序圖標的 class
      document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
          icon.innerHTML = ''; // 清除箭頭
        }
      });

      // 給當前排序的欄位添加對應的 class 和箭頭
      // 注意：這裡使用 data-sort-by 屬性來匹配，確保 HTML 和 JS 一致
      const currentHeader = document.querySelector(`th[data-sort-by="${this.currentSortBy}"]`);
      if (currentHeader) {
        currentHeader.classList.add(this.currentSortOrder);
        const icon = currentHeader.querySelector('.sort-icon');
        if (icon) {
          icon.innerHTML = (this.currentSortOrder === 'asc') ? '&#9650;' : '&#9660;'; // ▲ 或 ▼
        }
      }
    },
    // 用於動態生成 tooltip 文字的方法 
    getSortTooltip(columnName) {
        if (columnName === this.currentSortBy) {
            // 如果是當前排序的欄位，提示下一次點擊會切換方向
            return this.currentSortOrder === 'asc' ? '降冪' : '升冪';
        } else {
            // 如果不是當前排序的欄位，提示下一次點擊會升冪排序
            return '升冪';
        }
    },


  },
  computed:{
    isAllSelected: {
        get() {
            // 只有在批量刪除模式下才進行判斷，且列表不為空
            return (
                this.isBatchDeleteMode &&
                this.persons.length > 0 &&
                this.persons.every((person) => person.isSelected)
            );
        },
        set(value) {
            // 當全選 checkbox 被勾選或取消勾選時，更新所有 person 的 isSelected 狀態
            this.persons.forEach(person => {
                if (!person.hasOwnProperty('isSelected')) {
                    Vue.set(person, 'isSelected', value);
                } else {
                    person.isSelected = value;
                }
            });
            console.log(`所有項目已 ${value ? '全選' : '取消全選'}`);
        }
    },
    // 判斷是否選取待刪除 (至少1筆)
    isAnySelected() {
      return this.persons.some((person) => person.isSelected);
    },
    // 判斷是否達到最大新增數量 (10筆)
    canAddMoreRows() {
      return this.batchPersonsToAdd.length < this.pageSize;
    },
    // --- 新增計算屬性：用於前端排序 ---
    sortedPersons() {
      // 複製一份原始數據，避免直接修改原始 persons 陣列
      const sortablePersons = [...this.persons];

      if (!this.currentSortBy) {
        return sortablePersons; // 如果沒有指定排序欄位，返回原始數據
      }

      // 根據 currentSortBy 和 currentSortOrder 進行排序
      sortablePersons.sort((a, b) => {
        let valA = a[this.currentSortBy];
        let valB = b[this.currentSortBy];

        // 將 null/undefined/空字串視為排序的末尾或開頭
        const isValANullish = (valA === null || valA === undefined || valA === '');
        const isValBNullish = (valB === null || valB === undefined || valB === '');
        if (isValANullish && isValBNullish) {
            return 0; // 兩者都為空，視為相等
        }
        if (isValANullish) {
            return this.currentSortOrder === 'asc' ? 1 : -1; // A 為空，B 不為空，A 靠後
        }
        if (isValBNullish) {
            return this.currentSortOrder === 'asc' ? -1 : 1; // B 為空，A 不為空，B 靠後
        }

        let comparison = 0;

        // 處理日期類型
        if (this.currentSortBy === 'dateOfBirth') {
          const dateA = new Date(valA);
          const dateB = new Date(valB);
          comparison = dateA - dateB;
        }
        // 處理字串類型 (姓名, Email, 地址, 電話, 性別)
        else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB, 'zh-TW', { sensitivity: 'base' }); // 支援中文排序
        }
        // 處理數字類型 (例如 Id)
        else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }
        // 其他未知類型，嘗試通用比較
        else {
          if (valA < valB) comparison = -1;
          else if (valA > valB) comparison = 1;
        }

        return this.currentSortOrder === 'asc' ? comparison : -comparison;
      });

      return sortablePersons;
    },

  },
  // 在組件掛載後立即調用 fetchPersons 方法
  mounted() {
    this.fetchPersons();
    
    console.log("前端 Vue.js 應用程式已掛載，並嘗試加載資料。");
    
  },
});
// 1. 性別分佈圖組件 (GenderChartComponent)
const GenderChartComponent = {
    template: `
        <div class="chart-container">
            <canvas ref="genderChartCanvas"></canvas>
            <div v-if="!chartDataLoaded" class="text-center text-muted mt-3">
                載入性別分佈數據中...
            </div>
            <div v-if="chartError" class="alert alert-danger mt-3" role="alert">
                {{ chartError }}
            </div>
            <div v-if="chartDataLoaded && !chartHasData" class="alert alert-warning mt-3" role="alert">
                目前沒有性別分佈數據可供顯示。
            </div>
        </div>
    `,
    data() {
        return {
            chartInstance: null, // 儲存 Chart.js 實例
            chartDataLoaded: false,
            chartError: '',
            chartHasData: false,
            backendApiUrl: "http://localhost:5098/api/Persons", // API URL
        };
    },
    mounted() {
        this.fetchAndRenderChart();
    },
    methods: {
        async fetchAndRenderChart() {
            this.chartDataLoaded = false;
            this.chartError = '';
            this.chartHasData = false;
            try {
                const response = await fetch(`${this.backendApiUrl}/GenderDistribution`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                console.log("Gender Distribution API Data:", data);

                if (data && data.labels && data.data && data.labels.length > 0) {
                    this.chartHasData = true;
                    this.renderChart(data.labels, data.data);
                } else {
                    this.chartHasData = false;
                }
            } catch (error) {
                console.error("獲取性別分佈數據失敗:", error);
                this.chartError = `載入性別分佈圖表失敗: ${error.message}`;
            } finally {
                this.chartDataLoaded = true;
            }
        },
        renderChart(labels, data) {
            const ctx = this.$refs.genderChartCanvas.getContext('2d');

            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            this.chartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '性別分佈',
                        data: data,
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.6)', // 藍色 for 男
                            'rgba(255, 99, 132, 0.6)', // 紅色 for 女
                            'rgba(255, 206, 86, 0.6)', // 黃色 for 其他
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)',
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: '個人資料性別分佈',
                            font: {
                                size: 18
                            }
                        }
                    }
                }
            });
        }
    },
    // 在組件銷毀前銷毀 Chart 實例，避免內存洩漏
    beforeUnmount() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
    }
};
// 2. 年齡分佈圖組件 (AgeChartComponent)
const AgeChartComponent = {
    template: `
        <div class="chart-container">
            <canvas ref="ageChartCanvas"></canvas>
            <div v-if="!chartDataLoaded" class="text-center text-muted mt-3">
                載入年齡分佈數據中...
            </div>
            <div v-if="chartError" class="alert alert-danger mt-3" role="alert">
                {{ chartError }}
            </div>
            <div v-if="chartDataLoaded && !chartHasData" class="alert alert-warning mt-3" role="alert">
                目前沒有年齡分佈數據可供顯示。
            </div>
        </div>
    `,
    data() {
        return {
            chartInstance: null,
            chartDataLoaded: false,
            chartError: '',
            chartHasData: false,
            backendApiUrl: "http://localhost:5098/api/Persons",
        };
    },
    mounted() {
        this.fetchAndRenderChart();
    },
    methods: {
        async fetchAndRenderChart() {
            this.chartDataLoaded = false;
            this.chartError = '';
            this.chartHasData = false;
            try {
                const response = await fetch(`${this.backendApiUrl}/AgeDistribution`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP 錯誤! 狀態碼: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                console.log("Age Distribution API Data:", data);

                if (data && data.labels && data.data && data.labels.length > 0) {
                    this.chartHasData = true;
                    this.renderChart(data.labels, data.data);
                } else {
                    this.chartHasData = false;
                }
            } catch (error) {
                console.error("獲取年齡分佈數據失敗:", error);
                this.chartError = `載入年齡分佈圖表失敗: ${error.message}`;
            } finally {
                this.chartDataLoaded = true;
            }
        },
        renderChart(labels, data) {
            const ctx = this.$refs.ageChartCanvas.getContext('2d');

            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            this.chartInstance = new Chart(ctx, {
                type: 'bar', // 長條圖類型
                data: {
                    labels: labels,
                    datasets: [{
                        label: '年齡分佈',
                        data: data,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)', // 可以使用單一顏色或多種顏色
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: '個人資料年齡分佈',
                            font: {
                                size: 18
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '人數'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '年齡區間'
                            }
                        }
                    }
                }
            });
        }
    },
    beforeUnmount() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
    }
};
// 3. 趨勢分析圖組件 (TrendChartComponent)
const MonthlyTrendChartComponent = {
    template: `
        <div class="chart-container">
            <canvas ref="monthlyTrendChartCanvas"></canvas>
            <div v-if="!chartDataLoaded" class="text-center text-muted mt-3">
                載入趨勢分析數據中...
            </div>
            <div v-if="chartError" class="alert alert-danger mt-3" role="alert">
                {{ chartError }}
            </div>
            <div v-if="chartDataLoaded && !chartHasData" class="alert alert-warning mt-3" role="alert">
                目前沒有趨勢分析數據可供顯示。
            </div>
        </div>
    `,
    data() {
        return {
            chartInstance: null,
            chartDataLoaded: false,
            chartError: '',
            chartHasData: false,
            backendApiUrl: "http://localhost:5098/api/Persons",
        };
    },
    mounted() {
        this.fetchAndRenderChart();
    },
    methods: {
        async fetchAndRenderChart(){
          try {
            const response = await fetch(`${this.backendApiUrl}/MonthlyRegistrationTrend`);
            if(!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            
            if(data && data.labels && data.data && data.labels.length > 0){
              this.chartHasData = true;
              this.renderChart(data.labels, data.data);
            }else{
              this.chartHasData = false;  
            }
          } catch(error){
            console.error("Error fetching monthly trend data:", error);
          } finally{
            this.chartDataLoaded = true;
          }
        },
        renderChart(labels, data){
          const ctx = this.$refs.monthlyTrendChartCanvas.getContext('2d');

          if(this.chartInstance){this.chartInstance.destroy();}

          this.chartInstance = new Chart(ctx, {
            type: 'line', // 折線圖類型
                data: {
                    labels: labels,
                    datasets: [{
                        label: '每月新增人數',
                        data: data,
                        borderColor: 'rgba(75, 192, 192, 1)', // 折線顏色
                        backgroundColor: 'rgba(75, 192, 192, 0.2)', // 填充顏色
                        tension: 0.1, // 使線條平滑
                        fill: true // 填充線下區域
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '新增人數'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '月份'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: '每月新增個人資料趨勢'
                        }
                    }
                }
              })
            }
          },
    beforeUnmount() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
    }
};
// 4.個人歷史紀錄
const PersonHistoryComponent = {
  template:
  `<div class="container mt-4">
            <h2>個人資料歷史版本列表</h2>
            <button class="btn btn-outline-info mb-3" @click="printCurrentTable">
                <i class="bi bi-printer-fill me-2"></i>列印列表
            </button>

            <div v-if="loading" class="text-center text-muted">載入中...</div>
            <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
            <div v-else-if="!additionalInfoList.length" class="alert alert-warning">沒有找到附加資訊。</div>
            <div v-else>
                <table class="table table-hover table-striped person-table" id="additionalInfoTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>姓名 (原)</th> <th>版本</th>
                            <th>最後修改</th>
                            <th>舊姓名</th>
                            <th>舊 Email</th>
                            <th>舊生日</th>
                            <th>舊地址</th>
                            <th>舊電話</th>
                            <th>舊性別</th>
                            <th>舊修改日期</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="info in additionalInfoList" :key="info.id">
                            <td>{{ info.id }}</td>
                            <td>{{ info.name }}</td> <td>{{ info.version }}</td>
                            <td>{{ formatDateTime(info.lastModified) }}</td>
                            <td>{{ info.oldName || '無' }}</td>
                            <td>{{ info.oldEmail || '無' }}</td>
                            <td>{{ info.oldDateOfBirth ? formatDate(info.oldDateOfBirth) : '無' }}</td>
                            <td>{{ info.oldAddress || '無' }}</td>
                            <td>{{ info.oldPhoneNumber || '無' }}</td>
                            <td>{{ info.oldGender || '無' }}</td>
                            <td>{{ info.oldModifiedDate ? formatDateTime(info.oldModifiedDate) : '無' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    data(){
      return{
        additionalInfoList: [],
        loading: true,
        error: null,
        backendApiUrl:"http://localhost:5098/api/Persons",
      }
    },
    mounted(){
      this.fetchAdditionalInfo();
    },
    methods:{
      async fetchAdditionalInfo() {
        // 如果需要顯示姓名，你需要調用獲取所有人的 API，然後合併數據
        // 或者擴展 PersonAdditionalInfoDTO 讓後端返回 Name
        this.loading = true;
        this.error = null;
        try {
          const response = await fetch (`${this.backendApiUrl}/AdditionalInfo`);
          if(!response.ok){
            throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
          }
          this.additionalInfoList = await response.json();
        } catch(error){
          this.error = `載入附加資訊失敗: ${error.message}`;
          console.error(error);
        } finally {
          this.loading = false;
        }
      },
      formatDate(dateString){
        if(!dateString || dateString.startsWith('0001-01-01')){return 'N/A';}
        return new Date(dateString).toLocaleDateString('zh-TW');
      },
      formatDateTime(dateTimeString){
        if(!dateTimeString || dateTimeString.startsWith('0001-01-01')) {return 'N/A';}
        const options = {year:'numeric', month:'2-digit',
          day:'2-digit',
          hour:'2-digit',
          minute:'2-digit',
          second:'2-digit',
          hour12:false
        };
        return new Date(dateTimeString).toLocaleString('zh-TW', options);
      },
      printCurrentTable(){
        // 列印邏輯與前面 main.js 中的 printList 類似
        // 針對 #additionalInfoTable 進行列印

        const printContentElement = document.getElementById('additionalInfoTable');
        if(!printContentElement){
          console.error("找不到要列印的內容");
          return;
        }

        const printWindow = window.open('','_blank');
        printWindow.document.write('<html><head><title>附加資訊列表</title>');
        printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">');
        printWindow.document.write('<link href="css/style.css" rel="stylesheet">'); // 確保引入你的樣式表
        printWindow.document.write('</head><body><div class="container mt-4">');
        printWindow.document.write('<h2>個人資料歷史版本列表</h2>');
        printWindow.document.write(printContentElement.outerHTML); // 使用 outerHTML 包含表格本身
        printWindow.document.write('</div></body></html>');
        printWindow.document.close();

        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        };
      }
    }
  }

const routes = [
    { path: '/charts/gender', component: GenderChartComponent },
    { path: '/charts/age', component: AgeChartComponent },
    { path: '/charts/trend', component: MonthlyTrendChartComponent },
    // 當用戶訪問根路徑時，可以選擇重定向到一個默認圖表，或者顯示提示信息
    { path: '/', redirect: '/charts/gender' }, // 預設跳轉到性別分佈圖
    {path: '/history', component:PersonHistoryComponent},
];
const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(), // 使用 Hash 模式，在網址中會出現 #，適合靜態文件伺服
    // history: VueRouter.createWebHistory(), // 如果後端有配置，可以使用 History 模式
    routes,
});

app.use(router);
app.mount("#app");

function showAlert(message, type) {
  const alertPlaceholder = document.getElementById("alertPlaceholder");
  if (!alertPlaceholder) return;

  if (alertPlaceholder._timer) {
    clearTimeout(alertPlaceholder._timer);
    alertPlaceholder._timer = null;
  }

  if (alertPlaceholder._transitionEndHandler) {
    alertPlaceholder.removeEventListener(
      "transitionend",
      alertPlaceholder._transitionEndHandler
    );
    alertPlaceholder._transitionEndHandler = null;
  }

  alertPlaceholder.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = [
    `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`,
    `<div>${message}</div>`,
    `<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="close"></button>`,
    `</div>`,
  ].join("");

  alertPlaceholder.append(wrapper);

  setTimeout(() => {
    alertPlaceholder.classList.add("active");
  }, 10);

  const alertElement = wrapper.querySelector(".alert");

  setTimeout(() => {
    if (alertElement) {
      const alert = bootstrap.Alert.getInstance(alertElement);
      if (alert) {
        alert.close();
      } else {
        alertElement.classList.remove("show");
      }
    }
  }, 1800);
  if (alertElement) {
    alertElement.addEventListener("closed.bs.alert", () => {
      wrapper.remove();
      console.log("Inner alert dismissed and removed from DOM.");
    });
  }

  alertPlaceholder._transitionEndHandler = (event) => {
    if (
      event.propertyName === "top" &&
      !alertPlaceholder.classList.contains("active")
    ) {
      if (alertPlaceholder.children.length === 0) {
        alertPlaceholder.innerHTML = "";
      }
      alertPlaceholder.removeEventListener(
        "transitionend",
        alertPlaceholder._transitionEndHandler
      );
      alertPlaceholder._transitionEndHandler = null;
    }
  };
  alertPlaceholder.addEventListener(
    "transitionend",
    alertPlaceholder._transitionEndHandler
  );
}
