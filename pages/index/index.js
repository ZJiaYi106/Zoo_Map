// pages/index/index.js
const { request } = require("../../utils/request");

// 和风天气 icon 码 → emoji
const ICON_MAP = {
  "100": "☀️", "101": "🌤️", "102": "⛅", "103": "⛅", "104": "☁️",
  "150": "🌙", "151": "🌙", "152": "🌙", "153": "🌙", "154": "☁️",
  "300": "🌧️", "301": "🌧️", "302": "⛈️", "303": "🌧️", "304": "🌧️",
  "305": "🌦️", "306": "🌦️", "307": "🌧️", "308": "🌧️", "309": "🌧️",
  "310": "🌧️", "311": "🌧️", "312": "🌧️", "313": "🌧️", "314": "🌧️",
  "315": "🌧️", "316": "🌧️", "317": "🌧️", "318": "🌧️",
  "350": "🌦️", "351": "🌦️",
  "400": "🌨️", "401": "🌨️", "402": "🌨️", "403": "🌨️",
  "404": "🌨️", "405": "🌨️", "406": "🌨️", "407": "🌨️",
  "500": "🌫️", "501": "🌫️", "502": "🌫️", "503": "🌫️",
  "504": "🌫️", "505": "🌫️", "506": "🌫️", "507": "🌫️", "508": "🌫️",
};

function mapIcon(code) {
  return ICON_MAP[String(code)] || "🌡️";
}

function formatHour(fxTime) {
  // fxTime 格式 "2026-06-03T14:00+08:00"
  try {
    const t = fxTime.split("T")[1];
    if (t) return t.slice(0, 5);
  } catch (e) {}
  return fxTime || "";
}

Page({
  data: {
    bannerOk: true,
    weatherItems: [],
    weatherLoading: false,
    weatherError: false
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }
    this.fetchWeather();
  },

  fetchWeather() {
    this.setData({ weatherLoading: true, weatherError: false });
    request("/api/weather/hourly?hours=5", { showFailToast: false })
      .then((res) => {
        console.log("[weather] 返回数据:", JSON.stringify(res));
        const items = (res.data || []).map((h) => ({
          time: formatHour(h.time),
          icon: mapIcon(h.icon),
          temp: h.temp + "°",
          text: h.text,
          pop: h.pop ? h.pop + "%" : "",
        }));
        console.log("[weather] 处理后 items:", items.length, "条");
        this.setData({ weatherItems: items, weatherLoading: false });
      })
      .catch((err) => {
        console.log("[weather] 请求失败:", err);
        this.setData({ weatherLoading: false, weatherError: true });
      });
  },

  onBannerErr() {
    this.setData({ bannerOk: false });
  },

  goMap() {
    wx.navigateTo({ url: "/pages/map/map" });
  },

  goAi() {
    wx.navigateTo({ url: "/pages/ai/ai" });
  },

  goScenic() {
    wx.navigateTo({ url: "/pages/scenic/scenic" });
  },

  goFacility() {
    wx.navigateTo({ url: "/pages/map/facility" });
  },

  goMine() {
    wx.navigateTo({ url: "/pages/mine/mine" });
  }
});
