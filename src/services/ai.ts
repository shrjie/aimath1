import { GoogleGenAI, Type } from "@google/genai";

let currentApiKey = localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || '';

let ai = new GoogleGenAI({ apiKey: currentApiKey });

export function setApiKey(key: string) {
  currentApiKey = key;
  localStorage.setItem('gemini_api_key', key);
  ai = new GoogleGenAI({ apiKey: key });
}

export function getApiKey() {
  return currentApiKey;
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  if (!currentApiKey) {
    return { success: false, message: "尚未設定 API Key" };
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "hi",
      config: { maxOutputTokens: 5 }
    });
    if (response.text) {
      return { success: true, message: "Gemini 連線成功！" };
    }
    return { success: false, message: "連線異常：未收到回應內容" };
  } catch (err: any) {
    console.error("Gemini connection test failed:", err);
    return { success: false, message: `Gemini 連線失敗：${err.message || '未知錯誤'}` };
  }
}

export interface GradingRubric {
  desc: string;
  points: number;
}

export interface QuestionData {
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
  items: GradingItemResult[];
  totalScore: number;
  genericFeedback: string;
  errorTypes: string[];
}

export async function recognizeHandwriting(base64Data: string, mimeType: string = "image/jpeg"): Promise<string> {
  if (!currentApiKey) {
    throw new Error("尚未設定 Gemini API Key，請前往設定頁面輸入。");
  }
  try {
    // We need to ensure the base64 is just the data part
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    console.log("Calling Gemini OCR with model: gemini-3-flash-preview");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: "這是學生的作答內容，請精確辨識其中的文字內容與運算過程。只需輸出辨識出的文字內容。如果辨識不出任何內容，請回覆「[無法辨識]」。"
            },
            {
              inlineData: {
                data: base64Content,
                mimeType: mimeType
              }
            }
          ]
        }
      ]
    });

    const text = response.text || "";
    console.log("Gemini OCR Result:", text);
    return text;
  } catch (err: any) {
    console.error("Gemini OCR Error:", err);
    throw new Error(`辨識失敗：Gemini 辨識發生錯誤: ${err.message || '請檢查網路連線或 API 設定'}`);
  }
}

export async function gradeAnswer(
  question: QuestionData,
  studentAnswer: string
): Promise<GradingAnalysis> {
  if (!currentApiKey) {
    throw new Error("尚未設定 Gemini API Key，請前往設定頁面輸入。");
  }
  const prompt = `
你是一位專業的老師。請根據以下評分準則與標準答案，批改學生的答案。

【題目內容】
${question.content}

【標準答案】
${question.standardAnswer}

【評分準則 (Rubrics)】
${question.rubrics.map((r, i) => `${i + 1}. ${r.desc} (${r.points}分)`).join('\n')}

【常見錯誤類型參考】
${question.commonErrors.join(', ')}

【學生答案】
${studentAnswer}

請嚴格對照各評分準則給分，並針對扣分原因提供具體回饋文字。
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
            errorTypes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["items", "totalScore", "genericFeedback", "errorTypes"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    return result as GradingAnalysis;
  } catch (err: any) {
    console.error("Gemini Grading Error:", err);
    throw new Error(`批改失敗：Gemini 批改發生錯誤: ${err.message || '請再試一次'}`);
  }
}
