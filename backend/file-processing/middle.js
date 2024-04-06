const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const axios = require('axios');
const fsp = require('fs').promises;
const FormData = require('form-data');

const { logger } = require('../utils/logger');
const { deleteFolderAndFiles } = require('../utils/rollbackUtils');

const FileMappingJson = require('../models/postgreSQLModels');

//---------------------------------------------------------
// 5. 분할된 파일들의 이름 변경 및 매핑 정보 생성
//---------------------------------------------------------
/**
 * 5. 분할된 파일명 uuid로 변경 및 매핑 정보 생성
 * @description 분할된 파일의 원본 파일명을 변경, 새 파일명과 원본 파일명 간의 매핑 정보를 생성.
 * @param {string[]} originalFileNames 원본 파일명 배열
 * @param {string} folderPath 파일이 저장된 폴더 경로
 * @returns {Promise<Object>} 파일명 변경 및 매핑 정보, 포함:
 *   - {string[]} renamedFilePaths: 변경된 파일 경로 배열
 *   - {Object} splitFileOrderMapping: 새 파일명과 원본 파일명 간의 매핑 정보
 *   - {string} desEncryptedFileName: 디렉토리명으로 사용된 암호화된 파일명
 */
async function renameFilesAndCreateMapping(originalFileNames, folderPath) {
    let renamedFilePaths = [];
    let splitFileOrderMapping = {};
    let desEncryptedFileName = '';
    try {
        const renamePromises = originalFileNames.map(async (fullPath, index) => {
            const oldFileName = path.basename(fullPath);
            const oldPath = path.join(folderPath, oldFileName);
            const newFileName = uuidv4();
            const newPath = path.join(folderPath, newFileName);
            await fsp.rename(oldPath, newPath);
            renamedFilePaths.push(newPath);
            splitFileOrderMapping[newFileName] = index;
        });
        await Promise.all(renamePromises);
        desEncryptedFileName = path.basename(path.dirname(renamedFilePaths[0]));

        logger.info(`분할된 파일 이름 변경 및 매핑 정보 생성 완료: ${desEncryptedFileName}`);
        return { renamedFilePaths, splitFileOrderMapping, desEncryptedFileName };
    } catch (error) {
        logger.error('분할된 파일 이름 변경 및 매핑 정보 생성 실패:', error);
        await deleteFolderAndFiles(folderPath);
        throw error;
    }
}

//---------------------------------------------------------
// 6. 분할된 파일들을 인터넷에 업로드
// Promise.all()을 사용하여 병렬로 업로드
//---------------------------------------------------------
// ERROR: 대용량 파일 업로드 시(200MB 이상) 메모리 부족 문제 발생, stream을 promise.all로 준비하기 때문에 발생하는 문제
// TODO: 병렬 업로드 개수 제한(Promise.all 대신 Promise.allSettled를 사용해도 되는지 판단해봐야함.)
// TODO: 파일들이 분산되어 저장되어야함. 파일이 저장된 서버의 주소를 기록해야함.
/**
 * 6. 분할된 파일들을 인터넷에 업로드
 * @description 주어진 파일들을 지정된 URL로 업로드. 모든 파일 업로드 후 부모 폴더 삭제.
 * @param {string[]} files 업로드할 파일 경로 배열
 * @param {string} uploadUrl 파일 업로드할 서버 URL
 * @returns {Promise<Object[]>} 업로드된 파일들의 응답 객체 배열
 */
async function uploadFiles(files, uploadUrl) {
    const parentFolderPath = path.dirname(path.dirname(files[0]));
    try {
        const uploadPromises = files.map(async (file) => {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file), path.basename(file));
            // logger.info(`Uploading file: ${file} to ${uploadUrl}`);
            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });
            // logger.info(`File uploaded successfully: ${file}`);
            return response;
        });

        const results = await Promise.all(uploadPromises);
        logger.info('모든 파일 업로드 완료');

        await deleteFolderAndFiles(parentFolderPath);
        return results;
    } catch (error) {
        logger.error(`업로드 실패`, error);
        // TODO: 롤백 로직 추가, 실패한 파일들을 업로드할 서버에서 삭제, 재시도 로직 추가(실패한 파일들만 재시도, 모두 삭제 후 재시도)
        throw error;
    }
}

//---------------------------------------------------------
// 7. fileOrderMapping 정보 저장
//---------------------------------------------------------
/**
 * 7. PostgreSQL에 매핑 데이터와 암호화된 대칭키 저장
 * @description 지정된 파일명에 대한 매핑 정보와 암호화된 대칭키를 JSON 형식으로 PostgreSQL 데이터베이스에 저장.
 * @param {string} desEncryptedFileName 디렉토리명으로 사용된 암호화된 파일명
 * @param {Object} mappingInfo 분할된 파일과 원본 순서 사이의 매핑 정보
 * @param {Buffer} encryptedPassphrase 공개키로 암호화된 대칭키
 */
async function saveMappingDataJsonPostgreSQL(desEncryptedFileName, mappingInfo, encryptedPassphrase) {
    try {
        if (!encryptedPassphrase) {
            logger.error(`Encrypted Passphrase is undefined for file: ${desEncryptedFileName}`);
            throw new Error(`Encrypted Passphrase is undefined for file: ${desEncryptedFileName}`);
        }
        // FileMappingJson 모델을 사용하여 새 레코드를 생성, 데이터베이스에 저장.
        await FileMappingJson.create({
            encrypted_filename: desEncryptedFileName, // 데이터베이스에 저장될 암호화된 파일명
            mapping_info: mappingInfo, // 분할된 파일과 원본 순서 사이의 매핑 정보
            encrypted_symmetric_key: encryptedPassphrase // 공개키로 암호화된 대칭키
        });
        logger.info(`PostgreSQL에 매핑 데이터가 JSON 형식으로 성공적으로 저장되었습니다: ${desEncryptedFileName}`);
    } catch (error) {
        // 에러 처리
        logger.error(`PostgreSQL에 매핑 데이터를 저장하는 도중 오류가 발생했습니다: ${desEncryptedFileName}`, error);
        throw error;
    }
};

/**
 * middle.js 모듈의 최종 함수, 파일 업로드 및 매핑 관리
 * @description 주어진 파일명들과 폴더 경로를 바탕으로 파일을 업로드, 업로드한 파일의 매핑 정보를 관리.
 * @param {string[]} originalFileNames 원본 파일명 배열
 * @param {string} folderPath 파일이 위치한 폴더 경로
 * @param {string} uploadUrl 파일 업로드할 서버의 URL
 * @param {Buffer} encryptedPassphrase 공개키로 암호화된 대칭키
 * @returns {Promise<Object[]>} 업로드 결과 객체 배열
 */
async function manageFileUploadAndMapping(originalFileNames, folderPath, uploadUrl, encryptedPassphrase) {
    try {
        console.log("\nmiddle.js 모듈")
        // 5. 파일 이름 변경 및 매핑 생성
        const { renamedFilePaths, splitFileOrderMapping, desEncryptedFileName } = await renameFilesAndCreateMapping(originalFileNames, folderPath);

        // 6. 파일 업로드
        const uploadResults = await uploadFiles(renamedFilePaths, uploadUrl);

        // 7. 업로드 후 매핑 데이터 저장
        await saveMappingDataJsonPostgreSQL(desEncryptedFileName, splitFileOrderMapping, encryptedPassphrase);
        return uploadResults;
    } catch (error) {
        logger.error('파일 처리 중 오류 발생:', error);
        throw error;
    }
}

module.exports = {
    manageFileUploadAndMapping
};