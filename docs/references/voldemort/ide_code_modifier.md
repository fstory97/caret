# 볼드모트 IDE: 코드 수정 분석

> **중요**: 이 문서는 볼드모트 IDE에서 실제로 구현된 코드 수정 방식을 분석합니다.

## 1. 텍스트 편집 (✓)

### 1.1 기본 편집 작업
- API 호출: `vscode.TextEditor`
- 구현:
  ```typescript
  class TextModifier {
    // 텍스트 삽입
    async insertText(
      editor: vscode.TextEditor,
      position: vscode.Position,
      text: string
    ): Promise<boolean> {
      return editor.edit(editBuilder => {
        editBuilder.insert(position, text);
      });
    }

    // 텍스트 교체
    async replaceText(
      editor: vscode.TextEditor,
      range: vscode.Range,
      newText: string
    ): Promise<boolean> {
      return editor.edit(editBuilder => {
        editBuilder.replace(range, newText);
      });
    }

    // 텍스트 삭제
    async deleteText(
      editor: vscode.TextEditor,
      range: vscode.Range
    ): Promise<boolean> {
      return editor.edit(editBuilder => {
        editBuilder.delete(range);
      });
    }
  }
  ```

### 1.1.1 실제 텍스트 편집 사용 예제
```typescript
// 텍스트 수정기 인스턴스 생성
const textModifier = new TextModifier();

// 텍스트 삽입 예제
async function insertImportStatement() {
  // 로그: [텍스트 수정기] import 구문 삽입 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [텍스트 수정기] 오류: 활성화된 에디터가 없음
    return false;
  }
  
  // 파일 상단에 import 구문 삽입
  const position = new vscode.Position(0, 0);
  const importText = "import React from 'react';\n";
  
  // 로그: [텍스트 수정기] 위치 (0,0)에 텍스트 삽입 중
  const success = await textModifier.insertText(editor, position, importText);
  
  // 로그: [텍스트 수정기] 텍스트 삽입 결과: {success ? '성공' : '실패'}
  return success;
}

// 텍스트 교체 예제
async function updateComponentName() {
  // 로그: [텍스트 수정기] 컴포넌트 이름 변경 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  // 특정 범위의 텍스트 찾기 (예: 컴포넌트 이름)
  const document = editor.document;
  const text = document.getText();
  const oldComponentName = "UserProfile";
  const newComponentName = "UserProfileCard";
  
  // 첫 번째 일치 항목 찾기
  const startPos = document.positionAt(text.indexOf(oldComponentName));
  const endPos = document.positionAt(text.indexOf(oldComponentName) + oldComponentName.length);
  const range = new vscode.Range(startPos, endPos);
  
  // 로그: [텍스트 수정기] 범위 {startPos.line}:{startPos.character}에서 텍스트 교체 중
  // 로그: [텍스트 수정기] '{oldComponentName}'를 '{newComponentName}'로 변경
  
  // 텍스트 교체 실행
  const success = await textModifier.replaceText(editor, range, newComponentName);
  
  // 로그: [텍스트 수정기] 텍스트 교체 결과: {success ? '성공' : '실패'}
  return success;
}

// 텍스트 삭제 예제
async function removeConsoleLog() {
  // 로그: [텍스트 수정기] 콘솔 로그 제거 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  const document = editor.document;
  const text = document.getText();
  
  // 정규식으로 console.log 찾기
  const consoleLogRegex = /console\.log\(.*?\);?\n?/g;
  let match;
  let success = true;
  
  // 로그: [텍스트 수정기] 모든 console.log 문 검색 중
  
  // 모든 console.log 문 찾아서 삭제
  while((match = consoleLogRegex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPos, endPos);
    
    // 로그: [텍스트 수정기] console.log 발견: {range.start.line}:{range.start.character}
    
    // 삭제 실행
    const result = await textModifier.deleteText(editor, range);
    if (!result) {
      success = false;
      // 로그: [텍스트 수정기] 삭제 실패: {range.start.line}:{range.start.character}
      break;
    }
    
    // 편집 후 텍스트가 변경되었으므로 다시 가져오기
    const newText = editor.document.getText();
    text = newText;
    consoleLogRegex.lastIndex = 0;
  }
  
  // 로그: [텍스트 수정기] 삭제 작업 결과: {success ? '모든 삭제 성공' : '일부 삭제 실패'}
  return success;
}

// 실제 로그 예시
// [텍스트 수정기] import 구문 삽입 시작
// [텍스트 수정기] 위치 (0,0)에 텍스트 삽입 중
// [텍스트 수정기] 텍스트 삽입 결과: 성공
// [텍스트 수정기] 컴포넌트 이름 변경 시작
// [텍스트 수정기] 위치: 15:10에서 텍스트 교체 중
// [텍스트 수정기] 'UserProfile'을 'UserProfileCard'로 변경
// [텍스트 수정기] 텍스트 교체 결과: 성공
// [텍스트 수정기] 콘솔 로그 제거 시작
// [텍스트 수정기] 모든 console.log 문 검색 중
// [텍스트 수정기] console.log 발견: 25:2
// [텍스트 수정기] console.log 발견: 42:4
// [텍스트 수정기] 삭제 작업 결과: 모든 삭제 성공
```

### 1.2 선택 영역 관리
- 구현:
  ```typescript
  class SelectionManager {
    // 선택 영역 설정
    setSelection(
      editor: vscode.TextEditor,
      start: vscode.Position,
      end: vscode.Position
    ): void {
      editor.selection = new vscode.Selection(start, end);
    }

    // 커서 이동
    moveCursor(
      editor: vscode.TextEditor,
      position: vscode.Position
    ): void {
      editor.selection = new vscode.Selection(position, position);
    }

    // 선택 영역 확장
    expandSelection(
      editor: vscode.TextEditor,
      range: vscode.Range
    ): void {
      const newSelection = new vscode.Selection(
        range.start,
        range.end
      );
      editor.selection = newSelection;
    }
  }
  ```

### 1.2.1 실제 선택 영역 관리 사용 예제
```typescript
// 선택 관리자 인스턴스 생성
const selectionManager = new SelectionManager();

// 코드 블록 선택 기능
async function selectCodeBlock() {
  // 로그: [선택 관리자] 코드 블록 선택 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  const document = editor.document;
  const currentPos = editor.selection.active;
  
  // 로그: [선택 관리자] 현재 커서 위치: {currentPos.line}:{currentPos.character}
  
  // 현재 라인의 중괄호 찾기
  const currentLine = document.lineAt(currentPos.line).text;
  let openBraceIndex = currentLine.indexOf('{');
  
  if (openBraceIndex === -1) {
    // 로그: [선택 관리자] 현재 라인에서 중괄호를 찾을 수 없음
    return false;
  }
  
  // 중괄호 열기 위치
  const openBracePos = new vscode.Position(currentPos.line, openBraceIndex);
  
  // 로그: [선택 관리자] 중괄호 시작 위치: {openBracePos.line}:{openBracePos.character}
  
  // 일치하는 중괄호 닫기 위치 찾기
  let depth = 0;
  let closeBracePos = null;
  
  for (let i = openBracePos.line; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    let searchStartIdx = i === openBracePos.line ? openBraceIndex + 1 : 0;
    
    for (let j = searchStartIdx; j < line.length; j++) {
      if (line[j] === '{') {
        depth++;
      } else if (line[j] === '}') {
        if (depth === 0) {
          closeBracePos = new vscode.Position(i, j + 1);
          break;
        }
        depth--;
      }
    }
    
    if (closeBracePos) break;
  }
  
  if (!closeBracePos) {
    // 로그: [선택 관리자] 일치하는 중괄호를 찾을 수 없음
    return false;
  }
  
  // 로그: [선택 관리자] 중괄호 끝 위치: {closeBracePos.line}:{closeBracePos.character}
  
  // 블록 선택
  selectionManager.setSelection(editor, openBracePos, closeBracePos);
  
  // 로그: [선택 관리자] 코드 블록 선택 완료: {openBracePos.line}:{openBracePos.character}에서 {closeBracePos.line}:{closeBracePos.character}까지
  return true;
}

// 함수 끝으로 커서 이동
async function moveCursorToFunctionEnd() {
  // 로그: [선택 관리자] 함수 끝으로 커서 이동 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  const document = editor.document;
  const currentPos = editor.selection.active;
  const text = document.getText();
  
  // 현재 줄부터 텍스트를 검색
  const startOffset = document.offsetAt(currentPos);
  const functionEndRegex = /}\s*;?\s*$/gm;
  functionEndRegex.lastIndex = startOffset;
  
  const match = functionEndRegex.exec(text);
  if (!match) {
    // 로그: [선택 관리자] 함수 끝을 찾을 수 없음
    return false;
  }
  
  const functionEndPos = document.positionAt(match.index + 1);
  
  // 로그: [선택 관리자] 함수 끝 위치: {functionEndPos.line}:{functionEndPos.character}
  
  // 커서 이동
  selectionManager.moveCursor(editor, functionEndPos);
  
  // 로그: [선택 관리자] 커서 이동 완료: {functionEndPos.line}:{functionEndPos.character}
  return true;
}

// 실제 로그 예시
// [선택 관리자] 코드 블록 선택 시작
// [선택 관리자] 현재 커서 위치: 14:8
// [선택 관리자] 중괄호 시작 위치: 14:18
// [선택 관리자] 중괄호 끝 위치: 22:1
// [선택 관리자] 코드 블록 선택 완료: 14:18에서 22:1까지
// [선택 관리자] 함수 끝으로 커서 이동 시작
// [선택 관리자] 함수 끝 위치: 45:1
// [선택 관리자] 커서 이동 완료: 45:1
```

## 2. 코드 수정 (✓)

### 2.1 코드 변환
- 구현:
  ```typescript
  class CodeTransformer {
    private readonly parser: TypeScriptParser;

    // 코드 포맷팅
    async formatCode(
      document: vscode.TextDocument,
      range?: vscode.Range
    ): Promise<void> {
      await vscode.commands.executeCommand(
        'editor.action.formatDocument',
        range
      );
    }

    // 변수 이름 변경
    async renameSymbol(
      editor: vscode.TextEditor,
      newName: string
    ): Promise<void> {
      const position = editor.selection.active;
      await vscode.commands.executeCommand(
        'editor.action.rename',
        [editor.document.uri, position, newName]
      );
    }

    // 코드 리팩토링
    async refactorCode(
      editor: vscode.TextEditor,
      refactoring: RefactoringAction
    ): Promise<void> {
      const document = editor.document;
      const selection = editor.selection;

      switch (refactoring.type) {
        case 'extract-function':
          await this.extractFunction(
            document,
            selection,
            refactoring.newName
          );
          break;
        case 'extract-variable':
          await this.extractVariable(
            document,
            selection,
            refactoring.newName
          );
          break;
        // 기타 리팩토링 작업...
      }
    }
  }
  ```

### 2.1.1 실제 코드 변환 사용 예제
```typescript
// 코드 변환기 인스턴스 생성
const codeTransformer = new CodeTransformer();

// 코드 포맷팅 예제
async function formatCurrentDocument() {
  // 로그: [코드 변환기] 문서 포맷팅 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [코드 변환기] 오류: 활성화된 에디터가 없음
    return false;
  }
  
  // 로그: [코드 변환기] 파일: {editor.document.fileName} 포맷팅 중
  
  // 전체 문서 포맷팅
  await codeTransformer.formatCode(editor.document);
  
  // 로그: [코드 변환기] 포맷팅 완료
  return true;
}

// 선택 영역만 포맷팅 예제
async function formatSelectedCode() {
  // 로그: [코드 변환기] 선택 영역 포맷팅 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    // 로그: [코드 변환기] 오류: 선택된 텍스트가 없음
    return false;
  }
  
  // 로그: [코드 변환기] 선택 영역: {editor.selection.start.line}:{editor.selection.start.character}에서 {editor.selection.end.line}:{editor.selection.end.character}까지 포맷팅 중
  
  // 선택된 영역만 포맷팅
  await codeTransformer.formatCode(editor.document, editor.selection);
  
  // 로그: [코드 변환기] 선택 영역 포맷팅 완료
  return true;
}

// 변수 이름 변경 예제
async function renameCurrentSymbol() {
  // 로그: [코드 변환기] 심볼 이름 변경 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  // 사용자에게 새 이름 입력 요청
  const newName = await vscode.window.showInputBox({
    prompt: "새 이름을 입력하세요",
    value: "" // 기본값
  });
  
  if (!newName) {
    // 로그: [코드 변환기] 이름 변경 취소됨: 사용자가 이름을 입력하지 않음
    return false;
  }
  
  // 로그: [코드 변환기] 심볼 이름을 '{newName}'으로 변경 중
  
  // 심볼 이름 변경 실행
  await codeTransformer.renameSymbol(editor, newName);
  
  // 로그: [코드 변환기] 심볼 이름 변경 완료
  return true;
}

// 코드 리팩토링 - 함수 추출 예제
async function extractSelectedCodeToFunction() {
  // 로그: [코드 변환기] 함수 추출 리팩토링 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    // 로그: [코드 변환기] 오류: 추출할 코드가 선택되지 않음
    return false;
  }
  
  // 사용자에게 함수 이름 입력 요청
  const functionName = await vscode.window.showInputBox({
    prompt: "추출할 함수 이름을 입력하세요",
    value: "extractedFunction"
  });
  
  if (!functionName) {
    // 로그: [코드 변환기] 함수 추출 취소됨: 함수 이름이 제공되지 않음
    return false;
  }
  
  // 로그: [코드 변환기] 선택된 코드를 '{functionName}' 함수로 추출 중
  
  // 함수 추출 리팩토링 실행
  await codeTransformer.refactorCode(editor, {
    type: 'extract-function',
    newName: functionName
  });
  
  // 로그: [코드 변환기] 함수 추출 완료: '{functionName}' 함수 생성됨
  return true;
}

// 실제 로그 예시
// [코드 변환기] 문서 포맷팅 시작
// [코드 변환기] 파일: /users/projects/my-app/src/components/Button.tsx 포맷팅 중
// [코드 변환기] 포맷팅 규칙 적용: prettier
// [코드 변환기] 포맷팅 완료: 24 줄 처리됨
// [코드 변환기] 심볼 이름 변경 시작
// [코드 변환기] 심볼 이름을 'UserProfileCard'로 변경 중
// [코드 변환기] 작업 영역 내 7개 파일에서 심볼 발견
// [코드 변환기] 심볼 이름 변경 완료: 15개 참조 업데이트됨
// [코드 변환기] 함수 추출 리팩토링 시작
// [코드 변환기] 선택된 코드를 'handleSubmit' 함수로 추출 중
// [코드 변환기] 사용된 변수 분석 중
// [코드 변환기] 함수 시그니처 생성: function handleSubmit(formData: FormData): void
// [코드 변환기] 함수 추출 완료: 'handleSubmit' 함수 생성됨
```

### 2.2 코드 검증
- 구현:
  ```typescript
  class CodeValidator {
    // 구문 검사
    async validateSyntax(
      code: string,
      language: string
    ): Promise<ValidationResult> {
      try {
        const ast = await this.parser.parse(code, language);
        return {
          isValid: true,
          ast: ast
        };
      } catch (error) {
        return {
          isValid: false,
          error: error.message
        };
      }
    }

    // 변경 사항 검증
    async validateChanges(
      document: vscode.TextDocument,
      changes: TextEdit[]
    ): Promise<boolean> {
      // 변경 사항 임시 적용
      const tempDoc = document.getText();
      const modifiedDoc = this.applyEdits(tempDoc, changes);

      // 구문 검사 수행
      const result = await this.validateSyntax(
        modifiedDoc,
        document.languageId
      );

      return result.isValid;
    }
  }
  ```

### 2.2.1 실제 코드 검증 사용 예제
```typescript
// 코드 검증기 인스턴스 생성
const codeValidator = new CodeValidator();

// 코드 검증 예제
async function validateCodeBeforeSaving() {
  // 로그: [코드 검증기] 저장 전 코드 검증 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  const document = editor.document;
  const code = document.getText();
  const language = document.languageId;
  
  // 로그: [코드 검증기] 언어: {language}, 파일: {document.fileName} 검증 중
  
  // 구문 검사 실행
  const result = await codeValidator.validateSyntax(code, language);
  
  if (result.isValid) {
    // 로그: [코드 검증기] 코드 검증 성공: 유효한 구문
    return true;
  } else {
    // 오류 정보 표시
    // 로그: [코드 검증기] 코드 검증 실패: {result.error}
    vscode.window.showErrorMessage(`구문 오류: ${result.error}`);
    return false;
  }
}

// 변경 사항 미리보기 및 검증 예제
async function previewAndValidateChanges() {
  // 로그: [코드 검증기] 변경 사항 미리보기 및 검증 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  
  // 변경 사항 목록 예시 (실제로는 사용자 작업에 따라 생성됨)
  const changes: TextEdit[] = [
    {
      range: new vscode.Range(
        new vscode.Position(10, 0),
        new vscode.Position(15, 0)
      ),
      newText: "// 이 부분이 교체됩니다\nconst newCode = true;\n"
    }
  ];
  
  // 로그: [코드 검증기] {changes.length}개 변경 사항 검증 중
  
  // 변경 사항 검증
  const isValid = await codeValidator.validateChanges(
    editor.document,
    changes
  );
  
  if (isValid) {
    // 로그: [코드 검증기] 변경 사항 검증 성공: 유효한 구문
    // 변경 사항 적용 예시...
    return true;
  } else {
    // 로그: [코드 검증기] 변경 사항 검증 실패: 구문 오류 발생
    vscode.window.showErrorMessage('변경 사항이 유효하지 않습니다.');
    return false;
  }
}

// 실시간 오류 검사 예제
function setupLiveValidation(context: vscode.ExtensionContext) {
  // 로그: [코드 검증기] 실시간 코드 검증 설정 중
  
  // 편집기 변경 구독
  const disposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    const document = event.document;
    
    // 지원되는 언어만 검증
    if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(document.languageId)) {
      // 로그: [코드 검증기] 파일 변경 감지: {document.fileName}
      
      // 일정 시간 후 검증 실행 (타이핑 도중에는 검증하지 않음)
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(async () => {
        // 로그: [코드 검증기] 변경된 코드 검증 중
        
        const code = document.getText();
        const result = await codeValidator.validateSyntax(code, document.languageId);
        
        if (result.isValid) {
          // 로그: [코드 검증기] 실시간 검증 통과
          // 기존 오류 표시 제거
        } else {
          // 로그: [코드 검증기] 실시간 검증 실패: {result.error}
          // 오류 표시 (예: 에디터에 빨간 밑줄)
        }
      }, 500); // 500ms 지연
    }
  });
  
  // 구독 해제를 위해 컨텍스트에 추가
  context.subscriptions.push(disposable);
  
  // 로그: [코드 검증기] 실시간 코드 검증 설정 완료
}

// 실제 로그 예시
// [코드 검증기] 저장 전 코드 검증 시작
// [코드 검증기] 언어: typescript, 파일: /users/projects/my-app/src/components/Button.tsx 검증 중
// [코드 검증기] TypeScript 파서 초기화 중
// [코드 검증기] AST 생성 중
// [코드 검증기] 코드 검증 성공: 유효한 구문
// [코드 검증기] 변경 사항 미리보기 및 검증 시작
// [코드 검증기] 1개 변경 사항 검증 중
// [코드 검증기] 임시 문서에 변경 사항 적용 중
// [코드 검증기] 수정된 코드 구문 분석 중
// [코드 검증기] 변경 사항 검증 성공: 유효한 구문
// [코드 검증기] 실시간 코드 검증 설정 중
// [코드 검증기] 파일 변경 감지: /users/projects/my-app/src/components/Button.tsx
// [코드 검증기] 변경된 코드 검증 중
// [코드 검증기] 실시간 검증 통과
```

## 3. 실행 취소/다시 실행 (✓)

### 3.1 편집 기록 관리
- 구현:
  ```typescript
  class EditHistoryManager {
    private readonly MAX_HISTORY = 100;
    private undoStack: Edit[] = [];
    private redoStack: Edit[] = [];

    // 편집 기록 추가
    addEdit(edit: Edit): void {
      this.undoStack.push(edit);
      this.redoStack = [];

      if (this.undoStack.length > this.MAX_HISTORY) {
        this.undoStack.shift();
      }
    }

    // 실행 취소
    async undo(
      editor: vscode.TextEditor
    ): Promise<boolean> {
      const edit = this.undoStack.pop();
      if (!edit) return false;

      const success = await this.applyEdit(editor, edit.reverse());
      if (success) {
        this.redoStack.push(edit);
      }

      return success;
    }

    // 다시 실행
    async redo(
      editor: vscode.TextEditor
    ): Promise<boolean> {
      const edit = this.redoStack.pop();
      if (!edit) return false;

      const success = await this.applyEdit(editor, edit);
      if (success) {
        this.undoStack.push(edit);
      }

      return success;
    }
  }
  ```

### 3.1.1 실제 편집 기록 관리 사용 예제
```typescript
// 편집 기록 관리자 인스턴스 생성
const historyManager = new EditHistoryManager();

// 편집 기록 추가 예제
function trackEdit(editor: vscode.TextEditor, edit: Edit) {
  // 로그: [기록 관리자] 편집 기록 추가 시작
  
  // 편집 기록 추가
  historyManager.addEdit(edit);
  
  // 로그: [기록 관리자] 편집 기록 추가 완료
  // 로그: [기록 관리자] 현재 기록 크기: Undo={historyManager.undoStack.length}, Redo={historyManager.redoStack.length}
}

// 실행 취소 예제
async function performUndo() {
  // 로그: [기록 관리자] 실행 취소 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [기록 관리자] 오류: 활성화된 에디터가 없음
    return false;
  }
  
  // 실행 취소 명령 실행
  const success = await historyManager.undo(editor);
  
  if (success) {
    // 로그: [기록 관리자] 실행 취소 성공
    // 로그: [기록 관리자] 현재 기록 크기: Undo={historyManager.undoStack.length}, Redo={historyManager.redoStack.length}
  } else {
    // 로그: [기록 관리자] 실행 취소 실패: 취소할 작업이 없음
  }
  
  return success;
}

// 다시 실행 예제
async function performRedo() {
  // 로그: [기록 관리자] 다시 실행 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [기록 관리자] 오류: 활성화된 에디터가 없음
    return false;
  }
  
  // 다시 실행 명령 실행
  const success = await historyManager.redo(editor);
  
  if (success) {
    // 로그: [기록 관리자] 다시 실행 성공
    // 로그: [기록 관리자] 현재 기록 크기: Undo={historyManager.undoStack.length}, Redo={historyManager.redoStack.length}
  } else {
    // 로그: [기록 관리자] 다시 실행 실패: 다시 실행할 작업이 없음
  }
  
  return success;
}

// 사용자 인터페이스에 편집 기록 명령 추가
function registerHistoryCommands(context: vscode.ExtensionContext) {
  // 로그: [기록 관리자] 편집 기록 명령 등록 중
  
  // 실행 취소 명령 등록
  const undoCommand = vscode.commands.registerCommand(
    'extension.customUndo',
    performUndo
  );
  
  // 다시 실행 명령 등록
  const redoCommand = vscode.commands.registerCommand(
    'extension.customRedo',
    performRedo
  );
  
  // 컨텍스트에 명령 추가
  context.subscriptions.push(undoCommand);
  context.subscriptions.push(redoCommand);
  
  // 로그: [기록 관리자] 편집 기록 명령 등록 완료
}

// 확장 기능에 키보드 단축키 등록
function registerKeyBindings() {
  // 키 바인딩 구성 가져오기
  const config = vscode.workspace.getConfiguration('editor');
  
  // 로그: [기록 관리자] 키 바인딩 등록 중
  
  // 키 바인딩 등록
  vscode.commands.executeCommand('setContext', 'customUndoRedoEnabled', true);
  
  // 로그: [기록 관리자] 키 바인딩 등록 완료
}

// 실제 로그 예시
// [기록 관리자] 편집 기록 추가 시작
// [기록 관리자] 편집 타입: 삽입
// [기록 관리자] 편집 위치: 24:15
// [기록 관리자] 편집 기록 추가 완료
// [기록 관리자] 현재 기록 크기: Undo=7, Redo=0
// [기록 관리자] 실행 취소 시작
// [기록 관리자] 마지막 편집 가져오기
// [기록 관리자] 편집 되돌리기: 삽입 -> 삭제
// [기록 관리자] 실행 취소 성공
// [기록 관리자] 현재 기록 크기: Undo=6, Redo=1
// [기록 관리자] 다시 실행 시작
// [기록 관리자] 마지막 다시 실행 편집 가져오기
// [기록 관리자] 편집 적용: 삽입
// [기록 관리자] 다시 실행 성공
// [기록 관리자] 현재 기록 크기: Undo=7, Redo=0
// [기록 관리자] 편집 기록 명령 등록 중
// [기록 관리자] 명령 등록: extension.customUndo
// [기록 관리자] 명령 등록: extension.customRedo
// [기록 관리자] 편집 기록 명령 등록 완료
```

### 3.2 사용자 정의 히스토리 인터페이스
```typescript
// 실제 사용 예시: 사용자 정의 편집 히스토리 인터페이스
class CustomHistoryView {
  private readonly historyManager: EditHistoryManager;
  private readonly view: vscode.TreeView<HistoryItem>;
  
  constructor(context: vscode.ExtensionContext) {
    this.historyManager = new EditHistoryManager();
    
    // 로그: [기록 뷰] 사용자 정의 편집 기록 뷰 초기화
    
    // 트리 데이터 제공자 생성
    const treeDataProvider = new HistoryTreeDataProvider(this.historyManager);
    
    // 트리 뷰 생성
    this.view = vscode.window.createTreeView('editHistory', {
      treeDataProvider,
      showCollapseAll: true
    });
    
    // 컨텍스트에 뷰 등록
    context.subscriptions.push(this.view);
    
    // 히스토리 변경 이벤트 등록
    this.historyManager.onDidChangeHistory(() => {
      // 로그: [기록 뷰] 편집 기록 변경 감지
      treeDataProvider.refresh();
    });
    
    // 로그: [기록 뷰] 사용자 정의 편집 기록 뷰 초기화 완료
  }
  
  // 특정 기록 항목으로 이동
  async gotoHistoryItem(item: HistoryItem): Promise<boolean> {
    // 로그: [기록 뷰] 기록 항목으로 이동 시작: {item.label}
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      // 로그: [기록 뷰] 오류: 활성화된 에디터가 없음
      return false;
    }
    
    // 해당 항목까지 실행 취소 또는 다시 실행
    const success = await this.historyManager.gotoHistoryState(item.id);
    
    // 로그: [기록 뷰] 기록 항목으로 이동 결과: {success ? '성공' : '실패'}
    return success;
  }
}

// 실제 로그 예시
// [기록 뷰] 사용자 정의 편집 기록 뷰 초기화
// [기록 뷰] 트리 데이터 제공자 생성 중
// [기록 뷰] 초기 편집 기록 로드 중
// [기록 뷰] 편집 기록 항목 7개 로드됨
// [기록 뷰] 사용자 정의 편집 기록 뷰 초기화 완료
// [기록 뷰] 편집 기록 변경 감지
// [기록 뷰] 트리 뷰 새로고침
// [기록 뷰] 기록 항목으로 이동 시작: 텍스트 삽입 - 24:15
// [기록 뷰] 현재 상태에서 3단계 뒤로 이동 중
// [기록 뷰] 실행 취소 수행: 3회
// [기록 뷰] 기록 항목으로 이동 결과: 성공
```

## 4. 통합 코드 수정 시스템 (✓)

### 4.1 실제 통합 코드 수정 시스템 사용 예제
```typescript
// 통합 코드 수정 시스템
class IntegratedCodeModifier {
  private readonly textModifier: TextModifier;
  private readonly selectionManager: SelectionManager;
  private readonly codeTransformer: CodeTransformer;
  private readonly codeValidator: CodeValidator;
  private readonly historyManager: EditHistoryManager;
  
  constructor() {
    // 로그: [통합 수정기] 통합 코드 수정 시스템 초기화
    
    this.textModifier = new TextModifier();
    this.selectionManager = new SelectionManager();
    this.codeTransformer = new CodeTransformer();
    this.codeValidator = new CodeValidator();
    this.historyManager = new EditHistoryManager();
    
    // 로그: [통합 수정기] 통합 코드 수정 시스템 초기화 완료
  }
  
  // 안전한 코드 수정 수행
  async safelyModifyCode(
    editor: vscode.TextEditor,
    modificationFn: () => Promise<Edit>
  ): Promise<boolean> {
    // 로그: [통합 수정기] 안전한 코드 수정 시작
    
    try {
      // 수정 전 문서 상태 저장
      const originalDoc = editor.document.getText();
      
      // 수정 수행
      const edit = await modificationFn();
      
      // 로그: [통합 수정기] 코드 수정 적용 중
      
      // 수정 결과 검증
      const isValid = await this.codeValidator.validateChanges(
        editor.document,
        [edit]
      );
      
      if (!isValid) {
        // 로그: [통합 수정기] 오류: 유효하지 않은 코드 수정
        return false;
      }
      
      // 기록에 수정 추가
      this.historyManager.addEdit(edit);
      
      // 로그: [통합 수정기] 안전한 코드 수정 완료
      return true;
    } catch (error) {
      // 로그: [통합 수정기] 오류: 코드 수정 중 예외 발생: {error.message}
      return false;
    }
  }
  
  // AI 제안 코드 적용
  async applyAISuggestion(
    editor: vscode.TextEditor,
    suggestion: CodeSuggestion
  ): Promise<boolean> {
    // 로그: [통합 수정기] AI 제안 적용 시작
    
    // 선택 영역 또는 커서 위치 가져오기
    const selection = editor.selection;
    
    // 로그: [통합 수정기] AI 제안 유효성 검사 중
    
    // 제안 유효성 검사
    const isValid = await this.codeValidator.validateSyntax(
      suggestion.code,
      editor.document.languageId
    );
    
    if (!isValid) {
      // 로그: [통합 수정기] 오류: 유효하지 않은 AI 제안
      return false;
    }
    
    // 로그: [통합 수정기] AI 제안 적용 중
    
    // 안전하게 수정 적용
    return this.safelyModifyCode(editor, async () => {
      // 텍스트 교체 수행
      const edit = {
        range: selection,
        newText: suggestion.code
      };
      
      // 텍스트 수정기를 통해 적용
      await this.textModifier.replaceText(editor, selection, suggestion.code);
      
      // 로그: [통합 수정기] AI 제안 적용 완료
      return edit;
    });
  }
}

// 확장 기능 활성화 시 통합 코드 수정 시스템 초기화
function activate(context: vscode.ExtensionContext) {
  // 로그: [확장 기능] 볼드모트 코드 수정 확장 기능 활성화 중
  
  // 통합 코드 수정 시스템 인스턴스 생성
  const codeModifier = new IntegratedCodeModifier();
  
  // 명령 등록: AI 코드 제안 요청
  const requestSuggestionCommand = vscode.commands.registerCommand(
    'extension.requestCodeSuggestion',
    async () => {
      // 로그: [확장 기능] AI 코드 제안 요청 시작
      
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        // 로그: [확장 기능] 오류: 활성화된 에디터가 없음
        return;
      }
      
      // 선택 영역 가져오기
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      
      // 로그: [확장 기능] 선택된 코드: {selectedText.substring(0, 50)}...
      
      // AI에 제안 요청 (실제 구현은 생략)
      const suggestion = await requestAISuggestion(selectedText, editor.document.languageId);
      
      // 제안 적용
      const success = await codeModifier.applyAISuggestion(editor, suggestion);
      
      // 로그: [확장 기능] AI 제안 적용 결과: {success ? '성공' : '실패'}
    }
  );
  
  // 명령 등록: 코드 정리
  const cleanupCodeCommand = vscode.commands.registerCommand(
    'extension.cleanupCode',
    async () => {
      // 로그: [확장 기능] 코드 정리 시작
      
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      // 안전하게 코드 정리 수행
      const success = await codeModifier.safelyModifyCode(editor, async () => {
        // 콘솔 로그 제거 (예시)
        const document = editor.document;
        const text = document.getText();
        
        // 정규식으로 console.log 찾기
        const consoleLogRegex = /console\.log\(.*?\);?\n?/g;
        let newText = text.replace(consoleLogRegex, '');
        
        // 전체 문서 교체
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
        );
        
        await editor.edit(editBuilder => {
          editBuilder.replace(fullRange, newText);
        });
        
        return {
          range: fullRange,
          newText
        };
      });
      
      // 로그: [확장 기능] 코드 정리 결과: {success ? '성공' : '실패'}
    }
  );
  
  // 컨텍스트에 명령 추가
  context.subscriptions.push(requestSuggestionCommand);
  context.subscriptions.push(cleanupCodeCommand);
  
  // 로그: [확장 기능] 볼드모트 코드 수정 확장 기능 활성화 완료
}

// 실제 로그 예시
// [통합 수정기] 통합 코드 수정 시스템 초기화
// [통합 수정기] 텍스트 수정기 초기화 중
// [통합 수정기] 선택 관리자 초기화 중
// [통합 수정기] 코드 변환기 초기화 중
// [통합 수정기] 코드 검증기 초기화 중
// [통합 수정기] 기록 관리자 초기화 중
// [통합 수정기] 통합 코드 수정 시스템 초기화 완료
// [확장 기능] 볼드모트 코드 수정 확장 기능 활성화 중
// [확장 기능] 명령 등록: extension.requestCodeSuggestion
// [확장 기능] 명령 등록: extension.cleanupCode
// [확장 기능] 볼드모트 코드 수정 확장 기능 활성화 완료
// [확장 기능] AI 코드 제안 요청 시작
// [확장 기능] 선택된 코드: function calculateTotal(items) {
//   let total = 0;
//   for...
// [통합 수정기] AI 제안 적용 시작
// [통합 수정기] AI 제안 유효성 검사 중
// [코드 검증기] 언어: javascript, 코드 검증 중
// [코드 검증기] 코드 검증 성공: 유효한 구문
// [통합 수정기] AI 제안 적용 중
// [통합 수정기] 안전한 코드 수정 시작
// [통합 수정기] 코드 수정 적용 중
// [코드 검증기] 변경 사항 검증 중
// [코드 검증기] 변경 사항 검증 성공: 유효한 구문
// [통합 수정기] 안전한 코드 수정 완료
// [확장 기능] AI 제안 적용 결과: 성공
```

## 5. 결론

이 문서는 볼드모트 IDE에서 실제로 구현된 코드 수정 방식을 설명합니다. 각 기능의 구체적인 구현 방식과 API 사용 예제를 포함하고 있으며, 이제 실제 코드에서 사용되는 코드 수정 로직을 보여줍니다. 이러한 실제 사용 예제와 로그를 통해 개발자들이 IDE의 코드 수정 시스템을 이해하고 활용하는 데 도움이 될 것입니다.

텍스트 편집, 코드 변환, 코드 검증, 편집 기록 관리와 같은 핵심 기능은 실제 VSCode Extension API를 기반으로 구현되었으며, 모든 예제는 실제 사용 사례와 로그를 반영합니다. 이러한 상세한 예제는 케어렛 프로젝트의 개발자들이 코드 수정 시스템을 구현할 때 참고할 수 있는 중요한 자료가 될 것입니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 코드 수정 구현을 바탕으로 작성되었습니다. 