import { NextResponse } from 'next/server'
import { getBooks } from '@/lib/books'
export async function GET(){try{return NextResponse.json(await getBooks())}catch{return NextResponse.json({error:'Unable to load books'},{status:500})}}
