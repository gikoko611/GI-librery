import {NextResponse} from 'next/server'
import {prisma} from '@/lib/db'
import {getBook} from '@/lib/books'
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;let book=await getBook(id);if(!book)return NextResponse.json({error:'Book not found'},{status:404});try{book=await prisma.book.update({where:{id},data:{download_count:{increment:1}}}) as typeof book}catch{}if(!book.pdf_url)return NextResponse.json({error:'This sample listing does not have an attached PDF yet.'},{status:404});return NextResponse.redirect(book.pdf_url)}
