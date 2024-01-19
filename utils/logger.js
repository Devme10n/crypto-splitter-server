// 오류 출력 함수
function logError(err) {
    console.error(`오류가 발생했습니다: ${err.message}`);
    console.error(`오류 위치: ${err.stack}`);
}

module.exports = {
    logError
};
