'use client'

import {useState} from 'react'
import {Bot,Loader2,Search,CheckCircle2,AlertCircle} from 'lucide-react'

type Result={
  ok?:boolean
  found?:number
  imported?:{
    id:string
    title:string
    author:string
    category:string
  }[]
  skipped?:{
    title:string
    reason:string
  }[]
  error?:string
}

export function AiLibrarian(){
  const [prompt,setPrompt]=useState('')
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<Result|null>(null)

  async function run(){
    if(!prompt.trim()||loading)return

    setLoading(true)
    setResult(null)

    try{
      const response=await fetch('/api/admin/ai-librarian',{
        method:'POST',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          prompt:prompt.trim()
        })
      })

      const data=await response.json()

      if(!response.ok){
        throw new Error(data.error||'AI Librarian failed')
      }

      setResult(data)
    }catch(error){
      setResult({
        error:error instanceof Error
          ?error.message
          :'AI Librarian failed'
      })
    }finally{
      setLoading(false)
    }
  }

  return (
    <section className="ai-librarian">
      <div className="ai-librarian-head">
        <div className="ai-librarian-icon">
          <Bot size={21}/>
        </div>

        <div>
          <span className="section-kicker">AI LIBRARIAN</span>
          <h2>Ask G.I to build your bookshelf.</h2>
          <p>
            Describe what books you want. G.I will research legitimate
            free sources, check duplicates, and add candidates as drafts.
          </p>
        </div>
      </div>

      <div className="ai-librarian-box">
        <textarea
          value={prompt}
          onChange={e=>setPrompt(e.target.value)}
          placeholder="ဥပမာ — နည်းပညာစာအုပ် ၁၀ အုပ်ရှာပြီး တရားဝင် free source တွေကို Bookshelf ထဲထည့်ပါ"
          rows={4}
          disabled={loading}
        />

        <div className="ai-librarian-actions">
          <span>
            {loading
              ? 'G.I is researching the web…'
              : 'Books are added as drafts for review.'}
          </span>

          <button
            className="btn-primary"
            onClick={run}
            disabled={!prompt.trim()||loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin"/>
                Researching…
              </>
            ) : (
              <>
                <Search size={16}/>
                Find & Add
              </>
            )}
          </button>
        </div>
      </div>

      {result?.error&&(
        <div className="ai-result ai-error">
          <AlertCircle size={18}/>
          <div>
            <b>AI Librarian failed</b>
            <p>{result.error}</p>
          </div>
        </div>
      )}

      {result?.ok&&(
        <div className="ai-result">
          <div className="ai-result-summary">
            <CheckCircle2 size={18}/>
            <div>
              <b>Research completed</b>
              <p>
                Found {result.found||0} candidate
                {(result.found||0)===1?'':'s'}.
                {' '}
                Added {result.imported?.length||0} book
                {(result.imported?.length||0)===1?'':'s'} as drafts.
              </p>
            </div>
          </div>

          {!!result.imported?.length&&(
            <div className="ai-result-list">
              {result.imported.map(book=>(
                <div key={book.id} className="ai-result-row">
                  <div>
                    <b>{book.title}</b>
                    <small>
                      {book.author} · {book.category}
                    </small>
                  </div>
                  <span>Draft</span>
                </div>
              ))}
            </div>
          )}

          {!!result.skipped?.length&&(
            <details className="ai-skipped">
              <summary>
                {result.skipped.length} skipped
              </summary>

              {result.skipped.map((book,index)=>(
                <div key={`${book.title}-${index}`}>
                  <b>{book.title}</b>
                  <small>{book.reason}</small>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  )
}
