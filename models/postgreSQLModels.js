const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('database_development', 'mac', 'password', {
    host: 'localhost',
    dialect: 'postgres',
    logging: console.log
});

// 모델 정의
const FileMappingJson = sequelize.define('file_mapping_json', {
    encrypted_filename: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    mapping_info: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    encrypted_symmetric_key: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// 테이블 생성
FileMappingJson.sync({ force: true }).then(() => {
    console.log('테이블이 성공적으로 업데이트되었습니다.');
}).catch(err => {
    console.error('테이블 업데이트 중 오류 발생:', err);
});

module.exports = FileMappingJson;
