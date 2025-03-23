# VS Code 플러그인으로 AI 코딩 에이전트 구현 가이드

이 문서는 VS Code 플러그인을 통해 Cursor와 같은 AI 코딩 에이전트를 구현할 때 필요한 추가 정보와 기술을 상세히 설명합니다. VS Code의 기본 API만으로는 구현이 어려운 부분들을 중심으로 설명합니다.

## 목차

1. [AI 모델 통합 관련 정보](#1-ai-모델-통합-관련-정보)
2. [코드 이해 및 처리 관련 기술](#2-코드-이해-및-처리-관련-기술)
3. [인프라 및 성능 관련](#3-인프라-및-성능-관련)
4. [사용자 경험 및 UI 관련](#4-사용자-경험-및-ui-관련)
5. [데이터 보안 및 개인정보 보호](#5-데이터-보안-및-개인정보-보호)
6. [확장성 및 커스터마이징](#6-확장성-및-커스터마이징)
7. [구현 로드맵 및 우선순위](#7-구현-로드맵-및-우선순위)

## 1. AI 모델 통합 관련 정보

VS Code API는 기본적으로 AI 모델과의 통합을 위한 기능을 제공하지 않습니다. 다음과 같은 추가 정보와 구현이 필요합니다.

### 1.1 AI 모델 API 연결 및 통신

#### 필요 정보 및 기술
- **API 엔드포인트 및 인증 관리**
  ```typescript
  // 예시 코드: AI 모델 클라이언트 설정
  class AIModelClient {
    private apiKey: string;
    private endpoint: string;
    private modelName: string;
    
    constructor(apiKey: string, endpoint: string, modelName: string) {
      this.apiKey = apiKey;
      this.endpoint = endpoint;
      this.modelName = modelName;
    }
    
    async generateCompletion(prompt: string, options: CompletionOptions): Promise<string> {
      // API 호출 구현
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          prompt: prompt,
          max_tokens: options.maxTokens,
          temperature: options.temperature
        })
      });
      
      const result = await response.json();
      return result.choices[0].text;
    }
  }
  ```

- **스트리밍 응답 처리**
  ```typescript
  // 스트리밍 응답 처리 예시
  async streamCompletion(prompt: string, options: CompletionOptions, callback: (text: string) => void): Promise<void> {
    const response = await fetch(this.endpoint + '/streaming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        prompt: prompt,
        stream: true,
        max_tokens: options.maxTokens
      })
    });
    
    const reader = response.body?.getReader();
    if (!reader) return;
    
    const decoder = new TextDecoder();
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (done) break;
      
      const chunk = decoder.decode(value);
      // SSE 형식 파싱 및 콜백 호출
      parseSSEAndCallback(chunk, callback);
    }
  }
  ```

- **병렬 요청 및 응답 관리**
  ```typescript
  // 여러 AI 요청의 병렬 처리
  async batchProcess(requests: AIRequest[]): Promise<AIResponse[]> {
    const promises = requests.map(req => this.generateCompletion(req.prompt, req.options));
    return Promise.all(promises);
  }
  ```

#### 구현 고려사항
- 다양한 AI 모델(Claude, GPT 등) 지원을 위한 어댑터 패턴
- 토큰 사용량 추적 및 제한 메커니즘
- 네트워크 장애 대응 및 재시도 로직
- 응답 캐싱 및 재사용 전략

### 1.2 효과적인 프롬프트 엔지니어링

#### 필요 정보 및 기술
- **코드 분석용 최적 프롬프트 템플릿**
  ```typescript
  // 프롬프트 템플릿 관리 시스템
  class PromptTemplateManager {
    private templates: Map<string, string> = new Map();
    
    constructor() {
      // 기본 템플릿 등록
      this.templates.set('code_analysis', 
        `As an expert programmer, analyze the following code:
        \`\`\`{{language}}
        {{code}}
        \`\`\`
        Provide insights on: 
        1. Code structure and organization
        2. Potential bugs or issues
        3. Performance considerations
        4. Suggested improvements`);
      
      this.templates.set('refactoring',
        `Refactor the following code to improve {{improvementFocus}}:
        \`\`\`{{language}}
        {{code}}
        \`\`\`
        Provide the refactored code with explanations.`);
      
      // 추가 템플릿...
    }
    
    getRenderedPrompt(templateName: string, variables: Record<string, string>): string {
      const template = this.templates.get(templateName);
      if (!template) throw new Error(`Template '${templateName}' not found`);
      
      // 변수 치환
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return variables[key] || `{{${key}}}`;
      });
    }
  }
  ```

- **컨텍스트 창 관리 기법**
  ```typescript
  // 컨텍스트 윈도우 관리
  class ContextWindowManager {
    private maxTokens: number;
    private tokenCounter: TokenCounter;
    
    constructor(maxTokens: number, tokenCounter: TokenCounter) {
      this.maxTokens = maxTokens;
      this.tokenCounter = tokenCounter;
    }
    
    optimizeContext(items: ContextItem[], reservedTokens: number): ContextItem[] {
      const availableTokens = this.maxTokens - reservedTokens;
      let totalTokens = 0;
      const result: ContextItem[] = [];
      
      // 우선순위에 따라 정렬
      const sortedItems = [...items].sort((a, b) => b.priority - a.priority);
      
      for (const item of sortedItems) {
        const tokens = this.tokenCounter.countTokens(item.content);
        if (totalTokens + tokens <= availableTokens) {
          result.push(item);
          totalTokens += tokens;
        } else {
          // 필요 시 축약 버전 사용
          if (item.summary && item.summaryTokens) {
            if (totalTokens + item.summaryTokens <= availableTokens) {
              result.push({...item, content: item.summary});
              totalTokens += item.summaryTokens;
            }
          }
        }
      }
      
      return result;
    }
  }
  ```

- **시스템 프롬프트 최적화**
  ```typescript
  // 코딩 에이전트를 위한 시스템 프롬프트 예시
  const systemPrompt = `You are an expert programming assistant with expertise in multiple languages.
  When analyzing or generating code:
  - Prioritize readability and maintainability
  - Follow best practices and design patterns
  - Consider edge cases and error handling
  - Explain your reasoning for significant decisions
  - Match the existing codebase style and patterns
  
  When answering questions:
  - Be concise but thorough
  - Provide code examples when relevant
  - Reference language documentation when appropriate
  - Indicate any assumptions you're making`;
  ```

#### 구현 고려사항
- 작업 유형별 최적화된 프롬프트 라이브러리 구축
- 사용자 피드백을 통한 프롬프트 개선 시스템
- 언어 및 프레임워크별 특화 프롬프트
- 프롬프트 버전 관리 및 A/B 테스트

### 1.3 RAG(Retrieval-Augmented Generation) 구현

#### 필요 정보 및 기술
- **코드베이스 임베딩 및 색인 생성**
  ```typescript
  // 코드베이스 색인 생성 예시
  class CodebaseIndexer {
    private embedder: TextEmbedder;
    private vectorStore: VectorStore;
    
    constructor(embedder: TextEmbedder, vectorStore: VectorStore) {
      this.embedder = embedder;
      this.vectorStore = vectorStore;
    }
    
    async indexFile(filePath: string, content: string): Promise<void> {
      // 파일을 청크로 분할
      const chunks = this.splitIntoChunks(content);
      
      // 각 청크에 대한 임베딩 생성 및 저장
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.embedder.embed(chunk.text);
        
        await this.vectorStore.addItem({
          id: `${filePath}-${i}`,
          embedding,
          metadata: {
            filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.text
          }
        });
      }
    }
    
    private splitIntoChunks(content: string): CodeChunk[] {
      // 의미 있는 단위로 코드 분할 (함수, 클래스 등)
      // 실제 구현은 언어별 파서를 사용하여 구현
      // ...
      return chunks;
    }
  }
  ```

- **의미 검색 및 관련 코드 조각 검색**
  ```typescript
  // 의미 검색 구현 예시
  class SemanticCodeSearch {
    private embedder: TextEmbedder;
    private vectorStore: VectorStore;
    
    constructor(embedder: TextEmbedder, vectorStore: VectorStore) {
      this.embedder = embedder;
      this.vectorStore = vectorStore;
    }
    
    async search(query: string, limit: number = 5): Promise<SearchResult[]> {
      const queryEmbedding = await this.embedder.embed(query);
      const results = await this.vectorStore.search(queryEmbedding, limit);
      
      return results.map(result => ({
        filePath: result.metadata.filePath,
        startLine: result.metadata.startLine,
        endLine: result.metadata.endLine,
        content: result.metadata.content,
        similarity: result.score
      }));
    }
  }
  ```

- **컨텍스트 지능적 조합**
  ```typescript
  // 컨텍스트 조합 로직 예시
  async function buildPromptWithContext(userQuery: string, currentFile: string, currentPosition: Position): Promise<string> {
    // 1. 현재 파일 및 커서 위치 주변 코드 수집
    const localContext = await getLocalContext(currentFile, currentPosition);
    
    // 2. 관련 코드 조각 검색
    const searchResults = await semanticSearch.search(userQuery);
    
    // 3. 프로젝트 구조 정보 수집
    const projectStructure = await getProjectStructure();
    
    // 4. 컨텍스트 우선순위 지정 및 토큰 제한에 맞게 조합
    const combinedContext = contextWindowManager.optimizeContext([
      { content: localContext, priority: 10 },
      ...searchResults.map(r => ({ content: r.content, priority: r.similarity * 8 })),
      { content: projectStructure, priority: 5 }
    ], 1000); // 사용자 쿼리와 응답을 위해 1000 토큰 예약
    
    // 5. 최종 프롬프트 구성
    const formattedContext = combinedContext.map(c => c.content).join('\n\n');
    return `${formattedContext}\n\nUser Query: ${userQuery}`;
  }
  ```

#### 구현 고려사항
- 로컬 임베딩 엔진 vs 클라우드 임베딩 서비스
- 점진적 색인 업데이트 전략
- 색인 데이터 저장 및 버전 관리
- 임베딩 모델 선택 및 최적화

## 2. 코드 이해 및 처리 관련 기술

VS Code API는 기본적인 코드 탐색 기능을 제공하지만, 심층적인 코드 이해와 처리를 위해서는 추가적인 기술이 필요합니다.

### 2.1 AST(Abstract Syntax Tree) 분석 도구

#### 필요 정보 및 기술
- **다양한 언어별 파서 통합**
  ```typescript
  // 다중 언어 AST 파서 관리자
  class ASTParserManager {
    private parsers: Map<string, LanguageParser> = new Map();
    
    registerParser(languageId: string, parser: LanguageParser): void {
      this.parsers.set(languageId, parser);
    }
    
    async parseCode(languageId: string, code: string): Promise<ASTNode | null> {
      const parser = this.parsers.get(languageId);
      if (!parser) return null;
      
      try {
        return await parser.parse(code);
      } catch (error) {
        console.error(`Error parsing ${languageId} code:`, error);
        return null;
      }
    }
  }
  
  // 언어별 파서 인터페이스
  interface LanguageParser {
    parse(code: string): Promise<ASTNode>;
    getNodeAtPosition(ast: ASTNode, position: Position): ASTNode | null;
    findReferences(ast: ASTNode, symbolName: string): ASTNode[];
    findDefinition(ast: ASTNode, symbolName: string): ASTNode | null;
  }
  ```

- **코드 구조 분석 메커니즘**
  ```typescript
  // 코드 구조 분석 예시
  class CodeStructureAnalyzer {
    private astParser: ASTParserManager;
    
    constructor(astParser: ASTParserManager) {
      this.astParser = astParser;
    }
    
    async analyzeFile(filePath: string, content: string, languageId: string): Promise<CodeStructure> {
      // AST 파싱
      const ast = await this.astParser.parseCode(languageId, content);
      if (!ast) return { functions: [], classes: [], imports: [] };
      
      // 코드 구성 요소 추출
      const functions = this.extractFunctions(ast);
      const classes = this.extractClasses(ast);
      const imports = this.extractImports(ast);
      
      return {
        functions,
        classes,
        imports
      };
    }
    
    private extractFunctions(ast: ASTNode): FunctionInfo[] {
      // AST에서 함수 선언 노드 찾기
      // ...
      return functions;
    }
    
    private extractClasses(ast: ASTNode): ClassInfo[] {
      // AST에서 클래스 선언 노드 찾기
      // ...
      return classes;
    }
    
    private extractImports(ast: ASTNode): ImportInfo[] {
      // AST에서 임포트 노드 찾기
      // ...
      return imports;
    }
  }
  ```

- **심볼 관계 및 의존성 분석**
  ```typescript
  // 심볼 관계 분석 도구
  class SymbolRelationshipAnalyzer {
    private astParser: ASTParserManager;
    
    constructor(astParser: ASTParserManager) {
      this.astParser = astParser;
    }
    
    async buildCallGraph(files: Map<string, { content: string, languageId: string }>): Promise<CallGraph> {
      const graph: CallGraph = new Map();
      
      // 모든 파일의 심볼 정의 수집
      const symbols = new Map<string, SymbolDefinition>();
      for (const [filePath, { content, languageId }] of files.entries()) {
        const fileSymbols = await this.extractSymbols(content, languageId);
        for (const symbol of fileSymbols) {
          symbols.set(`${filePath}:${symbol.name}`, {
            ...symbol,
            filePath
          });
        }
      }
      
      // 심볼 간 호출 관계 분석
      for (const [filePath, { content, languageId }] of files.entries()) {
        const ast = await this.astParser.parseCode(languageId, content);
        if (!ast) continue;
        
        const calls = this.extractCalls(ast);
        for (const call of calls) {
          // 호출 관계 그래프 구축
          // ...
        }
      }
      
      return graph;
    }
    
    private async extractSymbols(content: string, languageId: string): Promise<SymbolInfo[]> {
      // 파일에서 심볼 정의 추출
      // ...
      return symbols;
    }
    
    private extractCalls(ast: ASTNode): CallInfo[] {
      // AST에서 함수 호출 노드 추출
      // ...
      return calls;
    }
  }
  ```

#### 구현 고려사항
- 언어별 특화 AST 파서 선택 및 통합
- 대규모 코드베이스 처리를 위한 점진적 분석
- 분석 결과 캐싱 및 재사용 전략
- IDE 기본 언어 서비스와의 통합

### 2.2 코드 변환 및 생성 엔진

#### 필요 정보 및 기술
- **언어별 코드 포맷팅 및 변환 규칙**
  ```typescript
  // 코드 변환 엔진 예시
  class CodeTransformer {
    private astParser: ASTParserManager;
    private formatters: Map<string, CodeFormatter> = new Map();
    
    constructor(astParser: ASTParserManager) {
      this.astParser = astParser;
    }
    
    registerFormatter(languageId: string, formatter: CodeFormatter): void {
      this.formatters.set(languageId, formatter);
    }
    
    async transform(code: string, languageId: string, transformType: TransformType, options?: any): Promise<string> {
      // 1. AST 파싱
      const ast = await this.astParser.parseCode(languageId, code);
      if (!ast) return code;
      
      // 2. AST 변환
      const transformedAst = await this.applyTransformation(ast, transformType, options);
      
      // 3. 코드 생성
      const formatter = this.formatters.get(languageId);
      if (!formatter) return code;
      
      return formatter.format(transformedAst, options);
    }
    
    private async applyTransformation(ast: ASTNode, transformType: TransformType, options?: any): Promise<ASTNode> {
      // 변환 유형에 따른 AST 변환 로직
      switch (transformType) {
        case 'refactor-extract-function':
          return this.extractFunction(ast, options);
        case 'refactor-rename-symbol':
          return this.renameSymbol(ast, options);
        // 기타 변환...
        default:
          return ast;
      }
    }
    
    private extractFunction(ast: ASTNode, options: any): ASTNode {
      // 코드 블록을 함수로 추출하는 로직
      // ...
      return transformedAst;
    }
    
    private renameSymbol(ast: ASTNode, options: any): ASTNode {
      // 심볼 이름 변경 로직
      // ...
      return transformedAst;
    }
  }
  
  interface CodeFormatter {
    format(ast: ASTNode, options?: any): string;
  }
  ```

- **AI 기반 코드 생성 파이프라인**
  ```typescript
  // AI 코드 생성 파이프라인
  class AICodeGenerator {
    private aiClient: AIModelClient;
    private contextBuilder: ContextBuilder;
    private codeTransformer: CodeTransformer;
    
    constructor(aiClient: AIModelClient, contextBuilder: ContextBuilder, codeTransformer: CodeTransformer) {
      this.aiClient = aiClient;
      this.contextBuilder = contextBuilder;
      this.codeTransformer = codeTransformer;
    }
    
    async generateCode(request: CodeGenerationRequest): Promise<string> {
      // 1. 컨텍스트 구성
      const context = await this.contextBuilder.buildContext(request);
      
      // 2. 프롬프트 생성
      const prompt = this.buildPrompt(request, context);
      
      // 3. AI 모델 호출
      const aiResponse = await this.aiClient.generateCompletion(prompt, {
        maxTokens: request.maxTokens || 1024,
        temperature: request.temperature || 0.3
      });
      
      // 4. 코드 추출 및 후처리
      const extractedCode = this.extractCodeFromResponse(aiResponse);
      
      // 5. 포맷팅 및 스타일 맞춤
      const formattedCode = await this.codeTransformer.transform(
        extractedCode,
        request.languageId,
        'format'
      );
      
      return formattedCode;
    }
    
    private buildPrompt(request: CodeGenerationRequest, context: string): string {
      // 요청 유형에 따른 프롬프트 템플릿 선택 및 렌더링
      // ...
      return prompt;
    }
    
    private extractCodeFromResponse(response: string): string {
      // AI 응답에서 코드 블록 추출
      const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```/g;
      const matches = [...response.matchAll(codeBlockRegex)];
      
      if (matches.length > 0) {
        return matches[0][1].trim();
      }
      
      // 코드 블록이 없으면 전체 텍스트 반환
      return response;
    }
  }
  ```

- **코드 품질 분석 및 개선**
  ```typescript
  // 코드 품질 분석 도구
  class CodeQualityAnalyzer {
    private astParser: ASTParserManager;
    private rules: Map<string, QualityRule[]> = new Map();
    
    constructor(astParser: ASTParserManager) {
      this.astParser = astParser;
    }
    
    registerRules(languageId: string, rules: QualityRule[]): void {
      this.rules.set(languageId, [...(this.rules.get(languageId) || []), ...rules]);
    }
    
    async analyzeCode(code: string, languageId: string): Promise<QualityIssue[]> {
      const ast = await this.astParser.parseCode(languageId, code);
      if (!ast) return [];
      
      const languageRules = this.rules.get(languageId) || [];
      const issues: QualityIssue[] = [];
      
      // 각 규칙 검사 실행
      for (const rule of languageRules) {
        const ruleIssues = await rule.check(ast, code);
        issues.push(...ruleIssues);
      }
      
      return issues;
    }
    
    async suggestFixes(code: string, languageId: string, issues: QualityIssue[]): Promise<CodeFix[]> {
      const fixes: CodeFix[] = [];
      
      for (const issue of issues) {
        if (issue.fixable) {
          const fix = await this.generateFix(code, languageId, issue);
          if (fix) fixes.push(fix);
        }
      }
      
      return fixes;
    }
    
    private async generateFix(code: string, languageId: string, issue: QualityIssue): Promise<CodeFix | null> {
      // 이슈에 대한 수정 생성
      // 일부는 규칙 기반, 일부는 AI 기반 수정
      // ...
      return fix;
    }
  }
  
  interface QualityRule {
    id: string;
    description: string;
    check(ast: ASTNode, code: string): Promise<QualityIssue[]>;
  }
  ```

#### 구현 고려사항
- AI 생성 코드의 신뢰성 검증 메커니즘
- 기존 코드베이스 스타일 학습 및 적용
- 코드 생성 패턴 라이브러리 구축
- 빈번한 변환 작업 최적화

### 2.3 멀티파일 코드 이해 구현

#### 필요 정보 및 기술
- **프로젝트 구조 분석**
  ```typescript
  // 프로젝트 구조 분석기
  class ProjectStructureAnalyzer {
    private workspacePath: string;
    
    constructor(workspacePath: string) {
      this.workspacePath = workspacePath;
    }
    
    async analyzeProject(): Promise<ProjectStructure> {
      // 1. 프로젝트 파일 탐색
      const files = await this.findAllProjectFiles();
      
      // 2. 주요 구성 파일 분석
      const configFiles = await this.analyzeConfigFiles(files);
      
      // 3. 디렉토리 구조 분석
      const directoryStructure = this.buildDirectoryStructure(files);
      
      // 4. 주요 구성 요소 식별
      const coreComponents = await this.identifyCoreComponents(files, configFiles);
      
      return {
        configFiles,
        directoryStructure,
        coreComponents,
        entryPoints: this.identifyEntryPoints(files, configFiles)
      };
    }
    
    private async findAllProjectFiles(): Promise<ProjectFile[]> {
      // 워크스페이스의 모든 파일 탐색
      // ...
      return files;
    }
    
    private async analyzeConfigFiles(files: ProjectFile[]): Promise<ConfigFileInfo[]> {
      // package.json, tsconfig.json 등 구성 파일 분석
      // ...
      return configFiles;
    }
    
    private buildDirectoryStructure(files: ProjectFile[]): DirectoryNode {
      // 파일 경로로부터 디렉토리 트리 구성
      // ...
      return rootDirectory;
    }
    
    private async identifyCoreComponents(files: ProjectFile[], configFiles: ConfigFileInfo[]): Promise<CoreComponent[]> {
      // 핵심 구성 요소 식별 (컨트롤러, 모델 등)
      // ...
      return coreComponents;
    }
    
    private identifyEntryPoints(files: ProjectFile[], configFiles: ConfigFileInfo[]): EntryPoint[] {
      // 애플리케이션 진입점 식별
      // ...
      return entryPoints;
    }
  }
  ```

- **코드 참조 및 의존성 그래프**
  ```typescript
  // 의존성 그래프 구축
  class DependencyGraphBuilder {
    private astParser: ASTParserManager;
    private symbolAnalyzer: SymbolRelationshipAnalyzer;
    
    constructor(astParser: ASTParserManager, symbolAnalyzer: SymbolRelationshipAnalyzer) {
      this.astParser = astParser;
      this.symbolAnalyzer = symbolAnalyzer;
    }
    
    async buildDependencyGraph(files: Map<string, { content: string, languageId: string }>): Promise<DependencyGraph> {
      const graph: DependencyGraph = new Map();
      
      // 1. 모든 파일의 임포트 분석
      for (const [filePath, { content, languageId }] of files.entries()) {
        const imports = await this.extractImports(content, languageId);
        graph.set(filePath, { imports, exports: [] });
      }
      
      // 2. 모든 파일의 익스포트 분석
      for (const [filePath, { content, languageId }] of files.entries()) {
        const exports = await this.extractExports(content, languageId);
        const fileNode = graph.get(filePath);
        if (fileNode) {
          fileNode.exports = exports;
        }
      }
      
      // 3. 파일 간 참조 관계 연결
      this.resolveReferences(graph, files);
      
      return graph;
    }
    
    private async extractImports(content: string, languageId: string): Promise<ImportInfo[]> {
      // 파일의 임포트 구문 분석
      // ...
      return imports;
    }
    
    private async extractExports(content: string, languageId: string): Promise<ExportInfo[]> {
      // 파일의 익스포트 구문 분석
      // ...
      return exports;
    }
    
    private resolveReferences(graph: DependencyGraph, files: Map<string, { content: string, languageId: string }>): void {
      // 임포트 경로를 실제 파일 경로로 해석
      // 파일 간 참조 관계 설정
      // ...
    }
  }
  ```

- **중앙 데이터 모델 및 흐름 분석**
  ```typescript
  // 데이터 흐름 분석
  class DataFlowAnalyzer {
    private astParser: ASTParserManager;
    private dependencyGraph: DependencyGraph;
    
    constructor(astParser: ASTParserManager, dependencyGraph: DependencyGraph) {
      this.astParser = astParser;
      this.dependencyGraph = dependencyGraph;
    }
    
    async analyzeDataFlow(files: Map<string, { content: string, languageId: string }>): Promise<DataFlowGraph> {
      const dataFlowGraph: DataFlowGraph = new Map();
      
      // 1. 데이터 모델 식별
      const dataModels = await this.identifyDataModels(files);
      
      // 2. 각 파일의 데이터 사용 분석
      for (const [filePath, { content, languageId }] of files.entries()) {
        const dataUsages = await this.analyzeDataUsage(content, languageId, dataModels);
        dataFlowGraph.set(filePath, dataUsages);
      }
      
      // 3. 파일 간 데이터 흐름 연결
      this.connectDataFlows(dataFlowGraph, this.dependencyGraph);
      
      return dataFlowGraph;
    }
    
    private async identifyDataModels(files: Map<string, { content: string, languageId: string }>): Promise<DataModel[]> {
      // 프로젝트의 주요 데이터 모델 식별
      // ...
      return dataModels;
    }
    
    private async analyzeDataUsage(content: string, languageId: string, dataModels: DataModel[]): Promise<DataUsage[]> {
      // 파일 내 데이터 사용 분석
      // ...
      return dataUsages;
    }
    
    private connectDataFlows(dataFlowGraph: DataFlowGraph, dependencyGraph: DependencyGraph): void {
      // 파일 의존성을 기반으로 데이터 흐름 연결
      // ...
    }
  }
  ```

#### 구현 고려사항
- 대규모 프로젝트 처리를 위한 성능 최적화
- 프레임워크 및 라이브러리 인식 향상
- 동적 언어 분석의 한계 처리
- 증분 분석 및 결과 캐싱
</rewritten_file> 