## 목차

- [1. 변수 스코프와 try/catch 블록](#변수-스코프와-trycatch-블록)
- [2. JavaScript에서 비동기 코드로 전환하기](#JavaScript에서-비동기-코드로-전환하기)

---

<br>
<details>
<summary>변수 스코프와 try/catch 블록</summary>
<br>

참조: file-processing/writer.js/async function splitEncryptedFile

변수의 스코프 관리는 프로그래밍에서 매우 중요한 부분입니다. 특히 `try/catch` 블록을 사용할 때는, 어디에서 변수를 선언하고 어떻게 관리할지 주의 깊게 고려해야 합니다. 아래에 `try/catch` 블록 바깥에서 변수를 선언하여 두 블록 내에서 해당 변수를 사용할 수 있도록 하는 올바른 방법에 대해 정리했습니다.

## 변수 스코프와 try/catch 블록

1. **변수 선언 위치**: 변수가 `try` 블록과 `catch` 블록 양쪽에서 필요한 경우, 변수를 이들 블록의 바깥쪽, 즉 두 블록이 속한 같은 스코프에 선언해야 합니다. 이렇게 하면 두 블록 모두에서 변수에 접근할 수 있습니다.

2. **`let` 또는 `const` 사용**: 변수를 선언할 때는 `let` 또는 `const` 키워드를 사용하여 변수의 스코프를 명확히 합니다. 일반적으로는 `let`을 사용하여 변수를 선언하고, 필요에 따라 변수의 값을 변경할 수 있게 합니다.

3. **초기화 방법**: 변수를 선언할 때 초기값을 할당할 수 있습니다. 초기값이 없는 경우에는 `null`이나 적절한 기본값을 할당하여 변수를 초기화할 수 있습니다.

4. **변수 사용**: `try` 블록에서 변수에 값을 할당하거나 변수를 사용하고, `catch` 블록에서는 변수의 값을 확인하거나 추가적인 작업을 수행할 수 있습니다.

## 예시 코드

```javascript
let someVariable = null;  // 변수를 try/catch 블록 바깥에서 선언하고 초기화

try {
    // try 블록에서 변수에 값을 할당하거나 변수를 사용
    someVariable = performSomeOperation();
    // ... 추가 작업 ...
} catch (error) {
    console.error('오류 발생:', error);

    // catch 블록에서 변수의 값을 확인하고 추가 작업을 수행
    if (someVariable) {
        performCleanup(someVariable);
    }
}
```
</details>

<br>
<details>
<summary>JavaScript에서 비동기 코드로 전환하기</summary>
<br>

Node.js에서 특히 파일 처리 및 데이터베이스 작업과 같은 비차단 작업을 가능하게 하는 비동기 프로그래밍은 자바스크립트의 핵심입니다. 콜백 기반 코드에서 프로미스 기반으로 전환하고 `async/await`를 사용하여 보다 깔끔한 코드를 작성하는 방법을 이해하는 것이 중요합니다. 여기서는 `fs` 모듈을 예로 들어 설명합니다.

## `fs.promises` 사용하기

Node.js의 `fs` 모듈은 파일 작업을 위한 네이티브 프로미스 지원을 포함하고 있으며, `fs.promises` API를 제공합니다. 이 접근법은 콜백 기반 대비 더 깨끗하고 직관적입니다.

### `fs.promises` 예제

```javascript
const fsp = require('fs').promises;
const path = require('path');

async function renameFileAsync() {
    try {
        const oldPath = path.join(__dirname, 'oldExample.txt');
        const newPath = path.join(__dirname, 'newExample.txt');
        await fsp.rename(oldPath, newPath);
        console.log(`File has been renamed from ${oldPath} to ${newPath}`);
    } catch (error) {
        console.error('Error renaming file:', error);
    }
}

renameFileAsync();
```

## util.promisify 사용하기

프로미스를 네이티브로 지원하지 않는 모듈이나 메서드의 경우, Node.js의 `util.promisify`를 사용하여 콜백 기반 함수를 프로미스로 변환할 수 있습니다.

### util.promisify 예제

```javascript
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');

const rename = promisify(fs.rename);

async function renameFileAsync() {
    try {
        const oldPath = path.join(__dirname, 'oldExample.txt');
        const newPath = path.join(__dirname, 'newExample.txt');
        await rename(oldPath, newPath);
        console.log(`File has been renamed from ${oldPath} to ${newPath}`);
    } catch (error) {
        console.error('Error renaming file:', error);
    }
}

renameFileAsync();
```

## 수동 래핑

함수가 표준 에러-퍼스트 콜백 패턴을 따르지 않거나 util.promisify가 사용 가능한 환경이 아닌 경우, 함수를 프로미스로 수동으로 래핑해야 할 수 있습니다.

### 수동 래핑 예제

```javascript
const fs = require('fs');
const path = require('path');

function renameFileAsync(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(`File has been renamed from ${oldPath} to ${newPath}`);
            }
        });
    });
}

const oldPath = path.join(__dirname, 'oldExample.txt');
const newPath = path.join(__dirname, 'newExample.txt');

renameFileAsync(oldPath, newPath)
    .then(successMessage => console.log(successMessage))
    .catch(error => console.error('Error renaming file:', error));
```

## 결론

가능한 경우 fs.promises나 util.promisify와 같은 유틸리티를 사용하여 콜백 기반 함수를 프로미스로 변환하세요. 이 방법은 코드를 더 깔끔하고 현대적으로 만들며 오류 가능성을 줄입니다. 수동 래핑은 다른 옵션이 통하지 않을 때만 조심스럽게 사용하세요.
이 가이드는 fs 모듈에 중점을 두고 있지만, 원칙은 Node.js 및 JavaScript의 비동기 프로그래밍 전반에 적용됩니다.

</details>