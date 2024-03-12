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
 * 분할된 파일들의 이름을 uuid로 변경 및 매핑 정보 생성
 * @description 각 파일을 고유한 UUID를 사용하여 새로운 이름으로 변경하고, 변경된 파일명과 원래 인덱스의 매핑 정보를 생성. 비동기적으로 수행.
 * @param {string[]} originalFileNames - 원본 파일의 전체 경로를 포함하는 문자열 배열
 * @param {string} folderPath - 파일이 저장된 폴더의 경로
 * @return {Promise<Object>} renamedFilePaths와 splitFileOrderMapping을 속성으로 하는 객체를 반환하는 프로미스. renamedFilePaths는 변경된 파일 경로의 배열이며, splitFileOrderMapping은 새 파일 이름과 원본 인덱스의 매핑 정보를 담은 객체.
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
        console.log('All files renamed successfully');
        
        return { renamedFilePaths, splitFileOrderMapping, desEncryptedFileName };
    } catch (error) {
        logger.error('File renaming failed:', error);
        throw error;
    }
}

//---------------------------------------------------------
// 6. 분할된 파일들을 인터넷에 업로드
// Promise.all()을 사용하여 병렬로 업로드
//---------------------------------------------------------

/**
 * 분할된 파일들을 인터넷에 업로드
 * @description 파일 경로의 배열과 업로드 URL을 받아 FormData를 사용하여 각 파일을 비동기적으로 업로드. Promise.all()을 활용하여 업로드를 병렬로 수행.
 * @param {string[]} files - 업로드할 파일 경로를 나타내는 문자열 배열.
 * @param {string} uploadUrl - 파일들이 업로드될 URL.
 * @return {Promise<Object[]>} 모든 업로드가 성공하면 업로드 엔드포인트의 응답 배열을 반환하는 프로미스.
 */
async function uploadFiles(files, uploadUrl) {
    const parentFolderPath = path.dirname(path.dirname(files[0]));
    try {
        const uploadPromises = files.map(async (file) => {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file), path.basename(file));

            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });
            // logger.info(`File uploaded: ${file}`);
            return response;
        });

        const results = await Promise.all(uploadPromises);
        logger.info('모든 파일 업로드 완료');

        await deleteFolderAndFiles(parentFolderPath);
        return results;
    } catch (error) {
        logger.error(`업로드 실패`);
        await deleteFolderAndFiles(parentFolderPath);
        throw error;
    }
}

//---------------------------------------------------------
// 7. fileOrderMapping 정보 저장
// 에러와 로깅처리를 함수 내에서 처리하는 것과 app.js에서 처리하는 것에 대해 생각해보기
//---------------------------------------------------------

/**
 * PostgreSQL에 파일 순서 매핑 정보를 JSON 형식으로 저장
 * 
 * @param {string} desEncryptedFileName - 대칭키로 암호화된 파일명
 * @param {Object} mappingInfo - { uuid : original_index } 형태의 uuid로 변경된 파일명 매핑 정보
 */
const saveMappingDataJsonPostgreSQL = async (desEncryptedFileName, mappingInfo, encryptedSymmetricKey) => {
    try {
        // 암호화된 대칭키(Buffer)를 base64로 인코딩
        const encryptedSymmetricKeyBase64 = Buffer.from(encryptedSymmetricKey).toString('base64');

        // FileMappingJson 모델을 사용하여 새 레코드를 생성, 데이터베이스에 저장.
        await FileMappingJson.create({
            encrypted_filename: desEncryptedFileName, // 데이터베이스에 저장될 암호화된 파일명
            mapping_info: mappingInfo, // 분할된 파일과 원본 순서 사이의 매핑 정보\
            encrypted_symmetric_key: encryptedSymmetricKeyBase64 // 공개키로 암호화된 대칭키
        });
        console.log('PostgreSQL에 매핑 데이터가 JSON 형식으로 성공적으로 저장되었습니다.');
    } catch (error) {
        // 에러 처리
        console.error('PostgreSQL에 매핑 데이터를 저장하는 도중 오류가 발생했습니다:', error);
    }
};

module.exports = {
    renameFilesAndCreateMapping,
    uploadFiles,
    saveMappingDataJsonPostgreSQL
};
