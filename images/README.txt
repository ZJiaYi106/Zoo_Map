图片资源说明（微信小程序主包上限约 2MB）

- home-banner.jpg、scenic-*.jpg：已压缩为 JPEG，请勿换回大尺寸 PNG。
- park-map.png：手绘导览底图，请保持宽度 ≤1400px、文件 <500KB；若超过 2MB 真机会报 80051。
- 重新压缩地图：在项目根目录执行
  npx sharp-cli -i images/park-map.png -o images/park-map.png -q 80 resize 1280
