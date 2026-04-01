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

  /** 清除缓存中的接口地址，恢复为 app.js 默认（本机调试用 127.0.0.1） */
  resetApiBase() {
    try {
      wx.removeStorageSync("apiBase");
      app.globalData.apiBase = "http://127.0.0.1:8000";
      this.setData({ apiBaseInput: "http://127.0.0.1:8000" });
      wx.showToast({ title: "已恢复本机默认", icon: "success" });
    } catch (e) {
      wx.showToast({ title: "操作失败", icon: "none" });
    }
  },

  /**
   * 测试连接时优先用输入框内容（不必先点保存）；
   * 登录请求仍走 getApiBase()，改地址后请先「保存地址」。
   */
  resolveBaseForPing() {
    let v = (this.data.apiBaseInput || "").trim();
    if (!v) return getApiBase();
    if (!/^https?:\/\//i.test(v)) v = "http://" + v;
    return normalizeApiBase(v);
  },

  /** 登录前：输入框与已保存不一致时提示先保存 */
  ensureApiBaseSavedForLogin() {
    const fromInput = this.resolveBaseForPing();
    const saved = getApiBase();
    if (fromInput !== saved) {
      wx.showModal({
        title: "请先保存地址",
        content:
          "接口地址已修改但未保存，登录仍会连到：\n" +
          saved +
          "\n\n请先点「保存地址」，或点「恢复本机默认」再试。",
        showCancel: false
      });
      return false;
    }
    return true;
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

  /** 探测后端是否可达（使用输入框地址，与是否已点「保存」无关） */
  pingBackend() {
    const base = this.resolveBaseForPing();
    wx.showLoading({ title: "检测中" });
    wx.request({
      url: base + "/health",
      method: "GET",
      timeout: 10000,
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
        const tip =
          base.indexOf("127.0.0.1") >= 0 || base.indexOf("localhost") >= 0
            ? "本机后端：请在 backend 目录启动 uvicorn main:app --host 0.0.0.0 --port 8000，并在电脑浏览器打开 " +
              base +
              "/health 验证。"
            : "云服务器：请在电脑浏览器访问 " +
              base +
              "/health；若浏览器也打不开，检查腾讯云轻量防火墙、服务器安全组是否放行 TCP 8000，以及 ssh 上 systemctl status qhd-api 是否为 running。";
        wx.showModal({
          title: "无法连接后端",
          content:
            (err && err.errMsg) +
            "\n\n本次检测地址：" +
            base +
            "\n\n" +
            tip +
            "\n\n连上后请点「保存地址」再登录。",
          showCancel: false
        });
      }
    });
  },

  wxLogin() {
    if (!this.ensureApiBaseSavedForLogin()) {
      return;
    }
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
