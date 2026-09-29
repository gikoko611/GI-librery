import {CategoriesPage} from '@/components/bookshelf';import {getBooks} from '@/lib/books'
export default async function Categories(){return <CategoriesPage books={await getBooks()}/>}
