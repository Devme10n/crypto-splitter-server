'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Define FileMappingJson
const FileMappingJson = require('./postgreSQLModels');

// Add model to db object
db['FileMappingJson'] = FileMappingJson;

// 모델 관계 등 설정 가능

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// 모델 동기화
(async () => {
  await db.sequelize.sync();
  console.log('PostgreSQL 모델과 데이터베이스 동기화 완료.');
})();

module.exports = db;