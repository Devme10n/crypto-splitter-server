### 0. 프로젝트 구성 요소
- Client: https://github.com/Devme10n/crypto-splitter-client
- Server: https://github.com/Devme10n/crypto-splitter-server
- File-Server: https://github.com/Devme10n/crypto-splitter-file-server

## 1. 프로젝트 개요
Crypto Splitter는 파일을 암호화한 뒤,암호화된 파일을 100조각으로 분할하여 인터넷(파일 서버)에 전송함으로써 파일 암호화 및 분산 저장을 가능하게 하는 프로젝트입니다. 사용자의 요청 시 분할된 파일을 병합하여 복호화하고 사용함으로써 안전한 파일 암호화 및 전송을 지원합니다. 파일 내용과 접근을 보호하기 위해 대칭 및 비대칭 암호화를 활용합니다.

## 2. 기술 스택
### Front
- React
- Web Crypto API, jsencrypt

### Back
- Node.js, Express
- PostgreSQL, Sequielize
- Crypto, split-file


## 3. 아키텍처
![아키텍처](/Documents/아키텍처.png)

## 4. 시퀀스 다이어그램
### Cilent-side 시퀀스 다이어그램
![Client-side Sequence Diagram](/Documents/시퀀스%20다이어그램/client-side%20시퀀스다이어그램.png)

### Server-side 시퀀스 다이어그램
![Server-side Sequnece Diagram](/Documents/시퀀스%20다이어그램/server-side%20시퀀스다이어그램.png)

## 5. 문제점 및 해결 전략
1. 올바르지 못한 프로젝트 설계
    - 문제: 모듈형 설계에서 신규 기능 추가 시 역할별 기능 분류가 어려움

    
    - 해결 전략: 프로세스를 사람으로 치환하여 프로젝트 재설계, 비즈니스 모델은 컴퓨터를 사람으로 치환해도 100% 동작 가능한 모델이어야함, 신규 기능 추가시 각 모듈에 맞게 분리할 수 있었음.

    #### 프로젝트 재설계 전략
    1. 프로세스(무엇을 해야하는가) -> 사람  
       : 작업의 흐름과 동작(프로세스)을 사람의 역할로 추상화  
        <details>
        <summary>사진</summary>
        <img src="/Documents/split%20file-11.jpg" alt="Process -> Person" />
        </details>
    2. 사람(역할과 책임) -> Data Flow Diagram(DFD)  
       : 정의된 역할(작업과 책임)간의 데이터 흐름과 상호작용을 시각화
        <details>
        <summary>사진</summary>
        <img src="/Documents/split%20file-12.jpg" alt="Person -> DFD" />
        </details>    
    3. Data Flow Diagram(DFD) -> 모듈(기능 단위)  
       : 데이터 흐름과 상호 작용을 개별 모듈로 변환
        <details>
        <summary>사진</summary>
        <img src="/Documents/split%20file-13.jpg" alt="DFD -> Module" />
        </details>

2. 암호화 방법
    - 문제: RSA 키 길이보다 긴 데이터는 암호화할 수 없음

    - 생각한 전략: 
        1. 파일을 RSA 키 길이 보다 작게 분할하여 암호화

            장점: 높은 보안성, 파일 분할과 파일 암호화 순서만 변경하여 수행

            단점: 높은 CPU 사용량, 파일 크기에 비례해 암호화 시간 증가

        2. 하이브리드 암호화: 파일을 대칭키로 암호화 + 대칭키를 비대칭키로 암호화

            장점: RSA 대비 적은 CPU 사용량, 빠른 암호화 속도

            단점: 관리해야하는 키의 증가, 구현의 복잡성

    - 해결 전략: Node.js 환경에서 일반적으로 발생하는 높은 CPU 사용량 최소화, 빠른 암호화 속도 보장, 높은 수준의 보안 유지를 위해 하이브리드 암호화 채택

3. 파일 분할 알고리즘
    - 문제: 많은 사용자가 파일 분할 요청을 보내는 동시성이 높은 환경에서 병목 현상 발생

    - 원인: split-file 라이브러리는 Promise.mapSeries를 활용하여 Promise 목록을 순차적으로 처리하므로 여러 동시 요청 처리시 속도 저하가 발생

    - 해결 전략: Promise.all을 사용하도록 리팩토링, 서버가 파일 분할 작업을 동시에 처리. 파일 분할 실패시, fast-fail 특성을 활용하여 리소스를 낭비.