// pages/scenic/scenic.js — 景点列表、筛选、AI 讲解、收藏
const { request } = require("../../utils/request.js");

const PLACEHOLDER_IMG =
  "https://dummyimage.com/750x400/2D6B5A/ffffff.png&text=QHD+Zoo";

/** 景点名 -> 本地封面（小程序包内图片）；优先于接口返回的 image */
const LOCAL_COVER_BY_NAME = {
  "猛兽区观景台": "/images/scenic-beast-deck.png",
  "狮虎园": "/images/scenic-lion-yard.png",
  "食草动物区": "/images/scenic-herbivore-zone.png",
  "长颈鹿互动广场": "/images/scenic-giraffe-plaza.png",
  "鸟类表演场": "/images/scenic-bird-show.png",
  "水禽湖": "/images/scenic-waterfowl-lake.png"
};

function resolveScenicImage(item) {
  const local = LOCAL_COVER_BY_NAME[item.name];
  if (local) return local;
  const remote = item.image && String(item.image).trim();
  return remote || PLACEHOLDER_IMG;
}

Page({
  data: {
    activeCat: "",
    list: [],
    favoritesOnly: false,
    explainShow: false,
    explainTitle: "",
    explainText: ""
  },

  onLoad(options) {
    if (options.favorites === "1" || options.mode === "favorites") {
      this.setData({ favoritesOnly: true });
      this.loadFavorites();
    } else {
      this.loadList();
    }
  },

  onShow() {
    if (!this.data.favoritesOnly) {
      this.loadList();
    }
  },

  loadList() {
    const cat = this.data.activeCat;
    wx.showLoading({ title: "加载中" });
    const q = cat ? "?category=" + encodeURIComponent(cat) + "&page=1&page_size=50" : "?page=1&page_size=50";
    request("/api/scenic/list" + q)
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const rows = (data.items || data.list || []).map((x) => ({
          ...x,
          image: resolveScenicImage(x),
          collected: !!x.collected
        }));
        this.setData({ list: rows });
      })
      .catch(() => wx.hideLoading());
  },

  loadFavorites() {
    wx.showLoading({ title: "加载中" });
    request("/api/collection/list?page=1&page_size=50")
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const rows = (data.items || []).map((x) => ({
          ...x,
          image: resolveScenicImage(x),
          collected: true
        }));
        this.setData({ list: rows });
      })
      .catch(() => wx.hideLoading());
  },

  onTab(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ activeCat: cat });
    this.loadList();
  },

  onImgErr(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((item) =>
      item.id === id ? { ...item, image: PLACEHOLDER_IMG } : item
    );
    this.setData({ list });
  },

  aiExplain(e) {
    const name = e.currentTarget.dataset.name;
    wx.showLoading({ title: "生成讲解" });
    request("/api/ai/scenic-explain", {
      method: "POST",
      data: { scenic_name: name }
    })
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const text = data.content || data.reply || "";
        this.setData({
          explainShow: true,
          explainTitle: name,
          explainText: text
        });
      })
      .catch(() => wx.hideLoading());
  },

  closeExplain() {
    this.setData({ explainShow: false });
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((x) => x.id === id);
    const collected = !item.collected;
    wx.showLoading({ title: "处理中" });
    request("/api/collection/toggle", {
      method: "POST",
      data: { scenic_id: id, collect: collected }
    })
      .then(() => {
        wx.hideLoading();
        const list = this.data.list.map((x) =>
          x.id === id ? { ...x, collected } : x
        );
        this.setData({ list });
        wx.showToast({ title: collected ? "已收藏" : "已取消", icon: "success" });
      })
      .catch(() => wx.hideLoading());
  }
});
