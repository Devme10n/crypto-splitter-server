// app.js: 애플리케이션의 메인 실행 파일로서, writer, middle, reader 모듈의 기능을 조합하여 전체 프로세스를 실행

const path = require('path');
const { ensureTempDirectory, getUUIDArray, splitEncryptedFile } = require('./file-processing/writer');
const { renameFilesAndCreateMapping } = require('./file-processing/middle');
const { sortFiles, mergeFiles } = require('./file-processing/reader');
const { logError } = require('./utils/logger'); // logError 함수 import
const { compareFileHash } = require('./utils/comparefile'); // compareFileHash 함수 import (경로 수정)

// 분할 작업을 수행하는 메인 함수
async function split_file() {
    await ensureTempDirectory();
    const uploadDirectoryPath = path.join(process.cwd(), 'uploadfile'); // 'uploadfile' 디렉토리 경로
    const uploadFilePath = path.join(uploadDirectoryPath, 'dummyfile');
    const uuidFileNamesArray = getUUIDArray(100); // 먼저 UUID 배열 생성

    // 파일 분할
    const { originalFileNames, folderPath, error: splitError } = await splitEncryptedFile(uploadFilePath, uuidFileNamesArray.length);
    if (splitError) {
        logError(splitError);
        return;
    }

    // 분할된 파일들의 이름 변경 및 매핑 정보 생성
    const { renamedFilePaths, splitFileOrderMapping, error: renameError } = renameFilesAndCreateMapping(originalFileNames, uuidFileNamesArray, folderPath);
    if (renameError) {
        logError(renameError);
        return;
    }

    console.log("splitFileOrderMapping: ", splitFileOrderMapping);
    return { renamedFilePaths, splitFileOrderMapping, uploadFilePath };
}

// 병합 작업을 수행하는 메인 함수
async function merge_file({ renamedFilePaths, splitFileOrderMapping, uploadFilePath }) {
    // 파일 정렬
    const sortedFilePaths = sortFiles(renamedFilePaths, splitFileOrderMapping);

    // 파일 합치기
    const outputPath = path.join(process.cwd(), 'output', 'dummyfile-output.bin');
    await mergeFiles(sortedFilePaths, outputPath); 

    // 원본 파일과 합쳐진 파일의 해시값 비교
    const isFilesSame = await compareFileHash(uploadFilePath, outputPath);
    console.log(isFilesSame ? '파일이 일치합니다.' : '파일이 일치하지 않습니다.');
}

// 메인 함수 실행
async function main() {
    const splitResult = await split_file();
    if (!splitResult) {
        console.error('파일 분할 과정에서 오류가 발생했습니다.');
        return;
    }
    await merge_file(splitResult);
}

main();
