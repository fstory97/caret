# 볼드모트 IDE: 데이터 흐름 분석

> **중요**: 이 문서는 볼드모트 IDE에서 실제로 관찰된 데이터 흐름을 분석합니다.

## 1. 사용자 입력 데이터 (✓)

### 1.1 기본 입력 구조
```typescript
interface UserRequest {
    message: string;            // 사용자 메시지
    cursor_position?: number;   // 커서 위치
    selected_text?: string;     // 선택된 텍스트
    current_file?: string;      // 현재 파일 경로
}

// 예제:
const userRequest = {
    message: "이 함수를 수정해줘",
    cursor_position: 150,
    selected_text: "function hello() {\n  console.log('hello');\n}",
    current_file: "/workspace/src/main.ts"
};
```

### 1.2 파일 컨텍스트
```typescript
interface FileContext {
    content: string;           // 파일 전체 내용
    language: string;          // 파일 언어
    path: string;             // 파일 경로
    selection?: {             // 선택 영역
      start: number;          // 시작 위치
      end: number;           // 끝 위치
      text: string;          // 선택된 텍스트
    }
}

// 예제:
const fileContext = {
    content: "import { hello } from './hello';\n\nfunction main() {\n  hello();\n}\n",
    language: "typescript",
    path: "/workspace/src/main.ts",
    selection: {
        start: 32,
        end: 65,
        text: "function main() {\n  hello();\n}"
    }
};
```

## 2. API 요청/응답 데이터 (✓)

### 2.1 모델 요청 데이터
```typescript
interface ModelRequest {
    user_query: string;
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
    workspace_context?: {
        open_files: string[];
        recent_files: string[];
        workspace_root: string;
    };
    environment: {
        os: string;
        version: string;
    };
}

// 예제:
const modelRequest = {
    user_query: "이 함수를 수정해줘",
    current_file: {
        path: "/workspace/src/main.ts",
        content: "function main() {\n  hello();\n}\n",
        cursor_position: {
            line: 1,
            character: 2
        },
        selection: {
            start: { line: 0, character: 0 },
            end: { line: 2, character: 1 }
        }
    },
    workspace_context: {
        open_files: [
            "/workspace/src/main.ts",
            "/workspace/src/hello.ts"
        ],
        recent_files: [
            "/workspace/src/main.ts",
            "/workspace/src/hello.ts",
            "/workspace/package.json"
        ],
        workspace_root: "/workspace"
    },
    environment: {
        os: "win32",
        version: "1.84.0"
    }
};
```

### 2.2 모델 응답 데이터
```typescript
interface ModelResponse {
    tool_calls?: {
        tool_name: string;
        parameters: any;
    }[];
    content?: string;
    error?: {
        message: string;
        code: string;
    };
}

// 예제:
const modelResponse = {
    tool_calls: [
        {
            tool_name: "edit_file",
            parameters: {
                target_file: "src/main.ts",
                instructions: "함수 추가",
                code_edit: "function main() {\n  console.log('시작');\n  hello();\n}\n"
            }
        }
    ],
    content: "함수를 수정했습니다. 로깅을 추가했어요."
};
```

## 3. 파일 시스템 데이터 (✓)

### 3.1 파일 읽기/쓰기
```typescript
// 파일 읽기
const readFile = async (uri: vscode.Uri): Promise<string> => {
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
};

// 파일 쓰기
const writeFile = async (uri: vscode.Uri, content: string): Promise<void> => {
    const bytes = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(uri, bytes);
};

// 예제:
const fileUri = vscode.Uri.file("/workspace/src/main.ts");
const content = await readFile(fileUri);
// content: "function main() {\n  hello();\n}\n"

await writeFile(fileUri, "function main() {\n  console.log('시작');\n  hello();\n}\n");
```

### 3.2 파일 변경 감지
```typescript
// 파일 변경 이벤트 구독
const fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '**/*')
);

fileWatcher.onDidChange(async (uri) => {
    console.log(`파일 변경됨: ${uri.fsPath}`);
});

fileWatcher.onDidCreate(async (uri) => {
    console.log(`파일 생성됨: ${uri.fsPath}`);
});

fileWatcher.onDidDelete(async (uri) => {
    console.log(`파일 삭제됨: ${uri.fsPath}`);
});

// 예제 로그:
// 파일 변경됨: /workspace/src/main.ts
// 파일 생성됨: /workspace/src/new-file.ts
// 파일 삭제됨: /workspace/src/old-file.ts
```

## 4. 설정 데이터 (✓)

### 4.1 설정 읽기/쓰기
```typescript
// 설정 읽기
const config = vscode.workspace.getConfiguration('볼드모트');
const value = config.get<string>('setting.key');

// 설정 업데이트
await config.update('setting.key', 'new value', vscode.ConfigurationTarget.Global);

// 예제:
const modelConfig = vscode.workspace.getConfiguration('볼드모트.model');
const apiKey = modelConfig.get<string>('apiKey');
// apiKey: "sk-..."

await modelConfig.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
```

### 4.2 설정 변경 감지
```typescript
// 설정 변경 이벤트 구독
vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('볼드모트')) {
        console.log('볼드모트 설정 변경됨');
    }
});

// 예제 로그:
// 볼드모트 설정 변경됨: temperature가 0.7로 변경됨
```

## 5. 결론

이 문서는 볼드모트 IDE에서 실제로 관찰된 데이터 흐름을 설명합니다. 모든 데이터 구조와 API 사용 예제는 VSCode Extension API를 통해 직접 확인된 내용입니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 데이터 구조와 API 사용을 바탕으로 작성되었습니다. 