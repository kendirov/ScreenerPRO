export const dynamic="force-dynamic";

export async function GET(){
  return Response.json({
    ok:true,
    commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
    environment:process.env.VERCEL_ENV||null
  },{headers:{"Cache-Control":"no-store"}});
}
