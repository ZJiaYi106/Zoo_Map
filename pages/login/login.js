// pages/login/login.js
const { request, getApiBase, normalizeApiBase } = require("../../utils/request.js");
const app = getApp();

Page({
  data: {
    apiBaseInput: ""
  },

  onShow() {
    this.setData({
      apiBaseInput: getApiBase()
    });
  },

  onApiBaseInput(e) {
    this.setData({ apiBaseInput: e.detail.value });
  },

  /** 保存接口地址（真机请填电脑局域网 IP，如 http://192.168.0.3:8000） */
  saveApiBase() {
    let v = (this.data.apiBaseInput || "").trim();
    if (!v) {
      wx.showToast({ title: "请输入地址", icon: "none" });
      return;
    }
    if (!/^https?:\/\//i.test(v)) {
      v = "http://" + v;
    }
    v = normalizeApiBase(v);
    try {
      wx.setStorageSync("apiBase", v);
      app.globalData.apiBase = v;
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({ apiBaseInput: v });
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  /** 探测后端是否可达 */
  pingBackend() {
    const base = getApiBase();
    wx.showLoading({ title: "检测中" });
    wx.request({
      url: base + "/health",
      method: "GET",
      timeout: 8000,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showModal({
            title: "连接成功",
            content: "后端可访问：" + base + "\n响应：" + JSON.stringify(res.data).slice(0, 200),
            showCancel: false
          });
        } else {
          wx.showToast({ title: "状态码 " + res.statusCode, icon: "none" });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showModal({
          title: "无法连接后端",
          content: (err && err.errMsg) + "\n\n当前：" + base + "\n请确认 uvicorn 已启动且地址正确。",
          showCancel: false
        });
      }
    });
  },

  wxLogin() {
    wx.showLoading({ title: "登录中" });
    wx.login({
      success: (res) => {
        if (!res.code) {
          wx.hideLoading();
          wx.showToast({ title: "获取登录凭证失败", icon: "none" });
          return;
        }
        request("/api/auth/wx-login", {
          method: "POST",
          data: { code: res.code }
        })
          .then((body) => {
            wx.hideLoading();
            const data = body.data || body;
            const token = data.token;
            const userInfo = data.user || { nickname: "游客", avatar: "" };
            if (!token) {
              wx.showToast({ title: body.message || "登录失败", icon: "none" });
              return;
            }
            app.setAuth(token, userInfo);
            wx.showToast({ title: "登录成功", icon: "success" });
            setTimeout(() => {
              wx.reLaunch({ url: "/pages/index/index" });
            }, 400);
          })
          .catch((err) => {
            wx.hideLoading();
            console.error("登录请求失败", err);
          });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: "wx.login 调用失败", icon: "none" });
      }
    });
  }
});
