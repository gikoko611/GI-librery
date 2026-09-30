import {NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {z} from 'zod'

const Schema=z.object({
  title:z.string().min(1).max(200),
  author:z.string().min(1).max(150),
  description:z.string().max(5000),
  category:z.string().min(1),
  language:z.string().max(60),
  cover_url:z.string().max(2000),
  pdf_url:z.string().max(2000),
  page_count:z.coerce.number().int().min(0).max(50000),
  file_size:z.string().max(50),
  tags:z.string().max(1000),
  published:z.boolean()
})

async function authorized(){
  return !!(await getServerSession(authOptions))
}

async function values(req:Request){
  const form=await req.formData()

  return Schema.parse({
    title:form.get('title'),
    author:form.get('author'),
    description:form.get('description')||'',
    category:form.get('category'),
    language:form.get('language')||'English',
    cover_url:form.get('cover_url')||
      'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&h=800&fit=crop',
    pdf_url:form.get('pdf_url')||'',
    page_count:form.get('page_count')||0,
    file_size:form.get('file_size')||'Unknown',
    tags:form.get('tags')||'',
    published:form.get('published')==='true'
  })
}

export async function GET(){
  if(!await authorized())
    return NextResponse.json({error:'Unauthorized'},{status:401})

  try{
    return NextResponse.json({
      books:await prisma.book.findMany({
        orderBy:{created_at:'desc'}
      })
    })
  }catch{
    return NextResponse.json({books:[]})
  }
}

export async function POST(req:Request){
  if(!await authorized())
    return NextResponse.json({error:'Unauthorized'},{status:401})

  try{
    const data=await values(req)

    return NextResponse.json(
      await prisma.book.create({data}),
      {status:201}
    )
  }catch(e){
    return NextResponse.json({
      error:e instanceof Error?e.message:'Invalid book fields'
    },{status:400})
  }
}

export async function PUT(req:Request){
  if(!await authorized())
    return NextResponse.json({error:'Unauthorized'},{status:401})

  try{
    const fd=await req.formData()
    const id=String(fd.get('id')||'')

    if(!id){
      return NextResponse.json(
        {error:'Book id is required'},
        {status:400}
      )
    }

    const data=await values(
      new Request(req.url,{
        method:'POST',
        body:fd
      })
    )

    return NextResponse.json(
      await prisma.book.update({
        where:{id},
        data
      })
    )
  }catch(e){
    return NextResponse.json({
      error:e instanceof Error?e.message:'Invalid book fields'
    },{status:400})
  }
}
