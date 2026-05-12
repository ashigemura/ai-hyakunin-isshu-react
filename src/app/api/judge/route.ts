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
・やさしい口調
・短く読みやすく説明する
・JSON形式で返す
・断定しすぎない
・知らない情報を無理に創作しない

【ジャンル】
ジャンルごとの雰囲気を感じられるように説明する
・恋：感情や切なさを中心に説明
・春夏秋冬：季節の情景を中心に説明
・羇旅：旅の寂しさや孤独感を説明
・雑：人生観や心情をやさしく説明

【必ず含める】
① 正解/不正解へのリアクション
② 現代語訳
③ 歌の雰囲気（ジャンルを参考にやさしく説明）
④ ポイント（覚えやすい特徴を短く）

【重要】
・平安時代の文化や情緒を感じられるようにすること

【出力ルール】
・必ずJSONで出力する。余計な文章は禁止。
・comment は必ず単一の文字列（string）で返す
・配列は禁止
・オブジェクトは禁止
・文章の先頭に「,」を付けない
・不要なカンマを入れない
・箇条書きの先頭に「,」を付けない
・以下の見出しを必ず使う
・読みやすく改行する


■ 現代語訳
■ 歌の雰囲気
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
      poem,
    selectedPoem,
    isCorrect,
    } = await req.json()


    // AIへ送るデータを成形
    // * AIのハルシネーション対策
    //   作者名・現代語訳などの事実データはSupabaseで管理し、AIは補助説明のみにする
    const prompt = `

【正解の歌】
・歌番号：第${poem.no}首
・上の句：${poem.kami_no_ku}
・下の句：${poem.shimo_no_ku}
・作者：${poem.author}
・ジャンル：${poem.genre}
・現代語訳：${poem.modern_translation}

${!isCorrect ? `
  【ユーザーが選んだ歌】
  ・歌番号：第${selectedPoem.no}首
  ・上の句：${selectedPoem.kami_no_ku}
  ・下の句：${selectedPoem.shimo_no_ku}
  ・作者：${selectedPoem.author}
  ・ジャンル：${selectedPoem.genre}
  ・現代語訳：${selectedPoem.modern_translation}
` : ''}

【判定】
${isCorrect ? '正解' : '不正解'}

【重要ルール】
・現代語訳を変更しない
・作者を創作しない
・事実を創作しない
・不正解の場合は「どこが似ていたか」を説明する

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

    // AIが付ける ```json を除去してからJSON抽出
    const cleanedText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)

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