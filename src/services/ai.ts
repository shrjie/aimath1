import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq';

let currentApiKey = localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || '';
let groqApiKey = localStorage.getItem('groq_api_key') || '';
let currentProvider: AIProvider = (localStorage.getItem('ai_provider') as AIProvider) || 'groq';

let ai = new GoogleGenAI({ apiKey: currentApiKey });
let groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });

export function setApiKey(key: string, provider: AIProvider = 'gemini') {
  if (provider === 'gemini') {
    currentApiKey = key;
    localStorage.setItem('gemini_api_key', key);
    ai = new GoogleGenAI({ apiKey: key });
  } else {
    groqApiKey = key;
    localStorage.setItem('groq_api_key', key);
    groq = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
  }
}

export function setProvider(provider: AIProvider) {
  currentProvider = provider;
  localStorage.setItem('ai_provider', provider);
}

export function getProvider() {
  return currentProvider;
}

export function getApiKeys() {
  return {
    gemini: currentApiKey,
    groq: groqApiKey
  };
}

export async function testConnection(provider: AIProvider = currentProvider): Promise<{ success: boolean; message: string }> {
  const keys = getApiKeys();
  if (provider === 'gemini' && !keys.gemini) return { success: false, message: "尚未設定 Gemini API Key" };
  if (provider === 'groq' && !keys.groq) return { success: false, message: "尚未設定 Groq API Key" };

  try {
    if (provider === 'gemini') {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "hi",
        config: { maxOutputTokens: 5 }
      });
      return response.text ? { success: true, message: "Gemini 連線成功！" } : { success: false, message: "連線異常" };
    } else {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: "hi" }],
        model: "llama-3.1-8b-instant",
        max_tokens: 5
      });
      return chatCompletion.choices[0] ? { success: true, message: "Groq 連線成功！" } : { success: false, message: "連線異常" };
    }
  } catch (err: any) {
    return { success: false, message: `連線失敗：${err.message || '未知錯誤'}` };
  }
}

export interface GradingRubric {
  desc: string;
  points: number;
}

export interface QuestionData {
  id?: string;
  content: string;
  points: number;
  rubrics: GradingRubric[];
  standardAnswer: string;
  commonErrors: string[];
}

export interface GradingItemResult {
  rubricDesc: string;
  score: number;
  feedback: string;
}

export interface GradingAnalysis {
  questionId?: string;
  items: GradingItemResult[];
  totalScore: number;
  genericFeedback: string;
  errorTypes: string[];
}

export async function recognizeHandwriting(base64Data: string, mimeType: string = "image/jpeg"): Promise<string> {
  const provider = getProvider();
  const keys = getApiKeys();

  // If using Groq or if Gemini key is missing but Groq is available
  if (provider === 'groq' || (!keys.gemini && keys.groq)) {
    if (!keys.groq) throw new Error("尚未設定 Groq API Key");
    
    try {
      const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const response = await groq.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "這是學生的作答內容，請精確辨識其中的文字內容與運算過程。只需輸出辨識出的文字內容。如果辨識不出任何內容，請回覆「[無法辨識]」。" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Content}` } }
            ]
          }
        ]
      });
      return response.choices[0]?.message?.content || "";
    } catch (err: any) {
      console.error("Groq OCR Error:", err);
      // Fallback to Gemini if Groq fails and Gemini key exists
      if (!keys.gemini) throw new Error(`辨識失敗 (Groq): ${err.message}`);
    }
  }

  // Gemini Fallback / Primary
  if (!keys.gemini) {
    throw new Error("尚未設定 API Key，辨識功能需要 Gemini 或 Groq (Vision) 授權。");
  }
  try {
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          { text: "這是學生的作答內容，請精確辨識其中的文字內容與運算過程。只需輸出辨識出的文字內容。如果辨識不出任何內容，請回覆「[無法辨識]」。" },
          { inlineData: { data: base64Content, mimeType: mimeType } }
        ]
      }]
    });
    return response.text || "";
  } catch (err: any) {
    throw new Error(`辨識失敗：${err.message || '請檢查 API 設定'}`);
  }
}

export async function gradeBatch(
  questions: QuestionData[],
  studentAnswers: { questionId: string; answer: string }[]
): Promise<GradingAnalysis[]> {
  const provider = getProvider();
  const keys = getApiKeys();

  if (provider === 'gemini' && !keys.gemini) throw new Error("尚未設定 Gemini API Key");
  if (provider === 'groq' && !keys.groq) throw new Error("尚未設定 Groq API Key");

  const prompt = `
你是一位專業的老師。請針對以下多個題目，批改學生的答案。
對於每個題目，請根據提供的評分準則 (Rubrics) 給分，並提供詳細的分析回饋。

### 要求：
1. **輸出格式**：必須輸出一個 JSON 陣列 (Array)，每個元素代表一題的批改結果。不需要包裝在 rootkey 中。
2. **ID 匹配**：每個結果的 "questionId" 必須完全符合我提供的 UUID。
3. **給分邏輯**：嚴格遵守評分準則。如果學生部分答對，請按比例給分。
4. **分析回饋**：請針對學生的錯誤提供建設性的「分析」，而不僅僅是標準答案。使用繁體中文。

【題目與答案列表】
${questions.map((q, idx) => {
  const studentAns = studentAnswers.find(a => a.questionId === q.id)?.answer || "未作答";
  return `
--- 題目 ${idx + 1} (UUID: ${q.id}) ---
內容：${q.content}
標準答案：${q.standardAnswer}
總分：${q.points}
評分準則：${q.rubrics.map(r => `${r.desc} (${r.points}分)`).join('; ')}
學生作答：${studentAns}
`;
}).join('\n')}

回覆格式 (JSON Array):
[
  {
    "questionId": "UUID",
    "items": [
      { "rubricDesc": "準則描述", "score": 分數, "feedback": "針對該準則的具體分析" }
    ],
    "totalScore": 該題得分,
    "genericFeedback": "整題綜合分析與指導建議",
    "errorTypes": ["錯誤類型1", "錯誤類型2"]
  }
]
`;

  try {
    if (provider === 'gemini') {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionId: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      rubricDesc: { type: Type.STRING },
                      score: { type: Type.NUMBER },
                      feedback: { type: Type.STRING }
                    },
                    required: ["rubricDesc", "score", "feedback"]
                  }
                },
                totalScore: { type: Type.NUMBER },
                genericFeedback: { type: Type.STRING },
                errorTypes: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["questionId", "items", "totalScore", "genericFeedback", "errorTypes"]
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } else {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a professional teacher grading exams. Always output a JSON array of grading results." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      const content = completion.choices[0]?.message?.content || "[]";
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : (parsed.results || parsed.grading || []);
    }
  } catch (err: any) {
    console.error(`${provider} batch grading error:`, err);
    throw new Error(`批改過程故障 (${provider}): ${err.message}`);
  }
}

export async function gradeAnswer(
  question: QuestionData,
  studentAnswer: string
): Promise<GradingAnalysis> {
  const results = await gradeBatch([question], [{ questionId: question.id || 'q1', answer: studentAnswer }]);
  return results[0];
}
