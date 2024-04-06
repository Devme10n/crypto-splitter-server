const fs = require('fs');
const fsp = require('fs').promises;
const axios = require('axios');
const path = require('path');
const splitFile = require('split-file');
const crypto = require('crypto');

const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

const FileMappingJson = require('../models/postgreSQLModels');
const { changeFilename, encryptFilename } = require('./writer');

//=============================================================================================
// 파일 병합
//=============================================================================================

//---------------------------------------------------------
// 8. fileOrderMapping 정보 조회
//---------------------------------------------------------
//TODO: mapping data + encryptedPassphrase를 2번 조회하는 것을 1번으로 줄일 수 있는 방법이 있는지 확인
/**
 * 암호화된 파일명에 해당하는 매핑 데이터 검색
 * @description 주어진 암호화된 파일명에 해당하는 매핑 정보와 암호화된 passphrase를 데이터베이스에서 검색.
 * @returns {Promise<Object>} 검색된 매핑 정보 및 암호화된 passphrase, 포함:
 *   - {Object} mappingInfo: 매핑 정보.
 *   - {string} encryptedPassphrase: 암호화된 passphrase.
 */
async function getFileMappingData(encryptedFilename) {
    try {
        // 데이터베이스에서 파일 데이터 검색
        const fileData = await FileMappingJson.findOne({
            where: { encrypted_filename: encryptedFilename }
        });

        // 데이터가 없으면 오류 발생
        if (!fileData) {
            logger.error(`데이터베이스에 존재하지 않습니다: ${encryptedFilename}`);
            throw new Error(`$데이터베이스에 존재하지 않습니다: ${encryptedFilename}`);
        }
        logger.info(`매핑 데이터 검색 완료: ${encryptedFilename}`);
        // 단일 객체로 모든 필요한 데이터 반환
        return {
            mappingInfo: fileData.mapping_info, // 매핑 정보
            encryptedPassphrase: fileData.encrypted_symmetric_key // base64 인코딩된 암호화된 passphrase
        };
    } catch (error) {
        logger.error(`파일 매핑 데이터 검색 중 오류 발생: ${encryptedFilename}`, error);
        throw error;
    }
}

/**
 * 암호화된 파일명을 이용한 매핑 정보 사용
 * @description 주어진 암호화된 파일명을 통해 매핑 정보를 조회하고 사용.
 * @param {string} encryptedFilename 암호화된 파일명
 * @returns {Promise<Object|null>} 조회된 매핑 정보. 정보가 없을 경우 null 반환.
 */
async function useMappingInfo(encryptedFilename) {
    try {
        const fileData = await getFileMappingData(encryptedFilename);
        if (!fileData) {
            logger.error(`${encryptedFilename}에 대한 파일 데이터를 찾을 수 없습니다.`);
            return null;
        }
        logger.info(`${encryptedFilename}에 대한 매핑 정보 사용 중`);
        return fileData.mappingInfo;
    } catch (error) {
        logger.error(`${encryptedFilename}을(를) 사용하는 중 오류 발생`, error);
        throw error;
    }
}

//---------------------------------------------------------
// 9. 분할된 파일들 다운로드
// Promise.all()을 사용하여 병렬로 다운로드
//---------------------------------------------------------
/**
 * 주어진 매핑 정보를 사용하여 파일 URL 배열을 생성
 * @param {*} mappingInfo 
 * @returns 
 */
async function getFileUrls(mappingInfo) {
    const uuids = Object.keys(mappingInfo);
    const urls = uuids.map(uuid => `${process.env.FILE_SERVER_URL}/download/${uuid}`);
    return urls;
}

/**
 * 매핑 정보에서 UUID 추출
 * @description 주어진 매핑 정보 객체에서 UUID 추출.
 * @param {Object|null} mappingInfo 매핑 정보 객체
 * @returns {string[]} 추출된 UUID 목록. 매핑 정보가 객체가 아니거나 null일 경우 빈 배열 반환.
 */
async function extractUuids(mappingInfo) {
    try {
        if (typeof mappingInfo !== 'object' || mappingInfo === null) {
            return [];
        }
        const uuids = Object.keys(mappingInfo);
        return uuids;
    } catch (error) {
        logger.error(`UUID 추출 중 오류 발생: ${error}`);
        throw error;
    }
}

/**
 * 9. 주어진 URL에서 파일을 다운로드.
 * @description 주어진 URL과 UUID 목록을 사용하여 파일을 다운로드, 지정된 폴더에 저장.
 * @param {string} url 파일을 다운로드할 서버의 URL
 * @param {string[]} uuids 다운로드할 파일의 UUID 목록
 * @param {string} destFolder 파일을 저장할 대상 폴더 경로
 * @returns {Promise<string[]>} 다운로드된 파일의 경로 목록. 다운로드에 실패하면 에러 로그를 출력하고 undefined 반환 가능.
 */
async function downloadFiles(url, uuids, destFolder) {
    try {
        // URL 유효성 검사
        new URL(url);

        const downloadedFilePaths = await Promise.all(uuids.map(async (uuid, index) => {
            const response = await axios({
                method: 'post',
                url: url,
                data: { uuids: [uuid] }, // UUID 배열을 요청 본문에 포함합니다.
                responseType: 'stream'
            });
            const filePath = path.join(destFolder, `${index}-${uuid}`);
            const writer = fs.createWriteStream(filePath);
            
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        }));
        logger.info(`파일 다운로드 완료: ${downloadedFilePaths[downloadedFilePaths.length - 1]}`);
        return downloadedFilePaths;
    } catch (error) {
        logger.error(`파일 다운로드 실패: ${error}`);
    }
}

//---------------------------------------------------------
// 10. 파일 정렬
//---------------------------------------------------------
/**
 * 10. 매핑 정보에 따라 파일 정렬
 * @description 매핑 정보를 사용하여 주어진 파일 경로 목록을 원본 파일 순서대로 정렬.
 * @param {string[]} filesPath 정렬할 파일 경로 배열
 * @param {Object} mappingInfo 파일명과 원본 파일 순서 사이의 매핑 정보
 * @returns {Promise<string[]>} 매핑 정보에 따라 정렬된 파일 경로 배열. 정렬 과정에서 경로가 누락된 경우 에러 발생.
 */
async function sortFilesByMappingInfo(filesPath, mappingInfo) {
    // 매핑 정보를 배열로 변환하고 원본 파일 순서를 기반으로 정렬합니다.
    const sortedFilePaths = Object.entries(mappingInfo)
        // 각 항목을 원본 인덱스(각 항목의 값 부분)를 기준으로 정렬합니다.
        .sort((a, b) => a[1] - b[1])
        // 정렬된 항목을 해당 파일 경로로 다시 매핑합니다.
        .map(([newFileName]) => filesPath.find(path => path.includes(newFileName)));

    // 정렬된 파일 경로 중 일부가 누락되었는지 확인합니다.
    if (sortedFilePaths.some(path => path === undefined)) {
        throw new Error('일부 정렬된 파일 경로가 누락되었습니다.');
    }

    return sortedFilePaths;
}

//---------------------------------------------------------
// 11. 파일 병합
//---------------------------------------------------------
/**
 * 11. 정렬된 파일 병합
 * @description 정렬된 파일 경로 배열을 사용하여 단일 파일로 병합, 지정된 출력 경로에 저장.
 * @param {string[]} sortedFilePaths 정렬된 파일 경로 배열
 * @param {string} outputPath 병합된 파일을 저장할 출력 경로
 * @param {string} mergedFileName 병합된 파일의 이름
 * @returns {Promise<string>} 병합된 파일의 전체 경로. 병합 과정 중 오류 발생 시, 해당 경로의 파일 및 폴더 삭제 후 오류 throw.
 */
async function mergeSortedFiles(sortedFilePaths, outputPath, mergedFileName) {
    try {
        const mergedFilePath = path.join(outputPath, mergedFileName);

        // 정렬된 파일들을 병합합니다.
        await splitFile.mergeFiles(sortedFilePaths, mergedFilePath);
        logger.info(`파일 병합 성공: ${mergedFilePath}`);
        return mergedFilePath;
    } catch (error) {
        logger.error('파일 병합 중 오류 발생:', error);
        deleteFolderAndFiles(outputPath);
        throw error;
    }
}

//---------------------------------------------------------
// 12. 파일명 복호화
// 대칭키는 어디에 저장되어 있어야 하는가?
// 1. 서버 2. db
// 계정당 발급? 통합으로 1개만 발급?(그나마 얘가 합당하지 않나?)
//---------------------------------------------------------
// AES 암호화 설정 (파일명용)
const AES_algorithm_filename = 'aes-192-cbc';
const AES_passphrase_filename = '파일명용비밀번호';
const AES_key_filename = crypto.scryptSync(AES_passphrase_filename, 'saltForFilename', 24);
const AES_iv_filename = Buffer.alloc(16, 0); // 초기화 벡터

/**
 * 암호화 파일명을 복호화하여 반환 (AES-192-CBC)
 * @description 주어진 암호화된 파일명을 복호화.
 * @param {string} encryptedFileName 복호화할 암호화된 파일명
 * @returns {string} 복호화된 파일명. 복호화 과정 중 오류 발생 시 로그를 남기고 오류 throw.
 */
function decryptFilename(encryptedFileName) {
    try {
        const decipher = crypto.createDecipheriv(AES_algorithm_filename, AES_key_filename, AES_iv_filename);
        let decrypted = decipher.update(encryptedFileName, 'hex', 'utf8');
        // hex -> utf8 인코딩
        decrypted += decipher.final('utf8');

        logger.info(`복호화된 파일명: ${decrypted}`);
        return decrypted;
    } catch (error) {
        logger.error(`파일명 복호화 중 오류 발생: ${encryptedFileName}`, error);
        throw error;
    }
}

/**
 * 12. 파일명 복호화 및 변경 처리 함수
 * @description 암호화된 파일명을 복호화하고, 변경된 파일명으로 파일명을 업데이트.
 * @param {string} encryptedFilePath 처리할 파일의 암호화된 경로
 * @return {Promise<string>} 복호화된 파일의 전체 경로를 반환하는 Promise.
 */
async function processDecryptedFilename(encryptedFilePath) {
    try {
        const encryptedFileName = path.basename(encryptedFilePath);

        const decryptedFileName = await decryptFilename(encryptedFileName);
        const decryptedFileNamePath = await changeFilename(encryptedFilePath, decryptedFileName);
        logger.info(`파일명 복호화 완료: ${decryptedFileNamePath}`);
        return decryptedFileNamePath;
    } catch (error) {
        logger.error(`파일명 복호화 중 오류 발생: ${error.message}`);
        throw error;
    }
}

//---------------------------------------------------------
// 13. 파일 복호화
//---------------------------------------------------------
/**
 * 암호화된 파일명에 대한 암호화된 passphrase 형식 정리
 * @description 주어진 암호화된 파일명에 해당하는 암호화된 passphrase를 검색, 형식을 정리.
 * @param {string} encryptedFilename 암호화된 파일명
 * @returns {Promise<string>} 형식이 정리된 암호화된 passphrase.
 */

async function formatEncryptedSymmetricKey(encryptedFilename) {
    try {
        const fileData = await getFileMappingData(encryptedFilename);
        if (!fileData || !fileData.encryptedPassphrase) {
            logger.error(`암호화된 passphrase를 찾을 수 없습니다: ${encryptedFilename}`);
            throw new Error(`암호화된 passphrase가 누락되었거나 정의되지 않았습니다: ${encryptedFilename}`);
        }
        // 암호화된 passphrase에서 공백과 줄바꿈 제거
        const formattedEncryptedKey = fileData.encryptedPassphrase.split(' ').join('').split('\n').join('').split('\r').join('');

        logger.info(`암호화된 passphrase 검색 완료: ${encryptedFilename}`);
        return formattedEncryptedKey;
    } catch (error) {
        logger.error(`암호화된 passphrase를 검색하거나 형식을 정리하는 중 오류 발생: ${encryptedFilename}`, error);
        throw error;
    }
}

/**
 * 암호화된 passphrase를 개인키로 복호화.
 * @description 주어진 암호화된 passphrase와 개인키 파일 경로를 사용하여 passphrase를 복호화.
 * @param {Buffer} encryptedPassphrase 암호화된 passphrase
 * @param {string} privateKeyPath 개인키 파일의 경로
 * @returns {Promise<Buffer>} 복호화된 passphrase를 반환합니다.
 */
async function decryptSymmetricKey(encryptedPassphrase, privateKeyPath) {
    try {
        const privateKey = await fsp.readFile(privateKeyPath, 'utf8');
        const decryptedPassphrase = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            encryptedPassphrase
        );
        logger.info(`passphrase 복호화 성공: ${decryptedPassphrase.toString('hex')}`);

        return decryptedPassphrase; // 복호화된 AES_passphrase 반환
    } catch (error) {
        logger.error(`passphrase 복호화 중 오류 발생: ${error}`);
        throw error;
    }
}

/**
 * 복호화된 passphrase로 암호화된 파일 복호화.
 * @description 복호화 과정에서 첫 청크로부터 초기화 벡터(IV)를 추출, 초기화 백터와 passphrase로 대칭키 생성, 파일의 나머지 부분을 생성한 대칭키를 사용하여 파일을 복호화, 복호화된 파일을 다른 파일에 저장.
 * @param {string} encryptedFilePath 암호화된 파일의 경로
 * @param {string} decryptedFilePath 복호화된 파일을 저장할 경로
 * @param {Buffer} decryptedPassphrase 복호화된 passphrase
 * @returns {Promise<void>} 복호화 과정이 성공적으로 완료되면 해결되는 프로미스를 반환합니다.
 */
async function decryptFileWithSymmetricKey(encryptedFilePath, decryptedFilePath, decryptedPassphrase) {
    return new Promise(async (resolve, reject) => {
        let AES_passphrase_file = decryptedPassphrase.toString('hex')
        AES_passphrase_file = AES_passphrase_file.split(' ').join('').split('\n').join('').split('\r').join('');
        const AES_key_file = crypto.scryptSync(AES_passphrase_file, 'saltForFile', 32); // 복호화된 AES_passphrase로부터 AES_key 생성

        // 읽기, 복호화, 쓰기를 위한 스트림 생성
        const readStream = fs.createReadStream(encryptedFilePath);
        const writeStream = fs.createWriteStream(decryptedFilePath);

        let AES_iv_file;
        let decipher;

        readStream.on('data', (chunk) => {
            if (!AES_iv_file) {
                // 첫 번째 청크에서 IV를 읽음
                AES_iv_file = chunk.slice(0, 16); // IV는 청크의 처음 16바이트
                decipher = crypto.createDecipheriv('aes-256-cbc', AES_key_file, AES_iv_file);

                // 나머지 데이터를 복호화
                writeStream.write(decipher.update(chunk.slice(16)));
                logger.info(`IV를 읽고 데이터 복호화 시작: ${encryptedFilePath}`);
            } else {
                writeStream.write(decipher.update(chunk));
            }
        });

        readStream.on('end', () => {
            writeStream.write(decipher.final());
            logger.info(`파일 데이터 복호화 완료: ${decryptedFilePath}`);
            // 정상적으로 복호화된 파일이 생성되었으므로 원본 파일 삭제
            deleteFolderAndFiles(encryptedFilePath);
            resolve();
        });

        readStream.on('error', (err) => {
            logger.error(`파일 데이터 복호화 실패: ${encryptedFilePath}`, err);
            reject(err);
        });
    });
}

async function mergeAndDecryptFile(originalFileName){
    console.log("\nreader.js 모듈")

    // 입력받은 원본 파일명 AES 암호화
    const encryptedFilename = encryptFilename(originalFileName);

    // 8. fileOrderMapping 정보 조회
    const db_mappingInfo = await useMappingInfo(encryptedFilename);

    const url = `${process.env.FILE_SERVER_URL}/download`;
    const uuids = await extractUuids(db_mappingInfo);
    const movedFilePaths = path.resolve(__dirname, '../encryptedfile');
    // 9. 분할된 파일들을 다운로드
    const downloadedFilePaths =  await downloadFiles(url, uuids, movedFilePaths)

    const outputPath = path.resolve(__dirname, '../output');
    // 10. 파일 정렬
    const sortedFilePaths = await sortFilesByMappingInfo(downloadedFilePaths, db_mappingInfo);

    // 11. 파일 병합
    const mergedFilePath = await mergeSortedFiles(sortedFilePaths, outputPath, encryptedFilename);

    // 12. 파일명 복호화
    const decryptedFileNamePath = await processDecryptedFilename(mergedFilePath);

    // 암호화된 파일명에 대한 암호화된 passphrase 형식 정리
    const encryptedPassphrase = await formatEncryptedSymmetricKey(encryptedFilename)

    return { decryptedFileNamePath, encryptedPassphrase }
}

module.exports = {
    mergeAndDecryptFile
};
