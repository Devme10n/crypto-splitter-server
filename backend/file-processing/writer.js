const splitFile = require('split-file');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const { promisify } = require('util');
const finished = promisify(require('stream').finished);

const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

/**
 * 임시 디렉토리 확인 및 생성
 * @description 주어진 경로에 폴더가 존재하지 않으면 생성. 이미 존재하는 경우, 내용을 비우고 다시 생성.
 * @param {...string} paths 생성하거나 확인할 임시 폴더 경로들
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
// 2. 파일명 AES 암호화
// DES 암호화 사용 X -> AES 암호화 사용(암호화 표준)
//---------------------------------------------------------
// AES 암호화 설정 (파일명용)
const AES_algorithm_filename = 'aes-192-cbc';
const AES_passphrase_filename = '파일명용비밀번호';
const AES_key_filename = crypto.scryptSync(AES_passphrase_filename, 'saltForFilename', 24);
const AES_iv_filename = Buffer.alloc(16, 0); // 초기화 벡터

/**
 * 파일명을 AES 암호화하여 반환
 * @description 주어진 파일명을 AES 암호화 알고리즘을 사용하여 암호화.
 * @param {string} fileName 암호화할 원본 파일명
 * @return {string} hex로 인코딩된 암호화된 파일명
 */
function encryptFilename(fileName) {
    try {    
        const cipher = crypto.createCipheriv(AES_algorithm_filename, AES_key_filename, AES_iv_filename);
        let encrypted = cipher.update(fileName, 'utf8', 'hex');
        // base64 인코딩을 사용하면 파일명에 사용할 수 없는 문자가 포함될 수 있음 -> hex 인코딩 사용
        encrypted += cipher.final('hex');
        logger.info(`파일명 암호화 완료: ${encrypted}`);
        return encrypted;
    } catch (error) {
        logger.error(`파일명 암호화 중 오류 발생: ${error.message}`);
        throw error;
    }
}

/**
 * 파일명 변경 (비동기)
 * @description 주어진 경로의 파일명을 새 파일명으로 변경. 변경 후 새 경로 반환
 * @param {string} filePath 원본 파일 경로
 * @param {string} newFileName 변경할 새 파일명
 * @returns {Promise<string>} 변경된 파일의 경로
 */
async function changeFilename(filePath, newFileName) {
    try {
        const dirPath = path.dirname(filePath);
        const newFilePath = path.join(dirPath, newFileName);
        await fsp.rename(filePath, newFilePath);
        logger.info(`파일명 변경 완료: ${newFilePath}`);
        return newFilePath;
    } catch (error) {
        logger.error(`파일명 변경 중 오류 발생: ${error.message}`);
        throw error;
    }
}

/**
 * 2. 파일명 암호화 및 변경 처리 함수
 * @description 주어진 파일 경로의 파일명을 암호화한 후, 변경된 파일명으로 업데이트
 * @param {string} filePath 처리할 파일의 경로
 * @returns {Promise<string>} 변경된 파일의 경로
 */
async function processFilename(filePath) {
    const originalFileName = path.basename(filePath);
    let encryptedFileName, encryptedFilePath;

    try {
        encryptedFileName = encryptFilename(originalFileName);
        encryptedFilePath = changeFilename(filePath, encryptedFileName);

        return encryptedFilePath; // 성공 결과 반환
    } catch (error) {
        // 롤백 로직: encryptedFilePath가 설정되었으나 에러가 발생했을 경우 원래 파일명으로 복구
        if (encryptedFilePath) {
            try {
                changeFilename(encryptedFilePath, originalFileName);
                logger.info('롤백 완료: 원래 파일명으로 복구');
            } catch (rollbackError) {
                logger.error(`롤백 실패: ${rollbackError.message}`);
                throw rollbackError;
            }
        }
        throw error;
    }
}

//---------------------------------------------------------
// 3. 파일 암호화
//---------------------------------------------------------
/**
 * 파일 및 대칭키 암호화 처리
 * @description 파일 데이터를 암호화하고 생성된 대칭키를 공개키로 암호화.
 * @param {string} inputFilePath 암호화할 파일 경로
 * @param {string} publicKeyPath 공개키 파일 경로
 * @returns {Promise<Object>} 암호화 처리 결과 객체, 포함:
 *   - {string} outputFilePath: 암호화된 파일 경로
 *   - {Buffer} encryptedpassphrase: 암호화된 대칭키
 */
async function encryptFileAndKey(inputFilePath, publicKeyPath) {
    // 파일용 대칭키 생성 (파일마다 고유)
    const AES_passphrase_file = crypto.randomBytes(16).toString('hex'); // 안전한 랜덤 비밀번호 생성
    const AES_key_file = crypto.scryptSync(AES_passphrase_file, 'saltForFile', 32); // 파일용 대칭키 생성
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
        const encryptedPassphrase = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(AES_passphrase_file, 'hex')
        );
        logger.info('대칭키 공개키로 암호화 성공');

        return { outputFilePath, encryptedPassphrase }; // 암호화된 파일 데이터 경로와 암호화된 대칭키 반환
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
 * @description 지정된 파일을 지정된 수의 조각으로 나누고, 분할된 파일들을 지정된 폴더에 저장. 분할 과정 중 오류 발생 시 생성된 폴더 및 파일 롤백 및 삭제 처리.
 * @param {string} encryptedFilePath RSA 공개키로 암호화된 파일 경로
 * @param {number} splitCount 조각 수 (기본값: 100)
 * @returns {Promise<Object>} 분할 결과 객체, 포함:
 * - {string[]} originalFileNames: 원본 파일명 배열
 * - {string} splitFilesPath: 분할 파일이 저장된 폴더 경로
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
//---------------------------------------------------------
/**
 * server-side writer.js 모듈의 최종 함수, 파일 암호화 및 파일 분할 처리.
 * @description 파일과 파일명을 암호화한 후 암호화된 파일을 지정된 조각 수로 분할. 분할된 파일 조각들은 지정된 폴더에 저장.
 * @param {string} originalFilePath 원본 파일 경로
 * @param {string} publicKeyPath 공개키 파일 경로
 * @param {number} splitCount 분할할 조각의 수
 * @returns {Promise<Object>} 분할 결과 객체, 포함:
 *   - {string[]} originalFileNames: 원본 파일명 배열
 *   - {string} splitFilesPath: 분할된 파일이 저장된 폴더 경로
 *   - {string} encryptedPassphrase: 암호화된 대칭키
 */
async function encryptAndSplitFile(originalFilePath, publicKeyPath, splitCount) {
    try {
        console.log("\nwriter.js 모듈")

        // 2. 파일명을 암호화하고 변경
        const encryptedFileNamePath = await processFilename(originalFilePath);

        // 3. 파일을 대칭키로 암호화, 대칭키를 공개키로 암호화
        const { outputFilePath, encryptedPassphrase } = await encryptFileAndKey(encryptedFileNamePath, publicKeyPath);

        // 4. 암호화된 파일 경로를 사용하여 파일을 분할
        const { originalFileNames, splitFilesPath } = await splitEncryptedFile(outputFilePath, splitCount);
        return { encryptedPassphrase, originalFileNames, splitFilesPath };
    } catch (error) {
        logger.error(`파일 처리 및 분할 중 오류 발생: ${error.message}`);
        // TODO: 롤백 로직 + 클라이언트에 에러 전달
        throw error;
    }
}

/**
 * client-side writer.js 모듈의 최종 함수, 파일명 암호화 및 파일 분할 처리
 * @description 암호화된 파일 경로를 사용하여 파일명을 암호화하고, 지정된 수의 조각으로 파일을 분할
 * @param {string} encryptedFilePath 암호화된 파일 경로
 * @param {string} encryptedPassphrase 암호화된 패스프레이즈
 * @param {number} splitCount 파일을 분할할 조각의 수
 * @returns {Promise<Object>} 처리 결과 객체, 포함:
 *   - {string} encryptedPassphrase: 암호화된 패스프레이즈
 *   - {string[]} originalFileNames: 원본 파일명 배열
 *   - {string} splitFilesPath: 분할된 파일이 저장된 폴더 경로
 */
async function processEncryptedFileAndPassphrase(encryptedFilePath, encryptedPassphrase, splitCount) {
    try {
        console.log("\nwriter.js 모듈")

        // 2. 파일명을 암호화하고 변경
        const encryptedFileNamePath = await processFilename(encryptedFilePath);

        // 4. 암호화된 파일 경로를 사용하여 파일을 분할
        const { originalFileNames, splitFilesPath } = await splitEncryptedFile(encryptedFileNamePath, splitCount);

        return { encryptedPassphrase, originalFileNames, splitFilesPath };
    } catch (error) {
        logger.error(`파일 처리 및 분할 중 오류 발생: ${error.message}`);
        // TODO: 롤백 로직 + 클라이언트에 에러 전달
        throw error;
    }
}

module.exports = {
    ensureDirectories,
    encryptFilename,
    changeFilename,
    encryptAndSplitFile,
    processEncryptedFileAndPassphrase
};