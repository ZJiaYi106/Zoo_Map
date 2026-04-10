// pages/map/map.js — 园区内模拟地图（可缩放/可拖拽/导航跟随）

const POI_SEED = [
  { id: 1, name: "东门入口", intro: "建议从东门入园，先看导览牌规划路线。", type: "gate", x: 90, y: 84 },
  { id: 2, name: "游客服务中心", intro: "票务咨询、寄存与失物招领。", type: "service", x: 18, y: 72 },
  { id: 3, name: "猛兽区观景台", intro: "可俯瞰猛兽活动区，建议保持安静，勿投喂。", type: "scenic", x: 28, y: 28 },
  { id: 4, name: "狮虎园", intro: "东北虎、非洲狮等猛兽展示，科普牌示丰富。", type: "scenic", x: 43, y: 24 },
  { id: 15, name: "狮虎园观景台", intro: "猛兽区经典拍照机位，请勿越线。", type: "view", x: 35, y: 31 },
  { id: 5, name: "中央补给站", intro: "休息补给点，适合作为中段换线节点。", type: "service", x: 46, y: 52 },
  { id: 6, name: "食草动物区", intro: "长颈鹿、斑马等食草动物散养区域。", type: "scenic", x: 62, y: 50 },
  { id: 7, name: "长颈鹿互动广场", intro: "互动时间以当日公告为准，请文明排队。", type: "scenic", x: 74, y: 42 },
  { id: 8, name: "鸟类表演场", intro: "鸟类互动与科普讲解场次见现场公告。", type: "scenic", x: 78, y: 72 },
  { id: 9, name: "水禽湖", intro: "适合观察水禽、休憩拍照。", type: "scenic", x: 56, y: 82 },
  { id: 10, name: "园区东门厕所", intro: "无障碍卫生间位于东门入口附近。", type: "toilet", x: 82, y: 78 },
  { id: 11, name: "中央超市", intro: "饮用水、简餐与纪念品。", type: "shop", x: 50, y: 58 },
  { id: 12, name: "北门卫生间", intro: "靠近北门停车区。", type: "toilet", x: 50, y: 10 },
  { id: 13, name: "林荫休息区", intro: "长椅和遮阴较多，适合短暂停留。", type: "rest", x: 62, y: 62 },
  { id: 14, name: "湖畔观景台", intro: "水禽湖经典拍照机位。", type: "view", x: 60, y: 90 }
];

const EDGE_SEED = [
  [1, 2], [2, 10], [2, 5], [2, 3],
  [3, 4], [3, 15], [4, 15], [4, 12], [4, 6], [4, 5],
  [5, 6], [5, 11], [5, 13], [5, 9],
  [6, 7], [6, 13], [6, 8],
  [8, 9], [8, 13], [9, 14], [9, 13],
  [10, 5], [11, 13]
];

const ZONE_SEED = [
  { id: 1, name: "猛兽区", cls: "zone-beast", style: "left:18%;top:12%;width:34%;height:24%;transform:rotate(-8deg);" },
  { id: 2, name: "食草区", cls: "zone-herb", style: "left:50%;top:34%;width:34%;height:24%;transform:rotate(6deg);" },
  { id: 3, name: "鸟类区", cls: "zone-bird", style: "left:62%;top:62%;width:30%;height:24%;transform:rotate(-4deg);" },
  { id: 4, name: "服务区", cls: "zone-service", style: "left:30%;top:58%;width:30%;height:18%;transform:rotate(2deg);" }
];

const METER_PER_PERCENT = 15;
const MIN_SCALE = 0.9;
const MAX_SCALE = 2.6;
const SCENE_TO_POI = {
  east_gate: 1,
  east: 1,
  entrance_east: 1
};
const TYPE_META = {
  gate: { label: "入口", cls: "type-gate", color: "#1e88e5" },
  service: { label: "服务", cls: "type-service", color: "#7b5fb7" },
  scenic: { label: "景点", cls: "type-scenic", color: "#2e7d32" },
  view: { label: "观景台", cls: "type-view", color: "#ef6c00" },
  toilet: { label: "厕所", cls: "type-toilet", color: "#00838f" },
  shop: { label: "商店", cls: "type-shop", color: "#6d4c41" },
  rest: { label: "休息区", cls: "type-rest", color: "#546e7a" }
};

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function euclid(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function touchDistance(t1, t2) {
  const dx = t1.pageX - t2.pageX;
  const dy = t1.pageY - t2.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

Page({
  data: {
    poiList: [],
    zones: [],
    roadSegments: [],
    showDetail: false,
    currentPoi: { id: null, name: "", intro: "", type: "" },
    startId: 2,
    endId: 3,
    startIndex: 1,
    endIndex: 2,
    poiNames: [],
    routeText: "未规划路线",
    routeMeters: 0,
    routeMinutes: 0,
    isNavigating: false,
    navHint: "",
    sceneStyle: "transform: translate(0px, 0px) scale(1);",
    hasRoute: false,
    userPoiId: 1,
    userPosStyle: "",
    legendItems: [],
    activeLegendType: "all",
    legendPoiList: []
  },

  onLoad(options) {
    this.poiMap = {};
    POI_SEED.forEach((p) => { this.poiMap[p.id] = p; });
    this.adj = this._buildGraph();
    this.viewport = { w: 0, h: 0 };
    this.camera = { scale: 1, tx: 0, ty: 0 };
    this.routePath = [];
    this.routePolyline = [];
    this.gesture = null;

    this.setData({
      poiList: this._decoratePoiList(new Set(), "all"),
      zones: ZONE_SEED,
      roadSegments: this._buildRoadSegments(new Set()),
      poiNames: POI_SEED.map((p) => p.name),
      legendItems: this._buildLegendItems()
    });

    this._initUserPositionByQr(options || {});

    if (options.from === "facility") {
      this._applyMapFocus();
    } else {
      this.planRoute();
    }
  },

  onReady() {
    this._measureViewport(() => {
      this._syncUserPosStyle();
      this._centerOnPoi(this.data.userPoiId || this.data.startId, false);
      this._updateSceneStyle();
    });
  },

  onUnload() {},

  _measureViewport(cb) {
    const q = wx.createSelectorQuery();
    q.select(".inner-map").boundingClientRect();
    q.exec((res) => {
      const r = res && res[0];
      if (!r || !r.width || !r.height) return;
      this.viewport = { w: r.width, h: r.height };
      if (cb) cb();
    });
  },

  _buildGraph() {
    const adj = {};
    POI_SEED.forEach((p) => { adj[p.id] = []; });
    EDGE_SEED.forEach(([a, b]) => {
      const w = euclid(this.poiMap[a], this.poiMap[b]);
      adj[a].push({ to: b, w });
      adj[b].push({ to: a, w });
    });
    return adj;
  },

  _buildRoadSegments(routeEdgeSet) {
    return EDGE_SEED.map(([a, b], idx) => {
      const p1 = this.poiMap[a];
      const p2 = this.poiMap[b];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      return {
        id: idx + 1,
        style: `left:${p1.x}%;top:${p1.y}%;width:${len}%;transform:rotate(${ang}deg);`,
        onRoute: routeEdgeSet.has(edgeKey(a, b))
      };
    });
  },

  _buildLegendItems() {
    const items = [{ type: "all", label: "全部", cls: "type-all", color: "#455a64" }];
    Object.keys(TYPE_META).forEach((k) => {
      items.push({ type: k, ...TYPE_META[k] });
    });
    return items;
  },

  _decoratePoiList(pathSet, activeType) {
    return POI_SEED.map((p) => {
      const meta = TYPE_META[p.type] || TYPE_META.scenic;
      const hidden = activeType !== "all" && p.type !== activeType;
      return {
        ...p,
        typeLabel: meta.label,
        typeClass: meta.cls,
        onRoute: pathSet.has(String(p.id)),
        hidden
      };
    });
  },

  _refreshLegendPoiList(type) {
    if (type === "all") {
      this.setData({ legendPoiList: [] });
      return;
    }
    const list = POI_SEED.filter((p) => p.type === type).map((p) => ({ id: p.id, name: p.name }));
    this.setData({ legendPoiList: list });
  },

  _applyMapFocus() {
    try {
      const f = wx.getStorageSync("mapFocus");
      wx.removeStorageSync("mapFocus");
      if (!f || !f.title) {
        this.planRoute();
        return;
      }
      const target = POI_SEED.find((p) => p.name === f.title);
      if (!target) {
        this.planRoute();
        return;
      }
      const endIndex = POI_SEED.findIndex((p) => p.id === target.id);
      this.setData({
        endId: target.id,
        endIndex: endIndex < 0 ? 0 : endIndex,
        showDetail: true,
        currentPoi: target
      }, () => this.planRoute());
    } catch (e) {
      console.warn(e);
      this.planRoute();
    }
  },

  _initUserPositionByQr(options) {
    let userPoiId = 1; // 默认东区入口
    const rawScene = decodeURIComponent(options.scene || options.qr || "").trim().toLowerCase();
    if (rawScene) {
      const mapped = SCENE_TO_POI[rawScene];
      if (mapped && this.poiMap[mapped]) {
        userPoiId = mapped;
      } else if (/^\d+$/.test(rawScene) && this.poiMap[Number(rawScene)]) {
        userPoiId = Number(rawScene);
      }
    }
    const idx = POI_SEED.findIndex((p) => p.id === userPoiId);
    this.setData({
      userPoiId,
      startId: userPoiId,
      startIndex: idx < 0 ? 0 : idx
    });
  },

  _syncUserPosStyle() {
    const p = this.poiMap[this.data.userPoiId];
    if (!p) return;
    this.setData({ userPosStyle: `left:${p.x}%;top:${p.y}%;` });
  },

  onStartChange(e) {
    const idx = Number(e.detail.value || 0);
    const id = POI_SEED[idx] ? POI_SEED[idx].id : this.data.startId;
    this.setData({ startIndex: idx, startId: id, isNavigating: false }, () => {
      this.planRoute();
      this._centerOnPoi(id, true);
    });
  },

  onEndChange(e) {
    const idx = Number(e.detail.value || 0);
    const id = POI_SEED[idx] ? POI_SEED[idx].id : this.data.endId;
    this.setData({ endIndex: idx, endId: id, isNavigating: false }, () => this.planRoute());
  },

  onPoiTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const poi = this.poiMap[id];
    if (!poi) return;
    if (this.data.activeLegendType !== "all" && poi.type !== this.data.activeLegendType) return;
    this.setData({ showDetail: true, currentPoi: poi });
  },

  onLegendTap(e) {
    const type = e.currentTarget.dataset.type || "all";
    const pathSet = new Set(this.routePath.map((id) => String(id)));
    this.setData({
      activeLegendType: type,
      poiList: this._decoratePoiList(pathSet, type)
    });
    this._refreshLegendPoiList(type);
  },

  onLegendPoiTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const idx = POI_SEED.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = POI_SEED[idx];
    this.setData({
      endId: id,
      endIndex: idx,
      currentPoi: target,
      showDetail: true
    }, () => this.planRoute());
  },

  closePopup() {
    this.setData({ showDetail: false });
  },

  setStartFromCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      startId: id,
      startIndex: idx < 0 ? this.data.startIndex : idx,
      showDetail: false,
      isNavigating: false
    }, () => {
      this.planRoute();
      this._centerOnPoi(id, true);
    });
  },

  setEndFromCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      endId: id,
      endIndex: idx < 0 ? this.data.endIndex : idx,
      showDetail: false,
      isNavigating: false
    }, () => this.planRoute());
  },

  startNavigationToCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      endId: id,
      endIndex: idx < 0 ? this.data.endIndex : idx,
      showDetail: false
    }, () => this.startNavigation());
  },

  startNavigation() {
    if (!this.data.hasRoute || this.routePath.length < 2) {
      wx.showToast({ title: "请先规划路线", icon: "none" });
      return;
    }
    this.setData({
      isNavigating: true,
      navHint: `正在导航：${this.poiMap[this.data.startId].name} → ${this.poiMap[this.data.endId].name}`
    }, () => {
      this.planRoute();
    });
  },

  stopNavigation() {
    this.setData({
      isNavigating: false,
      navHint: "导航已结束，可重新选择起终点"
    });
  },

  planRoute() {
    const start = this.data.startId;
    const end = this.data.endId;
    if (!start || !end || !this.poiMap[start] || !this.poiMap[end]) return;
    if (start === end) {
      wx.showToast({ title: "起终点相同", icon: "none" });
      return;
    }
    const { path, edgeSet, distPercent } = this._dijkstra(start, end);
    if (!path.length) {
      wx.showToast({ title: "当前无可达路径", icon: "none" });
      return;
    }
    this.routePath = path;
    this.routePolyline = path.map((id) => ({ x: this.poiMap[id].x, y: this.poiMap[id].y }));

    const meters = Math.round(distPercent * METER_PER_PERCENT);
    const minutes = Math.max(1, Math.round(meters / 75));
    const text = path.map((id) => this.poiMap[id].name).join("  →  ");
    const pathSet = new Set(path.map((id) => String(id)));
    const poiList = this._decoratePoiList(pathSet, this.data.activeLegendType);
    this.setData({
      poiList,
      roadSegments: this._buildRoadSegments(edgeSet),
      routeText: text,
      routeMeters: meters,
      routeMinutes: minutes,
      hasRoute: true,
      navHint: this.data.isNavigating
        ? `正在导航：${this.poiMap[start].name} → ${this.poiMap[end].name}`
        : "点击“开始导航”，高亮路线"
    });
  },

  _dijkstra(start, end) {
    const dist = {};
    const prev = {};
    const visited = {};
    POI_SEED.forEach((p) => {
      dist[p.id] = Infinity;
      prev[p.id] = null;
      visited[p.id] = false;
    });
    dist[start] = 0;

    while (true) {
      let u = null;
      let best = Infinity;
      POI_SEED.forEach((p) => {
        if (!visited[p.id] && dist[p.id] < best) {
          best = dist[p.id];
          u = p.id;
        }
      });
      if (u === null || u === end) break;
      visited[u] = true;
      this.adj[u].forEach((e) => {
        if (visited[e.to]) return;
        const nd = dist[u] + e.w;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = u;
        }
      });
    }

    const path = [];
    if (dist[end] !== Infinity) {
      let cur = end;
      while (cur !== null) {
        path.push(cur);
        cur = prev[cur];
      }
      path.reverse();
    }
    const edgeSet = new Set();
    for (let i = 1; i < path.length; i += 1) edgeSet.add(edgeKey(path[i - 1], path[i]));
    return { path, edgeSet, distPercent: dist[end] === Infinity ? 0 : dist[end] };
  },

  onMapTouchStart(e) {
    const ts = e.touches || [];
    if (ts.length === 1) {
      this.gesture = {
        type: "pan",
        x: ts[0].pageX,
        y: ts[0].pageY,
        tx: this.camera.tx,
        ty: this.camera.ty
      };
    } else if (ts.length >= 2) {
      this.gesture = {
        type: "pinch",
        dist: touchDistance(ts[0], ts[1]),
        scale: this.camera.scale,
        tx: this.camera.tx,
        ty: this.camera.ty
      };
    }
  },

  onMapTouchMove(e) {
    const g = this.gesture;
    if (!g) return;
    const ts = e.touches || [];
    if (g.type === "pan" && ts.length === 1) {
      this.camera.tx = g.tx + (ts[0].pageX - g.x);
      this.camera.ty = g.ty + (ts[0].pageY - g.y);
      this._clampCamera();
      this._updateSceneStyle();
    } else if (g.type === "pinch" && ts.length >= 2) {
      const d = touchDistance(ts[0], ts[1]);
      const ratio = d / (g.dist || d);
      this.camera.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, g.scale * ratio));
      this._clampCamera();
      this._updateSceneStyle();
    }
  },

  onMapTouchEnd() {
    this.gesture = null;
  },

  _centerOnPoi(id, update) {
    const p = this.poiMap[id];
    if (!p) return;
    this._centerOnPercent(p.x, p.y, update);
  },

  _centerOnPercent(x, y, update) {
    const { w, h } = this.viewport;
    if (!w || !h) return;
    const s = this.camera.scale;
    const px = (x / 100) * w;
    const py = (y / 100) * h;
    this.camera.tx = w / 2 - px * s;
    this.camera.ty = h / 2 - py * s;
    this._clampCamera();
    if (update) this._updateSceneStyle();
  },

  _clampCamera() {
    const { w, h } = this.viewport;
    if (!w || !h) return;
    const s = this.camera.scale;
    const sw = w * s;
    const sh = h * s;
    const minX = w - sw;
    const minY = h - sh;
    const maxX = 0;
    const maxY = 0;
    this.camera.tx = Math.min(maxX, Math.max(minX, this.camera.tx));
    this.camera.ty = Math.min(maxY, Math.max(minY, this.camera.ty));
  },

  _updateSceneStyle() {
    const s = this.camera.scale;
    const tx = this.camera.tx;
    const ty = this.camera.ty;
    this.setData({ sceneStyle: `transform: translate(${tx}px, ${ty}px) scale(${s});` });
  },

  goAiRoute() {
    wx.navigateTo({ url: "/pages/ai/ai?preset=route" });
  },

  goFacility() {
    wx.navigateTo({ url: "/pages/map/facility" });
  }
});
