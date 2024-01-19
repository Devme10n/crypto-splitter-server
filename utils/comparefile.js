const crypto = require('crypto');
const fs = require('fs');

function getFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

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
}

async function compareFileHash(originalFilePath, comparedFilePath) {
    const originalFileHash = await getFileHash(originalFilePath);  // 원본 파일의 해시값
    const comparedFileHash = await getFileHash(comparedFilePath);  // 비교 대상 파일의 해시값

    if (originalFileHash === comparedFileHash) {
        console.log(`파일 ${originalFilePath}와 파일 ${comparedFilePath}는 동일합니다.`);
        return true;
    } else {
        console.log(`파일 ${originalFilePath}와 파일 ${comparedFilePath}는 다릅니다.`);
        return false;
    }
}

module.exports = {
    getFileHash,
    compareFileHash
};
