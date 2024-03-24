const { ensureDirectories, encryptAndSplitFile, processEncryptedFileAndPassphrase } = require('./file-processing/writer');
const { renameFilesAndCreateMapping, uploadFiles, saveMappingDataJsonPostgreSQL, manageFileUploadAndMapping } = require('./file-processing/middle');
const { mergeAndDecryptFile } = require('./file-processing/reader');
const { calculateFileHash, compareFileHash, compareMultipleFiles } = require('./utils/hashFunctions');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { log } = require('console');
const { logger } = require('./utils/logger');
require('dotenv').config();

const app = express();
app.use(cors());

// 애플리케이션 초기화 코드
(async () => {
  const tempPath = path.join(__dirname, '.', 'temp');
  const uploadfilePath = path.join(__dirname, '.', 'uploadfile');
  const outputPath = path.join(__dirname, '.', 'output');
  const resultPath = path.join(__dirname, '.', 'result');
  const encryptedfilePath = path.join(__dirname, '.', 'encryptedfile');

  // 임시 디렉토리 설정 (프로그램 실행 시 최초 1회만 실행)
  await ensureDirectories(tempPath, uploadfilePath, outputPath, resultPath, encryptedfilePath);
})();

// multer 설정
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploadfile/');
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  }),
});

// 암호화된 파일과 passphrase를 수신하는 POST 요청 처리
app.post('/upload', upload.any(), async (req, res) => {
  try {
    // console.log('req.files:', req.files);
    // console.log('req.body:', req.body);
    // console.log('req.body[encryptedPassphrase]:', req.body['encryptedPassphrase']);
    // console.log('req.files[0].path:', req.files[0].path);

    const encryptedPassphrase = req.body['encryptedPassphrase'];
    const encryptedFilePath = req.files[0].path;
    if (!encryptedPassphrase || !encryptedFilePath) {
      return res.status(400).send('No file was uploaded.');
    }

    // console.log('encryptedPassphrase:', encryptedPassphrase);
    // console.log('encryptedFilePath:', encryptedFilePath);

    // processFiles 함수 호출
    await processFiles(encryptedFilePath, encryptedPassphrase);

    res.status(200).send('File and passphrase successfully uploaded.');
  } catch (err) {
    console.error(`File upload failed with error: ${err.message}`);
    res.status(500).send(`File upload failed with error: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

/**
 * TODO: 하드코딩된 것들
 * 2. splitCount - 분할할 조각 수 -> FIXME: dotenv
 * 4. encryptedFilename - 사용자가 입력한 파일명을 대칭키로 암호화 -> FIXME: react에서 원본 파일명을 받아와서 암호화할 것.
 * 5. filesToCompare - 비교하려는 파일 경로들 -> FIXME: 다른 방법으로 파일 경로를 받아올 것.
 */

// TODO: 사용자가 업로드한 publicKey 파일 경로를 받아오도록 수정
const publicKeyPath = path.join(__dirname, 'key', 'public_key.pem'); // FIXME: 삭제 예정

const processFiles = async (originalFilePath, encryptedPassphrase) => {
  try {
    // 분할할 조각 수 설정
    const splitCount = 100;

    let encryptedPassword, originalFileNames, splitFilesPath;

    // Client-side와 Server-side를 구분
    // passphrase가 제공되었는지 확인
    if (encryptedPassphrase) {
      // 암호화된 파일과 passphrase를 처리
      ({ encryptedPassword, originalFileNames, splitFilesPath } = await processEncryptedFileAndPassphrase(originalFilePath, encryptedPassphrase, splitCount));
    } else {
      // 원본 파일을 암호화
      ({ encryptedPassword, originalFileNames, splitFilesPath } = await encryptAndSplitFile(originalFilePath, publicKeyPath, splitCount));
    }
    
    // middle.js의 최종 함수
    await manageFileUploadAndMapping(originalFileNames, splitFilesPath, process.env.UPLOAD_URL, encryptedPassphrase);
    logger.info(`파일 처리 완료`);

  } catch (error) {
    console.error('파일 처리 중 오류가 발생했습니다:', error);
  }
};

const afterProcessFiles = async (movedFilePaths) => {
  try {
    // getFileMappingInfo 함수 실행
    // 하드 코딩
    const encryptedFilename = '0be8366e87a3f33ae2d2ebb5fa9bfb21'; // 사용자가 입력한 파일명을 대칭키로 암호화

    await mergeAndDecryptFile(encryptedFilename, movedFilePaths)

    // 비교하려는 파일 경로들
    const filesToCompare = [
      // '/Users/mac/Documents/split_file/uploadfile/0be8366e87a3f33ae2d2ebb5fa9bfb21',
      '/Users/mac/Documents/split_file/backend/result/dummyfile.mp4',
      // '/Users/mac/Documents/split_file/encryptedfile/0be8366e87a3f33ae2d2ebb5fa9bfb21',
      // '/Users/mac/Documents/split_file/output/0be8366e87a3f33ae2d2ebb5fa9bfb21',
      '/Users/mac/Documents/split_file/backend/dummyfile.mp4'
        ];

    // 파일 비교 시작
    compareMultipleFiles(filesToCompare);
    
  } catch (error) {
    console.error('afterProcessFiles error:', error);
  }
};

// processFiles()
//   .then(movedFilePaths => afterProcessFiles(movedFilePaths))
//   .catch(error => {
//     console.error('오류 발생:', error);
//   });