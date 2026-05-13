import Groq from "groq-sdk";

let currentApiKey = process.env.GROQ_API_KEY || localStorage.getItem('groq_api_key') || '';

let groq = new Groq({
  apiKey: currentApiKey,
  dangerouslyAllowBrowser: true 
});

export function setApiKey(key: string) {
  currentApiKey = key;
  localStorage.setItem('groq_api_key', key);
  groq = new Groq({
    apiKey: key,
    dangerouslyAllowBrowser: true
  });
}

export function getApiKey() {
  return currentApiKey;
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  if (!currentApiKey) {
    return { success: false, message: "尚未設定 API Key" };
  }
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5
    });
    if (response.choices && response.choices.length > 0) {
      return { success: true, message: "連線成功！" };
    }
    return { success: false, message: "連線異常：未收到回應內容" };
  } catch (err: any) {
    console.error("Connection test failed:", err);
    return { success: false, message: `連線失敗：${err.message || '未知錯誤'}` };
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
  try {
    // We need to ensure the base64 is just the data part
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    const response = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-instant",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "這是學生的作答內容，請精確辨識其中的文字內容與運算過程。只需輸出辨識出的文字內容。如果辨識不出任何內容，請回覆「[無法辨識]」。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Content}`
              }
            }
          ]
        }
      ]
    });

    const text = response.choices[0]?.message?.content || "";
    console.log("Groq OCR Result:", text);
    return text;
  } catch (err: any) {
    console.error("Groq OCR Error:", err);
    if (err.status === 401 || err.status === 403) {
      throw new Error(`辨識失敗：Groq API 身份驗證失敗。\n\n請在右側選單的「Settings > Secrets」中，設定有效的「GROQ_API_KEY」。`);
    }
    throw new Error(`辨識失敗：Groq 辨識發生錯誤: ${err.message || '請檢查網路連線或 API 設定'}`);
  }
}

export async function gradeAnswer(
  question: QuestionData,
  studentAnswer: string
): Promise<GradingAnalysis> {
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
最後將結果以 JSON 格式輸出，結構包含：
{
  "items": [{ "rubricDesc": string, "score": number, "feedback": string }],
  "totalScore": number,
  "genericFeedback": string,
  "errorTypes": string[]
}
輸出必須只包含 JSON 本身，不要有其他描述。
  `;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text);
    return result as GradingAnalysis;
  } catch (err: any) {
    console.error("Groq Grading Error:", err);
    if (err.status === 401 || err.status === 403) {
      throw new Error(`批改失敗：Groq API 身份驗證失敗。\n\n請在右側選單的「Settings > Secrets」中，設定有效的「GROQ_API_KEY」。`);
    }
    throw new Error(`批改失敗：Groq 批改發生錯誤: ${err.message || '請再試一次'}`);
  }
}
