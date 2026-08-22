export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === "OPTIONS")
    return new Response(null,{status:204,headers:corsHeaders(request)});

  if (!["GET","HEAD"].includes(request.method))
    return new Response("Method Not Allowed",{status:405,headers:corsHeaders(request)});

  const remote=url.searchParams.get("url");
  if(!remote) return json({success:false,message:"Missing url"},400,request);

  let target;
  try{ target=new URL(remote); }catch(_){
    return json({success:false,message:"Invalid url"},400,request);
  }

  if(target.protocol!=="https:" || !target.hostname.endsWith(".cloudfront.net"))
    return json({success:false,message:"Remote host not allowed"},403,request);

  try{
    const headers={};
    const range=request.headers.get("Range");
    if(range) headers.Range=range;

    const upstream=await fetch(target.toString(),{method:request.method,headers});
    const out=new Headers();

    for(const name of ["Content-Type","Content-Length","Content-Range","Accept-Ranges","Cache-Control","ETag","Last-Modified"]){
      const value=upstream.headers.get(name);
      if(value) out.set(name,value);
    }
    addCors(out,request);

    return new Response(upstream.body,{status:upstream.status,headers:out});
  }catch(error){
    return json({success:false,message:error instanceof Error?error.message:"File request failed"},502,request);
  }
}

function addCors(h,request){
 h.set("Access-Control-Allow-Origin",request.headers.get("Origin")||"*");
 h.set("Vary","Origin");
 h.set("Access-Control-Allow-Methods","GET,HEAD,OPTIONS");
 h.set("Access-Control-Allow-Headers","Range, Content-Type, Authorization, Accept");
}
function corsHeaders(request){const h=new Headers();addCors(h,request);return h;}
function json(data,status,request){const h=corsHeaders(request);h.set("Content-Type","application/json; charset=utf-8");return new Response(JSON.stringify(data),{status,headers:h});}
