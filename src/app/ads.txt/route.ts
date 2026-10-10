import {authorizedAdsTxt} from '@/lib/advertising';
export function GET(){return new Response(authorizedAdsTxt(process.env.ADSENSE_ADS_TXT_LINE??'',process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID??''),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});}

