const fs = require('fs').promises;
const axios = require('axios');
const path = require('path');
const splitFile = require('split-file');

const { logger } = require('../utils/logger');
const FileMappingJson = require('../models/postgreSQLModels');
const { isDirectory } = require('../utils/pathUtils');


//=============================================================================================
// 파일 병합
//=============================================================================================

//---------------------------------------------------------
// 8. fileOrderMapping 정보 조회
//---------------------------------------------------------
/**
 * 주어진 암호화된 파일명에 대한 파일 매핑 정보를 검색합니다.
 * @param {string} encryptedFilename - 검색할 암호화된 파일의 이름
 * @returns {Promise<Object|null>} 매핑 정보 객체를 반환하는 프로미스
 */
async function getFileMappingInfo(encryptedFilename) {
    try {
        const mappingInfo = await FileMappingJson.findOne({
            where: { encrypted_filename: encryptedFilename }
        });

        if (mappingInfo) {
            // console.log("잘 통과함")
            return mappingInfo.mapping_info;
        } else {
            console.log(`${encryptedFilename} 파일 존재하지 않음`)
            return null;
        }
    } catch (error) {
        console.error('파일 매핑 정보 조회 중 오류 발생:', error);
        return null;
    }
}

//---------------------------------------------------------
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
            const writer = fs.createWriteStream(filePath);
            
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
const sortFiles = (filesPath, mappingInfo) => {
    // 다운로드 받은 파일들을 mappingInfo를 기반으로 정렬
    const sortedFiles = filesPath.sort((a, b) => mappingInfo[a] - mappingInfo[b]);

    return sortedFiles;
};

//---------------------------------------------------------
// 11. 파일 병합
//---------------------------------------------------------
async function mergeFiles(filesPath, outputPath, mergedFileName) {
    const mergedFilePath = path.join(outputPath, mergedFileName);
    try {
        // 파일 합치기
        await splitFile.mergeFiles(filesPath, mergedFilePath);
        console.log('파일 합치기 완료');
        return mergedFilePath;
    } catch(err) {
        console.error('파일 병합 도중 오류 발생:', err);
        throw err;
    }
}

//---------------------------------------------------------
// 12. 파일명 복호화 (아직 구현되지 않음)
//---------------------------------------------------------
async function decryptFilename(filePath, encryptedFileName) {

}
//---------------------------------------------------------
// 13. 파일 복호화 (아직 구현되지 않음)
//---------------------------------------------------------

module.exports = {
    getFileMappingInfo,
    sortFiles,
    mergeFiles,
    //... (8~13번 기능의 export)
};
