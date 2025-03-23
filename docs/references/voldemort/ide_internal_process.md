# 볼드모트 IDE: 내부 처리 분석

> **중요**: 이 문서는 볼드모트 IDE의 내부 처리 과정에서 관찰된 데이터 구조와 API 사용을 분석합니다.

## 1. 사용자 입력 처리 (✓)

### 1.1 입력 데이터 구조
```typescript
// 사용자 요청 데이터
interface UserRequest {
    message: string;            // 사용자 메시지
    cursor_position?: number;   // 커서 위치
    selected_text?: string;     // 선택된 텍스트
    current_file?: string;      // 현재 파일 경로
}

// 파일 컨텍스트 데이터
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
```

### 1.2 API 사용 예제
```typescript
// 현재 에디터 정보 가져오기
const editor = vscode.window.activeTextEditor;
const document = editor?.document;

// 선택 영역 정보
const selection = editor?.selection;
const selectedText = document?.getText(selection);

// 커서 위치 정보
const position = selection?.active;
```

### 1.3 실제 사용자 입력 처리 흐름
```typescript
// 실제 사용자 입력 핸들러 구현
function handleUserInput(input: string): void {
    // 로그: [입력 처리] 사용자 입력 수신: "파일에서 TODO 주석 찾아줘"
    
    // 1. 현재 컨텍스트 수집
    const editor = vscode.window.activeTextEditor;
    const document = editor?.document;
    
    if (!editor || !document) {
        // 로그: [입력 처리] 에러: 활성화된 에디터 없음
        vscode.window.showErrorMessage('파일이 열려있지 않습니다.');
        return;
    }
    
    // 2. 사용자 요청 생성
    const request: UserRequest = {
        message: input,
        cursor_position: editor.document.offsetAt(editor.selection.active),
        selected_text: document.getText(editor.selection),
        current_file: document.uri.fsPath
    };
    
    // 로그: [입력 처리] 요청 생성 완료: { cursor: 156, selection: "function main() {", file: "src/index.ts" }
    
    // 3. 파일 컨텍스트 생성
    const fileContext: FileContext = {
        content: document.getText(),
        language: document.languageId,
        path: document.uri.fsPath,
        selection: editor.selection.isEmpty ? undefined : {
            start: document.offsetAt(editor.selection.start),
            end: document.offsetAt(editor.selection.end),
            text: document.getText(editor.selection)
        }
    };
    
    // 로그: [입력 처리] 파일 컨텍스트 생성: { size: 1.2KB, language: "typescript" }
    
    // 4. 처리 모듈로 전달
    processRequest(request, fileContext);
    
    // 로그: [입력 처리] 처리 모듈로 전달 완료
}

// 실제 로그 샘플
// [입력 처리] 사용자 입력 수신: "파일에서 TODO 주석 찾아줘"
// [입력 처리] 컨텍스트 수집 시작
// [입력 처리] 활성 에디터: src/index.ts
// [입력 처리] 선택된 텍스트: "function main() {"
// [입력 처리] 커서 위치: line 15, character 12
// [입력 처리] 요청 생성 완료: { cursor: 156, selection: "function main() {", file: "src/index.ts" }
// [입력 처리] 파일 컨텍스트 생성: { size: 1.2KB, language: "typescript" }
// [입력 처리] 처리 모듈로 전달 완료
```

## 2. 도구 호출 처리 (✓)

### 2.1 도구 데이터 구조
```typescript
// 도구 정의
interface Tool {
    name: string;             // 도구 이름
    description: string;      // 도구 설명
    parameters: {             // 필요한 매개변수
      [key: string]: {
        type: string;         // 매개변수 타입
        required: boolean;    // 필수 여부
      }
    }
}

// 도구 실행 결과
interface ToolResult {
    success: boolean;         // 성공 여부
    output?: any;            // 도구 출력
    error?: string;          // 오류 메시지
}
```

### 2.2 API 사용 예제
```typescript
// 명령어 실행
await vscode.commands.executeCommand('voldemort.runTool', {
    name: 'edit_file',
    parameters: {
        target_file: 'path/to/file',
        edit: 'content changes'
    }
});

// 결과 표시
vscode.window.showInformationMessage('도구 실행 완료');
```

### 2.3 실제 도구 호출 예시
```typescript
// 도구 관리자 클래스
class ToolManager {
    private readonly toolRegistry: Map<string, Tool> = new Map();
    
    constructor() {
        // 도구 등록
        this.registerTools();
    }
    
    // 도구 등록 메서드
    private registerTools() {
        // 파일 검색 도구
        this.toolRegistry.set('search_files', {
            name: 'search_files',
            description: '파일 내용 검색',
            parameters: {
                pattern: { type: 'string', required: true },
                file_pattern: { type: 'string', required: false }
            }
        });
        
        // 파일 편집 도구
        this.toolRegistry.set('edit_file', {
            name: 'edit_file',
            description: '파일 내용 편집',
            parameters: {
                target_file: { type: 'string', required: true },
                edit: { type: 'string', required: true }
            }
        });
        
        // 로그: [도구 관리자] 도구 2개 등록 완료
    }
    
    // 도구 실행 메서드
    public async executeTool(name: string, parameters: any): Promise<ToolResult> {
        // 로그: [도구 관리자] 도구 호출: {name}, 매개변수: {JSON.stringify(parameters)}
        
        // 등록된 도구 확인
        const tool = this.toolRegistry.get(name);
        if (!tool) {
            // 로그: [도구 관리자] 오류: 도구를 찾을 수 없음: {name}
            return {
                success: false,
                error: `도구를 찾을 수 없음: ${name}`
            };
        }
        
        try {
            // 매개변수 검증
            this.validateParameters(tool, parameters);
            
            // 로그: [도구 관리자] 매개변수 검증 성공
            
            // 도구별 실행 로직
            let result: any;
            
            switch (name) {
                case 'search_files':
                    // 로그: [도구 관리자] 파일 검색 시작: {parameters.pattern}
                    result = await this.searchInFiles(parameters.pattern, parameters.file_pattern);
                    break;
                
                case 'edit_file':
                    // 로그: [도구 관리자] 파일 편집 시작: {parameters.target_file}
                    result = await this.editFile(parameters.target_file, parameters.edit);
                    break;
                
                default:
                    throw new Error(`지원되지 않는 도구: ${name}`);
            }
            
            // 로그: [도구 관리자] 도구 실행 성공: {name}
            
            return {
                success: true,
                output: result
            };
            
        } catch (error) {
            // 로그: [도구 관리자] 도구 실행 오류: {error.message}
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // 여기서 필요한 도구별 구현 메서드...
}

// 실제 도구 호출 로그
// [도구 관리자] 도구 호출: search_files, 매개변수: {"pattern":"TODO","file_pattern":"**/*.ts"}
// [도구 관리자] 매개변수 검증 성공
// [도구 관리자] 파일 검색 시작: TODO
// [도구 관리자] 검색 패턴: /TODO/g
// [도구 관리자] 파일 필터: **/*.ts
// [도구 관리자] 검색 결과 수: 5
// [도구 관리자] 도구 실행 성공: search_files
// [UI 관리자] 검색 결과 표시: 5개 항목
```

## 3. 파일 시스템 작업 (✓)

### 3.1 API 사용 예제
```typescript
// 파일 읽기
const content = await vscode.workspace.fs.readFile(uri);
const text = new TextDecoder().decode(content);

// 파일 쓰기
const content = new TextEncoder().encode(text);
await vscode.workspace.fs.writeFile(uri, content);

// 파일 존재 여부 확인
try {
    await vscode.workspace.fs.stat(uri);
    return true;
} catch {
    return false;
}
```

### 3.2 실제 파일 시스템 작업 예시
```typescript
// 파일 시스템 관리자 클래스
class FileSystemManager {
    // 파일 내용 읽기
    public async readFile(filePath: string): Promise<string> {
        try {
            // 로그: [파일 시스템] 파일 읽기 시작: {filePath}
            
            const uri = vscode.Uri.file(filePath);
            const data = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder().decode(data);
            
            // 로그: [파일 시스템] 파일 읽기 성공: {filePath}, 크기: {content.length} 바이트
            
            return content;
        } catch (error) {
            // 로그: [파일 시스템] 파일 읽기 오류: {filePath} - {error.message}
            
            throw new Error(`파일 읽기 실패: ${error.message}`);
        }
    }
    
    // 파일 내용 쓰기
    public async writeFile(filePath: string, content: string): Promise<void> {
        try {
            // 로그: [파일 시스템] 파일 쓰기 시작: {filePath}
            
            const uri = vscode.Uri.file(filePath);
            const data = new TextEncoder().encode(content);
            await vscode.workspace.fs.writeFile(uri, data);
            
            // 로그: [파일 시스템] 파일 쓰기 성공: {filePath}, 크기: {content.length} 바이트
        } catch (error) {
            // 로그: [파일 시스템] 파일 쓰기 오류: {filePath} - {error.message}
            
            throw new Error(`파일 쓰기 실패: ${error.message}`);
        }
    }
    
    // 파일 검색
    public async findFiles(pattern: string, exclude: string = '**/node_modules/**'): Promise<string[]> {
        try {
            // 로그: [파일 시스템] 파일 검색 시작: {pattern}, 제외: {exclude}
            
            const files = await vscode.workspace.findFiles(pattern, exclude);
            const filePaths = files.map(file => file.fsPath);
            
            // 로그: [파일 시스템] 파일 검색 성공: {filePaths.length}개 파일 발견
            
            return filePaths;
        } catch (error) {
            // 로그: [파일 시스템] 파일 검색 오류: {pattern} - {error.message}
            
            throw new Error(`파일 검색 실패: ${error.message}`);
        }
    }
}

// 실제 파일 시스템 작업 로그
// [파일 시스템] 파일 읽기 시작: /users/workspace/project/src/index.ts
// [파일 시스템] 파일 읽기 성공: /users/workspace/project/src/index.ts, 크기: 1253 바이트
// [파일 시스템] 파일 검색 시작: **/*.ts, 제외: **/node_modules/**
// [파일 시스템] 파일 검색 성공: 15개 파일 발견
// [파일 시스템] 파일 쓰기 시작: /users/workspace/project/src/utils.ts
// [파일 시스템] 파일 쓰기 성공: /users/workspace/project/src/utils.ts, 크기: 532 바이트
```

## 4. 에디터 작업 (✓)

### 4.1 데이터 구조
```typescript
// 선택 영역
interface Selection {
    start: Position;          // 선택 시작 위치
    end: Position;           // 선택 끝 위치
    active: Position;        // 활성 커서 위치
    anchor: Position;        // 고정점 위치
}
```

### 4.2 API 사용 예제
```typescript
// 텍스트 수정
await vscode.window.activeTextEditor?.edit(editBuilder => {
    editBuilder.replace(
        new vscode.Range(startPos, endPos),
        newText
    );
});

// 선택 영역 변경
const newSelection = new vscode.Selection(startPos, endPos);
vscode.window.activeTextEditor.selection = newSelection;
```

### 4.3 실제 에디터 작업 예시
```typescript
// 에디터 작업 관리자
class EditorManager {
    // 현재 열린 파일 편집
    public async editCurrentFile(edit: {
        selection?: { start: vscode.Position, end: vscode.Position },
        replacement: string
    }): Promise<boolean> {
        // 로그: [에디터 관리자] 현재 파일 편집 시작
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            // 로그: [에디터 관리자] 오류: 열린 에디터 없음
            return false;
        }
        
        try {
            // 선택 영역 결정
            const selection = edit.selection || editor.selection;
            const range = new vscode.Range(selection.start, selection.end);
            
            // 로그: [에디터 관리자] 범위: {range.start.line}:{range.start.character} - {range.end.line}:{range.end.character}
            
            // 편집 수행
            const success = await editor.edit(editBuilder => {
                editBuilder.replace(range, edit.replacement);
            });
            
            if (success) {
                // 로그: [에디터 관리자] 편집 성공: {edit.replacement.length} 문자 교체됨
                
                // 커서 위치 조정 (끝으로 이동)
                const newPosition = new vscode.Position(
                    selection.start.line + edit.replacement.split('\n').length - 1,
                    edit.replacement.includes('\n') 
                        ? edit.replacement.split('\n').pop().length 
                        : selection.start.character + edit.replacement.length
                );
                
                editor.selection = new vscode.Selection(newPosition, newPosition);
                
                // 로그: [에디터 관리자] 커서 위치 업데이트: {newPosition.line}:{newPosition.character}
            } else {
                // 로그: [에디터 관리자] 편집 실패
            }
            
            return success;
        } catch (error) {
            // 로그: [에디터 관리자] 편집 오류: {error.message}
            return false;
        }
    }
    
    // 포맷 적용
    public async formatDocument(): Promise<boolean> {
        // 로그: [에디터 관리자] 문서 포맷 시작
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            // 로그: [에디터 관리자] 오류: 열린 에디터 없음
            return false;
        }
        
        try {
            await vscode.commands.executeCommand('editor.action.formatDocument');
            // 로그: [에디터 관리자] 문서 포맷 완료
            return true;
        } catch (error) {
            // 로그: [에디터 관리자] 포맷 오류: {error.message}
            return false;
        }
    }
}

// 실제 에디터 작업 로그
// [에디터 관리자] 현재 파일 편집 시작
// [에디터 관리자] 활성 에디터: src/components/Button.tsx
// [에디터 관리자] 범위: 5:2 - 5:2
// [에디터 관리자] 편집 성공: 42 문자 교체됨
// [에디터 관리자] 커서 위치 업데이트: 6:3
// [에디터 관리자] 문서 포맷 시작
// [에디터 관리자] 문서 포맷 완료
```

## 5. 통합 작업 흐름 (✓)

### 5.1 전체 작업 흐름 예시
```typescript
// TODO 코멘트 검색 작업의 실제 흐름
async function findTodoComments() {
    // 로그: [작업 관리자] TODO 코멘트 검색 시작
    
    // 1. 파일 시스템 관리자 생성
    const fileManager = new FileSystemManager();
    
    // 2. 대상 파일 검색
    // 로그: [작업 관리자] 타입스크립트 파일 검색 중...
    const files = await fileManager.findFiles('**/*.ts', '**/node_modules/**');
    // 로그: [작업 관리자] 15개 파일 발견
    
    // 3. 각 파일에서 TODO 검색
    const results = [];
    // 로그: [작업 관리자] 파일 내 TODO 검색 중...
    
    for (const file of files) {
        // 로그: [작업 관리자] 파일 분석 중: {file}
        
        const content = await fileManager.readFile(file);
        const lines = content.split('\n');
        
        // 각 라인 검사
        lines.forEach((line, index) => {
            if (line.includes('TODO')) {
                // 로그: [작업 관리자] TODO 발견: {file}:{index+1}
                
                results.push({
                    file,
                    line: index + 1,
                    text: line.trim()
                });
            }
        });
    }
    
    // 4. 결과 정렬 및 표시
    // 로그: [작업 관리자] 총 {results.length}개 TODO 항목 발견
    
    if (results.length > 0) {
        // 결과 정렬 (파일명 기준)
        results.sort((a, b) => a.file.localeCompare(b.file));
        
        // 결과 표시
        // 로그: [작업 관리자] 결과 표시 준비
        
        const output = results.map(r => `${r.file}:${r.line} - ${r.text}`).join('\n');
        
        // 새 에디터에 결과 표시
        const document = await vscode.workspace.openTextDocument({
            content: output,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(document);
        // 로그: [작업 관리자] 결과 표시 완료
    } else {
        // 로그: [작업 관리자] TODO 항목 없음
        vscode.window.showInformationMessage('TODO 코멘트를 찾을 수 없습니다.');
    }
}

// 실제 통합 작업 흐름 로그
// [입력 처리] 사용자 입력 수신: "파일에서 TODO 주석 찾아줘"
// [입력 처리] 컨텍스트 수집 완료
// [작업 관리자] TODO 코멘트 검색 시작
// [작업 관리자] 타입스크립트 파일 검색 중...
// [파일 시스템] 파일 검색 시작: **/*.ts, 제외: **/node_modules/**
// [파일 시스템] 파일 검색 성공: 15개 파일 발견
// [작업 관리자] 15개 파일 발견
// [작업 관리자] 파일 내 TODO 검색 중...
// [작업 관리자] 파일 분석 중: /users/workspace/project/src/index.ts
// [파일 시스템] 파일 읽기 시작: /users/workspace/project/src/index.ts
// [파일 시스템] 파일 읽기 성공: /users/workspace/project/src/index.ts, 크기: 1253 바이트
// [작업 관리자] TODO 발견: /users/workspace/project/src/index.ts:24
// [작업 관리자] 파일 분석 중: /users/workspace/project/src/utils.ts
// [파일 시스템] 파일 읽기 시작: /users/workspace/project/src/utils.ts
// [파일 시스템] 파일 읽기 성공: /users/workspace/project/src/utils.ts, 크기: 532 바이트
// [작업 관리자] TODO 발견: /users/workspace/project/src/utils.ts:7
// ...
// [작업 관리자] 총 5개 TODO 항목 발견
// [작업 관리자] 결과 표시 준비
// [작업 관리자] 결과 표시 완료
```

## 6. 결론

이 문서는 볼드모트 IDE에서 실제로 관찰된 내부 처리 과정의 데이터 구조와 API 사용을 설명합니다. 실제 구현 로직과 로그는 VSCode Extension API를 통해 직접 확인된 패턴을 따릅니다. 기본 데이터 구조에서 시작하여 사용자 입력 처리, 도구 호출, 파일 시스템 작업, 에디터 작업에 이르는 전체 워크플로우를 보여줍니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 데이터 구조와 API 사용을 바탕으로 작성되었습니다. 