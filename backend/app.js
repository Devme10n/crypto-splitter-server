const { ensureDirectories, encryptAndSplitFile, processEncryptedFileAndPassphrase } = require('./file-processing/writer');
const { manageFileUploadAndMapping } = require('./file-processing/middle');
const { mergeAndDecryptFile } = require('./file-processing/reader');

const express = require('express');
const multiparty = require('multiparty');
const FormData = require('form-data');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { logger } = require('./utils/logger');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(500).send(`Multer error: ${err.message}`);
  } else if (err) {
    res.status(500).send(`Unknown server error: ${err.message}`);
  }
});

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

//---------------------------------------------------------
// 1. 파일 수신 및 저장
//---------------------------------------------------------
// 암호화된 파일과 passphrase를 수신하는 POST 요청 처리
app.post('/upload', upload.any(), async (req, res) => {
  try {
    const encryptedPassphrase = req.body['encryptedPassphrase'];
    const encryptedFilePath = req.files[0].path;
    if (!encryptedFilePath) {
      return res.status(400).send('No file was uploaded.');
    }
    else if (!encryptedPassphrase) {
      return res.status(400).send('No passphrase was uploaded.');
    }

    // processFiles 함수 호출
    await processFiles(encryptedFilePath, encryptedPassphrase);

    res.status(200).send('File and passphrase successfully uploaded.');
  } catch (err) {
    logger.error(`File upload failed with error: ${err.message}`);
    res.status(500).send(`File upload failed with error: ${err.message}`);
  }
});

app.post('/file', async (req, res) => {
  try {
    // 요청 수신 로그
    logger.info(`파일 업로드 요청 수신: fileName=${req.body.fileName}`);

    const originalFileName = req.body.fileName;

    if (!originalFileName) {
      return res.status(400).send('파일명이 제공되지 않았습니다.');
    }

    // afterProcessFiles 함수 호출 및 결과 로깅
    const { decryptedFileNamePath, encryptedPassphrase } = await afterProcessFiles(originalFileName);

    // 새로운 form 생성 및 파일 및 암호화된 패스프레이즈 추가 로깅
    const form = new FormData();
    form.append('file', fs.createReadStream(decryptedFileNamePath), {
      filename: originalFileName,
      contentType: 'application/octet-stream',
    });
    logger.info(`form에 파일 추가: ${decryptedFileNamePath}`);

    form.append('encryptedPassphrase', encryptedPassphrase, {
      filename: 'encryptedPassphrase',
      contentType: 'text/plain',
    });
    logger.info(`form에 암호화된 패스프레이즈 추가: ${encryptedPassphrase}`);

    // 헤더 설정 및 응답 전송 로깅
    logger.info(`헤더 설정 및 응답 전송: fileName: ${originalFileName}`);
    res.set(form.getHeaders());
    form.pipe(res);
  } catch (error) {
    // 에러 발생 시 로깅
    logger.error({ message: `파일 전송 실패: ${originalFileName}`, error: error.toString() });
    res.status(500).send(`파일 처리 중 오류 발생: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// TODO: https 서버로 변경

// TODO: 사용자가 업로드한 publicKey 파일 경로를 받아오도록 수정
const publicKeyPath = path.join(__dirname, 'key', 'public_key.pem'); // FIXME: 삭제 예정

const processFiles = async (originalFilePath, encryptedPassphrase) => {
  try {
    // 분할할 조각 수 설정
    const splitCount = Number(process.env.FILE_SPLIT_COUNT) || 100;

    // Client-side와 Server-side를 구분
    if (encryptedPassphrase) {
      // 암호화된 파일과 passphrase를 처리
      // console.log("Client-side에서 암호화된 파일과 passphrase를 처리")
      ({ encryptedPassphrase, originalFileNames, splitFilesPath } = await processEncryptedFileAndPassphrase(originalFilePath, encryptedPassphrase, splitCount));
    } else {
      // 원본 파일을 암호화
      // console.log("Server-side에서 원본 파일을 암호화")
      ({ encryptedPassphrase, originalFileNames, splitFilesPath } = await encryptAndSplitFile(originalFilePath, publicKeyPath, splitCount));
    }
    
    // middle.js의 최종 함수
    await manageFileUploadAndMapping(originalFileNames, splitFilesPath, `${process.env.FILE_SERVER_URL}/upload`, encryptedPassphrase);
    logger.info(`파일 처리 완료`);
  } catch (error) {
    logger.error('파일 처리 중 오류가 발생했습니다:', error);
  }
};

const afterProcessFiles = async (originalFileName) => {
  try {
    const { decryptedFileNamePath, encryptedPassphrase } = await mergeAndDecryptFile(originalFileName)

    return { decryptedFileNamePath, encryptedPassphrase };
  } catch (error) {
    logger.error('afterProcessFiles error:', error);
  }
};