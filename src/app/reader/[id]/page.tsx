import {getBook} from '@/lib/books';import {notFound} from 'next/navigation';import {Reader} from '@/components/reader'
export default async function ReaderRoute({params}:{params:Promise<{id:string}>}){const {id}=await params;const book=await getBook(id);if(!book)notFound();return <Reader book={book}/>}
