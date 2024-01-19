const splitFile = require('split-file');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;

const { getFileHash, compareFileHash } = require('./comparefile');

// 임시 디렉토리 경로
const tempPath = path.join(__dirname, 'temp');

// 임시 디렉토리 확인 및 생성
async function ensureTempDirectory() {
    if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true }); // 디렉토리가 존재하면 삭제
    }
    fs.mkdirSync(tempPath); // 임시 디렉토리 생성
}

// 오류 출력 함수
function logError(err) {
    console.error(`오류가 발생했습니다: ${err.message}`);
    console.error(`오류 위치: ${err.stack}`);
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
// 4. 파일 분할 && 5. 분할된 파일들의 이름 변경 및 매핑 정보 생성
//---------------------------------------------------------

// UUID 배열 생성
function getUUIDArray(num) {
    const arr = [];
    for (let i = 0; i < num; i++) {
        arr.push(uuidv4());
    }
    return arr;
}

//#############################################################################################
// 2. 파일명 DES 암호화의 결과 => filePath => fileName추출 => 파일별 디렉토리 생성 => 파일 분할
// des 안함
//#############################################################################################
async function splitFileAndRename(filePath, splitFileNamesArray) {
    let renamedFilePaths = [];
    let splitFileOrderMapping = {}; 

    try {
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
        
        let originalFileNames;

        try {
            originalFileNames = await splitFile.splitFile(filePath, splitFileNamesArray.length);
        } catch(err) {
            const error = new Error(`파일 분할 중 오류 발생: ${err.message}`);
            logError(error);
            return { error };
        }
        
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
        
        console.log('파일 분할 및 이름 변경 완료');
        return { renamedFilePaths, splitFileOrderMapping };        
    } catch(err) {
        logError(err);
        return { error: err };
    }
}

//---------------------------------------------------------
// 6. 분할된 파일들을 인터넷에 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 7. fileOrderMapping 정보 저장 (아직 구현되지 않음)
//---------------------------------------------------------


//=============================================================================================
// 파일 병합
//=============================================================================================

//---------------------------------------------------------
// 8. fileOrderMapping 정보 조회 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 9. 분할된 파일들을 다운로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 10. 파일 정렬 && 11. 파일 병합
//---------------------------------------------------------
//#############################################################################################
// 분할된 파일들의 순서가 매핑된 순서와 일치한 상태여서 sort 함수를 사용하지 않아도 파일 병합이 가능함. -> 수정필요
//#############################################################################################
async function mergeFiles(splitFileNames, outputPath, splitFileOrderMapping) {
    try {
        // 분할된 파일들을 원래대로 정렬
        splitFileNames.sort((a, b) => splitFileOrderMapping[a] - splitFileOrderMapping[b]);

        // 파일 합치기
        await splitFile.mergeFiles(splitFileNames, outputPath);
        console.log('파일 합치기 완료');
    } catch(err) {
        console.log('Error: ', err);
    }
}

//---------------------------------------------------------
// 12. 파일명 복호화 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 13. 파일 복호화 (아직 구현되지 않음)
//---------------------------------------------------------

// 분할 작업을 수행하는 메인 함수
async function split_file() {
    await ensureTempDirectory();
    const uploadDirectoryPath = path.join(process.cwd(), 'uploadfile'); // 'uploadfile' 디렉토리 경로
    const uploadFilePath = path.join(uploadDirectoryPath, 'dummyfile');
    const uuidFileNamesArray = getUUIDArray(100); // 먼저 UUID 배열 생성
    const { renamedFilePaths, splitFileOrderMapping } = await splitFileAndRename(uploadFilePath, uuidFileNamesArray); 
    console.log("splitFileOrderMapping: ", splitFileOrderMapping)

    return { renamedFilePaths, splitFileOrderMapping, uploadFilePath };
}

// 병합 작업을 수행하는 메인 함수
async function merge_file({ renamedFilePaths, splitFileOrderMapping, uploadFilePath }) {
    // 파일 합치기
    const outputPath = path.join(process.cwd(), 'output', 'dummyfile-output.bin');
    await mergeFiles(renamedFilePaths, outputPath, splitFileOrderMapping); 

    // 원본 파일과 합쳐진 파일의 해시값 비교
    await compareFileHash(uploadFilePath, outputPath); // compareFileHash 함수를 사용하여 원본 파일과 합쳐진 파일의 해시값을 비교합니다.
}

// 메인 함수 실행
async function main() {
    const splitResult = await split_file();
    await merge_file(splitResult);
}

main();