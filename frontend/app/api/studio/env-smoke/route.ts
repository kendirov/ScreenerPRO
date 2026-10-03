function safe(name:string){
  const raw=process.env[name]||"";
  if(!raw)return {present:false};
  try{const u=new URL(raw);return {present:true,protocol:u.protocol,hostname:u.hostname,port:u.port,pathname:u.pathname,hasUser:Boolean(u.username),hasPassword:Boolean(u.password)}}catch{return {present:true,parseable:false,length:raw.length}}
}
export async function GET(){
  return Response.json({
    POSTGRES_URL:safe("POSTGRES_URL"),
    POSTGRES_PRISMA_URL:safe("POSTGRES_PRISMA_URL"),
    DATABASE_URL:safe("DATABASE_URL"),
    SUPABASE_DB_URL:safe("SUPABASE_DB_URL"),
    NEXT_PUBLIC_SUPABASE_URL:safe("NEXT_PUBLIC_SUPABASE_URL")
  },{headers:{"Cache-Control":"no-store"}});
}
