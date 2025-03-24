# 태스크 007: 개발자 가이드 개선

## 태스크 정보
- 생성일: 2025-03-24
- 완료일: 

## 태스크 목적
현재 개발자 가이드 문서를 검토하고 개선하여 보다 명확하고 유용한 가이드 제공

## 수행 단계
1. [x] 현재 developer-guide.md 문서 검토
   - [x] 환경별 명령어 체계 확인
   - [x] 에이전트 설정 프로세스 파악
   - [x] 태스크 관리 시스템 검토
   - [x] 파일 관리 가이드 확인

2. [x] 개선이 필요한 부분 식별
   - [x] Windows 환경 명령어 변환 필요성 확인
   - [x] 에이전트 관련 설명 부족 파악
   - [x] 규칙 파일 설명 부족 파악
   - [x] 환경 설정 파일 필요성 확인
   - [x] Git 관련 설정 필요성 확인

3. [x] 문서 1차 업데이트 완료
   - [x] Windows PowerShell 명령어로 변환
   - [x] 에이전트 소통 모드 및 컨텍스트 관리 설명 추가
   - [x] 태스크 계획 및 정의 섹션 추가
   - [x] VSCode 확장 개발 환경 설정 정보 추가
   - [x] Git 작업 관리 섹션 추가

4. [x] 관련 코드 파일 수정
   - [x] scripts/doc-watcher.cjs 파일 수정 (.env 지원 추가)
   - [x] .env.example 파일 생성
   - [x] .gitignore 파일 업데이트

5. [x] 문서 2차 업데이트 (코드 변경 반영)
   - [x] 운영체제 환경 명시 (Windows 기본, 추후 Linux/Mac 지원)
   - [x] global-rules.json 관련 상세 설명 추가
     - [x] CursorIDE 설정과의 관계 설명
     - [x] 파일 생성 및 수정 방법 안내
   - [x] project-rules 파일들의 역할과 관계 설명
   - [x] .env 파일 설정 방법 추가 (4-1, 4-2 반영)
   - [x] .gitignore 업데이트 안내 추가 (4-3 반영)

6. [ ] 변경 사항 커밋
   - [ ] 최종 검토
   - [ ] 변경사항 커밋 메시지 작성
   - [ ] 커밋 및 푸시

## 참고 자료
- [developer-guide.md](../../../developer-guide.md)
- [프로젝트 개요 문서](../../../project-overview.md)
- [project-rules 파일들](../../../agents-rules/alpha/)
- [scripts/doc-watcher.cjs](../../../scripts/doc-watcher.cjs)

## 진행 상황
- 2025-03-24: 개발자 가이드 기본 개선 완료 (Windows 명령어, 에이전트 설명, VSCode 설정 등)
- 2025-03-24: 마스터 피드백 수신 - global-rules 설명, project-rules 설명, .env 파일, .gitignore 업데이트 필요
- 2025-03-24: 태스크 순서 재구성 - 코드 파일 먼저 수정 후 문서 개선 진행하도록 변경
- 2025-03-24: 코드 파일 수정 완료 - scripts/doc-watcher.cjs 파일에 .env 지원 추가, .env.example 생성, .gitignore 파일 생성
- 2025-03-24: 문서 2차 업데이트 완료 - 운영체제 환경 명시, 규칙 파일 설명 추가, .env 설정 방법 추가, .gitignore 설명 추가

## 메모
- Windows 환경을 기본으로 하되, 추후 Linux/Mac 환경 지원 계획 언급 필요
- global-rules.json은 CursorIDE의 설정으로, 각 개발자별 설정 필요성 강조
- 개발자마다 감시 파일이 달라지므로 .env 파일을 통한 설정 필요
- .gitignore에 .env, .cursorrules, .windsurfrules 추가 필요
- 작업 완료 후 태스크 #008(Cline 프로젝트 분석)으로 이동 예정 