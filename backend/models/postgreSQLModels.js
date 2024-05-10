// server/backend/models/postgreSQLModels.js
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config({ path: '../../env/server.env' });

// 환경 변수 확인
function checkEnvironmentVariables() {
    const envVars = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
    const missingVars = envVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error('Missing required environment variables:', missingVars.join(', '));
        process.exit(1); // Exit the application with an error code
    }
}

checkEnvironmentVariables();

const sequelize = new Sequelize(
    process.env.DB_NAME,    // Environment variable for database name
    process.env.DB_USER,    // Environment variable for database username
    process.env.DB_PASSWORD, // Environment variable for database password
    {
        host: process.env.DB_HOST,    // Environment variable for database host
        dialect: 'postgres',
        logging: (msg) => console.log(msg)
    }
);

// 데이터베이스 연결 테스트
sequelize.authenticate()
    .then(() => console.log('데이터베이스에 성공적으로 연결되었습니다.'))
    .catch(err => console.error('데이터베이스에 연결할 수 없습니다:', err));

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
        type: DataTypes.TEXT,
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