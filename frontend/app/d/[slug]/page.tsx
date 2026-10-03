import {notFound} from "next/navigation";
import {PublicDocumentClient} from "@/components/studio-v5/PublicDocumentClient";

export default async function PublicDocumentPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{t?:string}>}){
  const [{slug},{t}]=await Promise.all([params,searchParams]);
  if(!t)notFound();
  return <PublicDocumentClient slug={slug} token={t}/>;
}
