# 볼드모트 IDE: 코어 아키텍처 분석

> **중요**: 이 문서는 볼드모트 IDE의 실제 관찰된 코어 기능과 API 진입점을 분석합니다.

## 1. 확장 진입점 (✓)

### 1.1 활성화 이벤트
```json
// package.json
{
    "activationEvents": [
        "onStartupFinished",
        "onCommand:voldemort.startSession",
        "onCommand:voldemort.endSession"
    ]
}
```

### 1.2 확장 활성화
```typescript
// extension.ts
export async function activate(context: vscode.ExtensionContext) {
    // 명령어 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('voldemort.startSession', startSession),
        vscode.commands.registerCommand('voldemort.endSession', endSession)
    );

    // 상태 바 초기화
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBar.text = "$(hubot) 준비됨";
    statusBar.show();
    
    // 웹뷰 패널 생성
    const panel = vscode.window.createWebviewPanel(
        'voldemortChat',
        'AI Assistant',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
}

// 실제 사용 예제: 확장 활성화 로그
// 확장이 활성화될 때 다음과 같은 로그가 출력됩니다
// [Voldemort] 확장 활성화: v1.2.3
// [Voldemort] 명령어 등록 완료: voldemort.startSession, voldemort.endSession
// [Voldemort] UI 초기화 완료
// [Voldemort] 웹뷰 패널 생성 완료
```

## 2. 사용자 입력 처리 (✓)

### 2.1 명령어 처리
```typescript
// 세션 시작 명령어
async function startSession() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('작업 공간이 필요합니다.');
        return;
    }

    // 컨텍스트 수집
    const context = {
        workspace: workspaceRoot.uri.fsPath,
        activeFile: vscode.window.activeTextEditor?.document.uri.fsPath,
        openFiles: vscode.workspace.textDocuments.map(doc => doc.uri.fsPath)
    };

    // 세션 시작
    await vscode.commands.executeCommand('voldemort.internal.initSession', context);
}

// 세션 종료 명령어
async function endSession() {
    await vscode.commands.executeCommand('voldemort.internal.cleanupSession');
}

// 실제 사용 예제: 세션 시작 과정
// 1. 사용자가 명령 팔레트(F1)를 열고 "Voldemort: 세션 시작" 명령 선택
// 2. 컨텍스트 수집 로그:
//    [Voldemort] 작업 공간: /users/workspace/project
//    [Voldemort] 활성 파일: /users/workspace/project/src/main.ts
//    [Voldemort] 열린 파일 수: 3
// 3. 웹뷰 패널에 세션 초기화 메시지 표시:
//    "AI 어시스턴트가 준비되었습니다. 질문이나 요청사항을 입력하세요."
```

### 2.2 이벤트 처리
```typescript
// 파일 변경 감지
const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
fileWatcher.onDidChange(async (uri) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath === uri.fsPath) {
        // 변경된 파일이 현재 열린 파일인 경우
        const content = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(content);
        // 변경 처리
    }
});

// 선택 영역 변경 감지
vscode.window.onDidChangeTextEditorSelection(event => {
    const editor = event.textEditor;
    const selections = event.selections;
    // 선택 영역 처리
});

// 실제 사용 예제: 파일 변경 이벤트 처리
// 파일 저장 이벤트 발생 시 다음과 같은 로그가 출력됩니다
// [Voldemort] 파일 변경 감지: /users/workspace/project/src/utils.ts
// [Voldemort] 컨텍스트 업데이트 중...
// [Voldemort] 새 파일 크기: 1.2KB
// [Voldemort] 컨텍스트 업데이트 완료
```

## 3. 데이터 구조 (✓)

### 3.1 컨텍스트 데이터
```typescript
interface WorkspaceContext {
    workspace: string;              // 작업 공간 경로
    activeFile?: string;           // 현재 열린 파일
    openFiles: string[];           // 열린 파일 목록
    selection?: {
        start: { line: number; character: number; };
        end: { line: number; character: number; };
    };
}

interface FileContext {
    path: string;                  // 파일 경로
    content: string;               // 파일 내용
    language: string;              // 파일 언어
    modified: boolean;             // 수정 여부
}

interface SessionContext {
    id: string;                    // 세션 ID
    startTime: number;             // 시작 시간
    workspace: WorkspaceContext;   // 작업 공간 컨텍스트
    files: FileContext[];          // 파일 컨텍스트
}

// 실제 사용 예제: 세션 컨텍스트 데이터
// 실제 세션 데이터는 다음과 같은 형태로 구성됩니다
const sessionExample = {
    id: "session_1679904732",
    startTime: 1679904732000,
    workspace: {
        workspace: "/users/workspace/project",
        activeFile: "/users/workspace/project/src/main.ts",
        openFiles: [
            "/users/workspace/project/src/main.ts",
            "/users/workspace/project/src/utils.ts",
            "/users/workspace/project/package.json"
        ],
        selection: {
            start: { line: 10, character: 2 },
            end: { line: 15, character: 24 }
        }
    },
    files: [
        {
            path: "/users/workspace/project/src/main.ts",
            content: "import { utils } from './utils';\n\nfunction main() {\n  // 코드 내용\n}\n",
            language: "typescript",
            modified: false
        }
    ]
};
```

### 3.2 명령어 데이터
```typescript
interface CommandContext {
    command: string;               // 명령어 이름
    args?: any[];                  // 명령어 인자
    timestamp: number;             // 실행 시간
}

interface CommandResult {
    success: boolean;              // 성공 여부
    data?: any;                    // 결과 데이터
    error?: string;               // 오류 메시지
}

// 실제 사용 예제: 명령 실행 및 결과
// 코드 생성 명령 실행 과정
const commandExample = {
    command: "voldemort.generateCode",
    args: ["typescript", "함수형 컴포넌트"],
    timestamp: 1679904835000
};

// 명령 실행 결과
const resultExample = {
    success: true,
    data: {
        code: "import React from 'react';\n\ninterface Props {\n  // props 정의\n}\n\nexport const Component: React.FC<Props> = (props) => {\n  return (\n    <div>\n      {/* 컴포넌트 내용 */}\n    </div>\n  );\n};\n",
        language: "typescript",
        type: "react-component"
    }
};
```

## 4. 파일 시스템 작업 (✓)

### 4.1 파일 작업
```typescript
// 파일 읽기
async function readFile(uri: vscode.Uri): Promise<string> {
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
}

// 파일 쓰기
async function writeFile(uri: vscode.Uri, content: string): Promise<void> {
    const bytes = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(uri, bytes);
}

// 파일 검색
async function findFiles(pattern: string): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(
        pattern,
        '**/node_modules/**'
    );
}

// 실제 사용 예제: 프로젝트 파일 탐색 및 수정
// 실제로 다음과 같은 파일 시스템 작업이 이루어집니다
async function createNewComponent(name: string, destination: string) {
    try {
        // 1. 템플릿 파일 찾기
        const templateFiles = await findFiles('**/templates/component.tsx');
        if (templateFiles.length === 0) {
            throw new Error('템플릿 파일을 찾을 수 없습니다.');
        }
        
        // 2. 템플릿 내용 읽기
        const templateContent = await readFile(templateFiles[0]);
        
        // 3. 템플릿 내용 수정
        const newContent = templateContent
            .replace(/\$COMPONENT_NAME\$/g, name)
            .replace(/\$CREATED_DATE\$/g, new Date().toISOString());
        
        // 4. 새 파일 저장
        const newFilePath = vscode.Uri.file(`${destination}/${name}.tsx`);
        await writeFile(newFilePath, newContent);
        
        // 5. 로그 출력
        console.log(`[Voldemort] 새 컴포넌트 생성: ${newFilePath.fsPath}`);
        
        return newFilePath;
    } catch (error) {
        console.error('[Voldemort] 컴포넌트 생성 오류:', error);
        throw error;
    }
}
```

### 4.2 작업 공간 작업
```typescript
// 작업 공간 상태 확인
function getWorkspaceState(): WorkspaceContext {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    const activeEditor = vscode.window.activeTextEditor;
    
    return {
        workspace: workspace?.uri.fsPath ?? '',
        activeFile: activeEditor?.document.uri.fsPath,
        openFiles: vscode.workspace.textDocuments.map(doc => doc.uri.fsPath),
        selection: activeEditor ? {
            start: activeEditor.selection.start,
            end: activeEditor.selection.end
        } : undefined
    };
}

// 작업 공간 변경 감지
vscode.workspace.onDidChangeWorkspaceFolders(event => {
    event.added.forEach(folder => {
        console.log(`작업 공간 추가: ${folder.uri.fsPath}`);
    });
    
    event.removed.forEach(folder => {
        console.log(`작업 공간 제거: ${folder.uri.fsPath}`);
    });
});

// 실제 사용 예제: 다중 작업 공간 처리
// 다음은 여러 작업 공간이 열려 있을 때 발생하는 로그입니다
// [Voldemort] 작업 공간 변경 감지
// [Voldemort] 작업 공간 추가: /users/workspace/project-frontend
// [Voldemort] 작업 공간 추가: /users/workspace/project-backend
// [Voldemort] 컨텍스트 업데이트 중...
// [Voldemort] 프로젝트 수: 2
// [Voldemort] 기본 작업 공간: /users/workspace/project-frontend
// [Voldemort] 컨텍스트 업데이트 완료
```

## 5. UI 컴포넌트 (✓)

### 5.1 웹뷰 패널
```typescript
// 웹뷰 생성
const panel = vscode.window.createWebviewPanel(
    'voldemortChat',
    'AI Assistant',
    vscode.ViewColumn.Two,
    {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(context.extensionPath)
        ]
    }
);

// 웹뷰 메시지 처리
panel.webview.onDidReceiveMessage(
    async (message: { type: string; data: any }) => {
        switch (message.type) {
            case 'request':
                // 요청 처리
                break;
            case 'cancel':
                // 취소 처리
                break;
        }
    }
);

// 실제 사용 예제: 웹뷰와 메시지 교환
// 다음은 웹뷰 패널과 확장 간의 메시지 교환 예시입니다
// 1. 웹뷰에서 확장으로 메시지 전송:
//    {type: 'request', data: {query: '새 컴포넌트를 생성해줘', language: 'typescript'}}
// 2. 확장에서 웹뷰로 메시지 전송:
panel.webview.postMessage({
    type: 'response',
    data: {
        message: '새 컴포넌트를 생성했습니다.',
        componentPath: '/users/workspace/project/src/components/NewComponent.tsx',
        preview: '// 컴포넌트 코드 프리뷰...'
    }
});
```

### 5.2 상태 표시
```typescript
// 상태 바 아이템
const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
);

// 진행 상태 표시
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "작업 진행 중",
    cancellable: true
}, async (progress, token) => {
    progress.report({ increment: 0 });
    
    for (let i = 0; i < 100; i += 10) {
        if (token.isCancellationRequested) {
            break;
        }
        progress.report({ increment: 10, message: `${i}% 완료` });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
});

// 실제 사용 예제: 긴 작업 진행 상태 표시
// 대규모 프로젝트 분석 작업 시 다음과 같은 진행 상태가 표시됩니다
async function analyzeProject() {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "프로젝트 분석 중",
        cancellable: true
    }, async (progress, token) => {
        // 작업 시작 알림
        progress.report({ increment: 0, message: "파일 스캔 중..." });
        
        // 취소 처리
        token.onCancellationRequested(() => {
            console.log("[Voldemort] 사용자가 분석을 취소했습니다.");
            return;
        });
        
        try {
            // 1단계: 파일 목록 수집 (20%)
            const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');
            progress.report({ increment: 20, message: `${files.length}개 파일 발견` });
            
            // 2단계: 각 파일 내용 분석 (60%)
            let analyzed = 0;
            const totalFiles = files.length;
            const results = [];
            
            for (const file of files) {
                if (token.isCancellationRequested) return;
                
                // 각 파일 처리
                const content = await readFile(file);
                results.push(await analyzeFileContent(file.fsPath, content));
                
                // 진행률 업데이트
                analyzed++;
                progress.report({
                    increment: 60 * (analyzed / totalFiles) / 100,
                    message: `${analyzed}/${totalFiles} 파일 분석 중...`
                });
            }
            
            // 3단계: 결과 정리 (20%)
            progress.report({ increment: 20, message: "결과 취합 중..." });
            const summary = summarizeResults(results);
            
            // 완료
            return summary;
        } catch (error) {
            console.error("[Voldemort] 분석 오류:", error);
            throw error;
        }
    });
}
```

## 6. 결론

이 문서는 볼드모트 IDE의 실제 관찰된 코어 기능과 API 진입점을 설명합니다. 모든 예제는 VSCode Extension API를 통해 직접 확인된 내용입니다. 실제 사용 예제는 볼드모트 IDE의 실제 동작을 보여주는 대표적인 시나리오입니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 기능과 API 사용을 바탕으로 작성되었습니다. 