import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Gemini API初期化
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

// AIの人格, ルール設定
const SYSTEM_PROMPT = `
あなたは百人一首の「やさしくて的確な先生」です。

【目的】
生徒が次に正解できるように導くこと。

【ルール】
・「番目」「番」といった、選択した番号に関する記述は一切使用しない
・やさしい口調
・否定しないが、曖昧にしない
・短く区切って読みやすくする

【必ず含める】
① 正解/不正解へのリアクション
② 現代語訳（短く）
③ 歌の背景や情報（短く）
④ 掛詞や縁語の説明（短く）

【重要】
・平安時代の文化や情緒を感じられるようにすること

【出力ルール】
・必ずJSONで出力する。余計な文章は禁止。
・comment は必ず単一の文字列(string)で返す
・配列は禁止
・オブジェクトは禁止
・文章の先頭に「,」を付けない
・不要なカンマを入れない
・箇条書きの先頭に「,」を付けない
・以下の見出しを必ず使う
・読みやすく改行する

■ 現代語訳
■ 歌の背景
■ ポイント

例：
{
  "comment": "正解です！\n\n■ 現代語訳\n..."
}
`


export async function POST(req: NextRequest) {
  try {

// ***** Dev表示用ダミー解説 *****
//       if (process.env.NODE_ENV === 'development') {
//           return NextResponse.json({
//               comment: `
// Dev表示用ダミー解説：
// ・この歌は季節の移り変わりを表しています
// ・覚え方：「白＝夏」で覚えると楽です
// ・似た歌と混同しやすいので注意！
//         `.trim()
//           })
//       }

// ***** ↓↓↓ ここから下は本番 ↓↓↓ *****


    const {
      kamiNoKu,
      shimoNoku,
      choices,
      selectedIndex,
      correctIndex,
    } = await req.json()

    // サーバー側でも正誤判定を行うことで、AI生成前に正誤を把握できるようにする
    const isCorrect = selectedIndex === correctIndex

    // AIへ送るデータを成形
    const prompt = `
【上の句】
${kamiNoKu}

【正解（下の句）】
${shimoNoku}

【選択肢】
${choices.map((c: string, i: number) => `${i}: ${c}`).join('\n')}

【ユーザーの選択】
${selectedIndex}

【正解の番号】
${correctIndex}

【判定】
${isCorrect ? '正解' : '不正解'}

この情報をもとに、やさしくて記憶に残る解説をしてください。
`
    // Gemini実行
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    })

    if (!result.text) {
      throw new Error('AIレスポンスが空です')
    }

    const text = result.text

    // JSON抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    // AIの返答からJSON形式を取り出せなかった場合
    if (!jsonMatch) {
      throw new Error('AIレスポンスにJSON形式が含まれていません')
    }

    // 文字列JSONをオブジェクト化
    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.comment) {
      throw new Error('commentが存在しません')
    }

    // AI解析結果を返す
    return NextResponse.json(parsed)

  } catch (error: unknown ) {
    // 外部APIがエラーを返してきた場合、情報をログに残す
    console.error('[API Error]', error);

    // errorがオブジェクトでstatusがあれば使う、なければ500）
    const statusCode = (error && typeof error === 'object' && 'status' in error)
      ? (error as { status: number }).status
      : 500;

    return NextResponse.json(
      { comment: '解説の生成に失敗しました。' },
      { status: statusCode }
    );
  
  }
}