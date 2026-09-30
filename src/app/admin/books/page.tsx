'use client'
import Link from 'next/link';import {useEffect,useState} from 'react';import {useSession} from 'next-auth/react';import {useRouter} from 'next/navigation';import {BookOpen,Plus,Search,Trash2,Eye,EyeOff} from 'lucide-react';import type {Book} from '@/lib/books'
export default function AdminBooks(){const{status}=useSession();const router=useRouter();const[books,setBooks]=useState<Book[]>([]),[q,setQ]=useState(''),[msg,setMsg]=useState('');useEffect(()=>{if(status==='unauthenticated')router.replace('/admin/login');if(status==='authenticated')fetch('/api/admin/books').then(r=>r.json()).then(x=>setBooks(x.books||[]))},[status,router]);async function action(id:string,what:string){if(what==='delete'&&!confirm('Delete this book permanently?'))return;const r=await fetch(`/api/admin/books/${id}`,{method:what==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:what==='delete'?undefined:JSON.stringify({published:what==='publish'})});if(r.ok){setBooks(b=>what==='delete'?b.filter(x=>x.id!==id):b.map(x=>x.id===id?{...x,published:what==='publish'}:x));setMsg(what==='delete'?'Book deleted.':'Visibility updated.');setTimeout(()=>setMsg(''),2500)}}if(status==='loading')return <main className="admin-page">Loading workspace…</main>;return <main className="admin-page"><header className="admin-header"><Link href="/admin" className="brand"><span className="brand-mark"><BookOpen size={19}/></span><span>G.I <b>Bookshelf</b></span></Link><Link href="/admin/books/new" className="btn-primary"><Plus size={16}/> Add a book</Link></header><div className="admin-welcome-block"><span className="section-kicker">CATALOG MANAGEMENT</span><h1>Your <em>bookshelf.</em></h1><p>Keep the collection thoughtful, current, and ready to read.</p></div>{msg&&<p className="toast">{msg}</p>}<div className="library-search admin-search"><Search size={18}/><input placeholder="Search your books…" aria-label="Search books" value={q} onChange={e=>setQ(e.target.value)}/></div><section className="admin-panel">{books.filter(b=>b.title.toLowerCase().includes(q.toLowerCase())).map(b=><div className="admin-row" key={b.id}><div className="admin-book-icon">▤</div><div className="admin-book-title"><b>{b.title}</b><small>{b.author} · {b.category} · {b.language}</small></div><span className={b.published?'status-live':'status-draft'}>{b.published?'Published':'Draft'}</span><span className="row-downloads">{b.download_count.toLocaleString()} downloads</span><Link href={`/admin/books/${b.id}/edit`} className="row-edit">Edit</Link><button
  className={`admin-action admin-visibility ${b.published?'is-published':'is-draft'}`}
  aria-label={b.published?'Unpublish':'Publish'}
  onClick={()=>action(b.id,b.published?'unpublish':'publish')}
>
  {b.published ? (
    <>
      <EyeOff size={15}/>
      <span>Unpublish</span>
    </>
  ) : (
    <>
      <Eye size={15}/>
      <span>Publish</span>
    </>
  )}
</button><button className="admin-action danger" aria-label="Delete book" onClick={()=>action(b.id,'delete')}><Trash2 size={17}/></button></div>)}{books.length===0&&<div className="admin-empty">No books saved yet. Add your first book to start.</div>}</section><Link href="/admin" className="back-link">← Dashboard</Link></main>}
