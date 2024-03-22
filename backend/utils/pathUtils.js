const fs = require('fs').promises;

/**
 * 제공된 경로가 디렉토리인지 확인.
 * @param {string} filePath - 확인할 경로.
 * @returns {Promise<boolean>} 경로가 디렉토리인 경우 true, 그렇지 않은 경우 false를 resolve하는 Promise 객체.
 */
async function isDirectory(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return stats.isDirectory();
    } catch (error) {
        console.error(`경로가 디렉토리인지 확인하는 도중 오류 발생: ${error}`);
        throw error;
    }
}

module.exports = {
    isDirectory,
};
