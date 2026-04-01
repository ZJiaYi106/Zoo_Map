-- 秦皇岛野生动物园 AI 导览 — MySQL 建表与示例数据
-- 字符集：utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `qhd_zoo` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `qhd_zoo`;

-- 用户表
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `openid` VARCHAR(64) NOT NULL,
  `nickname` VARCHAR(128) DEFAULT '游客',
  `avatar` VARCHAR(512) DEFAULT '',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 景点表
DROP TABLE IF EXISTS `scenic`;
CREATE TABLE `scenic` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `intro` TEXT,
  `image` VARCHAR(512) DEFAULT '',
  `longitude` DOUBLE NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `category` VARCHAR(32) NOT NULL COMMENT '猛兽区/食草区/鸟类区',
  `cost_time` VARCHAR(32) DEFAULT '约30分钟',
  `difficulty` VARCHAR(32) DEFAULT '轻松',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 设施表
DROP TABLE IF EXISTS `facility`;
CREATE TABLE `facility` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `type` VARCHAR(32) NOT NULL COMMENT '厕所/超市/观景台/休息区',
  `longitude` DOUBLE NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `distance` VARCHAR(64) DEFAULT '' COMMENT '距入口等参考距离',
  `intro` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收藏表
DROP TABLE IF EXISTS `collection`;
CREATE TABLE `collection` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `scenic_id` BIGINT NOT NULL,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_scenic` (`user_id`,`scenic_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_scenic` (`scenic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 对话历史
DROP TABLE IF EXISTS `chat_history`;
CREATE TABLE `chat_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `user_input` TEXT,
  `ai_output` TEXT,
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `type` VARCHAR(64) DEFAULT 'qa' COMMENT '需求类型',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`,`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- 示例景点（坐标为演示数据，请以实测为准）
INSERT INTO `scenic` (`name`,`intro`,`image`,`longitude`,`latitude`,`category`,`cost_time`,`difficulty`) VALUES
('猛兽区观景台','俯瞰猛兽活动区，请保持安静，勿投喂。','',119.5965,39.9402,'猛兽区','约25分钟','轻松'),
('狮虎园','东北虎、非洲狮等猛兽展示，科普牌示丰富。','',119.5972,39.9405,'猛兽区','约20分钟','轻松'),
('食草动物区','长颈鹿、斑马等散养展示，适合亲子。','',119.5988,39.9395,'食草区','约35分钟','轻松'),
('长颈鹿互动广场','互动时间以当日公告为准，请排队文明参观。','',119.5990,39.9392,'食草区','约15分钟','轻松'),
('鸟类表演场','多种珍禽展示，表演场次见广播。','',119.5995,39.9378,'鸟类区','约30分钟','适中'),
('水禽湖','水禽栖息环境观察与拍照。','',119.5982,39.9375,'鸟类区','约20分钟','轻松');

-- 示例设施
INSERT INTO `facility` (`name`,`type`,`longitude`,`latitude`,`distance`,`intro`) VALUES
('园区东门厕所','厕所',119.5968,39.9382,'约200m','无障碍卫生间位于入口左侧'),
('中央超市','超市',119.5975,39.9390,'约800m','饮用水、简餐与纪念品'),
('狮虎园观景台','观景台',119.5972,39.9405,'约1.2km','猛兽区经典拍照机位'),
('林荫休息区','休息区',119.5980,39.9393,'约900m','座椅与遮阳'),
('北门卫生间','厕所',119.6000,39.9395,'约1.5km','靠近北门停车场'),
('湖畔观景台','观景台',119.5985,39.9376,'约1km','水禽湖全景');
