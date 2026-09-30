import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Groq from 'groq-sdk'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  prompt: z.string().min(3).max(4000),
})

const BookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(150),
  description: z.string().max(5000).default(''),
  category: z.string().min(1).max(100),
  language: z.string().max(60).default('English'),
  cover_url: z.string().max(2000).default(''),
  pdf_url: z.string().max(2000).default(''),
  page_count: z.number().int().min(0).max(50000).default(0),
  file_size: z.string().max(50).default('Unknown'),
  tags: z.string().max(1000).default(''),
  source_url: z.string().max(2000).default(''),
  license_note: z.string().max(500).default(''),
  license_ok: z.boolean().default(false),
})

type Candidate = z.infer<typeof BookSchema>

/*
 * Keep the research payload small enough that the second Groq request
 * cannot accidentally exceed the model context window.
 */
const MAX_RESEARCH_CHARS = 12000
const MAX_CANDIDATES = 10

function compactResearch(text: string) {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length <= MAX_RESEARCH_CHARS) {
    return cleaned
  }

  return cleaned.slice(0, MAX_RESEARCH_CHARS) +
    '\n[Research truncated for context safety]'
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Groq did not return valid JSON')
  }

  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured' },
      { status: 500 }
    )
  }

  try {
    const body = RequestSchema.parse(await req.json())

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })

    /*
     * Pass 1:
     * Search the web for legitimate free/openly licensed books.
     *
     * Keep the search request itself focused so the browser-search
     * response does not become unnecessarily large.
     */
    const search = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',

      messages: [
        {
          role: 'system',
          content: `
You are the G.I Bookshelf AI Librarian.

Research books matching the administrator's request.

Rules:
- Prefer public-domain, openly licensed, or clearly authorized free books.
- Never recommend pirated copies.
- Prefer legitimate publisher, author, university, archive,
  or recognized open-book sources.
- Find real source/download URLs.
- Never invent URLs.
- Focus on at most ${MAX_CANDIDATES} useful candidates.
- Return concise research.
          `.trim(),
        },
        {
          role: 'user',
          content: body.prompt,
        },
      ],

      tools: [
        {
          type: 'browser_search',
        },
      ],

      tool_choice: 'required',

      max_tokens: 2500,
    })

    const searchMessage = search.choices[0]?.message

    /*
     * Browser-search responses can contain a very large amount of data.
     * We intentionally compact and hard-limit it before sending it to
     * the second Groq request.
     */
    const contentText =
      typeof searchMessage?.content === 'string'
        ? searchMessage.content
        : ''

    const executedTools =
      (searchMessage as unknown as {
        executed_tools?: unknown
      })?.executed_tools

    const toolText =
      executedTools
        ? JSON.stringify(executedTools)
        : ''

    const researchText = compactResearch(
      [
        contentText,
        toolText,
      ]
        .filter(Boolean)
        .join('\n')
    )

    if (!researchText) {
      return NextResponse.json({
        ok: true,
        requested: body.prompt,
        found: 0,
        imported: [],
        skipped: [],
        message: 'No usable research results were returned.',
      })
    }

    /*
     * Pass 2:
     * Convert only the compacted research into predictable book objects.
     */
    const structured = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',

      messages: [
        {
          role: 'system',
          content: `
Extract up to ${MAX_CANDIDATES} book records from the research.

Return ONLY JSON:

{
  "books": [
    {
      "title": "...",
      "author": "...",
      "description": "...",
      "category": "...",
      "language": "English",
      "cover_url": "",
      "pdf_url": "",
      "page_count": 0,
      "file_size": "Unknown",
      "tags": "tag1, tag2",
      "source_url": "...",
      "license_note": "...",
      "license_ok": true
    }
  ]
}

Rules:
- Never invent URLs.
- pdf_url must come from the supplied research.
- source_url must come from the supplied research.
- license_ok=true only when there is credible evidence that
  the book is public domain, openly licensed, or authorized
  for free redistribution.
- If licensing is unclear, use license_ok=false.
- Do not include pirated sources.
- Description must be 1-2 short sentences.
- Description maximum 300 characters.
- Do not repeat the title in the description.
- Do not mention AI.
- Do not exaggerate.
- Use only information contained in the research.
          `.trim(),
        },
        {
          role: 'user',
          content: `RESEARCH:\n${researchText}`,
        },
      ],

      max_tokens: 3000,
    })

    const raw = structured.choices[0]?.message?.content || '{}'
    const parsed = extractJson(raw)

    const booksRaw = Array.isArray(parsed.books)
      ? parsed.books.slice(0, MAX_CANDIDATES)
      : []

    const candidates: Candidate[] = []

    for (const item of booksRaw) {
      try {
        const book = BookSchema.parse(item)

        if (!book.title || !book.pdf_url) {
          continue
        }

        candidates.push(book)
      } catch {
        // Ignore malformed model output.
      }
    }

    const imported: {
      id: string
      title: string
      author: string
      category: string
    }[] = []

    const skipped: {
      title: string
      reason: string
    }[] = []

    /*
     * Controlled database import:
     * - license must be acceptable according to the research
     * - duplicate title + author is skipped
     * - every imported book remains unpublished/draft
     */
    for (const book of candidates) {
      if (!book.license_ok) {
        skipped.push({
          title: book.title,
          reason: 'License/source could not be verified',
        })

        continue
      }

      const duplicate = await prisma.book.findFirst({
        where: {
          title: book.title,
          author: book.author,
        },
      })

      if (duplicate) {
        skipped.push({
          title: book.title,
          reason: 'Already exists',
        })

        continue
      }

      const created = await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          description: book.description,
          category: book.category,
          language: book.language,

          cover_url:
            book.cover_url ||
            'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&h=800&fit=crop',

          pdf_url: book.pdf_url,
          page_count: book.page_count,
          file_size: book.file_size,
          tags: book.tags,

          /*
           * Important:
           * AI imports are drafts until the administrator reviews
           * the source/license.
           */
          published: false,
        },
      })

      imported.push({
        id: created.id,
        title: created.title,
        author: created.author,
        category: created.category,
      })
    }

    return NextResponse.json({
      ok: true,
      requested: body.prompt,
      found: candidates.length,
      imported,
      skipped,
    })
  } catch (error) {
    console.error('AI Librarian error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'AI Librarian failed',
      },
      {
        status: 500,
      }
    )
  }
}
