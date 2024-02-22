const path = require('path');
const { changeFilename, encryptAndSplitFile } = require('./file-processing/writer');
const { renameFilesAndCreateMapping, uploadFiles, saveMappingDataJsonPostgreSQL } = require('./file-processing/middle');
const { getFileMappingInfo } = require('./file-processing/reader');

// 업로드 된 파일 위치
const folderPath = path.join(__dirname, 'uploadfile');

const processFiles = async () => {
  try {
    // 암호화된 dummyfile 파일명 초기화
    const desEncryptedFilePath = path.join(folderPath, 'f2ba300a28fa225152c59332cec8e166');
    changeFilename(desEncryptedFilePath, 'dummyfile')
    console.log('dummyfile로 파일명 변경 완료')

    // 원본 파일 경로와 분할할 조각 수 설정
    const originalFilePath = path.join(folderPath, 'dummyfile');
    const splitCount = 100; // 예시 분할 조각 수

    // 파일 암호화 및 분할 실행
    const { originalFileNames, splitFilesPath } = await encryptAndSplitFile(originalFilePath, splitCount);
    console.log('파일이 성공적으로 암호화되고 분할되었습니다.');

    // 파일 이름 변경 및 매핑 생성
    const { renamedFilePaths, splitFileOrderMapping, desEncryptedFileName } = await renameFilesAndCreateMapping(originalFileNames, splitFilesPath);
    console.log('파일 이름 변경 및 매핑 정보 생성이 완료되었습니다.');

    // 파일 업로드
    const uploadUrl = 'http://localhost:3000/upload'; // 업로드할 URL 예시
    await uploadFiles(renamedFilePaths, uploadUrl);
    console.log('파일 업로드가 완료되었습니다.');

    // 업로드 후 매핑 데이터 저장
    await saveMappingDataJsonPostgreSQL(desEncryptedFileName, splitFileOrderMapping);
    // 아래 console.log는 실패해도 성공했다고 함.
    //console.log('매핑 데이터가 성공적으로 저장되었습니다.');
  } catch (error) {
    console.error('파일 처리 중 오류가 발생했습니다:', error);
  }
};

const afterProcessFiles = async () => {
  try {
    // getFileMappingInfo 함수 실행
    const encryptedFilename = 'f2ba300a28fa225152c59332cec8e166';
    const db_mappingInfo = await getFileMappingInfo(encryptedFilename);
    // console.log('파일 매핑 정보:', db_mappingInfo);
  } catch (error) {
    console.error('파일 매핑 정보 조회 중 오류 발생:', error);
  }
};

processFiles()
  .then(afterProcessFiles)
  .catch(error => {
    console.error('오류 발생:', error);
  });