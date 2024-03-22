const fs = require('fs');
const fsp = require('fs').promises;
const axios = require('axios');
const path = require('path');
const splitFile = require('split-file');
const crypto = require('crypto');

const { logger } = require('../utils/logger');
const { calculateFileHash, compareFileHash, compareMultipleFiles } = require('../utils/hashFunctions');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

const FileMappingJson = require('../models/postgreSQLModels');
const { changeFilename } = require('./writer');

//=============================================================================================
// 파일 병합
//=============================================================================================

// 파일 매핑 정보 및 암호화된 대칭키를 암호화된 파일명으로 검색
async function getFileMappingData(encryptedFilename) {
    try {
        // del
        logger.info(`Retrieving file mapping data for: ${encryptedFilename}`);
        // 데이터베이스에서 파일 데이터 검색
        const fileData = await FileMappingJson.findOne({
            where: { encrypted_filename: encryptedFilename }
        });

        // 데이터가 없으면 null 반환
        if (!fileData) {
            console.log(`${encryptedFilename}는 데이터베이스에 존재하지 않습니다.`);
            return null;
        }

        // del
        logger.info(`Mapping data retrieved for: ${encryptedFilename}`);

        // 단일 객체로 모든 필요한 데이터 반환
        return {
            mappingInfo: fileData.mapping_info, // 매핑 정보
            encryptedPassword: fileData.encrypted_symmetric_key // base64 인코딩된 암호화된 대칭키
        };
    } catch (error) {
        logger.error(`파일 매핑 데이터 검색 중 오류 발생:${encryptedFilename}`, error);
        throw error;
    }
}

//---------------------------------------------------------
// 8. fileOrderMapping 정보 조회
//---------------------------------------------------------
// 파일 매핑 정보 사용
async function useMappingInfo(encryptedFilename) {
    try {
        logger.info(`Using mapping info for: ${encryptedFilename}`);
        const fileData = await getFileMappingData(encryptedFilename);
        if (!fileData) {

            // del
            logger.error(`No file data found for: ${encryptedFilename}`);

            return null;
        }
        return fileData.mappingInfo;
    } catch (error) {

        // del
        logger.error(`Error using mapping info for: ${encryptedFilename}`, error);

        throw error;
    }
}

//---------------------------------------------------------
// TODO: 다운로드 기능 구현, 업로드 코드와 비슷한 구조를 가지기.
// 9. 분할된 파일들을 다운로드 (아직 구현되지 않음)
// Promise.all()을 사용하여 병렬로 다운로드
//---------------------------------------------------------
/**
 * (테스트 안해봄) 주어진 URL에서 파일을 다운로드하고 지정된 폴더에 저장합니다.
 * @param {string[]} urls - 다운로드할 파일의 URL 배열입니다.
 * @param {string} destFolder - 파일이 저장될 대상 폴더입니다.
 * @returns {Promise<string[]>} 다운로드된 파일의 경로 배열로 resolve되는 프로미스입니다.
 */
async function downloadFiles(urls, destFolder) {
    try {
        const downloadedFilePaths = await Promise.all(urls.map(async (url, index) => {
            const fileName = path.basename(url); // URL에서 파일 이름 추출
            const filePath = path.join(destFolder, `${index}-${fileName}`); // 파일 이름 앞에 인덱스를 추가하여 고유한 파일 이름을 보장합니다.
            const response = await axios({ url, responseType: 'stream' });
            const writer = fsp.createWriteStream(filePath);
            
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        }));

        console.log('모든 파일이 성공적으로 다운로드되었습니다.');
        return downloadedFilePaths;
    } catch (error) {
        console.error('파일 다운로드에 실패했습니다:', error);
        throw error; // 호출자가 처리할 수 있도록 에러를 다시 던집니다.
    }
}

//---------------------------------------------------------
// 10. 파일 정렬
//---------------------------------------------------------
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
const AES_password_filename = '파일명용비밀번호';
const AES_key_filename = crypto.scryptSync(AES_password_filename, 'saltForFilename', 24);
const AES_iv_filename = Buffer.alloc(16, 0); // 초기화 벡터

/**
 * 파일명을 AES 복호화하여 반환
 * @description 주어진 파일명을 AES 암호화 알고리즘을 사용하여 복호화.
 * @param {string} encryptedFileName 복호화할 원본 파일명
 * @return {string} 복호화된 파일명
 */
function decryptFilename(encryptedFileName) {
    try {
        // del
        logger.info(`Decrypting filename: ${encryptedFileName}`);

        const decipher = crypto.createDecipheriv(AES_algorithm_filename, AES_key_filename, AES_iv_filename);
        let decrypted = decipher.update(encryptedFileName, 'hex', 'utf8');
        // hex -> utf8 인코딩
        decrypted += decipher.final('utf8');

        // del
        logger.info(`Decrypted filename: ${decrypted}`);

        return decrypted;
    } catch (error) {
        logger.error(`Error decrypting filename: ${encryptedFileName}`, error);
        throw error;
    }
}

/**
 * 12. 파일명 복호화 및 변경 처리 함수
 * @description 암호화된 파일명을 복호화하고, 변경된 파일명으로 파일명을 업데이트합니다.
 * @param {string} encryptedFilePath 처리할 파일의 암호화된 경로
 * @return {string} 변경된 파일의 경로
 */
function processDecryptedFilename(encryptedFilePath) {
    try {
        const encryptedFileName = path.basename(encryptedFilePath);

        // del
        logger.info(`Processing decrypted filename for: ${encryptedFileName}`);

        const decryptedFileName = decryptFilename(encryptedFileName);
        const decryptedFilePath = changeFilename(encryptedFilePath, decryptedFileName);
        logger.info(`파일명 복호화 완료: ${decryptedFilePath}`);
        return decryptedFilePath;
    } catch (error) {
        logger.error(`파일명 복호화 중 오류 발생: ${error.message}`);
        throw error;
    }
}

//---------------------------------------------------------
// 13. 파일 복호화
//---------------------------------------------------------

// 암호화된 대칭키 사용
async function useEncryptedSymmetricKey(encryptedFilename) {
    const fileData = await getFileMappingData(encryptedFilename);
    if (fileData) {
        // 암호화된 대칭키에서 공백과 줄바꿈 제거
        const formattedEncryptedKey = fileData.encryptedPassword.split(' ').join('').split('\n').join('').split('\r').join('');

        // base64 형식의 저장된 대칭키를 변환하여 사용
        const encryptedPassword = Buffer.from(formattedEncryptedKey, 'base64');

        return encryptedPassword;
    }
}

/**
 * 암호화된 대칭키를 개인키로 복호화.
 * @param {Buffer} encryptedPassword - 암호화된 대칭키
 * @param {string} privateKeyPath - 개인키 파일 경로
 * @returns {Promise<Buffer>} - 복호화된 대칭키
 */
async function decryptSymmetricKey(encryptedPassword, privateKeyPath) {
    try {
        const privateKey = await fsp.readFile(privateKeyPath, 'utf8');
        const decryptedPassword = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            encryptedPassword
        );
        logger.info('대칭키 복호화 성공');

        return decryptedPassword; // 복호화된 AES_password 반환
    } catch (error) {
        logger.error(`대칭키 복호화 중 오류 발생: ${error}`);
        throw error;
    }
}

// 복호화된 대칭키로 파일 복호화
/**
 * 복호화된 대칭키로 암호화된 파일 복호화.
 * @param {string} encryptedFilePath - 암호화된 파일의 경로
 * @param {string} decryptedFilePath - 복호화된 파일이 저장될 경로
 * @param {Buffer} symmetricKey - 복호화에 사용될 복호화된 대칭키
 */
async function decryptFileWithSymmetricKey(encryptedFilePath, decryptedFilePath, decryptedPassword) {
    return new Promise(async (resolve, reject) => {

        // del
        logger.info(`Decrypting file: ${encryptedFilePath}`);

        const AES_password_file = decryptedPassword.toString('hex')
        AES_password_file.split(' ').join('').split('\n').join('').split('\r').join('');
        const AES_key_file = crypto.scryptSync(AES_password_file, 'saltForFile', 32); // 복호화된 AES_password로부터 AES_key 생성
        const AES_iv_file = Buffer.alloc(16, 0); // 파일 복호화를 위한 초기화 벡터
        
        try {
            // 읽기, 복호화, 쓰기를 위한 스트림 생성
            const readStream = fs.createReadStream(encryptedFilePath);
            const writeStream = fs.createWriteStream(decryptedFilePath);
            const decipher = crypto.createDecipheriv('aes-256-cbc', AES_key_file, AES_iv_file);
            
            // 스트림 파이프 연결
            readStream.pipe(decipher).pipe(writeStream);

            // 스트림들에 대한 에러 핸들링
            const errorHandler = (source) => (err) => {
                readStream.close();
                writeStream.close();
                reject(`파일 복호화 도중 에러 발생 ${source}: ${err}`);
            };

            readStream.on('error', errorHandler('Read Stream'));
            writeStream.on('error', errorHandler('Write Stream'));
            decipher.on('error', errorHandler('Decipher Stream'));

            // writeStream의 'finish' 이벤트 처리
            writeStream.on('finish', () => {
                logger.info(`파일 복호화 성공: ${decryptedFilePath}`);
                
                // 정상적으로 복호화된 파일이 생성되었으므로 원본 파일 삭제
                deleteFolderAndFiles(encryptedFilePath);
                resolve();
            });
        } catch (error) {
            reject(`파일 복호화 실패: ${encryptedFilePath}`, error);
        }
    });
}

async function mergeAndDecryptFile(encryptedFilename, movedFilePaths){
    const db_mappingInfo = await useMappingInfo(encryptedFilename);

    // 하드코딩
    const outputPath = path.resolve(__dirname, '../output');

    // 10. 파일 정렬
    const sortedFilePaths = await sortFilesByMappingInfo(movedFilePaths, db_mappingInfo);

    // 11. 파일 병합
    const mergedFilePath = await mergeSortedFiles(sortedFilePaths, outputPath, encryptedFilename);

    const encryptedPassword = await useEncryptedSymmetricKey(encryptedFilename)

    // compareFileHash(mergedFilePath, "/Users/mac/Documents/split_file/encryptedfile/0be8366e87a3f33ae2d2ebb5fa9bfb21")

    const privateKeyPath = path.resolve(__dirname, '../key/private_key.pem');
    const decryptedPassword = await decryptSymmetricKey(encryptedPassword, privateKeyPath)

    const decryptedFilePath = mergedFilePath.replace('/output/', '/result/');
    await decryptFileWithSymmetricKey(mergedFilePath, decryptedFilePath, decryptedPassword)

    // 12. 파일명 복호화
    const decryptedFileNamePath = processDecryptedFilename(decryptedFilePath);
}


module.exports = {
    mergeAndDecryptFile
    //... (8~13번 기능의 export)
};
