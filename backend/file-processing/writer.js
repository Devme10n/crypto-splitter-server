const splitFile = require('split-file');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const { promisify } = require('util');
const finished = promisify(require('stream').finished);

const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

const tempPath = path.join(__dirname, '..', 'temp');
const internetPath = path.join(__dirname, '..', 'internet');
const outputPath = path.join(__dirname, '..', 'output');
const resultPath = path.join(__dirname, '..', 'result');
const encryptedfilePath = path.join(__dirname, '..', 'encryptedfile');

/**
 * 임시 디렉토리 확인 및 생성
 * @description temp 폴더가 존재하지 않으면 생성. 이미 존재하는 경우, 내용을 비우고 다시 생성.
 */
async function ensureDirectories(...paths) {
    for (const tempPath of paths) {
        try {
            // 디렉토리 존재 여부 확인
            await fsp.access(tempPath);

            // 디렉토리가 존재하면 삭제
            await fsp.rm(tempPath, { recursive: true });
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
            await fsp.mkdir(tempPath);
            logger.info(`임시 디렉토리 생성됨: ${tempPath}`);
        } catch (error) {
            logger.error(`임시 디렉토리 처리 중 오류 발생: ${error.message}`);
            throw error;
        }
    }
}

//---------------------------------------------------------
// 1. 파일 업로드 (아직 구현되지 않음)
//---------------------------------------------------------

//---------------------------------------------------------
// 2. 파일명 AES 암호화
// DES 암호화 사용 X -> AES 암호화 사용(암호화 표준)
//---------------------------------------------------------
// AES 암호화 설정 (파일명용)
const AES_algorithm_filename = 'aes-192-cbc';
const AES_password_filename = '파일명용비밀번호';
const AES_key_filename = crypto.scryptSync(AES_password_filename, 'saltForFilename', 24);
const AES_iv_filename = Buffer.alloc(16, 0); // 초기화 벡터

/**
 * 파일명을 AES 암호화하여 반환
 * @description 주어진 파일명을 AES 암호화 알고리즘을 사용하여 암호화.
 * @param {string} fileName 암호화할 원본 파일명
 * @return {string} 암호화된 파일명
 */
function encryptFilename(fileName) {
    const cipher = crypto.createCipheriv(AES_algorithm_filename, AES_key_filename, AES_iv_filename);
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
    await fsp.rename(filePath, newFilePath);
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
        encryptedFilePath = changeFilename(filePath, encryptedFileName);

        logger.info(`파일명 암호화 완료: ${encryptedFilePath}`);
        return encryptedFilePath; // 성공 결과 반환
    } catch (error) {
        logger.error(`파일명 암호화 중 오류 발생: ${error.message}`);

        // 롤백 로직: encryptedFilePath가 설정되었으나 에러가 발생했을 경우 원래 파일명으로 복구
        if (encryptedFilePath) {
            try {
                changeFilename(encryptedFilePath, originalFileName);
                logger.info('롤백 완료: 원래 파일명으로 복구');
            } catch (rollbackError) {
                logger.error(`롤백 실패: ${rollbackError.message}`);
            }
        }
        throw error;
    }
}

//---------------------------------------------------------
// 3. 파일 암호화
//---------------------------------------------------------
// 대칭키로 파일 암호화 및 공개키로 대칭키 암호화 함수
async function encryptFileAndKey(inputFilePath, publicKeyPath) {
    // 파일용 대칭키 생성 (파일마다 고유)
    const AES_password_file = crypto.randomBytes(16).toString('hex'); // 안전한 랜덤 비밀번호 생성
    const AES_key_file = crypto.scryptSync(AES_password_file, 'saltForFile', 32); // 파일용 대칭키 생성
    const AES_iv_file = crypto.randomBytes(16); // 파일용 초기화 벡터 생성
    
    const outputFilePath = inputFilePath.replace('/uploadfile/', '/encryptedfile/');
    try {
        // 스트림을 사용하여 파일 데이터 암호화
        const readStream = fs.createReadStream(inputFilePath);
        const writeStream = fs.createWriteStream(outputFilePath);
        const cipher = crypto.createCipheriv('aes-256-cbc', AES_key_file, AES_iv_file);

        // IV를 파일 앞에 붙임
        writeStream.write(AES_iv_file);
        readStream.pipe(cipher).pipe(writeStream);

        await finished(writeStream);

        logger.info(`파일 데이터 암호화 성공: ${outputFilePath}`);

        // 정상적으로 암호화된 파일이 생성되었으므로 원본 파일 삭제
        await deleteFolderAndFiles(inputFilePath);
    } catch (error) {
        logger.error(`파일 데이터 암호화 중 오류 발생: ${error.message}`);
        throw error;
    }

    try {
        // 공개키로 대칭키 암호화
        const publicKey = await fsp.readFile(publicKeyPath, 'utf8');
        const encryptedPassword = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(AES_password_file, 'hex')
        );
        logger.info('대칭키 공개키로 암호화 성공');

        return { outputFilePath, encryptedPassword }; // 암호화된 파일 데이터 경로와 암호화된 대칭키 반환
    } catch (error) {
        logger.error(`대칭키 공개키로 암호화 중 오류 발생: ${error.message}`);
        throw error;
    }
}

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
        splitFilesPath = path.join(__dirname, '..', 'temp', encryptedFileName);

        // 디렉토리 존재 여부 확인 및 생성
        const dirExists = await fsp.access(splitFilesPath).then(() => true).catch(() => false);
        if (!dirExists) {
            await fsp.mkdir(splitFilesPath, { recursive: true });
        }

        const originalFileNames = await splitFile.splitFile(encryptedFilePath, splitCount, splitFilesPath);
        logger.info(`파일 분할 완료: ${splitFilesPath}`);
        await deleteFolderAndFiles(encryptedFilePath);
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
async function encryptAndSplitFile(originalFilePath, publicKeyPath, splitCount) {
    try {
        // 임시 디렉토리 설정
        await ensureDirectories(tempPath, internetPath, outputPath, resultPath, encryptedfilePath);

        // 파일명을 암호화하고 변경
        const encryptedFilePath = await processFilename(originalFilePath);

        // 파일을 대칭키로 암호화, 대칭키를 공개키로 암호화
        const { outputFilePath, encryptedPassword } = await encryptFileAndKey(encryptedFilePath, publicKeyPath);

        // 암호화된 파일 경로를 사용하여 파일을 분할
        const { originalFileNames, splitFilesPath } = await splitEncryptedFile(outputFilePath, splitCount);

        return { encryptedPassword, originalFileNames, splitFilesPath };
    } catch (error) {
        logger.error(`파일 처리 및 분할 중 오류 발생: ${error.message}`);
        // 롤백 로직
        throw error;
    }
}


module.exports = {
    ensureDirectories,
    changeFilename,
    processFilename,
    splitEncryptedFile,
    encryptAndSplitFile
};