const splitFile = require('split-file');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

// 임시 디렉토리 경로
const tempPath = path.join(__dirname, '..', 'temp');

async function ensureTempDirectory() {
    try {
        try {
            await fs.access(tempPath);
            // 디렉토리가 존재하면 삭제
            await fs.rm(tempPath, { recursive: true });
            logger.info(`임시 디렉토리 삭제됨: ${tempPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                // ENOENT 이외의 오류는 예상하지 못한 오류이므로, 로그를 남기고 예외를 다시 던짐
                logger.error(`임시 디렉토리 확인 중 오류 발생: ${error.message}`);
                throw error;
            }
            // ENOENT 오류는 디렉토리가 존재하지 않을 때 발생하는 정상적인 오류 (무시)
        }

        // 임시 디렉토리 생성
        await fs.mkdir(tempPath);
        logger.info(`임시 디렉토리 생성됨: ${tempPath}`);
    } catch (error) {
        logger.error(`임시 디렉토리 처리 중 오류 발생: ${error.message}`);
        throw error; // 오류를 상위 호출자에게 전파
    }
}

//=============================================================================================
// 파일 분할
//=============================================================================================

//---------------------------------------------------------
// 1. 파일 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 2. 파일명 DES 암호화 (아직 구현되지 않음)
// DES 암호화 사용 X -> AES 암호화 사용
// 호환성 문제를 위해 aes-192-cbc 사용
//---------------------------------------------------------
// AES 암호화 설정
const algorithm = 'aes-192-cbc';
const password = '비밀번호';
const key = crypto.scryptSync(password, 'salt', 24);
const iv = Buffer.alloc(16, 0);

// 파일명 암호화 함수
function encryptFilename(fileName) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(fileName, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 암호화된 파일명으로 파일명 변경 함수 (비동기)
async function changeFilename(filePath, encryptedFileName) {
    const dirPath = path.dirname(filePath);
    const encryptedFilePath = path.join(dirPath, encryptedFileName);
    await fs.rename(filePath, encryptedFilePath);
    logger.info(`파일명 변경 완료: ${encryptedFilePath}`);
    return encryptedFilePath;
}

// 파일명 암호화 및 변경 처리 함수
async function processFilename(filePath) {
    const originalFileName = path.basename(filePath);
    let encryptedFileName, encryptedFilePath;

    try {
        encryptedFileName = encryptFilename(originalFileName);
        encryptedFilePath = await changeFilename(filePath, encryptedFileName);

        logger.info(`파일 처리 완료: ${encryptedFilePath}`);
        return encryptedFilePath; // 성공 결과 반환
    } catch (error) {
        logger.error(`파일 처리 중 오류 발생: ${error.message}`);

        // 롤백 로직: encryptedFilePath가 설정되었으나 에러가 발생했을 경우 원래 파일명으로 복구
        if (encryptedFilePath) {
            try {
                await changeFilename(encryptedFilePath, originalFileName);
                logger.info('롤백 완료: 원래 파일명으로 복구');
            } catch (rollbackError) {
                logger.error(`롤백 실패: ${rollbackError.message}`);
            }
        }

        throw error; // 오류를 상위 호출자에게 전파
    }
}

//---------------------------------------------------------
// 3. 파일 RSA 암호화 (아직 구현되지 않음)
//---------------------------------------------------------


//---------------------------------------------------------
// 4. 파일 분할
//---------------------------------------------------------

// 파일 분할 함수
async function splitEncryptedFile(encryptedFilePath, splitCount) {
    let splitFilesPath = null;

    try {
        // 암호화된 파일명으로 폴더 및 파일 분할 작업 수행
        const encryptedFileName = path.basename(encryptedFilePath); // 암호화된 파일명 추출
        splitFilesPath = path.join(process.cwd(), 'temp', encryptedFileName);

        // 디렉토리 존재 여부 확인 및 생성
        const dirExists = await fs.access(splitFilesPath).then(() => true).catch(() => false);
        if (!dirExists) {
            await fs.mkdir(splitFilesPath, { recursive: true });
        }

        const originalFileNames = await splitFile.splitFile(encryptedFilePath, splitCount, splitFilesPath);
        logger.info('파일 분할 완료');
        return { originalFileNames, splitFilesPath };
    } catch(err) {
        logger.error(`파일 분할 중 오류 발생: ${err.message}`);
        // 롤백 로직: 폴더 및 하위 파일 삭제
        if (splitFilesPath) {
            await deleteFolderAndFiles(splitFilesPath);  // 롤백: 폴더 및 하위 파일 삭제
        }
        throw err;  // 오류를 상위 호출자에게 전파
    }
}

async function encryptAndSplitFile(originalFilePath, splitCount) {
    try {
        // 임시 디렉토리 설정
        await ensureTempDirectory();

        // 파일명을 암호화하고 변경
        const encryptedFilePath = await processFilename(originalFilePath);

        // 암호화된 파일 경로를 사용하여 파일을 분할
        const splitResult = await splitEncryptedFile(encryptedFilePath, splitCount);

        return splitResult;
    } catch (error) {
        logger.error(`파일 처리 및 분할 중 오류 발생: ${error.message}`);
        // 필요한 경우 추가적인 롤백 작업 수행
        throw error; // 오류를 상위 호출자에게 전파
    }
}


module.exports = {
    ensureTempDirectory,
    changeFilename,
    processFilename,
    splitEncryptedFile,
    encryptAndSplitFile
};
