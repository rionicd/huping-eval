App({
  globalData: {
    // 默认局域网开发服务器地址（备用）
    serverUrl: 'http://localhost:5050',
    useCloud: true // 默认使用微信云托管免备案直连模式
  },
  onLaunch() {
    // 初始化云托管环境免备案接口
    try {
      wx.cloud.init({
        env: 'prod-d3gwm2z08e27328e' // 微信云托管环境 ID
      });
    } catch (e) {
      console.error('微信云托管初始化失败，将使用局域网模式:', e);
      this.globalData.useCloud = false;
    }

    const savedUrl = wx.getStorageSync('serverUrl');
    if (savedUrl) {
      this.globalData.serverUrl = savedUrl;
      // 如果用户设置了特殊的局域网 IP，则将 useCloud 标记为 false 以进行降级
      if (savedUrl && !savedUrl.includes('localhost')) {
        this.globalData.useCloud = false;
      }
    }
  },

  // 统一的自适应请求分发器
  request(options) {
    if (this.globalData.useCloud) {
      // 1. 微信云托管内网免域名直连模式
      wx.cloud.callContainer({
        config: {
          env: 'prod-d3gwm2z08e27328e'
        },
        path: options.url, // 相对路径
        header: {
          'X-WX-SERVICE': 'huping-eval', // 微信云托管的服务名
          ...options.header
        },
        method: options.method || 'GET',
        data: options.data,
        success: (res) => {
          // 云托管返回的 HTTP 状态码在 res.statusCode 中，格式完全兼容 wx.request
          options.success && options.success(res);
        },
        fail: options.fail
      });
    } else {
      // 2. 传统局域网 HTTP 请求模式
      wx.request({
        url: this.globalData.serverUrl + options.url,
        method: options.method || 'GET',
        header: options.header,
        data: options.data,
        success: options.success,
        fail: options.fail
      });
    }
  }
});
