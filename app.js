const path = require('path');
const { changeFilename, encryptAndSplitFile } = require('./file-processing/writer');
const { renameFilesAndCreateMapping, uploadFiles, saveMappingDataJsonPostgreSQL } = require('./file-processing/middle');
const { getFileMappingInfo, sortFiles, mergeFiles } = require('./file-processing/reader');
const { compareFileHash } = require('./utils/comparefile');

// 하드코딩
const fs = require('fs').promises;
const newLocation = '/Users/mac/Documents/split_file/internet';

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
    console.log('파일 이름 변경 및 매핑 정보 생성 완료.');

    //---------------------------------------------------------
    // 잠시 테스트를 위해 주석 처리
    //---------------------------------------------------------
    // // 파일 업로드
    // const uploadUrl = 'http://localhost:3000/upload'; // 업로드할 URL 예시
    // await uploadFiles(renamedFilePaths, uploadUrl);
    // console.log('파일 업로드가 완료되었습니다.');

    // 하드코딩
    /**
     * 주어진 파일 경로 목록의 파일들을 새 위치로 이동.
     * @param {string[]} filePaths - 이동할 파일들의 경로.
     * @param {string} newLocation - 파일들을 이동할 새 위치.
     */
    const moveFilesToNewLocation = async (filePaths, newLocation) => {
      const movedFilePaths = [];
      try {
          // parentFolderPath: 모든 파일의 상위 폴더
          const parentFolderPath = path.dirname(filePaths[0]);

          // 새 위치에 상위 폴더를 생성.
          const newParentFolderPath = path.join(newLocation, path.basename(parentFolderPath));
          await fs.mkdir(newParentFolderPath, { recursive: true });

          for (const filePath of filePaths) {
              const fileName = path.basename(filePath);
              const newFilePath = path.join(newParentFolderPath, fileName);
              await fs.rename(filePath, newFilePath);
              movedFilePaths.push(newFilePath); // 배열에 이동된 파일 경로 추가
          }
          return movedFilePaths; // 이동된 파일 경로들의 배열 반환
      } catch (error) {
          console.error('파일을 이동하는 도중 오류 발생:', error);
      }
    };
  
    const movedFilePaths = await moveFilesToNewLocation(renamedFilePaths, newLocation);
    //

    
    // 업로드 후 매핑 데이터 저장
    await saveMappingDataJsonPostgreSQL(desEncryptedFileName, splitFileOrderMapping);
    // 아래 console.log는 실패해도 성공했다고 함.
    //console.log('매핑 데이터가 성공적으로 저장되었습니다.');

    // 하드 코딩
    return movedFilePaths;


  } catch (error) {
    console.error('파일 처리 중 오류가 발생했습니다:', error);
  }
};

const afterProcessFiles = async (movedFilePaths) => {
  try {
    // getFileMappingInfo 함수 실행
    // 하드 코딩
    const encryptedFilename = 'f2ba300a28fa225152c59332cec8e166'; // 사용자가 입력한 파일명을 대칭키로 암호화
    const db_mappingInfo = await getFileMappingInfo(encryptedFilename);
    // console.log('파일 매핑 정보:', db_mappingInfo);

    const sortedFiles = sortFiles(movedFilePaths, db_mappingInfo)
    // console.log('정렬된 파일들:', sortedFiles);

    // 하드코딩
    const outputPath = '/Users/mac/Documents/split_file/output';
    const mergedFilePath = await mergeFiles(sortedFiles, outputPath, encryptedFilename)
    // console.log(mergedFilePath)
    // console.log(folderPath)

    // 하드코딩
    const areFileSame = await compareFileHash("/Users/mac/Documents/split_file/uploadfile/f2ba300a28fa225152c59332cec8e166", mergedFilePath)
  } catch (error) {
    console.error('파일 매핑 정보 조회 중 오류 발생:', error);
  }
};

processFiles()
  .then(movedFilePaths => afterProcessFiles(movedFilePaths))
  .catch(error => {
    console.error('오류 발생:', error);
  });