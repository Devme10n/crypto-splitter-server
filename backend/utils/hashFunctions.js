const crypto = require('crypto');
const fsp = require('fs').promises;

// 파일의 해시 값을 계산하는 함수
async function calculateFileHash(filePath) {
    const hash = crypto.createHash('sha256');
    const data = await fsp.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
}

// 두 파일의 해시 값을 비교하는 함수
async function compareFileHash(filePath1, filePath2) {
    const hash1 = await calculateFileHash(filePath1);
    const hash2 = await calculateFileHash(filePath2);

    console.log(`Comparing files:\n${filePath1} -> Hash: ${hash1}\n${filePath2} -> Hash: ${hash2}`);
    if (hash1 === hash2) {
        console.log('Files are identical.\n');
    } else {
        console.log('Files are different.\n');
    }
}

// 여러 파일을 서로 비교하는 함수
async function compareMultipleFiles(filePaths) {
    for (let i = 0; i < filePaths.length; i++) {
        for (let j = i + 1; j < filePaths.length; j++) {
            await compareFileHash(filePaths[i], filePaths[j]);
        }
    }
}

module.exports = { calculateFileHash, compareFileHash, compareMultipleFiles };