(function () {
  function create(config, fetcher = fetch) {
    if (![config.owner,config.repository,config.branch].every(value=>typeof value==='string'&&/^[\w.-]+$/.test(value))) throw new Error('Repositorio GitHub invalido.');
    const base='https://api.github.com/repos/'+config.owner+'/'+config.repository;
    let token='', cached=null, lastRead=0;
    const failure=(message,status)=>Object.assign(new Error(message),{status});
    async function request(path,method='GET',payload) {
      const response=await fetcher(base+path,{method,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
      if(!response.ok) {
        if(response.status===401){token='';throw failure('Token incorrecto o vencido.',401);}
        if(response.status===403)throw failure('GitHub rechazo el acceso. Revisa permisos Contents de escritura o el limite de consultas.',403);
        if(response.status===409||response.status===422)throw failure('GitHub cambio mientras editabas o la rama esta protegida. Recarga antes de publicar.',409);
        throw failure('GitHub no pudo completar la operacion ('+response.status+').',response.status);
      }
      return response.json();
    }
    async function head() {return (await request('/git/ref/heads/'+config.branch)).object.sha;}
    async function getMenu(force=false) {
      const interval=token?60000:120000;
      if(cached&&!force&&Date.now()-lastRead<interval)return structuredClone(cached);
      const sha=await head();
      if(cached?.revision===sha){lastRead=Date.now();return structuredClone(cached);}
      const read=async path=>{
        const file=await request('/contents/'+path+'?ref='+sha);
        if(file.encoding!=='base64'||typeof file.content!=='string')throw new Error('JSON de GitHub invalido.');
        return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
      };
      const design=await read('config/design.json'),catalog=await read('config/products.json');
      cached={...H52Data.validate(design,catalog),revision:sha};lastRead=Date.now();return structuredClone(cached);
    }
    return {
      github:true,
      getMenu,
      async getSession(){return {session:token?{role:'waiter'}:null};},
      async signIn(_,password){
        token=String(password||'').trim();
        if(!token)throw failure('Ingresa un token de GitHub.',401);
        try {const repo=await request('');if(repo.permissions?.push!==true)throw failure('Este token no puede editar el repositorio.',403);await getMenu(true);}
        catch(error){token='';throw error;}
      },
      async signOut(){token='';},
      async saveMenu(input){
        if(!token)throw failure('Conecta GitHub antes de publicar.',401);
        const payload=H52Data.validate(input.design,input.catalog);
        const parent=await head();
        if(parent!==input.expectedRevision)throw failure('Otro cambio llego a GitHub. Descarga tu borrador y recarga antes de publicar.',409);
        const previous=await request('/git/commits/'+parent);
        const tree=await request('/git/trees','POST',{base_tree:previous.tree.sha,tree:[
          {path:'config/design.json',mode:'100644',type:'blob',content:JSON.stringify(payload.design,null,2)+'\n'},
          {path:'config/products.json',mode:'100644',type:'blob',content:JSON.stringify(payload.catalog,null,2)+'\n'},
          {path:'assets/offline-data.js',mode:'100644',type:'blob',content:'window.H52_OFFLINE_DATA = '+JSON.stringify(payload)+';\n'}
        ]});
        const commit=await request('/git/commits','POST',{message:'Actualizar carta y diseno desde el editor H52',tree:tree.sha,parents:[parent]});
        // A non-fast-forward update fails if another editor published first.
        await request('/git/refs/heads/'+config.branch,'PATCH',{sha:commit.sha,force:false});
        cached={...payload,revision:commit.sha};lastRead=Date.now();
        return structuredClone(cached);
      }
    };
  }
  window.H52GithubEditor={create};
})();
