import {NextResponse} from 'next/server'
export async function POST(){return NextResponse.json({error:'Public registration is disabled. Admin accounts must be provisioned by the site owner.'},{status:403})}
