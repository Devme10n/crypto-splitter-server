const crypto = require('crypto');
const fs = require('fs');
const { isDirectory } = require('./pathUtils');

/**
 * 파일의 해시값을 생성.
 * @param {string} filePath - 해시값을 생성할 파일의 경로.
 * @returns {Promise<string>} 생성된 해시값을 resolve하는 Promise 객체.
 */
async function getFileHash(filePath) {
    try {
        // 경로가 디렉토리인지 확인.
        // 한번 밖에 안쓰일거면 하드코딩 하기
        const directoryCheck = await isDirectory(filePath);
        if (directoryCheck) {
            throw new Error(`경로 "${filePath}"는 파일이어야 합니다, 디렉토리가 지정되었습니다.`);
        }

        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        return new Promise((resolve, reject) => {
            stream.on('data', (data) => {
                hash.update(data);
            });

            stream.on('end', () => {
                resolve(hash.digest('hex'));
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    } catch (error) {
        console.error(`파일 ${filePath}에 대한 해시 생성 중 오류 발생:`, error);
        throw error;
    }
}

/**
 * 두 파일의 해시값을 비교.
 * @param {string} originalFilePath - 원본 파일의 경로.
 * @param {string} comparedFilePath - 비교할 파일의 경로.
 * @returns {Promise<boolean>} 두 파일이 동일한지 여부를 resolve하는 Promise 객체.
 */
async function compareFileHash(originalFilePath, comparedFilePath) {
    try {
        const originalFileHash = await getFileHash(originalFilePath);  // 원본 파일의 해시값
        const comparedFileHash = await getFileHash(comparedFilePath);  // 비교 대상 파일의 해시값

        if (originalFileHash === comparedFileHash) {
            console.log(`파일 ${originalFilePath}와 ${comparedFilePath}는 동일합니다.`);
            return true;
        } else {
            console.log(`파일 ${originalFilePath}와 ${comparedFilePath}는 다릅니다.`);
            return false;
        }
    } catch (error) {
        console.error('파일 해시 비교 중 오류 발생:', error);
        return false; // 해시값이 동일하지 않은 경우 로직 필요
    }
}

module.exports = {
    getFileHash,
    compareFileHash
};
