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
