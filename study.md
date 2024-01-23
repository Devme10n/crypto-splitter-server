## 목차

- [1. 변수 스코프와 try/catch 블록](#변수-스코프와-trycatch-블록)

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