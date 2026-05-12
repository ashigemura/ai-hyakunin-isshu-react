'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// 型定義
type Poem = {
  id: string;
  no: number;
  kami_no_ku: string;
  kami_hiragana: string;
  shimo_no_ku: string;
  shimo_hiragana: string;
  author: string;
  genre: string;
  modern_translation: string;

};

// コンポーネント開始
export default function Home() {
  // useStateをpoemオブジェクトにまとめる
  const [currentPoem, setCurrentPoem] = useState<Poem | null>(null)

  // 選択肢管理
  const [choices, setChoices] = useState<string[]>([])
  // 正解の位置
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  // ユーザーが選択した位置
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // AI解説含む結果文
  const [result, setResult] = useState('')
  // 答えが表示済みかどうか
  const [showCorrect, setShowCorrect] = useState(false)
  // Supabase初回取得中
  const [initialLoading, setInitialLoading] = useState(true)
  // AI通信中
  const [loading, setLoading] = useState(false)
  // Supabaseから取得した全歌データ
  const [allPoems, setAllPoems] = useState<Poem[]>([])

  // 選択肢4つを作る関数
  // correct：正解の下の句, all：全歌データ
  const generateChoices = (correct: string, all: Poem[]) => {
    const others = all
      .filter(p => p.shimo_no_ku !== correct) //正解以外だけ残す
      .sort(() => 0.5 - Math.random())
      .slice(0, 3) // 先頭3件のみ取得

    // 正解+不正解3つをまとめた後、さらにランダムに並べ替える
    const newChoices = [correct, ...others.map(p => p.shimo_no_ku)]
    .sort(() => 0.5 - Math.random())
    // 正解の位置を見つける
    const correctIdx = newChoices.findIndex(c => c === correct)
   
    setCorrectIndex(correctIdx)
    setChoices(newChoices)
  }

  // 歌データ反映関数
  const applyPoemToState = (poem: Poem, allData: Poem[]) => {
    setCurrentPoem(poem)
    generateChoices(poem.shimo_no_ku, allData) // 4択生成
    setSelectedIndex(null)                     // 選択状態のリセット
    setShowCorrect(false)                      // 答え表示状態のリセット
    setResult('')                              // 前回のAI解説を削除
  }

  // ランダムな歌を取得する関数
  const getRandomPoem = (poems: Poem[]) => {
    return poems[Math.floor(Math.random() * poems.length)]
  }

  //データの取得
  useEffect(() => {

    const fetchAllPoems = async () => {
      // Supabaseから結果を受け取る
      // SELECT * FROM poems ORDER BY no ASC
      const { data, error } = await supabase
        .from('poems')
        .select('*')
        .order('no', { ascending: true })

      if (error) {
        console.error(error)
        setInitialLoading(false)
        return
      }

      if (data && data.length > 0) {
        // 全歌データを保存
        setAllPoems(data)
        
        // データからランダムに1首選択
        const firstPoem = getRandomPoem(data)
        // ランダムな歌を画面へ反映
        applyPoemToState(firstPoem, data)
      }
      // 初回ロード完了
      setInitialLoading(false)
    }

    fetchAllPoems()

    // 初回実行時の警告を意図的に無視
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 「正解を確認する」押下時処理
  const handleSubmit = async () => {

    // 各種終了条件（通信中,答え表示済み,未選択,正解未設定）
    if (loading || showCorrect || selectedIndex === null || correctIndex === null) return

    // 正解判定：選択位置と正解位置比較
    const isCorrect = selectedIndex === correctIndex

    // ユーザーが選択した下の句
    const selectedShimo = choices[selectedIndex]

    // 選択した歌データ取得
    const selectedPoem = allPoems.find(
      p => p.shimo_no_ku === selectedShimo
    )

    //エラー回避
    if (!selectedPoem || !currentPoem) {
      setResult('データ取得エラー')
      return
    }

    setResult(isCorrect ? '正解 🌸' : '不正解')

    // 答え表示ON
    setShowCorrect(true)
    // AI解説生成開始
    setLoading(true)

    try {
      // API通信
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          poem: currentPoem,
          selectedPoem,
          isCorrect,
         }),
      });

      // APIの上限に達した(429エラー)場合
      if (res.status === 429) {
        setResult(prev => prev + '\n\n現在アクセスが集中しています。1分後にお試しください。');
        setLoading(false); // 通信終了
        return;
      }
      // 429以外のエラー
      if (!res.ok) {
        throw new Error('Server Error');
      }
      // 正常時：API戻り値JSON取得
      const data = await res.json();
      setResult(prev => prev + '\n\n' + data.comment);

    } catch {
      // その他エラー
      setResult(prev => prev + '\n\n※解説の取得に失敗しました。通信環境をご確認ください。')
    }

    setLoading(false) // 通信終了
  }

  // 「次の歌へ」ボタン処理
  const handleNext = () => {
    if (allPoems.length > 0) {
      const nextPoem = getRandomPoem(allPoems)
      applyPoemToState(nextPoem, allPoems)
    }
  }

  // 初回ロード中表示
  if (initialLoading) {
    return (
      <main className="min-h-screen bg-[#f8f5f0] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <p className="text-2xl text-[#8c826e] mb-4 font-serif tracking-widest">
            百人一首を読み込み中…
          </p>

          <p className="text-sm text-[#b3a58e] font-sans">
            和歌を準備しています
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f5f0] text-[#4a4636] font-serif flex flex-col items-center px-6 py-6 md:px-20 md:py-10">
      <header className="mb-12 text-center">
        {/* 画面タイトル */}
        <h1 className="text-3xl md:text-[2.6rem] font-bold tracking-[0.2em] border-b border-[#d4c5af] pb-3 inline-block">
          百人一首 学習アプリ
        </h1>
      </header>

      {/* 外側レイアウト（左問題 + 右解説） flex-col 縦並び, xl:flex-row XL画面以上で横並び */}
      <div className="w-full max-w-7xl flex flex-col xl:flex-row gap-12 items-start justify-center">

        {/* 左：問題カード */}
        <div className="bg-white border border-[#e2dcd0] rounded-sm p-6 md:py-8 md:px-16 w-full xl:w-3/5 relative shadow-sm transition-all">
          <div className="mb-5 text-center">
            <span className="text-sm md:text-base tracking-widest text-[#b3a58e] block mb-2 italic">
              ― 第 {currentPoem?.no ?? '...'} 首 ―</span>
            <p className="text-2xl md:text-[2.1rem] font-medium leading-relaxed md:whitespace-nowrap">
              {currentPoem?.kami_no_ku}
            </p>
            <p className="text-sm md:text-base text-[#a39c8d] font-sans tracking-wide">
              {currentPoem?.kami_hiragana}
            </p>
          </div>

          {/* 選択肢 choices配列 */}
          <div className="grid gap-2 mb-8 max-w-2xl mx-auto">
            {choices.map((choice, index) => {
              // 選択肢のボタン スタイル初期値
              let style = 'bg-white border-[#e2dcd0] hover:border-[#8c826e] hover:bg-[#faf9f6]'
              // 答え表示後
              if (showCorrect) {
                // 正解＝緑, 不正解＝赤
                if (index === correctIndex) {
                  style = 'bg-[#f1f7ed] border-[#8da67d] text-[#4a5d3e]'
                } else if (index === selectedIndex) {
                  style = 'bg-[#fcf2f2] border-[#c08e8e] text-[#7a4141]'
                }
              // 選択中（答え表示前）
              } else if (selectedIndex === index) {
                style = 'bg-[#f4f1eb] border-[#8c826e]'
              }

              return (
                // 選択肢のボタン
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)} //番号保存
                  disabled={showCorrect} //答え表示後は選択不可
                  className={`p-3 md:px-6 rounded-sm border-b-2 border-l transition-all duration-300 text-left ${style}`}
                >
                  {/* 選択肢の文字（下の句） */}
                  <span className="text-lg md:text-xl leading-relaxed">{choice}</span>
                </button>
              )
            })}
          </div>

          {/* 「正解を確認する」ボタン */}
          {/* 押下不可条件（通信中,答え表示済み,未選択） */}
          {/* disabled:cursor-not-allowed 禁止カーソル */}
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSubmit}
              disabled={loading || showCorrect || selectedIndex === null}
              className="w-full bg-[#5d5a4a] hover:bg-[#454338] text-[#f8f5f0] text-lg py-4 rounded-sm transition-colors disabled:bg-[#d1ccc0] disabled:cursor-not-allowed font-sans tracking-widest"
            >
              {loading ? 'AI解説生成中…' : '正解を確認する'}
            </button>

            {/* showCorrectがtrueの時だけ「次の歌へ」ボタンを表示 */}
            {showCorrect && (
              <button
                onClick={handleNext}
                disabled={loading}
                className="mt-8 w-full border border-[#5d5a4a] text-[#5d5a4a] hover:bg-[#5d5a4a] hover:text-white py-4 rounded-sm transition-all font-sans tracking-widest animate-fade-in disabled:bg-[#d1ccc0] disabled:text-[#8f8a7d] disabled:border-[#d1ccc0] disabled:cursor-not-allowed"
              >
                次の歌へ
              </button>
            )}
          </div>
        </div>

        {/* 右：AI解説の栞 */}
        <div className="bg-[#fdfcf9] border border-[#e2dcd0] rounded-sm p-10 md:p-12 w-full xl:w-2/5 shadow-sm flex flex-col transition-all h-128 md:h-160">
          <h2 className="text-xl font-bold mb-6 flex items-center text-[#5d5a4a] tracking-widest">
            <span className="w-10 border-t border-[#5d5a4a] mr-3"></span>
            AI解説の栞
          </h2>

          {/* 縦スクロールエリア flex-1 overflow-y-auto */}
          <div className="flex-1 overflow-y-auto pr-4 leading-loose text-[#555040] 
                  scrollbar-thin scrollbar-thumb-[#d4c5af] scrollbar-track-transparent">

            {/* 結果が返ってきた時 */}
            {result ? (
              <div className="animate-fade-in">
                {/* 判定結果表示 */}
                <p className="text-xl md:text-2xl font-bold mb-3 text-[#5d5a4a] pb-4">
                  {result.split('\n\n')[0]}
                </p>
                {/* 正解の下の句セクション */}
                <div className="bg-[#fcfaf5] p-6 border-l-4 border-[#8c826e] mb-8 shadow-inner">
                  <p className="text-[#7a6e55] text-xs md:text-sm mb-2 font-sans tracking-widest uppercase italic">【 下の句 】</p>
                  <p className="text-xl md:text-2xl leading-relaxed font-medium">{currentPoem?.shimo_no_ku}</p>
                  <p className="text-xs md:text-sm text-[#a39c8d] mt-2 font-sans tracking-wider">{currentPoem?.shimo_hiragana}</p>
                </div>
                {/* AI解説文 slice(1)1番目以降の解説部分だけ取得 */}
                {/* 改行保持:whitespace-pre-wrap */}
                <p className="whitespace-pre-wrap text-lg font-sans leading-8 text-[#5d5a4a]">
                  {result.split('\n\n').slice(1).join('\n\n')}
                </p>
              </div>

            ) : (
              // 初期メッセージ表示
              <div className="py-20 text-center text-[#b3a58e]">
                <p className="font-sans italic tracking-wider">左側から札を選んでください</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-center text-[#a39c8d] font-sans leading-relaxed">
        ※ AIの回答は必ずしも正しいとは限りません。情報は確認するようにしてください。
      </p>

      {/* 歌の一覧 */}
      <footer className="w-full max-w-7xl mt-40 mb-20">
        <div className="flex items-center gap-4 mb-8">
          <span className="border-t flex-1 border-[#e2dcd0]"></span>
          <h2 className="text-sm font-bold font-sans text-[#8c826e] tracking-widest uppercase">
            歌の一覧　(※Supabase PostgreSQLからリアルタイム取得)
          </h2>
          <span className="border-t flex-1 border-[#e2dcd0]"></span>
        </div>

        <div className="bg-white border border-[#e2dcd0] rounded-sm overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-[#eeebe5]">
            <thead className="bg-[#faf9f6]">
              <tr>
                {/* mapでthヘッダ生成 */}
                {['No', '上の句', '下の句', '作者'].map((h) => (
                  <th key={h} className="px-8 py-5 text-left text-xs font-semibold text-[#a39c8d] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            {/* 表本体 */}
            <tbody className="divide-y divide-[#eeebe5]">
              {allPoems.map((poem) => (
                <tr key={poem.id} className="hover:bg-[#fcfaf5] transition-colors">
                  <td className="px-8 py-5 text-sm text-[#b3a58e]">{poem.no}</td>
                  <td className="px-8 py-5 text-sm md:text-base font-medium">{poem.kami_no_ku}</td>
                  <td className="px-8 py-5 text-sm md:text-base">{poem.shimo_no_ku}</td>
                  <td className="px-8 py-5 text-sm text-[#8c826e]">{poem.author || '読み人知らず'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </footer>
    </main>
  )
}