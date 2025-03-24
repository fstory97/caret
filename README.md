# Caret → Cline 프로젝트 전환 안내

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Development Status](https://img.shields.io/badge/status-방향전환-orange)
![Korean Support](https://img.shields.io/badge/한국어-지원-brightgreen.svg)

> **중요 공지**: 프로젝트 방향이 변경되었습니다. 독자적인 Caret 개발에서 오픈소스 프로젝트 **Cline(씨라인)** 기여로 전환합니다.

## 📢 방향 전환 안내

당초 계획했던 독자적인 VSCode 확장 프로그램 "Caret" 개발에서 기존 오픈소스 프로젝트 "Cline"에 기여하는 방향으로 전환하게 되었습니다. 이러한 결정은 다음과 같은 분석을 바탕으로 이루어졌습니다:

- Cline은 이미 상당한 성숙도를 갖춘 프로젝트로, 많은 사용자를 보유
- 핵심 기능(에이전틱 코딩, 파일 편집, 터미널 연동 등)이 이미 구현되어 있음
- 오픈소스 프로젝트로 기여 가능성이 열려있음
- 보다 효율적인 자원 활용과 빠른 성과 창출이 가능

자세한 분석과 전환 계획은 [Cline 프로젝트 전환 계획](/docs/transition-to-cline.md) 문서를 참조하세요.

## 🔍 Cline 프로젝트 개요

[Cline(씨라인)](https://cline.bot)은 VSCode용 에이전틱 코딩 어시스턴트로, 다음과 같은 특징을 가지고 있습니다:

- **파일 생성 및 편집**: 코드 파일 자동 생성 및 수정
- **터미널 명령 실행**: VSCode 통합 터미널에서 명령 실행
- **브라우저 통합**: 헤드리스 브라우저를 통한 웹 탐색 및 테스트
- **다양한 AI 모델 지원**: Claude 3.7 Sonnet(기본), OpenAI, Gemini 등
- **로컬 모델 지원**: Ollama, LM Studio 등을 통한 로컬 실행

## 🎯 새로운 프로젝트 목표

기존 Caret의 이념을 살려 Cline 프로젝트에 다음과 같은 기여를 목표로 합니다:

1. **한국어 최적화**: 한국어 프롬프트 및 시스템 메시지 최적화, 한국어 문서화
2. **로컬 LLM 통합 강화**: Ollama 연동 최적화, 한국어 특화 로컬 모델 지원 개선
3. **커뮤니케이션 모드 시스템**: 개발/논의/룰/잡담 모드 구현
4. **태스크 관리 시스템**: 체계적인 태스크 관리 및 작업 로그 기능 구현

## 🚀 다음 단계

1. **환경 설정**
   - VSCode 설치 및 Cline 확장 설치
   - 개발 환경 구성 (로컬 저장소 클론 등)

2. **초기 분석 및 기여**
   - 소규모 기여로 시작 (문서, 버그 수정 등)
   - 한국어 관련 기능 개선 제안 및 구현
   - 커뮤니티 참여 및 네트워킹

3. **한국 Cline 커뮤니티 구축**
   - 한국어 문서 및 튜토리얼 제작
   - 커뮤니티 채널 구축 (Discord/오픈카카오톡)
   - 한국 개발자 기여자 네트워크 형성

## 📚 문서

- [Cline 프로젝트 전환 계획](/docs/transition-to-cline.md)
- [Cline 분석 보고서](/docs/references/cline-analysis-report.md)
- [Cline 기여 전략 보고서](/docs/references/cline-contribution-report.md)
- [Cline 빠른 기여 태스크](/docs/references/cline-quick-contribution-tasks.md)
- [볼드모트 분석 자료](/docs/references/voldemort/)
- [볼드모트 분석 검증 보고서](/docs/references/voldemort/analysis-verification-report.md)

## 🔧 기술 스택

- VSCode Extension API
- TypeScript/JavaScript
- React (UI 컴포넌트)
- AI 모델 통합 (Claude, OpenAI, Ollama 등)

## 📜 라이센스

본 저장소의 내용은 MIT 라이센스 하에 배포됩니다. 자세한 내용은 [LICENSE](/LICENSE) 파일을 참조하세요.

---
**참고**: Cline 프로젝트는 Apache 2.0 라이센스로 배포되며, 기여 시 해당 라이센스를 준수해야 합니다.
