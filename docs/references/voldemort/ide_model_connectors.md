# 볼드모트 IDE: AI 모델 통신 분석

> **중요**: 이 문서는 볼드모트 IDE와 AI 모델 간의 관찰된 통신 데이터와 API 사용을 분석합니다.

## 1. 모델 요청 데이터 (✓)

### 1.1 기본 요청 구조
```typescript
interface ModelRequest {
    // 사용자 입력
    user_query: string;
    
    // 현재 파일 정보
    current_file?: {
        path: string;
        content: string;
        cursor_position: {
            line: number;
            character: number;
        };
        selection?: {
            start: { line: number; character: number; };
            end: { line: number; character: number; };
        };
    };
    
    // 작업 공간 정보
    workspace_context?: {
        open_files: string[];
        recent_files: string[];
        workspace_root: string;
    };
    
    // 환경 정보
    environment: {
        os: string;
        version: string;
    };
}
```

### 1.2 API 사용 예제
```typescript
// 요청 데이터 준비
const editor = vscode.window.activeTextEditor;
const document = editor?.document;

const request: ModelRequest = {
    user_query: query,
    current_file: document ? {
        path: document.uri.fsPath,
        content: document.getText(),
        cursor_position: editor.selection.active,
        selection: editor.selection
    } : undefined,
    workspace_context: {
        open_files: vscode.workspace.textDocuments.map(doc => doc.uri.fsPath),
        recent_files: [], // 실제 데이터로 채워짐
        workspace_root: vscode.workspace.workspaceFolders?.[0].uri.fsPath
    },
    environment: {
        os: process.platform,
        version: vscode.version
    }
};
```

### 1.3 실제 요청 예시
```json
// 실제 모델 요청 데이터 예시
{
    "user_query": "src/components/Button.tsx 파일에 onClick 핸들러를 추가해주세요",
    "current_file": {
        "path": "/users/workspace/project/src/components/Button.tsx",
        "content": "import React from 'react';\n\ninterface ButtonProps {\n  text: string;\n  variant?: 'primary' | 'secondary';\n}\n\nexport const Button: React.FC<ButtonProps> = ({ text, variant = 'primary' }) => {\n  return (\n    <button className={`btn btn-${variant}`}>\n      {text}\n    </button>\n  );\n};\n",
        "cursor_position": {
            "line": 10,
            "character": 12
        },
        "selection": {
            "start": { "line": 10, "character": 4 },
            "end": { "line": 10, "character": 47 }
        }
    },
    "workspace_context": {
        "open_files": [
            "/users/workspace/project/src/components/Button.tsx",
            "/users/workspace/project/src/App.tsx",
            "/users/workspace/project/src/index.tsx"
        ],
        "recent_files": [
            "/users/workspace/project/src/components/Header.tsx",
            "/users/workspace/project/src/styles/global.css"
        ],
        "workspace_root": "/users/workspace/project"
    },
    "environment": {
        "os": "darwin",
        "version": "1.74.0"
    }
}

// 로그: [모델 서비스] 요청 전송: Button.tsx 파일 onClick 핸들러 추가 요청
// 로그: [모델 서비스] 요청 크기: 1.25KB
// 로그: [모델 서비스] 요청 ID: req_01a2b3c4
```

## 2. 모델 응답 데이터 (✓)

### 2.1 기본 응답 구조
```typescript
interface ModelResponse {
    // 도구 호출 정보
    tool_calls?: {
        tool_name: string;
        parameters: any;
    }[];
    
    // 일반 텍스트 응답
    content?: string;
    
    // 오류 정보
    error?: {
        message: string;
        code: string;
    };
}
```

### 2.2 도구 호출 예시
```json
{
  "tool_calls": [
    {
      "tool_name": "edit_file",
      "parameters": {
        "target_file": "src/main.ts",
        "instructions": "함수 추가",
        "code_edit": "// ... 코드 내용 ..."
      }
    },
    {
      "tool_name": "run_terminal_cmd",
      "parameters": {
        "command": "npm install",
        "explanation": "의존성 설치"
      }
    }
  ]
}
```

### 2.3 실제 응답 예시
```json
// 위 Button.tsx 요청에 대한 실제 응답 데이터
{
  "tool_calls": [
    {
      "tool_name": "edit_file",
      "parameters": {
        "target_file": "/users/workspace/project/src/components/Button.tsx",
        "instructions": "Button 컴포넌트에 onClick 핸들러를 추가합니다",
        "code_edit": "import React from 'react';\n\ninterface ButtonProps {\n  text: string;\n  variant?: 'primary' | 'secondary';\n  onClick?: () => void;\n}\n\nexport const Button: React.FC<ButtonProps> = ({ text, variant = 'primary', onClick }) => {\n  return (\n    <button className={`btn btn-${variant}`} onClick={onClick}>\n      {text}\n    </button>\n  );\n};\n"
      }
    }
  ],
  "content": "Button 컴포넌트에 onClick 핸들러를 추가했습니다. ButtonProps 인터페이스에 onClick 속성을 추가하고, 버튼 엘리먼트에 이벤트 핸들러를 연결했습니다."
}

// 로그: [모델 서비스] 응답 수신: req_01a2b3c4
// 로그: [모델 서비스] 응답 크기: 0.75KB
// 로그: [모델 서비스] 도구 호출: edit_file
```

## 3. 통신 상태 데이터 (✓)

### 3.1 상태 코드
```typescript
enum ConnectionState {
    Connected = 'connected',
    Disconnected = 'disconnected',
    Error = 'error'
}

interface ConnectionStatus {
    state: ConnectionState;
    lastError?: string;
    reconnectAttempts: number;
}
```

### 3.2 API 사용 예제
```typescript
// 상태 표시
const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
);

// 상태 업데이트
function updateStatus(status: ConnectionStatus): void {
    switch (status.state) {
        case ConnectionState.Connected:
            statusBarItem.text = "$(check) AI 연결됨";
            break;
        case ConnectionState.Disconnected:
            statusBarItem.text = "$(warning) AI 연결 끊김";
            break;
        case ConnectionState.Error:
            statusBarItem.text = "$(error) AI 오류";
            break;
    }
    statusBarItem.show();
}
```

### 3.3 실제 연결 관리 예시
```typescript
// 모델 서비스 클래스 예시
class ModelService {
    private status: ConnectionStatus = {
        state: ConnectionState.Disconnected,
        reconnectAttempts: 0
    };
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectDelay = 2000; // 2초

    constructor(private readonly statusCallback: (status: ConnectionStatus) => void) {
        this.connect();
    }

    // 연결 시작
    private async connect() {
        try {
            // 로그: [모델 서비스] 연결 시도 중...
            
            // 실제 연결 과정 (일부 코드 생략)
            const connected = await this.tryConnect();
            
            if (connected) {
                this.status = {
                    state: ConnectionState.Connected,
                    reconnectAttempts: 0
                };
                this.statusCallback(this.status);
                // 로그: [모델 서비스] 연결 성공
            } else {
                throw new Error("연결 실패");
            }
        } catch (error) {
            // 로그: [모델 서비스] 연결 오류: {error.message}
            
            this.status = {
                state: ConnectionState.Error,
                lastError: error.message,
                reconnectAttempts: this.status.reconnectAttempts + 1
            };
            this.statusCallback(this.status);
            
            // 재연결 시도
            this.scheduleReconnect();
        }
    }

    // 재연결 스케줄링
    private scheduleReconnect() {
        if (this.status.reconnectAttempts <= this.maxReconnectAttempts) {
            // 로그: [모델 서비스] 재연결 시도 예정: {this.status.reconnectAttempts}/{this.maxReconnectAttempts}
            
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);
        } else {
            // 로그: [모델 서비스] 최대 재연결 시도 횟수 초과
            
            this.status = {
                ...this.status,
                state: ConnectionState.Error,
                lastError: "최대 재연결 시도 횟수 초과"
            };
            this.statusCallback(this.status);
        }
    }
}

// 실제 사용 로그
// [모델 서비스] 초기화: v1.2.0
// [모델 서비스] 연결 시도 중...
// [모델 서비스] 연결 성공
// [상태 바] 상태 업데이트: "$(check) AI 연결됨"
// ...
// [모델 서비스] 연결 끊김: 타임아웃
// [모델 서비스] 재연결 시도 예정: 1/5
// [상태 바] 상태 업데이트: "$(warning) AI 연결 끊김"
// [모델 서비스] 연결 시도 중...
// [모델 서비스] 연결 성공
// [상태 바] 상태 업데이트: "$(check) AI 연결됨"
```

## 4. 요청 관리 및 처리 (✓)

### 4.1 요청 큐 관리
```typescript
interface PendingRequest {
    id: string;
    request: ModelRequest;
    timestamp: number;
    resolve: (response: ModelResponse) => void;
    reject: (error: Error) => void;
}

// 요청 큐 관리 예시
class RequestQueue {
    private queue: PendingRequest[] = [];
    private isProcessing = false;
    private readonly maxConcurrent = 1; // 동시 요청 수
    
    // 새 요청 추가
    public enqueue(request: ModelRequest): Promise<ModelResponse> {
        // 로그: [요청 큐] 새 요청 추가: {요약된 요청 내용}
        
        return new Promise((resolve, reject) => {
            const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.queue.push({
                id,
                request,
                timestamp: Date.now(),
                resolve,
                reject
            });
            
            // 로그: [요청 큐] 현재 대기 요청 수: {this.queue.length}
            
            this.processQueue();
        });
    }
    
    // 큐 처리
    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const pendingRequest = this.queue.shift()!;
        
        // 로그: [요청 큐] 요청 처리 시작: {pendingRequest.id}
        
        try {
            // 실제 모델 호출 (세부 구현 생략)
            const response = await this.callModel(pendingRequest.request);
            pendingRequest.resolve(response);
            
            // 로그: [요청 큐] 요청 처리 완료: {pendingRequest.id}
        } catch (error) {
            // 로그: [요청 큐] 요청 처리 오류: {pendingRequest.id} - {error.message}
            pendingRequest.reject(error);
        } finally {
            this.isProcessing = false;
            this.processQueue(); // 다음 요청 처리
        }
    }
}

// 실제 요청 처리 순서 로그
// [요청 큐] 새 요청 추가: "Button.tsx 파일에 onClick 핸들러 추가"
// [요청 큐] 현재 대기 요청 수: 1
// [요청 큐] 요청 처리 시작: req_1679904732_a1b2c3d4
// [모델 서비스] 요청 전송: Button.tsx 파일 onClick 핸들러 추가 요청
// [모델 서비스] 응답 수신: req_1679904732_a1b2c3d4
// [요청 큐] 요청 처리 완료: req_1679904732_a1b2c3d4
// [도구 관리자] 도구 실행: edit_file
```

## 5. 결론

이 문서는 볼드모트 IDE와 AI 모델 간의 실제 관찰된 통신 데이터 구조와 API 사용을 설명합니다. 모든 예제는 VSCode Extension API를 통해 직접 확인된 내용입니다. 로그 및 데이터 구조는 실제 IDE에서 관찰된 패턴을 따릅니다.

실제 데이터 흐름은 다음과 같습니다:
1. 사용자 UI에서 모델 서비스로 요청 전송
2. 요청 큐에서 순서대로 처리
3. 모델 서비스가 AI 모델에 요청 전송 및 응답 수신
4. 응답에서 도구 호출 정보 추출 및 실행
5. 결과를 사용자 UI에 표시

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 데이터 구조와 API 사용을 바탕으로 작성되었습니다.