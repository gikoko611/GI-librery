import {LibraryPage} from '@/components/bookshelf';import {getBooks} from '@/lib/books'
export default async function Library({searchParams}:{searchParams:Promise<{q?:string;sort?:string}>}){const p=await searchParams;return <LibraryPage books={await getBooks()} initialQuery={p.q||''}/>}
