let expect;
const fs = require('fs').promises;
const path = require('path');
const { encryptAndSplitFile, ensureTempDirectory, changeFilename } = require('../file-processing/writer');

describe('writer.js 테스트', function() {
    const tempTestDir = path.join(__dirname, '..', 'uploadfile');
    const dummyFilePath = path.join(tempTestDir, 'dummyfile');
    const publicKeyPath = path.join(__dirname, '..', 'key', 'public_key.pem');
    const splitCount = 100; // 분할 개수, 테스트 용도로 임의 설정

    before(async function() {
        // chai 모듈을 동적으로 불러옵니다
        const chaiModule = await import('chai');
        expect = chaiModule.expect;

        // 설정: 임시 디렉토리 생성
        await ensureTempDirectory();
    });

    after(async function() {
        // 정리: 테스트 동안 생성된 파일과 디렉토리 제거
        // 임시 디렉토리와 분할된 파일들을 삭제합니다
        // await deleteFolderAndFiles(path.join(__dirname, '..', 'temp'));

        // 암호화된 파일명을 원래의 파일명(dummyfile)으로 변경
        // const encryptedFilePath = path.join(__dirname, '..', 'uploadfile', 'c14b8211d0b37c6a89a1c448c59c028f');
        // await changeFilename(encryptedFilePath, 'dummyfile');
    });

    it('파일명을 암호화하고 파일을 올바르게 분할해야 함', async function() {
        // encryptAndSplitFile 함수를 호출하여 파일명 암호화 및 분할 수행
        const { originalFileNames, splitFilesPath } = await encryptAndSplitFile(dummyFilePath, publicKeyPath, splitCount);

        // 분할된 파일의 개수가 예상과 일치하는지 확인
        expect(originalFileNames.length).to.equal(splitCount);

        // 분할된 각 파일이 존재하는지 확인
        for (const fileName of originalFileNames) {
            try {
                await fs.access(splitFilesPath);
                expect(true).to.be.true;  // 파일에 접근 가능하면 테스트 통과
            } catch (error) {
                console.error(`파일 접근 실패: ${filePath}`, error);
                expect(true).to.be.false;  // 파일에 접근 불가능하면 테스트 실패
            }
        }
    });
});
