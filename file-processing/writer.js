const splitFile = require('split-file');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const { logError } = require('../utils/logger'); // logError 함수 import

// 임시 디렉토리 경로
const tempPath = path.join(__dirname, 'temp');

// 임시 디렉토리 확인 및 생성
async function ensureTempDirectory() {
    if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true }); // 디렉토리가 존재하면 삭제
    }
    fs.mkdirSync(tempPath); // 임시 디렉토리 생성
}

//=============================================================================================
// 파일 분할
//=============================================================================================

//---------------------------------------------------------
// 1. 파일 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 2. 파일명 DES 암호화 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 3. 파일 RSA 암호화 (아직 구현되지 않음)
//---------------------------------------------------------


//---------------------------------------------------------
// 4. 파일 분할
//---------------------------------------------------------

// UUID 배열 생성
function getUUIDArray(num) {
    const arr = [];
    for (let i = 0; i < num; i++) {
        arr.push(uuidv4());
    }
    return arr;
}

async function splitEncryptedFile(filePath, splitCount) { // 이름을 splitEncryptedFile로 변경함
    let originalFileNames;
    
    if (!fs.existsSync(filePath)) {
        const err = new Error(`파일이 존재하지 않습니다: ${filePath}`);
        logError(err);
        return { error: err };
    }
    
    const fileName = path.basename(filePath);
    const folderPath = path.join(process.cwd(), 'temp', fileName);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    
    try {
        originalFileNames = await splitFile.splitFile(filePath, splitCount);
    } catch(err) {
        const error = new Error(`파일 분할 중 오류 발생: ${err.message}`);
        logError(error);
        return { error };
    }
    
    console.log('파일 분할 완료');
    return { originalFileNames, folderPath };
}

module.exports = {
    ensureTempDirectory,
    getUUIDArray,
    splitEncryptedFile
};
