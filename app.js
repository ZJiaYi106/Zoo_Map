















// app.js — 全局入口：基础配置、登录态、接口根地址
App({
  globalData: {
    /**
     * 接口根地址（无末尾斜杠）
     * - 开发者工具本机调试：http://127.0.0.1:8000
     * - 手机真机预览：必须改为电脑的局域网 IP，例如 http://192.168.1.5:8000（与电脑同一 WiFi）
     * 也可在登录页「调试」里临时保存，会覆盖此处（见 onLaunch）
     */
    apiBase: "https://qhdzoo.site",
    token: "",
    userInfo: null,
    mapFocusFacilityId: null,
    lastRoutePlan: null
  },

  onLaunch() {
    try {
      const token = wx.getStorageSync("token") || "";
      const userInfo = wx.getStorageSync("userInfo") || null;
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      // 允许用本地缓存覆盖 apiBase，方便真机不改代码重编译
      const savedBase = wx.getStorageSync("apiBase");
      if (savedBase) {
        this.globalData.apiBase = String(savedBase).replace(/\/+$/, "");
      }
    } catch (e) {
      console.warn("读取本地缓存失败", e);
    }
  },

  isLoggedIn() {
    return !!this.globalData.token;
  },

  setAuth(token, userInfo) {
    this.globalData.token = token;
    this.globalData.userInfo = userInfo || null;
    try {
      wx.setStorageSync("token", token);
      if (userInfo) wx.setStorageSync("userInfo", userInfo);
    } catch (e) {
      console.warn("写入缓存失败", e);
    }
  },

  clearAuth() {
    this.globalData.token = "";
    this.globalData.userInfo = null;
    try {
      wx.removeStorageSync("token");
      wx.removeStorageSync("userInfo");
    } catch (e) {}
  }
});
