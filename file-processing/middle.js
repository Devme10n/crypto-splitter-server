const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid').v4;
const axios = require('axios');
const fsp = require('fs').promises;
const FormData = require('form-data'); // Ensure to install form-data package for Node.js
const { logger } = require('../utils/logger'); // Ensure logger is correctly set up
const { deleteFolderAndFiles } = require('../utils/rollbackUtils'); // Util for cleanup

//---------------------------------------------------------
// 5. 분할된 파일들의 이름 변경 및 매핑 정보 생성
//---------------------------------------------------------

/**
 * 분할된 파일들의 이름을 uuid로 변경 및 매핑 정보 생성
 * @description 각 파일을 고유한 UUID를 사용하여 새로운 이름으로 변경하고, 변경된 파일명과 원래 인덱스의 매핑 정보를 생성합니다. 이 과정은 비동기적으로 수행됩니다.
 * @param {string[]} originalFileNames - 원본 파일의 전체 경로를 포함하는 문자열 배열
 * @param {string} folderPath - 파일이 저장된 폴더의 경로
 * @return {Promise<Object>} renamedFilePaths와 splitFileOrderMapping을 속성으로 하는 객체를 반환하는 프로미스. renamedFilePaths는 변경된 파일 경로의 배열이며, splitFileOrderMapping은 새 파일 이름과 원본 인덱스의 매핑 정보를 담은 객체입니다.
 */
async function renameFilesAndCreateMapping(originalFileNames, folderPath) {
    let renamedFilePaths = [];
    let splitFileOrderMapping = {};
    try {
        const renamePromises = originalFileNames.map(async (fullPath, index) => {
            const name = path.basename(fullPath);
            const oldPath = path.join(folderPath, name);
            const newFileName = uuidv4();
            const newPath = path.join(folderPath, newFileName);
            // fs.rename 대신 fsp.rename을 사용합니다.
            await fsp.rename(oldPath, newPath);
            renamedFilePaths.push(newPath);
            splitFileOrderMapping[newFileName] = index;
        });

        await Promise.all(renamePromises);
        console.log('All files renamed successfully');
        return { renamedFilePaths, splitFileOrderMapping };
    } catch (error) {
        logger.error('File renaming failed:', error);
        // 롤백 로직: 폴더 및 하위 파일 삭제(추가 고민 필요)
        throw error;
    }
}

//---------------------------------------------------------
// 6. 분할된 파일들을 인터넷에 업로드 (아직 구현되지 않음)
// Promise.all()을 사용하여 병렬로 업로드
//---------------------------------------------------------
async function uploadFiles(files, uploadUrl) {
    try {
        const uploadPromises = files.map(async (file) => {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file), path.basename(file));

            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });
            logger.info(`File uploaded: ${file}`);
            return response;
        });

        const results = await Promise.all(uploadPromises);
        logger.info('All files uploaded successfully.');
        return results;
    } catch (error) {
        logger.error(`Upload failed: ${error.message}`);
        // 폴더를 지워야함 파일이 아님 (수정 필요)
        await deleteFolderAndFiles(path.dirname(files[0]));
        logger.info('Cleanup completed after failed upload.');
        throw error;
    }
}

//---------------------------------------------------------
// 7. fileOrderMapping 정보 저장 (아직 구현되지 않음)
//---------------------------------------------------------

module.exports = {
    renameFilesAndCreateMapping,
    uploadFiles
    //... (6~7번 기능의 export)
};
