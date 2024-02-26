const splitFile = require('split-file');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');


const tempPath = path.join(__dirname, '..', 'temp');

/**
 * 임시 디렉토리 확인 및 생성
 * @description temp 폴더가 존재하지 않으면 생성. 이미 존재하는 경우, 내용을 비우고 다시 생성.
 */
async function ensureTempDirectory() {
    try {
        // 디렉토리 존재 여부 확인
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
    try {
        // 임시 디렉토리 생성
        await fs.mkdir(tempPath);
        logger.info(`임시 디렉토리 생성됨: ${tempPath}`);
    } catch (error) {
        logger.error(`임시 디렉토리 처리 중 오류 발생: ${error.message}`);
        throw error;
    }
}

//---------------------------------------------------------
// 1. 파일 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 2. 파일명 AES 암호화
// DES 암호화 사용 X -> AES 암호화 사용(암호화 표준)
// 호환성 문제를 위해 aes-192-cbc 사용
//---------------------------------------------------------
// AES 암호화 설정
const AES_algorithm = 'aes-192-cbc';
const AES_password = '비밀번호';
const AES_key = crypto.scryptSync(AES_password, 'salt', 24);
const AES_iv = Buffer.alloc(16, 0);

/**
 * 파일명을 AES 암호화하여 반환
 * @description 주어진 파일명을 AES 암호화 알고리즘을 사용하여 암호화.
 * @param {string} fileName 암호화할 원본 파일명
 * @return {string} 암호화된 파일명
 */
function encryptFilename(fileName) {
    const cipher = crypto.createCipheriv(AES_algorithm, AES_key, AES_iv);
    let encrypted = cipher.update(fileName, 'utf8', 'hex');
    // base64 인코딩을 사용하면 파일명에 사용할 수 없는 문자가 포함될 수 있음 -> hex 인코딩 사용
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * 파일명 변경 (비동기)
 * @description 주어진 경로의 파일명을 주어진 새 파일명으로 변경합니다.
 * @param {string} filePath 원본 파일 경로
 * @param {string} newFileName 변경할 새 파일명
 * @return {string} 변경된 파일의 경로
 */
async function changeFilename(filePath, newFileName) {
    const dirPath = path.dirname(filePath);
    const newFilePath = path.join(dirPath, newFileName);
    await fs.rename(filePath, newFilePath);
    logger.info(`파일명 변경 완료: ${newFilePath}`);
    return newFilePath;
}

/**
 * 2. 파일명 암호화 및 변경 처리 함수
 * @description 파일명을 암호화하고, 변경된 파일명으로 파일명을 업데이트.
 * @param {string} filePath 처리할 파일의 경로
 * @return {string} 변경된 파일의 경로
 */
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
        throw error;
    }
}

//---------------------------------------------------------
// 3. 파일 RSA 암호화 (아직 구현되지 않음)
// "data too large for key size" 오류가 발생
// 1. 파일을 작은 덩어리로 나누어 각각 암호화하는 방법
// 2. 대칭 키를 사용하여 파일을 암호화하고 해당 대칭 키를 RSA 공개키로 암호화하는 Hybrid 암호화 방법
// 합당한 방법을 고려해야함.
//---------------------------------------------------------
// 내장 라이브러리 crypto 대신 외부 라이브러리 사용하기
//---------------------------------------------------------
/**
 * RSA 암호화 설정
 * @param {string} inputFilePath 원본 파일 경로
 * @param {number} outputFilePath 암호화된 파일이 저장될 경로
 * @param {number} publicKeyPath 공개키 파일 경로
 * @return {string[]} originalFileNames 원본 파일명 배열
*/
async function encryptFile(inputFilePath, outputFilePath, publicKeyPath) {
    // 공개키 불러오기
    const publicKey = await fs.readFile(publicKeyPath, 'utf8');

    // 파일 읽기
    const fileData = await fs.readFile(inputFilePath);
    console.log(fileData)
    // 파일 데이터 암호화
    const encryptedData = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        fileData
    );

    // 암호화된 데이터를 파일로 저장
    await fs.writeFile(outputFilePath, encryptedData);
    console.log('File encrypted.');
}

// 사용 예
// const inputFilePath = path.join(__dirname, '..', 'uploadfile', 'dummyfile');
// const outputFilePath = path.join(__dirname, '..', 'uploadfile', 'dummyfile');
// const publicKeyPath = path.join(__dirname, '..', 'key', 'public_key.pem');
// encryptFile(inputFilePath, outputFilePath, publicKeyPath);

//---------------------------------------------------------
// 4. 파일 분할
//---------------------------------------------------------

/**
 * 4. 파일 분할
 * @description 주어진 파일을 지정된 개수의 조각으로 분할하고, 분할된 파일들을 지정된 폴더에 저장. 분할 과정에서 오류가 발생하면 생성된 폴더와 파일들을 롤백하여 삭제.
 * @param {string} encryptedFilePath RSA 암호화된 파일 경로
 * @param {number} splitCount 조각 개수(default: 100)
 * @return {Object} 분할 결과 객체, 포함하는 내용:
 *  - {string[]} originalFileNames: 원본 파일명 배열
 *  - {string} splitFilesPath: 조각 파일들이 저장된 폴더 경로
*/
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
            await deleteFolderAndFiles(splitFilesPath);
        }
        throw err;
    }
}

//---------------------------------------------------------
// writer.js 모듈의 최종 함수
// 이거 분리해서 app.js로 보내는게 맞지 않나?
//---------------------------------------------------------
/**
 * writer.js 모듈의 최종 함수, 파일 처리 및 분할의 최종 과정을 수행.
 * @description 임시 디렉토리를 생성하고, 파일명을 암호화한 후, 파일을 지정된 개수의 조각으로 분할. 분할된 파일 조각들은 지정된 폴더에 저장.
 * @param {string} originalFilePath 원본 파일 경로
 * @param {number} splitCount 분할할 조각의 개수
 * @return {Object} 분할 결과 객체, 포함하는 내용:
 *  - {string[]} originalFileNames: 원본 파일명 배열
 *  - {string} splitFilesPath: 조각 파일들이 저장된 폴더 경로
 */
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
        // 롤백 로직
        throw error;
    }
}


module.exports = {
    ensureTempDirectory,
    changeFilename,
    processFilename,
    splitEncryptedFile,
    encryptAndSplitFile
};