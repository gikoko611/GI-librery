import { NextResponse } from 'next/server'
import {getBook} from '@/lib/books'
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const book=await getBook(id);return book?NextResponse.json(book):NextResponse.json({error:'Book not found'},{status:404})}
