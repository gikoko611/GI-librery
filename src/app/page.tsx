import {BookshelfHome} from '@/components/bookshelf';import {getBooks} from '@/lib/books'
export default async function Home(){return <BookshelfHome books={await getBooks()}/>}
