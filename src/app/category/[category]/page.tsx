import {LibraryPage} from '@/components/bookshelf';import {getBooks} from '@/lib/books';import {notFound} from 'next/navigation'
export default async function Category({params}:{params:Promise<{category:string}>}){const {category}=await params;const decoded=decodeURIComponent(category);if(!decoded)return notFound();return <LibraryPage books={await getBooks()} category={decoded}/>}
