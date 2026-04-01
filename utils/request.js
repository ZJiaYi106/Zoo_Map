// utils/request.js — 统一请求封装（每次请求内再 getApp，避免模块加载过早 getApp 异常）

/** 只保留「协议 + 主机 + 端口」，去掉误粘贴的 /health、/api 等（否则会拼成 /health/health 导致 404） */
function normalizeApiBase(url) {
  let s = String(url || "").trim().replace(/\/+$/, "");
  if (!s) return s;
  s = s.replace(/\/health\/?$/i, "");
  s = s.replace(/\/health\/db\/?$/i, "");
  s = s.replace(/\/api\/?$/i, "");
  return s.replace(/\/+$/, "");
}
 
function getApiBase() {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.apiBase) {
      return normalizeApiBase(app.globalData.apiBase);
    }
  } catch (e) {
    console.warn("getApp 未就绪", e);
  }
  try {
    const saved = wx.getStorageSync("apiBase");
    if (saved) return normalizeApiBase(saved);
  } catch (e) {}
  return "http://127.0.0.1:8000";
}

/**
 * @param {string} url 相对路径，如 /api/auth/wx-login
 * @param {object} options method, data, header
 */
function request(url, options = {}) {
  const { method = "GET", data = {}, header = {}, showFailToast = true } = options;
  const base = getApiBase();
  const path = url.startsWith("/") ? url : "/" + url;
  let token = "";
  try {
    const app = getApp();
    token = (app && app.globalData && app.globalData.token) || wx.getStorageSync("token") || "";
  } catch (e) {
    token = wx.getStorageSync("token") || "";
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: base + path,
      method,
      data,
      timeout: 30000,
      header: {
        "Content-Type": "application/json",
        ...header,
        ...(token ? { Authorization: "Bearer " + token } : {})
      },
      success(res) {
        const body = res.data;
        if (res.statusCode === 401) {
          wx.showToast({ title: "请先登录", icon: "none" });
          try {
            getApp().clearAuth();
          } catch (e) {}
          reject(res);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (body && typeof body.code !== "undefined" && body.code !== 0 && body.code !== 200) {
            wx.showToast({ title: body.message || "请求失败", icon: "none" });
            reject(body);
            return;
          }
          resolve(body);
        } else {
          let msg = (body && body.message) || "网络错误 " + res.statusCode;
          if (res.statusCode === 404) {
            msg =
              "404 未找到接口。请检查接口根地址只填到端口，例如 http://IP:8000，不要带 /health 或 /api";
          }
          wx.showToast({ title: msg, icon: "none", duration: 3500 });
          reject(res);
        }
      },
      fail(err) {
        const detail = (err && err.errMsg) ? err.errMsg : "未知错误";
        console.error("[request fail]", base + path, err);
        if (showFailToast) {
          const isDomainBlock = /domain list|合法域名/i.test(detail);
          const hint = isDomainBlock
            ? "【域名未放行】请在微信开发者工具「详情→本地设置」勾选「不校验合法域名…」，然后点「编译」并重新扫码预览；或改用工具栏「真机调试」。\n\n若仍失败：登录页接口地址请填电脑 ipconfig 的 IPv4（热点下勿用 127.0.0.1），如 http://192.168.43.x:8000。"
            : "请确认：①后端已启动：uvicorn main:app --host 0.0.0.0 --port 8000；②开发者工具已勾选「不校验合法域名」；③真机/热点下填电脑局域网 IP（勿用 127.0.0.1）。";
          wx.showModal({
            title: "请求失败",
            content: detail + "\n\n当前地址：" + base + "\n\n" + hint,
            showCancel: false
          });
        }
        reject(err);
      }
    });
  });
}

module.exports = { request, getApiBase, normalizeApiBase };
