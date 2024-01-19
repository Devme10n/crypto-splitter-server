const fs = require('fs');
const path = require('path');
const { logError } = require('../utils/logger'); // logError 함수 import

//---------------------------------------------------------
// 5. 분할된 파일들의 이름 변경 및 매핑 정보 생성
//---------------------------------------------------------

// UUID 배열 생성
function getUUIDArray(num) {
    const arr = [];
    for (let i = 0; i < num; i++) {
        arr.push(uuidv4());
    }
    return arr;
}

function renameFilesAndCreateMapping(originalFileNames, splitFileNamesArray, folderPath) {
let renamedFilePaths = [];
let splitFileOrderMapping = {};

originalFileNames.forEach((name, index) => {
    const oldPath = name;
    const newPath = path.join(folderPath, splitFileNamesArray[index]);

    try {
        fs.renameSync(oldPath, newPath);
    } catch(err) {
        const error = new Error(`파일 이름 변경 중 오류 발생: ${err.message}`);
        logError(error);
        fs.rmSync(folderPath, { recursive: true }); // 오류 발생 시 생성된 디렉토리 삭제
        return { error };
    }

    renamedFilePaths.push(newPath);
    splitFileOrderMapping[splitFileNamesArray[index]] = index;
    });

    console.log('파일 이름 변경 및 매핑 정보 생성 완료');
    return { renamedFilePaths, splitFileOrderMapping };
}

//---------------------------------------------------------
// 6. 분할된 파일들을 인터넷에 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 7. fileOrderMapping 정보 저장 (아직 구현되지 않음)
//---------------------------------------------------------

module.exports = {
    renameFilesAndCreateMapping
    //... (6~7번 기능의 export)
};
