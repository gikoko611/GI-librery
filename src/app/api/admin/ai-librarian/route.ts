import {NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'
import Groq from 'groq-sdk'
import {z} from 'zod'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'

export const dynamic='force-dynamic'

const RequestSchema=z.object({
  prompt:z.string().min(3).max(4000)
})

const BookSchema=z.object({
  title:z.string().min(1).max(200),
  author:z.string().min(1).max(150),
  description:z.string().max(500).default(''),
  category:z.string().min(1).max(100),
  language:z.string().max(60).default('English'),
  cover_url:z.string().max(2000).default(''),
  pdf_url:z.string().max(2000).default(''),
  page_count:z.number().int().min(0).max(50000).default(0),
  file_size:z.string().max(50).default('Unknown'),
  tags:z.string().max(500).default(''),
  source_url:z.string().max(2000).default(''),
  license_note:z.string().max(500).default(''),
  license_ok:z.boolean().default(false)
})

type Candidate=z.infer<typeof BookSchema>

const MAX_RESEARCH_CHARS=4000
const MAX_CANDIDATES=5

function compactResearch(value:string){
  return value
    .replace(/\s+/g,' ')
    .slice(0,MAX_RESEARCH_CHARS)
}

function extractJson(text:string){
  const cleaned=text
    .replace(/```json/gi,'')
    .replace(/```/g,'')
    .trim()

  const start=cleaned.indexOf('{')
  const end=cleaned.lastIndexOf('}')

  if(start===-1||end===-1||end<=start){
    throw new Error('Groq did not return valid JSON')
  }

  return JSON.parse(cleaned.slice(start,end+1))
}

export async function POST(req:Request){
  const session=await getServerSession(authOptions)

  if(!session){
    return NextResponse.json(
      {error:'Unauthorized'},
      {status:401}
    )
  }

  if(!process.env.GROQ_API_KEY){
    return NextResponse.json(
      {error:'GROQ_API_KEY is not configured'},
      {status:500}
    )
  }

  try{
    const body=RequestSchema.parse(await req.json())

    const groq=new Groq({
      apiKey:process.env.GROQ_API_KEY
    })

    /*
     * PASS 1
     * Search only. Keep the research response deliberately small.
     */
    const search=await groq.chat.completions.create({
      model:'openai/gpt-oss-120b',

      messages:[
        {
          role:'system',
          content:`
You are the G.I Bookshelf research librarian.

Search the web for books matching the user's request.

Return ONLY concise research notes.

Maximum 5 book candidates.

For each candidate include only:
- title
- author
- legitimate source URL
- download/PDF URL if clearly available
- license or public-domain evidence

Important:
- Prefer public-domain, openly licensed, or clearly authorized free books.
- Do not use piracy sites.
- Do not invent URLs.
- Do not write long descriptions.
- Do not explain your reasoning.
- Keep the entire response concise.
          `.trim()
        },
        {
          role:'user',
          content:body.prompt
        }
      ],

      tools:[
        {type:'browser_search'}
      ],

      tool_choice:'required',

      max_completion_tokens:1500,

      reasoning_effort:'low'
    })

    const searchMessage=search.choices[0]?.message

    const executedTools=
      (searchMessage as unknown as {
        executed_tools?:unknown
      })?.executed_tools

    const searchText=compactResearch(
      [
        searchMessage?.content||'',
        JSON.stringify(executedTools||'')
      ].join('\n')
    )

    /*
     * PASS 2
     * Convert the compact research into database candidates.
     */
    const structured=await groq.chat.completions.create({
      model:'openai/gpt-oss-120b',

      messages:[
        {
          role:'system',
          content:`
Convert the supplied research into book records.

Return ONLY JSON.

Maximum 5 books.

Exact shape:

{
  "books": [
    {
      "title": "",
      "author": "",
      "description": "",
      "category": "",
      "language": "English",
      "cover_url": "",
      "pdf_url": "",
      "page_count": 0,
      "file_size": "Unknown",
      "tags": "",
      "source_url": "",
      "license_note": "",
      "license_ok": false
    }
  ]
}

Rules:
- Never invent URLs.
- pdf_url must come from the research.
- license_ok=true only when credible public-domain,
  open-license, or authorized-free evidence exists.
- If unclear, use false.
- Description must be 1 short sentence.
- Maximum 180 characters for description.
- Do not mention AI.
- Do not exaggerate.
          `.trim()
        },
        {
          role:'user',
          content:searchText
        }
      ],

      max_completion_tokens:2000,

      reasoning_effort:'low'
    })

    const raw=structured.choices[0]?.message?.content||'{}'
    const parsed=extractJson(raw)

    const booksRaw=Array.isArray(parsed.books)
      ?parsed.books.slice(0,MAX_CANDIDATES)
      :[]

    const candidates:Candidate[]=[]

    for(const item of booksRaw){
      try{
        const book=BookSchema.parse(item)

        if(!book.title||!book.pdf_url){
          continue
        }

        candidates.push(book)
      }catch{}
    }

    const imported=[]
    const skipped=[]

    for(const book of candidates){

      if(!book.license_ok){
        skipped.push({
          title:book.title,
          reason:'License/source could not be verified'
        })
        continue
      }

      const duplicate=await prisma.book.findFirst({
        where:{
          title:book.title,
          author:book.author
        }
      })

      if(duplicate){
        skipped.push({
          title:book.title,
          reason:'Already exists'
        })
        continue
      }

      const created=await prisma.book.create({
        data:{
          title:book.title,
          author:book.author,
          description:book.description,
          category:book.category,
          language:book.language,

          cover_url:
            book.cover_url||
            'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&h=800&fit=crop',

          pdf_url:book.pdf_url,
          page_count:book.page_count,
          file_size:book.file_size,
          tags:book.tags,

          published:false
        }
      })

      imported.push({
        id:created.id,
        title:created.title,
        author:created.author,
        category:created.category
      })
    }

    return NextResponse.json({
      ok:true,
      requested:body.prompt,
      found:candidates.length,
      imported,
      skipped
    })

  }catch(error){
    console.error('AI Librarian error:',error)

    return NextResponse.json({
      error:
        error instanceof Error
          ?error.message
          :'AI Librarian failed'
    },{
      status:500
    })
  }
}
