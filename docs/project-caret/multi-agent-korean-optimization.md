# VS Code AI 오케스트레이션 시스템 (계속)

## 4. CLOVA X API 지원 및 한글 최적화

네이버의 CLOVA X API를 지원하여 한국어 환경에 최적화된 개발 경험을 제공합니다.

### 4.1 CLOVA X 모델 통합

```typescript
// ai/models/clovaModel.ts
import { AIModel, CompletionOptions } from './baseModel';
import axios from 'axios';

export interface ClovaModelConfig {
    apiKey: string;
    modelName: string;  // 'clova-x', 'clova-studio' 등
    endpoint?: string;
}

export class ClovaModel implements AIModel {
    private apiKey: string;
    private modelName: string;
    private endpoint: string;
    
    constructor(config: ClovaModelConfig) {
        this.apiKey = config.apiKey;
        this.modelName = config.modelName;
        this.endpoint = config.endpoint || 'https://clovastudio.apigw.ntruss.com/testapp/v1/completions';
    }
    
    async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
        try {
            const response = await axios.post(
                this.endpoint,
                {
                    modelName: this.modelName,
                    text: prompt,
                    maxTokens: options?.maxTokens || 1000,
                    temperature: options?.temperature || 0.7,
                    topP: options?.topP || 0.9,
                    repeatPenalty: 1.1,
                    stopBefore: options?.stop || []
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-NCP-CLOVASTUDIO-API-KEY': this.apiKey
                    }
                }
            );
            
            return response.data.result.text;
        } catch (error) {
            console.error('CLOVA API 호출 중 오류:', error);
            throw new Error('CLOVA X 모델 응답 생성 중 오류가 발생했습니다.');
        }
    }
    
    estimateTokens(text: string): number {
        // 한글 토큰 추정 - 한글은 일반적으로 영어보다 토큰 소비가 많음
        const koreanChars = text.match(/[가-힣]/g)?.length || 0;
        const otherChars = text.length - koreanChars;
        
        // 한글은 문자당 약 1.5 토큰, 다른 문자는 0.25 토큰으로 대략 추정
        return Math.ceil((koreanChars * 1.5) + (otherChars * 0.25));
    }
    
    getMaxContextTokens(): number {
        return 8192; // CLOVA X 모델의 컨텍스트 크기
    }
}
```

### 4.2 한글 최적화 에이전트 템플릿

한국어 프로젝트에 특화된 에이전트 템플릿을 제공합니다:

```typescript
// templates/koreanAgentTemplates.ts
export const koreanAgentTemplates = {
    codeGeneration: {
        name: "코드 생성 에이전트",
        role: "developer",
        systemPrompt: `당신은 한국어 프로젝트에 특화된 코드 생성 전문가입니다.
다음 가이드라인을 따라 코드를 작성하세요:
1. 한국어 변수명과 주석을 적절히 사용하세요.
2. 코드의 각 부분을 명확히 설명하는 한국어 주석을 추가하세요.
3. 한국어 오류 메시지와 로그 메시지를 제공하세요.
4. 한국 개발 문화와 관행을 고려하세요.
5. 공식 한국어 API 문서와 레퍼런스를 활용하세요.`
    },
    codeReview: {
        name: "코드 리뷰 에이전트",
        role: "reviewer",
        systemPrompt: `당신은 한국어 코드를 전문적으로 리뷰하는 전문가입니다.
다음 기준으로 코드를 평가하세요:
1. 한국어 네이밍 컨벤션 적절성
2. 한국어 주석의 명확성과 유용성
3. 한국어 메시지와 텍스트의 자연스러움
4. 한국 개발 문화와 관행 준수
5. 국내 프레임워크 및 라이브러리 활용 적절성`
    },
    documentation: {
        name: "문서화 에이전트",
        role: "technical_writer",
        systemPrompt: `당신은 한국어 기술 문서 작성 전문가입니다.
다음 원칙에 따라 문서를 작성하세요:
1. 명확하고 간결한 한국어 표현 사용
2. 기술 용어의 적절한 번역 및 원어 병기
3. 한국 개발자에게 익숙한 예시와 레퍼런스 활용
4. 단계별 안내를 위한 명확한 구조화
5. 검색 최적화를 위한 키워드 활용`
    }
};
```

### 4.3 한글-영문 코드 전환 기능

한글 코드와 영문 코드 간의 전환을 지원하는 기능을 제공합니다:

```typescript
// utils/codeTranslator.ts
export class CodeTranslator {
    private translationModel: AIModel;
    
    constructor(model: AIModel) {
        this.translationModel = model;
    }
    
    async translateKoreanToEnglish(koreanCode: string): Promise<string> {
        const prompt = `다음 한국어 변수명과 주석이 포함된 코드를 영어로 번역하세요. 
변수명과 주석만 번역하고 코드 구조와 기능은 유지하세요.

한국어 코드:
\`\`\`
${koreanCode}
\`\`\``;

        return await this.translationModel.generateCompletion(prompt);
    }
    
    async translateEnglishToKorean(englishCode: string): Promise<string> {
        const prompt = `다음 영어 변수명과 주석이 포함된 코드를 한국어로 번역하세요.
변수명과 주석만 번역하고 코드 구조와 기능은 유지하세요.

영어 코드:
\`\`\`
${englishCode}
\`\`\``;

        return await this.translationModel.generateCompletion(prompt);
    }
}
```

## 5. AI 에이전트의 메타인지 기능

AI 에이전트가 자신의 성능을 모니터링하고 개선할 수 있는 메타인지 능력을 구현합니다.

### 5.1 자체 규칙 개선 시스템

에이전트가 자신의 성능을 분석하고 규칙을 개선하는 메커니즘:

```typescript
// ai/metacognition/selfImprovement.ts
export interface AgentMemory {
    successfulInteractions: Array<{
        prompt: string;
        response: string;
        feedback: string;
    }>;
    failedInteractions: Array<{
        prompt: string;
        response: string;
        feedback: string;
        errorType: string;
    }>;
    currentRules: string[];
    proposedRuleChanges: Array<{
        rule: string;
        reason: string;
        status: 'pending' | 'approved' | 'rejected';
    }>;
}

export class MetacognitionSystem {
    private agentMemory: AgentMemory;
    private metaAiModel: AIModel;
    
    constructor(model: AIModel) {
        this.metaAiModel = model;
        this.agentMemory = {
            successfulInteractions: [],
            failedInteractions: [],
            currentRules: [],
            proposedRuleChanges: []
        };
    }
    
    addInteraction(prompt: string, response: string, feedback: string, success: boolean, errorType?: string): void {
        if (success) {
            this.agentMemory.successfulInteractions.push({ prompt, response, feedback });
        } else {
            this.agentMemory.failedInteractions.push({ prompt, response, feedback, errorType: errorType || 'unknown' });
        }
        
        // 일정 수의 상호작용이 쌓이면 자체 분석 수행
        if (this.agentMemory.failedInteractions.length >= 5) {
            this.performSelfAnalysis();
        }
    }
    
    async performSelfAnalysis(): Promise<void> {
        // 최근 실패한 상호작용 패턴 분석
        const recentFailures = this.agentMemory.failedInteractions.slice(-5);
        
        const analysisPrompt = `다음은 AI 에이전트의 최근 실패한 상호작용입니다. 
이 실패 패턴을 분석하고, 에이전트의 성능을 향상시키기 위한 새로운 규칙이나 
기존 규칙의 수정 사항을 제안하세요.

${recentFailures.map((f, i) => `
실패 ${i+1}:
요청: ${f.prompt}
응답: ${f.response}
피드백: ${f.feedback}
오류 유형: ${f.errorType}
`).join('\n')}

현재 규칙:
${this.agentMemory.currentRules.map((r, i) => `${i+1}. ${r}`).join('\n')}

분석 및 제안:`;

        const analysis = await this.metaAiModel.generateCompletion(analysisPrompt);
        
        // 분석 결과에서 규칙 제안 추출
        this.extractRuleProposals(analysis);
    }
    
    private extractRuleProposals(analysis: string): void {
        // 분석 내용에서 새로운 규칙이나 수정 사항 추출 (간단한 구현)
        const ruleMatches = analysis.match(/제안 \d+: (.*?)(?=제안 \d+:|$)/gs);
        
        if (ruleMatches) {
            for (const match of ruleMatches) {
                const rule = match.replace(/제안 \d+: /, '').trim();
                const reason = "반복적인 실패 패턴에서 도출됨";
                
                this.agentMemory.proposedRuleChanges.push({
                    rule,
                    reason,
                    status: 'pending'
                });
            }
        }
    }
    
    // 개발자가 규칙 제안을 검토하고 승인하는 메서드
    approveRuleProposal(index: number): void {
        const proposal = this.agentMemory.proposedRuleChanges[index];
        if (proposal) {
            proposal.status = 'approved';
            this.agentMemory.currentRules.push(proposal.rule);
        }
    }
    
    // 규칙 제안 거부
    rejectRuleProposal(index: number): void {
        const proposal = this.agentMemory.proposedRuleChanges[index];
        if (proposal) {
            proposal.status = 'rejected';
        }
    }
    
    // 현재 규칙 업데이트
    getCurrentRules(): string[] {
        return this.agentMemory.currentRules;
    }
    
    // 보류 중인 규칙 제안 가져오기
    getPendingProposals(): Array<{rule: string, reason: string}> {
        return this.agentMemory.proposedRuleChanges
            .filter(p => p.status === 'pending')
            .map(p => ({rule: p.rule, reason: p.reason}));
    }
}
```

### 5.2 성능 모니터링 및 피드백 시스템

에이전트의 성능을 지속적으로 모니터링하고 개선하는 시스템:

```typescript
// ai/metacognition/performanceMonitor.ts
export interface PerformanceMetrics {
    successRate: number;
    averageResponseTime: number;
    taskCompletionRate: number;
    feedbackScores: number[];
    errorTypes: Map<string, number>;
}

export class PerformanceMonitor {
    private interactions: Array<{
        timestamp: number;
        prompt: string;
        response: string;
        responseTime: number;
        success: boolean;
        feedbackScore?: number;
        errorType?: string;
    }> = [];
    
    recordInteraction(
        prompt: string,
        response: string,
        responseTime: number,
        success: boolean,
        errorType?: string
    ): void {
        this.interactions.push({
            timestamp: Date.now(),
            prompt,
            response,
            responseTime,
            success,
            errorType
        });
    }
    
    addFeedback(interactionIndex: number, feedbackScore: number): void {
        if (this.interactions[interactionIndex]) {
            this.interactions[interactionIndex].feedbackScore = feedbackScore;
        }
    }
    
    getMetrics(timeframe?: { start: number; end: number }): PerformanceMetrics {
        let relevantInteractions = this.interactions;
        
        // 타임프레임이 지정된 경우 해당 기간의 데이터만 필터링
        if (timeframe) {
            relevantInteractions = this.interactions.filter(
                i => i.timestamp >= timeframe.start && i.timestamp <= timeframe.end
            );
        }
        
        // 성공률 계산
        const successCount = relevantInteractions.filter(i => i.success).length;
        const successRate = relevantInteractions.length > 0 
            ? successCount / relevantInteractions.length 
            : 0;
        
        // 평균 응답 시간 계산
        const totalResponseTime = relevantInteractions.reduce((sum, i) => sum + i.responseTime, 0);
        const averageResponseTime = relevantInteractions.length > 0 
            ? totalResponseTime / relevantInteractions.length 
            : 0;
        
        // 피드백 점수 수집
        const feedbackScores = relevantInteractions
            .filter(i => i.feedbackScore !== undefined)
            .map(i => i.feedbackScore as number);
        
        // 오류 유형 집계
        const errorTypes = new Map<string, number>();
        relevantInteractions
            .filter(i => i.errorType)
            .forEach(i => {
                const errorType = i.errorType as string;
                errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
            });
        
        // 작업 완료율 (피드백 점수가 있는 항목 중 성공한 항목 비율)
        const ratedInteractions = relevantInteractions.filter(i => i.feedbackScore !== undefined);
        const taskCompletionRate = ratedInteractions.length > 0 
            ? ratedInteractions.filter(i => i.success).length / ratedInteractions.length 
            : 0;
        
        return {
            successRate,
            averageResponseTime,
            taskCompletionRate,
            feedbackScores,
            errorTypes
        };
    }
    
    // 에이전트의 성능 보고서 생성
    generatePerformanceReport(): string {
        const metrics = this.getMetrics();
        
        return `
# AI 에이전트 성능 보고서

## 요약 지표
- 성공률: ${(metrics.successRate * 100).toFixed(2)}%
- 평균 응답 시간: ${metrics.averageResponseTime.toFixed(2)}ms
- 작업 완료율: ${(metrics.taskCompletionRate * 100).toFixed(2)}%
- 평균 피드백 점수: ${metrics.feedbackScores.length > 0 
    ? (metrics.feedbackScores.reduce((sum, score) => sum + score, 0) / metrics.feedbackScores.length).toFixed(2)
    : 'N/A'}

## 오류 유형 분석
${Array.from(metrics.errorTypes.entries())
    .map(([type, count]) => `- ${type}: ${count}회 (${(count / this.interactions.filter(i => !i.success).length * 100).toFixed(2)}%)`)
    .join('\n')}

## 추천 개선 사항
${this.generateImprovementSuggestions(metrics)}
`;
    }
    
    private generateImprovementSuggestions(metrics: PerformanceMetrics): string {
        const suggestions = [];
        
        // 성공률이 낮은 경우
        if (metrics.successRate < 0.7) {
            suggestions.push("시스템 프롬프트를 더 명확하게 개선하세요.");
        }
        
        // 응답 시간이 긴 경우
        if (metrics.averageResponseTime > 5000) {
            suggestions.push("AI 모델 파라미터를 최적화하여 응답 시간을 개선하세요.");
        }
        
        // 가장 빈번한 오류 유형에 대한 제안
        if (metrics.errorTypes.size > 0) {
            const mostCommonError = Array.from(metrics.errorTypes.entries())
                .sort((a, b) => b[1] - a[1])[0];
            
            suggestions.push(`가장 빈번한 오류 유형인 '${mostCommonError[0]}'에 대한 처리 로직을 개선하세요.`);
        }
        
        return suggestions.join('\n');
    }
}
```

### 5.3 메타인지 UI 컴포넌트

개발자가 AI 에이전트의 메타인지 기능을 관리할 수 있는 UI:

```typescript
// ui/metacognitionPanel.ts
import * as vscode from 'vscode';
import { MetacognitionSystem } from '../ai/metacognition/selfImprovement';
import { PerformanceMonitor } from '../ai/metacognition/performanceMonitor';

export class MetacognitionPanel {
    public static currentPanel: MetacognitionPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _metacognitionSystem: MetacognitionSystem;
    private _performanceMonitor: PerformanceMonitor;
    
    // 패널 생성 및 초기화
    public static createOrShow(
        extensionUri: vscode.Uri, 
        metacognitionSystem: MetacognitionSystem,
        performanceMonitor: PerformanceMonitor
    ): void {
        // 구현 생략...
    }
    
    // 메시지 처리
    private _handleMessage(message: any): void {
        switch (message.command) {
            case 'approveRule':
                this._metacognitionSystem.approveRuleProposal(message.index);
                this._updateWebview();
                break;
            case 'rejectRule':
                this._metacognitionSystem.rejectRuleProposal(message.index);
                this._updateWebview();
                break;
            case 'generateReport':
                const report = this._performanceMonitor.generatePerformanceReport();
                this._panel.webview.postMessage({ command: 'showReport', report });
                break;
            // 기타 명령 처리...
        }
    }
    
    // 웹뷰 업데이트
    private _updateWebview(): void {
        // 구현 생략...
    }
}
```

다음 문서에서는 RAG 지원 및 로컬 검색 기반 확장에 대해 설명하겠습니다. 