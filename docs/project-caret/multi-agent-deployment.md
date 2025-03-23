# VS Code AI 오케스트레이션 시스템: 배포 및 설정 가이드

> **중요 참고사항**: 이 문서는 개념적 참조 구현을 위한 설계 가이드입니다. 제공된 코드와 설정 예시는 실제 환경에 적용하기 전 검증이 필요하며, VS Code 확장 개발에 익숙한 개발자를 위한 참조용입니다.

## 1. 시스템 요구사항

### 1.1 개발 환경 요구사항

VS Code AI 오케스트레이션 확장을 개발하고 실행하기 위한 최소 요구사항:

| 구성 요소 | 최소 요구사항 | 권장 사항 |
|----------|--------------|----------|
| **Node.js** | 16.x 이상 | 18.x 이상 |
| **VS Code** | 1.70.0 이상 | 최신 안정 버전 |
| **Git** | 2.30.0 이상 | 최신 버전 |
| **메모리** | 8GB | 16GB 이상 |
| **저장공간** | 1GB (확장용) | 10GB 이상 (모델 캐싱용) |

### 1.2 로컬 모델 실행 요구사항 (선택 사항)

로컬에서 AI 모델을 실행하는 경우 (Ollama 등 사용 시):

| 구성 요소 | 최소 요구사항 | 권장 사항 |
|----------|--------------|----------|
| **CPU** | 4코어 이상 | 8코어 이상 |
| **메모리** | 16GB | 32GB 이상 |
| **GPU** | 6GB VRAM (소형 모델용) | 12GB+ VRAM (중형 모델용) |
| **저장공간** | 10GB (기본 모델용) | 50GB 이상 (여러 모델용) |

### 1.3 네트워크 요구사항

| 서비스 | 요구사항 |
|--------|---------|
| **원격 API 사용** | 안정적인 인터넷 연결, 방화벽에서 API 엔드포인트 허용 |
| **로컬 모델 사용** | 로컬 포트 (예: 11434 - Ollama) 접근 허용 |
| **팀 협업 기능** | 방화벽에서 WebSocket 통신 허용 (VS Code Live Share 사용 시) |

## 2. VS Code 확장 패키지 구조

### 2.1 디렉토리 구조

```
vscode-ai-orchestration/
├── .vscode/                  # VS Code 설정
├── media/                    # 아이콘 및 웹뷰 리소스
├── src/
│   ├── extension.ts          # 확장 진입점
│   ├── api/                  # AI 모델 API 연동
│   │   ├── modelConnector.ts # 모델 커넥터 인터페이스
│   │   ├── openaiModel.ts    # OpenAI 모델 연동
│   │   ├── claudeModel.ts    # Claude 모델 연동
│   │   └── ollamaModel.ts    # Ollama 로컬 모델 연동
│   ├── workflow/             # 워크플로우 관련 코드
│   │   ├── workflowTypes.ts  # 워크플로우 타입 정의
│   │   ├── workflowManager.ts# 워크플로우 관리
│   │   └── workflowEditor.ts # 워크플로우 에디터
│   ├── storage/              # 데이터 저장 관련
│   │   ├── storageManager.ts # 스토리지 관리
│   │   └── gitStorage.ts     # Git 기반 저장소
│   ├── collaboration/        # 팀 협업 관련
│   │   ├── liveShareIntegration.ts # Live Share 통합
│   │   └── notificationManager.ts  # 알림 시스템
│   └── ui/                   # 사용자 인터페이스
│       ├── webviews/         # 웹뷰 관련 코드
│       ├── commands.ts       # 명령어 등록
│       └── statusBar.ts      # 상태 표시줄 항목
├── webview-ui/               # 웹뷰 프론트엔드 (React 등)
├── package.json              # 확장 매니페스트
├── tsconfig.json             # TypeScript 설정
├── webpack.config.js         # 번들링 설정
└── README.md                 # 문서
```

### 2.2 package.json 구성

기본적인 package.json 설정 예시:

```json
{
  "name": "vscode-ai-orchestration",
  "displayName": "AI Workflow Orchestration",
  "description": "VS Code에서 AI 워크플로우를 생성하고 관리하는 확장",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.70.0"
  },
  "categories": [
    "Other",
    "Machine Learning",
    "Programming Languages"
  ],
  "activationEvents": [
    "onCommand:aiOrchestration.showWorkflowEditor",
    "onView:aiOrchestrationWorkflows"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "aiOrchestration.showWorkflowEditor",
        "title": "AI 워크플로우 에디터 열기"
      },
      {
        "command": "aiOrchestration.runWorkflow",
        "title": "AI 워크플로우 실행"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "ai-orchestration",
          "title": "AI 워크플로우",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "ai-orchestration": [
        {
          "id": "aiOrchestrationWorkflows",
          "name": "워크플로우"
        }
      ]
    },
    "configuration": {
      "title": "AI 워크플로우 오케스트레이션",
      "properties": {
        "aiOrchestration.apiKeys.openai": {
          "type": "string",
          "default": "",
          "description": "OpenAI API 키"
        },
        "aiOrchestration.apiKeys.anthropic": {
          "type": "string",
          "default": "",
          "description": "Anthropic Claude API 키"
        },
        "aiOrchestration.localModel.url": {
          "type": "string",
          "default": "http://localhost:11434",
          "description": "로컬 모델 URL (Ollama 등)"
        },
        "aiOrchestration.defaultModel": {
          "type": "string",
          "enum": ["openai", "claude", "ollama"],
          "default": "openai",
          "description": "기본 AI 모델 선택"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run package",
    "compile": "webpack --config ./webpack.config.js",
    "watch": "webpack --watch --config ./webpack.config.js",
    "package": "webpack --mode production --devtool hidden-source-map",
    "lint": "eslint src --ext ts",
    "test": "jest"
  },
  "devDependencies": {
    "@types/glob": "^8.0.1",
    "@types/mocha": "^10.0.1",
    "@types/node": "16.x",
    "@types/vscode": "^1.70.0",
    "@typescript-eslint/eslint-plugin": "^5.49.0",
    "@typescript-eslint/parser": "^5.49.0",
    "@vscode/test-electron": "^2.2.2",
    "eslint": "^8.33.0",
    "glob": "^8.1.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.2",
    "typescript": "^4.9.4",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.1"
  },
  "dependencies": {
    "@vscode/webview-ui-toolkit": "^1.2.2",
    "axios": "^1.3.4",
    "langchain": "^0.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

## 3. 설치 및 배포 절차

### 3.1 로컬 개발 환경 설정

1. **프로젝트 클론 및 의존성 설치**

```bash
git clone <repository-url> vscode-ai-orchestration
cd vscode-ai-orchestration
npm install
```

2. **개발 모드에서 실행**

VS Code에서 프로젝트를 열고 F5를 눌러 개발 모드에서 실행합니다. 이렇게 하면 확장 개발용 VS Code 인스턴스가 시작됩니다.

3. **디버깅 및 테스트**

```bash
# 컴파일 및 감시
npm run watch

# 린팅
npm run lint

# 테스트 실행
npm run test
```

### 3.2 VSIX 패키지 생성

확장을 배포하기 위한 VSIX 패키지를 생성합니다:

```bash
# vsce 도구 설치 (처음 한 번만)
npm install -g @vscode/vsce

# VSIX 패키지 생성
vsce package
```

이 명령은 `vscode-ai-orchestration-0.1.0.vsix` 형식의 패키지 파일을 생성합니다.

### 3.3 확장 설치 방법 (사용자용)

#### 3.3.1 VS Code 마켓플레이스에서 설치

1. VS Code에서 확장 탭 열기 (Ctrl+Shift+X)
2. 검색창에 "AI Workflow Orchestration" 입력
3. "Install" 버튼 클릭

#### 3.3.2 VSIX 파일에서 설치

1. VS Code에서 확장 탭 열기 (Ctrl+Shift+X)
2. 탭 상단의 "..." 메뉴에서 "Install from VSIX..." 선택
3. VSIX 파일 선택 및 설치

## 4. 외부 서비스 설정

### 4.1 Ollama 설정 (로컬 모델)

Ollama를 사용하여 로컬에서 AI 모델을 실행하는 방법:

1. [Ollama 공식 웹사이트](https://ollama.ai/)에서 운영체제에 맞는 설치 파일 다운로드 및 설치
2. 기본 모델 내려받기:

```bash
# 터미널에서 실행
ollama pull mistral
```

3. Ollama 서버 실행:

```bash
# 자동으로 시작되지만, 수동 실행이 필요한 경우
ollama serve
```

4. VS Code 확장 설정에서 Ollama URL 구성:
   - 설정 > 확장 > AI 워크플로우 오케스트레이션 > 로컬 모델 URL
   - 기본값: `http://localhost:11434`

### 4.2 API 키 구성

#### 4.2.1 OpenAI API 키 설정

1. [OpenAI 플랫폼](https://platform.openai.com/)에서 계정 생성 및 API 키 발급
2. VS Code 설정에서 API 키 구성:
   - 설정 > 확장 > AI 워크플로우 오케스트레이션 > OpenAI API 키
   - 또는 settings.json 파일에 직접 추가:

```json
{
  "aiOrchestration.apiKeys.openai": "sk-your-api-key"
}
```

#### 4.2.2 Anthropic Claude API 키 설정

1. [Anthropic 콘솔](https://console.anthropic.com/)에서 계정 생성 및 API 키 발급
2. VS Code 설정에서 API 키 구성:
   - 설정 > 확장 > AI 워크플로우 오케스트레이션 > Anthropic Claude API 키

### 4.3 팀 협업 서버 설정 (옵션)

팀 협업 기능을 위한 VS Code Live Share 설정:

1. VS Code에서 Live Share 확장 설치
2. Microsoft 계정 또는 GitHub 계정으로 로그인
3. AI 오케스트레이션 확장에서 Live Share 통합 활성화:
   - 설정 > 확장 > AI 워크플로우 오케스트레이션 > 팀 협업 > Live Share 통합 활성화

## 5. 사용자 설정 옵션

### 5.1 기본 설정 옵션

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `aiOrchestration.defaultModel` | 기본 AI 모델 | `"openai"` |
| `aiOrchestration.defaultModelInstance` | 모델 인스턴스 (예: gpt-4) | `"gpt-4"` |
| `aiOrchestration.maxTokens` | 최대 토큰 수 | `4096` |
| `aiOrchestration.temperature` | 응답 다양성 조절 | `0.7` |
| `aiOrchestration.workflowsLocation` | 워크플로우 저장 위치 | `.vscode/ai-workflows` |

### 5.2 고급 설정 옵션

```json
{
  "aiOrchestration.advanced.caching": true,
  "aiOrchestration.advanced.cachingTTL": 3600,
  "aiOrchestration.advanced.contextWindow": 8192,
  "aiOrchestration.advanced.networkTimeout": 30000,
  "aiOrchestration.advanced.retryAttempts": 3,
  "aiOrchestration.advanced.logLevel": "info"
}
```

### 5.3 실행 환경별 설정

`settings.json` 파일에서 환경별 설정 구성:

```json
{
  "aiOrchestration.environments": {
    "development": {
      "defaultModel": "ollama",
      "ollamaUrl": "http://localhost:11434"
    },
    "production": {
      "defaultModel": "openai",
      "apiKeys": {
        "openai": "${env:OPENAI_API_KEY}"
      }
    }
  },
  "aiOrchestration.activeEnvironment": "development"
}
```

## 6. 확장 업데이트 및 관리

### 6.1 자동 업데이트

VS Code는 기본적으로 설치된 확장을 자동으로 업데이트합니다. 다음 설정으로 확장 자동 업데이트를 제어할 수 있습니다:

```json
{
  "extensions.autoUpdate": true,
  "extensions.autoCheckUpdates": true
}
```

### 6.2 수동 업데이트

1. VS Code에서 확장 탭 열기
2. "AI Workflow Orchestration" 확장을 찾아 업데이트 버튼 클릭 (사용 가능한 경우)

### 6.3 확장 관리 도구

확장 관리를 위한 VS Code CLI:

```bash
# 설치된 확장 목록 보기
code --list-extensions

# VSIX에서 확장 설치
code --install-extension path/to/vscode-ai-orchestration.vsix

# 확장 제거
code --uninstall-extension vscode-ai-orchestration
```

## 7. 문제 해결 및 지원

### 7.1 일반적인 문제

| 문제 | 해결 방법 |
|------|----------|
| **확장이 활성화되지 않음** | 로그 확인: 도움말 > 개발자 도구 > 콘솔 |
| **API 연결 실패** | API 키와 네트워크 연결 확인, 방화벽 설정 점검 |
| **로컬 모델 연결 실패** | Ollama 서버 실행 상태 확인, URL 설정 검증 |
| **워크플로우 저장 실패** | 권한 및 디스크 공간 확인 |
| **UI가 렌더링되지 않음** | VS Code 재시작, 확장 재설치 |

### 7.2 로그 수집 및 분석

확장의 로그를 확인하는 방법:

1. VS Code 명령 팔레트 열기 (Ctrl+Shift+P)
2. "Developer: Open Extension Logs Folder" 실행
3. 확장 관련 로그 파일 확인

## 8. 보안 고려사항

### 8.1 API 키 보안

API 키 관리를 위한 보안 권장사항:

1. **환경 변수 사용**: 하드코딩 대신 환경 변수를 통해 API 키 제공
2. **키 순환**: 정기적으로 API 키 교체
3. **범위 제한**: 최소 권한 원칙에 따라 API 키 권한 제한

### 8.2 데이터 보안

민감한 데이터 처리에 관한 권장사항:

1. **로컬 저장**: 민감한 데이터는 가능한 로컬에 저장
2. **암호화**: 저장된 설정 및 워크플로우 데이터 암호화
3. **최소화**: 필요한 최소한의 데이터만 외부 API로 전송

## 9. 참고 자료

- [VS Code 확장 API 문서](https://code.visualstudio.com/api)
- [VS Code 확장 개발 가이드](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Ollama 문서](https://github.com/ollama/ollama)
- [OpenAI API 문서](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API 문서](https://docs.anthropic.com/claude/reference/)
- [VS Code Live Share API](https://docs.microsoft.com/en-us/visualstudio/liveshare/reference/api) 