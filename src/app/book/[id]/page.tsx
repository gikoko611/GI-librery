export const dynamic = 'force-dynamic'
import {BookDetails} from '@/components/bookshelf';import {getBook} from '@/lib/books';import {notFound} from 'next/navigation'
export default async function BookPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const book=await getBook(id);if(!book)notFound();return <BookDetails book={book}/>}
