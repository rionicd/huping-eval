App({
  globalData: {
    // 默认局域网开发服务器地址
    serverUrl: 'http://localhost:5050'
  },
  onLaunch() {
    const savedUrl = wx.getStorageSync('serverUrl');
    if (savedUrl) {
      this.globalData.serverUrl = savedUrl;
    }
  }
});
