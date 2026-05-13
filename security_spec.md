# Security Specification: AI智慧批改助手

## Data Invariants
1. 老師只能管理自己建立的考卷。
2. 題目必須隸屬於存在的考卷。
3. 學生作答在送出後，除了後端批改程序外，學生不可修改。
4. 批改結果必須與學生作答綁定。

## The Dirty Dozen Payloads (Target: Permission Denied)

1. **Identity Spoofing**: 一個老師嘗試修改另一個老師的考卷 (`exams/otherTeacherExamId`).
2. **Identity Spoofing**: 一個學生嘗試修改他人的作答記錄 (`submissions/otherStudentSubId`).
3. **Identity Spoofing**: 未登入者嘗試建立考卷。
4. **Identity Spoofing**: 未登入者嘗試讀取考卷內容。
5. **State Shortcutting**: 學生直接將作答狀態從 `pending` 改為 `graded` 並自給分數。
6. **State Shortcutting**: 學生直接寫入 `results` (由 AI 或老師產出的結果)。
7. **Resource Poisoning**: 在 `examId` 中注入 2MB 的字串。
8. **Resource Poisoning**: 在 `rubrics` 中注入 500 個項目意圖造成處理成本上升。
9. **Update Gap**: 修改 `exam` 時嘗試移除 `teacherId` 以使其變成孤兒或所有人可修改。
10. **Query Scraping**: 未登入者嘗試 list 所有 `exams`。
11. **Update Gap**: 惡意使用者在大考進行中修改別人的考卷標題。
12. **PII Leak**: 一個學生嘗試讀取其他學生的 `submissions` 明細。

## Test Runner (Drafted separately in firestore.rules.test.ts)
We will enforce these through rigorous rules.
