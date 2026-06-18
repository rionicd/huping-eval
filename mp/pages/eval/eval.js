const app = getApp();

Page({
  data: {
    raterRole: '',
    teachers: [],          // 过滤后的本角色需要评价的所有教师
    filteredTeachers: [],  // 当前激活 Tab 下显示的教师列表
    tabs: [],              // 动态 Tab 列表
    activeTab: '',         // 当前激活的 Tab 类别 (校级干部/中层干部/普通教师)
    
    scores: {},            // 打分数据, 格式: { teacherId: score }
    scoreIndices: {},      // picker 选择的索引, 格式: { teacherId: index }
    
    // 分数范围: 从 99 倒序排到 85，让高分优先展示
    scoreRange: ['99', '98', '97', '96', '95', '94', '93', '92', '91', '90', '89', '88', '87', '86', '85'],
    
    ratedCount: 0,
    totalCount: 0,
    progressPercentage: 0,
    isSubmitted: false
  },

  onLoad(options) {
    const role = decodeURIComponent(options.role || '教师');
    this.setData({
      raterRole: role
    });
    this.fetchTeachers();
  },

  // 获取教师列表
  fetchTeachers() {
    const serverUrl = app.globalData.serverUrl;
    wx.showLoading({ title: '加载中...' });

    wx.request({
      url: `${serverUrl}/api/teachers`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          this.initData(res.data);
        } else {
          wx.showModal({
            title: '加载失败',
            content: res.data && res.data.message ? res.data.message : '状态码异常: ' + res.statusCode,
            showCancel: false
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({
          title: '连接失败',
          content: '无法连接到服务器。请确认您手机和服务器处于同一局域网内，且在首页长按配置了正确的 IP 端口。',
          showCancel: false
        });
        console.error(err);
      }
    });
  },

  // 初始化教师数据和 Tab 栏
  initData(allTeachers) {
    const role = this.data.raterRole;
    let expected = [];

    // 根据评议人身份过滤需要打分的老师
    if (role === '教师') {
      expected = allTeachers; // 评价全员 30 人
    } else if (role === '校级干部') {
      expected = allTeachers.filter(t => t.type !== '校级干部'); // 评价中层和普通教师 20 人
    } else if (role === '中层干部') {
      expected = allTeachers.filter(t => t.type !== '中层干部'); // 评价校级和普通教师 20 人
    }

    // 动态生成 Tab 栏
    const tabTypes = [];
    if (role === '教师') {
      tabTypes.push({ name: '校级干部评议', type: '校级干部' });
      tabTypes.push({ name: '中层干部评议', type: '中层干部' });
      tabTypes.push({ name: '教师测评', type: '普通教师' });
    } else if (role === '校级干部') {
      tabTypes.push({ name: '中层干部评议', type: '中层干部' });
      tabTypes.push({ name: '教师测评', type: '普通教师' });
    } else if (role === '中层干部') {
      tabTypes.push({ name: '校级干部评议', type: '校级干部' });
      tabTypes.push({ name: '教师测评', type: '普通教师' });
    }

    const defaultActiveTab = tabTypes[0].type;
    
    // 初始化打分映射
    const scores = {};
    const scoreIndices = {};
    expected.forEach(t => {
      scores[t.id] = null;
      scoreIndices[t.id] = -1;
    });

    this.setData({
      teachers: expected,
      tabs: tabTypes,
      activeTab: defaultActiveTab,
      scores,
      scoreIndices,
      totalCount: expected.length,
      ratedCount: 0,
      progressPercentage: 0
    });

    this.updateTabAndFilter();
  },

  // 切换分类 Tab
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      activeTab: type
    });
    this.updateTabAndFilter();
  },

  // 评分变更
  onScoreChange(e) {
    const teacherId = e.currentTarget.dataset.id;
    const selectIndex = parseInt(e.detail.value, 10);
    const score = parseInt(this.data.scoreRange[selectIndex], 10);

    const scores = { ...this.data.scores };
    const scoreIndices = { ...this.data.scoreIndices };

    scores[teacherId] = score;
    scoreIndices[teacherId] = selectIndex;

    this.setData({
      scores,
      scoreIndices
    });

    this.updateProgress();
    this.updateTabAndFilter();
  },

  // 计算并更新打分进度
  updateProgress() {
    const scores = this.data.scores;
    let ratedCount = 0;
    
    this.data.teachers.forEach(t => {
      if (scores[t.id] !== null && scores[t.id] !== undefined) {
        ratedCount++;
      }
    });

    const totalCount = this.data.totalCount;
    const progressPercentage = Math.round((ratedCount / totalCount) * 100);

    this.setData({
      ratedCount,
      progressPercentage
    });
  },

  // 过滤当前列表并更新 Tab 未填角标
  updateTabAndFilter() {
    const { teachers, activeTab, scores, tabs } = this.data;

    // 过滤出当前分类的老师
    const filteredTeachers = teachers.filter(t => t.type === activeTab);

    // 计算每一个 Tab 对应的未评分人数
    const updatedTabs = tabs.map(tab => {
      const tabTeachers = teachers.filter(t => t.type === tab.type);
      let unratedCount = 0;
      tabTeachers.forEach(t => {
        if (scores[t.id] === null || scores[t.id] === undefined) {
          unratedCount++;
        }
      });
      return { ...tab, unratedCount };
    });

    this.setData({
      filteredTeachers,
      tabs: updatedTabs
    });
  },

  // 提交整卷评分
  submitScores() {
    const { teachers, scores, raterRole } = this.data;
    
    // 找出第一个未完成评分的教师
    let firstMissing = null;
    let missingCount = 0;

    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      if (scores[t.id] === null || scores[t.id] === undefined) {
        missingCount++;
        if (!firstMissing) {
          firstMissing = t;
        }
      }
    }

    if (missingCount > 0) {
      // 短震动提示
      wx.vibrateShort({ type: 'medium' });

      wx.showModal({
        title: '打分不完整',
        content: `还有 ${missingCount} 位教师未打分，已为您自动定位到对应位置。`,
        showCancel: false,
        success: () => {
          // 自动切换到漏填教师所在的 Tab
          if (this.data.activeTab !== firstMissing.type) {
            this.setData({ activeTab: firstMissing.type });
            this.updateTabAndFilter();
          }
          
          // 延时滚动，等待 DOM 渲染更新
          setTimeout(() => {
            wx.pageScrollTo({
              selector: `#teacher-${firstMissing.id}`,
              duration: 300
            });
          }, 150);
        }
      });
      return;
    }

    // 通过全部本地校验，发送请求
    const serverUrl = app.globalData.serverUrl;
    wx.showLoading({ title: '提交中...' });

    wx.request({
      url: `${serverUrl}/api/submissions`,
      method: 'POST',
      data: {
        role: raterRole,
        scores: scores
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          wx.vibrateLong(); // 成功长震动反馈
          this.setData({
            isSubmitted: true
          });
        } else {
          wx.showModal({
            title: '提交失败',
            content: res.data && res.data.message ? res.data.message : '服务器返回异常码: ' + res.statusCode,
            showCancel: false
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({
          title: '提交失败',
          content: '连接服务器失败，请检查网络后重试。',
          showCancel: false
        });
        console.error(err);
      }
    });
  },

  // 重新开始打分
  restartEval() {
    this.setData({
      isSubmitted: false
    });
    this.fetchTeachers();
  },

  // 返回首页
  goBack() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  }
});
