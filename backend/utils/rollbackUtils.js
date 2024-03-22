const fs = require('fs').promises;
const { logger } = require('./logger');

async function deleteFolderAndFiles(folderPath) {
    try {
        await fs.rm(folderPath, { recursive: true, force: true });
        logger.info(`롤백: 폴더 및 하위 파일 삭제됨 - ${folderPath}`);
    } catch (error) {
        logger.error(`롤백 실패: 폴더 및 하위 파일 삭제 중 오류 발생 - ${error.message}`);
    }
}

module.exports = {
    deleteFolderAndFiles
};