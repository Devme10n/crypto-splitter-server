import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FileSplitToDirectory } from 'file-split-to-directory';

const tempPath = path.join(process.cwd(), 'temp'); // 현재 위치에 temp 폴더 생성
const internetPath = path.join(process.cwd(), 'internet');

// temp 디렉토리 확인 및 재생성 함수
async function ensureTempDirectory() {
    try {
        await fs.access(tempPath); // temp 디렉토리 존재 확인
        await fs.rm(tempPath, { recursive: true }); // 존재하면 삭제
    } catch (e) {
        // 존재하지 않으면 에러 발생, 이 경우 아무것도 하지 않음
    }
    await fs.mkdir(tempPath); // 새 temp 디렉토리 생성
    console.log('temp 디렉토리 생성 완료');
}

// DES 암호화 함수
function encryptWithDES(text) {
    const cipher = crypto.createCipher('des', 'your-secret-key');
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// UUID 배열 생성 함수
function getUUIDArray(length) {
    return Array.from({ length }, () => crypto.randomUUID());
}

// 파일을 100조각으로 쪼개는 함수
async function splitFile(filePath, uuidFileNames) {
    try {
        const fstd = new FileSplitToDirectory();
        fstd.directoryNameGenerator = (i) => i.toString();
        fstd.runSync(filePath, 100); // 100조각으로 쪼갬
        console.log('파일 분할 완료');
    } catch (e) {
        // handle file system error
        console.error('파일 분할 중 에러 발생:', e);
    }
}

// 파일 정보 DB 저장 함수
async function storeFileInfoInDB(encryptedFileName, uuidFileNames) {

}

// 파일 이동 함수
async function moveFiles(filePaths, targetDirectory) {
  for (const filePath of filePaths) {
    const targetPath = path.join(targetDirectory, path.basename(filePath));
    await fs.rename(filePath, targetPath);
  }
}

// 메인 함수
async function main() {
    await ensureTempDirectory();

    const directoryPath = path.join(process.cwd(), 'uploadfile'); // 'uploadfile' 디렉토리 경로
    const filePath = path.join(directoryPath, 'dummyfile'); // 'dummyfile' 경로
    const originalFileName = path.basename(filePath);
    console.log('파일 이름: ', originalFileName)

    const uuidFileNames = getUUIDArray(100); // 먼저 UUID 배열 생성
    console.log('UUID 배열: ', uuidFileNames);

    await splitFile(directoryPath, uuidFileNames); // 'uploadfile' 디렉토리를 스캔하여 파일 분할

    // const encryptedFileName = encryptWithDES(originalFileName);

    // // await storeFileInfoInDB(encryptedFileName, uuidFileNames);

    // const chunkPaths = uuidFileNames.map(name => path.join(tempPath, name)); // UUID를 이용해 분할된 파일 경로 생성

    // await moveFiles(chunkPaths, internetPath);

    // await fs.unlink(filePath); // 원본 파일 삭제
}

main().catch(console.error);
